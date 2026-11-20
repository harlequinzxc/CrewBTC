import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  cardKey,
  clampBands,
  DEFAULT_BODY_STYLE,
  DEFAULT_IMAGE_TRANSFORM,
  DEFAULT_HEADER_STYLE,
} from '../../types/card'
import { bandsForContent } from '../../types/band-fit'
import type { Card, CardBands, ImageTransform, PhotoSource, TextStyle } from '../../types/card'

/**
 * Every card on the sheet, and the one way to change any of them.
 *
 * Cards live in a flat map keyed `cellIndex|documentId|pageNumber`, which is stable
 * across re-reads: the same dish lands back on the same card, keeping whatever framing,
 * bands and type the user gave it.
 *
 * Only the mutation is centralised; the reading is a plain map lookup, so a component
 * that re-renders costs nothing.
 */

export interface CardStore {
  readonly cards: Readonly<Record<string, Card>>
  /** Writes a whole card, which is how a page's scan lands on the sheet. */
  readonly setCard: (key: string, card: Card) => void
  /** Creates a card only if the key is new, so a re-scan cannot undo an edit. */
  readonly seedCard: (key: string, card: Card) => void
  readonly setText: (key: string, zone: 'header' | 'body', text: string) => void
  readonly setStyle: (key: string, zone: 'header' | 'body', style: TextStyle) => void
  readonly setImage: (key: string, transform: ImageTransform) => void
  readonly setBands: (key: string, bands: CardBands, cellHeightMm: number) => void
  readonly reset: () => void
  /** Put a whole set back, for Undo. Replaces rather than merges. */
  readonly restoreCards: (cards: Readonly<Record<string, Card>>) => void
}

/**
 * `restore` seeds the store, so a restored session paints its cards rather than flashing
 * empty ones first. Seeding stays additive on top: `seedCard` still refuses to overwrite,
 * so a restored edit wins.
 *
 * The snapshot arrives **asynchronously** — it is read from IndexedDB, so on the first
 * render it does not exist yet. Initialising the state from it therefore does nothing, and
 * did nothing: every reload drew the sheet from the re-parsed documents and quietly threw
 * away every card edit, photo transform and band drag. The earlier version of this comment
 * claimed the store was seeded "before the first render", which was only true once the
 * value was already there. Apply it during render when it finally arrives, exactly as
 * `use-batch` does, and only for the value being compared so a later local edit is not
 * overwritten by a stale snapshot.
 */
export function useCards(restore?: Readonly<Record<string, Card>> | null): CardStore {
  const [cards, setCards] = useState<Record<string, Card>>(() => ({ ...restore }))
  const [restoredFrom, setRestoredFrom] = useState<Readonly<Record<string, Card>> | null>(null)

  if (restore !== undefined && restore !== null && restore !== restoredFrom) {
    // Render-phase state adjustment: the value is already known, so an effect would only
    // start a second render to reach it — and `set-state-in-effect` forbids that shape.
    setRestoredFrom(restore)
    setCards((current) => ({ ...restore, ...current }))
  }

  const patch = useCallback((key: string, change: (card: Card) => Card) => {
    setCards((current) => {
      const card = current[key]
      return card === undefined ? current : { ...current, [key]: change(card) }
    })
  }, [])

  const setCard = useCallback((key: string, card: Card) => {
    setCards((current) => ({ ...current, [key]: card }))
  }, [])

  const seedCard = useCallback((key: string, card: Card) => {
    setCards((current) => (current[key] === undefined ? { ...current, [key]: card } : current))
  }, [])

  const setText = useCallback(
    (key: string, zone: 'header' | 'body', text: string) => {
      patch(key, (card) =>
        zone === 'header' ? { ...card, headerText: text } : { ...card, bodyText: text },
      )
    },
    [patch],
  )

  const setStyle = useCallback(
    (key: string, zone: 'header' | 'body', style: TextStyle) => {
      patch(key, (card) =>
        zone === 'header' ? { ...card, headerStyle: style } : { ...card, bodyStyle: style },
      )
    },
    [patch],
  )

  const setImage = useCallback(
    (key: string, transform: ImageTransform) => {
      patch(key, (card) => ({ ...card, imageTransform: transform }))
    },
    [patch],
  )

  const setBands = useCallback(
    (key: string, bands: CardBands, cellHeightMm: number) => {
      patch(key, (card) => ({ ...card, bands: clampBands(bands, cellHeightMm) }))
    },
    [patch],
  )

  const reset = useCallback(() => setCards({}), [])
  const restoreCards = useCallback(
    (restored: Readonly<Record<string, Card>>) => setCards({ ...restored }),
    [],
  )

  // Memoised because `seedCard` is an effect dependency downstream: a fresh object each
  // render would re-run the seeding effect on every render for no reason at all.
  return useMemo(
    () => ({
      cards,
      setCard,
      seedCard,
      setText,
      setStyle,
      setImage,
      setBands,
      reset,
      restoreCards,
    }),
    [cards, setCard, seedCard, setText, setStyle, setImage, setBands, reset, restoreCards],
  )
}

/** A card that has never been scanned: empty boxes, default bands, ready to type into. */
export function blankCard(cellHeightMm: number): Card {
  return {
    headerText: '',
    bodyText: '',
    photo: null,
    headerStyle: DEFAULT_HEADER_STYLE,
    bodyStyle: DEFAULT_BODY_STYLE,
    imageTransform: DEFAULT_IMAGE_TRANSFORM,
    bands: { headerMm: Math.round(cellHeightMm * 0.145), footerMm: Math.round(cellHeightMm * 0.22) },
  }
}

/** The scan of one placed page, as the batch recorded it. */
export interface CardSeed {
  readonly key: string
  readonly headerText: string
  readonly bodyText: string
  readonly photo: PhotoSource | null
}

/**
 * Fills a card the first time its page is seen, and never again.
 *
 * This is what makes an upload land on a populated card instead of an empty one, while
 * still guaranteeing that a re-render, a settings change or a second upload of the same
 * file cannot overwrite words the user has typed. New cards are seeded, existing ones
 * are left alone.
 */
export function useSeedCards(
  store: CardStore,
  seeds: readonly CardSeed[],
  cellHeightMm: number,
  cellWidthMm: number,
): void {
  /**
   * `seedCard` only writes where no card exists, so re-running over a seed that is already
   * in the store is free.
   *
   * There used to be a `Set` of seeded keys in a ref here as a shortcut. It outlived the
   * cards: clearing the uploads emptied the store but not the set, so the next upload
   * matched every key and seeded nothing — one clear was enough to leave the whole
   * document blank for the rest of the session. The store is the source of truth for
   * whether a card exists, so ask it rather than caching the answer.
   */
  useEffect(() => {
    if (seeds.length === 0) return

    for (const seed of seeds) {
      // The split follows the text, so a short title does not hold ten millimetres of
      // blank paper away from its photo. Edits are never re-seeded, so a card the user has
      // tuned keeps its tuned bands.
      const bands = bandsForContent({
        headerText: seed.headerText,
        footerText: seed.bodyText,
        cellWidthMm,
        cellHeightMm,
      })

      store.seedCard(seed.key, {
        ...blankCard(cellHeightMm),
        bands: bands ?? blankCard(cellHeightMm).bands,
        headerText: seed.headerText,
        bodyText: seed.bodyText,
        photo: seed.photo,
      })
    }
  }, [seeds, store, cellHeightMm, cellWidthMm])
}

export { cardKey }

import { useCallback } from 'react'
import { bandsInto, resetProportions, textScaleInto } from './card-edits'
import type { Card, CardBands } from '../../types/card'
import type { useCards } from './use-cards'

/**
 * The three edits the inspector makes to whichever card is selected.
 *
 * One lookup, three patches: the selected card, or nothing if the sheet has no card in
 * that cell. Repeating the guard in each handler is how they drift apart — the reset would
 * write a blank card into a cell the numbers never touched.
 */
export interface CardInspectorEdits {
  readonly onBandsChange: (bands: CardBands) => void
  readonly onTextScaleChange: (textScale: number) => void
  readonly onResetCard: () => void
}

export function useCardInspector(
  store: ReturnType<typeof useCards>,
  selectionKey: string | null,
  cellHeightMm: number,
): CardInspectorEdits {
  const patch = useCallback(
    (change: (card: Card) => Card) => {
      if (selectionKey === null) return
      const card = store.cards[selectionKey]
      if (card === undefined) return
      store.setCard(selectionKey, change(card))
    },
    [selectionKey, store],
  )

  return {
    onBandsChange: useCallback(
      (bands: CardBands) => patch((card) => bandsInto(card, bands, cellHeightMm)),
      [patch, cellHeightMm],
    ),
    onTextScaleChange: useCallback(
      (textScale: number) => patch((card) => textScaleInto(card, textScale)),
      [patch],
    ),
    onResetCard: useCallback(
      () => patch((card) => resetProportions(card, cellHeightMm)),
      [patch, cellHeightMm],
    ),
  }
}

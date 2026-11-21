import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useCards, useSeedCards } from '../../features/workspace/cards/use-cards'
import type { CardSeed } from '../../features/workspace/cards/use-cards'

/**
 * Seeding fills the sheet once, never over the user's work, and again after a clear.
 *
 * `useSeedCards` used to keep a `Set` of keys it had written, as a shortcut for "already
 * done". The set outlived the cards: clearing the uploads emptied the store but not the
 * set, so the next upload matched every key and seeded nothing — one clear left the whole
 * document blank for the rest of the session. Asking the store instead is both correct and
 * cheap, because `seedCard` refuses to overwrite a card that already exists.
 */
const seed = (key: string, headerText: string): CardSeed => ({
  key,
  headerText,
  bodyText: '',
  photo: null,
})

function Probe(props: { readonly seeds: readonly CardSeed[] }) {
  const store = useCards()
  useSeedCards(store, props.seeds, 67)
  return (
    <div>
      <output data-testid="cards">{JSON.stringify(store.cards)}</output>
      <button
        type="button"
        aria-label="edit first"
        onClick={() => {
          const first = Object.keys(store.cards)[0]
          if (first !== undefined) store.setText(first, 'header', 'EDITED')
        }}
      />
      <button type="button" aria-label="edit bands" onClick={() => {
        const first = Object.keys(store.cards)[0]
        if (first !== undefined) store.setBands(first, { headerMm: 12, footerMm: 22 }, 67)
      }} />
      <button type="button" aria-label="clear" onClick={() => store.reset()} />
    </div>
  )
}

const cards = (): Record<string, { headerText: string; bands: { headerMm: number; footerMm: number } }> =>
  JSON.parse(screen.getByTestId('cards').textContent ?? '{}') as Record<
    string,
    { headerText: string; bands: { headerMm: number; footerMm: number } }
  >

describe('seeding', () => {
  it('starts newly extracted cards at the requested band heights', async () => {
    render(<Probe seeds={[seed('0|a.pdf|1', 'One')]} />)
    await waitFor(() => expect(cards()['0|a.pdf|1']?.bands).toEqual({ headerMm: 7.28, footerMm: 35.45 }))
  })

  it('writes every seed it is given', async () => {
    render(<Probe seeds={[seed('0|a.pdf|1', 'One'), seed('0|a.pdf|2', 'Two')]} />)
    await waitFor(() => expect(Object.keys(cards())).toHaveLength(2))
    expect(cards()['0|a.pdf|1']?.headerText).toBe('One')
  })

  it('does not overwrite a card the user has edited', async () => {
    const seeds = [seed('0|a.pdf|1', 'One')]
    const { rerender } = render(<Probe seeds={seeds} />)
    await waitFor(() => expect(cards()['0|a.pdf|1']?.headerText).toBe('One'))

    fireEvent.click(screen.getByRole('button', { name: 'edit first' }))
    await waitFor(() => expect(cards()['0|a.pdf|1']?.headerText).toBe('EDITED'))

    // A re-render, or a re-plan handing back the same seeds, must leave the edit alone.
    rerender(<Probe seeds={seeds} />)
    await waitFor(() => expect(cards()['0|a.pdf|1']?.headerText).toBe('EDITED'))
  })

  it('never replaces a previously edited band split during seeding', async () => {
    const seeds = [seed('0|a.pdf|1', 'One')]
    const { rerender } = render(<Probe seeds={seeds} />)
    await waitFor(() => expect(cards()['0|a.pdf|1']?.bands.headerMm).toBe(7.28))
    fireEvent.click(screen.getByRole('button', { name: 'edit bands' }))
    await waitFor(() => expect(cards()['0|a.pdf|1']?.bands).toEqual({ headerMm: 12, footerMm: 22 }))
    rerender(<Probe seeds={[...seeds]} />)
    expect(cards()['0|a.pdf|1']?.bands).toEqual({ headerMm: 12, footerMm: 22 })
  })

  it('re-seeds after the uploads are cleared and loaded again', async () => {
    const seeds = [seed('0|a.pdf|1', 'One')]
    const { rerender } = render(<Probe seeds={seeds} />)
    await waitFor(() => expect(cards()['0|a.pdf|1']?.headerText).toBe('One'))

    // Clearing the uploads empties the page list and the card store together — the effect
    // sees no seeds while the store is emptied. The old `Set` survived exactly this and
    // then matched every key on the next upload.
    rerender(<Probe seeds={[]} />)
    fireEvent.click(screen.getByRole('button', { name: 'clear' }))
    await waitFor(() => expect(Object.keys(cards())).toHaveLength(0))

    // Loading the same file again produces the same keys. They must repopulate.
    rerender(<Probe seeds={seeds} />)
    await waitFor(() => expect(cards()['0|a.pdf|1']?.headerText).toBe('One'))
  })
})

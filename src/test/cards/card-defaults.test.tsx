import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useCardDefaults } from '../../features/workspace/cards/use-card-defaults'
import { useCards, useSeedCards } from '../../features/workspace/cards/use-cards'

beforeEach(() => localStorage.clear())
describe('new card defaults', () => {
  it('persists a preset while leaving already seeded cards unchanged', async () => {
    const seeds = [{ key: 'a', headerText: 'a', bodyText: 'b', photo: null }]
    const { result, rerender } = renderHook(({ more }: { more: boolean }) => {
      const defaults = useCardDefaults()
      const store = useCards()
      useSeedCards(store, more ? [...seeds, { ...seeds[0]!, key: 'b' }] : seeds, 67, defaults.bands)
      return { defaults, store }
    }, { initialProps: { more: false } })
    await waitFor(() => expect(result.current.store.cards.a).toBeDefined())
    const original = result.current.store.cards.a?.bands
    act(() => result.current.defaults.save({ headerMm: 10, footerMm: 20 }))
    rerender({ more: true })
    await waitFor(() => expect(result.current.store.cards.b?.bands).toEqual({ headerMm: 10, footerMm: 20 }))
    expect(result.current.store.cards.a?.bands).toEqual(original)
    const other = renderHook(() => useCardDefaults())
    expect(other.result.current.bands).toEqual({ headerMm: 10, footerMm: 20 })
    act(() => other.result.current.reset())
    expect(other.result.current.bands).toEqual({ headerMm: 8.56, footerMm: 35.45 })
  })
  it('rejects damaged saved defaults', () => {
    localStorage.setItem('crewbtc.card-bands.v1', '{"headerMm":-1,"footerMm":100}')
    expect(renderHook(() => useCardDefaults()).result.current.bands).toEqual({ headerMm: 8.56, footerMm: 35.45 })
  })
})

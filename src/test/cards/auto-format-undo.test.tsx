import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { blankCard, useCards } from '../../features/workspace/cards/use-cards'

describe('automated formatting undo', () => {
  it('restores unchanged formatted cards but never overwrites a later edit or clear', () => {
    const { result } = renderHook(() => useCards())
    const old = blankCard(67)
    const formatted = { ...old, bodyText: '• first' }
    act(() => result.current.restoreCards({ a: formatted, b: formatted }))
    act(() => result.current.setText('b', 'body', 'later edit'))
    act(() => result.current.undoFormattedCards({ a: old, b: old }, { a: formatted, b: formatted }))
    expect(result.current.cards.a).toBe(old)
    expect(result.current.cards.b?.bodyText).toBe('later edit')
    act(() => result.current.reset())
    act(() => result.current.undoFormattedCards({ a: old }, { a: formatted }))
    expect(result.current.cards).toEqual({})
  })
})

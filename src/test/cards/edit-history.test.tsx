import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useEditHistory } from '../../features/workspace/history/use-edit-history'
import { blankCard } from '../../features/workspace/cards/use-cards'

describe('edit history', () => {
  it('caps history, redoes changes, and clears redo after a new edit', () => {
    const apply = vi.fn()
    const { result } = renderHook(() => useEditHistory(apply, vi.fn()))
    const card = blankCard(67)
    for (let i = 0; i < 85; i++) act(() => result.current.record({ kind: 'cards', before: { a: { ...card, bodyText: `${i}` } }, after: { a: { ...card, bodyText: `${i + 1}` } } }))
    for (let i = 0; i < 80; i++) act(() => result.current.undo())
    expect(apply).toHaveBeenCalledTimes(80)
    expect(result.current.canUndo).toBe(false)
    expect(result.current.canRedo).toBe(true)
    act(() => result.current.redo())
    expect(apply).toHaveBeenLastCalledWith({ a: { ...card, bodyText: '6' } })
    act(() => result.current.record({ kind: 'cards', before: { a: card }, after: { a: { ...card, bodyText: 'new' } } }))
    expect(result.current.canRedo).toBe(false)
  })

  it('coalesces consecutive grouped edits and discards a group that returns to its start', () => {
    const apply = vi.fn()
    const { result } = renderHook(() => useEditHistory(apply, vi.fn()))
    const card = blankCard(67), edited = { ...card, bodyText: 'one' }
    act(() => result.current.record({ kind: 'cards', before: { a: card }, after: { a: edited } }, 'text:a'))
    act(() => result.current.record({ kind: 'cards', before: { a: edited }, after: { a: card } }, 'text:a'))
    expect(result.current.canUndo).toBe(false)
    expect(apply).not.toHaveBeenCalled()
  })
})

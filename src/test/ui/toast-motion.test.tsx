import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Toast } from '../../components/ui/Toast'

afterEach(() => { vi.useRealTimers(); delete document.documentElement.dataset.reducedMotion })

describe('toast motion lifecycle', () => {
  it('performs the action immediately, then dismisses after its exit timer', () => {
    vi.useFakeTimers()
    const action = vi.fn(), dismiss = vi.fn()
    render(<Toast toast={{ id: 'a', variant: 'info', title: 'Changed', undo: action }} onDismiss={dismiss} />)
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(action).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled()
    expect(dismiss).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(200) })
    expect(dismiss).toHaveBeenCalledWith('a')
  })

  it('uses a short reduced-motion exit and cancels timers on unmount', () => {
    vi.useFakeTimers()
    document.documentElement.dataset.reducedMotion = 'true'
    const dismiss = vi.fn()
    const view = render(<Toast toast={{ id: 'b', variant: 'info', title: 'Changed', undo: vi.fn() }} onDismiss={dismiss} />)
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    act(() => { vi.advanceTimersByTime(79) })
    expect(dismiss).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(1) })
    expect(dismiss).toHaveBeenCalledTimes(1)
    view.unmount()
    act(() => { vi.advanceTimersByTime(6000) })
    expect(dismiss).toHaveBeenCalledTimes(1)
  })
})

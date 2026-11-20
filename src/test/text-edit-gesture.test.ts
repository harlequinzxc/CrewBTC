import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi, afterEach } from 'vitest'
import { useTextEditGesture } from '../features/workspace/use-text-edit-gesture'

/**
 * The gesture that opens a card's text, and the two ways its first draft went wrong.
 *
 * Both defects were found with a real mouse in a real browser, which is why the browser
 * test exists. These are the parts that need no browser: how many listeners a sheet
 * installs, and whose press each one claims.
 */
const press = (target: Element, timeStamp = 100): PointerEvent => {
  const event = new PointerEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 })
  Object.defineProperty(event, 'timeStamp', { value: timeStamp })
  target.dispatchEvent(event)
  return event
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('the text edit gesture', () => {
  it('does not open a box whose own handler already ran', async () => {
    const { result } = renderHook(() => useTextEditGesture())
    const button = document.createElement('button')
    button.setAttribute('aria-label', 'Card text: Kung Pao')
    document.body.append(button)

    const begin = vi.fn()
    result.current.register(button, begin)

    /*
      The ordinary sequence: the browser captures the press, the listener defers its
      decision, the button's own handler runs, and only then does the deferred check run
      and stand down. Dispatching the press and letting the button handle it in the same
      task reproduces that order.
    */
    button.addEventListener('pointerdown', () =>
      result.current.press(
        {
          button: 0,
          timeStamp: 100,
          currentTarget: button,
          stopPropagation: () => undefined,
          preventDefault: () => undefined,
        } as unknown as React.PointerEvent<HTMLElement>,
        begin,
      ),
    )

    press(button, 100)
    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(begin).toHaveBeenCalledTimes(1)
    // The one call is the ordinary path's, not a second rescue on top of it.
    expect(button.hasAttribute('data-text-gesture-opened')).toBe(false)
  })

  it('opens a box whose own handler never ran', async () => {
    const { result } = renderHook(() => useTextEditGesture())
    const button = document.createElement('button')
    button.setAttribute('aria-label', 'Card text: Kung Pao')
    document.body.append(button)

    const begin = vi.fn()
    result.current.register(button, begin)

    press(button, 200)
    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(begin).toHaveBeenCalledTimes(1)
  })

  /*
    The regression this signature exists for.

    With the callback looked up in a map, a press on a zone whose entry was missing opened
    nothing while still counting as handled — the bug presented as "the press handler ran,
    but no field ever appeared", which cost four releases. The callback is now passed in,
    so the ordinary path cannot fail this way even with an empty map.
  */
  it('opens the box it was given, even for a zone the map never saw', () => {
    const { result } = renderHook(() => useTextEditGesture())
    const button = document.createElement('button')
    button.setAttribute('aria-label', 'Card text: Kung Pao')
    document.body.append(button)

    const begin = vi.fn()
    result.current.press(
      {
        button: 0,
        timeStamp: 300,
        currentTarget: button,
        stopPropagation: () => undefined,
        preventDefault: () => undefined,
      } as unknown as React.PointerEvent<HTMLElement>,
      begin,
    )

    expect(begin).toHaveBeenCalledTimes(1)
  })

  it('installs one listener per sheet, not one per box', () => {
    const installer = vi.spyOn(document, 'addEventListener')
    renderHook(() => useTextEditGesture())
    const pointerdown = installer.mock.calls.filter(([type]) => type === 'pointerdown')
    expect(pointerdown).toHaveLength(1)
    expect(pointerdown[0]?.[2]).toBe(true) // capture phase: it must see the press first
    installer.mockRestore()
  })
})

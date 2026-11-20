import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CardZoneText } from '../features/workspace/CardZoneText'

/**
 * Clicking into a text box must not move the page.
 *
 * `focus()` scrolls the nearest scrollable ancestor to reveal the element unless told
 * otherwise. In a canvas that is taller than its viewport — which this one always is,
 * since it is width-fitted and 297mm tall — that means clicking a card near the bottom
 * dragged the stack up to centre it, and the paper moved out from under the pointer.
 *
 * jsdom does not scroll, so this asserts the contract instead: the focus call is made
 * with `preventScroll`. It is the one thing that decides whether a real browser moves.
 */

const style = {
  bold: false,
  italic: false,
  underline: false,
  color: '#111111',
  highlight: null,
  align: 'left',
} as const

describe('a text zone entering edit mode', () => {
  it('focuses the field without scrolling the canvas to it', () => {
    const focus = vi.spyOn(HTMLTextAreaElement.prototype, 'focus')

    render(
      <CardZoneText
        text="CHK-01 Kung Pao"
        scale={2}
        xMm={0}
        yMm={0}
        widthMm={60}
        heightMm={8}
        style={style as never}
        runs={[]}
        editing
        onSelectionChange={() => undefined}
        maxPt={9}
        textScale={1}
        placeholder="Dish code"
        onBeginEdit={() => undefined}
        onChange={() => undefined}
        onEndEdit={() => undefined}
        onStyle={() => undefined}
      />,
    )

    expect(focus).toHaveBeenCalled()
    const options = focus.mock.calls[0]?.[0]
    expect(options).toEqual({ preventScroll: true })
    focus.mockRestore()
  })
})

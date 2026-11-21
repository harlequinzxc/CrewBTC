import { act, render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useSheetZoom } from '../../features/workspace/sheet/use-sheet-zoom'
import { fitWidthScale } from '../../lib/zoom'

/**
 * Fit has to happen, and it has to happen to the pane as it is *now*.
 *
 * The sheet pane does not exist on the first render — it appears when a batch arrives and
 * disappears again when the batch is cleared. A measurer that looked at the element once,
 * on mount, therefore never saw anything, and the sheet came up at 100%: a postage stamp
 * in the middle of a 1440p screen. These tests pin the two ways that went wrong.
 */

// jsdom has no layout, so every element measures 0×0. The pane is given a real size by
// hand, which is the only way to exercise the arithmetic without a browser.
const sized = (node: HTMLElement | null, width: number, height: number): void => {
  if (node === null) return
  Object.defineProperty(node, 'clientWidth', { configurable: true, value: width })
  Object.defineProperty(node, 'clientHeight', { configurable: true, value: height })
}

function Probe(props: { readonly show: boolean; readonly w: number; readonly h: number }) {
  const zoom = useSheetZoom(210)
  return (
    <div>
      <span data-testid="scale">{zoom.scale.toFixed(4)}</span>
      <span data-testid="fitting">{String(zoom.fitting)}</span>
      <button type="button" aria-label="step in" onClick={() => zoom.step(1)} />
      <button type="button" aria-label="pin 2" onClick={() => zoom.setScale(2)} />
      <button type="button" aria-label="fit" onClick={() => zoom.fit()} />
      {props.show ? (
        <div
          ref={(node) => {
            sized(node, props.w, props.h)
            zoom.paneRef(node)
          }}
        >
          pane
        </div>
      ) : null}
    </div>
  )
}

describe('sheet zoom', () => {
  it('starts in Fit mode, before anything is measured', () => {
    const { getByTestId } = render(<Probe show={false} w={0} h={0} />)
    expect(getByTestId('fitting').textContent).toBe('true')
  })

  it('fits once the pane appears, rather than staying at 100%', () => {
    // No ResizeObserver in jsdom, so the measurer reads the node it is handed.
    const { rerender, getByTestId } = render(<Probe show={false} w={0} h={0} />)
    expect(getByTestId('scale').textContent).toBe('1.0000')

    rerender(<Probe show w={600} h={800} />)
    // Width only: the height of the pane must not shrink the sheet.
    const expected = fitWidthScale(600 - 64, 210)
    expect(getByTestId('scale').textContent).toBe(expected.toFixed(4))
    expect(expected).toBeGreaterThan(1)

    // A shorter pane fits the same width: it scrolls rather than shrinking.
    rerender(<Probe show w={600} h={300} />)
    expect(getByTestId('scale').textContent).toBe(expected.toFixed(4))
  })

  it('re-fits when the window resizes, because Fit is a mode', () => {
    const { rerender, getByTestId } = render(<Probe show w={600} h={800} />)
    const small = getByTestId('scale').textContent

    rerender(<Probe show w={900} h={1100} />)
    expect(getByTestId('scale').textContent).not.toBe(small)
    expect(getByTestId('fitting').textContent).toBe('true')
  })

  it('clears Fit the instant a scale is pinned by any route', () => {
    const { getByTestId, getByRole } = render(<Probe show w={600} h={800} />)
    expect(getByTestId('fitting').textContent).toBe('true')

    // A pinned scale — what a wheel gesture or a direct set produces — is not a fit,
    // even if it happens to equal the fitted value. The pressed state must follow the
    // mode, not the number.
    act(() => getByRole('button', { name: 'pin 2' }).click())
    expect(getByTestId('fitting').textContent).toBe('false')
  })

  it('lets a manual step win, and re-fitting restores the mode', () => {
    const { getByTestId, getByRole } = render(<Probe show w={600} h={800} />)
    const fitted = getByTestId('scale').textContent
    expect(getByTestId('fitting').textContent).toBe('true')

    act(() => getByRole('button', { name: 'step in' }).click())
    // Stepping leaves Fit: the value is now the user's, not the pane's.
    expect(getByTestId('fitting').textContent).toBe('false')
    expect(getByTestId('scale').textContent).not.toBe(fitted)

    act(() => getByRole('button', { name: 'fit' }).click())
    expect(getByTestId('fitting').textContent).toBe('true')
    expect(getByTestId('scale').textContent).toBe(fitted)
  })
})

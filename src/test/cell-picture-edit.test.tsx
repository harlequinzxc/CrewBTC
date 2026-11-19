import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CellPicture } from '../features/workspace/CellPicture'
import { DEFAULT_IMAGE_TRANSFORM } from '../types/edit'
import type { ImageTransform, PhotoSource } from '../types/edit'

/**
 * Move/zoom mode: how it is entered, what the gestures do, and how it is left.
 *
 * The framing has to survive per cell, so every gesture here is checked as a value
 * passed back to the parent rather than as local state.
 */

const BOX = { xMm: 4, yMm: 17, widthMm: 64, heightMm: 57 }
const SCALE = 4

const LANDSCAPE: PhotoSource = { dataUrl: 'data:image/png;base64,PIC', widthPx: 400, heightPx: 300 }

describe('move/zoom mode', () => {
  const noop = (): void => undefined

  const base = {
    box: BOX,
    scale: SCALE,
    editing: false,
    onBeginEdit: vi.fn(),
    onEndEdit: vi.fn(),
    onChange: vi.fn(),
  }

  beforeEach(() => {
    base.onBeginEdit.mockClear()
    base.onEndEdit.mockClear()
    base.onChange.mockClear()
  })

  it('enters editing on double-click', () => {
    render(<CellPicture {...base} photo={LANDSCAPE} transform={DEFAULT_IMAGE_TRANSFORM} />)
    fireEvent.doubleClick(screen.getByRole('button', { name: /Dish photo/ }))

    expect(base.onBeginEdit).toHaveBeenCalledTimes(1)
  })

  it('shows a clear border while active, and none when idle', () => {
    const { container, rerender } = render(
      <CellPicture {...base} photo={LANDSCAPE} transform={DEFAULT_IMAGE_TRANSFORM} />,
    )
    expect(container.querySelector('[data-picture="idle"]')).not.toBeNull()

    rerender(<CellPicture {...base} editing photo={LANDSCAPE} transform={DEFAULT_IMAGE_TRANSFORM} />)
    const active = container.querySelector('[data-picture="editing"]')
    expect(active).not.toBeNull()
    expect(active?.className).toContain('ring')
  })

  it('pans when dragged', () => {
    render(<CellPicture {...base} editing photo={LANDSCAPE} transform={DEFAULT_IMAGE_TRANSFORM} />)
    const root = screen.getByRole('button', { name: /Dish photo/ })

    fireEvent.pointerDown(root, { clientX: 100, clientY: 100, pointerId: 1 })
    fireEvent.pointerMove(root, { clientX: 140, clientY: 120, pointerId: 1 })

    expect(base.onChange).toHaveBeenCalled()
    const next = base.onChange.mock.calls.at(-1)?.[0] as ImageTransform
    // 40 px right at 4 px/mm is 10 mm; 20 px down is 5 mm.
    expect(next.offsetXMm).toBeCloseTo(10, 3)
    expect(next.offsetYMm).toBeCloseTo(5, 3)
  })

  it('does not pan when idle', () => {
    render(<CellPicture {...base} photo={LANDSCAPE} transform={DEFAULT_IMAGE_TRANSFORM} />)
    const root = screen.getByRole('button', { name: /Dish photo/ })

    fireEvent.pointerDown(root, { clientX: 100, clientY: 100, pointerId: 1 })
    fireEvent.pointerMove(root, { clientX: 140, clientY: 120, pointerId: 1 })

    expect(base.onChange).not.toHaveBeenCalled()
  })

  it('zooms on the wheel while active', () => {
    render(<CellPicture {...base} editing photo={LANDSCAPE} transform={DEFAULT_IMAGE_TRANSFORM} />)
    fireEvent.wheel(screen.getByRole('button', { name: /Dish photo/ }), { deltaY: -100 })

    const next = base.onChange.mock.calls.at(-1)?.[0] as ImageTransform
    expect(next.scale).toBeGreaterThan(1)
  })

  it('leaves on Escape', () => {
    render(<CellPicture {...base} editing photo={LANDSCAPE} transform={DEFAULT_IMAGE_TRANSFORM} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(base.onEndEdit).toHaveBeenCalled()
  })

  it('leaves on Enter', () => {
    render(<CellPicture {...base} editing photo={LANDSCAPE} transform={DEFAULT_IMAGE_TRANSFORM} />)
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(base.onEndEdit).toHaveBeenCalled()
  })

  it('leaves when something outside is pressed', () => {
    render(
      <div>
        <CellPicture {...base} editing photo={LANDSCAPE} transform={DEFAULT_IMAGE_TRANSFORM} />
        <button type="button">outside</button>
      </div>,
    )
    fireEvent.pointerDown(screen.getByText('outside'))
    expect(base.onEndEdit).toHaveBeenCalled()
  })

  it('offers a zoom slider and a reset while active', () => {
    render(<CellPicture {...base} editing photo={LANDSCAPE} transform={DEFAULT_IMAGE_TRANSFORM} />)
    expect(screen.getByLabelText('Photo zoom')).toBeInTheDocument()
    expect(screen.getByLabelText('Reset photo framing')).toBeInTheDocument()
  })

  it('resets framing to centred at 1x', () => {
    render(
      <CellPicture
        {...base}
        editing
        photo={LANDSCAPE}
        transform={{ offsetXMm: 8, offsetYMm: -4, scale: 2 }}
      />,
    )
    fireEvent.click(screen.getByLabelText('Reset photo framing'))
    expect(base.onChange).toHaveBeenLastCalledWith({ offsetXMm: 0, offsetYMm: 0, scale: 1 })
  })

  it('says so plainly when the page had no photo', () => {
    render(<CellPicture {...base} photo={undefined} transform={DEFAULT_IMAGE_TRANSFORM} />)
    expect(screen.getByText('No image on this page')).toBeInTheDocument()
    // No photo means no interactive box to double-click into.
    expect(screen.queryByRole('button', { name: /Dish photo/ })).not.toBeInTheDocument()
    expect(base.onBeginEdit).not.toHaveBeenCalled()
  })

  it('leaves on Escape even when idle is harmless', () => {
    render(<CellPicture {...base} photo={LANDSCAPE} transform={DEFAULT_IMAGE_TRANSFORM} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(base.onEndEdit).not.toHaveBeenCalled()
  })

  void noop
})

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Card } from '../features/workspace/Card'
import { blankCard } from '../features/workspace/use-cards'
import type { Card as CardModel, RectMm } from '../types/card'

/**
 * The picture controls: double-click to adjust, then drag to pan and wheel to zoom.
 *
 * There is deliberately no floating slider or button bar over the photo — the wheel and
 * the drag are the controls. Every gesture is asserted as the transform handed back to the
 * parent, because that value is what gets stored and what the exporter draws.
 */

const CELL: RectMm = { xMm: 4, yMm: 17, widthMm: 52, heightMm: 67 }
const photo = { dataUrl: 'data:image/png;base64,PIC', widthPx: 400, heightPx: 300 }

function model(overrides: Partial<CardModel> = {}): CardModel {
  return { ...blankCard(67), ...overrides }
}

function props(card: CardModel) {
  return {
    card,
    cell: CELL,
    scale: 4,
    cellIndex: 0,
    pageLabel: 'cards.pdf#1',
    selected: false,
    editing: null as null | 'header' | 'picture' | 'body',
    pictureEditing: false,
    onSelect: vi.fn(),
    onBeginTextEdit: vi.fn(),
    onEndEdit: vi.fn(),
    onTextChange: vi.fn(),
    onStyleChange: vi.fn(),
    onBeginPictureEdit: vi.fn(),
    onEndPictureEdit: vi.fn(),
    onImageChange: vi.fn(),
    onSelectionChange: vi.fn(),
  }
}

const photoButton = (): HTMLElement => screen.getByRole('button', { name: /Dish photo/ })

describe('entering and leaving adjust mode', () => {
  it('enters on double-click', () => {
    const p = props(model({ photo }))
    render(<Card {...p} />)
    fireEvent.doubleClick(photoButton())
    expect(p.onBeginPictureEdit).toHaveBeenCalled()
  })

  it('leaves on double-click when already adjusting', () => {
    const p = props(model({ photo }))
    p.pictureEditing = true
    render(<Card {...p} />)
    fireEvent.doubleClick(photoButton())
    expect(p.onEndPictureEdit).toHaveBeenCalled()
    expect(p.onBeginPictureEdit).not.toHaveBeenCalled()
  })

  it('shows the frame as active only while adjusting', () => {
    const idle = props(model({ photo }))
    const { rerender } = render(<Card {...idle} />)
    expect(photoButton().dataset.adjusting).toBe('false')

    rerender(<Card {...idle} pictureEditing />)
    expect(photoButton().dataset.adjusting).toBe('true')
  })

  it('offers no floating slider, buttons or reset bar', () => {
    const p = props(model({ photo }))
    p.pictureEditing = true
    render(<Card {...p} />)

    expect(screen.queryByLabelText('Photo zoom')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Zoom in' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Zoom out' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Reset photo framing' })).toBeNull()
  })
})

describe('framing the photo', () => {
  it('pans by the distance dragged', () => {
    const p = props(model({ photo }))
    p.pictureEditing = true
    render(<Card {...p} />)
    const button = photoButton()

    fireEvent.pointerDown(button, { clientX: 100, clientY: 100, pointerId: 1 })
    fireEvent.pointerMove(button, { clientX: 120, clientY: 90, pointerId: 1 })

    // 20 px right and 10 px up at 4 px/mm is +5 mm and −2.5 mm.
    const sent = p.onImageChange.mock.calls.at(-1)?.[0] as { offsetXMm: number; offsetYMm: number }
    expect(sent.offsetXMm).toBeCloseTo(5, 5)
    expect(sent.offsetYMm).toBeCloseTo(-2.5, 5)
  })

  it('does not pan when not adjusting', () => {
    const p = props(model({ photo }))
    render(<Card {...p} />)
    const button = photoButton()

    fireEvent.pointerDown(button, { clientX: 10, clientY: 10, pointerId: 1 })
    fireEvent.pointerMove(button, { clientX: 90, clientY: 90, pointerId: 1 })
    expect(p.onImageChange).not.toHaveBeenCalled()
  })

  it('nudges with the arrow keys while adjusting', () => {
    const p = props(model({ photo }))
    p.pictureEditing = true
    render(<Card {...p} />)
    fireEvent.keyDown(photoButton(), { key: 'ArrowRight' })
    const sent = p.onImageChange.mock.calls.at(-1)?.[0] as { offsetXMm: number }
    expect(sent.offsetXMm).toBeGreaterThan(0)
  })

  it('keeps the framing when leaving', () => {
    const p = props(model({ photo }))
    p.pictureEditing = true
    render(<Card {...p} />)
    fireEvent.keyDown(photoButton(), { key: 'Escape' })
    expect(p.onEndPictureEdit).toHaveBeenCalled()
    // Leaving is not a discard: nothing hands the transform back to its original values.
    for (const call of p.onImageChange.mock.calls) {
      expect(call[0]).not.toEqual({ offsetXMm: 0, offsetYMm: 0, scale: 1 })
    }
  })
})

describe('zooming with the wheel', () => {
  it('zooms in on wheel up, without a floating control', () => {
    const p = props(model({ photo }))
    p.pictureEditing = true
    render(<Card {...p} />)

    // The listener is non-passive and attached to the frame itself, so a native event
    // is what exercises it — this is the path that also stops the sheet from scrolling.
    fireEvent.wheel(photoButton().parentElement as HTMLElement, { deltaY: -100 })

    const sent = p.onImageChange.mock.calls.at(-1)?.[0] as { scale: number }
    expect(sent.scale).toBeGreaterThan(1)
  })

  it('zooms out on wheel down', () => {
    const p = props(model({ photo }))
    p.pictureEditing = true
    render(<Card {...p} />)
    fireEvent.wheel(photoButton().parentElement as HTMLElement, { deltaY: 100 })
    const sent = p.onImageChange.mock.calls.at(-1)?.[0] as { scale: number }
    expect(sent.scale).toBeLessThan(1)
  })

  it('ignores the wheel when not adjusting, leaving the sheet free to scroll', () => {
    const p = props(model({ photo }))
    render(<Card {...p} />)
    fireEvent.wheel(photoButton().parentElement as HTMLElement, { deltaY: -100 })
    expect(p.onImageChange).not.toHaveBeenCalled()
  })

  it('never lets the scale escape its bounds', () => {
    const p = props(model({ photo }))
    p.pictureEditing = true
    p.card = { ...p.card, imageTransform: { offsetXMm: 0, offsetYMm: 0, scale: 4 } }
    render(<Card {...p} />)
    fireEvent.wheel(photoButton().parentElement as HTMLElement, { deltaY: -100 })
    const sent = p.onImageChange.mock.calls.at(-1)?.[0] as { scale: number }
    expect(sent.scale).toBeLessThanOrEqual(4)
  })
})

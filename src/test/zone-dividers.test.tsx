import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Card } from '../features/workspace/Card'
import { BandPanel } from '../features/workspace/BandPanel'
import { BAND_MIN_MM, PICTURE_MIN_MM } from '../types/card'
import { blankCard } from '../features/workspace/use-cards'
import type { Card as CardModel, RectMm } from '../types/card'

/**
 * Dragging the boundaries between header, picture and footer.
 *
 * The dividers are a pointer affordance on the card, but they must go through exactly the
 * same clamping as the sliders in the band panel — otherwise the two controls would
 * disagree about what the minimum picture height is, and a card could be dragged into two
 * text boxes with nothing between them.
 */

const CELL: RectMm = { xMm: 4, yMm: 17, widthMm: 52, heightMm: 67 }
const SCALE = 4

function model(overrides: Partial<CardModel> = {}): CardModel {
  return { ...blankCard(67), ...overrides }
}

function cardProps(card: CardModel, onBandsChange = vi.fn()) {
  return {
    card,
    cell: CELL,
    scale: SCALE,
    cellIndex: 0,
    pageLabel: 'cards.pdf#1',
    selected: true,
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
    onBandsChange,
  }
}

const divider = (which: 'header' | 'footer'): HTMLElement =>
  document.querySelector(`[data-divider="${which}"]`) as HTMLElement

describe('zone dividers', () => {
  it('appears on the selected card only', () => {
    const p = cardProps(model())
    const { rerender } = render(<Card {...p} selected={false} />)
    expect(document.querySelector('[data-divider]')).toBeNull()

    rerender(<Card {...p} selected />)
    expect(divider('header')).not.toBeNull()
    expect(divider('footer')).not.toBeNull()
  })

  it('grows the header when the top divider is dragged down', () => {
    const onBandsChange = vi.fn()
    render(<Card {...cardProps(model(), onBandsChange)} />)

    const handle = divider('header')
    fireEvent.pointerDown(handle, { clientY: 100, pointerId: 1 })
    fireEvent.pointerMove(handle, { clientY: 120, pointerId: 1 })

    // 20 px at 4 px/mm is +5 mm of header.
    const sent = onBandsChange.mock.calls.at(-1)?.[0] as { headerMm: number; footerMm: number }
    expect(sent.headerMm).toBeCloseTo(model().bands.headerMm + 5, 5)
    expect(sent.footerMm).toBeCloseTo(model().bands.footerMm, 5)
  })

  it('grows the footer when the bottom divider is dragged up', () => {
    const onBandsChange = vi.fn()
    render(<Card {...cardProps(model(), onBandsChange)} />)

    const handle = divider('footer')
    fireEvent.pointerDown(handle, { clientY: 200, pointerId: 1 })
    fireEvent.pointerMove(handle, { clientY: 180, pointerId: 1 })

    const sent = onBandsChange.mock.calls.at(-1)?.[0] as { headerMm: number; footerMm: number }
    expect(sent.footerMm).toBeCloseTo(model().bands.footerMm + 5, 5)
    expect(sent.headerMm).toBeCloseTo(model().bands.headerMm, 5)
  })

  it('stops at the minimum that still leaves a picture', () => {
    const onBandsChange = vi.fn()
    render(<Card {...cardProps(model(), onBandsChange)} />)

    const handle = divider('header')
    fireEvent.pointerDown(handle, { clientY: 100, pointerId: 1 })
    // Drag far past the bottom of the card.
    fireEvent.pointerMove(handle, { clientY: 2000, pointerId: 1 })

    const sent = onBandsChange.mock.calls.at(-1)?.[0] as { headerMm: number; footerMm: number }
    expect(sent.headerMm).toBeGreaterThanOrEqual(BAND_MIN_MM)
    expect(CELL.heightMm - sent.headerMm - sent.footerMm).toBeGreaterThanOrEqual(PICTURE_MIN_MM - 1e-6)
  })

  it('does not change anything until it is dragged', () => {
    const onBandsChange = vi.fn()
    render(<Card {...cardProps(model(), onBandsChange)} />)
    expect(onBandsChange).not.toHaveBeenCalled()
  })

  it('sits at the real boundaries of the zones', () => {
    const card = model()
    render(<Card {...cardProps(card)} />)
    // The header divider's centre is at the header's height.
    const top = Number.parseFloat(divider('header').style.top)
    const expected = card.bands.headerMm * SCALE
    expect(Math.abs(top - (expected - 3.5))).toBeLessThan(4)
  })
})

describe('the band panel still drives the same values', () => {
  it('offers a text scale slider with the card’s value', () => {
    const onChange = vi.fn()
    render(
      <BandPanel
        card={{ ...model(), textScale: 1.2 }}
        cellIndex={0}
        cellHeightMm={67}
        onChange={onChange}
        onTextScaleChange={vi.fn()}
      />,
    )
    const slider = screen.getByLabelText('Text scale') as HTMLInputElement
    expect(Number(slider.value)).toBeCloseTo(1.2, 5)
  })

  it('reports a text-scale change', () => {
    const onTextScaleChange = vi.fn()
    render(
      <BandPanel
        card={model()}
        cellIndex={0}
        cellHeightMm={67}
        onChange={vi.fn()}
        onTextScaleChange={onTextScaleChange}
      />,
    )
    fireEvent.change(screen.getByLabelText('Text scale'), { target: { value: '1.5' } })
    expect(onTextScaleChange).toHaveBeenCalledWith(1.5)
  })

  it('still reports the band sliders', () => {
    const onChange = vi.fn()
    render(
      <BandPanel
        card={model()}
        cellIndex={0}
        cellHeightMm={67}
        onChange={onChange}
        onTextScaleChange={vi.fn()}
      />,
    )
    fireEvent.change(screen.getByLabelText('Header height'), { target: { value: '20' } })
    expect(onChange).toHaveBeenCalled()
    const sent = onChange.mock.calls.at(-1)?.[0] as { headerMm: number }
    expect(sent.headerMm).toBeCloseTo(20, 5)
  })
})

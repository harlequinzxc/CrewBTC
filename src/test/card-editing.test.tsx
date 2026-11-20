import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Card } from '../features/workspace/Card'
import { CardTextBar } from '../features/workspace/CardTextBar'
import { blankCard } from '../features/workspace/use-cards'
import { DEFAULT_IMAGE_TRANSFORM, DEFAULT_TEXT_STYLE } from '../types/card'
import type { Card as CardModel, RectMm } from '../types/card'

/**
 * Editing a card in place: typing in its two text boxes, styling them, tuning the band
 * heights, and moving the photo. Every gesture is checked as a value handed back to the
 * parent, because that value is what gets stored and what gets printed.
 */

const CELL: RectMm = { xMm: 4, yMm: 17, widthMm: 64, heightMm: 90 }
const SCALE = 4

function model(overrides: Partial<CardModel> = {}): CardModel {
  return { ...blankCard(90), ...overrides }
}

function props(card: CardModel) {
  return {
    card,
    cell: CELL,
    scale: SCALE,
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
    onBandsChange: vi.fn(),
  }
}

describe('typing into a card', () => {
  it('opens the header box when the top text is clicked', () => {
    const p = props(model({ headerText: 'CHK-01' }))
    render(<Card {...p} />)

    fireEvent.click(screen.getByRole('button', { name: /CHK-01/ }))
    expect(p.onBeginTextEdit).toHaveBeenCalledWith('header')
  })

  it('opens the body box when the instructions are clicked', () => {
    const p = props(model({ bodyText: '• Plate with rice' }))
    render(<Card {...p} />)

    fireEvent.click(screen.getByRole('button', { name: /Plate with rice/ }))
    expect(p.onBeginTextEdit).toHaveBeenCalledWith('body')
  })

  it('reports each keystroke with the box it belongs to', () => {
    const p = props(model({ headerText: 'CHK-01' }))
    p.editing = 'header'
    render(<Card {...p} />)

    fireEvent.change(screen.getByLabelText('Edit card text'), {
      target: { value: 'CHK-02' },
    })
    expect(p.onTextChange).toHaveBeenCalledWith('header', 'CHK-02')
  })

  it('shows a placeholder rather than an empty box', () => {
    render(<Card {...props(model())} />)
    expect(screen.getByRole('button', { name: /Dish code/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Plating steps/ })).toBeInTheDocument()
  })

  it('closes the box on blur', () => {
    const p = props(model({ headerText: 'X' }))
    p.editing = 'header'
    render(<Card {...p} />)

    fireEvent.blur(screen.getByLabelText('Edit card text'))
    expect(p.onEndEdit).toHaveBeenCalled()
  })
})

describe('formatting a text box', () => {
  const base = { zone: 'body' as const, style: DEFAULT_TEXT_STYLE, onChange: vi.fn() }

  beforeEach(() => base.onChange.mockClear())

  it('toggles bold', () => {
    render(<CardTextBar {...base} />)
    fireEvent.click(screen.getByRole('button', { name: 'Bold' }))
    expect(base.onChange).toHaveBeenCalledWith({ ...DEFAULT_TEXT_STYLE, bold: true })
  })

  it('sets the ink colour', () => {
    render(<CardTextBar {...base} />)
    fireEvent.click(screen.getByRole('button', { name: 'Text colour #b91c1c' }))
    expect(base.onChange).toHaveBeenCalledWith({ ...DEFAULT_TEXT_STYLE, color: '#b91c1c' })
  })

  it('sets a highlight and can clear it again', () => {
    render(<CardTextBar {...base} />)
    fireEvent.click(screen.getByRole('button', { name: 'Highlight #bbf7d0' }))
    expect(base.onChange).toHaveBeenCalledWith({ ...DEFAULT_TEXT_STYLE, highlight: '#bbf7d0' })

    render(<CardTextBar {...base} style={{ ...DEFAULT_TEXT_STYLE, highlight: '#bbf7d0' }} />)
    fireEvent.click(screen.getAllByRole('button', { name: 'No highlight' })[0]!)
    expect(base.onChange).toHaveBeenLastCalledWith({ ...DEFAULT_TEXT_STYLE, highlight: null })
  })

  it('says which box it will change', () => {
    render(<CardTextBar {...base} />)
    expect(screen.getByText('bottom text')).toBeInTheDocument()
  })
})

describe('tuning the three zones of one card', () => {
  it('offers sliders only for the selected card', () => {
    const unselected = props(model())
    const { rerender } = render(<Card {...unselected} />)
    expect(screen.queryByLabelText('Header height')).not.toBeInTheDocument()

    const selected = { ...props(model()), selected: true }
    rerender(<Card {...selected} />)
    expect(screen.getByLabelText('Header height')).toBeInTheDocument()
    expect(screen.getByLabelText('Footer height')).toBeInTheDocument()
  })

  it('changes only the card it belongs to', () => {
    const p = { ...props(model({ bands: { headerMm: 13, footerMm: 20 } })), selected: true }
    render(<Card {...p} />)

    fireEvent.change(screen.getByLabelText('Header height'), { target: { value: '18' } })
    expect(p.onBandsChange).toHaveBeenCalledWith({ headerMm: 18, footerMm: 20 })
  })

  it('does not start a drag on the sheet when a slider is used', () => {
    const p = { ...props(model()), selected: true }
    render(<Card {...p} />)

    fireEvent.pointerDown(screen.getByLabelText('Header height'))
    expect(p.onSelect).not.toHaveBeenCalled()
  })
})

describe('moving the photo', () => {
  const photo = { dataUrl: 'data:image/png;base64,PIC', widthPx: 400, heightPx: 300 }

  it('enters adjust mode on double-click', () => {
    const p = props(model({ photo }))
    render(<Card {...p} />)

    fireEvent.doubleClick(screen.getByRole('button', { name: /Dish photo/ }))
    expect(p.onBeginPictureEdit).toHaveBeenCalled()
  })

  it('marks the picture box while adjusting', () => {
    const p = { ...props(model({ photo })), pictureEditing: true }
    const { container } = render(<Card {...p} />)
    const box = container.querySelector('[data-image="adjusting"]')
    expect(box).not.toBeNull()
    expect(box?.className).toContain('outline')
  })

  it('pans by the distance dragged, in sheet millimetres', () => {
    const p = { ...props(model({ photo })), pictureEditing: true }
    render(<Card {...p} />)
    const target = screen.getByRole('button', { name: /Dish photo/ })

    fireEvent.pointerDown(target, { clientX: 100, clientY: 100, pointerId: 1 })
    fireEvent.pointerMove(target, { clientX: 140, clientY: 120, pointerId: 1 })

    const next = p.onImageChange.mock.calls.at(-1)?.[0] as typeof DEFAULT_IMAGE_TRANSFORM
    // 40 px at 4 px/mm is 10 mm; 20 px is 5 mm.
    expect(next.offsetXMm).toBeCloseTo(10, 3)
    expect(next.offsetYMm).toBeCloseTo(5, 3)
  })

  it('zooms on the wheel only while adjusting', () => {
    const idle = props(model({ photo }))
    const { unmount } = render(<Card {...idle} />)
    fireEvent.wheel(screen.getByRole('button', { name: /Dish photo/ }), { deltaY: -100 })
    expect(idle.onImageChange).not.toHaveBeenCalled()
    unmount()

    const active = { ...props(model({ photo })), pictureEditing: true }
    render(<Card {...active} />)
    fireEvent.wheel(screen.getByRole('button', { name: /Dish photo/ }), { deltaY: -100 })
    const next = active.onImageChange.mock.calls.at(-1)?.[0] as typeof DEFAULT_IMAGE_TRANSFORM
    expect(next.scale).toBeGreaterThan(1)
  })

  it('never stretches the photo, whatever the box', () => {
    const p = props(model({ photo }))
    const { container } = render(<Card {...p} />)
    const img = container.querySelector('[data-image] img')

    const width = Number.parseFloat(img?.getAttribute('style')?.match(/width: ([\d.]+)px/)?.[1] ?? '0')
    const height = Number.parseFloat(img?.getAttribute('style')?.match(/height: ([\d.]+)px/)?.[1] ?? '0')
    expect(width / height).toBeCloseTo(4 / 3, 3)
  })

  it('says so plainly when there is no photo', () => {
    render(<Card {...props(model())} />)
    expect(screen.getByText('No photo on this page')).toBeInTheDocument()
  })
})

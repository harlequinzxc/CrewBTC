import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Card } from '../features/workspace/Card'
import { blankCard } from '../features/workspace/use-cards'
import type { Card as CardModel, RectMm } from '../types/card'

/**
 * The picture controls: double-click to adjust, then drag, wheel or the +/−/Reset buttons.
 *
 * Every gesture is asserted as the transform handed back to the parent, because that value
 * is what gets stored and what the exporter draws.
 */

const CELL: RectMm = { xMm: 4, yMm: 17, widthMm: 64, heightMm: 90 }

function model(overrides: Partial<CardModel> = {}): CardModel {
  return { ...blankCard(90), ...overrides }
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

describe('picture zoom controls', () => {
  const photo = { dataUrl: 'data:image/png;base64,PIC', widthPx: 400, heightPx: 300 }

  it('offers zoom in, zoom out and reset while adjusting', () => {
    const p = props(model({ photo }))
    p.pictureEditing = true
    render(<Card {...p} />)
    expect(screen.getByRole('button', { name: 'Zoom in' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Zoom out' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reset photo framing' })).toBeInTheDocument()
  })

  it('raises the scale when + is pressed', () => {
    const p = props(model({ photo }))
    p.pictureEditing = true
    render(<Card {...p} />)
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
    const sent = p.onImageChange.mock.calls.at(-1)?.[0] as { scale: number }
    expect(sent.scale).toBeGreaterThan(1)
  })

  it('lowers the scale when − is pressed', () => {
    const p = props(model({ photo }))
    p.pictureEditing = true
    render(<Card {...p} />)
    fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }))
    const sent = p.onImageChange.mock.calls.at(-1)?.[0] as { scale: number }
    expect(sent.scale).toBeLessThan(1)
  })

  it('returns to the centred fit on reset', () => {
    const p = props(model({ photo }))
    p.pictureEditing = true
    p.card = { ...p.card, imageTransform: { offsetXMm: 5, offsetYMm: -3, scale: 2.5 } }
    render(<Card {...p} />)
    fireEvent.click(screen.getByRole('button', { name: 'Reset photo framing' }))
    expect(p.onImageChange).toHaveBeenLastCalledWith({ offsetXMm: 0, offsetYMm: 0, scale: 1 })
  })

  it('never lets the scale escape its bounds', () => {
    const p = props(model({ photo }))
    p.pictureEditing = true
    p.card = { ...p.card, imageTransform: { offsetXMm: 0, offsetYMm: 0, scale: 4 } }
    render(<Card {...p} />)
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
    const sent = p.onImageChange.mock.calls.at(-1)?.[0] as { scale: number }
    expect(sent.scale).toBeLessThanOrEqual(4)
  })
})

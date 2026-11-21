import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CardTextBar } from '../../features/workspace/cards/CardTextBar'
import { DEFAULT_TEXT_STYLE } from '../../types/card'

/**
 * The formatting bar, on its own.
 *
 * Split from `card-editing.test.tsx` when that file reached its line budget, which is a
 * fair boundary anyway: these tests are about a control panel, and the rest of that file is
 * about a card being typed into and dragged.
 */

describe('formatting a text box', () => {
  const base = {
    zone: 'body' as const,
    style: DEFAULT_TEXT_STYLE,
    active: DEFAULT_TEXT_STYLE,
    selection: null,
    onChange: vi.fn(),
    onColor: vi.fn(),
  }

  beforeEach(() => { base.onChange.mockClear(); base.onColor.mockClear() })

  it('toggles bold for the whole box when nothing is selected', () => {
    // The box starts bold, so the toggle switches it *off* — asserting the toggle in the
    // direction it actually moves is what makes this a test of the control, not of the
    // default. `cleared` below pins the default separately.
    render(<CardTextBar {...base} />)
    fireEvent.click(screen.getByRole('button', { name: 'Bold' }))
    expect(base.onChange).toHaveBeenCalledWith({ ...DEFAULT_TEXT_STYLE, bold: false })
  })

  it('tags CROCKERIES in one click: red fill, white ink, capitals', () => {
    render(<CardTextBar {...base} />)
    fireEvent.click(screen.getByRole('button', { name: 'CROCKERIES callout' }))
    expect(base.onChange).toHaveBeenCalledWith({
      bold: true,
      color: '#ffffff',
      highlight: '#b91c1c',
      uppercase: true,
    })
  })

  it('puts DIRECTIONS between the presets and colours the active text red', () => {
    render(<CardTextBar {...base} />)
    const labels = screen.getAllByRole('button').map((button) => button.getAttribute('aria-label'))
    expect(labels.slice(0, 3)).toEqual(['CROCKERIES callout', 'DIRECTIONS', 'CONDIMENTS callout'])
    fireEvent.click(screen.getByRole('button', { name: 'DIRECTIONS' }))
    expect(base.onColor).toHaveBeenCalledWith('#b91c1c')
  })

  it('colours a selection without discarding its active style', () => {
    const active = { bold: false, color: '#111827', highlight: '#86efac', align: 'center' as const }
    render(<CardTextBar {...base} selection={{ start: 1, end: 4 }} active={active} />)
    fireEvent.click(screen.getByRole('button', { name: 'DIRECTIONS' }))
    expect(base.onColor).toHaveBeenCalledWith('#b91c1c')
  })

  it('tags CONDIMENTS in one click: green fill, black ink, no capitals', () => {
    render(<CardTextBar {...base} />)
    fireEvent.click(screen.getByRole('button', { name: 'CONDIMENTS callout' }))
    // `uppercase: false` is written out rather than omitted: it has to *clear* a
    // CROCKERIES tag, and "no opinion" would inherit the red tag's capitals.
    expect(base.onChange).toHaveBeenCalledWith({
      bold: true,
      color: '#111827',
      highlight: '#86efac',
      uppercase: false,
    })
  })

  it('clears an active preset when it is clicked again', () => {
    render(
      <CardTextBar
        {...base}
        active={{ bold: true, color: '#ffffff', highlight: '#b91c1c', uppercase: true }}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'CROCKERIES callout' }))
    expect(base.onChange).toHaveBeenCalledWith({ ...DEFAULT_TEXT_STYLE, highlight: null })
  })

  it('only one preset reads as pressed at a time', () => {
    render(
      <CardTextBar
        {...base}
        active={{ bold: true, color: '#111827', highlight: '#86efac', uppercase: false }}
      />,
    )
    expect(screen.getByRole('button', { name: 'CONDIMENTS callout' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'CROCKERIES callout' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('reverts the whole box to plain text', () => {
    render(
      <CardTextBar
        {...base}
        active={{ bold: true, color: '#ffffff', highlight: '#b91c1c', uppercase: true }}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Clear formatting' }))
    expect(base.onChange).toHaveBeenCalledWith(DEFAULT_TEXT_STYLE)
  })

  it('says which box it will change', () => {
    render(<CardTextBar {...base} />)
    expect(screen.getByText('bottom text')).toBeInTheDocument()
  })

  it('says nothing when it will restyle the whole box', () => {
    // The quiet "whole box" label was removed: it described the ordinary state and spent
    // room the presets need.
    render(<CardTextBar {...base} />)
    expect(screen.queryByText('whole box')).not.toBeInTheDocument()
  })

  it('says when it will restyle only a selection', () => {
    render(<CardTextBar {...base} selection={{ start: 2, end: 7 }} />)
    expect(screen.getByText('selection')).toBeInTheDocument()
  })

  it('names the button for the selection when text is selected', () => {
    render(<CardTextBar {...base} selection={{ start: 0, end: 4 }} />)
    expect(screen.getByRole('button', { name: 'Bold selection' })).toBeInTheDocument()
  })

  it('reports the selection’s own style, not the box’s', () => {
    render(
      <CardTextBar
        {...base}
        selection={{ start: 0, end: 4 }}
        active={{ bold: true, color: '#b91c1c', highlight: '#86efac' }}
      />,
    )
    expect(screen.getByRole('button', { name: 'Bold selection' })).toHaveAttribute('aria-pressed', 'true')
  })
})

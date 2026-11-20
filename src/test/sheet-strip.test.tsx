import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SheetStrip } from '../features/workspace/SheetStrip'
import { SheetThumbnail } from '../features/workspace/SheetThumbnail'
import { computeGrid } from '../lib/imposition/grid'
import { DEFAULT_SHEET } from '../types/imposition'
import { cardKey } from '../types/card'
import type { PageRef, SheetPlan } from '../lib/imposition/sheet'
import { planSheets } from '../lib/imposition/sheet'
import { resolveSheetIndex } from '../features/workspace/sheet-navigation'

/**
 * Sheets, navigable.
 *
 * Twelve cards fit one A4 sheet, so a document of thirteen pages has two — and until now
 * only the first was reachable: the canvas always drew `sheets[0]`, the inspector resolved
 * its card against sheet 1, and "which page am I on" had no answer. The strip is the
 * navigation, and these tests cover the two things that make it trustworthy: it only
 * appears when there is somewhere to go, and clicking it really moves the canvas.
 */
const grid = computeGrid(DEFAULT_SHEET)

const pages = (count: number): PageRef[] =>
  Array.from({ length: count }, (_, index) => ({
    documentId: 'dish.pdf',
    fileName: 'dish.pdf',
    pageNumber: index + 1,
    widthMm: 210,
    heightMm: 297,
  }))

const keyFor = (placement: SheetPlan['placements'][number]) =>
  cardKey(placement.cellIndex, placement.documentId, placement.pageNumber)

const strip = (overrides: Partial<React.ComponentProps<typeof SheetStrip>> = {}) => {
  const sheets = planSheets(pages(20), grid)
  const props: React.ComponentProps<typeof SheetStrip> = {
    sheets,
    settings: DEFAULT_SHEET,
    grid,
    cards: {},
    keyFor,
    activeIndex: 0,
    onSelectSheet: vi.fn(),
    collapsed: false,
    onToggleCollapsed: vi.fn(),
    ...overrides,
  }
  return { props, sheets, ...render(<SheetStrip {...props} />) }
}

describe('the sheet strip', () => {
  it('does not exist for a single sheet', () => {
    // One sheet is not navigation, it is a caption the top bar already gives.
    const { container } = render(
      <SheetStrip
        sheets={planSheets(pages(4), grid)}
        settings={DEFAULT_SHEET}
        grid={grid}
        cards={{}}
        keyFor={keyFor}
        activeIndex={0}
        onSelectSheet={() => undefined}
        collapsed={false}
        onToggleCollapsed={() => undefined}
      />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('lists every sheet once the document spans more than one', () => {
    strip()
    // 20 pages of 12 is two sheets.
    expect(screen.getByRole('button', { name: 'Sheet 1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sheet 2' })).toBeInTheDocument()
    expect(screen.getByText('Sheets (2)')).toBeInTheDocument()
  })

  it('marks the sheet being viewed, and only that one', () => {
    strip({ activeIndex: 1 })
    expect(screen.getByRole('button', { name: 'Sheet 2' })).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('button', { name: 'Sheet 1' })).not.toHaveAttribute('aria-current')
  })

  it('reports the sheet that was clicked', () => {
    const { props } = strip()
    fireEvent.click(screen.getByRole('button', { name: 'Sheet 2' }))
    expect(props.onSelectSheet).toHaveBeenCalledWith(1)
  })

  it('collapses to a slim pill that still says how many sheets there are', () => {
    const { props } = strip({ collapsed: true })
    const pill = screen.getByRole('button', { name: 'Expand sheet strip, 2 sheets' })
    expect(pill).toHaveAttribute('aria-expanded', 'false')
    expect(pill.textContent).toContain('Sheets (2)')
    // Collapsed means no thumbnails at all: that is the height being given back.
    expect(screen.queryByRole('button', { name: 'Sheet 1' })).not.toBeInTheDocument()
    fireEvent.click(pill)
    expect(props.onToggleCollapsed).toHaveBeenCalled()
  })

  it('expands from the header, keeping the count visible', () => {
    const { props } = strip()
    fireEvent.click(screen.getByRole('button', { name: 'Collapse sheet strip' }))
    expect(props.onToggleCollapsed).toHaveBeenCalled()
  })
})

describe('a sheet miniature', () => {
  const sheets = planSheets(pages(20), grid)

  it('draws a cell for every slot on the sheet', () => {
    const first = sheets[0]
    if (first === undefined) throw new Error('fixture needs a sheet')
    const { container } = render(
      <SheetThumbnail
        sheet={first}
        settings={DEFAULT_SHEET}
        grid={grid}
        cards={{}}
        keyFor={keyFor}
        active={false}
        onSelect={() => undefined}
      />,
    )
    // A dashed outline per slot, whatever is on it: the miniature shows how full a sheet
    // is, which is the question a thumbnail exists to answer.
    expect(container.querySelectorAll('.border-dashed').length).toBe(12)
  })

  it('keeps the sheet proportions rather than a fixed box', () => {
    const first = sheets[0]
    if (first === undefined) throw new Error('fixture needs a sheet')
    const { container } = render(
      <SheetThumbnail
        sheet={first}
        settings={DEFAULT_SHEET}
        grid={grid}
        cards={{}}
        keyFor={keyFor}
        active
        onSelect={() => undefined}
      />,
    )
    const button = container.querySelector('button') as HTMLElement
    const width = Number.parseFloat(button.style.width)
    const height = Number.parseFloat(button.style.height)
    expect(height / width).toBeCloseTo(297 / 210, 2)
  })
})

describe('which sheet the canvas shows', () => {
  const sample = pages(20)

  it('obeys a sheet the user navigated to', () => {
    // Cell indices repeat on every sheet, so "the sheet holding cell 4" is ambiguous and
    // would always answer sheet 1. The navigation target has to win.
    expect(
      resolveSheetIndex(sample, grid, { target: 1, activeDocumentId: null, fallback: 0 }),
    ).toBe(1)
  })

  it('follows the selection when the target was cleared', () => {
    // Clearing the target is what a selection change does, so the canvas snaps back to
    // wherever the newly selected card lives.
    expect(
      resolveSheetIndex(sample, grid, { target: null, activeDocumentId: null, fallback: 1 }),
    ).toBe(1)
  })

  it('never returns a sheet that does not exist', () => {
    expect(
      resolveSheetIndex(sample, grid, { target: 9, activeDocumentId: null, fallback: 0 }),
    ).toBe(1)
    expect(
      resolveSheetIndex(sample, grid, { target: -3, activeDocumentId: null, fallback: 0 }),
    ).toBe(0)
    expect(resolveSheetIndex([], grid, { target: 4, activeDocumentId: null, fallback: 0 })).toBe(0)
  })
})

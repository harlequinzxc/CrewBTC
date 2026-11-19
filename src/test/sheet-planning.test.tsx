import 'fake-indexeddb/auto'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computeGrid } from '../lib/imposition/grid'
import { planSheets } from '../lib/imposition/sheet'
import { toPageRefs } from '../lib/pdf/page-refs'
import { DEFAULT_SHEET } from '../types/imposition'
/** These suites test sheet geometry, not copy; the new model has no text props. */
const idle = {
  texts: {} as Readonly<Record<string, string>>,
  images: {} as Readonly<Record<string, never>>,
  selectedCell: null,
  onSelectCell: () => undefined,
  onImageChange: () => undefined,
  onResetImage: () => undefined,
  styles: {} as Readonly<Record<string, never>>,
  onTextChange: () => undefined,
  onStyleChange: () => undefined,
}

import { SheetPreview } from '../features/workspace/SheetPreview'

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true,
    value: (q: string) => ({ matches: true, media: q, onchange: null, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn() }) })
})

describe('sheet planning', () => {
  it('splits 25 pages into 9 + 9 + 7 across three sheets', () => {
    const grid = computeGrid(DEFAULT_SHEET)
    const pages = toPageRefs([
      { id: 'd1', fileName: 'card.pdf', byteLength: 10, addedAt: '', status: 'parsed',
        metrics: { pageCount: 25, widthPt: 147, heightPt: 190 }, regions: [], pagePreviewUrl: null,
      copy: null,
      photoUrl: null, error: null },
    ])
    expect(pages.length).toBe(25)

    const sheets = planSheets(pages, grid)
    // 25 pages at 9 per sheet: 9 + 9 + 7, so the last sheet has 2 empty cells.
    expect(sheets.length).toBe(3)
    expect(sheets[0]?.placements.length).toBe(9)
    expect(sheets[1]?.placements.length).toBe(9)
    expect(sheets[2]?.placements.length).toBe(7)
    expect(sheets[2]?.emptyCells).toBe(2)

    render(<SheetPreview settings={DEFAULT_SHEET} grid={grid} pages={pages} showCutMarks {...idle} />)
    expect(screen.getByText('3 × 3 = 9 cells')).toBeInTheDocument()
    expect(screen.getByText('3 sheets')).toBeInTheDocument()
  })
})

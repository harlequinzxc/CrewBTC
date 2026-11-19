import 'fake-indexeddb/auto'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computeGrid } from '../lib/imposition/grid'
import { planSheets } from '../lib/imposition/sheet'
import { toPageRefs } from '../lib/pdf/page-refs'
import { DEFAULT_SHEET } from '../types/imposition'
import { SheetPreview } from '../features/workspace/SheetPreview'

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true,
    value: (q: string) => ({ matches: true, media: q, onchange: null, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn() }) })
})

describe('sheet planning', () => {
  it('splits 25 pages into 12 + 12 + 1 across three sheets', () => {
    const grid = computeGrid(DEFAULT_SHEET)
    const pages = toPageRefs([
      { id: 'd1', fileName: 'card.pdf', byteLength: 10, addedAt: '', status: 'parsed',
        metrics: { pageCount: 25, widthPt: 147, heightPt: 190 }, regions: [], pagePreviewUrl: null, error: null },
    ])
    expect(pages.length).toBe(25)

    const sheets = planSheets(pages, grid)
    expect(sheets.length).toBe(3)          // 12 + 12 + 1
    expect(sheets[0]?.placements.length).toBe(12)
    expect(sheets[2]?.placements.length).toBe(1)
    expect(sheets[2]?.emptyCells).toBe(11)

    render(<SheetPreview settings={DEFAULT_SHEET} grid={grid} pages={pages} showCutMarks />)
    expect(screen.getByText('3 × 4 = 12 cells')).toBeInTheDocument()
    expect(screen.getByText('3 sheets')).toBeInTheDocument()
  })
})

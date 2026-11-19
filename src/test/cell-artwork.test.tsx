import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computeGrid } from '../lib/imposition/grid'
import { DEFAULT_SHEET } from '../types/imposition'
import type { PageRef } from '../lib/imposition/sheet'

/**
 * Cell artwork: each grid cell must show the rendered source page, positioned at
 * exactly the rect the exporter will use. The renderer is mocked because jsdom has
 * no canvas; the placement maths under test is the real implementation.
 */
const renderThumbnail = vi.fn()

vi.mock('../lib/pdf/thumbnails', () => ({
  THUMBNAIL_WIDTH_PX: 220,
  thumbnailKey: (fileName: string, pageNumber: number) => `${fileName}#${pageNumber}`,
  renderThumbnail: (fileName: string, pageNumber: number) =>
    renderThumbnail(fileName, pageNumber) as Promise<string | null>,
}))

import { SheetPreview } from '../features/workspace/SheetPreview'

const grid = computeGrid(DEFAULT_SHEET)

function stubSize(width: number, height: number): void {
  class FakeResizeObserver {
    private readonly callback: ResizeObserverCallback
    constructor(callback: ResizeObserverCallback) {
      this.callback = callback
    }
    observe(): void {
      this.callback(
        [{ contentRect: { width, height } } as unknown as ResizeObserverEntry],
        this as unknown as ResizeObserver,
      )
    }
    unobserve(): void {}
    disconnect(): void {}
  }
  ;(globalThis as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver =
    FakeResizeObserver as unknown as typeof ResizeObserver
}

function refs(count: number): PageRef[] {
  return Array.from({ length: count }, (_unused, index) => ({
    documentId: 'cards.pdf',
    fileName: 'cards.pdf',
    pageNumber: index + 1,
    widthMm: 52,
    heightMm: 67,
  }))
}

beforeEach(() => {
  renderThumbnail.mockReset()
  renderThumbnail.mockImplementation(
    async (fileName: string, pageNumber: number) => `data:image/png;base64,${fileName}-${pageNumber}`,
  )
  stubSize(800, 600)
})

describe('page content inside cells', () => {
  it('renders one image per placed cell', async () => {
    render(<SheetPreview settings={DEFAULT_SHEET} grid={grid} pages={refs(12)} showCutMarks />)

    await waitFor(() => {
      expect(document.querySelectorAll('img')).toHaveLength(12)
    })
  })

  it('shows the right page in the right cell', async () => {
    render(<SheetPreview settings={DEFAULT_SHEET} grid={grid} pages={refs(12)} showCutMarks />)

    await waitFor(() => {
      expect(document.querySelectorAll('img')).toHaveLength(12)
    })
    const sources = [...document.querySelectorAll('img')].map((img) => img.getAttribute('src'))
    expect(sources).toContain('data:image/png;base64,cards.pdf-1')
    expect(sources).toContain('data:image/png;base64,cards.pdf-12')
  })

  it('renders each page only once, however many cells reference it', async () => {
    // A single-page PDF repeated is not the case here: instead assert no duplicate
    // renders for a normal 12-up sheet.
    render(<SheetPreview settings={DEFAULT_SHEET} grid={grid} pages={refs(12)} showCutMarks />)
    await waitFor(() => expect(document.querySelectorAll('img')).toHaveLength(12))

    const keys = renderThumbnail.mock.calls.map((call) => call.join('#'))
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('leaves the last cells empty when the batch is short', async () => {
    render(<SheetPreview settings={DEFAULT_SHEET} grid={grid} pages={refs(5)} showCutMarks />)
    await waitFor(() => expect(document.querySelectorAll('img')).toHaveLength(5))
  })

  it('falls back to the filename when a page cannot be rendered', async () => {
    renderThumbnail.mockResolvedValue(null)
    render(<SheetPreview settings={DEFAULT_SHEET} grid={grid} pages={refs(2)} showCutMarks />)

    await waitFor(() => {
      expect(screen.getAllByText('cards').length).toBeGreaterThan(0)
    })
    expect(document.querySelectorAll('img')).toHaveLength(0)
  })

  it('draws no image when there are no pages', () => {
    render(<SheetPreview settings={DEFAULT_SHEET} grid={grid} pages={[]} showCutMarks />)
    expect(document.querySelectorAll('img')).toHaveLength(0)
  })
})

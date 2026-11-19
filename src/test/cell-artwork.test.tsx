import { render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computeGrid } from '../lib/imposition/grid'
import { DEFAULT_SHEET } from '../types/imposition'
import type { PageRef } from '../lib/imposition/sheet'
import { thumbnailKey } from '../lib/pdf/thumbnails'

/**
 * Artwork inside cells: each card shows its own page's extracted dish photo, at the rect
 * the exporter will use.
 *
 * Whole-page renders used to fill this role. They are gone — a card must never show a
 * screenshot of the source page — so the case worth guarding is that a missing photo
 * leaves the band empty rather than falling back to one.
 */
const renderThumbnail = vi.fn()

vi.mock('../lib/pdf/thumbnails', () => ({
  THUMBNAIL_WIDTH_PX: 220,
  thumbnailKey: (fileName: string, pageNumber: number) => `${fileName}#0#${pageNumber}`,
  renderThumbnail: (fileName: string, pageNumber: number) =>
    renderThumbnail(fileName, pageNumber) as Promise<string | null>,
}))

import { SheetPreview } from '../features/workspace/SheetPreview'
import { keepSource, sourceVersion } from '../lib/export/doc-cache'

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
    widthMm: 64,
    heightMm: 90,
  }))
}

/** Squares with copy are not the subject here; the geometry and artwork are. */
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

/** A photo map for pages 1..count, keyed exactly as the sheet reads it. */
function photosFor(count: number): Record<string, string> {
  const out: Record<string, string> = {}
  for (let page = 1; page <= count; page += 1) {
    out[thumbnailKey('cards.pdf', page)] = `data:image/png;base64,DISH-${page}`
  }
  return out
}

const imageSources = (): string[] =>
  Array.from(document.querySelectorAll('img')).map((img) => img.getAttribute('src') ?? '')

beforeEach(() => {
  renderThumbnail.mockReset()
  stubSize(800, 600)
})

describe('dish photos inside cells', () => {
  it('renders one photo per placed cell', async () => {
    render(
      <SheetPreview
        settings={DEFAULT_SHEET}
        grid={grid}
        pages={refs(4)}
        showCutMarks
        {...idle}
        photos={photosFor(4)}
      />,
    )
    await waitFor(() => {
      expect(imageSources()).toHaveLength(4)
    })
  })

  it('shows the right photo in the right cell', async () => {
    render(
      <SheetPreview
        settings={DEFAULT_SHEET}
        grid={grid}
        pages={refs(3)}
        showCutMarks
        {...idle}
        photos={photosFor(3)}
      />,
    )
    await waitFor(() => {
      const sources = imageSources()
      expect(sources).toContain('data:image/png;base64,DISH-1')
      expect(sources).toContain('data:image/png;base64,DISH-2')
      expect(sources).toContain('data:image/png;base64,DISH-3')
    })
  })

  it('never renders a page while a photo is available', async () => {
    render(
      <SheetPreview
        settings={DEFAULT_SHEET}
        grid={grid}
        pages={refs(2)}
        showCutMarks
        {...idle}
        photos={photosFor(2)}
      />,
    )
    await waitFor(() => {
      expect(imageSources()).toHaveLength(2)
    })
    // The old behaviour rendered pages through this path; nothing may call it.
    expect(renderThumbnail).not.toHaveBeenCalled()
  })

  it('leaves the band empty when a page has no photo, rather than rendering it', async () => {
    const photos = photosFor(2)
    delete photos[thumbnailKey('cards.pdf', 2)]

    render(
      <SheetPreview settings={DEFAULT_SHEET} grid={grid} pages={refs(2)} showCutMarks {...idle} photos={photos} />,
    )
    await waitFor(() => {
      expect(imageSources()).toHaveLength(1)
    })
    expect(renderThumbnail).not.toHaveBeenCalled()
  })

  it('draws no image when there are no pages', () => {
    render(
      <SheetPreview settings={DEFAULT_SHEET} grid={grid} pages={[]} showCutMarks {...idle} photos={{}} />,
    )
    expect(imageSources()).toHaveLength(0)
  })

  it('leaves the last cells empty when the batch is short', async () => {
    render(
      <SheetPreview
        settings={DEFAULT_SHEET}
        grid={grid}
        pages={refs(2)}
        showCutMarks
        {...idle}
        photos={photosFor(2)}
      />,
    )
    await waitFor(() => {
      expect(imageSources()).toHaveLength(2)
    })
    // Nine cells fit; two pages means seven empty.
    expect(grid.cellCount).toBe(9)
  })
})

describe('source versions', () => {
  it('bumps the version only when bytes are actually kept', () => {
    expect(sourceVersion('cards.pdf')).toBe(0)

    keepSource('cards.pdf', new ArrayBuffer(8))
    const first = sourceVersion('cards.pdf')
    expect(first).toBeGreaterThan(0)

    keepSource('cards.pdf', new ArrayBuffer(16))
    expect(sourceVersion('cards.pdf')).toBeGreaterThan(first)

    // A file that was never uploaded stays at 0, so nothing renders from nothing.
    expect(sourceVersion('missing.pdf')).toBe(0)
  })
})

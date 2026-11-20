import 'fake-indexeddb/auto'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { IngestedDocument } from '../types/document'

/**
 * Every page lands on a populated card, on every sheet.
 *
 * Two separate bugs met here. The seed key used the page's position in the flattened page
 * list while the canvas looks cards up by `cellIndex`, so anything past the first sheet was
 * seeded under a key nothing would ever read — the cards were in the store, just not where
 * the sheet looked. And `useSeedCards` remembered "already seeded" keys in a ref for the
 * life of the component, so after clearing the uploads and loading again nothing re-seeded
 * and every sheet came up empty.
 */
const parsed = {
  id: 'internal-id-0',
  fileName: 'book.pdf',
  byteLength: 2048,
  addedAt: '2026-11-19T00:00:00.000Z',
  status: 'parsed',
  metrics: { pageCount: 14, widthPt: 420, heightPt: 595 },
  regions: [],
  pagePreviewUrl: null,
  copy: null,
  copies: Object.fromEntries(
    Array.from({ length: 14 }, (_, index) => [
      index + 1,
      { header: `PAGE-${index + 1}`, footer: `• step ${index + 1}` },
    ]),
  ),
  photoUrl: null,
  photos: Object.fromEntries(
    Array.from({ length: 14 }, (_, index) => [
      index + 1,
      {
        dataUrl: `data:image/png;base64,PAGE${index + 1}`,
        widthPx: 360,
        heightPx: 300,
      },
    ]),
  ),
  error: null,
} as unknown as IngestedDocument

const pickFiles = vi.fn()
vi.mock('../lib/files/open-picker', () => ({
  pickFiles: () => pickFiles() as Promise<File[]>,
}))
vi.mock('../lib/pdf/ingest-batch', () => ({ ingestBatch: async () => [parsed] }))

import App from '../App'

const desktop = (): void => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1440 })
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: query.includes('min-width: 64rem'),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  })
}

/**
 * The cards drawn on one sheet, in cell order.
 *
 * Every sheet is on screen at once now, so "the cards on the canvas" is not a question
 * with one answer — the sheet is part of the query. `data-sheet` was added for exactly
 * this: the stack needs a name for each page that is not its position in a scroll offset.
 */
const drawnCards = (sheet = 1): HTMLElement[] =>
  [
    ...document.querySelectorAll(`[data-sheet="${sheet}"] [data-cell]`),
  ] as HTMLElement[]

const load = async (): Promise<void> => {
  fireEvent.click(screen.getAllByRole('button', { name: /add pdfs/i })[0]!)
  await waitFor(() => expect(drawnCards().length).toBeGreaterThan(0))
}

/**
 * How many sheets the stack is drawing.
 *
 * Scrolling replaced navigation, so the assertion that used to be "the strip moved the
 * canvas" is now "the second sheet is on the page at all". A test that clicked a thumbnail
 * could not tell a working canvas from one that scrolls a sheet it never drew.
 */
const drawnSheetCount = (): number => document.querySelectorAll('[data-sheet]').length

beforeEach(() => {
  pickFiles.mockResolvedValue([new File(['%PDF'], 'book.pdf')])
  desktop()
})

describe('a document that spans two sheets', () => {
  it('fills every card on the first sheet', async () => {
    render(<App />)
    await load()

    await waitFor(() => {
      const cards = drawnCards(1)
      expect(cards.length).toBe(12)
      expect(cards[0]?.textContent).toContain('PAGE-1')
      expect(cards[11]?.textContent).toContain('PAGE-12')
    })
    // Sheet 2 exists in the same scroll surface, not behind a click.
    expect(drawnSheetCount()).toBe(2)
  })

  it('fills every card on the second sheet', async () => {
    render(<App />)
    await load()

    await waitFor(() => {
      const cards = drawnCards(2)
      // Pages 13 and 14 are the whole of sheet 2.
      expect(cards.length).toBe(2)
      expect(cards[0]?.textContent).toContain('PAGE-13')
      expect(cards[1]?.textContent).toContain('PAGE-14')
    })
  })

  it('shows that sheet 2 has its own photos, not the first sheet’s', async () => {
    render(<App />)
    await load()

    await waitFor(() => {
      const first = drawnCards(2)[0]
      const image = first?.querySelector('img')
      expect(image?.getAttribute('src')).toContain('PAGE13')
    })
    // And sheet 1 has not been overwritten with them.
    expect(drawnCards(1)[0]?.querySelector('img')?.getAttribute('src')).toContain('PAGE1')
  })
})

describe('clearing the uploads and loading again', () => {
  it('re-seeds every sheet after a clear', async () => {
    render(<App />)
    await load()
    await waitFor(() => expect(drawnCards()[0]?.textContent).toContain('PAGE-1'))

    // Delete all uploads, then load the same file again.
    fireEvent.click(screen.getByRole('button', { name: /clear|delete all|remove all/i }))
    await waitFor(() => expect(drawnSheetCount()).toBe(0))

    await load()

    // Both sheets have to come back fully populated, not empty.
    await waitFor(() => {
      const cards = drawnCards(1)
      expect(cards.length).toBe(12)
      expect(cards[0]?.textContent).toContain('PAGE-1')
      expect(cards[0]?.querySelector('img')?.getAttribute('src')).toContain('PAGE1')
    })
    expect(drawnCards(2)[0]?.textContent).toContain('PAGE-13')
  })
})

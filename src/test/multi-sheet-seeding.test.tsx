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

/** The cards currently drawn on the canvas, in cell order. */
const drawnCards = (): HTMLElement[] =>
  [...document.querySelectorAll('[data-cell]')] as HTMLElement[]

const load = async (): Promise<void> => {
  fireEvent.click(screen.getAllByRole('button', { name: /add pdfs/i })[0]!)
  await waitFor(() => expect(drawnCards().length).toBeGreaterThan(0))
}

beforeEach(() => {
  pickFiles.mockResolvedValue([new File(['%PDF'], 'book.pdf')])
  desktop()
})

describe('a document that spans two sheets', () => {
  it('fills every card on the first sheet', async () => {
    render(<App />)
    await load()

    await waitFor(() => {
      const cards = drawnCards()
      expect(cards.length).toBe(12)
      expect(cards[0]?.textContent).toContain('PAGE-1')
      expect(cards[11]?.textContent).toContain('PAGE-12')
    })
  })

  it('fills every card on the second sheet', async () => {
    render(<App />)
    await load()

    // Navigate to sheet 2 through the strip.
    fireEvent.click(await screen.findByRole('button', { name: 'Sheet 2' }))

    await waitFor(() => {
      const cards = drawnCards()
      // Pages 13 and 14 are the whole of sheet 2.
      expect(cards.length).toBe(2)
      expect(cards[0]?.textContent).toContain('PAGE-13')
      expect(cards[1]?.textContent).toContain('PAGE-14')
    })
  })

  it('shows that sheet 2 has its own photos, not the first sheet’s', async () => {
    render(<App />)
    await load()
    fireEvent.click(await screen.findByRole('button', { name: 'Sheet 2' }))

    await waitFor(() => {
      const first = drawnCards()[0]
      const image = first?.querySelector('img')
      expect(image?.getAttribute('src')).toContain('PAGE13')
    })
  })
})

describe('clearing the uploads and loading again', () => {
  it('re-seeds every sheet after a clear', async () => {
    render(<App />)
    await load()
    await waitFor(() => expect(drawnCards()[0]?.textContent).toContain('PAGE-1'))

    // Delete all uploads, then load the same file again.
    fireEvent.click(screen.getByRole('button', { name: /clear|delete all|remove all/i }))
    await waitFor(() => expect(drawnCards().length).toBe(0))

    await load()

    // The first sheet has to come back fully populated, not empty.
    await waitFor(() => {
      const cards = drawnCards()
      expect(cards.length).toBe(12)
      expect(cards[0]?.textContent).toContain('PAGE-1')
      expect(cards[0]?.querySelector('img')?.getAttribute('src')).toContain('PAGE1')
    })
  })
})

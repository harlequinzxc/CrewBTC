import 'fake-indexeddb/auto'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { IngestedDocument } from '../types/document'

/**
 * Upload to card, end to end through the real app.
 *
 * The bug this guards against: a page was placed on the sheet, but its card was seeded
 * empty — no photo, no text — because the lookup matched a document's internal id
 * against the file name the sheet actually uses. Every unit below the app passed; only
 * a test that went through the real wiring could see it.
 */

const pickFiles = vi.fn()

vi.mock('../lib/files/open-picker', () => ({
  pickFiles: () => pickFiles() as Promise<File[]>,
}))

const parsed = {
  id: 'internal-id-0',
  fileName: 'cards.pdf',
  byteLength: 1024,
  addedAt: '2026-11-19T00:00:00.000Z',
  status: 'parsed',
  metrics: { pageCount: 1, widthPt: 420, heightPt: 595 },
  regions: [],
  pagePreviewUrl: null,
  copy: null,
  copies: { 1: { header: 'CHK-01\nKung Pao Chicken', footer: '• Plate\n• Garnish' } },
  photoUrl: null,
  photos: { 1: { dataUrl: 'data:image/png;base64,DISHBYTES', widthPx: 360, heightPx: 300 } },
  error: null,
} as IngestedDocument

/** The one mutable part of the fixture: the two-card test needs a second page. */
const mutable = parsed as unknown as {
  metrics: IngestedDocument['metrics']
  copies: IngestedDocument['copies']
  photos: IngestedDocument['photos']
}

vi.mock('../lib/pdf/ingest-batch', () => ({
  ingestBatch: async () => [parsed],
}))

import App from '../App'

function desktop(width = 1440): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width })
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: query.includes('min-width: 64rem') ? width >= 1024 : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  })
}

/** Uploads the mocked file and waits for the card to be on the sheet. */
async function placeCard(): Promise<HTMLElement> {
  render(<App />)
  fireEvent.click(screen.getAllByRole('button', { name: /add pdfs/i })[0]!)

  await waitFor(() => expect(document.querySelector('[data-cell]')).not.toBeNull())
  return document.querySelector('[data-cell]') as HTMLElement
}

beforeEach(() => {
  pickFiles.mockResolvedValue([new File(['%PDF'], 'cards.pdf')])
  desktop()
})

describe('a page lands on a populated card', () => {
  it('shows the extracted photo, not an empty box', async () => {
    const cell = await placeCard()

    await waitFor(() => expect(cell.querySelectorAll('img').length).toBe(1))
    expect(cell.textContent).not.toContain('No photo on this page')
    expect(cell.querySelector('img')?.getAttribute('src')).toContain('DISHBYTES')
  })

  it('shows the extracted text in the right boxes', async () => {
    const cell = await placeCard()

    await waitFor(() => expect(cell.textContent).toContain('Kung Pao Chicken'))
    expect(cell.textContent).toContain('Plate')
    // The header and the body are separate boxes, not one joined string.
    expect(screen.getByRole('button', { name: /CHK-01/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Garnish/ })).toBeInTheDocument()
  })

  it('does not stretch the photo to the card', async () => {
    const cell = await placeCard()
    await waitFor(() => expect(cell.querySelectorAll('img').length).toBe(1))

    const img = cell.querySelector('img') as HTMLImageElement
    const width = Number.parseFloat(img.style.width)
    const height = Number.parseFloat(img.style.height)
    expect(width / height).toBeCloseTo(360 / 300, 2)
  })
})

describe('fine-tuning one card', () => {
  it('offers the card inspector once a card is selected', async () => {
    const cell = await placeCard()
    // Nothing selected: the inspector is about the document, not a card.
    expect(screen.queryByLabelText('Top')).not.toBeInTheDocument()

    fireEvent.pointerDown(cell)
    expect(await screen.findByLabelText('Top')).toBeInTheDocument()
    expect(screen.getByLabelText('Bottom')).toBeInTheDocument()
    expect(screen.getByLabelText('Text')).toBeInTheDocument()
  })

  it('resizes the picture when the top height changes', async () => {
    const cell = await placeCard()
    await waitFor(() => expect(document.querySelector('[data-image]')).not.toBeNull())

    fireEvent.pointerDown(cell)
    const box = (): string => (document.querySelector('[data-image]') as HTMLElement).style.height
    const before = box()

    fireEvent.change(await screen.findByLabelText('Top'), { target: { value: '30' } })
    expect(box()).not.toBe(before)
  })

  it('writes the card numbers into the inspector, never into the sheet', async () => {
    const cell = await placeCard()
    fireEvent.pointerDown(cell)

    const inspector = await screen.findByRole('complementary', { name: 'Inspector' })
    // The controls live outside the drawn sheet, so they cannot be clipped by a card's
    // edge on the bottom row — and there are no slider tracks left anywhere on it.
    expect(inspector.querySelector('input[aria-label="Top"]')).not.toBeNull()
    expect(document.querySelector('[data-cell] input[type="range"]')).toBeNull()
    expect(document.querySelectorAll('input[type="range"]')).toHaveLength(0)
  })

  it('keeps each card’s heights to itself', async () => {
    // Two pages, so there are two cards to tell apart.
    mutable.metrics = { pageCount: 2, widthPt: 420, heightPt: 595 }
    mutable.copies = {
      1: { header: 'CHK-01', footer: '• One' },
      2: { header: 'CHK-02', footer: '• Two' },
    }
    mutable.photos = {
      1: { dataUrl: 'data:image/png;base64,ONE', widthPx: 360, heightPx: 300 },
      2: { dataUrl: 'data:image/png;base64,TWO', widthPx: 360, heightPx: 300 },
    }

    await placeCard()
    const cells = document.querySelectorAll('[data-cell]')
    expect(cells.length).toBeGreaterThanOrEqual(2)

    fireEvent.pointerDown(cells[0] as HTMLElement)
    fireEvent.change(await screen.findByLabelText('Top'), { target: { value: '30' } })

    // Select the second card: it must still be at its own seeded height, not the first
    // card's 30. Its bands come from its own text ("CHK-02" is one short line), so the
    // value is derived rather than a constant — what matters is that it did not move.
    fireEvent.pointerDown(cells[1] as HTMLElement)
    await waitFor(() => {
      const top = screen.getByLabelText('Top') as HTMLInputElement
      expect(Number(top.value)).toBeLessThan(30)
    })
  })

  afterEach(() => {
    // Leave the fixture as the other tests expect it.
    mutable.metrics = { pageCount: 1, widthPt: 420, heightPt: 595 }
    mutable.copies = { 1: { header: 'CHK-01\nKung Pao Chicken', footer: '• Plate\n• Garnish' } }
    mutable.photos = { 1: { dataUrl: 'data:image/png;base64,DISHBYTES', widthPx: 360, heightPx: 300 } }
  })
})

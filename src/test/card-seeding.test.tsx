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
  it('shows read-only selected card values and the sheet text size', async () => {
    const cell = await placeCard()
    fireEvent.pointerDown(cell)
    const inspector = screen.getByRole('complementary', { name: 'Inspector' })
    expect(inspector.querySelector('[aria-label="Top value"]')).toHaveTextContent('mm')
    expect(inspector.querySelector('[aria-label="Bottom value"]')).toHaveTextContent('mm')
    expect(inspector.querySelector('[aria-label="Text value"]')).toHaveTextContent('80%')
    expect(inspector.querySelector('input[aria-label="Top"]')).toBeNull()
    fireEvent.change(screen.getByLabelText('All text size'), { target: { value: '125' } })
    expect(inspector.querySelector('[aria-label="Text value"]')).toHaveTextContent('125%')
  })

  it('numbers following cards and allows a corner label', async () => {
    mutable.metrics = { pageCount: 2, widthPt: 420, heightPt: 595 }
    mutable.copies = { 1: { header: 'One', footer: '' }, 2: { header: 'Two', footer: '' } }
    mutable.photos = {}
    await placeCard()
    await waitFor(() => expect(screen.getAllByLabelText('Card number')).toHaveLength(2))
    const numbers = screen.getAllByLabelText('Card number') as HTMLSelectElement[]
    expect(numbers.map((input) => input.value)).toEqual(['1', '2'])
    fireEvent.change(numbers[0]!, { target: { value: '40' } })
    expect(numbers.map((input) => input.value)).toEqual(['40', '1'])
    const labels = screen.getAllByLabelText('Card corner label') as HTMLInputElement[]
    expect(labels[0]?.placeholder).toBe('XXXXX')
    fireEvent.change(labels[0]!, { target: { value: 'ABC' } })
    expect(labels[0]?.value).toBe('ABC')
    expect(labels[1]?.value).toBe('ABC')
    fireEvent.change(labels[1]!, { target: { value: 'REST' } })
    expect(labels[0]?.value).toBe('ABC')
    expect(labels[1]?.value).toBe('REST')
  })

  afterEach(() => {
    // Leave the fixture as the other tests expect it.
    mutable.metrics = { pageCount: 1, widthPt: 420, heightPt: 595 }
    mutable.copies = { 1: { header: 'CHK-01\nKung Pao Chicken', footer: '• Plate\n• Garnish' } }
    mutable.photos = { 1: { dataUrl: 'data:image/png;base64,DISHBYTES', widthPx: 360, heightPx: 300 } }
  })
})

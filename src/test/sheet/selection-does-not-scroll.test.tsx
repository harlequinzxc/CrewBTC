import 'fake-indexeddb/auto'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { IngestedDocument } from '../../types/document'

/**
 * Selecting a card must not move the canvas.
 *
 * The gesture that selects a card is a pointer-down on the card itself — the same gesture
 * that places a caret in its header or grabs its photo. Scrolling the stack in response
 * moves the paper out from under the pointer, so the press lands on a different element
 * and the caret or the drag is destroyed. Nothing about that is visible in a unit test of
 * `Card`: it lives in the wiring between selection and navigation.
 *
 * So this asserts the negative — the pane's scroll position is unchanged — and then
 * asserts that the two *explicit* ways to move still move: the strip and a file row.
 */

const pickFiles = vi.fn()

vi.mock('../../lib/files/open-picker', () => ({
  pickFiles: () => pickFiles() as Promise<File[]>,
}))

/** Fourteen pages, so the document spans two sheets and there is somewhere to scroll to. */
const pages = Array.from({ length: 14 }, (_, index) => ({
  id: `internal-${index}`,
  fileName: 'book.pdf',
  pageNumber: index + 1,
  header: `PAGE-${index + 1}`,
}))

const document_ = {
  id: 'internal-id-0',
  fileName: 'book.pdf',
  byteLength: 1024,
  addedAt: '2026-11-19T00:00:00.000Z',
  status: 'parsed',
  metrics: { pageCount: 14, widthPt: 420, heightPt: 595 },
  regions: [],
  pagePreviewUrl: null,
  copy: null,
  copies: Object.fromEntries(pages.map((page) => [page.pageNumber, { header: page.header, footer: '' }])),
  photoUrl: null,
  photos: {},
  error: null,
} as IngestedDocument

vi.mock('../../lib/pdf/ingest-batch', () => ({
  ingestBatch: async () => [document_],
}))

import App from '../../App'

function desktop(): void {
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

const pane = (): HTMLElement => screen.getByTestId('sheet-pane')

/**
 * jsdom has no layout, so nothing sets `scrollTop` for us — but it does keep whatever we
 * assign, which is enough to catch a scroll that should not have happened: the assertion
 * is that the value we planted is still there afterwards.
 */
const parkAt = (value: number): void => {
  pane().scrollTop = value
}

const load = async (): Promise<void> => {
  render(<App />)
  fireEvent.click(screen.getAllByRole('button', { name: /add pdfs/i })[0]!)
  await waitFor(() => expect(document.querySelector('[data-sheet="2"] [data-cell]')).not.toBeNull())
}

const cardOn = (sheet: number, cell: number): HTMLElement => {
  const found = document.querySelector(`[data-sheet="${sheet}"] [data-cell="${cell}"]`)
  if (found === null) throw new Error(`no card at sheet ${sheet} cell ${cell}`)
  return found as HTMLElement
}

beforeEach(() => {
  pickFiles.mockResolvedValue([new File(['%PDF'], 'book.pdf')])
  desktop()
})

describe('selecting a card', () => {
  it('does not scroll the canvas', async () => {
    await load()
    parkAt(900)

    fireEvent.pointerDown(cardOn(1, 3))

    // The selection happened …
    await waitFor(() => expect(document.querySelector('[data-cell].outline-accent')).not.toBeNull())
    // … and the paper did not move under the pointer.
    expect(pane().scrollTop).toBe(900)
  })

  it('does not scroll when the card is on the second sheet either', async () => {
    // This is the case the old behaviour was written for, and it is still wrong: the card
    // is on screen because every sheet is, so there is nothing to bring into view.
    await load()
    parkAt(720)

    fireEvent.pointerDown(cardOn(2, 1))

    await waitFor(() => expect(document.querySelector('[data-cell].outline-accent')).not.toBeNull())
    expect(pane().scrollTop).toBe(720)
  })

  it('keeps the canvas still when moving between cards', async () => {
    await load()
    parkAt(1500)

    fireEvent.pointerDown(cardOn(2, 0))
    fireEvent.pointerDown(cardOn(1, 7))
    await waitFor(() => expect(cardOn(1, 7).className).toContain('outline-accent'))

    expect(pane().scrollTop).toBe(1500)
  })
})

describe('the two ways to move that should still move', () => {
  it('scrolls when a thumbnail is clicked', async () => {
    await load()
    parkAt(0)

    fireEvent.click(await screen.findByRole('button', { name: 'Sheet 2' }))
    // 297mm × the fitted scale plus the 24px gap: a real offset, not a no-op.
    expect(pane().scrollTop).toBeGreaterThan(24)
  })

  it('scrolls when a file row in the rail is clicked', async () => {
    await load()
    parkAt(4000)

    const row = screen.getAllByRole('button', { name: /book\.pdf/ })[0]!
    fireEvent.click(row)
    // Back to the file's first card, which is on sheet 1.
    expect(pane().scrollTop).toBe(0)
  })
})

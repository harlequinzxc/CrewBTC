import 'fake-indexeddb/auto'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { IngestedDocument } from '../types/document'

/**
 * Clicking away from a card clears the selection.
 *
 * Two places count as "away": the dark canvas either side of the paper, and the white
 * margin between the paper's edge and the first cell. Both are the same gesture — *this
 * card is not what I am working on* — and both must put the right rail back to the sheet,
 * or the user has to hunt for a way to unselect something the app let them select.
 *
 * A click *on* a card is deliberately not in that set: it selects, and on a selected card
 * it starts editing the zone it landed on. Making it a toggle would mean a second click
 * to fix a typo cleared the selection instead.
 *
 * The bug this guards against is subtle: the sheet's own overlay only covers the *cells*,
 * so a click in the margins reached the backdrop's sibling and did nothing. The visible
 * symptom was a red ring that would not go away.
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

vi.mock('../lib/pdf/ingest-batch', () => ({
  ingestBatch: async () => [parsed],
}))

import App from '../App'

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

const placeCard = async (): Promise<HTMLElement> => {
  render(<App />)
  fireEvent.click(screen.getAllByRole('button', { name: /add pdfs/i })[0]!)
  await waitFor(() => expect(document.querySelector('[data-cell]')).not.toBeNull())
  return document.querySelector('[data-cell]') as HTMLElement
}

const select = async (cell: HTMLElement): Promise<void> => {
  fireEvent.pointerDown(cell)
  await screen.findByLabelText('Top')
}

const expectDeselected = async (): Promise<void> => {
  await waitFor(() => expect(screen.queryByLabelText('Top')).not.toBeInTheDocument())
  // And the rail is back to the document, which is what "no selection" looks like.
  expect(screen.getByText('Sheet & print')).toBeInTheDocument()
  expect(screen.queryByText(/^Card \d+/)).not.toBeInTheDocument()
}

beforeEach(() => {
  pickFiles.mockResolvedValue([new File(['%PDF'], 'cards.pdf')])
  desktop()
})

describe('clicking off a card', () => {
  it('deselects on the white margins of the sheet itself', async () => {
    const cell = await placeCard()
    await select(cell)
    expect(screen.getByText(/^Card 1$/)).toBeInTheDocument()

    // The paper, not a cell: the strip of white between the trim edge and the first card.
    const paper = cell.parentElement as HTMLElement
    const margin = paper.querySelector('[data-sheet] > div > div[aria-hidden="true"]')
    expect(margin).not.toBeNull()
    fireEvent.pointerDown(margin as HTMLElement)

    await expectDeselected()
  })

  it('deselects on the dark canvas beside the paper', async () => {
    const cell = await placeCard()
    await select(cell)

    const pane = screen.getByTestId('sheet-pane')
    fireEvent.pointerDown(pane)
    await expectDeselected()
  })
})

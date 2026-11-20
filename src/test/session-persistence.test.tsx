import 'fake-indexeddb/auto'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { IngestedDocument } from '../types/document'
import { SNAPSHOT_DB, validate, readSnapshot, clearSnapshot } from '../lib/storage/snapshot'

/**
 * The session survives a reload.
 *
 * Upload a PDF, tune a card, refresh — and the batch, the placements and the edits are
 * still there. Before this, they were `useState` and a refresh was a total loss; "Clear
 * all" was equally permanent, with no undo. Both are the same defect: work that exists
 * only in memory, in an app whose whole value is the state of a batch.
 */
const pickFiles = vi.fn()

vi.mock('../lib/files/open-picker', () => ({
  pickFiles: () => pickFiles() as Promise<File[]>,
}))

const document_ = {
  id: 'internal-id-0',
  fileName: 'book.pdf',
  byteLength: 1024,
  addedAt: '2026-11-19T00:00:00.000Z',
  status: 'parsed',
  metrics: { pageCount: 2, widthPt: 420, heightPt: 595 },
  regions: [],
  pagePreviewUrl: null,
  copy: null,
  copies: {
    1: { header: 'PAGE-1', footer: '• One' },
    2: { header: 'PAGE-2', footer: '• Two' },
  },
  photoUrl: null,
  photos: {},
  error: null,
} as IngestedDocument

vi.mock('../lib/pdf/ingest-batch', () => ({
  ingestBatch: async () => [document_],
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

const cards = (): HTMLElement[] => [...document.querySelectorAll('[data-cell]')] as HTMLElement[]

const load = async (): Promise<void> => {
  fireEvent.click(screen.getAllByRole('button', { name: /add pdfs/i })[0]!)
  await waitFor(() => expect(cards()[0]?.textContent).toContain('PAGE-1'))
}

beforeEach(async () => {
  desktop()
  pickFiles.mockResolvedValue([new File(['%PDF'], 'book.pdf')])
  await clearSnapshot()
})

describe('a reload', () => {
  it('comes back to the same batch, with the cards already drawn', async () => {
    // The real question, and the one the user asked. A fresh mount is what a refresh is:
    // the state that was in memory is gone, and all that is left is what was written.
    const first = render(<App />)
    await load()
    await waitFor(async () => expect(await readSnapshot()).not.toBeNull(), { timeout: 2000 })
    const drawn = cards().length
    first.unmount()

    render(<App />)
    await waitFor(() => expect(cards().length).toBe(drawn))
    expect(cards()[0]?.textContent).toContain('PAGE-1')
    // Restored, not re-parsed: the mock would hand back the same file, so the way to tell
    // is that pickFiles was never called a second time.
    expect(pickFiles).toHaveBeenCalledTimes(1)
  })

  it('does not resurrect a batch the user cleared', async () => {
    // Clearing writes an empty snapshot, and restoring that is correct: undo is the
    // toast's job for its lifetime, and after that the decision stands.
    const first = render(<App />)
    await load()
    fireEvent.click(screen.getByRole('button', { name: /clear all files/i }))
    await waitFor(() => expect(cards().length).toBe(0))
    await waitFor(async () => {
      const stored = await readSnapshot()
      expect(stored?.documents.length).toBe(0)
    })
    first.unmount()

    render(<App />)
    // Give the read a moment to land; the assertion is that it found nothing to draw.
    await new Promise((resolve) => setTimeout(resolve, 150))
    expect(cards().length).toBe(0)
  })
})

describe('the snapshot on disk', () => {
  it('is written once a batch is loaded', async () => {
    render(<App />)
    await load()

    // Debounced, so it is not there the instant the batch paints.
    await waitFor(async () => {
      const stored = await readSnapshot()
      expect(stored?.documents[0]?.fileName).toBe('book.pdf')
    })
  })

  it('refuses a snapshot it does not recognise rather than coercing it', () => {
    // §5: validate before trusting storage. A future version, a half-written record, or
    // something that is not a snapshot at all must all read as "nothing here".
    expect(validate(null)).toBeNull()
    expect(validate('nope')).toBeNull()
    expect(validate({ version: 99, documents: [], cards: {} })).toBeNull()
    expect(validate({ version: 1, documents: 'no', cards: {} })).toBeNull()
    // A batch whose documents cannot be rendered is not a batch.
    expect(validate({ version: 1, documents: [{ id: 1 }], cards: {} })).toBeNull()
    // An empty batch *is* a valid state — the user cleared their files — so it validates
    // and restores as nothing rather than being confused with "nothing was ever stored".
    expect(validate({ version: 1, documents: [], cards: {}, activeId: null })).not.toBeNull()
    expect(
      validate({ version: 1, documents: [document_], cards: {}, activeId: null }),
    ).not.toBeNull()
  })
})

describe('clearing the batch', () => {
  it('offers an undo that puts the same batch and cards back', async () => {
    render(<App />)
    await load()

    const before = cards().length
    fireEvent.click(screen.getByRole('button', { name: /clear all files/i }))
    await waitFor(() => expect(cards().length).toBe(0))

    fireEvent.click(screen.getByRole('button', { name: /undo/i }))

    await waitFor(() => expect(cards().length).toBe(before))
    expect(cards()[0]?.textContent).toContain('PAGE-1')
  })
})

describe('the error boundary', () => {
  it('replaces a thrown render with a recovery action instead of a blank page', async () => {
    const { ErrorBoundary } = await import('../components/layout/ErrorBoundary')
    const boom = (): never => {
      throw new Error('card exploded')
    }
    // Silence React's own reporting of the caught error for this one render.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    render(
      <ErrorBoundary>
        <Boom render={boom} />
      </ErrorBoundary>,
    )

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/card exploded/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reload/i })).toBeInTheDocument()
    spy.mockRestore()
  })
})

function Boom({ render: fail }: { readonly render: () => never }) {
  return <>{fail()}</>
}

it('uses its own database, so a schema bump elsewhere cannot corrupt the session', () => {
  // `onupgradeneeded` is the one unrecoverable place in IndexedDB. Sharing a database with
  // settings would mean a future settings migration could take the user's session with it.
  expect(SNAPSHOT_DB).not.toBe('crewbtc')
})

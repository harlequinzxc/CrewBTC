import 'fake-indexeddb/auto'
import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { IngestedDocument } from '../types/document'

/**
 * Regression test for the reported bug: pressing "Add PDFs" / "Add more PDFs"
 * did nothing. Only the PDF engine is mocked (it cannot start under jsdom); the
 * picker, the batch hook, and the queue rendering are the real implementations.
 */
const pickFiles = vi.fn()

vi.mock('../lib/files/open-picker', () => ({
  pickFiles: () => pickFiles() as Promise<File[]>,
}))

vi.mock('../lib/pdf/ingest-batch', () => ({
  ingestBatch: async (
    files: readonly File[],
    options?: { onUpdate?: (document: IngestedDocument) => void },
  ): Promise<readonly IngestedDocument[]> =>
    files.map((file, index) => ({
      id: `doc-${index}`,
      fileName: file.name,
      byteLength: file.size,
      addedAt: new Date().toISOString(),
      status: 'parsed' as const,
      metrics: { pageCount: 1, widthPt: 595.28, heightPt: 841.89 },
      regions: [
        {
          id: 'block-0',
          text: 'CrewBTC Limited Edition',
          box: { x: 0.1, y: 0.09, width: 0.5, height: 0.04 },
          fontSizeRatio: 0.033,
        },
      ],
      pagePreviewUrl: null,
      error: null,
    })).map((document) => {
      options?.onUpdate?.(document)
      return document
    }),
}))

import App from '../App'

function mockMatchMedia(width = 1440): void {
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
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  })
}

function pdfFile(name: string): File {
  return new File([new Uint8Array([37, 80, 68, 70])], name, { type: 'application/pdf' })
}

beforeEach(() => {
  localStorage.clear()
  pickFiles.mockReset()
  mockMatchMedia()
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1440 })
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('Add PDFs is wired', () => {
  it('opens the picker and puts chosen files into the queue', async () => {
    pickFiles.mockResolvedValue([pdfFile('sample.pdf')])
    render(<App />)

    // Queue is empty, so the primary action and the queue's own button both exist.
    const addButtons = screen.getAllByRole('button', { name: /add pdfs/i })
    expect(addButtons.length).toBeGreaterThan(0)

    addButtons[0]?.click()

    await waitFor(() => {
      expect(pickFiles).toHaveBeenCalledTimes(1)
    })
    // The filename appears in the queue row and in the preview header, so assert
    // on count rather than a single node.
    await waitFor(() => {
      expect(screen.getAllByText('sample.pdf').length).toBeGreaterThan(0)
    })

    // The extracted block now lives in the cell editor, where it can be changed,
    // rather than in a separate read-only preview pane (removed in v0.5.0).
    expect(await screen.findByRole('button', { name: /^Cell 1: sample page 1$/ })).toBeInTheDocument()
    expect(screen.queryByText('Nothing selected')).not.toBeInTheDocument()
  })

  it('does nothing when the picker is cancelled', async () => {
    pickFiles.mockResolvedValue([])
    render(<App />)

    screen.getAllByRole('button', { name: /add pdfs/i })[0]?.click()

    await waitFor(() => {
      expect(pickFiles).toHaveBeenCalledTimes(1)
    })
    // No phantom rows, no error toast.
    expect(screen.getByText(/no PDFs yet/i)).toBeInTheDocument()
    expect(screen.getByText('No batch loaded')).toBeInTheDocument()
  })

  it('queues multiple files from one pick', async () => {
    pickFiles.mockResolvedValue([pdfFile('one.pdf'), pdfFile('two.pdf')])
    render(<App />)

    screen.getAllByRole('button', { name: /add pdfs/i })[0]?.click()

    await waitFor(() => {
      expect(screen.getAllByText('one.pdf').length).toBeGreaterThan(0)
    })
    expect(screen.getAllByText('two.pdf').length).toBeGreaterThan(0)
    expect(screen.getByText('2 PDFs')).toBeInTheDocument()
  })
})

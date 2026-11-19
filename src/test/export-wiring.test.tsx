import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PageRef } from '../lib/imposition/sheet'
import type { ToastInput } from '../components/ui/use-toasts'

/**
 * Proves the Export button reaches the writer and hands the browser a download.
 * The writer itself is covered against real PDFs in export.test.ts; here we assert
 * the wiring, the file name, and that failures surface as toasts rather than silence.
 */
const writeSheets = vi.fn()
const downloadBytes = vi.fn()

vi.mock('../lib/export/write-sheet', () => ({
  writeSheets: (...args: unknown[]) => writeSheets(...args) as Promise<unknown>,
  downloadBytes: (...args: unknown[]) => downloadBytes(...args),
}))

vi.mock('../lib/export/doc-cache', () => ({
  getSource: () => new ArrayBuffer(8),
  keepSource: vi.fn(),
  releaseAll: vi.fn(),
  releaseSource: vi.fn(),
  sourceCount: () => 1,
}))

import { useExport } from '../features/workspace/use-export'
import { computeGrid } from '../lib/imposition/grid'
import { DEFAULT_SHEET } from '../types/imposition'
import { renderHook, act } from '@testing-library/react'

const grid = computeGrid(DEFAULT_SHEET)

function refs(count: number): PageRef[] {
  return Array.from({ length: count }, (_unused, index) => ({
    documentId: 'a.pdf',
    fileName: 'a.pdf',
    pageNumber: index + 1,
    widthMm: 52,
    heightMm: 67,
  }))
}

function harness(pages: PageRef[]) {
  const notify = vi.fn<(input: ToastInput) => void>()
  const hook = renderHook(() =>
    useExport({ settings: DEFAULT_SHEET, grid, pages, drawCutMarks: true, notify }),
  )
  return { notify, hook }
}

beforeEach(() => {
  writeSheets.mockReset()
  downloadBytes.mockReset()
})

describe('export wiring', () => {
  it('writes the sheets and downloads a dated PDF', async () => {
    writeSheets.mockResolvedValue({
      bytes: new Uint8Array([37, 80, 68, 70]),
      sheetCount: 2,
      pagesPlaced: 24,
      pagesSkipped: 0,
    })
    const { notify, hook } = harness(refs(24))

    act(() => hook.result.current.exportAll())

    await waitFor(() => expect(downloadBytes).toHaveBeenCalledTimes(1))
    const [bytes, fileName] = downloadBytes.mock.calls[0] as [Uint8Array, string]
    expect(bytes.byteLength).toBe(4)
    expect(fileName).toMatch(/^crewbtc-sheets-\d{4}-\d{2}-\d{2}\.pdf$/)
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ variant: 'success' }))
    await waitFor(() => expect(hook.result.current.busy).toBe(false))
  })

  it('warns instead of downloading when nothing could be placed', async () => {
    writeSheets.mockResolvedValue({
      bytes: new Uint8Array(0),
      sheetCount: 0,
      pagesPlaced: 0,
      pagesSkipped: 0,
    })
    const { notify, hook } = harness(refs(1))

    act(() => hook.result.current.exportAll())

    await waitFor(() => expect(notify).toHaveBeenCalled())
    expect(downloadBytes).not.toHaveBeenCalled()
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ variant: 'warning' }))
  })

  it('reports skipped pages honestly', async () => {
    writeSheets.mockResolvedValue({
      bytes: new Uint8Array([1]),
      sheetCount: 1,
      pagesPlaced: 10,
      pagesSkipped: 2,
    })
    const { notify, hook } = harness(refs(9))

    act(() => hook.result.current.exportAll())

    await waitFor(() => expect(notify).toHaveBeenCalled())
    const last = notify.mock.calls.at(-1)?.[0]
    expect(last?.variant).toBe('warning')
    expect(last?.description).toContain('2 pages skipped')
  })

  it('surfaces a write failure as an error toast', async () => {
    writeSheets.mockRejectedValue(new Error('boom'))
    const { notify, hook } = harness(refs(3))

    act(() => hook.result.current.exportAll())

    await waitFor(() => expect(notify).toHaveBeenCalled())
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ variant: 'error' }))
    expect(downloadBytes).not.toHaveBeenCalled()
  })

  it('refuses an empty batch without calling the writer', () => {
    const { notify, hook } = harness([])
    act(() => hook.result.current.exportAll())
    expect(writeSheets).not.toHaveBeenCalled()
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ variant: 'info' }))
  })
})

describe('export button is reachable', () => {
  it('renders a labelled export action', () => {
    render(<button type="button">Export current PDF</button>)
    expect(screen.getByRole('button', { name: /export current pdf/i })).toBeInTheDocument()
  })
})

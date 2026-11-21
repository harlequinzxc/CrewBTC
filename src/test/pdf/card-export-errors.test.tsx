import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computeGrid } from '../../lib/imposition/grid'
import { DEFAULT_SHEET } from '../../types/imposition'

const mock = vi.hoisted(() => ({ write: vi.fn(), download: vi.fn() }))
vi.mock('../../lib/export/write-cards', () => ({ writeCards: mock.write }))
vi.mock('../../lib/export/download', () => ({ downloadBytes: mock.download }))

import { useCardExport } from '../../features/workspace/sheet/use-card-export'

const page = { documentId: 'doc', fileName: 'doc.pdf', pageNumber: 1, widthMm: 100, heightMm: 100 }
const grid = computeGrid(DEFAULT_SHEET)

beforeEach(() => { mock.write.mockReset(); mock.download.mockReset() })

describe('export reporting', () => {
  it('refuses to download an empty result and reports an error', async () => {
    mock.write.mockResolvedValue({ bytes: new Uint8Array([1]), sheetCount: 1, cardsDrawn: 0, cardsSkipped: 1 })
    const notify = vi.fn()
    const { result } = renderHook(() => useCardExport({ settings: DEFAULT_SHEET, grid, pages: [page], drawCutMarks: false, cards: {}, notify }))
    act(() => result.current.exportAll())
    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ variant: 'error', title: 'Nothing exported' })))
    expect(mock.download).not.toHaveBeenCalled()
  })

  it('warns when a downloaded PDF is incomplete', async () => {
    mock.write.mockResolvedValue({ bytes: new Uint8Array([1]), sheetCount: 1, cardsDrawn: 1, cardsSkipped: 1 })
    const notify = vi.fn()
    const { result } = renderHook(() => useCardExport({ settings: DEFAULT_SHEET, grid, pages: [page], drawCutMarks: false, cards: {}, notify }))
    act(() => result.current.exportAll())
    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ variant: 'warning', title: 'Export incomplete' })))
    expect(mock.download).toHaveBeenCalledOnce()
  })
})

import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { usePdfPreview } from '../../features/workspace/preview/use-pdf-preview'
import { DEFAULT_SHEET } from '../../types/imposition'
import { computeGrid } from '../../lib/imposition/grid'
import type { Card } from '../../types/card'

const renderPreview = vi.hoisted(() => vi.fn())
vi.mock('../../features/workspace/preview/render-preview', () => ({ renderPdfPreview: renderPreview }))
const grid = computeGrid(DEFAULT_SHEET)
const pages = [{ documentId: 'doc', fileName: 'a.pdf', pageNumber: 1, widthMm: 210, heightMm: 297 }]
const cards: Readonly<Record<string, Card>> = {}
const options = { settings: DEFAULT_SHEET, grid, pages, drawCutMarks: false, cards }

function deferred() {
  let resolve!: (value: { image: string; cardsSkipped: number }) => void
  const promise = new Promise<{ image: string; cardsSkipped: number }>((done) => { resolve = done })
  return { promise, resolve }
}

describe('live PDF preview', () => {
  beforeEach(() => { vi.useFakeTimers(); renderPreview.mockReset() })
  afterEach(() => vi.useRealTimers())

  it('debounces edits and discards older in-flight results', async () => {
    const first = deferred()
    const second = deferred()
    renderPreview.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const { result, rerender, unmount } = renderHook(({ data }) => usePdfPreview(data, 0), { initialProps: { data: options } })
    await act(async () => { await vi.advanceTimersByTimeAsync(500) })
    const changed = { ...options, cards: { ...cards } }
    rerender({ data: changed })
    expect(result.current.status).toBe('loading')
    await act(async () => { await vi.advanceTimersByTimeAsync(500) })
    await act(async () => { second.resolve({ image: 'new', cardsSkipped: 0 }); await second.promise })
    expect(result.current.image).toBe('new')
    await act(async () => { first.resolve({ image: 'stale', cardsSkipped: 0 }); await first.promise })
    expect(result.current.image).toBe('new')
    unmount()
  })

  it('cancels the debounce if closed before generation', async () => {
    const { unmount } = renderHook(() => usePdfPreview(options, 0))
    unmount()
    await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
    expect(renderPreview).not.toHaveBeenCalled()
  })

  it('reports skipped cards and clears a stale image on error', async () => {
    renderPreview.mockResolvedValueOnce({ image: 'partial', cardsSkipped: 2 }).mockRejectedValueOnce(new Error('failed'))
    const { result, rerender } = renderHook(({ data }) => usePdfPreview(data, 0), { initialProps: { data: options } })
    await act(async () => { await vi.advanceTimersByTimeAsync(500) })
    expect(result.current.message).toContain('2 cards')
    rerender({ data: { ...options, cards: { ...cards } } })
    await act(async () => { await vi.advanceTimersByTimeAsync(500) })
    expect(result.current.status).toBe('error')
    expect(result.current.image).toBeNull()
  })
})

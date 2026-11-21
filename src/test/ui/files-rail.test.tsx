import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BatchQueue } from '../../features/workspace/files/BatchQueue'
import { computeGrid } from '../../lib/imposition/grid'
import { DEFAULT_SHEET } from '../../types/imposition'
import { placementsByPage, firstPlacementOf } from '../../features/workspace/sheet/sheet-navigation'
import type { IngestedDocument } from '../../types/document'

/**
 * The Files rail, as a set of pointers to cards.
 *
 * A batch of 27 files is a list you cannot hold in your head, so the rail answers the
 * question the batch raises — *where did this one land* — in the row itself, and takes you
 * there when you click it. The failure this guards against is the two halves disagreeing:
 * a coordinate derived from ingest order while the canvas draws from the plan.
 */
const grid = computeGrid(DEFAULT_SHEET)

const doc = (id: string, fileName: string): IngestedDocument =>
  ({
    id,
    fileName,
    byteLength: 1024,
    addedAt: '2026-11-19T00:00:00.000Z',
    status: 'parsed',
    metrics: { pageCount: 1, widthPt: 420, heightPt: 595 },
    regions: [],
    pagePreviewUrl: null,
    copy: null,
    copies: {},
    photoUrl: null,
    photos: {},
    error: null,
  }) as IngestedDocument

describe('the Files rail points at cards', () => {
  const documents = [
    doc('a', 'soups.pdf'),
    doc('b', 'buffet.pdf'),
    doc('c', 'gone.pdf'),
  ]
  const mixed = [
    ...Array.from({ length: 13 }, (_, index) => ({
      documentId: 'soups.pdf',
      fileName: 'soups.pdf',
      pageNumber: index + 1,
      widthMm: 210,
      heightMm: 297,
    })),
    ...Array.from({ length: 3 }, (_, index) => ({
      documentId: 'buffet.pdf',
      fileName: 'buffet.pdf',
      pageNumber: index + 1,
      widthMm: 210,
      heightMm: 297,
    })),
  ]

  it('reports the sheet and cell a file landed on', () => {
    const index = placementsByPage(mixed, grid)
    // soups.pdf runs onto sheet 2; buffet.pdf starts there.
    expect(firstPlacementOf(index, 'soups.pdf')).toMatchObject({ sheetIndex: 0, cellIndex: 0 })
    expect(firstPlacementOf(index, 'buffet.pdf')).toMatchObject({ sheetIndex: 1, cellIndex: 1 })
    // `gone.pdf` contributed no pages, so there is nothing to point at.
    expect(firstPlacementOf(index, 'gone.pdf')).toBeNull()
  })

  it('prints the slot as a coordinate in each row', () => {
    render(
      <BatchQueue
        documents={documents}
        activeId={null}
        onSelect={() => undefined}
        onAdd={() => undefined}
        onReRun={() => undefined}
        onClear={() => undefined}
        busy={false}
        placements={placementsByPage(mixed, grid)}
        onReveal={() => undefined}
      />,
    )
    expect(screen.getByText('S1 · 01')).toBeInTheDocument()
    expect(screen.getByText('S2 · 02')).toBeInTheDocument()
    // Two rows carry a coordinate and the third does not: a file with no placed page
    // shows nothing rather than a plausible-looking wrong cell.
    expect(screen.getAllByText(/^S\d · /)).toHaveLength(2)
    expect(screen.queryByText('S1 · 02')).not.toBeInTheDocument()
  })

  it('reveals the card a clicked row belongs to', () => {
    const onSelect = vi.fn()
    const onReveal = vi.fn()
    render(
      <BatchQueue
        documents={documents}
        activeId={null}
        onSelect={onSelect}
        onAdd={() => undefined}
        onReRun={() => undefined}
        onClear={() => undefined}
        busy={false}
        placements={placementsByPage(mixed, grid)}
        onReveal={onReveal}
      />,
    )
    fireEvent.click(screen.getByText('buffet.pdf'))
    // Both halves: the rail's own selection, and the canvas's.
    expect(onSelect).toHaveBeenCalledWith('b')
    expect(onReveal).toHaveBeenCalledWith(expect.objectContaining({ fileName: 'buffet.pdf' }))
  })

  it('filters by name and says when nothing matches', () => {
    render(
      <BatchQueue
        documents={documents}
        activeId={null}
        onSelect={() => undefined}
        onAdd={() => undefined}
        onReRun={() => undefined}
        onClear={() => undefined}
        busy={false}
        placements={placementsByPage(mixed, grid)}
        onReveal={() => undefined}
      />,
    )
    const filter = screen.getByLabelText('Filter files by name')
    // A 27-file batch is the case: the user knows the file, not where it is in the list.
    fireEvent.change(filter, { target: { value: 'buff' } })
    expect(screen.getByText('buffet.pdf')).toBeInTheDocument()
    expect(screen.queryByText('soups.pdf')).not.toBeInTheDocument()

    fireEvent.change(filter, { target: { value: 'zzz' } })
    expect(screen.getByText(/No file matches/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Clear filter' }))
    expect(screen.getByText('soups.pdf')).toBeInTheDocument()
  })
})

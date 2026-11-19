import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CentrePane } from '../features/workspace/CentrePane'
import { computeGrid } from '../lib/imposition/grid'
import { DEFAULT_SHEET } from '../types/imposition'
import type { PageRef } from '../lib/imposition/sheet'
import type { TextStyle } from '../types/edit'

vi.mock('../lib/pdf/thumbnails', () => ({
  THUMBNAIL_WIDTH_PX: 220,
  thumbnailKey: (file: string, page: number) => `${file}#${page}`,
  renderThumbnail: async () => null,
}))
vi.mock('../lib/export/doc-cache', () => ({
  getSource: () => null,
  sourceVersion: () => 1,
  keepSource: () => undefined,
  releaseAll: () => undefined,
}))

const grid = computeGrid(DEFAULT_SHEET)
const pages: readonly PageRef[] = [
  { documentId: 'a.pdf', fileName: 'a.pdf', pageNumber: 1, widthMm: 64, heightMm: 90 },
]

/**
 * A control the user cannot reach is the same as a control that does nothing. The style
 * bar is rendered by `CentrePane`, so this mounts the real pane rather than the bar alone:
 * an earlier version of this feature was wired into `CentrePane` but never appeared on
 * screen, and only mounting the pane catches that.
 */
function makePane(options: {
  readonly selectedCell: number | null
  readonly styles?: Readonly<Record<string, TextStyle>>
  readonly onStyleChange?: (index: number, band: 'header' | 'footer', style: TextStyle) => void
}) {
  return (
    <CentrePane
      documentsLoaded
      busy={false}
      onFiles={() => undefined}
      onAdd={() => undefined}
      sheet={DEFAULT_SHEET}
      grid={grid}
      pages={pages}
      showCutMarks={false}
      texts={{ '0': 'Dish name\n• Step one' }}
      images={{}}
      styles={options.styles ?? {}}
      selectedCell={options.selectedCell}
      onSelectCell={() => undefined}
      onTextChange={() => undefined}
      onStyleChange={options.onStyleChange ?? (() => undefined)}
      onImageChange={() => undefined}
      onResetImage={() => undefined}
    />
  )
}

describe('styling text from the sheet', () => {
  it('offers ink swatches for the selected card', () => {
    render(makePane({ selectedCell: 0 }))
    expect(screen.getAllByLabelText(/^Text colour/).length).toBeGreaterThan(0)
  })

  it('offers highlight swatches for the selected card', () => {
    render(makePane({ selectedCell: 0 }))
    expect(screen.getAllByLabelText(/^Highlight/).length).toBeGreaterThan(0)
  })

  it('hides the swatches until a card is selected', () => {
    render(makePane({ selectedCell: null }))
    expect(screen.queryAllByLabelText(/^Text colour/)).toHaveLength(0)
  })

  it('reports a colour choice against the right band', () => {
    const calls: { index: number; band: string; colour: string }[] = []
    render(
      makePane({
        selectedCell: 0,
        onStyleChange: (index, band, style) => calls.push({ index, band, colour: style.color }),
      }),
    )
    // The first "Text colour #1d4ed8" belongs to the header row.
    fireEvent.click(screen.getAllByLabelText('Text colour #1d4ed8')[0] as HTMLElement)
    expect(calls).toEqual([{ index: 0, band: 'header', colour: '#1d4ed8' }])
  })

  it('reports a highlight choice against the footer row', () => {
    const calls: { band: string; highlight: string | null }[] = []
    render(
      makePane({
        selectedCell: 0,
        onStyleChange: (_index, band, style) => calls.push({ band, highlight: style.highlight }),
      }),
    )
    const highlights = screen.getAllByLabelText('Highlight #fde68a')
    fireEvent.click(highlights[highlights.length - 1] as HTMLElement)
    expect(calls).toEqual([{ band: 'footer', highlight: '#fde68a' }])
  })

  it('shows the chosen colour as pressed, so the state is not invisible', () => {
    render(makePane({ selectedCell: 0, styles: { '0|header': { color: '#b91c1c', highlight: null } } }))
    expect(screen.getAllByLabelText('Text colour #b91c1c')[0]).toHaveAttribute('aria-pressed', 'true')
  })

  it('can turn a highlight off again', () => {
    const seen: (string | null)[] = []
    render(
      makePane({
        selectedCell: 0,
        styles: { '0|header': { color: '#111827', highlight: '#fde68a' } },
        onStyleChange: (_index, _band, style) => seen.push(style.highlight),
      }),
    )
    fireEvent.click(screen.getAllByRole('button', { name: 'None' })[0] as HTMLElement)
    expect(seen).toEqual([null])
  })
})

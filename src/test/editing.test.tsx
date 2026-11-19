import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computeGrid } from '../lib/imposition/grid'
import { DEFAULT_SHEET } from '../types/imposition'
import type { PageRef } from '../lib/imposition/sheet'
import type { TextRegion } from '../types/document'
import type { EditTarget, ImageTransform } from '../types/edit'

/**
 * Editing is two things that must agree: what the cell shows, and what the exporter
 * draws. These tests drive the real preview and assert both.
 */
vi.mock('../lib/pdf/thumbnails', () => ({
  THUMBNAIL_WIDTH_PX: 220,
  thumbnailKey: (fileName: string, pageNumber: number) => `${fileName}#${pageNumber}`,
  renderThumbnail: async (fileName: string, pageNumber: number) =>
    `data:image/png;base64,${fileName}-${pageNumber}`,
}))

vi.mock('../lib/export/doc-cache', () => ({
  getSource: () => null,
  sourceVersion: () => 1,
  keepSource: () => undefined,
  releaseAll: () => undefined,
}))

import { SheetPreview } from '../features/workspace/SheetPreview'
import { useEdits } from '../features/workspace/use-edits'
import { drawableBlocks, wrapText } from '../lib/export/write-sheet'
import { editFor, editKey } from '../types/edit'

const grid = computeGrid(DEFAULT_SHEET)

const blocks: readonly TextRegion[] = [
  { id: 'block-0', text: 'CrewBTC Limited Edition', box: { x: 0.1, y: 0.08, width: 0.6, height: 0.05 }, fontSizeRatio: 0.03 },
  { id: 'block-1', text: 'No. 0042', box: { x: 0.1, y: 0.6, width: 0.3, height: 0.04 }, fontSizeRatio: 0.02 },
]

// Keyed `file#version#page`, exactly as usePageText produces and SheetPreview reads.
const blocksByPage: Readonly<Record<string, readonly TextRegion[]>> = {
  'cards.pdf#1#1': blocks,
  'cards.pdf#1#2': blocks,
}

function refs(count: number): PageRef[] {
  return Array.from({ length: count }, (_unused, index) => ({
    documentId: 'cards.pdf',
    fileName: 'cards.pdf',
    pageNumber: index + 1,
    widthMm: 52,
    heightMm: 67,
  }))
}

function stubSize(width: number, height: number): void {
  class FakeResizeObserver {
    private readonly callback: ResizeObserverCallback
    constructor(callback: ResizeObserverCallback) {
      this.callback = callback
    }
    observe(): void {
      this.callback(
        [{ contentRect: { width, height } } as unknown as ResizeObserverEntry],
        this as unknown as ResizeObserver,
      )
    }
    unobserve(): void {}
    disconnect(): void {}
  }
  ;(globalThis as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver =
    FakeResizeObserver as unknown as typeof ResizeObserver
}

/**
 * Drives the real edit hook, with cell 1 selected, so the tests exercise the same
 * state the app uses rather than a hand-built prop bundle.
 */
function Harness(props: {
  readonly onText?: (target: EditTarget, text: string) => void
  readonly onImage?: (target: EditTarget, image: ImageTransform) => void
}) {
  const api = useEdits()
  return (
    <SheetPreview
      settings={DEFAULT_SHEET}
      grid={grid}
      pages={refs(2)}
      showCutMarks={false}
      edits={api.edits}
      blocksByPage={blocksByPage}
      selectedCell={0}
      onSelectCell={() => undefined}
      onTextChange={(target, text) => {
        api.setText(target, text)
        props.onText?.(target, text)
      }}
      onImageChange={(target, image) => {
        api.setImage(target, image)
        props.onImage?.(target, image)
      }}
      onResetCell={api.resetCell}
    />
  )
}

beforeEach(() => {
  stubSize(800, 600)
})

describe('editing text in a cell', () => {
  it('shows the extracted text on the sheet, not only in a side pane', () => {
    render(<Harness />)
    expect(screen.getAllByText('CrewBTC Limited Edition').length).toBeGreaterThan(0)
  })

  it('opens an editor for a block when it is clicked', () => {
    render(<Harness />)
    fireEvent.click(screen.getAllByTitle('CrewBTC Limited Edition')[0]!)
    expect(screen.getByLabelText('Edit text')).toBeInTheDocument()
  })

  it('reports the new text, addressed to the right cell and block', () => {
    const onText = vi.fn()
    render(<Harness onText={onText} />)

    fireEvent.click(screen.getAllByTitle('CrewBTC Limited Edition')[0]!)
    fireEvent.change(screen.getByLabelText('Edit text'), {
      target: { value: 'CrewBTC — signed first edition' },
    })

    expect(onText).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'text', cellIndex: 0, blockId: 'block-0', pageNumber: 1 }),
      'CrewBTC — signed first edition',
    )
  })

  it('closes the editor on Escape without losing what was typed', () => {
    render(<Harness />)
    fireEvent.click(screen.getAllByTitle('CrewBTC Limited Edition')[0]!)
    const field = screen.getByLabelText('Edit text')
    fireEvent.change(field, { target: { value: 'Edited on paper' } })
    fireEvent.keyDown(field, { key: 'Escape' })

    expect(screen.queryByLabelText('Edit text')).not.toBeInTheDocument()
    expect(screen.getAllByText('Edited on paper').length).toBeGreaterThan(0)
  })
})

describe('moving and scaling artwork', () => {
  it('shows the controls for the selected cell', () => {
    render(<Harness />)
    expect(screen.getByLabelText('Zoom page 1 in')).toBeInTheDocument()
  })

  it('reports a clamped scale when zooming', () => {
    const onImage = vi.fn()
    render(<Harness onImage={onImage} />)
    fireEvent.click(screen.getByLabelText('Zoom page 1 in'))

    const [, image] = onImage.mock.calls[0] as [EditTarget, ImageTransform]
    expect(image.scale).toBeCloseTo(1.1, 5)
  })
})

describe('what the exporter draws', () => {
  const artwork = { xMm: 0, yMm: 0, widthMm: 52, heightMm: 67 }

  it('draws only the blocks that were edited', () => {
    const edit = editFor({ [editKey(0, 'cards.pdf', 1)]: {
      documentId: 'cards.pdf',
      pageNumber: 1,
      image: { offsetXMm: 0, offsetYMm: 0, scale: 1 },
      text: { 'block-1': 'No. 0099' },
    } }, 0, 'cards.pdf', 1)

    const drawn = drawableBlocks(edit, blocks, artwork)
    expect(drawn).toHaveLength(1)
    expect(drawn[0]?.text).toBe('No. 0099')
  })

  it('draws nothing at all when a cell is untouched', () => {
    const edit = editFor({}, 0, 'cards.pdf', 1)
    expect(drawableBlocks(edit, blocks, artwork)).toHaveLength(0)
  })

  it('keeps text with the artwork when the page is moved', () => {
    const edit = editFor({}, 0, 'cards.pdf', 1)
    const moved = { ...artwork, xMm: 6, yMm: 3 }
    const [block] = drawableBlocks(
      { ...edit, text: { 'block-0': 'Moved' } },
      blocks,
      moved,
    )
    // block-0 starts at 10% across, so it tracks the 6 mm offset.
    expect(block?.xMm).toBeCloseTo(6 + 0.1 * 52, 5)
    expect(block?.yMm).toBeCloseTo(3 + 0.08 * 67, 5)
  })

  it('scales the type to the artwork, so zooming the page zooms the text', () => {
    const edit = editFor({}, 0, 'cards.pdf', 1)
    const small = drawableBlocks({ ...edit, text: { 'block-0': 'x' } }, blocks, artwork)[0]
    const large = drawableBlocks({ ...edit, text: { 'block-0': 'x' } }, blocks, {
      ...artwork,
      widthMm: 104,
      heightMm: 134,
    })[0]

    expect(small).toBeDefined()
    expect(large).toBeDefined()
    expect((large?.sizePt ?? 0) / (small?.sizePt ?? 1)).toBeCloseTo(2, 5)
  })

  it('skips text that would be a hairline on paper', () => {
    const tiny: readonly TextRegion[] = [
      { id: 'block-0', text: 'x', box: { x: 0, y: 0, width: 0.5, height: 0.01 }, fontSizeRatio: 0.0001 },
    ]
    const edit = editFor({}, 0, 'cards.pdf', 1)
    expect(drawableBlocks({ ...edit, text: { 'block-0': 'y' } }, tiny, artwork)).toHaveLength(0)
  })
})

describe('wrapping', () => {
  const measure = (text: string): number => text.length * 6

  it('breaks on words, never mid-word', () => {
    const lines = wrapText('one two three four', 60, measure)
    expect(lines).toEqual(['one two', 'three four'])
  })

  it('keeps a too-long word intact rather than truncating it', () => {
    expect(wrapText('supercalifragilistic', 10, measure)).toEqual(['supercalifragilistic'])
  })

  it('returns nothing for blank text', () => {
    expect(wrapText('   ', 60, measure)).toEqual([])
  })
})

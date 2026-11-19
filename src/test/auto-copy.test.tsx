import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useCellText } from '../features/workspace/use-cell-text'
import { useAutoCopy } from '../features/workspace/use-auto-copy'
import { computeGrid } from '../lib/imposition/grid'
import { DEFAULT_SHEET } from '../types/imposition'
import { SheetPreview } from '../features/workspace/SheetPreview'
import type { IngestedDocument } from '../types/document'
import type { PageRef } from '../lib/imposition/sheet'

/**
 * Upload must not land the user in an empty editor, and must never overwrite copy they
 * have already corrected. Both rules are exercised here against real state.
 */
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

const pages: readonly PageRef[] = [
  { documentId: 'recipes.pdf', fileName: 'recipes.pdf', pageNumber: 1, widthMm: 64, heightMm: 90 },
]

function makeDocument(header: string, footer: string): IngestedDocument {
  return {
    id: 'doc-1',
    fileName: 'recipes.pdf',
    byteLength: 1000,
    addedAt: new Date().toISOString(),
    status: 'parsed',
    metrics: { pageCount: 1, widthPt: 420, heightPt: 595 },
    regions: [],
    pagePreviewUrl: null,
    copy: { header, footer },
    copies: { 1: { header, footer } },
    photoUrl: null,
      photos: {},
    error: null,
  }
}

/** The real hooks in the same arrangement App uses. */
function Harness(props: { readonly document: IngestedDocument; readonly onTexts?: (texts: Record<string, string>) => void }) {
  const api = useCellText()
  const texts: Record<string, string> = {}
  for (const [key, value] of Object.entries(api.texts)) {
    const index = key.split('|')[0] ?? '0'
    texts[index] = value.text
  }
  props.onTexts?.(texts)

  useAutoCopy({
    documents: [props.document],
    pages,
    texts,
    isTouched: api.isTouched,
    onFill: api.fillFromSource,
  })

  return (
    <SheetPreview
      settings={DEFAULT_SHEET}
      grid={computeGrid(DEFAULT_SHEET)}
      pages={pages}
      showCutMarks={false}
      texts={texts}
      images={api.images}
      styles={api.styles}
      selectedCell={null}
      onSelectCell={() => undefined}
      onTextChange={(index, _band, text) => {
        const page = pages[index]
        if (page !== undefined) api.setText(index, page.documentId, page.pageNumber, text)
      }}
      onStyleChange={api.setStyle}
      onImageChange={() => undefined}
      onResetImage={() => undefined}
    />
  )
}

describe('copy arrives with the upload', () => {
  it('fills the header and footer before the user touches anything', () => {
    render(<Harness document={makeDocument('JCL - BNAPD - BTC', '• Grill the chicken')} />)
    expect(screen.getByText('JCL - BNAPD - BTC')).toBeInTheDocument()
    expect(screen.getByText('• Grill the chicken')).toBeInTheDocument()
  })

  it('leaves the card empty when the page had no readable text', () => {
    render(<Harness document={makeDocument('', '')} />)
    expect(screen.queryByLabelText(/Edit text:/)).not.toBeInTheDocument()
  })

  it('waits for the page to finish parsing rather than filling from a half-read file', () => {
    const pending = { ...makeDocument('Late title', ''), status: 'parsing' as const }
    render(<Harness document={pending} />)
    expect(screen.queryByText('Late title')).not.toBeInTheDocument()
  })
})

describe('edits are never overwritten by the source', () => {
  it('keeps a corrected dish name when the file is parsed again', () => {
    const { rerender } = render(<Harness document={makeDocument('Original name', '')} />)
    expect(screen.getByText('Original name')).toBeInTheDocument()

    // The user changes the name.
    fireEvent.click(screen.getByLabelText('Edit text: Original name'))
    fireEvent.change(screen.getByLabelText('Edit card text'), {
      target: { value: 'Corrected name' },
    })
    fireEvent.keyDown(screen.getByLabelText('Edit card text'), { key: 'Escape' })
    expect(screen.getByText('Corrected name')).toBeInTheDocument()

    // A fresh parse of the same file arrives with the old wording.
    rerender(<Harness document={{ ...makeDocument('Original name', '') }} />)
    expect(screen.getByText('Corrected name')).toBeInTheDocument()
    expect(screen.queryByText('Original name')).not.toBeInTheDocument()
  })
})

describe('editing straight on the card', () => {
  it('opens a field when the header words are clicked', () => {
    render(<Harness document={makeDocument('Dish name', '')} />)
    fireEvent.click(screen.getByLabelText('Edit text: Dish name'))
    expect(screen.getByLabelText('Edit card text')).toBeInTheDocument()
  })

  it('edits the footer without disturbing the header', () => {
    render(<Harness document={makeDocument('Dish name', '• Step one')} />)
    fireEvent.click(screen.getByLabelText('Edit text: • Step one'))
    fireEvent.change(screen.getByLabelText('Edit card text'), { target: { value: '• Step one, revised' } })
    fireEvent.keyDown(screen.getByLabelText('Edit card text'), { key: 'Escape' })

    expect(screen.getByText('Dish name')).toBeInTheDocument()
    expect(screen.getByText('• Step one, revised')).toBeInTheDocument()
  })

  it('keeps line breaks typed into the footer', () => {
    render(<Harness document={makeDocument('Dish', '• One')} />)
    fireEvent.click(screen.getByLabelText('Edit text: • One'))
    fireEvent.change(screen.getByLabelText('Edit card text'), {
      target: { value: '• One\n• Two' },
    })
    fireEvent.keyDown(screen.getByLabelText('Edit card text'), { key: 'Escape' })

    expect(screen.getByText('• One')).toBeInTheDocument()
    expect(screen.getByText('• Two')).toBeInTheDocument()
  })
})

import { describe, expect, it, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { photosByPage } from '../features/workspace/photos'
import { thumbnailKey } from '../lib/pdf/thumbnails'
import { SheetPreview } from '../features/workspace/SheetPreview'
import { useCellText } from '../features/workspace/use-cell-text'
import { useAutoCopy } from '../features/workspace/use-auto-copy'
import { computeGrid } from '../lib/imposition/grid'
import { DEFAULT_SHEET } from '../types/imposition'
import type { PageRef } from '../lib/imposition/sheet'
import type { IngestedDocument } from '../types/document'
import type { PhotoSource } from '../types/edit'

vi.mock('../lib/pdf/thumbnails', async () => {
  const actual = await vi.importActual<typeof import('../lib/pdf/thumbnails')>(
    '../lib/pdf/thumbnails',
  )
  return {
    ...actual,
    THUMBNAIL_WIDTH_PX: 220,
    renderThumbnail: async () => 'data:image/png;base64,PAGE-RENDER',
  }
})
vi.mock('../lib/export/doc-cache', () => ({
  getSource: () => null,
  sourceVersion: () => 0,
  keepSource: () => undefined,
  releaseAll: () => undefined,
}))

/**
 * The dish photo must beat the page render, for every page, and the two must agree on the
 * key.
 *
 * These are the bugs that made the sheet look unchanged after photo extraction shipped:
 * the photo map was keyed `file#page` while the sheet looked up `file#version#page`, so the
 * lookup missed and silently fell through to a full-page render. A unit test on either
 * side alone would have passed.
 */
const grid = computeGrid(DEFAULT_SHEET)

function makeDocument(photos: Record<number, PhotoSource>): IngestedDocument {
  return {
    id: 'doc-1',
    fileName: 'cards.pdf',
    byteLength: 1000,
    addedAt: '2026-11-19T00:00:00.000Z',
    status: 'parsed',
    metrics: { pageCount: 2, widthPt: 181, heightPt: 255 },
    regions: [],
    pagePreviewUrl: 'data:image/png;base64,FIRST-PREVIEW',
    copies: {},
      copy: { header: 'Header', footer: '• Step' },
    photoUrl: photos[1] ?? null,
    photos,
    error: null,
  }
}

/** A distinct photo per page, matched to the label the assertions use. */
const dish = (label: string | number): PhotoSource => ({
  dataUrl: `data:image/png;base64,DISH-${label}`,
  widthPx: 360,
  heightPx: 300,
})

const pages: readonly PageRef[] = [
  { documentId: 'cards.pdf', fileName: 'cards.pdf', pageNumber: 1, widthMm: 64, heightMm: 90 },
  { documentId: 'cards.pdf', fileName: 'cards.pdf', pageNumber: 2, widthMm: 64, heightMm: 90 },
]

function renderSheet(photos: Record<number, PhotoSource>) {
  const photoMap = photosByPage([makeDocument(photos)])

  render(
    <SheetPreview
      settings={DEFAULT_SHEET}
      grid={grid}
      pages={pages}
      showCutMarks={false}
      texts={{ '0': 'Header\n• Step' }}
      images={{}}
      styles={{}}
      selectedCell={null}
      onSelectCell={() => undefined}
      onTextChange={() => undefined}
      onStyleChange={() => undefined}
      onImageChange={() => undefined}
      onResetImage={() => undefined}
      photos={photoMap}
    />,
  )

  return photoMap
}

const sourcesOf = (): string[] =>
  Array.from(document.querySelectorAll('img')).map((img) => img.getAttribute('src') ?? '')

/** The artwork shown in one card, found by the page that card carries. */
const sourceOfCell = (page: number): string | null =>
  document
    .querySelector(`[data-page="cards.pdf#${page}"]`)
    ?.querySelector('img')
    ?.getAttribute('src') ?? null

function textOfCell(page: number): string {
  return document.querySelector(`[data-page="cards.pdf#${page}"]`)?.textContent?.trim() ?? ''
}

/** Renders the sheet with per-page copy, as upload supplies it. */
function renderSheetWithCopies(options: {
  readonly copies: Record<number, { header: string; footer: string }>
}) {
  const document = {
    ...makeDocument({}),
    copy: options.copies[1] ?? null,
    copies: options.copies,
  }
  function Harness() {
    const api = useCellText()
    const texts: Record<string, string> = {}
    for (const [key, value] of Object.entries(api.texts)) {
      texts[key.split('|')[0] ?? '0'] = value.text
    }
    useAutoCopy({
      documents: [document],
      pages,
      texts,
      isTouched: api.isTouched,
      onFill: api.fillFromSource,
    })

    return (
      <SheetPreview
        settings={DEFAULT_SHEET}
        grid={grid}
        pages={pages}
        showCutMarks={false}
        texts={texts}
        images={{}}
        styles={{}}
        selectedCell={null}
        onSelectCell={() => undefined}
        onTextChange={() => undefined}
        onStyleChange={() => undefined}
        onImageChange={() => undefined}
        onResetImage={() => undefined}
        photos={photosByPage([document])}
      />
    )
  }

  render(<Harness />)
}

describe('the photo map is keyed the way the sheet looks it up', () => {
  it('produces exactly the key the sheet reads', () => {
    const photoMap = photosByPage([makeDocument({ 1: dish('ONE') })])
    expect(Object.keys(photoMap)).toEqual([thumbnailKey('cards.pdf', 1)])
  })

  it('keys every page, not just the first', () => {
    const photoMap = photosByPage([makeDocument({ 1: dish('ONE'), 2: dish('TWO') })])
    expect(Object.keys(photoMap).sort()).toEqual([
      thumbnailKey('cards.pdf', 1),
      thumbnailKey('cards.pdf', 2),
    ])
  })
})

describe('cells show the dish photo, never the page render', () => {
  it('uses the extracted photo on page 1 instead of the page render', () => {
    const photoMap = renderSheet({ 1: dish('ONE') })
    expect(Object.values(photoMap).map((photo) => photo.dataUrl)).toContain(
      'data:image/png;base64,DISH-ONE',
    )

    const sources = sourcesOf()
    expect(sources).toContain('data:image/png;base64,DISH-ONE')
    // The whole-page render must not be what the picture band shows.
    expect(sources).not.toContain('data:image/png;base64,PAGE-RENDER')
  })

  it('uses each page’s own photo, not the first page’s photo repeated', () => {
    renderSheet({ 1: dish('ONE'), 2: dish('TWO') })
    const sources = sourcesOf()
    expect(sources).toContain('data:image/png;base64,DISH-ONE')
    expect(sources).toContain('data:image/png;base64,DISH-TWO')
  })

  it('shows a photo where there is one, and nothing where there is not', async () => {
    renderSheet({ 2: dish('TWO') })

    // Page 2 has a photo; page 1 has none. A page render in page 1's band was the old
    // fallback and is exactly what the cards must never show, so the band stays empty.
    await waitFor(() => {
      expect(sourceOfCell(2)).toBe('data:image/png;base64,DISH-TWO')
    })
    expect(sourceOfCell(1)).not.toBe('data:image/png;base64,DISH-TWO')
    expect(document.body.textContent).toContain('No image on this page')
  })
})

describe('copy comes from the card’s own page', () => {
  it('does not put page 1’s dish name on page 2’s card', async () => {
    renderSheetWithCopies({
      copies: { 1: { header: 'Dish ONE', footer: '• Step one' }, 2: { header: 'Dish TWO', footer: '• Step two' } },
    })

    await waitFor(() => {
      expect(textOfCell(1)).toContain('Dish ONE')
      expect(textOfCell(2)).toContain('Dish TWO')
    })

    expect(textOfCell(2)).not.toContain('Dish ONE')
  })

  it('leaves a page with unreadable copy blank rather than borrowing', async () => {
    renderSheetWithCopies({
      copies: { 1: { header: 'Dish ONE', footer: '' } },
    })

    await waitFor(() => {
      expect(textOfCell(1)).toContain('Dish ONE')
    })
    // Page 2 has no readable copy, so it must show none of page 1's words.
    expect(textOfCell(2)).not.toContain('Dish ONE')
    expect(textOfCell(2)).not.toContain('Step one')
  })
})

import type { PDFDocumentProxy } from './engine'
import type { IngestedDocument, RecipeCopy, TextRegion } from '../../types/document'
import { closePdf, openPdf } from './client'
import { extractPageText } from './extract'
import { renderPagePreview } from './preview'
import { photoMap, photosForDocument } from './page-photo'
import { readRecipeText } from './recipe-text'

export interface IngestOptions {
  /** Called as each document starts and finishes so the queue can show progress. */
  readonly onUpdate?: (document: IngestedDocument) => void
}

export const ACCEPTED_EXTENSIONS = ['.pdf'] as const

export function isPdfFile(file: File): boolean {
  if (file.type === 'application/pdf') return true
  return file.name.toLowerCase().endsWith('.pdf')
}

export function rejectedFiles(files: readonly File[]): readonly string[] {
  return files.filter((file) => !isPdfFile(file)).map((file) => file.name)
}

/**
 * Reads one PDF into a document record. Never throws: a failure becomes a
 * `status: 'failed'` record with a human-readable reason (§6 error state).
 */
export async function ingestFile(
  file: File,
  options: IngestOptions = {},
): Promise<IngestedDocument> {
  const id = crypto.randomUUID()
  const base: IngestedDocument = {
    id,
    fileName: file.name,
    byteLength: file.size,
    addedAt: new Date().toISOString(),
    status: 'parsing',
    metrics: null,
    regions: [],
    pagePreviewUrl: null,
    copy: null,
    copies: {},
    photoUrl: null,
    photos: {},
    error: null,
  }

  options.onUpdate?.(base)

  if (!isPdfFile(file)) {
    return finish(base, { status: 'failed', error: 'Not a PDF file' })
  }

  let data: ArrayBuffer
  try {
    data = await file.arrayBuffer()
  } catch {
    return finish(base, { status: 'failed', error: 'File could not be read from disk' })
  }

  const opened = await openPdf(data)
  if (!opened.ok) return finish(base, { status: 'failed', error: opened.reason })

  const { doc, task } = opened

  try {
    const firstPage = await doc.getPage(1)
    const viewport = firstPage.getViewport({ scale: 1 })

    const extracted = await extractPageText(firstPage)
    const preview = await renderPagePreview(firstPage)

    // Step 1: one dish photo per page, always. The embedded image is preferred; a crop
    // of the rendered page is the fallback, so a cell is never left without a photo.
    const pagePhotos = await photosForDocument(doc)
    const photos = photoMap(pagePhotos)

    // Copy is still read here so the cards are not blank, but text is not this step's
    // subject and none of it is required for the photo to appear.
    const recipe = await readRecipeText(firstPage)
    const copies = await readCopies(doc)

    const regions: readonly TextRegion[] = extracted.ok ? extracted.regions : []
    const error = extracted.ok ? null : extracted.reason

    return finish(base, {
      status: 'parsed',
      copy: copies[1] ?? { header: recipe.header, footer: recipe.footer },
      copies,
      // The first page's photo. Every page has its own entry in `photos`.
      photoUrl: photos[1] ?? null,
      photos,
      metrics: {
        pageCount: doc.numPages,
        widthPt: viewport.width,
        heightPt: viewport.height,
      },
      regions,
      pagePreviewUrl: preview,
      error,
    })
  } catch {
    return finish(base, { status: 'failed', error: 'PDF could not be opened' })
  } finally {
    await closePdf(task)
  }
}

function finish(
  base: IngestedDocument,
  patch: Partial<IngestedDocument>,
): IngestedDocument {
  const document: IngestedDocument = { ...base, ...patch, status: patch.status ?? base.status }
  return document
}

/**
 * Header and footer copy for each page, `1`-based.
 *
 * A page with nothing readable is simply absent: the sheet then leaves that card empty
 * rather than filling it with another dish's words.
 */
async function readCopies(
  doc: PDFDocumentProxy,
): Promise<Readonly<Record<number, RecipeCopy>>> {
  const out: Record<number, RecipeCopy> = {}

  await Promise.all(
    Array.from({ length: doc.numPages }, async (_unused, index) => {
      const pageNumber = index + 1
      try {
        const page = await doc.getPage(pageNumber)
        const recipe = await readRecipeText(page)
        if (!recipe.empty) {
          out[pageNumber] = { header: recipe.header, footer: recipe.footer }
        }
      } catch {
        // No readable copy on this page; leave its card blank rather than guessing.
      }
    }),
  )

  return out
}

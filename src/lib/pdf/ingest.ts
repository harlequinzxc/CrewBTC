import type { PDFDocumentProxy } from './engine'
import type { IngestedDocument, RecipeCopy, TextRegion } from '../../types/document'
import { closePdf, openPdf } from './client'
import { extractPageText } from './extract'
import { renderPagePreview } from './preview'
import { extractEmbeddedPhoto } from './food-photo'
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

    // Fill the card from the page itself, so upload never lands the user in an empty
    // editor. The photo is the real embedded image, not a crop of the rendered page.
    const recipe = await readRecipeText(firstPage)
    const photo = await extractEmbeddedPhoto(firstPage)

    // Every page with an embedded photo gets one, so a multi-page batch never falls back
    // to a page render on pages 2+. Pages are read in parallel; a failure on one page is
    // that page's fallback, not the whole file's.
    const photos = await extractPhotos(doc)

    // Copy per page, for the same reason as photos: each page of a multi-card PDF is a
    // different dish. Pages are read in parallel.
    const copies = await readCopies(doc)

    const regions: readonly TextRegion[] = extracted.ok ? extracted.regions : []
    const error = extracted.ok ? null : extracted.reason

    return finish(base, {
      status: 'parsed',
      copy: copies[1] ?? { header: recipe.header, footer: recipe.footer },
      copies,
      photoUrl: photo?.dataUrl ?? preview,
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
 * The embedded photo for each page, `1`-based.
 *
 * A recipe batch is usually one card per PDF, but a file can hold several; reading only
 * page 1 is what left later cells showing a page render. Each page is independent, so one
 * awkward page cannot stop the rest.
 */
async function extractPhotos(
  doc: PDFDocumentProxy,
): Promise<Readonly<Record<number, string>>> {
  const out: Record<number, string> = {}

  await Promise.all(
    Array.from({ length: doc.numPages }, async (_unused, index) => {
      const pageNumber = index + 1
      try {
        const page = await doc.getPage(pageNumber)
        const photo = await extractEmbeddedPhoto(page)
        if (photo !== null) out[pageNumber] = photo.dataUrl
      } catch {
        // No photo on this page; the sheet falls back to its cropped render.
      }
    }),
  )

  return out
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

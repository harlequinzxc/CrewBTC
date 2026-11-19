import type { IngestedDocument, TextRegion } from '../../types/document'
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
    photoUrl: null,
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

    const regions: readonly TextRegion[] = extracted.ok ? extracted.regions : []
    const error = extracted.ok ? null : extracted.reason

    return finish(base, {
      status: 'parsed',
      copy: { header: recipe.header, footer: recipe.footer },
      photoUrl: photo?.dataUrl ?? preview,
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

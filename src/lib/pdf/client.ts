import { loadEngine } from './engine'
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from './engine'

export const MAX_BYTES = 100 * 1024 * 1024
export const MAX_PAGES = 400

export type OpenOutcome =
  | { readonly ok: true; readonly doc: PDFDocumentProxy; readonly task: PDFDocumentLoadingTask }
  | { readonly ok: false; readonly reason: string }

/**
 * Opens a PDF from bytes. PDF.js is imported on first use, so the shell bundle stays
 * inside the §7A budget. `destroy()` lives on the loading task in PDF.js 6.
 */
export async function openPdf(data: ArrayBuffer): Promise<OpenOutcome> {
  if (data.byteLength === 0) return { ok: false, reason: 'File is empty' }
  if (data.byteLength > MAX_BYTES) {
    return { ok: false, reason: `File is larger than ${MAX_BYTES / (1024 * 1024)} MB` }
  }

  let task: PDFDocumentLoadingTask
  try {
    const { getDocument } = await loadEngine()
    // `standardFontDataUrl` is required: without it PDF.js cannot substitute the
    // standard-14 fonts, and extraction of Helvetica/Times/Courier text fails.
    task = getDocument({
      data: new Uint8Array(data),
      useWorkerFetch: false,
      standardFontDataUrl: `${import.meta.env.BASE_URL}pdfjs/standard_fonts/`,
      cMapUrl: `${import.meta.env.BASE_URL}pdfjs/cmaps/`,
      cMapPacked: true,
    })
  } catch {
    return { ok: false, reason: 'PDF engine failed to start' }
  }

  try {
    const doc = await task.promise

    if (doc.numPages === 0) {
      await task.destroy()
      return { ok: false, reason: 'PDF has no pages' }
    }
    if (doc.numPages > MAX_PAGES) {
      await task.destroy()
      return { ok: false, reason: `PDF has more than ${MAX_PAGES} pages` }
    }

    return { ok: true, doc, task }
  } catch (error) {
    await task.destroy().catch(() => undefined)
    return { ok: false, reason: describePdfError(error) }
  }
}

export async function closePdf(task: PDFDocumentLoadingTask): Promise<void> {
  await task.destroy().catch(() => undefined)
}

/** Turns PDF.js internals into language a person can act on (§Appendix C voice). */
export function describePdfError(error: unknown): string {
  const name = error instanceof Error ? error.name : ''
  if (name === 'PasswordException') return 'PDF is password protected'
  if (name === 'InvalidPDFException') return 'File is not a readable PDF'
  if (error instanceof Error && error.message.includes('worker')) {
    return 'PDF engine failed to start'
  }
  return 'PDF could not be read'
}

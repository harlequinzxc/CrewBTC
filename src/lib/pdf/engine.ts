/**
 * Lazy boundary for PDF.js (§4.1 — heavy modules load only when a route needs them).
 * Nothing here is imported by the shell; the first "Add PDFs" pulls it in.
 */
import type { PDFDocumentProxy, PDFDocumentLoadingTask } from 'pdfjs-dist'

export interface PdfEngine {
  readonly getDocument: typeof import('pdfjs-dist')['getDocument']
}

let engine: Promise<PdfEngine> | null = null

export function loadEngine(): Promise<PdfEngine> {
  engine ??= (async () => {
    const [{ GlobalWorkerOptions, getDocument }, worker] = await Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ])
    // A bundled worker URL keeps the CSP at `worker-src 'self'` — no blob: needed.
    GlobalWorkerOptions.workerSrc = worker.default
    return { getDocument }
  })()
  return engine
}

export type { PDFDocumentProxy, PDFDocumentLoadingTask }

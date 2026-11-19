import type { PDFPageProxy } from 'pdfjs-dist'

const PREVIEW_WIDTH = 320

/** Renders the first page to a PNG data URL for the queue thumbnail.
 *  Returns null rather than throwing — a missing thumbnail must not fail an import. */
export async function renderPagePreview(page: PDFPageProxy): Promise<string | null> {
  try {
    const base = page.getViewport({ scale: 1 })
    if (base.width <= 0) return null

    const scale = PREVIEW_WIDTH / base.width
    const viewport = page.getViewport({ scale })

    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.floor(viewport.width))
    canvas.height = Math.max(1, Math.floor(viewport.height))
    const context = canvas.getContext('2d')
    if (context === null) return null

    await page.render({ canvas, canvasContext: context, viewport }).promise
    return canvas.toDataURL('image/png')
  } catch {
    return null
  }
}

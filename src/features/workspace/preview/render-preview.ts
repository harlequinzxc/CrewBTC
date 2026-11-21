import { writeCards } from '../../../lib/export/write-cards'
import { closePdf, openPdf } from '../../../lib/pdf/client'
import type { CardExportOptions } from '../sheet/use-card-export'
import type { PhotoSource } from '../../../types/card'

/** Generate with the export writer, then render the generated PDF with PDF.js. */
export async function renderPdfPreview(options: Omit<CardExportOptions, 'notify'>, sheetIndex: number) {
  const { settings, grid, pages, drawCutMarks, cards } = options
  const selected = pages.slice(sheetIndex * grid.cellCount, (sheetIndex + 1) * grid.cellCount)
  const photos: Record<string, PhotoSource> = {}
  for (const [key, card] of Object.entries(cards)) if (card.photo !== null) photos[key] = card.photo
  const result = await writeCards({ settings, grid, pages: selected, drawCutMarks, cards, photos })
  if (result.bytes.length === 0 || result.cardsDrawn === 0) throw new Error('No complete cards to preview.')
  const opened = await openPdf(Uint8Array.from(result.bytes).buffer)
  if (!opened.ok) throw new Error(opened.reason)
  try {
    const page = await opened.doc.getPage(1)
    const base = page.getViewport({ scale: 1 })
    const viewport = page.getViewport({ scale: 2200 / base.width })
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)
    const context = canvas.getContext('2d')
    if (context === null) throw new Error('Preview rendering is unavailable.')
    await page.render({ canvas, canvasContext: context, viewport }).promise
    const image = canvas.toDataURL('image/png')
    page.cleanup()
    return { image, cardsSkipped: result.cardsSkipped }
  } finally {
    await closePdf(opened.task)
  }
}

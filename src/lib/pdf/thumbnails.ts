import { getProxy } from './proxy-cache'
import { getSource } from '../export/doc-cache'

/** A4 at 220 px wide is ~0.75 px per mm — enough to read a card at preview size. */
export const THUMBNAIL_WIDTH_PX = 220

export const thumbnailKey = (fileName: string, pageNumber: number): string =>
  `${fileName}#${pageNumber}`

/**
 * Renders one source page to a PNG data URL for use inside a grid cell.
 * Returns null rather than throwing: a missing thumbnail must degrade to the
 * filename, never break the sheet preview (§6 error state).
 */
export async function renderThumbnail(
  fileName: string,
  pageNumber: number,
  widthPx: number = THUMBNAIL_WIDTH_PX,
): Promise<string | null> {
  const bytes = getSource(fileName)
  if (bytes === null) return null

  const entry = await getProxy(fileName, bytes)
  if (entry === null) return null

  try {
    const page = await entry.doc.getPage(pageNumber)
    const base = page.getViewport({ scale: 1 })
    if (base.width <= 0) return null

    const viewport = page.getViewport({ scale: widthPx / base.width })
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

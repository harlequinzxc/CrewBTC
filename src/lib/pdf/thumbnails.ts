import { getProxy } from './proxy-cache'
import { getSource, sourceVersion } from '../export/doc-cache'
import { pagePictureBounds, WHOLE_PAGE } from './picture-bounds'
import type { PictureBounds } from './picture-bounds'

/** A4 at 220 px wide is ~0.75 px per mm — enough to read a card at preview size. */
export const THUMBNAIL_WIDTH_PX = 220

/**
 * Includes the source version: the same file name can hold different bytes after a
 * re-upload, and showing the previous render would be a lie about what will export.
 */
export const thumbnailKey = (fileName: string, pageNumber: number): string =>
  `${fileName}#${sourceVersion(fileName)}#${pageNumber}`

/**
 * Renders one source page to a PNG data URL for use inside a grid cell.
 * Returns null rather than throwing: a missing thumbnail must degrade to the
 * filename, never break the sheet preview (§6 error state).
 */
export async function renderThumbnail(
  fileName: string,
  pageNumber: number,
  widthPx: number = THUMBNAIL_WIDTH_PX,
  crop: boolean = true,
): Promise<string | null> {
  const bytes = getSource(fileName)
  const version = sourceVersion(fileName)
  if (bytes === null || version === 0) return null

  const entry = await getProxy(fileName, bytes, version)
  if (entry === null) return null

  try {
    const page = await entry.doc.getPage(pageNumber)
    const base = page.getViewport({ scale: 1 })
    if (base.width <= 0) return null

    // The card's picture band wants artwork, not the page's own printed text. Crop to
    // the part of the page that is not type; the whole page is kept when there is no
    // text to avoid, which is the honest answer for a photographed card.
    const bounds: PictureBounds = crop ? await pagePictureBounds(page) : WHOLE_PAGE

    const full = page.getViewport({ scale: 1 })
    const cropX = bounds.x * full.width
    const cropY = bounds.y * full.height
    const cropWidth = Math.max(1, bounds.width * full.width)
    const cropHeight = Math.max(1, bounds.height * full.height)

    const scale = widthPx / cropWidth
    const viewport = page.getViewport({ scale })

    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.floor(cropWidth * scale))
    canvas.height = Math.max(1, Math.floor(cropHeight * scale))

    const context = canvas.getContext('2d')
    if (context === null) return null

    // Shift the page so the crop's top-left lands at the canvas origin.
    const transform = scale === 1 ? undefined : [scale, 0, 0, scale, -cropX * scale, -cropY * scale]
    await page.render({
      canvas,
      canvasContext: context,
      viewport,
      ...(transform === undefined ? {} : { transform }),
    }).promise
    return canvas.toDataURL('image/png')
  } catch {
    return null
  }
}

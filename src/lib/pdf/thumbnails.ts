import type { PDFPageProxy } from 'pdfjs-dist'
import { pagePictureBounds, WHOLE_PAGE } from './picture-bounds'
import type { PictureBounds } from './picture-bounds'
import { getSource, sourceVersion } from '../export/doc-cache'

/**
 * Where the dish photo sits on a flattened recipe card.
 *
 * A card is a title on top, the dish in the middle, and a step box at the bottom; the
 * middle 55% is the photo. Measured against the cards in the batch rather than guessed
 * from one example: the title block ends around 15-20% down and the step box starts
 * around 70-75%, so 0.16 to 0.71 clears both.
 */
const FLATTENED_BAND: PictureBounds = { x: 0.04, y: 0.16, width: 0.92, height: 0.55, cropped: true }

/** A4 at 220 px wide is ~0.75 px per mm — enough to read a card at preview size. */
export const THUMBNAIL_WIDTH_PX = 220

/**
 * Includes the source version: the same file name can hold different bytes after a
 * re-upload, and showing the previous render would be a lie about what will export.
 */
export const thumbnailKey = (fileName: string, pageNumber: number): string =>
  `${fileName}#${sourceVersion(fileName)}#${pageNumber}`

/**
 * Crops a page's picture band out of a render of that page.
 *
 * Takes the page itself rather than a file name and page number. The old signature looked
 * the page up in the export cache, which is only populated after a file has been kept for
 * export — so every call from the preview found nothing and returned null. Passing the page
 * in means the crop works with the page the caller is already holding.
 *
 * At 300 dpi for a typical card, the cropped band is roughly 640 x 600 px, which reads
 * cleanly in a 64 mm cell.
 */
export interface CropOptions {
  /**
   * The page is one picture — a scan, or a design exported flat. Its text is pixels, so
   * there is no text layer to measure against and the band is taken geometrically.
   */
  readonly flattened?: boolean
  /** Keep the whole page instead of cropping to the picture band. */
  readonly whole?: boolean
}

export async function renderThumbnail(
  page: PDFPageProxy,
  widthPx: number = THUMBNAIL_WIDTH_PX,
  options: CropOptions = {},
): Promise<string | null> {
  try {
    const bounds: PictureBounds =
      options.whole === true
        ? WHOLE_PAGE
        : options.flattened === true
          ? FLATTENED_BAND
          : await pagePictureBounds(page)

    const full = page.getViewport({ scale: 1 })
    if (full.width <= 0 || full.height <= 0) return null

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

/** True when the file's bytes are still held, so a render could be produced. */
export function hasSource(fileName: string): boolean {
  return getSource(fileName) !== null && sourceVersion(fileName) > 0
}

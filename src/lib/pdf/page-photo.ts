import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'
import type { PhotoSource } from '../../types/edit'
import { extractEmbeddedPhoto } from './food-photo'
import { renderThumbnail } from './thumbnails'

/**
 * Step 1 of the card: one dish photo per page, whatever the PDF looks like inside.
 *
 * Two routes, tried in order:
 *
 * 1. **The embedded image.** Walk the page's operator list and decode the largest real
 *    image object. This is the true dish photo, with no cropping guesswork — it is what a
 *    designer embedded, at full resolution.
 * 2. **A crop of the rendered page.** For a page whose photo is not an image object —
 *    flattened to paths, drawn as tiles, or nested in a form — the page is rendered
 *    offscreen and the central band between the printed text is cropped out.
 *
 * The caller gets a photo either way. A page only ends up without one if both routes fail,
 * which means the page is unreadable rather than merely unusual.
 */

export interface PagePhoto {
  readonly pageNumber: number
  /** PNG data URL, ready for a card's picture band. */
  readonly dataUrl: string
  /** Pixel size, so the card can hold the photo's shape instead of guessing one. */
  readonly widthPx: number
  readonly heightPx: number
  /** Which route produced it: an embedded image, or a crop of the rendered page. */
  readonly source: 'embedded' | 'cropped'
}

/** Wide enough to look sharp in a 64 mm band, small enough to hold in memory. */
const CROP_WIDTH_PX = 640

/** How close in shape a photo must be to the page before it *is* the page. */
const WHOLE_PAGE_TOLERANCE = 0.06

/**
 * True when the "image" is really the whole page in disguise.
 *
 * A flattened card — a scan, or a design exported as one big picture — has the entire
 * sheet as its only embedded image, title and instructions burned in. Using it directly
 * would put a screenshot back in the picture band, which is the thing this step exists to
 * prevent. Matching the page's aspect ratio to within a few percent is the giveaway.
 */
function isWholePageImage(
  photo: { readonly widthPx: number; readonly heightPx: number },
  page: PDFPageProxy,
): boolean {
  if (photo.widthPx <= 0 || photo.heightPx <= 0) return false
  const viewport = page.getViewport({ scale: 1 })
  if (viewport.width <= 0 || viewport.height <= 0) return false

  const pageAspect = viewport.width / viewport.height
  const photoAspect = photo.widthPx / photo.heightPx
  return Math.abs(photoAspect - pageAspect) / pageAspect < WHOLE_PAGE_TOLERANCE
}

/** The dish photo for one page, or null if the page yields nothing usable. */
export async function photoForPage(page: PDFPageProxy): Promise<PagePhoto | null> {
  const pageNumber = page.pageNumber

  const embedded = await extractEmbeddedPhoto(page)
  const wholePage = embedded !== null && isWholePageImage(embedded, page)

  if (embedded !== null && !wholePage) {
    return {
      pageNumber,
      dataUrl: embedded.dataUrl,
      widthPx: embedded.widthPx,
      heightPx: embedded.heightPx,
      source: 'embedded',
    }
  }

  // Either there was no image object, or the only one is the page itself. Both want a
  // crop: the dish out of the middle, without the printed matter around it.
  const cropped = await cropPagePhoto(page, wholePage)
  if (cropped !== null) {
    // Zero dimensions mean "shape unknown", not "no photo": the card then letterboxes
    // the picture instead of guessing a shape. A crop is never thrown away over it.
    const size = pngSize(cropped)
    return {
      pageNumber,
      dataUrl: cropped,
      widthPx: size?.width ?? 0,
      heightPx: size?.height ?? 0,
      source: 'cropped',
    }
  }

  // A flattened page cannot be cropped but is still a picture of the dish; better to show
  // it than an empty band, and the card's own text bands cover the printed words.
  if (embedded !== null) {
    return {
      pageNumber,
      dataUrl: embedded.dataUrl,
      widthPx: embedded.widthPx,
      heightPx: embedded.heightPx,
      source: 'embedded',
    }
  }

  return null
}

/**
 * Renders the page offscreen and crops the picture band out of it.
 *
 * The band comes from the page's own text: everything between the top title block and the
 * bottom instruction box. When the page has no readable text — a photographed card, or one
 * drawn as outlines — the whole page is the band, which is the honest answer for an image
 * that is entirely a picture.
 */
async function cropPagePhoto(
  page: PDFPageProxy,
  flattened: boolean,
): Promise<string | null> {
  return renderThumbnail(page, CROP_WIDTH_PX, { flattened })
}

/**
 * A photo for every page of a document, in parallel.
 *
 * One difficult page cannot stop the others: each result is settled independently, and a
 * page that yields nothing is simply absent, so its card can say so rather than showing a
 * different dish.
 */
export async function photosForDocument(
  doc: PDFDocumentProxy,
): Promise<readonly PagePhoto[]> {
  const pages = await Promise.all(
    Array.from({ length: doc.numPages }, async (_unused, index) => {
      const pageNumber = index + 1
      try {
        const page = await doc.getPage(pageNumber)
        return await photoForPage(page)
      } catch {
        return null
      }
    }),
  )

  return pages.filter((photo): photo is PagePhoto => photo !== null)
}

/** The same list keyed by page number, which is how documents store them. */
export function photoMap(photos: readonly PagePhoto[]): Readonly<Record<number, PhotoSource>> {
  const out: Record<number, PhotoSource> = {}
  for (const photo of photos) {
    out[photo.pageNumber] = {
      dataUrl: photo.dataUrl,
      widthPx: photo.widthPx,
      heightPx: photo.heightPx,
    }
  }
  return out
}

/** Width and height from a PNG's IHDR chunk, without decoding the image. */
function pngSize(dataUrl: string): { width: number; height: number } | null {
  try {
    const binary = atob(dataUrl.split(',')[1] ?? '')
    if (binary.length < 24) return null
    const word = (offset: number): number =>
      ((binary.charCodeAt(offset) << 24) |
        (binary.charCodeAt(offset + 1) << 16) |
        (binary.charCodeAt(offset + 2) << 8) |
        binary.charCodeAt(offset + 3)) >>>
      0
    const width = word(16)
    const height = word(20)
    return width > 0 && height > 0 ? { width, height } : null
  } catch {
    return null
  }
}

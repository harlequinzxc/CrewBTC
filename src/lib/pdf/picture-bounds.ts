import type { PDFPageProxy } from 'pdfjs-dist'

/**
 * Finds the part of a page that is actually picture, so a card can show artwork
 * without the source page's own printed text.
 *
 * The card model is "header, picture, footer". Filling the picture band with the whole
 * source page would also drag in that page's typography — the card would say things
 * twice, in a font nobody chose. Cropping to the artwork's bounding box is what makes
 * "picture content box" mean what it says.
 *
 * Extraction is best-effort by design: a page can use vector drawing, an image with no
 * text, or complicated transforms. When no text is found the page *is* the picture and
 * the whole page is used — that is the honest answer, not a failure.
 */

export interface PictureBounds {
  /** Normalised 0–1 against the page, with the page's top-left as the origin. */
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  /** True when text was found and cropped away; false when the whole page is used. */
  readonly cropped: boolean
}

export const WHOLE_PAGE: PictureBounds = { x: 0, y: 0, width: 1, height: 1, cropped: false }

interface TextBox {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** Axis-aligned box of every text item on the page, in page points, top-left origin. */
export function textBounds(
  items: readonly {
    readonly transform?: unknown
    readonly width?: unknown
    readonly height?: unknown
    readonly str?: unknown
  }[],
  pageWidthPt: number,
  pageHeightPt: number,
): TextBox | null {
  if (pageWidthPt <= 0 || pageHeightPt <= 0) return null

  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  let found = false

  for (const item of items) {
    if (typeof item.str !== 'string' || item.str.trim() === '') continue
    const transform = item.transform
    if (!Array.isArray(transform) || transform.length < 6) continue

    const e = transform[4]
    const f = transform[5]
    if (typeof e !== 'number' || typeof f !== 'number') continue

    const fontSize = typeof transform[3] === 'number' ? Math.abs(transform[3]) : 0
    const width = typeof item.width === 'number' ? item.width : 0
    const height = typeof item.height === 'number' ? item.height : fontSize

    // PDF space is bottom-left; normalise to top-left for the caller.
    const top = 1 - (f + height) / pageHeightPt
    const bottom = 1 - f / pageHeightPt

    minX = Math.min(minX, e / pageWidthPt)
    maxX = Math.max(maxX, (e + width) / pageWidthPt)
    minY = Math.min(minY, top)
    maxY = Math.max(maxY, bottom)
    found = true
  }

  if (!found) return null
  return { x: minX, y: minY, width: Math.max(0, maxX - minX), height: Math.max(0, maxY - minY) }
}

/** A gap narrower than this is not a band between text, it is a rounding error. */
const MIN_GAP = 0.08

/**
 * The part of the page to keep as the picture.
 *
 * Cards usually carry text at *both* ends with artwork between them, so the useful
 * crop is the span between the two text blocks — keeping only the larger clear side
 * (an earlier version did that) threw the artwork away exactly when it was most
 * surrounded. When the text sits at one end, the clear area at the other end is used.
 */
export function pictureBoundsFromText(
  text: TextBox | null,
  /** Rows inside the text block that are clear, as fractions of the page, top-down. */
  clearRows: readonly { readonly start: number; readonly end: number }[] = [],
): PictureBounds {
  // Text at both ends: the picture is the band between them.
  const between = clearRows.filter(
    (row) => row.end - row.start >= MIN_GAP && row.start > 0 && row.end < 1,
  )
  const widest = between.reduce<{ start: number; end: number } | null>(
    (best, row) => (best === null || row.end - row.start > best.end - best.start ? row : best),
    null,
  )
  if (widest !== null) {
    return {
      x: 0,
      y: clamp01(widest.start),
      width: 1,
      height: clamp01(widest.end - widest.start),
      cropped: true,
    }
  }

  if (text === null) return WHOLE_PAGE

  // Text at one end: take the clear area at the other end.
  const gapTop = text.y
  const gapBottom = 1 - (text.y + text.height)
  if (gapTop >= gapBottom) {
    if (gapTop < MIN_GAP) return WHOLE_PAGE
    return { x: 0, y: 0, width: 1, height: clamp01(gapTop), cropped: true }
  }

  if (gapBottom < MIN_GAP) return WHOLE_PAGE
  const y = clamp01(text.y + text.height)
  return { x: 0, y, width: 1, height: clamp01(1 - y), cropped: true }
}

/** Splits a page into rows that contain text and rows that do not, top-down. */
export function clearRowsOfText(
  rows: readonly { readonly top: number; readonly bottom: number }[],
  /** Vertical resolution of the scan, in rows across the page height. */
  resolution = 120,
): readonly { readonly start: number; readonly end: number }[] {
  if (rows.length === 0) return [{ start: 0, end: 1 }]

  const occupied = new Array<boolean>(resolution).fill(false)
  for (const row of rows) {
    const from = Math.max(0, Math.floor(Math.min(row.top, row.bottom) * resolution))
    const to = Math.min(resolution - 1, Math.ceil(Math.max(row.top, row.bottom) * resolution))
    for (let index = from; index <= to; index += 1) occupied[index] = true
  }

  const clear: { start: number; end: number }[] = []
  let runStart: number | null = null
  for (let index = 0; index < resolution; index += 1) {
    if (!occupied[index] && runStart === null) runStart = index
    if (occupied[index] && runStart !== null) {
      clear.push({ start: runStart / resolution, end: index / resolution })
      runStart = null
    }
  }
  if (runStart !== null) clear.push({ start: runStart / resolution, end: 1 })
  return clear
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value))

/** Reads the page's text layer and decides what to keep. Never throws. */
export async function pagePictureBounds(page: PDFPageProxy): Promise<PictureBounds> {
  try {
    const viewport = page.getViewport({ scale: 1 })
    const content = await page.getTextContent()
    const items = content.items as readonly {
      transform?: unknown
      width?: unknown
      height?: unknown
      str?: unknown
    }[]
    const bounds = textBounds(items, viewport.width, viewport.height)
    const rows = textRows(items, viewport.height)
    return pictureBoundsFromText(bounds, clearRowsOfText(rows))
  } catch {
    // A page whose text cannot be read is treated as all picture.
    return WHOLE_PAGE
  }
}

/** Each text item as a vertical span of the page, top-down, in 0–1. */
export function textRows(
  items: readonly { transform?: unknown; height?: unknown; str?: unknown }[],
  pageHeightPt: number,
): readonly { readonly top: number; readonly bottom: number }[] {
  if (pageHeightPt <= 0) return []

  const rows: { top: number; bottom: number }[] = []
  for (const item of items) {
    if (typeof item.str !== 'string' || item.str.trim() === '') continue
    const transform = item.transform
    if (!Array.isArray(transform) || transform.length < 6) continue
    const f = transform[5]
    if (typeof f !== 'number') continue
    const fontSize = typeof transform[3] === 'number' ? Math.abs(transform[3]) : 0
    const height = typeof item.height === 'number' ? item.height : fontSize
    rows.push({
      top: clamp01(1 - (f + height) / pageHeightPt),
      bottom: clamp01(1 - f / pageHeightPt),
    })
  }
  return rows
}

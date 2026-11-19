import type { PDFPageProxy } from 'pdfjs-dist'

/**
 * Where on the page an image is actually painted.
 *
 * PDF.js hands the operator list back as numbers and ids, with the image's placement
 * expressed as a transform matrix. Recovering the rectangle from that is the only way to
 * know the photo's real position — and the position matters, because the header is the
 * text *above the photo* rather than above the middle of the page.
 *
 * When the operator list does not describe the placement (a font, a mask, an image
 * drawn through a form XObject), a centred default is returned rather than null: the
 * caller only needs a plausible split point, and a wrong guess is better than no split.
 */

export interface PaintedBox {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** What a photo's placement falls back to when the operator list says nothing. */
export const MIDDLE_BAND: PaintedBox = { x: 0.1, y: 0.15, width: 0.8, height: 0.6 }

/** pdf.js operator codes used to track the transform stack: save, restore, transform, paint. */
const OPS = { save: 10, restore: 11, transform: 12, paintImageMaskXObject: 83 } as const

interface OperatorList {
  readonly fnArray: readonly number[]
  readonly argsArray: readonly unknown[]
}

const numbers = (value: unknown): readonly number[] | null =>
  Array.isArray(value) && value.every((item) => typeof item === 'number')
    ? (value as readonly number[])
    : null

/**
 * Applies one `cm` operator to the running matrix.
 *
 * PDF uses row vectors, so a `cm` with matrix `m` sets `CTM = m × CTM` — the newest
 * operator goes on the *left*. PDF.js emits an image's placement as a sequence —
 * `translate(40,400)`, `identity`, `scale(120,90)`, `identity` — and composing it the
 * other way round puts a 120 pt image at 4800 pt instead of 40, which is a silent
 * misplacement rather than an error.
 */
function multiply(next: readonly number[], current: readonly number[]): number[] {
  const [a = 0, b = 0, c = 0, d = 0, e = 0, f = 0] = next
  const [g = 1, h = 0, i = 0, j = 1, k = 0, l = 0] = current
  return [
    a * g + b * i,
    a * h + b * j,
    c * g + d * i,
    c * h + d * j,
    e * g + f * i + k,
    e * h + f * j + l,
  ]
}

/** The rectangle a matrix maps the unit square onto, in page fractions. */
function rectOf(
  matrix: readonly number[],
  pageWidthPt: number,
  pageHeightPt: number,
): PaintedBox | null {
  const [a = 0, b = 0, c = 0, d = 0, e = 0, f = 0] = matrix
  const corners = [
    [e, f],
    [a + e, b + f],
    [c + e, d + f],
    [a + c + e, b + d + f],
  ] as const

  const xs = corners.map(([x]) => x)
  const ys = corners.map(([, y]) => y)
  const left = Math.min(...xs)
  const right = Math.max(...xs)
  // PDF's origin is bottom-left; the rest of the app measures from the top.
  const bottom = Math.min(...ys)
  const top = Math.max(...ys)

  if (![left, right, bottom, top].every(Number.isFinite)) return null
  if (right - left <= 0 || top - bottom <= 0) return null
  if (pageWidthPt <= 0 || pageHeightPt <= 0) return null

  return {
    x: left / pageWidthPt,
    y: (pageHeightPt - top) / pageHeightPt,
    width: (right - left) / pageWidthPt,
    height: (top - bottom) / pageHeightPt,
  }
}

/**
 * Finds where `imageId` is painted on the page.
 *
 * Walks the operator list keeping a transform stack, and reports the rectangle at the
 * first paint of that image. A page that paints the image through a form XObject, or not
 * at all, gets `MIDDLE_BAND`.
 */
export async function paintedBoxOf(
  page: PDFPageProxy,
  imageId: string,
  viewport: { readonly width: number; readonly height: number },
): Promise<PaintedBox> {
  try {
    const list = (await page.getOperatorList()) as unknown as OperatorList
    let current = [1, 0, 0, 1, 0, 0]
    const stack: number[][] = []

    for (let index = 0; index < list.fnArray.length; index += 1) {
      const fn = list.fnArray[index]
      const args = list.argsArray[index]

      if (fn === OPS.save) {
        stack.push([...current])
        continue
      }
      if (fn === OPS.restore) {
        const restored = stack.pop()
        if (restored !== undefined) current = restored
        continue
      }
      if (fn === OPS.transform) {
        const matrix = numbers(args)
        if (matrix !== null && matrix.length >= 6) current = multiply(matrix, current)
        continue
      }

      // A paint of the image we want: read its placement and stop.
      if (fn === OPS.paintImageMaskXObject) continue
      const first = Array.isArray(args) ? args[0] : undefined
      if (first !== imageId) continue

      const rect = rectOf(current, viewport.width, viewport.height)
      return rect ?? MIDDLE_BAND
    }

    return MIDDLE_BAND
  } catch {
    return MIDDLE_BAND
  }
}

/** Convenience: the vertical middle of the painted box, which is what the split needs. */
export async function photoMiddleOf(
  page: PDFPageProxy,
  imageId: string | null,
  viewport: { readonly width: number; readonly height: number },
): Promise<number> {
  if (imageId === null) return 0.5
  const box = await paintedBoxOf(page, imageId, viewport)
  return Math.min(1, Math.max(0, box.y + box.height / 2))
}

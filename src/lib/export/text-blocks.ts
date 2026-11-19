import type { PageEdit } from '../../types/edit'

/** Below this a block is a hairline on paper; drawing it would be noise, not text. */
export const MIN_TEXT_PT = 3

/** One edited block, positioned in cell-relative millimetres. */
export interface DrawableBlock {
  readonly xMm: number
  readonly yMm: number
  readonly widthMm: number
  readonly heightMm: number
  readonly text: string
  readonly sizePt: number
}

export interface BlockSource {
  readonly id: string
  readonly text: string
  readonly box: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }
  readonly fontSizeRatio: number
}

/**
 * The blocks that need drawing for one placement — only those the user actually
 * changed. Everything else is already inside the embedded page, and drawing it again
 * would double-print it.
 *
 * Coordinates follow the artwork: moving or scaling the page moves the text with it,
 * so text can never float away from the image it belongs to.
 */
export function drawableBlocks(
  edit: PageEdit,
  regions: readonly BlockSource[],
  artworkMm: { readonly xMm: number; readonly yMm: number; readonly widthMm: number; readonly heightMm: number },
): readonly DrawableBlock[] {
  const out: DrawableBlock[] = []

  for (const region of regions) {
    const override = edit.text[region.id]
    if (override === undefined || override.trim() === '') continue

    // fontSizeRatio is font/height in the source, so ratio x rendered height is the
    // on-paper size in millimetres. Then straight to points.
    const sizePt = region.fontSizeRatio * artworkMm.heightMm * (72 / 25.4)
    if (!Number.isFinite(sizePt) || sizePt < MIN_TEXT_PT) continue

    out.push({
      xMm: artworkMm.xMm + region.box.x * artworkMm.widthMm,
      yMm: artworkMm.yMm + region.box.y * artworkMm.heightMm,
      widthMm: region.box.width * artworkMm.widthMm,
      heightMm: region.box.height * artworkMm.heightMm,
      text: override,
      sizePt,
    })
  }

  return out
}

/** Greedy wrap driven by real font metrics, not a character count. */
export function wrapText(
  text: string,
  maxWidthPt: number,
  measure: (candidate: string) => number,
): readonly string[] {
  const words = text.split(/\s+/).filter((word) => word !== '')
  if (words.length === 0) return []

  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const candidate = line === '' ? word : `${line} ${word}`
    if (line === '' || measure(candidate) <= maxWidthPt) {
      line = candidate
    } else {
      lines.push(line)
      line = word
    }
  }
  if (line !== '') lines.push(line)
  return lines
}

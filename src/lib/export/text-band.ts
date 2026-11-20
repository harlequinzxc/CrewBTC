/**
 * Lays out one band of text (the header or the footer of a card) as lines that fit a
 * fixed rectangle.
 *
 * **All geometry here is millimetres** — the band's width and height, and what the
 * measure function returns. Type sizes are points, because that is how fonts are
 * specified, and this module converts at the boundary so no caller has to remember
 * which unit it is holding.
 *
 * An earlier version compared a width in millimetres against a measurement in points.
 * Every word "overflowed" as a result, so exported copy came out one word per line,
 * and the type was shrunk for no reason. Mixing units silently is the worst kind of
 * bug: the output is valid, just wrong.
 */

/** Smaller than this and the words are a smudge on paper; we stop shrinking instead. */
export const MIN_BAND_TEXT_PT = 4

const PT_TO_MM = 25.4 / 72
const MM_TO_PT = 72 / 25.4

export interface BandLine {
  readonly text: string
  /** Cell-relative millimetres, measured to the text's baseline origin. */
  readonly yMm: number
  readonly sizePt: number
}

export interface BandLayout {
  readonly lines: readonly BandLine[]
  readonly sizePt: number
  /** True when the text still did not fit at the legibility floor. */
  readonly overflow: boolean
}

export interface BandOptions {
  /** Extra inset so type never touches the cut line. */
  readonly paddingMm?: number
}

/**
 * @param widthMm  box width in millimetres
 * @param maxPt    the size the text would like to be
 * @param measure  returns the rendered **width in millimetres** at a given size
 * @param lineHeight multiple of the font size used as line pitch
 */
export function layoutBand(
  text: string,
  boxTopMm: number,
  widthMm: number,
  bandMm: number,
  maxPt: number,
  lineHeight: number,
  measure: (text: string, sizePt: number) => number,
  options: BandOptions = {},
): BandLayout {
  const padding = options.paddingMm ?? 0.8
  const innerWidth = Math.max(0, widthMm - padding * 2)
  const innerHeight = Math.max(0, bandMm - padding)

  const paragraphs = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')

  if (paragraphs.length === 0 || innerWidth <= 0 || innerHeight <= 0) {
    return { lines: [], sizePt: 0, overflow: false }
  }

  const floorPt = Math.min(MIN_BAND_TEXT_PT, maxPt)
  const sizePt = Math.max(floorPt, Number.isFinite(maxPt) ? maxPt : floorPt)

  const linesAt = (size: number): readonly string[] =>
    paragraphs.flatMap((paragraph) => wrapToWidth(paragraph, innerWidth, (candidate) => measure(candidate, size)))

  const heightAt = (lineCount: number, size: number): number => lineCount * size * lineHeight * PT_TO_MM

  /*
    No shrinking. The type is set at the size asked for and wraps to the width; a band too
    short for it clips at the zone edge, which the card's `overflow-hidden` guarantees.

    Auto-shrinking meant the font size changed whenever a divider moved, so the same card
    could compose at one size and print at another. The size is now the user's, through the
    Text % field, and only the line breaks respond to the box.
  */
  const wrapped = linesAt(sizePt)
  const fits = heightAt(wrapped.length, sizePt) <= innerHeight
  const kept = wrapped

  const lines: BandLine[] = kept.map((line, index) => ({
    text: line,
    // Baseline of each line, measured down from the band's top edge.
    yMm: boxTopMm + padding + index * sizePt * lineHeight * PT_TO_MM + sizePt * PT_TO_MM,
    sizePt,
  }))

  return { lines, sizePt, overflow: !fits }
}

/** Greedy word wrap against measured widths. Long single words are kept whole. */
export function wrapToWidth(
  text: string,
  maxWidthMm: number,
  measure: (candidate: string) => number,
): readonly string[] {
  const words = text.split(/\s+/).filter((word) => word !== '')
  if (words.length === 0) return []

  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const candidate = line === '' ? word : `${line} ${word}`
    if (line === '' || measure(candidate) <= maxWidthMm) {
      line = candidate
    } else {
      lines.push(line)
      line = word
    }
  }
  if (line !== '') lines.push(line)
  return lines
}

/** Points to millimetres, for callers converting a font measurement. */
export const ptWidthToMm = (points: number): number => points * PT_TO_MM

/** Millimetres to points, for callers sizing a font from a band. */
export const mmToPtSize = (mm: number): number => mm * MM_TO_PT

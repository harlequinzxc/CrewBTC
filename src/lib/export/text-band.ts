/**
 * Lays out one band of text (the header or the footer of a card) as lines that fit a
 * fixed rectangle. Shared by the preview and the exporter so the two cannot disagree
 * about where a line breaks or how big the type is.
 *
 * The band's height is fixed by the sheet settings, so the type size is what gives:
 * text that does not fit shrinks until it does, down to a legibility floor. Copying on
 * paper is meant to be read, and silently overflowing the band would print over the
 * picture.
 */

/** Smaller than this and the words are a smudge on paper; we stop shrinking instead. */
export const MIN_BAND_TEXT_PT = 4

export interface BandLine {
  readonly text: string
  /** Cell-relative millimetres, measured to the text's baseline origin. */
  readonly yMm: number
  readonly sizePt: number
}

export interface BandLayout {
  readonly lines: readonly BandLine[]
  /** True when the text still did not fit at the legibility floor. */
  readonly overflow: boolean
}

export interface BandOptions {
  /** Extra inset so type never touches the cut line. */
  readonly paddingMm?: number
}

/**
 * @param bandMm   box height in millimetres
 * @param widthMm  box width in millimetres
 * @param maxPt    the size the text would like to be
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
    return { lines: [], overflow: false }
  }

  const ptToMm = 25.4 / 72
  let sizePt = Math.max(MIN_BAND_TEXT_PT, Number.isFinite(maxPt) ? maxPt : MIN_BAND_TEXT_PT)

  // Shrink until every wrapped line fits both the width and the height of the band.
  for (;;) {
    const wrapped = paragraphs.flatMap((paragraph) =>
      wrapToWidth(paragraph, innerWidth, (candidate) => measure(candidate, sizePt)),
    )
    const blockMm = wrapped.length * sizePt * lineHeight * ptToMm

    if (blockMm <= innerHeight || sizePt <= MIN_BAND_TEXT_PT) {
      if (blockMm > innerHeight && wrapped.length > 0) {
        // Keep only the lines that fit at the floor rather than printing over the art.
        const fitCount = Math.max(0, Math.floor(innerHeight / (sizePt * lineHeight * ptToMm)))
        const kept = wrapped.slice(0, fitCount)
        return {
          lines: kept.map((line, index) => ({
            text: line,
            yMm: boxTopMm + padding + index * sizePt * lineHeight * ptToMm + sizePt * ptToMm,
            sizePt,
          })),
          overflow: true,
        }
      }

      return {
        lines: wrapped.map((line, index) => ({
          text: line,
          yMm: boxTopMm + padding + index * sizePt * lineHeight * ptToMm + sizePt * ptToMm,
          sizePt,
        })),
        overflow: false,
      }
    }

    // One step down is enough to converge; 5% avoids overshooting short bands.
    sizePt *= 0.95
    if (sizePt < MIN_BAND_TEXT_PT) sizePt = MIN_BAND_TEXT_PT
  }
}

/** Greedy word wrap against real font metrics. Long single words are kept whole. */
export function wrapToWidth(
  text: string,
  maxWidth: number,
  measure: (candidate: string) => number,
): readonly string[] {
  const words = text.split(/\s+/).filter((word) => word !== '')
  if (words.length === 0) return []

  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const candidate = line === '' ? word : `${line} ${word}`
    if (line === '' || measure(candidate) <= maxWidth) {
      line = candidate
    } else {
      lines.push(line)
      line = word
    }
  }
  if (line !== '') lines.push(line)
  return lines
}

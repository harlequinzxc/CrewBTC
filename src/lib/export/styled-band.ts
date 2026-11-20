import { layoutBand, MIN_BAND_TEXT_PT } from './text-band'
import type { BandOptions } from './text-band'
import { segmentByStyle, wrapSegments } from './wrap-segments'

// Re-exported so existing callers and tests keep one import for the whole typesetter.
export { segmentByStyle, wrapSegments } from './wrap-segments'

/**
 * Laying out text whose style changes part-way through.
 *
 * The box is wrapped *per style segment*: a bold word is wider than a regular one, so
 * measuring a whole line in one style would break it in the wrong place. Each line
 * carries the style its own words were measured with, which is what lets the preview and
 * the exporter draw a highlighted phrase highlighted without re-deciding line breaks.
 *
 * A box with no runs goes down `layoutBand`'s single-style path unchanged, so a card that
 * was typed and never formatted lays out exactly as it did before this module existed.
 */

const PT_TO_MM = 25.4 / 72

/** One stretch of same-styled characters. */
export interface StyledSegment {
  readonly text: string
  readonly bold: boolean
  readonly color: string
  readonly highlight: string | null
  /** Drawn in capitals. The `text` here is already the capitalised form. */
  readonly uppercase?: boolean
  /** `left` (default) or `center` within the band's inner width, per line. */
  readonly align?: 'left' | 'center'
}

export interface StyledLine {
  /** The line as plain text, for callers that only need to draw or measure it. */
  readonly text: string
  readonly segments: readonly StyledSegment[]
  /** Baseline, measured down from the band's top edge. */
  readonly yMm: number
  readonly sizePt: number
  /** How wide the line drew, in millimetres. */
  readonly widthMm: number
  /** Distance from the band's outer left edge to the first glyph, padding included. */
  readonly xMm: number
}

export interface StyledBandLayout {
  readonly lines: readonly StyledLine[]
  readonly sizePt: number
  /** True when the text still did not fit at the legibility floor. */
  readonly overflow: boolean
}

export interface StyledBandInput {
  readonly text: string
  readonly base: StyledSegment
  readonly runs: readonly {
    readonly start: number
    readonly end: number
    readonly bold?: boolean
    readonly color?: string
    readonly highlight?: string | null
    readonly uppercase?: boolean
    readonly align?: 'left' | 'center'
  }[]
}


/**
 * Lays out a styled band at the largest size that fits both axes.
 *
 * @param measureAt returns the rendered **width in millimetres** at a given size and weight
 */
export function layoutStyledBand(
  input: StyledBandInput,
  boxTopMm: number,
  widthMm: number,
  bandMm: number,
  maxPt: number,
  lineHeight: number,
  measureAt: (text: string, sizePt: number, bold: boolean) => number,
  options: BandOptions = {},
): StyledBandLayout {
  if (input.runs.length === 0) {
    const plain = layoutBand(
      input.text,
      boxTopMm,
      widthMm,
      bandMm,
      maxPt,
      lineHeight,
      (text, sizePt) => measureAt(text, sizePt, input.base.bold),
      options,
    )
    const centered = (input.base.align ?? 'left') === 'center'
    // The same inset `layoutBand` applied internally, so a left line starts where it did.
    const padding = options.paddingMm ?? 0.8
    return {
      ...plain,
      lines: plain.lines.map((line) => {
        // The capitalised form is what was measured and what will be drawn, so the width
        // comes from the same string rather than from the raw text.
        const drawn = (input.base.uppercase ?? false) ? line.text.toUpperCase() : line.text
        const width = measureAt(drawn, line.sizePt, input.base.bold)
        return {
          ...line,
          text: drawn,
          segments: [{ ...input.base, text: drawn }],
          widthMm: width,
          xMm: centered ? Math.max(0, (widthMm - width) / 2) : padding,
        }
      }),
    }
  }

  const padding = options.paddingMm ?? 0.8
  const innerWidth = Math.max(0, widthMm - padding * 2)
  const innerHeight = Math.max(0, bandMm - padding)
  const segments = segmentByStyle(input)

  if (segments.length === 0 || innerWidth <= 0 || innerHeight <= 0) {
    return { lines: [], sizePt: 0, overflow: false }
  }

  const floorPt = Math.min(MIN_BAND_TEXT_PT, maxPt)
  let sizePt = Math.max(floorPt, Number.isFinite(maxPt) ? maxPt : floorPt)

  const linesAt = (size: number): readonly (readonly StyledSegment[])[] =>
    wrapSegments(segments, innerWidth, (text, bold) => measureAt(text, size, bold))

  const heightAt = (count: number, size: number): number => count * size * lineHeight * PT_TO_MM

  let wrapped = linesAt(sizePt)
  while (heightAt(wrapped.length, sizePt) > innerHeight && sizePt > floorPt) {
    sizePt = Math.max(floorPt, sizePt * 0.95)
    wrapped = linesAt(sizePt)
  }

  const fits = heightAt(wrapped.length, sizePt) <= innerHeight
  const kept = fits
    ? wrapped
    : wrapped.slice(0, Math.max(0, Math.floor(innerHeight / (sizePt * lineHeight * PT_TO_MM))))

  return {
    sizePt,
    overflow: !fits,
    lines: kept.map((segmentsOnLine, index) => {
      // Measured segment by segment, because a line can mix weights and only the weight
      // each segment was wrapped in gives the width it will actually occupy.
      const width = segmentsOnLine.reduce(
        (total, segment) => total + measureAt(segment.text, sizePt, segment.bold),
        0,
      )
      const centered = (segmentsOnLine[0]?.align ?? 'left') === 'center'
      return {
        text: segmentsOnLine.map((segment) => segment.text).join(''),
        segments: segmentsOnLine,
        yMm: boxTopMm + padding + index * sizePt * lineHeight * PT_TO_MM + sizePt * PT_TO_MM,
        sizePt,
        widthMm: width,
        // Distance from the band's left edge to where this line starts. Left-aligned lines
        // start after the padding, which is the same origin they have always had.
        xMm: centered ? Math.max(0, padding + (innerWidth - width) / 2) : padding,
      }
    }),
  }
}

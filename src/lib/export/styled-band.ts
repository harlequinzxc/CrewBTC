import { layoutBand, MIN_BAND_TEXT_PT } from './text-band'
import type { BandOptions } from './text-band'

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
}

export interface StyledLine {
  /** The line as plain text, for callers that only need to draw or measure it. */
  readonly text: string
  readonly segments: readonly StyledSegment[]
  /** Baseline, measured down from the band's top edge. */
  readonly yMm: number
  readonly sizePt: number
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
  }[]
}

/** Splits text into consecutive same-style segments; newlines stay inside their segment. */
export function segmentByStyle(input: StyledBandInput): readonly StyledSegment[] {
  const { text, base, runs } = input
  const styleOf = (offset: number): StyledSegment => {
    const run = runs.find((item) => offset >= item.start && offset < item.end)
    if (run === undefined) return { ...base, text: '' }
    return {
      text: '',
      bold: run.bold ?? base.bold,
      color: run.color ?? base.color,
      highlight: run.highlight === undefined ? base.highlight : run.highlight,
    }
  }

  const out: StyledSegment[] = []
  let index = 0
  while (index < text.length) {
    const style = styleOf(index)
    let end = index + 1
    while (end < text.length) {
      const next = styleOf(end)
      if (
        next.bold !== style.bold ||
        next.color !== style.color ||
        next.highlight !== style.highlight
      ) {
        break
      }
      end += 1
    }
    out.push({ ...style, text: text.slice(index, end) })
    index = end
  }
  return out
}

/**
 * Greedy wrap over styled segments. A newline forces a break, a word that would overflow
 * starts a new line, and the style travels with each word so one line can be several
 * styles. Trailing whitespace is dropped from each visual line, as typesetting does.
 */
export function wrapSegments(
  segments: readonly StyledSegment[],
  maxWidthMm: number,
  measure: (text: string, bold: boolean) => number,
): readonly (readonly StyledSegment[])[] {
  const lines: StyledSegment[][] = []
  let current: StyledSegment[] = []
  let currentWidth = 0

  const pushLine = (): void => {
    if (current.length > 0) lines.push(current)
    current = []
    currentWidth = 0
  }

  for (const segment of segments) {
    for (const piece of segment.text.split(/(\n)/)) {
      if (piece === '\n') {
        pushLine()
        continue
      }
      if (piece === '') continue

      for (const word of piece.split(/(\s+)/)) {
        if (word === '') continue

        if (/^\s+$/.test(word)) {
          // Whitespace never starts a line and never forces one.
          if (current.length > 0) {
            current.push({ ...segment, text: word })
            currentWidth += measure(word, segment.bold)
          }
          continue
        }

        const width = measure(word, segment.bold)
        const hasWords = current.some((item) => item.text.trim() !== '')
        if (currentWidth + width > maxWidthMm && hasWords) pushLine()
        current.push({ ...segment, text: word })
        currentWidth += width
      }
    }
  }
  pushLine()

  return lines
    .map((line) => {
      const trimmed = [...line]
      while (trimmed.length > 0) {
        const last = trimmed[trimmed.length - 1]
        if (last === undefined) break
        const text = last.text.replace(/\s+$/, '')
        if (text === '') {
          trimmed.pop()
          continue
        }
        trimmed[trimmed.length - 1] = { ...last, text }
        break
      }
      return trimmed
    })
    .filter((line) => line.some((segment) => segment.text.trim() !== ''))
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
    return {
      ...plain,
      lines: plain.lines.map((line) => ({
        ...line,
        segments: [{ ...input.base, text: line.text }],
      })),
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
    lines: kept.map((segmentsOnLine, index) => ({
      text: segmentsOnLine.map((segment) => segment.text).join(''),
      segments: segmentsOnLine,
      yMm: boxTopMm + padding + index * sizePt * lineHeight * PT_TO_MM + sizePt * PT_TO_MM,
      sizePt,
    })),
  }
}

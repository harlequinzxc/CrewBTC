import { CARD_LINE_HEIGHT, CARD_TEXT_PT } from './card-typography'
import { wrapToWidth } from '../lib/export/text-band'
import { BAND_MIN_MM, clampBands } from './card'
import type { CardBands } from './card'

/**
 * Sizes a card's two text bands to the text they actually hold.
 *
 * A fixed split — 10 mm of header, 15 mm of footer on a 67 mm card — is a guess about
 * content. When a dish name is one line and the plating steps are two bullets, the guess
 * leaves several millimetres of blank paper under each block: white space *inside* the
 * zone, which reads as the photo being squeezed by nothing. That is the gap between the
 * title and the picture, and the gap under the last bullet.
 *
 * So the bands are derived instead. Text is drawn at a fixed user-selected size; the
 * estimated height helps leave room for its lines without taking space from the photo.
 *
 * The result goes through `clampBands`, so the photo keeps its 12 mm minimum even if
 * that means a long block overflows. The font size never changes to force the text to fit.
 */

/** Points to millimetres — the conversion the layout engine uses throughout. */
const PT_TO_MM = 25.4 / 72

/** Line pitch, matching the renderer so the estimate counts the same lines it will draw. */
const LINE_HEIGHT = CARD_LINE_HEIGHT

/** The engine's own padding, plus a little room so text is not flush against the edge. */
const PADDING_MM = 0.8
const BREATHING_MM = 1

/** The shared nominal type size used for the two text bands. */
export const HEADER_PT = CARD_TEXT_PT
export const FOOTER_PT = CARD_TEXT_PT

/**
 * Width of a string at a size, in millimetres.
 *
 * An estimate for initial band sizing only. The preview measures real browser glyphs and
 * the exporter measures Helvetica, so either may wrap differently; a long block can
 * still overflow and users can adjust the bands without changing text size.
 */
const measureAt = (text: string, sizePt: number): number => text.length * sizePt * 0.5 * PT_TO_MM

/** How tall a block of text needs to be, at full size, wrapped to this width. */
export function textHeightMm(text: string, widthMm: number, sizePt: number): number {
  const innerWidth = Math.max(0, widthMm - PADDING_MM * 2)
  const paragraphs = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')

  if (paragraphs.length === 0 || innerWidth <= 0) return 0

  const lines = paragraphs.flatMap((paragraph) =>
    wrapToWidth(paragraph, innerWidth, (candidate) => measureAt(candidate, sizePt)),
  )

  return lines.length * sizePt * LINE_HEIGHT * PT_TO_MM + PADDING_MM + BREATHING_MM
}

export interface BandFitInput {
  readonly headerText: string
  readonly footerText: string
  readonly cellWidthMm: number
  readonly cellHeightMm: number
  /** The card's text multiplier, applied to the requested size like the renderer does. */
  readonly textScale?: number | undefined
}

/**
 * The bands a card should start with, given the text it was seeded with.
 *
 * Returns `null` when the cell is too small to be worth deriving for; the caller then
 * keeps whatever `blankCard` gave it.
 */
export function bandsForContent(input: BandFitInput): CardBands | null {
  const { cellWidthMm, cellHeightMm } = input
  if (!(cellWidthMm > 0) || !(cellHeightMm > 0)) return null

  const scale = input.textScale ?? 1
  const headerNeed = textHeightMm(input.headerText, cellWidthMm, HEADER_PT * scale)
  const footerNeed = textHeightMm(input.footerText, cellWidthMm, FOOTER_PT * scale)

  // A blank zone still holds its placeholder, so it keeps the minimum rather than
  // collapsing — and the picture takes everything the words did not need.
  const headerMm = Math.max(BAND_MIN_MM, headerNeed)
  const footerMm = Math.max(BAND_MIN_MM, footerNeed)

  return clampBands({ headerMm, footerMm }, cellHeightMm)
}

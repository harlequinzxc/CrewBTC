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
 * So the bands are derived instead. Text is drawn at the largest size that fits, and
 * shrinks only when it has to, so the height a block needs at its full size is exactly the
 * height it will use — fill the band to that and there is no slack to leave blank.
 *
 * Two details make this safe rather than merely tighter:
 *
 * - It never *shrinks* a band below what the text needs, so no card loses type size to the
 *   fit. A card with four bullets gets 15 mm, the same as the old default; a card with two
 *   gets 8 mm and hands the other 7 mm to its photo.
 * - The result goes through `clampBands`, the same budget the dividers and the inspector
 *   obey, so the photo keeps its 12 mm minimum whatever the text asks for.
 */

/** Points to millimetres — the conversion the layout engine uses throughout. */
const PT_TO_MM = 25.4 / 72

/** Line pitch, matching the renderer so the estimate counts the same lines it will draw. */
const LINE_HEIGHT = 1.25

/** The engine's own padding, plus a little room so text is not flush against the edge. */
const PADDING_MM = 0.8
const BREATHING_MM = 1

/** The type sizes the card renderer requests before shrinking to fit. */
export const HEADER_PT = 9
export const FOOTER_PT = 8

/**
 * Width of a string at a size, in millimetres.
 *
 * The same approximation `CardZoneText` wraps with, on purpose: the band is sized by the
 * lines the preview will actually draw, so the sheet the user sees is the sheet that was
 * measured. The exporter measures real Helvetica and may break a line differently, but it
 * also shrinks to fit, so the difference costs a fraction of a point, never an overflow.
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

import type { PDFFont, PDFImage, PDFOperator, PDFPage, RGB } from '@cantoo/pdf-lib'
import type { ClipOps } from './band-clip'
import { mmToPt, ptToMm } from '../units'
import { layoutStyledBand } from './styled-band'
import type { StyledSegment } from './styled-band'
import { pushBandClip } from './band-clip'
import { cardZones, containRectMm, fitInsideMm } from '../../types/card'
import type { Card, RectMm, TextRun } from '../../types/card'

/**
 * Drawing one card onto an output page.
 *
 * Everything here is measured in millimetres and converted once at the drawing call, so
 * the only place points appear is at the boundary. The zone split and the picture
 * rectangle come from `cardZones`/`containRectMm` — the same functions the on-screen
 * card uses — which is what makes the print match the preview rather than resemble it.
 */

/** Type sizes a card's boxes start at, before shrinking to fit. */
const HEADER_MAX_PT = 9
const FOOTER_MAX_PT = 8
const LINE_HEIGHT = 1.25
const PADDING_MM = 0.8

/** Fonts and colours shared by every card on a sheet. */
export interface CardCanvas {
  readonly page: PDFPage
  readonly regular: PDFFont
  readonly bold: PDFFont
  readonly sheetHeightPt: number
}

/** `#rrggbb` to a pdf-lib colour, falling back rather than throwing on junk input. */
export function hexToRgb(hex: string, fallback: RGB, rgb: (r: number, g: number, b: number) => RGB): RGB {
  const match = /^#?([\da-f]{6})$/i.exec(hex.trim())
  if (match === null) return fallback
  const value = Number.parseInt(match[1] ?? '', 16)
  if (!Number.isFinite(value)) return fallback
  return rgb(((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255)
}

/** The bottom-up y for a rectangle given in top-down millimetres. */
const flipY = (rect: RectMm, sheetHeightPt: number): number =>
  sheetHeightPt - mmToPt(rect.yMm) - mmToPt(rect.heightMm)

interface PaintTextInput {
  readonly canvas: CardCanvas
  readonly zone: RectMm
  readonly text: string
  readonly runs: readonly TextRun[]
  readonly bold: boolean
  readonly color: string
  readonly highlight: string | null
  readonly maxPt: number
  readonly fallback: RGB
  readonly rgb: (r: number, g: number, b: number) => RGB
}

/** One text box: lines laid out by the shared typesetter, highlight drawn behind. */
function paintText(input: PaintTextInput): void {
  const { canvas, zone, text } = input
  if (text.trim() === '' || zone.widthMm <= 0 || zone.heightMm <= 0) return

  const fontFor = (bold: boolean): PDFFont => (bold ? canvas.bold : canvas.regular)
  const measureAt = (candidate: string, sizePt: number, bold: boolean): number =>
    ptToMm(fontFor(bold).widthOfTextAtSize(candidate, sizePt))

  const layout = layoutStyledBand(
    {
      text,
      base: { text: '', bold: input.bold, color: input.color, highlight: input.highlight },
      runs: input.runs,
    },
    zone.yMm,
    zone.widthMm,
    zone.heightMm,
    input.maxPt,
    LINE_HEIGHT,
    measureAt,
    { paddingMm: PADDING_MM },
  )

  const inkOf = (hex: string): RGB => hexToRgb(hex, input.fallback, input.rgb)

  for (const line of layout.lines) {
    // Segments are drawn left to right, each in its own weight and ink, so a bold word
    // and a red instruction print exactly as they look on screen.
    let xMm = zone.xMm + PADDING_MM

    for (const segment of line.segments) {
      const font = fontFor(segment.bold)
      const widthPt = font.widthOfTextAtSize(segment.text, line.sizePt)
      const widthMm = ptToMm(widthPt)

      if (segment.highlight !== null) {
        canvas.page.drawRectangle({
          x: mmToPt(xMm),
          // Behind the glyphs, one line high, with a little air on either side.
          y: canvas.sheetHeightPt - mmToPt(line.yMm) - line.sizePt * 0.25,
          width: Math.min(mmToPt(zone.xMm + zone.widthMm - xMm), widthPt + mmToPt(0.4)),
          height: line.sizePt * 1.15,
          color: inkOf(segment.highlight),
        })
      }

      canvas.page.drawText(segment.text, {
        x: mmToPt(xMm),
        y: canvas.sheetHeightPt - mmToPt(line.yMm),
        size: line.sizePt,
        font,
        color: inkOf(segment.color),
      })

      xMm += widthMm
    }
  }
}

/** Kept for callers that only need the plain-text line boxes. */
export type { StyledSegment }

export interface DrawCardInput {
  readonly lib: {
    readonly rgb: (r: number, g: number, b: number) => RGB
    /** PDF operator set, needed for the graphics-state clip around the photo. */
    readonly ops: ClipOps
    readonly popGraphicsState: () => PDFOperator
  }
  readonly canvas: CardCanvas
  readonly card: Card
  /** The cell's rectangle on the sheet, in millimetres. */
  readonly cell: RectMm
  /** The PNG bytes for this card's photo, or null when the page had none. */
  readonly png: Uint8Array | null
  /** Embeds the PNG once and hands back the drawn image, or null if unreadable. */
  readonly embed: (png: Uint8Array) => Promise<{
    readonly image: PDFImage
    readonly width: number
    readonly height: number
  } | null>
}

/**
 * Draws a whole card: top text, photo clipped to its box, bottom text.
 *
 * The photo is clipped to the picture band with real PDF state, so a zoomed or dragged
 * dish cannot spill onto the words above or below it.
 */
export async function drawCard(input: DrawCardInput): Promise<boolean> {
  const { card, cell, canvas } = input
  const zones = cardZones(cell, card.bands)
  const black = input.lib.rgb(0, 0, 0)

  paintText({
    canvas,
    zone: zones.header,
    text: card.headerText,
    runs: card.headerRuns ?? [],
    bold: card.headerStyle.bold,
    color: card.headerStyle.color,
    highlight: card.headerStyle.highlight,
    maxPt: HEADER_MAX_PT * (card.textScale ?? 1),
    fallback: black,
    rgb: input.lib.rgb,
  })

  paintText({
    canvas,
    zone: zones.footer,
    text: card.bodyText,
    runs: card.bodyRuns ?? [],
    bold: card.bodyStyle.bold,
    color: card.bodyStyle.color,
    highlight: card.bodyStyle.highlight,
    maxPt: FOOTER_MAX_PT * (card.textScale ?? 1),
    fallback: black,
    rgb: input.lib.rgb,
  })

  if (card.photo === null || input.png === null) return false

  const embedded = await input.embed(input.png)
  if (embedded === null) return false

  const known = card.photo.widthPx > 0 && card.photo.heightPx > 0
  const drawn = known
    ? containRectMm(zones.picture, card.photo.widthPx, card.photo.heightPx, card.imageTransform)
    : null

  // Unknown shape: fit the image's own aspect inside the band and apply the offset.
  const rect: RectMm =
    drawn ??
    (() => {
      const fitted = fitInsideMm(
        zones.picture.widthMm,
        zones.picture.heightMm,
        embedded.width,
        embedded.height,
      )
      return {
        xMm: zones.picture.xMm + (zones.picture.widthMm - fitted.widthMm) / 2 + card.imageTransform.offsetXMm,
        yMm: zones.picture.yMm + (zones.picture.heightMm - fitted.heightMm) / 2 + card.imageTransform.offsetYMm,
        widthMm: fitted.widthMm,
        heightMm: fitted.heightMm,
      }
    })()

  const widthPt = mmToPt(rect.widthMm)
  const heightPt = mmToPt(rect.heightMm)
  if (!(widthPt > 0) || !(heightPt > 0)) return false

  // The clip is real graphics state: a zoomed dish cannot leave its box.
  pushBandClip(input.lib.ops, canvas.page, zones.picture, canvas.sheetHeightPt)
  canvas.page.drawImage(embedded.image, {
    x: mmToPt(rect.xMm),
    y: flipY(rect, canvas.sheetHeightPt),
    width: widthPt,
    height: heightPt,
  })
  // Close the clip, or it would also constrain the next card's photo.
  canvas.page.pushOperators(input.lib.popGraphicsState())
  return true
}


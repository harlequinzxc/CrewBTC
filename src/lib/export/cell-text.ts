import type { PDFFont, PDFPage, RGB } from '@cantoo/pdf-lib'
import { mmToPt } from '../units'
import { splitCellText } from '../../types/edit'
import type { CellZones } from '../../types/edit'
import { layoutBand, ptWidthToMm } from './text-band'

/** Header type is a title; footer type is a caption. Both shrink to fit their band. */
const HEADER_MAX_PT = 11
const FOOTER_MAX_PT = 8
const LINE_HEIGHT = 1.18
/** Inset so type never touches the cut line. */
const PADDING_MM = 0.8

export interface DrawTextInput {
  readonly page: PDFPage
  readonly font: PDFFont
  readonly zones: CellZones
  readonly text: string
  /** Page height in points, for the top-left to bottom-left flip. */
  readonly sheetHeightPt: number
  readonly ink: { readonly header: RGB; readonly footer: RGB }
  /** Chosen per band in the preview; the export must match what was seen. */
  readonly styles?:
    | {
        readonly header?: { readonly color: string; readonly highlight: string | null } | undefined
        readonly footer?: { readonly color: string; readonly highlight: string | null } | undefined
      }
    | undefined
}

/**
 * Typesets one card's copy into its header and footer bands.
 *
 * Shared constants with the preview would be better than shared numbers, but the
 * preview sets type in CSS pixels while the exporter sets it in points — the values
 * are converted from the same band geometry, which is what actually has to agree.
 */
export function drawCellText(input: DrawTextInput): void {
  const { page, font, zones, text, sheetHeightPt, ink } = input
  const { header, footer } = splitCellText(text)
  // layoutBand works in millimetres; the font reports points. Convert here, once.
  const measure = (candidate: string, sizePt: number): number =>
    ptWidthToMm(font.widthOfTextAtSize(candidate, sizePt))

  const paint = (
    band: 'header' | 'footer',
    fallback: RGB,
    line: { text: string; yMm: number; sizePt: number },
    zone: CellZones['header'],
  ): void => {
    const style = input.styles?.[band]
    const colour = style === undefined ? fallback : hexToRgb(style.color, fallback)

    if (style?.highlight != null) {
      const widthPt = font.widthOfTextAtSize(line.text, line.sizePt)
      page.drawRectangle({
        x: mmToPt(zone.xMm),
        // The highlight sits behind the glyphs, one line high.
        y: sheetHeightPt - mmToPt(line.yMm) - line.sizePt * 0.25,
        width: Math.min(mmToPt(zone.widthMm), widthPt + mmToPt(1)),
        height: line.sizePt * 1.15,
        color: hexToRgb(style.highlight, fallback),
      })
    }

    page.drawText(line.text, {
      x: mmToPt(zone.xMm + PADDING_MM),
      y: sheetHeightPt - mmToPt(line.yMm),
      size: line.sizePt,
      font,
      color: colour,
    })
  }

  if (header !== '') {
    const layout = layoutBand(
      header,
      zones.header.yMm,
      zones.header.widthMm,
      zones.header.heightMm,
      HEADER_MAX_PT,
      LINE_HEIGHT,
      measure,
      { paddingMm: PADDING_MM },
    )
    for (const line of layout.lines) paint('header', ink.header, line, zones.header)
  }

  if (footer !== '') {
    const layout = layoutBand(
      footer,
      zones.footer.yMm,
      zones.footer.widthMm,
      zones.footer.heightMm,
      FOOTER_MAX_PT,
      LINE_HEIGHT,
      measure,
      { paddingMm: PADDING_MM },
    )
    for (const line of layout.lines) paint('footer', ink.footer, line, zones.footer)
  }
}

/** `#rrggbb` to a PDF colour, falling back rather than throwing on a bad value. */
function hexToRgb(hex: string, fallback: RGB): RGB {
  const match = /^#([0-9a-f]{6})$/i.exec(hex.trim())
  if (match === null) return fallback

  const value = Number.parseInt(match[1] ?? '', 16)
  if (!Number.isFinite(value)) return fallback
  return {
    type: 'RGB',
    red: ((value >> 16) & 0xff) / 255,
    green: ((value >> 8) & 0xff) / 255,
    blue: (value & 0xff) / 255,
  } as RGB
}

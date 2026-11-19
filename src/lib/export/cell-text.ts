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
    for (const line of layout.lines) {
      page.drawText(line.text, {
        x: mmToPt(zones.header.xMm + PADDING_MM),
        y: sheetHeightPt - mmToPt(line.yMm),
        size: line.sizePt,
        font,
        color: ink.header,
      })
    }
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
    for (const line of layout.lines) {
      page.drawText(line.text, {
        x: mmToPt(zones.footer.xMm + PADDING_MM),
        y: sheetHeightPt - mmToPt(line.yMm),
        size: line.sizePt,
        font,
        color: ink.footer,
      })
    }
  }
}

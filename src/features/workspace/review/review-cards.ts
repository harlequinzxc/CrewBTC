import type { PDFFont } from '@cantoo/pdf-lib'
import { CARD_LINE_HEIGHT, CARD_TEXT_PT } from '../../../types/card-typography'
import { cardKey, cardZones } from '../../../types/card'
import type { Card } from '../../../types/card'
import type { GridLayout } from '../../../types/imposition'
import type { SheetPlan } from '../../../lib/imposition/sheet'
import { ptToMm } from '../../../lib/units'
import { layoutStyledBand, segmentByStyle } from '../../../lib/export/styled-band'
import { toPngBytes } from '../../../lib/export/photo-bytes'

export interface ReviewIssue {
  readonly sheetIndex: number
  readonly cellIndex: number
  readonly documentId: string
  readonly pageNumber: number
  readonly messages: readonly string[]
}

/** Checks the same fonts, band layout and placements as the PDF writer. */
export async function reviewCards(sheets: readonly SheetPlan[], grid: GridLayout, cards: Readonly<Record<string, Card>>): Promise<ReviewIssue[]> {
  const { PDFDocument, StandardFonts } = await import('@cantoo/pdf-lib')
  const pdf = await PDFDocument.create()
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const issues: ReviewIssue[] = []
  for (const [sheetIndex, sheet] of sheets.entries()) for (const place of sheet.placements) {
    const card = cards[cardKey(place.cellIndex, place.documentId, place.pageNumber)]
    const cell = grid.cells.find((item) => item.index === place.cellIndex)
    const messages: string[] = []
    if (card === undefined || cell === undefined) messages.push('Card not ready')
    else {
      if (!card.headerText.trim()) messages.push('Missing top text')
      if (!card.bodyText.trim()) messages.push('Missing bottom text')
      if (card.photo === null) messages.push('Missing photo')
      else if (toPngBytes(card.photo.dataUrl) === null) messages.push('Photo may not export')
      const zones = cardZones(cell.rect, card.bands)
      for (const [name, text, style, runs, zone] of [
        ['Top', card.headerText, card.headerStyle, card.headerRuns ?? [], zones.header],
        ['Bottom', card.bodyText, card.bodyStyle, card.bodyRuns ?? [], zones.footer],
      ] as const) {
        if (!text.trim()) continue
        const input = { text, base: { ...style, text: '' }, runs }
        const segments = segmentByStyle(input)
        try {
          if (segments.some((segment) => !supported(segment.text.replace(/\n/g, ''), segment.bold ? bold : regular))) messages.push(`${name} text has unsupported characters`) 
          const layout = layoutStyledBand(input, zone.yMm, zone.widthMm, zone.heightMm, CARD_TEXT_PT * (card.textScale ?? 1), CARD_LINE_HEIGHT,
            (value, size, isBold) => ptToMm((isBold ? bold : regular).widthOfTextAtSize(value, size)), { paddingMm: 0.8 })
          if (layout.overflow || layout.lines.some((line) => line.widthMm > zone.widthMm - 1.6 + 0.001)) messages.push(`${name} text may clip`)
        } catch { messages.push(`${name} text could not be checked`) }
      }
      const label = card.displayCornerLabel ?? card.cornerLabel ?? ''
      if (label) {
        const size = CARD_TEXT_PT * (card.textScale ?? 1)
        if (!supported(label, bold)) messages.push('Corner label has unsupported characters')
        else if (bold.widthOfTextAtSize(label, size) > Math.max(0, cell.rect.widthMm * 0.22 * 72 / 25.4 - 2)) messages.push('Corner label will be truncated')
      }
    }
    if (messages.length) issues.push({ sheetIndex, cellIndex: place.cellIndex, documentId: place.documentId, pageNumber: place.pageNumber, messages })
  }
  return issues
}
function supported(value: string, font: PDFFont): boolean {
  const codes = new Set(font.getCharacterSet())
  return Array.from(value).every((char) => codes.has(char.codePointAt(0) ?? -1))
}

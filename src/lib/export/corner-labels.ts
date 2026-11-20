import { CARD_TEXT_PT, printedCornerHeightMm } from '../../types/card-typography'
import type { RGB } from '@cantoo/pdf-lib'
import type { Card, RectMm } from '../../types/card'
import { mmToPt } from '../units'
import type { CardCanvas } from './draw-card'

/** Paint the two equal corner overlays after the rest of the card. */
export function drawCornerLabels(canvas: CardCanvas, cell: RectMm, card: Card, rgb: (r: number, g: number, b: number) => RGB): void {
  if (card.displayNumber === undefined) return
  const width = mmToPt(cell.widthMm * 0.22)
  const textScale = card.textScale ?? 1
  const height = mmToPt(printedCornerHeightMm(textScale))
  const size = CARD_TEXT_PT * textScale
  const font = canvas.bold
  const y = canvas.sheetHeightPt - mmToPt(cell.yMm) - height
  const x = mmToPt(cell.xMm)
  const bg = rgb(228 / 255, 228 / 255, 231 / 255)
  const border = rgb(161 / 255, 161 / 255, 170 / 255)
  const texts = [String(card.displayNumber), card.displayCornerLabel ?? card.cornerLabel ?? '']
  for (const [index, text] of texts.entries()) {
    const left = x + (index === 0 ? 0 : mmToPt(cell.widthMm) - width)
    canvas.page.drawRectangle({ x: left, y, width, height, color: bg, borderColor: border, borderWidth: 0.4 })
    // Standard Helvetica cannot encode arbitrary Unicode. Keep supported characters only.
    let safe = ''
    for (const char of text) {
      try {
        font.encodeText(char)
        if (font.widthOfTextAtSize(safe + char, size) > Math.max(0, width - 2)) break
        safe += char
      } catch { /* Unsupported character cannot be printed in this font. */ }
    }
    if (safe !== '') {
      const textWidth = font.widthOfTextAtSize(safe, size)
      const fontHeight = font.heightAtSize(size)
      const descent = fontHeight - font.heightAtSize(size, { descender: false })
      canvas.page.drawText(safe, { x: left + (width - textWidth) / 2, y: y + (height - fontHeight) / 2 + descent, size, font, color: rgb(0, 0, 0) })
    }
  }
}

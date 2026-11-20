import type { RGB } from '@cantoo/pdf-lib'
import type { Card, RectMm } from '../../types/card'
import { mmToPt } from '../units'
import type { CardCanvas } from './draw-card'

/** Paint the two equal corner overlays after the rest of the card. */
export function drawCornerLabels(canvas: CardCanvas, cell: RectMm, card: Card, rgb: (r: number, g: number, b: number) => RGB): void {
  if (card.displayNumber === undefined) return
  const width = mmToPt(cell.widthMm * 0.22)
  const height = mmToPt(5)
  const size = 7 * (card.textScale ?? 1)
  const y = canvas.sheetHeightPt - mmToPt(cell.yMm) - height
  const x = mmToPt(cell.xMm)
  const bg = rgb(228 / 255, 228 / 255, 231 / 255)
  const border = rgb(161 / 255, 161 / 255, 170 / 255)
  const texts = [String(card.displayNumber), card.cornerLabel ?? '']
  for (const [index, text] of texts.entries()) {
    const left = x + (index === 0 ? 0 : mmToPt(cell.widthMm) - width)
    canvas.page.drawRectangle({ x: left, y, width, height, color: bg, borderColor: border, borderWidth: 0.4 })
    // Standard Helvetica cannot encode arbitrary Unicode. Keep supported characters only.
    let safe = ''
    for (const char of text) {
      try {
        canvas.regular.encodeText(char)
        if (canvas.regular.widthOfTextAtSize(safe + char, size) > Math.max(0, width - 2)) break
        safe += char
      } catch { /* Unsupported character cannot be printed in this font. */ }
    }
    if (safe !== '') canvas.page.drawText(safe, { x: left + 1, y: y + Math.max(1, (height - size) / 2), size, font: canvas.regular, color: rgb(0, 0, 0) })
  }
}

import { PDFDocument, StandardFonts, rgb } from '@cantoo/pdf-lib'
import { describe, expect, it, vi } from 'vitest'
import { drawCornerLabels } from '../../lib/export/corner-labels'
import type { CardCanvas } from '../../lib/export/draw-card'
import { blankCard } from '../../features/workspace/cards/use-cards'
import { CARD_TEXT_PT, cornerHeightMm, printedCornerHeightMm } from '../../types/card-typography'
import { mmToPt } from '../../lib/units'

describe('corner box PDF geometry', () => {
  it.each([0.6, 1, 1.5, 2])('centres bold text in equal padded boxes at %s scale without drawing an arrow', async (scale) => {
    const doc = await PDFDocument.create()
    const regular = await doc.embedFont(StandardFonts.Helvetica)
    const bold = await doc.embedFont(StandardFonts.HelveticaBold)
    const drawRectangle = vi.fn()
    const drawText = vi.fn()
    const page = { drawRectangle, drawText } as unknown as CardCanvas['page']
    const canvas: CardCanvas = { page, bold, regular, sheetHeightPt: mmToPt(297) }
    const cell = { xMm: 4, yMm: 4, widthMm: 52, heightMm: 67 }
    drawCornerLabels(canvas, cell, { ...blankCard(67), displayNumber: 8, cornerLabel: 'A', textScale: scale }, rgb)
    expect(drawRectangle).toHaveBeenCalledTimes(2)
    expect(drawText).toHaveBeenCalledTimes(2)
    for (let i = 0; i < 2; i += 1) {
      const box = drawRectangle.mock.calls[i]![0]
      const [text, options] = drawText.mock.calls[i]!
      expect(box.height).toBeCloseTo(mmToPt(printedCornerHeightMm(scale)), 6)
      expect(box.height).toBeLessThan(mmToPt(cornerHeightMm(scale)))
      expect(options.font).toBe(bold)
      expect(options.size).toBe(CARD_TEXT_PT * scale)
      expect(options.x + bold.widthOfTextAtSize(text, options.size) / 2).toBeCloseTo(box.x + box.width / 2, 6)
      const height = bold.heightAtSize(options.size)
      const descent = height - bold.heightAtSize(options.size, { descender: false })
      expect(options.y - descent + height / 2).toBeCloseTo(box.y + box.height / 2, 6)
      expect(box.height).toBeGreaterThan(height)
    }
  })
})

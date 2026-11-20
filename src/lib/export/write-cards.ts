import { drawCornerLabels } from './corner-labels'
import { mmToPt } from '../units'
import { cutMarksFor, planSheets } from './placement'
import type { PageRef } from '../imposition/sheet'
import type { GridLayout, SheetSettings } from '../../types/imposition'
import { cardKey } from '../../types/card'
import type { Card } from '../../types/card'
import { drawCard } from './draw-card'
import type { CardCanvas } from './draw-card'
import { photoFor } from './photo-bytes'
import type { PhotoSource } from '../../types/card'

export interface CardExportInput {
  readonly settings: SheetSettings
  readonly grid: GridLayout
  readonly pages: readonly PageRef[]
  /** Source bytes per document id, used only to prove a page exists. */
  readonly sources: ReadonlyMap<string, ArrayBuffer>
  readonly drawCutMarks: boolean
  /** Every card, keyed `cellIndex|documentId|pageNumber`. */
  readonly cards: Readonly<Record<string, Card>>
  /** Photo bytes per card, keyed the same way. */
  readonly photos?: Readonly<Record<string, PhotoSource>> | undefined
}

export interface CardExportResult {
  readonly bytes: Uint8Array
  readonly sheetCount: number
  readonly cardsDrawn: number
  readonly cardsSkipped: number
}

/**
 * Builds the printable PDF: one output page per sheet, one card per cell.
 *
 * Text, colour, highlight, band heights and the photo's own framing all come from the
 * same `Card` object the preview renders, so the paper matches the screen by
 * construction rather than by keeping two code paths in step.
 */
export async function writeCards(input: CardExportInput): Promise<CardExportResult> {
  const { settings, grid, pages, sources, drawCutMarks, cards } = input
  const photos = input.photos ?? {}
  const plans = planSheets(pages, grid)

  // pdf-lib is large; the lazy import keeps it out of the app shell (§4.1, §7A).
  const lib = await import('@cantoo/pdf-lib')
  const { PDFDocument, rgb, StandardFonts } = lib

  const out = await PDFDocument.create()
  out.setProducer('CrewBTC')
  out.setCreator('CrewBTC — recipe cards')
  out.setCreationDate(new Date())

  // A page only needs its source to exist; nothing is copied from it, so the original
  // document is never modified and never embedded.
  const knowable = new Set<string>()
  for (const [id, bytes] of sources) {
    try {
      await PDFDocument.load(bytes, { updateMetadata: false })
      knowable.add(id)
    } catch {
      // Unreadable source: its cards are counted as skipped, never faked.
    }
  }

  // Helvetica is standard-14: no embedding cost, and bold is a second standard face.
  let regular = await out.embedFont(StandardFonts.Helvetica)
  const bold = await out.embedFont(StandardFonts.HelveticaBold)

  const sheetHeightPt = mmToPt(settings.sheetHeightMm)
  let cardsDrawn = 0
  let cardsSkipped = 0

  for (const plan of plans) {
    const outPage = out.addPage([mmToPt(settings.sheetWidthMm), mmToPt(settings.sheetHeightMm)])

    if (drawCutMarks) {
      for (const mark of cutMarksFor(grid)) {
        outPage.drawLine({
          start: { x: mmToPt(mark.x1Mm), y: sheetHeightPt - mmToPt(mark.y1Mm) },
          end: { x: mmToPt(mark.x2Mm), y: sheetHeightPt - mmToPt(mark.y2Mm) },
          thickness: 0.25,
          color: rgb(0.75, 0.75, 0.75),
        })
      }
    }

    const canvas: CardCanvas = { page: outPage, regular, bold, sheetHeightPt }
    const cardBorder = rgb(0.83, 0.83, 0.85)

    for (const placement of plan.placements) {
      const cell = grid.cells.find((item) => item.index === placement.cellIndex)
      if (cell === undefined || !knowable.has(placement.documentId)) {
        cardsSkipped += 1
        continue
      }

      /*
        A border around every card, drawn before its contents.

        The preview has shown one since the sheet existed, and the export did not — so a
        card that looked like a card on screen printed as bare paper, and the only thing
        saying where to cut was the registration marks. Drawn first so the zones and the
        photo sit on top of it rather than under a hairline.

        `0.5 pt` at A4 is a hairline that survives a laser printer; the colour is the same
        zinc-200 the screen uses, light enough that a printed card is not framed in grey.
      */
      outPage.drawRectangle({
        x: mmToPt(cell.rect.xMm),
        y: sheetHeightPt - mmToPt(cell.rect.yMm) - mmToPt(cell.rect.heightMm),
        width: mmToPt(cell.rect.widthMm),
        height: mmToPt(cell.rect.heightMm),
        borderColor: cardBorder,
        borderWidth: 0.5,
      })

      const key = cardKey(cell.index, placement.documentId, placement.pageNumber)
      const card = cards[key]
      if (card === undefined) {
        cardsSkipped += 1
        continue
      }

      const png =
        card.photo === null
          ? null
          : photoFor(photos, cell.index, placement.documentId, placement.pageNumber)

      try {
        const placed = await drawCard({
          lib: { rgb, ops: lib, popGraphicsState: lib.popGraphicsState },
          canvas,
          card,
          cell: cell.rect,
          png,
          embed: async (bytes) => {
            try {
              const image = await out.embedPng(bytes)
              return { image, width: image.width, height: image.height }
            } catch {
              return null
            }
          },
        })
        drawCornerLabels(canvas, cell.rect, card, rgb)
        if (placed || card.photo === null) cardsDrawn += 1
      } catch {
        cardsSkipped += 1
      }
    }

    // Fonts are embedded once; reusing them across pages is what keeps the file small.
    regular = canvas.regular
  }

  if (out.getPageCount() === 0) {
    return { bytes: new Uint8Array(0), sheetCount: 0, cardsDrawn: 0, cardsSkipped }
  }

  const bytes = await out.save()
  return { bytes, sheetCount: plans.length, cardsDrawn, cardsSkipped }
}

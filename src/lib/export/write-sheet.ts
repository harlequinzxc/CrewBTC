import type { PDFDocument as PDFDocumentType, PDFFont } from '@cantoo/pdf-lib'
import { mmToPt } from '../units'
import { cutMarksFor, planSheets } from './placement'
import type { PageRef } from '../imposition/sheet'
import type { GridLayout, SheetSettings } from '../../types/imposition'
import { editFor, fittedRectMm } from '../../types/edit'
import { exportKey } from '../pdf/page-text-key'
import { drawableBlocks, wrapText } from './text-blocks'
import type { BlockSource, DrawableBlock } from './text-blocks'

export type { BlockSource, DrawableBlock } from './text-blocks'
export { drawableBlocks, wrapText } from './text-blocks'
import type { PageEdit } from '../../types/edit'

export interface ExportInput {
  readonly settings: SheetSettings
  readonly grid: GridLayout
  readonly pages: readonly PageRef[]
  /** Source bytes per document id. Missing bytes = page is skipped, never faked. */
  readonly sources: ReadonlyMap<string, ArrayBuffer>
  readonly drawCutMarks: boolean
  /** Per-cell text and artwork overrides. Absent means "print every page as-is". */
  readonly edits?: Readonly<Record<string, PageEdit>> | undefined
  /**
   * Text blocks per source page, keyed `file#version#page`. The preview already
   * extracts these; passing them in avoids a second extraction pass at export time.
   * A page missing from this map cannot have its text rebuilt, so its original
   * content is left untouched rather than masked with nothing behind it.
   */
  readonly blocks?: Readonly<Record<string, readonly BlockSource[]>> | undefined
}

export interface ExportResult {
  readonly bytes: Uint8Array
  readonly sheetCount: number
  readonly pagesPlaced: number
  readonly pagesSkipped: number
  /** Edited blocks that could not be drawn because their position was unknown. */
  readonly pagesUnedited: number
}

/**
 * Builds a print-ready multi-page PDF: one output page per sheet, every page drawn as
 * a vector Form XObject so its own fonts stay intact.
 *
 * Editing works by masking, not by rebuilding: an edited block is covered with an
 * opaque rectangle and re-typeset on top. Nothing is rasterised, so the rest of the
 * page keeps full vector fidelity — but the original glyphs remain underneath the mask,
 * which means the exported file still *contains* the old text for a text extractor even
 * though it can never be seen or printed.
 */
export async function writeSheets(input: ExportInput): Promise<ExportResult> {
  const { settings, grid, pages, sources, drawCutMarks } = input
  const edits = input.edits ?? {}
  const blocksByPage = input.blocks ?? {}
  const plans = planSheets(pages, grid)

  // pdf-lib is ~130 KB gzip. Importing it lazily keeps it out of the app shell, which
  // is the difference between an 83 KB first load and a 330 KB one (§4.1, §7A).
  const { PDFDocument, rgb, StandardFonts } = await import('@cantoo/pdf-lib')

  const out = await PDFDocument.create()
  out.setProducer('CrewBTC')
  out.setCreator('CrewBTC — batch imposition')
  out.setCreationDate(new Date())

  // One embedded source document per input file, reused across every placement.
  const sourceDocs = new Map<string, PDFDocumentType>()
  let pagesSkipped = 0

  for (const [id, bytes] of sources) {
    try {
      // `updateMetadata: false` keeps the original document untouched.
      sourceDocs.set(id, await PDFDocument.load(bytes, { updateMetadata: false }))
    } catch {
      // Unreadable source: its pages are skipped and counted, not silently dropped.
    }
  }

  // Helvetica is standard-14, so it needs no embedding and adds no weight to files
  // where nothing was edited. Created on first use.
  let font: PDFFont | null = null
  const getFont = async (): Promise<PDFFont> => {
    font ??= await out.embedFont(StandardFonts.Helvetica)
    return font
  }

  /** Masks each edited block and re-typesets it on top, in place. */
  const drawEditedText = async (
    outPage: ReturnType<PDFDocumentType['addPage']>,
    blocks: readonly DrawableBlock[],
    paperTopPt: number,
  ): Promise<void> => {
    if (blocks.length === 0) return
    const typeface = await getFont()

    for (const block of blocks) {
      const widthPt = mmToPt(block.widthMm)
      if (widthPt <= 1) continue

      // Mask the original glyphs. A little padding covers ascenders and descenders
      // that sit outside the block's measured box, so no old text peeks through.
      const padMm = 0.6
      const maskX = mmToPt(block.xMm - padMm)
      const maskW = mmToPt(block.widthMm + padMm * 2)
      const maskH = mmToPt(block.heightMm + padMm * 2)
      outPage.drawRectangle({
        x: maskX,
        y: paperTopPt - mmToPt(block.yMm + block.heightMm + padMm),
        width: maskW,
        height: maskH,
        color: rgb(1, 1, 1),
      })

      const lines = wrapText(block.text, widthPt, (candidate) =>
        typeface.widthOfTextAtSize(candidate, block.sizePt),
      )
      const leading = block.sizePt * 1.2

      lines.forEach((line, index) => {
        outPage.drawText(line, {
          x: maskX,
          y: paperTopPt - mmToPt(block.yMm) - block.sizePt - index * leading,
          size: block.sizePt,
          font: typeface,
          color: rgb(0.07, 0.07, 0.09),
        })
      })
    }
  }

  const sheetHeightPt = mmToPt(settings.sheetHeightMm)
  let pagesPlaced = 0
  let pagesUnedited = 0

  for (const plan of plans) {
    const outPage = out.addPage([
      mmToPt(settings.sheetWidthMm),
      mmToPt(settings.sheetHeightMm),
    ])

    // Optional cut guides, drawn first so content always sits on top of them.
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

    for (const placement of plan.placements) {
      const sourceDoc = sourceDocs.get(placement.documentId)
      if (sourceDoc === undefined) {
        pagesSkipped += 1
        continue
      }

      const sourcePage = sourceDoc.getPages()[placement.pageNumber - 1]
      if (sourcePage === undefined) {
        pagesSkipped += 1
        continue
      }

      const cell = grid.cells.find((item) => item.index === placement.cellIndex)
      if (cell === undefined) {
        pagesSkipped += 1
        continue
      }

      const edit = editFor(edits, placement.cellIndex, placement.documentId, placement.pageNumber)
      const editedBlockIds = Object.keys(edit.text).filter(
        (id) => (edit.text[id] ?? '').trim() !== '',
      )

      try {
        const fitted = fittedRectMm(cell, placement.sourceWidthMm, placement.sourceHeightMm, edit.image)
        if (fitted === null) {
          pagesSkipped += 1
          continue
        }

        const embedded = await out.embedPage(sourcePage)
        const xScale = mmToPt(fitted.widthMm) / embedded.width
        const yScale = mmToPt(fitted.heightMm) / embedded.height

        if (!Number.isFinite(xScale) || !Number.isFinite(yScale) || xScale <= 0 || yScale <= 0) {
          pagesSkipped += 1
          continue
        }

        // PDF space has a bottom-left origin; our geometry is top-left.
        const left = cell.rect.xMm + fitted.xMm
        const top = cell.rect.yMm + fitted.yMm
        const x = mmToPt(left)
        const y = sheetHeightPt - mmToPt(top) - mmToPt(fitted.heightMm)

        outPage.drawPage(embedded, { x, y, xScale, yScale })
        pagesPlaced += 1

        // Text is drawn after the artwork so it always sits on top of it.
        if (editedBlockIds.length > 0) {
          const regions = blocksByPage[exportKey(placement.documentId, placement.pageNumber)] ?? []
          // Only blocks with a known region are ever drawn: a mask we cannot size would
          // either erase content or stack new text on live glyphs. Anything left over is
          // counted and reported, so an export is never quietly wrong.
          const blocks = drawableBlocks(edit, regions, {
            xMm: cell.rect.xMm + fitted.xMm,
            yMm: cell.rect.yMm + fitted.yMm,
            widthMm: fitted.widthMm,
            heightMm: fitted.heightMm,
          })
          pagesUnedited += editedBlockIds.length - blocks.length
          await drawEditedText(outPage, blocks, sheetHeightPt)
        }
      } catch {
        pagesSkipped += 1
        continue
      }
    }
  }

  // pdf-lib cannot serialise a zero-page document. With nothing to place, return an
  // empty byte array and let the caller report it rather than shipping a blank page.
  if (plans.length === 0) {
    return { bytes: new Uint8Array(0), sheetCount: 0, pagesPlaced: 0, pagesSkipped, pagesUnedited }
  }

  const bytes = await out.save()
  return { bytes, sheetCount: plans.length, pagesPlaced, pagesSkipped, pagesUnedited }
}

// Re-exported so callers keep importing one module for export concerns.
export { downloadBytes } from './download'

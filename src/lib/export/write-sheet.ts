import type { PDFDocument as PDFDocumentType } from '@cantoo/pdf-lib'
import { mmToPt } from '../units'
import { cutMarksFor, containFit, planSheets } from './placement'
import type { PageRef } from '../imposition/sheet'
import type { GridLayout, SheetSettings } from '../../types/imposition'

export interface ExportInput {
  readonly settings: SheetSettings
  readonly grid: GridLayout
  readonly pages: readonly PageRef[]
  /** Source bytes per document id. Missing bytes = page is skipped, never faked. */
  readonly sources: ReadonlyMap<string, ArrayBuffer>
  readonly drawCutMarks: boolean
}

export interface ExportResult {
  readonly bytes: Uint8Array
  readonly sheetCount: number
  readonly pagesPlaced: number
  readonly pagesSkipped: number
}

/**
 * Builds a print-ready multi-page PDF: one output page per sheet, every source page
 * embedded as a vector Form XObject and drawn into its grid cell.
 *
 * Nothing is rasterised and nothing is re-typeset — the source content stays vector,
 * with its own fonts and images, which is the whole point of rebuild-by-placement.
 */
export async function writeSheets(input: ExportInput): Promise<ExportResult> {
  const { settings, grid, pages, sources, drawCutMarks } = input
  const plans = planSheets(pages, grid)

  // pdf-lib is ~130 KB gzip. Importing it lazily keeps it out of the app shell, which
  // is the difference between an 83 KB first load and a 330 KB one (§4.1, §7A).
  const { PDFDocument, rgb } = await import('@cantoo/pdf-lib')

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

  const sheetHeightPt = mmToPt(settings.sheetHeightMm)
  let pagesPlaced = 0

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

      const sourcePages = sourceDoc.getPages()
      const sourcePage = sourcePages[placement.pageNumber - 1]
      if (sourcePage === undefined) {
        pagesSkipped += 1
        continue
      }

      try {
        const embedded = await out.embedPage(sourcePage)
        const fitted = containFit(placement.sourceWidthMm, placement.sourceHeightMm, {
          xMm: placement.rect.xMm,
          yMm: placement.rect.yMm,
          widthMm: placement.rect.widthMm,
          heightMm: placement.rect.heightMm,
        })
        if (fitted === null) {
          pagesSkipped += 1
          continue
        }

        // PDF space has a bottom-left origin; our geometry is top-left.
        const x = mmToPt(fitted.xMm)
        const y = sheetHeightPt - mmToPt(fitted.yMm) - mmToPt(fitted.heightMm)
        const xScale = mmToPt(fitted.widthMm) / embedded.width
        const yScale = mmToPt(fitted.heightMm) / embedded.height

        if (!Number.isFinite(xScale) || !Number.isFinite(yScale) || xScale <= 0 || yScale <= 0) {
          pagesSkipped += 1
          continue
        }

        outPage.drawPage(embedded, { x, y, xScale, yScale })
        pagesPlaced += 1
      } catch {
        pagesSkipped += 1
      }
    }
  }

  // pdf-lib cannot serialise a zero-page document. With nothing to place, return an
  // empty byte array and let the caller report it rather than shipping a blank page.
  if (plans.length === 0) {
    return { bytes: new Uint8Array(0), sheetCount: 0, pagesPlaced: 0, pagesSkipped }
  }

  const bytes = await out.save()
  return { bytes, sheetCount: plans.length, pagesPlaced, pagesSkipped }
}

export function downloadBytes(bytes: Uint8Array, fileName: string): void {
  // Copy into a fresh buffer so the Blob never aliases pdf-lib's internal view.
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  const blob = new Blob([copy], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  // Revoke on the next tick so Safari has time to start the download.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

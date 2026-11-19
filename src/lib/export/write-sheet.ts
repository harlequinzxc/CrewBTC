import type { PDFDocument as PDFDocumentType, PDFFont } from '@cantoo/pdf-lib'
import { mmToPt } from '../units'
import { cutMarksFor, planSheets } from './placement'
import type { PageRef } from '../imposition/sheet'
import type { GridLayout, SheetSettings } from '../../types/imposition'
import { cellZones, coverRectMm, DEFAULT_IMAGE_TRANSFORM, textFor } from '../../types/edit'
import type { CellText, ImageTransform } from '../../types/edit'
import { drawCellText } from './cell-text'
import { photoFor } from './photo-bytes'
import { pushBandClip } from './band-clip'

export interface ExportInput {
  readonly settings: SheetSettings
  readonly grid: GridLayout
  readonly pages: readonly PageRef[]
  /** Source bytes per document id. Missing bytes = page is skipped, never faked. */
  readonly sources: ReadonlyMap<string, ArrayBuffer>
  readonly drawCutMarks: boolean
  /** Pasted text per cell. Absent means the card carries no text. */
  readonly texts?: Readonly<Record<string, CellText>> | undefined
  /** Artwork transforms per cell. Absent means each page just covers its box. */
  readonly images?: Readonly<Record<string, ImageTransform>> | undefined
  /**
   * Extracted dish photo per cell key `cellIndex|documentId|pageNumber`, as a PNG data
   * URL. When present the picture band holds only this photo; the source page is never
   * drawn into a card.
   */
  readonly photos?: Readonly<Record<string, string>> | undefined
  /** Text colour and highlight per cell band. */
  readonly styles?:
    | Readonly<
        Record<
          string,
          { readonly color: string; readonly highlight: string | null } | undefined
        >
      >
    | undefined
}

export interface ExportResult {
  readonly bytes: Uint8Array
  readonly sheetCount: number
  readonly pagesPlaced: number
  readonly pagesSkipped: number
}

/**
 * Builds a print-ready multi-page PDF: one output page per sheet.
 *
 * Each cell is three contiguous bands — header text, picture, footer text — so the
 * page fills the card and nothing is left blank. The picture is scaled to *cover* its
 * band and then clipped, so artwork can be moved and zoomed without spilling into the
 * text or across a cut line.
 */
export async function writeSheets(input: ExportInput): Promise<ExportResult> {
  const { settings, grid, pages, sources, drawCutMarks } = input
  const texts = input.texts ?? {}
  const images = input.images ?? {}
  const photos = input.photos ?? {}
  const styles = input.styles ?? {}
  const plans = planSheets(pages, grid)

  // pdf-lib is ~130 KB gzip. Importing it lazily keeps it out of the app shell, which
  // is the difference between an 83 KB first load and a 330 KB one (§4.1, §7A).
  const lib = await import('@cantoo/pdf-lib')
  const { PDFDocument, rgb, StandardFonts } = lib

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
  // where nothing was typed. Created on first use.
  let font: PDFFont | null = null
  const getFont = async (): Promise<PDFFont> => {
    font ??= await out.embedFont(StandardFonts.Helvetica)
    return font
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

      const zones = cellZones(cell.rect, {
        headerMm: settings.headerMm,
        pictureMm: Math.max(
          0,
          cell.rect.heightMm - settings.headerMm - settings.footerMm,
        ),
        footerMm: settings.footerMm,
      })

      const transform =
        images[`${cell.index}|${placement.documentId}|${placement.pageNumber}`] ??
        DEFAULT_IMAGE_TRANSFORM

      const covered = coverRectMm(
        zones.picture,
        placement.sourceWidthMm,
        placement.sourceHeightMm,
        transform,
      )

      try {
        if (covered !== null) {
          const x = mmToPt(covered.xMm)
          const y = sheetHeightPt - mmToPt(covered.yMm) - mmToPt(covered.heightMm)

          const png = photoFor(photos, cell.index, placement.documentId, placement.pageNumber)

          if (png === null) {
            // No extractable photo on this page. Drawing the source page instead would
            // put its printed title and border box straight back into the card, which is
            // the thing this export exists to stop. An empty band is the honest result.
            pagesSkipped += 1
          } else {
            // The dish photo alone: no printed type, no box from the source page.
            const image = await out.embedPng(png)
            const xScale = mmToPt(covered.widthMm) / image.width
            const yScale = mmToPt(covered.heightMm) / image.height

            if (Number.isFinite(xScale) && Number.isFinite(yScale) && xScale > 0 && yScale > 0) {
              // Clip to the picture band so a zoomed image cannot bleed into the text
              // or across the gutter. The clip is real PDF state, not a drawing trick.
              pushBandClip(lib, outPage, zones.picture, sheetHeightPt)
              outPage.drawImage(image, {
                x,
                y,
                width: mmToPt(covered.widthMm),
                height: mmToPt(covered.heightMm),
              })
              outPage.pushOperators(lib.popGraphicsState())
              pagesPlaced += 1
            } else {
              pagesSkipped += 1
            }
          }
        } else {
          pagesSkipped += 1
        }
      } catch {
        pagesSkipped += 1
        continue
      }

      // Text is drawn after the artwork, in the header and footer bands. It is never
      // inside the clip, so a framed picture cannot cover the words.
      const raw = textFor(texts, cell.index, placement.documentId, placement.pageNumber)
      if (raw.trim() !== '') {
        const styleFor = (band: 'header' | 'footer') =>
          styles?.[`${cell.index}|${band}`] ?? styles?.[`${placement.cellIndex}|${band}`]
        drawCellText({
          page: outPage,
          font: await getFont(),
          zones,
          text: raw,
          sheetHeightPt,
          ink: { header: rgb(0.07, 0.07, 0.09), footer: rgb(0.35, 0.35, 0.38) },
          styles: { header: styleFor('header'), footer: styleFor('footer') },
        })
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

// Re-exported so callers keep importing one module for export concerns.
export { downloadBytes } from './download'

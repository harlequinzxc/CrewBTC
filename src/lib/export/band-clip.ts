import { mmToPt } from '../units'
import type { PDFOperator } from '@cantoo/pdf-lib'

/** The slice of pdf-lib's operator API this needs; keeps the import lazy-friendly. */
export interface ClipOps {
  readonly pushGraphicsState: () => PDFOperator
  readonly moveTo: (x: number, y: number) => PDFOperator
  readonly lineTo: (x: number, y: number) => PDFOperator
  readonly closePath: () => PDFOperator
  readonly clip: () => PDFOperator
  readonly endPath: () => PDFOperator
}

interface OperatorTarget {
  readonly pushOperators: (...operators: PDFOperator[]) => void
}

interface Band {
  readonly xMm: number
  readonly yMm: number
  readonly widthMm: number
  readonly heightMm: number
}

/**
 * Clips subsequent drawing to one band of the sheet.
 *
 * The clip is real PDF graphics state rather than a drawing trick, so a photo scaled to
 * cover its band cannot spill into the header, the footer, or across a cut line. The
 * caller closes the state with `popGraphicsState()` once the picture is drawn.
 */
export function pushBandClip(
  ops: ClipOps,
  page: OperatorTarget,
  band: Band,
  sheetHeightPt: number,
): void {
  // PDF's origin is bottom-left, so a band's top edge is measured from the paper's top.
  const y = (mmFromTop: number): number => sheetHeightPt - mmToPt(mmFromTop)

  const corners = [
    [band.xMm, band.yMm],
    [band.xMm + band.widthMm, band.yMm],
    [band.xMm + band.widthMm, band.yMm + band.heightMm],
    [band.xMm, band.yMm + band.heightMm],
  ] as const

  const [first, ...rest] = corners.map(([xMm, yMm]) => ({ x: mmToPt(xMm), y: y(yMm) }))
  if (first === undefined) return

  page.pushOperators(
    ops.pushGraphicsState(),
    ops.moveTo(first.x, first.y),
    ...rest.map((point) => ops.lineTo(point.x, point.y)),
    ops.closePath(),
    ops.clip(),
    ops.endPath(),
  )
}

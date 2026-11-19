import type { CellSlot, GridLayout } from '../../types/imposition'
import { containFit } from './grid'

/** One page scheduled onto one cell. */
export interface Placement {
  readonly cellIndex: number
  readonly documentId: string
  readonly pageNumber: number
  readonly fileName: string
  /** Where the page lands on the sheet, in mm from the sheet's top-left. */
  readonly rect: {
    readonly xMm: number
    readonly yMm: number
    readonly widthMm: number
    readonly heightMm: number
  }
}

export interface SheetPlan {
  readonly sheetNumber: number
  readonly placements: readonly Placement[]
  readonly emptyCells: number
}

export interface PageRef {
  readonly documentId: string
  readonly fileName: string
  readonly pageNumber: number
  /** Source page size in mm. */
  readonly widthMm: number
  readonly heightMm: number
}

export interface PlanOptions {
  /** Vertical gutter centre for trim marks; ignored when gutter is 0. */
  readonly drawCutMarks?: boolean
}

/**
 * Orders pages into sheets in reading order: row by row, left to right.
 * Pages that cannot fit are skipped rather than cropping the source.
 */
export function planSheets(pages: readonly PageRef[], grid: GridLayout): readonly SheetPlan[] {
  if (grid.isEmpty || grid.cellCount <= 0 || pages.length === 0) return []

  const sheets: SheetPlan[] = []
  let cursor = 0
  let sheetNumber = 1

  while (cursor < pages.length) {
    const placements: Placement[] = []
    const cells = grid.cells.slice(0, grid.cellCount)

    for (const cell of cells) {
      const page = pages[cursor]
      if (page === undefined) break
      cursor += 1

      const fitted = containFit(page.widthMm, page.heightMm, cell.rect)
      if (fitted === null) continue

      placements.push({
        cellIndex: cell.index,
        documentId: page.documentId,
        pageNumber: page.pageNumber,
        fileName: page.fileName,
        rect: fitted,
      })
    }

    if (placements.length === 0) break

    sheets.push({
      sheetNumber,
      placements,
      emptyCells: Math.max(0, grid.cellCount - placements.length),
    })

    sheetNumber += 1
  }

  return sheets
}

/** Trim marks on the gutter centrelines, so scissors follow a single straight line. */
export function cutMarksFor(grid: GridLayout): readonly {
  readonly x1Mm: number
  readonly y1Mm: number
  readonly x2Mm: number
  readonly y2Mm: number
}[] {
  if (grid.isEmpty) return []

  const gutter = grid.gutterMm
  if (gutter <= 0) return []

  const marks: { x1Mm: number; y1Mm: number; x2Mm: number; y2Mm: number }[] = []
  const sheetBottom = grid.cells.reduce(
    (lowest, cell) => Math.max(lowest, cell.rect.yMm + cell.rect.heightMm),
    0,
  )
  const sheetRight = grid.cells.reduce(
    (widest, cell) => Math.max(widest, cell.rect.xMm + cell.rect.widthMm),
    0,
  )

  for (let column = 0; column < grid.columns - 1; column += 1) {
    const first = grid.cells[column]
    if (first === undefined) continue
    const x = Math.round((first.rect.xMm + first.rect.widthMm + gutter / 2) * 100) / 100
    marks.push({ x1Mm: x, y1Mm: 0, x2Mm: x, y2Mm: sheetBottom })
  }

  for (let row = 0; row < grid.rows - 1; row += 1) {
    const first = grid.cells[row * grid.columns]
    if (first === undefined) continue
    const y = Math.round((first.rect.yMm + first.rect.heightMm + gutter / 2) * 100) / 100
    marks.push({ x1Mm: 0, y1Mm: y, x2Mm: sheetRight, y2Mm: y })
  }

  return marks
}

/** Convenience: which cell (if any) contains a point, for hit-testing the preview. */
export function cellAtPoint(grid: GridLayout, xMm: number, yMm: number): CellSlot | null {
  for (const cell of grid.cells) {
    const { xMm: x, yMm: y, widthMm: w, heightMm: h } = cell.rect
    if (xMm >= x && xMm <= x + w && yMm >= y && yMm <= y + h) return cell
  }
  return null
}

import type { CellSlot, GridLayout, SheetSettings } from '../../types/imposition'
import { SHEET_LIMITS } from '../../types/imposition'

const finite = (value: number, fallback = 0): number =>
  Number.isFinite(value) ? value : fallback

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

/**
 * Fits as many whole cells as possible onto the sheet, leaving `gutterMm` between
 * neighbours for a scissors channel and `marginMm` clear at the paper edge.
 *
 * Pure and total: invalid input yields an empty grid rather than NaN geometry, so a
 * malformed setting can never reach a render or a PDF page.
 */
export function computeGrid(settings: SheetSettings): GridLayout {
  const sheetW = finite(settings.sheetWidthMm)
  const sheetH = finite(settings.sheetHeightMm)

  const rawCellW = finite(settings.cellWidthMm)
  const rawCellH = finite(settings.cellHeightMm)
  const cellW = settings.rotateCells ? rawCellH : rawCellW
  const cellH = settings.rotateCells ? rawCellW : rawCellH

  const gutter = Math.max(0, finite(settings.gutterMm))
  const margin = Math.max(0, finite(settings.marginMm))

  const empty = (): GridLayout => ({
    columns: 0,
    rows: 0,
    cellCount: 0,
    cells: [],
    cellWidthMm: Math.max(0, cellW),
    cellHeightMm: Math.max(0, cellH),
    gutterMm: gutter,
    marginMm: margin,
    utilisationPercent: 0,
    slackRightMm: 0,
    slackBottomMm: 0,
    isEmpty: true,
  })

  if (sheetW <= 0 || sheetH <= 0) return empty()
  if (cellW < SHEET_LIMITS.minCellMm || cellH < SHEET_LIMITS.minCellMm) return empty()
  if (margin * 2 >= sheetW || margin * 2 >= sheetH) return empty()

  const usableW = sheetW - margin * 2
  const usableH = sheetH - margin * 2
  if (usableW < cellW || usableH < cellH) return empty()

  // n cells occupy n*cell + (n-1)*gutter, so n = floor((usable + gutter) / (cell + gutter)).
  const columns = Math.floor((usableW + gutter) / (cellW + gutter))
  const rows = Math.floor((usableH + gutter) / (cellH + gutter))
  if (columns < 1 || rows < 1) return empty()

  const cells: CellSlot[] = []
  let index = 0

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      cells.push({
        index,
        row,
        column,
        rect: {
          // Round to a hundredth of a millimetre so repeated addition cannot drift.
          xMm: Math.round((margin + column * (cellW + gutter)) * 100) / 100,
          yMm: Math.round((margin + row * (cellH + gutter)) * 100) / 100,
          widthMm: cellW,
          heightMm: cellH,
        },
      })
      index += 1
    }
  }

  const usedW = columns * cellW + (columns - 1) * gutter
  const usedH = rows * cellH + (rows - 1) * gutter
  const cellArea = columns * rows * cellW * cellH
  const sheetArea = sheetW * sheetH

  return {
    columns,
    rows,
    cellCount: columns * rows,
    cells,
    cellWidthMm: cellW,
    cellHeightMm: cellH,
    gutterMm: gutter,
    marginMm: margin,
    utilisationPercent:
      sheetArea > 0 ? Math.round((cellArea / sheetArea) * 1000) / 10 : 0,
    slackRightMm: Math.max(0, Math.round((usableW - usedW) * 100) / 100),
    slackBottomMm: Math.max(0, Math.round((usableH - usedH) * 100) / 100),
    isEmpty: false,
  }
}

export interface GridValidation {
  readonly ok: boolean
  readonly errors: Readonly<Record<string, string>>
}

export function validateSheet(settings: SheetSettings): GridValidation {
  const errors: Record<string, string> = {}
  const { minSheetMm, maxSheetMm, minCellMm, maxCellMm, maxGutterMm, maxMarginMm } =
    SHEET_LIMITS
  const within = (v: number, lo: number, hi: number): boolean =>
    Number.isFinite(v) && v >= lo && v <= hi

  if (!within(settings.sheetWidthMm, minSheetMm, maxSheetMm)) {
    errors.sheetWidthMm = `Width must be ${minSheetMm}–${maxSheetMm} mm`
  }
  if (!within(settings.sheetHeightMm, minSheetMm, maxSheetMm)) {
    errors.sheetHeightMm = `Height must be ${minSheetMm}–${maxSheetMm} mm`
  }
  if (!within(settings.cellWidthMm, minCellMm, maxCellMm)) {
    errors.cellWidthMm = `Cell width must be ${minCellMm}–${maxCellMm} mm`
  }
  if (!within(settings.cellHeightMm, minCellMm, maxCellMm)) {
    errors.cellHeightMm = `Cell height must be ${minCellMm}–${maxCellMm} mm`
  }
  if (!within(settings.gutterMm, 0, maxGutterMm)) {
    errors.gutterMm = `Gutter must be 0–${maxGutterMm} mm`
  }
  if (!within(settings.marginMm, 0, maxMarginMm)) {
    errors.marginMm = `Margin must be 0–${maxMarginMm} mm`
  }

  if (
    errors.sheetWidthMm === undefined &&
    errors.cellWidthMm === undefined &&
    errors.marginMm === undefined &&
    settings.cellWidthMm + settings.marginMm * 2 > settings.sheetWidthMm
  ) {
    errors.cellWidthMm = 'Cell is wider than the sheet allows'
  }

  return { ok: Object.keys(errors).length === 0, errors }
}

/** Number of sheets needed to place every object. Never returns 0 for >0 objects. */
export function sheetCountFor(objectCount: number, cellsPerSheet: number): number {
  if (!Number.isFinite(objectCount) || objectCount <= 0) return 0
  if (!Number.isFinite(cellsPerSheet) || cellsPerSheet <= 0) return 0
  return Math.ceil(objectCount / cellsPerSheet)
}

/**
 * Contain-fit: scale an object's box so it sits entirely inside the cell, centred,
 * preserving aspect ratio. Never crops — a mismatch becomes slack, not lost content.
 */
export function containFit(
  sourceWidthMm: number,
  sourceHeightMm: number,
  cell: { readonly xMm: number; readonly yMm: number; readonly widthMm: number; readonly heightMm: number },
): { readonly xMm: number; readonly yMm: number; readonly widthMm: number; readonly heightMm: number } | null {
  if (
    !Number.isFinite(sourceWidthMm) ||
    !Number.isFinite(sourceHeightMm) ||
    sourceWidthMm <= 0 ||
    sourceHeightMm <= 0
  ) {
    return null
  }

  // A degenerate cell is equally unusable: scaling into it yields a zero-size
  // placement, which would reach the renderer as an invisible object.
  if (
    !Number.isFinite(cell.widthMm) ||
    !Number.isFinite(cell.heightMm) ||
    !Number.isFinite(cell.xMm) ||
    !Number.isFinite(cell.yMm) ||
    cell.widthMm <= 0 ||
    cell.heightMm <= 0
  ) {
    return null
  }

  const scale = Math.min(cell.widthMm / sourceWidthMm, cell.heightMm / sourceHeightMm)
  const widthMm = Math.round(sourceWidthMm * scale * 100) / 100
  const heightMm = Math.round(sourceHeightMm * scale * 100) / 100

  return {
    xMm: Math.round((cell.xMm + (cell.widthMm - widthMm) / 2) * 100) / 100,
    yMm: Math.round((cell.yMm + (cell.heightMm - heightMm) / 2) * 100) / 100,
    widthMm,
    heightMm,
  }
}

/** Clamps a value to a sensible range — shared by the settings inputs. */
export const clampSheetValue = (value: number, min: number, max: number): number =>
  clamp(finite(value, min), min, max)

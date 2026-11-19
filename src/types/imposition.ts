/** Sheet and cell geometry for imposition. All values in millimetres. */

export interface SheetSettings {
  /** Paper width in millimetres. */
  readonly sheetWidthMm: number
  /** Paper height in millimetres. */
  readonly sheetHeightMm: number
  /** Finished cell width in millimetres. */
  readonly cellWidthMm: number
  /** Finished cell height in millimetres. */
  readonly cellHeightMm: number
  /** Gap between cells on both axes — the scissors channel. */
  readonly gutterMm: number
  /** Clear margin from the paper edge to the first cell. */
  readonly marginMm: number
  /** Rotate the whole cell grid 90° on the sheet. */
  readonly rotateCells: boolean
  /** Height of the header text band at the top of every cell, in mm. */
  readonly headerMm: number
  /** Height of the footer text band at the bottom of every cell, in mm. */
  readonly footerMm: number
}

/** A rectangle in millimetres, origin at the sheet's top-left corner. */
export interface RectMm {
  readonly xMm: number
  readonly yMm: number
  readonly widthMm: number
  readonly heightMm: number
}

export interface CellSlot {
  /** Reading order: left to right, top to bottom. */
  readonly index: number
  readonly row: number
  readonly column: number
  readonly rect: RectMm
}

export interface GridLayout {
  readonly columns: number
  readonly rows: number
  readonly cellCount: number
  readonly cells: readonly CellSlot[]
  /** Cell size actually used — swapped when `rotateCells` is on. */
  readonly cellWidthMm: number
  readonly cellHeightMm: number
  /** Gutter the grid was built with, required for cut-mark placement. */
  readonly gutterMm: number
  /** Margin the grid was built with. */
  readonly marginMm: number
  /** Sheet area covered by cells, as a percentage of the full sheet. */
  readonly utilisationPercent: number
  /** Leftover space to the right of and below the grid, in millimetres. */
  readonly slackRightMm: number
  readonly slackBottomMm: number
  /** True when not a single cell fits — the caller must not render an empty sheet. */
  readonly isEmpty: boolean
}

export const DEFAULT_SHEET: SheetSettings = {
  sheetWidthMm: 210,
  sheetHeightMm: 297,
  cellWidthMm: 64,
  cellHeightMm: 90,
  gutterMm: 4,
  marginMm: 4,
  rotateCells: false,
  // 3 x 3 on A4: a 64 x 90 mm card, 83% of the paper, no unused bands.
  // 13 + 57 + 20 = 90 — a title, the dish photo, then the instruction box, which
  // needs more room than a caption because plating steps run to several lines.
  headerMm: 13,
  footerMm: 20,
}

export const SHEET_PRESETS = [
  { id: 'a4', label: 'A4 — 210 × 297 mm', widthMm: 210, heightMm: 297 },
  { id: 'a3', label: 'A3 — 297 × 420 mm', widthMm: 297, heightMm: 420 },
  { id: 'a5', label: 'A5 — 148 × 210 mm', widthMm: 148, heightMm: 210 },
  { id: 'letter', label: 'US Letter — 216 × 279 mm', widthMm: 215.9, heightMm: 279.4 },
  { id: 'square', label: 'Square — 210 × 210 mm', widthMm: 210, heightMm: 210 },
] as const

export const BAND_LIMITS_MM = {
  min: 3,
  max: 60,
} as const

export const SHEET_LIMITS = {
  minSheetMm: 50,
  maxSheetMm: 1200,
  minCellMm: 5,
  maxCellMm: 600,
  maxGutterMm: 40,
  maxMarginMm: 60,
} as const

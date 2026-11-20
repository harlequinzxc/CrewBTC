import { planSheets } from '../../lib/imposition/sheet'
import type { PageRef, Placement, SheetPlan } from '../../lib/imposition/sheet'
import type { GridLayout } from '../../types/imposition'

/**
 * Which sheet is on the canvas.
 *
 * There is no "current sheet" value stored anywhere, because a second source of truth is
 * how a canvas ends up drawing one sheet while the inspector edits a card from another.
 * The sheet is derived from one of two things, in order:
 *
 * 1. **Whatever was navigated to** — a thumbnail click, or the sheet the last selection
 *    came from. This has to come first: cell 4 holds a different page on every sheet, so
 *    "the sheet containing a selected cell" is ambiguous and would always answer sheet 1.
 *    The caller only passes a target when the selection actually *changed*, which is what
 *    keeps a stale target from pinning the view.
 * 2. The sheet holding the active document's first page, so picking a file in the rail
 *    lands on that file's first card.
 *
 * `fallback` covers a cleared selection that has not been re-resolved yet.
 */
export function resolveSheetIndex(
  pages: readonly PageRef[],
  grid: GridLayout,
  input: {
    /** A sheet the user just moved to, or the sheet the current selection came from. */
    readonly target: number | null
    readonly activeDocumentId: string | null
    readonly fallback: number
  },
): number {
  const sheets = planSheets(pages, grid)
  const clamp = (index: number): number => Math.min(Math.max(0, index), Math.max(0, sheets.length - 1))

  if (input.target !== null) return clamp(input.target)

  if (input.activeDocumentId !== null) {
    const sheet = sheets.find((candidate) =>
      candidate.placements.some((item) => item.documentId === input.activeDocumentId),
    )
    if (sheet !== undefined) return sheet.sheetNumber - 1
  }

  return clamp(input.fallback)
}

/** The sheet a page is placed on, or null when it is not on the sheet at all. */
export function sheetIndexOfPage(
  pages: readonly PageRef[],
  grid: GridLayout,
  documentId: string,
  pageNumber: number,
): number | null {
  const sheets = planSheets(pages, grid)
  const sheet = sheets.find((candidate) =>
    candidate.placements.some(
      (item) => item.documentId === documentId && item.pageNumber === pageNumber,
    ),
  )
  return sheet === undefined ? null : sheet.sheetNumber - 1
}

/**
 * The placements belonging to the sheet being drawn.
 *
 * `SheetBody` takes one sheet's placements, which is what makes the canvas show sheet 2
 * rather than sheet 1 with different cards painted onto it.
 */
export function placementsForSheet(
  sheets: readonly SheetPlan[],
  sheetIndex: number,
): readonly Placement[] | undefined {
  return sheets[sheetIndex]?.placements
}

import { planSheets } from '../../lib/imposition/sheet'
import type { PageRef } from '../../lib/imposition/sheet'
import { cardKey } from '../../types/card'
import type { GridLayout } from '../../types/imposition'

/**
 * Which card the inspector should describe, if any.
 *
 * Derived rather than reported: the sheet already knows which cell is selected, and a
 * callback from the canvas into the inspector would be a second source of truth that could
 * disagree with it after a re-placement.
 *
 * The *visible* sheet's placements are the ones that answer. Cell 3 holds a different page
 * on every sheet, so resolving against sheet 1 while the canvas shows sheet 2 would put
 * the wrong card's numbers in the inspector — and edit the wrong card.
 */
export function selectedCardKey(
  selectedCell: number | null,
  grid: GridLayout,
  pages: readonly PageRef[],
  sheetIndex = 0,
): string | null {
  if (selectedCell === null || grid.isEmpty) return null
  const placement = planSheets(pages, grid)[sheetIndex]?.placements.find(
    (item) => item.cellIndex === selectedCell,
  )
  if (placement === undefined) return null
  return cardKey(selectedCell, placement.documentId, placement.pageNumber)
}

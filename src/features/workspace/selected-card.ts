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
 * The sheet the *selection* came from answers. Cell 3 holds a different page on every
 * sheet, and every sheet is now drawn at once, so "the sheet on screen" is no longer a
 * single answer — the cell index alone would resolve against sheet 1 and put the wrong
 * card's numbers in the inspector, then edit the wrong card. `sheetIndex` is therefore
 * the selection's own sheet, falling back to the first one when nothing has said
 * otherwise (a card selected before any navigation, or a test rendering one sheet).
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

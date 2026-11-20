import { planSheets } from '../../lib/imposition/sheet'
import type { PageRef } from '../../lib/imposition/sheet'
import { cardKey } from '../../types/card'
import type { GridLayout } from '../../types/imposition'

/**
 * Which card the inspector should describe, if any.
 *
 * Derived rather than reported: the sheet already knows which cell is selected, and a
 * callback from the canvas into the inspector would be a second source of truth that could
 * disagree with it after a re-placement. The first sheet is the one that is drawn, so the
 * first sheet's placements are the ones that answer.
 */
export function selectedCardKey(
  selectedCell: number | null,
  grid: GridLayout,
  pages: readonly PageRef[],
): string | null {
  if (selectedCell === null || grid.isEmpty) return null
  const placement = planSheets(pages, grid)[0]?.placements.find(
    (item) => item.cellIndex === selectedCell,
  )
  if (placement === undefined) return null
  return cardKey(selectedCell, placement.documentId, placement.pageNumber)
}

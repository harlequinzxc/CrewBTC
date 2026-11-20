import { useCallback, useMemo, useState } from 'react'
import { planSheets } from '../../lib/imposition/sheet'
import type { PageRef, SheetPlan } from '../../lib/imposition/sheet'
import type { GridLayout } from '../../types/imposition'
import { resolveSheetIndex, sheetIndexOfPage } from './sheet-navigation'

/**
 * Which sheet is on the canvas, and every way to move it.
 *
 * Kept in a hook rather than inline in `WorkspaceScreen` because the screen was already at
 * its line budget and this is the one piece of it with a real state machine: a navigation
 * target that must be cleared on selection changes, a selection that must move the canvas
 * when the card it picked is on another sheet, and a file choice in the rail that counts
 * as navigation too.
 *
 * The target is the only stored value, and it is cleared the moment the selection moves —
 * that is what stops a sheet you visited from pinning the view while you work on another.
 */
export interface SheetNavigation {
  readonly sheets: readonly SheetPlan[]
  readonly sheetIndex: number
  /** Select a cell, moving the canvas to the sheet that cell's page lives on. */
  readonly selectCell: (
    cellIndex: number | null,
    page?: { readonly documentId: string; readonly pageNumber: number },
  ) => void
  /** Move the canvas without touching the selection. */
  readonly goToSheet: (sheetIndex: number) => void
}

export function useSheetNavigation(input: {
  readonly pages: readonly PageRef[]
  readonly grid: GridLayout
  readonly activeDocumentId: string | null
  readonly setSelectedCell: (cellIndex: number | null) => void
}): SheetNavigation {
  const { pages, grid, activeDocumentId, setSelectedCell } = input
  const [target, setTarget] = useState<number | null>(null)

  const sheets = useMemo(() => planSheets(pages, grid), [pages, grid])

  const sheetIndex = resolveSheetIndex(pages, grid, {
    target,
    activeDocumentId,
    // A target or the active document always decides before this is consulted; it is the
    // sheet to show when neither has an opinion yet.
    fallback: 0,
  })

  /**
   * Selecting a cell also has to move the canvas when the card is on another sheet — a
   * selection the user cannot see is a bug, and the strip is the only thing that can say
   * where it went. Deselecting clears the target so the next view is free to follow.
   */
  const selectCell = useCallback(
    (cellIndex: number | null, page?: { readonly documentId: string; readonly pageNumber: number }) => {
      if (cellIndex === null) {
        setTarget(null)
        setSelectedCell(null)
        return
      }
      setTarget(
        page === undefined ? null : sheetIndexOfPage(pages, grid, page.documentId, page.pageNumber),
      )
      setSelectedCell(cellIndex)
    },
    [pages, grid, setSelectedCell],
  )

  // Navigating moves the page, never the selection: the card whose numbers are in the
  // inspector stays selected, so looking at sheet 2 does not discard what you were
  // editing on sheet 1.
  const goToSheet = useCallback((index: number) => setTarget(index), [])

  return { sheets, sheetIndex, selectCell, goToSheet }
}

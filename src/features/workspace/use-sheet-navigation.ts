import { useCallback, useMemo, useState } from 'react'
import { planSheets } from '../../lib/imposition/sheet'
import type { PageRef, SheetPlan } from '../../lib/imposition/sheet'
import type { GridLayout } from '../../types/imposition'
import { resolveSheetIndex, sheetIndexOfPage } from './sheet-navigation'

/**
 * Which sheet is on screen, and every way to move it.
 *
 * The canvas draws *every* sheet in one column, so this is no longer "which sheet is
 * rendered" — it is "which sheet is highlighted, and where should the column scroll to".
 * Both answers come from one value, `sheetIndex`, and the two ways of changing it are the
 * two things a user can do: scroll, or click a thumbnail.
 *
 * `scrollTo` is that second one, expressed as a request rather than an imperative call:
 * the canvas owns the scroll container, so it owns the scroll. A request that has been
 * serviced is cleared, which is what keeps a scroll the user then performs by hand from
 * being fought by a navigation that happened a minute ago.
 */
export interface SheetNavigation {
  readonly sheets: readonly SheetPlan[]
  readonly sheetIndex: number
  /**
   * The sheet the *selected cell* lives on, which is not the same as the sheet on screen.
   *
   * Every sheet is drawn at once, and cell 3 exists on all of them, so a bare cell index
   * would put a red ring on twelve cards at once. Selection is a place, and a place on a
   * stack of sheets needs both coordinates.
   */
  readonly selectionSheet: number | null
  /** Scroll the stack to a sheet, without changing the selection. */
  readonly goToSheet: (sheetIndex: number) => void
  /** Report the sheet the viewport has arrived at — the scroll drives the highlight. */
  readonly setVisibleSheet: (sheetIndex: number) => void
  /** A pending scroll request, or null. */
  readonly scrollTo: number | null
  readonly clearScrollTo: () => void
  /** Select a cell, scrolling its sheet into view. */
  readonly selectCell: (
    cellIndex: number | null,
    page?: { readonly documentId: string; readonly pageNumber: number },
  ) => void
}

export function useSheetNavigation(input: {
  readonly pages: readonly PageRef[]
  readonly grid: GridLayout
  readonly activeDocumentId: string | null
  readonly setSelectedCell: (cellIndex: number | null) => void
}): SheetNavigation {
  const { pages, grid, activeDocumentId, setSelectedCell } = input
  const [target, setTarget] = useState<number | null>(null)
  const [visible, setVisible] = useState<number | null>(null)
  const [scrollTo, setScrollTo] = useState<number | null>(null)
  const [selectionSheet, setSelectionSheet] = useState<number | null>(null)

  const sheets = useMemo(() => planSheets(pages, grid), [pages, grid])

  /**
   * Scrolling is the most recent thing the user did to the view, so it wins over a target
   * set by a click that has already been serviced — but not over a target that has not
   * been. `resolveSheetIndex` clamps, so a stale index from a longer document cannot point
   * past the end of a shorter one.
   */
  const sheetIndex = resolveSheetIndex(pages, grid, {
    target: visible ?? target,
    activeDocumentId,
    fallback: 0,
  })

  const goToSheet = useCallback((index: number) => {
    setScrollTo(index)
    setVisible(index)
    setTarget(index)
  }, [])

  const setVisibleSheet = useCallback(
    (index: number) => {
      setVisible((current) => (current === index ? current : index))
      // The scroll itself is the navigation; a leftover target from an earlier click must
      // not keep re-resolving the highlight against where the canvas *was*.
      setTarget((current) => (current === index ? current : null))
    },
    [],
  )

  const clearScrollTo = useCallback(() => setScrollTo(null), [])

  /**
   * Selecting a cell also has to move the canvas when the card is on another sheet — a
   * selection the user cannot see is a bug, and the scroll is the only thing that can say
   * where it went. A file chosen in the rail navigates the same way, through the same
   * scroll request.
   */
  const selectCell = useCallback(
    (
      cellIndex: number | null,
      page?: { readonly documentId: string; readonly pageNumber: number },
    ) => {
      if (cellIndex === null) {
        setSelectionSheet(null)
        setSelectedCell(null)
        return
      }
      const sheet =
        page === undefined ? null : sheetIndexOfPage(pages, grid, page.documentId, page.pageNumber)
      setSelectionSheet(sheet)
      if (sheet !== null) goToSheet(sheet)
      setSelectedCell(cellIndex)
    },
    [pages, grid, setSelectedCell, goToSheet],
  )

  return {
    sheets,
    sheetIndex,
    selectionSheet,
    goToSheet,
    setVisibleSheet,
    scrollTo,
    clearScrollTo,
    selectCell,
  }
}

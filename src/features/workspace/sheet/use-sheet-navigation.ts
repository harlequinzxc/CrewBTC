import { useCallback, useMemo, useState } from 'react'
import { planSheets } from '../../../lib/imposition/sheet'
import type { PageRef, SheetPlan } from '../../../lib/imposition/sheet'
import type { GridLayout } from '../../../types/imposition'
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
   * Selecting a cell records which sheet it is on. **It does not scroll.**
   *
   * It used to, and the reason looked sound: a selection you cannot see is a bug, and with
   * one sheet on screen the card really could be off the page. Both halves of that are
   * false now. Every sheet is drawn and on screen, so a selected card is already visible —
   * and the gesture that selects it is a pointer-down *on the card*, which is also the
   * gesture that places a caret in its text or grabs its photo. Scrolling on that gesture
   * moves the paper out from under the pointer, so the click lands somewhere else and the
   * caret or the drag is destroyed before it begins.
   *
   * Movement is an explicit act, and there are exactly two: the strip, and a file row in
   * the rail. Both call `goToSheet` directly. Selection is not a third one.
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
      setSelectionSheet(
        page === undefined
          ? null
          : sheetIndexOfPage(pages, grid, page.documentId, page.pageNumber),
      )
      setSelectedCell(cellIndex)
    },
    [pages, grid, setSelectedCell],
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

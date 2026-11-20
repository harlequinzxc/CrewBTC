import { useCallback, useMemo } from 'react'
import { firstPlacementOf, placementsByPage } from './sheet-navigation'
import type { PagePlacement } from './sheet-navigation'
import type { PageRef } from '../../lib/imposition/sheet'
import type { GridLayout } from '../../types/imposition'
import type { IngestedDocument } from '../../types/document'

/**
 * The rail's other half: where a file's card is, and how to get to it.
 *
 * The rail already selects a document when its row is clicked. This says *where that
 * document's first page landed*, so the canvas can scroll its sheet into view and put the
 * red ring on its cell — one gesture from a file name to the card, in a batch where
 * finding it by scrolling is the whole problem.
 *
 * The scroll is called here, explicitly, and not left to `selectCell`: selecting a card by
 * pressing it must never move the canvas (it is the same press that places a caret), so
 * navigation belongs at the call sites that mean it. This is one; the strip is the other.
 *
 * Derived from the same plan the canvas draws rather than from the ingest order: the two
 * would agree until the grid changed, at which point the rail would keep pointing at the
 * cell a page used to be in.
 */
export interface PageReveal {
  readonly placements: ReadonlyMap<string, ReadonlyMap<number, PagePlacement>>
  readonly onReveal: (document: IngestedDocument) => void
}

export function usePageReveal(
  pageRefs: readonly PageRef[],
  grid: GridLayout,
  selectCell: (
    cellIndex: number | null,
    page?: { readonly documentId: string; readonly pageNumber: number },
  ) => void,
  goToSheet: (sheetIndex: number) => void,
): PageReveal {
  const placements = useMemo(() => placementsByPage(pageRefs, grid), [pageRefs, grid])

  /**
   * A file with no placed page — a failed parse, or pages that did not fit — has nowhere
   * to point, so it only selects. That is still the useful answer: the rail shows why.
   */
  const onReveal = useCallback(
    (document: IngestedDocument) => {
      const placed = firstPlacementOf(placements, document.fileName)
      if (placed === null) return
      goToSheet(placed.sheetIndex)
      selectCell(placed.cellIndex, {
        documentId: document.fileName,
        pageNumber: placed.pageNumber,
      })
    },
    [placements, selectCell, goToSheet],
  )

  return { placements, onReveal }
}

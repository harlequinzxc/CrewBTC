import { useCallback, useMemo } from 'react'
import { firstPlacementOf, placementsByPage } from './sheet-navigation'
import { scrollCellIntoView } from './scroll-cell-into-view'
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

/**
 * The cell element for a cell index on the sheet now in view.
 *
 * Cells are identified by `data-cell`, which is the same attribute the canvas already uses
 * to key cards. Several sheets render the same index, so the *visible* one is chosen rather
 * than the first in the document: with a stack of sheets, the first match can be off-screen
 * while the one the user is looking at is further down.
 */
function documentElementFor(cellIndex: number): HTMLElement | null {
  const cells = [...document.querySelectorAll<HTMLElement>(`[data-cell="${cellIndex}"]`)]
  if (cells.length === 0) return null
  const onScreen = cells.find((cell) => {
    const box = cell.getBoundingClientRect()
    return box.bottom > 0 && box.top < window.innerHeight
  })
  return onScreen ?? cells[0] ?? null
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

      /*
        Bring the *cell* into view, not just its sheet.

        Scrolling to the sheet's top leaves the card wherever it happens to fall — on a
        viewport shorter than the page that is often below the fold, which is why clicking
        a file could leave the ring visible in the rail and invisible on the paper. The
        ring is drawn by the click; showing it is this.

        Deferred by a frame because the ring is rendered from the selection above: the cell
        exists already, but its box is only final once the commit that selects it lands.
        `scrollTo` runs from an effect, so the browser has had its layout pass by the time
        this frame callback fires.
      */
      window.requestAnimationFrame(() => {
        const cell = documentElementFor(placed.cellIndex)
        if (cell !== null) scrollCellIntoView(cell)
      })
    },
    [placements, selectCell, goToSheet],
  )

  return { placements, onReveal }
}

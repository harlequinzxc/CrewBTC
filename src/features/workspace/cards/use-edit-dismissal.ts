import { useCallback } from 'react'

/**
 * When an edit ends.
 *
 * It used to end when the field lost focus, and that was the bug behind five releases of
 * "clicking the text does nothing". A field blurs for reasons nobody chose: the window
 * losing focus, a scroll, a layout shift, another element claiming focus a frame later. On
 * the machine that reported it, a field was rendered and removed one millisecond apart.
 *
 * So dismissal is decided by **what the user did**, and every such act arrives as its own
 * event rather than being inferred from focus:
 *
 *   - Escape, handled by the field itself.
 *   - A press on a different card, which is `selectCell` here.
 *   - A press on the sheet's ground or margins, which is `deselect` here.
 *   - Clicking a file in the rail, which selects its card and therefore goes through
 *     `selectCell` too.
 *
 * The one case this does not cover is a keyboard user tabbing out of the box. That is a
 * deliberate trade: the alternative has proved, in this app, to close the editor before a
 * caret can be placed in it at all.
 */
export interface EditDismissal {
  /**
   * A press on a card, or on nothing. Ends the edit unless it is the card being edited.
   *
   * `page` is forwarded rather than swallowed. Cell 4 holds a different page on every
   * sheet, so the cell number alone cannot say *which* sheet was pointed at — the caller
   * resolves that to `selectionSheet`, and without it the sheet compares `null` against
   * every index and no card is ever drawn as selected. That also hid the band dividers,
   * which only mount on the selected card. Dropping this argument in v1.8.2 is what made
   * a card look unselected no matter how often it was pressed.
   */
  readonly selectCell: (
    cellIndex: number | null,
    page?: { readonly documentId: string; readonly pageNumber: number },
  ) => void
  /**
   * Every other way an edit ends: Escape, a press on the paper, the field closing itself.
   * The caller clears its own state here; dropping the selection is the sheet's business.
   */
  readonly endEdit: () => void
  /** A press on the paper but not a card. Ends the edit *and* deselects. */
  readonly deselect: () => void
}

export function useEditDismissal(input: {
  readonly editingCell: number | null
  readonly onEndEdit: () => void
  readonly onSelectCell: (
    cellIndex: number | null,
    page?: { readonly documentId: string; readonly pageNumber: number },
  ) => void
  readonly onDeselect: () => void
}): EditDismissal {
  const { editingCell, onEndEdit, onSelectCell, onDeselect } = input

  const selectCell = useCallback(
    (
      cellIndex: number | null,
      page?: { readonly documentId: string; readonly pageNumber: number },
    ) => {
      if (cellIndex !== editingCell) onEndEdit()
      // Forwarded verbatim: this hook decides *when* an edit ends, not who was selected.
      onSelectCell(cellIndex, page)
    },
    [editingCell, onEndEdit, onSelectCell],
  )

  const deselect = useCallback(() => {
    onEndEdit()
    onDeselect()
  }, [onEndEdit, onDeselect])

  return { selectCell, endEdit: onEndEdit, deselect }
}

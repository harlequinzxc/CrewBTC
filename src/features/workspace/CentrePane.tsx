import { DropZone } from './DropZone'
import { CardSheet } from './CardSheet'
import { Button } from '../../components/ui/Button'
import type { PageRef } from '../../lib/imposition/sheet'
import type { GridLayout, SheetSettings } from '../../types/imposition'
import type { Card } from '../../types/card'

export interface CentrePaneProps {
  readonly documentsLoaded: boolean
  readonly busy: boolean
  readonly onFiles: (files: readonly File[]) => void
  readonly onAdd: () => void
  readonly sheet: SheetSettings
  readonly grid: GridLayout
  readonly pages: readonly PageRef[]
  readonly showCutMarks: boolean
  readonly cards: Readonly<Record<string, Card>>
  readonly selectedCell: number | null
  readonly onSelectCell: (cellIndex: number | null) => void
  readonly onCardChange: (key: string, card: Card) => void
}

/**
 * The sheet, or the drop target when there is nothing to show yet.
 *
 * No tabs, no band settings and no separate text editor: everything a card contains is
 * edited on the card itself.
 */
export function CentrePane(props: CentrePaneProps) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-zinc-950">
      {!props.documentsLoaded ? (
        <>
          {/* The grid's arithmetic shows before any upload: a bad cell size or margin is
              something you want to notice before dragging a PDF in, not after. */}
          <div className="flex h-9 shrink-0 items-center gap-3 border-b border-zinc-800 px-3">
            <span className="tabular whitespace-nowrap text-xs text-zinc-300">
              {props.grid.columns} × {props.grid.rows} = {props.grid.cellCount} cells
            </span>
            <span className="tabular whitespace-nowrap text-xs text-zinc-500">
              {props.grid.utilisationPercent}% of paper
            </span>
          </div>
          <div className="grid min-h-0 flex-1 place-items-center overflow-hidden p-6">
          <div className="w-full max-w-sm">
            <DropZone onFiles={props.onFiles} disabled={props.busy} />
            <Button
              variant="primary"
              fullWidth
              className="mt-3"
              onClick={props.onAdd}
              disabled={props.busy}
              loading={props.busy}
            >
              Add PDFs
            </Button>
              <p className="mt-3 text-center text-xs text-zinc-500">
                Each page becomes one card: dish photo, name, and plating steps.
              </p>
            </div>
          </div>
        </>
      ) : (
        <CardSheet
          settings={props.sheet}
          grid={props.grid}
          pages={props.pages}
          cards={props.cards}
          showCutMarks={props.showCutMarks}
          selectedCell={props.selectedCell}
          onSelectCell={props.onSelectCell}
          onCardChange={props.onCardChange}
        />
      )}
    </div>
  )
}

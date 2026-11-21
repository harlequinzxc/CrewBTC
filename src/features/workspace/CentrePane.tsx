import { DropZone } from './files/DropZone'
import { CardSheet } from './sheet/CardSheet'
import type { ReactNode } from 'react'
import type { PageRef } from '../../lib/imposition/sheet'
import type { GridLayout, SheetSettings } from '../../types/imposition'
import type { Card } from '../../types/card'

/**
 * The canvas: the sheet, edge to edge.
 *
 * No metrics bar over the sheet and no caption under it. The grid arithmetic moved into
 * the inspector where the numbers that produce it live, and the sheet now gets every pixel
 * between the top bar and the bottom of the window.
 */
export interface CentrePaneProps {
  readonly documentsLoaded: boolean
  readonly busy: boolean
  readonly onFiles: (files: readonly File[]) => void
  readonly sheet: SheetSettings
  readonly grid: GridLayout
  readonly pages: readonly PageRef[]
  readonly showCutMarks: boolean
  readonly cards: Readonly<Record<string, Card>>
  readonly selectedCell: number | null
  readonly selectionSheet: number | null
  readonly onSelectCell: (cellIndex: number | null) => void
  readonly onCardChange: (key: string, card: Card) => void
  /** Zoom is shared with the top bar, so the sheet and the chrome stay in step. */
  readonly scale: number
  readonly fitting: boolean
  /** Callback ref for the measured canvas region; the top bar's fit depends on it. */
  readonly paneRef: (node: HTMLDivElement | null) => void
  readonly sheetIndex: number
  readonly onVisibleSheetChange: (sheetIndex: number) => void
  readonly scrollTo: number | null
  readonly onScrollToHandled: () => void
  /** The strip, already bound to its data. Rendered under the sheet inside this column. */
  readonly strip: ReactNode
}

export function CentrePane(props: CentrePaneProps) {
  // Destructured so the compiler's ref heuristic does not read `props.onFiles` as a ref.
  const { onFiles, busy, paneRef } = props

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-surface-canvas">
      {!props.documentsLoaded ? (
        <div
          ref={paneRef}
          className="grid min-h-0 flex-1 place-items-center overflow-hidden p-6"
        >
          <DropZone onFiles={onFiles} disabled={busy} />
        </div>
      ) : (
        <CardSheet
          settings={props.sheet}
          grid={props.grid}
          pages={props.pages}
          cards={props.cards}
          showCutMarks={props.showCutMarks}
          selectedCell={props.selectedCell}
          selectionSheet={props.selectionSheet}
          onSelectCell={props.onSelectCell}
          onCardChange={props.onCardChange}
          scale={props.scale}
          fitting={props.fitting}
          paneRef={paneRef}
          sheetIndex={props.sheetIndex}
          onVisibleSheetChange={props.onVisibleSheetChange}
          scrollTo={props.scrollTo}
          onScrollToHandled={props.onScrollToHandled}
        />
      )}

      {/* Inside the centre column, under the sheet: it steals canvas height, never rail
          width, and collapsing it hands that height straight back. */}
      {props.strip}
    </div>
  )
}

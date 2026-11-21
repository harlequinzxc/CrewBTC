import { SheetStrip } from './SheetStrip'
import { cardKey } from '../../../types/card'
import type { SheetPlan } from '../../../lib/imposition/sheet'
import type { GridLayout, SheetSettings } from '../../../types/imposition'
import type { Card } from '../../../types/card'

/**
 * The strip, bound to the workspace's data.
 *
 * Separated from `WorkspaceScreen` so the screen stays a layout and this stays the one
 * place that knows how a placement becomes a card key — the same `cardKey` the canvas and
 * the exporter use, which is what makes a thumbnail show the card you actually see.
 */
export interface SheetStripSlotProps {
  readonly sheets: ReadonlyArray<SheetPlan>
  readonly sheet: SheetSettings
  readonly grid: GridLayout
  readonly cards: Readonly<Record<string, Card>>
  readonly activeIndex: number
  readonly onSelectSheet: (sheetIndex: number) => void
  readonly collapsed: boolean
  readonly onToggleCollapsed: () => void
}

export function SheetStripSlot(props: SheetStripSlotProps) {
  return (
    <SheetStrip
      sheets={props.sheets}
      settings={props.sheet}
      grid={props.grid}
      cards={props.cards}
      keyFor={(placement) =>
        cardKey(placement.cellIndex, placement.documentId, placement.pageNumber)
      }
      activeIndex={props.activeIndex}
      onSelectSheet={props.onSelectSheet}
      collapsed={props.collapsed}
      onToggleCollapsed={props.onToggleCollapsed}
    />
  )
}

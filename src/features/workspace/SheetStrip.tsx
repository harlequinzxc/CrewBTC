import { ChevronDown, Layers } from 'lucide-react'
import { cn } from '../../lib/cn'
import { SheetThumbnail } from './SheetThumbnail'
import type { Placement, SheetPlan } from '../../lib/imposition/sheet'
import type { GridLayout, SheetSettings } from '../../types/imposition'
import type { Card } from '../../types/card'

/**
 * The sheet strip: every page of the document, along the bottom of the canvas.
 *
 * It only exists when there is more than one sheet. With twelve cards on an A4 sheet, two
 * sheets is the point at which "which page am I looking at" stops being answerable from
 * the number in the top bar, so that is when the strip earns its height. Below that it
 * would be a caption for a single sheet, which the top bar already provides.
 *
 * It is pinned to the canvas rather than the window: it lives inside the centre column, so
 * it never runs under the Files rail or the inspector, and collapsing it gives the height
 * back to the sheet rather than to the page.
 */
export interface SheetStripProps {
  readonly sheets: readonly SheetPlan[]
  readonly settings: SheetSettings
  readonly grid: GridLayout
  readonly cards: Readonly<Record<string, Card>>
  readonly keyFor: (placement: Placement) => string
  readonly activeIndex: number
  readonly onSelectSheet: (sheetIndex: number) => void
  readonly collapsed: boolean
  readonly onToggleCollapsed: () => void
}

export function SheetStrip(props: SheetStripProps) {
  // One sheet needs no navigation, and two are the threshold the user gave. `props.sheets`
  // is already the plan, so this is the only place that decides.
  if (props.sheets.length < 2) return null

  const count = props.sheets.length

  if (props.collapsed) {
    return (
      <div className="flex shrink-0 items-center justify-center border-t border-hairline bg-surface-panel py-1">
        <button
          type="button"
          data-target="dense"
          aria-label={`Expand sheet strip, ${count} sheets`}
          aria-expanded="false"
          onClick={props.onToggleCollapsed}
          className={cn(
            'flex h-6 items-center gap-1.5 rounded-full border border-hairline bg-surface-raised px-2.5',
            'text-[11px] text-ink-secondary',
            'transition-colors duration-150 ease-out',
            'hover:border-hairline-strong hover:text-ink-primary focus-visible:border-accent focus-visible:text-ink-primary',
          )}
        >
          <Layers aria-hidden className="size-3" />
          <span className="tabular">
            Sheets ({count})
          </span>
        </button>
      </div>
    )
  }

  return (
    <div className="shrink-0 border-t border-hairline bg-surface-panel">
      {/*
        The header is inside the strip, not over it, and the strip is inside the centre
        column: it can only ever take height from the canvas, never cover it. The count is
        `shrink-0` and the chevron is `shrink-0`, so a long document cannot squeeze either
        one into the thumbnails and clip them.
      */}
      <div className="flex h-7 shrink-0 items-center justify-between px-2">
        <span className="tabular shrink-0 truncate text-[10px] uppercase tracking-[0.06em] text-ink-muted">
          Sheets ({count})
        </span>
        <button
          type="button"
          data-target="dense"
          aria-label="Collapse sheet strip"
          aria-expanded="true"
          onClick={props.onToggleCollapsed}
          className={cn(
            'grid size-6 shrink-0 place-items-center rounded text-ink-secondary',
            'transition-colors duration-150 ease-out',
            'hover:bg-surface-active hover:text-ink-primary focus-visible:bg-surface-active focus-visible:text-ink-primary',
          )}
        >
          <ChevronDown aria-hidden className="size-3.5" />
        </button>
      </div>

      {/*
        Horizontal scroll, not wrap: a fourteen-sheet document must not turn the strip into
        a second page. `snap-x` keeps the active sheet findable after a flick.
      */}
      <ol className="flex snap-x items-end gap-2 overflow-x-auto px-2 pb-2 pt-0.5">
        {props.sheets.map((sheet, index) => (
          <li key={sheet.sheetNumber} className="flex snap-start flex-col items-center gap-1">
            <SheetThumbnail
              sheet={sheet}
              settings={props.settings}
              grid={props.grid}
              cards={props.cards}
              keyFor={props.keyFor}
              active={index === props.activeIndex}
              onSelect={() => props.onSelectSheet(index)}
            />
            <span
              className={cn(
                'tabular text-[9px] leading-none',
                index === props.activeIndex ? 'text-accent-bright' : 'text-ink-muted',
              )}
            >
              {sheet.sheetNumber}
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}

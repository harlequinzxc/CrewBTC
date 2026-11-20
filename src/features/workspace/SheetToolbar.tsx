import { Minus, Plus, Maximize2, RotateCcw } from 'lucide-react'
import { cn } from '../../lib/cn'
import { MAX_ZOOM, MIN_ZOOM, zoomPercent } from '../../lib/zoom'
import type { GridLayout } from '../../types/imposition'

/**
 * The bar above the sheet: what the paper holds, and how big it is drawn.
 *
 * `Fit` is a mode rather than a one-off sum. While it is on, resizing the window keeps the
 * sheet fitted; the moment the user steps the zoom it becomes a fixed scale and the pane
 * scrolls instead of shrinking the paper.
 */

export interface SheetToolbarProps {
  readonly grid: GridLayout
  readonly sheetCount: number
  readonly scale: number
  readonly fitting: boolean
  readonly panned: boolean
  readonly onStep: (direction: 1 | -1) => void
  readonly onFit: () => void
  readonly onResetPan: () => void
}

const button = cn(
  'grid h-8 min-h-8 w-7 place-items-center rounded text-zinc-300 transition-colors duration-150 ease-out',
  'hover:bg-zinc-800 hover:text-zinc-100 focus-visible:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-red-500',
  'disabled:opacity-40 disabled:hover:bg-transparent disabled:focus-visible:bg-transparent',
)

export function SheetToolbar(props: SheetToolbarProps) {
  const { grid, scale } = props

  return (
    <div className="flex h-9 shrink-0 items-center gap-3 overflow-x-auto border-b border-zinc-800 px-3">
      <span className="tabular whitespace-nowrap text-xs text-zinc-300">
        {grid.columns} × {grid.rows} = {grid.cellCount} cells
      </span>
      <span className="tabular whitespace-nowrap text-xs text-zinc-500">
        {grid.utilisationPercent}% of paper
      </span>
      <span className="tabular whitespace-nowrap text-xs text-zinc-500">
        {props.sheetCount} {props.sheetCount === 1 ? 'sheet' : 'sheets'}
      </span>

      <div className="ml-auto flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          data-target="dense"
          aria-label="Zoom out"
          disabled={scale <= MIN_ZOOM + 1e-6}
          onClick={() => props.onStep(-1)}
          className={button}
        >
          <Minus aria-hidden className="size-3.5" />
        </button>
        <span
          aria-live="polite"
          aria-label="Zoom level"
          className="tabular w-12 text-center text-xs text-zinc-300"
        >
          {zoomPercent(scale)}%
        </span>
        <button
          type="button"
          data-target="dense"
          aria-label="Zoom in"
          disabled={scale >= MAX_ZOOM - 1e-6}
          onClick={() => props.onStep(1)}
          className={button}
        >
          <Plus aria-hidden className="size-3.5" />
        </button>
        <button
          type="button"
          data-target="dense"
          aria-label="Fit to window"
          aria-pressed={props.fitting}
          onClick={props.onFit}
          className={cn(button, 'w-auto gap-1 px-2 text-[11px]', props.fitting && 'bg-zinc-800 text-zinc-50')}
        >
          <Maximize2 aria-hidden className="size-3" />
          Fit
        </button>
        <button
          type="button"
          data-target="dense"
          aria-label="Reset pan"
          disabled={!props.panned}
          onClick={props.onResetPan}
          className={button}
        >
          <RotateCcw aria-hidden className="size-3" />
        </button>
      </div>
    </div>
  )
}

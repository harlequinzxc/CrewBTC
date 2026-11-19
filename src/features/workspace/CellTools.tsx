import { Check, RotateCcw, X } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import type { Placement } from '../../lib/imposition/sheet'
import type { ImageTransform } from '../../types/edit'
import { DEFAULT_IMAGE_TRANSFORM } from '../../types/edit'

export interface CellToolsProps {
  readonly placement: Placement
  /** Pixels per millimetre of the preview, for showing the art's scale as a number. */
  readonly transform: ImageTransform
  readonly hasText: boolean
  readonly onImageChange: (image: ImageTransform) => void
  readonly onResetImage: () => void
  readonly onClose: () => void
}

/** One nudge step in millimetres. Small enough to compose, large enough to see. */
const STEP_MM = 1

/**
 * Controls for the selected cell's picture: move it inside its box, zoom it, or put it
 * back. Purely about the image — the wording is edited in the Text tab, so this strip
 * never duplicates that field.
 */
export function CellTools(props: CellToolsProps) {
  const { placement, transform } = props
  const moved = transform.offsetXMm !== 0 || transform.offsetYMm !== 0 || transform.scale !== 1

  const nudge = (dxMm: number, dyMm: number): void => {
    props.onImageChange({
      ...transform,
      offsetXMm: transform.offsetXMm + dxMm,
      offsetYMm: transform.offsetYMm + dyMm,
    })
  }

  const zoom = (factor: number): void => {
    props.onImageChange({ ...transform, scale: transform.scale * factor })
  }

  return (
    <div className="flex h-9 shrink-0 items-stretch border-t border-zinc-700 bg-zinc-900 text-xs">
      <div className="flex shrink-0 items-center gap-2 border-r border-zinc-800 px-3">
        <span className="tabular whitespace-nowrap font-medium text-zinc-200">
          Cell {placement.cellIndex + 1}
        </span>
        <span className="tabular whitespace-nowrap text-zinc-500">
          page {placement.pageNumber}
        </span>
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-1 px-2">
        <span className="whitespace-nowrap pr-1 text-zinc-500">Picture</span>
        <Button size="sm" variant="ghost" onClick={() => nudge(-STEP_MM, 0)} aria-label="Move picture left">
          ←
        </Button>
        <Button size="sm" variant="ghost" onClick={() => nudge(STEP_MM, 0)} aria-label="Move picture right">
          →
        </Button>
        <Button size="sm" variant="ghost" onClick={() => nudge(0, -STEP_MM)} aria-label="Move picture up">
          ↑
        </Button>
        <Button size="sm" variant="ghost" onClick={() => nudge(0, STEP_MM)} aria-label="Move picture down">
          ↓
        </Button>
        <Button size="sm" variant="ghost" onClick={() => zoom(1 / 1.1)} aria-label="Zoom picture out">
          −
        </Button>
        <Button size="sm" variant="ghost" onClick={() => zoom(1.1)} aria-label="Zoom picture in">
          +
        </Button>
        <span className="tabular whitespace-nowrap px-1 text-zinc-500">
          {Math.round(transform.scale * 100)}%
        </span>
        <Button
          size="sm"
          variant="ghost"
          onClick={props.onResetImage}
          disabled={!moved}
          aria-label="Reset picture framing"
        >
          <RotateCcw aria-hidden="true" strokeWidth={2} className="size-3.5" />
          Reset
        </Button>
      </div>

      <div className="flex shrink-0 items-center gap-2 px-2 text-zinc-500">
        {props.hasText ? (
          <span className="flex items-center gap-1 text-amber-400">
            <Check aria-hidden="true" strokeWidth={2} className="size-3" />
            text set
          </span>
        ) : (
          <span className="whitespace-nowrap">no text — add it in the Text tab</span>
        )}
        <button type="button" data-target="dense"
          onClick={props.onClose}
          aria-label="Done editing this cell"
          className="grid min-h-8 min-w-8 place-items-center rounded text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 focus-visible:bg-zinc-800 focus-visible:text-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400"
        >
          <X aria-hidden="true" strokeWidth={2} className="size-3.5" />
        </button>
      </div>
    </div>
  )
}

/** Re-exported so the preview can build a default without importing the type module. */
export const RESET_IMAGE: ImageTransform = DEFAULT_IMAGE_TRANSFORM

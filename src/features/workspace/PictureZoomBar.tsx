import { Maximize2, Move, ZoomIn, ZoomOut } from 'lucide-react'
import { MAX_IMAGE_SCALE, MIN_IMAGE_SCALE } from '../../types/edit'
import type { ImageTransform } from '../../types/edit'

export interface PictureZoomBarProps {
  /** The current zoom, so the slider shows where the photo sits in the range. */
  readonly scale: number
  readonly onZoom: (factor: number) => void
  readonly onReset: () => void
}

/** How much one press of a zoom button changes the picture. */
const STEP = 0.08

const BUTTON =
  'grid h-8 min-h-8 w-6 place-items-center rounded text-zinc-200 ' +
  'transition-colors duration-150 ease-out hover:bg-zinc-700 focus-visible:bg-zinc-700 ' +
  'focus-visible:ring-2 focus-visible:ring-sky-400'

/**
 * The bar that appears at the foot of a photo in move/zoom mode: drag hint, zoom out,
 * a slider, zoom in, and reset. Kept out of `CellPicture` so each file does one job —
 * the picture draws, this bar drives it.
 */
export function PictureZoomBar(props: PictureZoomBarProps) {
  const stop = (event: React.SyntheticEvent): void => event.stopPropagation()

  return (
    <div className="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-zinc-950/85 px-1 py-0.5">
      <Move className="size-3 shrink-0 text-zinc-400" aria-hidden />
      <button
        type="button"
        data-target="dense"
        className={BUTTON}
        aria-label="Zoom out"
        onClick={(event) => {
          stop(event)
          props.onZoom(1 - STEP)
        }}
      >
        <ZoomOut className="size-3" />
      </button>
      <input
        type="range"
        aria-label="Photo zoom"
        className="h-3 min-w-0 flex-1 accent-sky-500"
        min={MIN_IMAGE_SCALE}
        max={MAX_IMAGE_SCALE}
        step={0.05}
        value={props.scale}
        onChange={(event) => {
          const next = Number(event.target.value)
          if (!Number.isFinite(next)) return
          // The slider sets an absolute zoom, so express it as a factor from the current.
          if (props.scale > 0) props.onZoom(next / props.scale)
        }}
        onPointerDown={stop}
        onClick={stop}
      />
      <button
        type="button"
        data-target="dense"
        className={BUTTON}
        aria-label="Zoom in"
        onClick={(event) => {
          stop(event)
          props.onZoom(1 + STEP)
        }}
      >
        <ZoomIn className="size-3" />
      </button>
      <button
        type="button"
        data-target="dense"
        className={BUTTON}
        aria-label="Reset photo framing"
        onClick={(event) => {
          stop(event)
          props.onReset()
        }}
      >
        <Maximize2 className="size-3" />
      </button>
    </div>
  )
}

/** Exported for the type's use in `CellPicture`; keeps the import list honest. */
export type { ImageTransform }

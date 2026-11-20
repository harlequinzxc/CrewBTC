import { useEffect, useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import { containRectMm, MAX_IMAGE_SCALE, MIN_IMAGE_SCALE } from '../../types/card'
import type { ImageTransform, PhotoSource, RectMm } from '../../types/card'

export interface CardZoneImageProps {
  /** The bounded picture box, in millimetres on the sheet. */
  readonly box: RectMm
  readonly photo: PhotoSource | null
  readonly transform: ImageTransform
  readonly scale: number
  readonly editing: boolean
  readonly onBeginEdit: () => void
  readonly onEndEdit: () => void
  readonly onChange: (transform: ImageTransform) => void
}

const ZOOM_STEP = 0.08
const NUDGE_MM = 0.5

const clampScale = (value: number): number => Math.min(MAX_IMAGE_SCALE, Math.max(MIN_IMAGE_SCALE, value))

/**
 * The middle zone: a fixed box the dish photo lives inside.
 *
 * The box clips, so the photo can never reach the text above or below it, whatever zoom
 * or drag was applied. The drawn rectangle comes from the photo's own pixels, so the
 * dish keeps its shape instead of taking the box's.
 *
 * Double-click enters adjust mode: drag pans, the wheel zooms, arrow keys nudge, and
 * Escape or Enter leaves with the framing kept.
 */
export function CardZoneImage(props: CardZoneImageProps) {
  const { box, photo, transform, scale, editing } = props
  const [dragging, setDragging] = useState(false)
  const origin = useRef<{ x: number; y: number; offsetXMm: number; offsetYMm: number } | null>(
    null,
  )
  const rootRef = useRef<HTMLDivElement>(null)
  // Dragging renders on every pointermove; the listeners below read this ref rather than
  // depending on `props`, or they would re-subscribe mid-gesture. Set in an effect
  // because writing a ref during render is unsafe under concurrent rendering.
  const endEditRef = useRef(props.onEndEdit)
  useEffect(() => {
    endEditRef.current = props.onEndEdit
  }, [props.onEndEdit])

  const px = (mm: number): string => `${mm * scale}px`

  useEffect(() => {
    if (!editing) return
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' || event.key === 'Enter') {
        event.preventDefault()
        endEditRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editing])

  // A press outside the box leaves adjust mode, as in any picture editor.
  useEffect(() => {
    if (!editing) return
    const onDown = (event: PointerEvent): void => {
      const root = rootRef.current
      if (root !== null && !root.contains(event.target as Node)) endEditRef.current()
    }
    document.addEventListener('pointerdown', onDown, true)
    return () => document.removeEventListener('pointerdown', onDown, true)
  }, [editing])

  const shapeUnknown = photo !== null && (photo.widthPx <= 0 || photo.heightPx <= 0)
  const drawn =
    photo === null
      ? null
      : shapeUnknown
        ? { xMm: box.xMm, yMm: box.yMm, widthMm: box.widthMm, heightMm: box.heightMm }
        : containRectMm(box, photo.widthPx, photo.heightPx, transform)

  const zoomBy = (factor: number): void => {
    props.onChange({ ...transform, scale: clampScale(transform.scale * factor) })
  }

  const onPointerDown = (event: React.PointerEvent<HTMLButtonElement>): void => {
    if (!editing) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    origin.current = {
      x: event.clientX,
      y: event.clientY,
      offsetXMm: transform.offsetXMm,
      offsetYMm: transform.offsetYMm,
    }
    setDragging(true)
  }

  const onPointerMove = (event: React.PointerEvent<HTMLButtonElement>): void => {
    const from = origin.current
    if (from === null) return
    props.onChange({
      ...transform,
      offsetXMm: from.offsetXMm + (event.clientX - from.x) / scale,
      offsetYMm: from.offsetYMm + (event.clientY - from.y) / scale,
    })
  }

  const endDrag = (event: React.PointerEvent<HTMLButtonElement>): void => {
    if (origin.current === null) return
    origin.current = null
    setDragging(false)
    if (event.currentTarget.hasPointerCapture?.(event.pointerId) === true) {
      event.currentTarget.releasePointerCapture?.(event.pointerId)
    }
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>): void => {
    if (!editing) return
    const step = event.shiftKey ? NUDGE_MM * 4 : NUDGE_MM
    const moves: Record<string, readonly [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    }
    const move = moves[event.key]
    if (move === undefined) return
    event.preventDefault()
    props.onChange({
      ...transform,
      offsetXMm: transform.offsetXMm + move[0],
      offsetYMm: transform.offsetYMm + move[1],
    })
  }

  return (
    <div
      ref={rootRef}
      // A clipping box, not a control. `zone-box` exempts it from the §4.1 target
      // floor: a global `min-height` would stretch it past its band and make the photo
      // overlap the footer.
      className={cn(
        'zone-box absolute overflow-hidden bg-zinc-100',
        // A subtle outline, not a loud one: the photo is the subject, not the frame.
        editing && 'outline outline-2 -outline-offset-2 outline-sky-500',
      )}
      style={{
        left: px(box.xMm),
        top: px(box.yMm),
        width: px(box.widthMm),
        height: px(box.heightMm),
      }}
      data-image={editing ? 'adjusting' : 'idle'}
    >
      {photo === null || drawn === null ? (
        <span className="absolute inset-0 grid place-items-center px-1 text-center text-[8px] leading-tight text-zinc-500">
          No photo on this page
        </span>
      ) : (
        <button
          type="button"
          data-target="dense"
          aria-label="Dish photo — double-click to move and zoom"
          aria-roledescription="movable photo"
          tabIndex={editing ? 0 : -1}
          onDoubleClick={(event) => {
            event.stopPropagation()
            props.onBeginEdit()
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onWheel={
            editing
              ? (event) => {
                  event.preventDefault()
                  zoomBy(event.deltaY < 0 ? 1 + ZOOM_STEP : 1 - ZOOM_STEP)
                }
              : undefined
          }
          onKeyDown={onKeyDown}
          className="zone-box absolute inset-0 block size-full cursor-default border-0 bg-transparent p-0 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-sky-500"
        >
          <img
            src={photo.dataUrl}
            alt=""
            draggable={false}
            className={cn(
              'absolute max-w-none select-none',
              // The wheel and drag own the gesture while adjusting, not the browser.
              editing ? 'cursor-grab touch-none' : 'pointer-events-none',
              dragging && 'cursor-grabbing',
            )}
            style={{
              left: px(drawn.xMm - box.xMm),
              top: px(drawn.yMm - box.yMm),
              width: px(drawn.widthMm),
              height: px(drawn.heightMm),
            }}
          />
        </button>
      )}

      {editing && photo !== null ? (
        <div className="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-zinc-950/85 px-1">
          <button
            type="button"
            data-target="dense"
            aria-label="Zoom out"
            className="h-8 min-h-8 w-6 rounded text-zinc-200 hover:bg-zinc-700 focus-visible:ring-2 focus-visible:ring-sky-400"
            onClick={() => zoomBy(1 - ZOOM_STEP)}
          >
            −
          </button>
          <input
            type="range"
            aria-label="Photo zoom"
            min={MIN_IMAGE_SCALE}
            max={MAX_IMAGE_SCALE}
            step={0.05}
            value={transform.scale}
            onChange={(event) => props.onChange({ ...transform, scale: clampScale(Number(event.target.value)) })}
            onPointerDown={(event) => event.stopPropagation()}
            className="h-3 min-w-0 flex-1 accent-sky-500"
          />
          <button
            type="button"
            data-target="dense"
            aria-label="Zoom in"
            className="h-8 min-h-8 w-6 rounded text-zinc-200 hover:bg-zinc-700 focus-visible:ring-2 focus-visible:ring-sky-400"
            onClick={() => zoomBy(1 + ZOOM_STEP)}
          >
            +
          </button>
          <button
            type="button"
            data-target="dense"
            aria-label="Reset photo framing"
            className="h-8 min-h-8 rounded px-1 text-[9px] text-zinc-200 hover:bg-zinc-700 focus-visible:ring-2 focus-visible:ring-sky-400"
            onClick={() => props.onChange({ offsetXMm: 0, offsetYMm: 0, scale: 1 })}
          >
            reset
          </button>
        </div>
      ) : null}
    </div>
  )
}

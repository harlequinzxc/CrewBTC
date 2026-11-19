import { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import { containRectMm, MAX_IMAGE_SCALE, MIN_IMAGE_SCALE } from '../../types/edit'
import type { ImageTransform, PhotoSource } from '../../types/edit'
import { PictureZoomBar } from './PictureZoomBar'

export interface CellPictureProps {
  /** The picture band, in millimetres, on the sheet. */
  readonly box: { readonly xMm: number; readonly yMm: number; readonly widthMm: number; readonly heightMm: number }
  /** The photo, with its own pixel shape, or undefined when the page had none. */
  readonly photo: PhotoSource | undefined
  readonly transform: ImageTransform
  readonly onChange: (transform: ImageTransform) => void
  /** Pixels per millimetre of the preview. */
  readonly scale: number
  /** True while this cell's picture is in move/zoom mode. */
  readonly editing: boolean
  readonly onBeginEdit: () => void
  readonly onEndEdit: () => void
}

/** How much one wheel notch changes the zoom. */
const ZOOM_STEP = 0.08
/** One arrow-key nudge, in millimetres. */
const NUDGE_MM = 0.5

const clampScale = (value: number): number =>
  Math.min(MAX_IMAGE_SCALE, Math.max(MIN_IMAGE_SCALE, value))

/**
 * The dish photo inside its picture box.
 *
 * Three rules, in order of importance:
 *
 * 1. **Never stretch.** The drawn rectangle comes from the photo's own pixel dimensions,
 *    so the dish keeps its shape whatever shape the box is.
 * 2. **Stay inside the box.** The box clips, so a zoomed photo cannot reach the text
 *    bands or cross a cut line.
 * 3. **Behave like a photo editor.** Double-click enters move/zoom; drag pans; the wheel
 *    and the corner slider zoom; Escape or Enter leaves, and the framing is kept.
 */
export function CellPicture(props: CellPictureProps) {
  const { box, photo, transform, scale, editing } = props
  const [dragging, setDragging] = useState(false)
  const dragOrigin = useRef<{ x: number; y: number; offsetXMm: number; offsetYMm: number } | null>(
    null,
  )
  const rootRef = useRef<HTMLDivElement>(null)

  const px = (mm: number): string => `${mm * scale}px`

  // Escape and Enter both leave, keeping whatever framing was chosen.
  useEffect(() => {
    if (!editing) return

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' || event.key === 'Enter') {
        event.preventDefault()
        event.stopPropagation()
        props.onEndEdit()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [editing, props])

  // A press anywhere outside the box leaves the mode, as in any slide editor.
  useEffect(() => {
    if (!editing) return

    const onPointerDown = (event: PointerEvent): void => {
      const root = rootRef.current
      if (root === null) return
      if (!root.contains(event.target as Node)) props.onEndEdit()
    }

    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [editing, props])

  const zoomBy = useCallback(
    (factor: number) => {
      props.onChange({ ...transform, scale: clampScale(transform.scale * factor) })
    },
    [props, transform],
  )

  // A photo whose pixel size was never recorded fills the box; `object-fit` letterboxes
  // it, so it is held to its own shape without the size being known here.
  const shapeUnknown = photo !== undefined && (photo.widthPx <= 0 || photo.heightPx <= 0)
  const drawn =
    photo === undefined
      ? null
      : shapeUnknown
        ? { xMm: box.xMm, yMm: box.yMm, widthMm: box.widthMm, heightMm: box.heightMm }
        : containRectMm(box, photo.widthPx, photo.heightPx, transform)

  const onWheel = (event: React.WheelEvent<HTMLButtonElement>): void => {
    if (!editing) return
    // Own the gesture: without this the whole sheet scrolls while zooming a photo.
    event.preventDefault()
    const factor = event.deltaY < 0 ? 1 + ZOOM_STEP : 1 - ZOOM_STEP
    zoomBy(factor)
  }

  const onPointerDown = (event: React.PointerEvent<HTMLButtonElement>): void => {
    if (!editing) return
    event.preventDefault()
    event.stopPropagation()
    // Capture keeps the drag alive if the pointer leaves the box. It is an enhancement,
    // not a requirement: without it the drag still works while over the picture.
    event.currentTarget.setPointerCapture?.(event.pointerId)
    dragOrigin.current = {
      x: event.clientX,
      y: event.clientY,
      offsetXMm: transform.offsetXMm,
      offsetYMm: transform.offsetYMm,
    }
    setDragging(true)
  }

  const onPointerMove = (event: React.PointerEvent<HTMLButtonElement>): void => {
    const origin = dragOrigin.current
    if (origin === null) return
    // Screen pixels back to sheet millimetres, so the photo keeps up with the pointer.
    const deltaXMm = (event.clientX - origin.x) / scale
    const deltaYMm = (event.clientY - origin.y) / scale
    props.onChange({
      ...transform,
      offsetXMm: origin.offsetXMm + deltaXMm,
      offsetYMm: origin.offsetYMm + deltaYMm,
    })
  }

  const endDrag = (event: React.PointerEvent<HTMLButtonElement>): void => {
    if (dragOrigin.current === null) return
    dragOrigin.current = null
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
    if (move !== undefined) {
      event.preventDefault()
      props.onChange({
        ...transform,
        offsetXMm: transform.offsetXMm + move[0],
        offsetYMm: transform.offsetYMm + move[1],
      })
      return
    }
    if (event.key === '+' || event.key === '=') {
      event.preventDefault()
      zoomBy(1 + ZOOM_STEP)
    }
    if (event.key === '-' || event.key === '_') {
      event.preventDefault()
      zoomBy(1 - ZOOM_STEP)
    }
  }

  const handlers = {
    onWheel,
    onPointerDown,
    onPointerMove,
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
    onKeyDown,
  }

  return (
    <div
      ref={rootRef}
      className={cn(
        'absolute overflow-hidden bg-zinc-100',
        editing && 'ring-2 ring-sky-500 ring-inset',
      )}
      style={{
        left: px(box.xMm),
        top: px(box.yMm),
        width: px(box.widthMm),
        height: px(box.heightMm),
      }}
      data-picture={editing ? 'editing' : 'idle'}
    >
      {photo === undefined || drawn === null ? (
        <span className="absolute inset-0 grid place-items-center px-1 text-center text-[8px] leading-tight text-zinc-500">
          No image on this page
        </span>
      ) : (
        // A button, because it really is one: it takes focus, opens on double-click,
        // and answers the arrow keys and the wheel while open.
        <button
          type="button"
          {...handlers}
          aria-label="Dish photo — double-click to move and zoom"
          aria-roledescription="movable photo"
          tabIndex={editing ? 0 : -1}
          data-target="dense"
          className="absolute inset-0 block size-full min-h-8 cursor-default border-0 bg-transparent p-0 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-400"
          onDoubleClick={(event) => {
            // The card's own double-click must not also fire.
            event.stopPropagation()
            props.onBeginEdit()
          }}
        >
          <img
            src={photo.dataUrl}
            alt=""
            draggable={false}
            className={cn(
              'absolute max-w-none select-none',
              // The wheel and drag own the gesture while editing, not the browser.
              editing ? 'cursor-grab touch-none' : 'pointer-events-none',
              dragging && 'cursor-grabbing',
            )}
            style={{
              left: px(drawn.xMm - box.xMm),
              top: px(drawn.yMm - box.yMm),
              width: px(drawn.widthMm),
              height: px(drawn.heightMm),
              // Belt and braces: the box already clips, and the photo never stretches.
              objectFit: 'contain',
            }}
          />
        </button>
      )}

      {editing && photo !== undefined ? (
        <PictureZoomBar
          scale={transform.scale}
          onZoom={zoomBy}
          onReset={() => props.onChange({ offsetXMm: 0, offsetYMm: 0, scale: 1 })}
        />
      ) : null}
    </div>
  )
}

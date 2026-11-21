import { useRef, useState } from 'react'
import { usePhotoDismissal, usePhotoNudge } from './use-photo-keys'
import { Sparkles } from 'lucide-react'
import { PhotoCutoutControls } from './PhotoCutoutControls'
import { useNonPassiveWheel } from '../../../lib/use-wheel'
import { cn } from '../../../lib/cn'
import { containRectMm, MAX_IMAGE_SCALE, MIN_IMAGE_SCALE } from '../../../types/card'
import type { ImageTransform, PhotoSource, RectMm } from '../../../types/card'

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
  /** Applies this card's bands to every card. Absent when there is nothing to copy to. */
  readonly onMatchBands?: (() => void) | undefined
  /** Replaces the photo's pixels. Used by the cut-out, and by its undo. */
  readonly onPhotoReplace?: ((photo: PhotoSource) => void) | undefined
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
 * A click enters adjust mode: drag pans, the wheel zooms, arrow keys nudge, and
 * Escape or Enter leaves with the framing kept.
 */
export function CardZoneImage(props: CardZoneImageProps) {
  const { box, photo, transform, scale, editing } = props
  const [dragging, setDragging] = useState(false)
  const origin = useRef<{ x: number; y: number; offsetXMm: number; offsetYMm: number } | null>(
    null,
  )
  const rootRef = useRef<HTMLDivElement>(null)
  usePhotoDismissal(editing, props.onEndEdit, rootRef)

  const px = (mm: number): string => `${mm * scale}px`

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

  // Non-passive, so `preventDefault` is honoured and the wheel does not leak through to
  // the sheet pane, which would scroll or zoom the paper while the photo was being framed.
  const wheelRef = useNonPassiveWheel<HTMLDivElement>(
    (event) => {
      event.preventDefault()
      event.stopPropagation()
      zoomBy(event.deltaY < 0 ? 1 + ZOOM_STEP : 1 - ZOOM_STEP)
    },
    editing,
  )

  const onPointerDown = (event: React.PointerEvent<HTMLButtonElement>): void => {
    if (event.button !== 0) return
    /*
      One press both enters adjust mode and begins the drag.

      Adjust mode used to be entered by a double-click, so the first press of a drag could
      only select the card and the user had to click twice and *then* drag — a gesture the
      photograph did not look like it had. Entering on the same press means the pointer is
      already captured when the drag starts, so the framing moves under the hand from the
      first pixel.

      `preventDefault` only once adjusting, because before this press the button is not the
      control the user is aiming at: the card's own selection has to happen first, and
      suppressing the default there stopped the card being selected at all.
    */
    if (!editing) {
      /*
        Do not stop propagation here. The card's own press handler is what selects the
        card, and the dividers only exist on the selected one — swallowing the event left
        the photo adjusted but its card unselected, so the margins could not be dragged at
        the very moment the user had just opened the frame to drag them.
      */
      props.onBeginEdit()
      return
    }
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

  const onKeyDown = usePhotoNudge(editing, NUDGE_MM, (dxMm, dyMm) => {
    props.onChange({
      ...transform,
      offsetXMm: transform.offsetXMm + dxMm,
      offsetYMm: transform.offsetYMm + dyMm,
    })
  })

  const endDrag = (event: React.PointerEvent<HTMLButtonElement>): void => {
    if (origin.current === null) return
    origin.current = null
    setDragging(false)
    if (event.currentTarget.hasPointerCapture?.(event.pointerId) === true) {
      event.currentTarget.releasePointerCapture?.(event.pointerId)
    }
  }

  return (
    <div
      ref={(node) => {
        rootRef.current = node
        wheelRef.current = node
      }}
      // A clipping box, not a control. `zone-box` exempts it from the §4.1 target
      // floor: a global `min-height` would stretch it past its band and make the photo
      // overlap the footer.
      className={cn(
        'zone-box absolute overflow-hidden bg-zinc-100',
        // While adjusting, the frame is the only cue that the photo — not the text — is
        // about to receive the gesture, so it needs to be unmistakable rather than subtle.
        editing
          ? 'outline outline-2 -outline-offset-2 outline-accent ring-2 ring-accent/40'
          : 'outline outline-1 outline-transparent',
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
          aria-label="Dish photo — click to move and zoom"
          data-adjusting={editing ? 'true' : 'false'}
          aria-roledescription="movable photo"
          tabIndex={editing ? 0 : -1}
          /*
            A click only stops the sheet seeing it. It must not leave adjust mode: the
            press that entered the mode is the first half of this same click, so toggling
            on click would enter and leave in one gesture and nothing would ever stay open.
            Escape and Enter leave, via the key handler above.
          */
          onClick={(event) => event.stopPropagation()}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onKeyDown={onKeyDown}
          /* No `data-target="dense"`: this button fills a zone whose size is millimetres of
             paper. Minting a 32px control target inside it made the frame taller than its
             band, so it overhung whatever sat below and stole those clicks. */
          className="zone-box absolute inset-0 block size-full cursor-default border-0 bg-transparent p-0 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
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

      {/*
        "Same margins everywhere", inside the frame only while it is being adjusted: the
        decision is made while looking at one card's framing, and appearing only in adjust
        mode means it cannot be pressed by accident while panning.
      */}
      {editing && props.onPhotoReplace !== undefined && props.photo !== null ? (
        <PhotoCutoutControls photo={props.photo} onReplace={props.onPhotoReplace} />
      ) : null}

      {editing && props.onMatchBands !== undefined ? (
        <button
          type="button"
          data-target="dense"
          aria-label="Use these margins for all cards"
          title="Same margins on every card"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation()
            props.onMatchBands?.()
          }}
          className="absolute bottom-1 right-1 grid h-6 min-h-6 w-6 place-items-center rounded-sm bg-surface-panel/90 text-ink-primary shadow-md shadow-black/30 hover:bg-surface-active focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          <Sparkles aria-hidden className="size-3.5" />
        </button>
      ) : null}
    </div>
  )
}

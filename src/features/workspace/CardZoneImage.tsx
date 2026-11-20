import { useEffect, useRef, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { useNonPassiveWheel } from '../../lib/use-wheel'
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
  /** Applies this card's bands to every card. Absent when there is nothing to copy to. */
  readonly onMatchBands?: (() => void) | undefined
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
          aria-label="Dish photo — double-click to move and zoom"
          data-adjusting={editing ? 'true' : 'false'}
          aria-roledescription="movable photo"
          tabIndex={editing ? 0 : -1}
          onDoubleClick={(event) => {
            event.stopPropagation()
            // Toggle: the same gesture that enters adjust mode leaves it again.
            if (props.editing) props.onEndEdit()
            else props.onBeginEdit()
          }}
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

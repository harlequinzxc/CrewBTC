import { useRef, useState } from 'react'
import { clampBands } from '../../types/card'
import type { CardBands } from '../../types/card'

/**
 * The two boundaries between header / picture / footer, draggable on the card itself.
 *
 * Deliberately geometry rather than a control: the divider is as tall as the card is
 * wide and only a few pixels thick, so the §4.1 control ladder must not resize it. The
 * keyboard equivalent is the pair of sliders in the band panel, which is why these are
 * `aria-hidden` decorations with a pointer affordance rather than a second set of
 * controls to tab through.
 *
 * Dragging runs through `clampBands`, so the minima that keep a card from becoming two
 * text boxes apply here exactly as they do in the panel.
 */

export interface ZoneDividersProps {
  readonly bands: CardBands
  readonly cellHeightMm: number
  /** Pixels per millimetre of the preview. */
  readonly scale: number
  readonly onChange: (bands: CardBands) => void
}

type Which = 'header' | 'footer'

const THICKNESS_PX = 7

export function ZoneDividers(props: ZoneDividersProps) {
  const { bands, cellHeightMm, scale } = props
  const [dragging, setDragging] = useState<Which | null>(null)
  const origin = useRef<{ y: number; headerMm: number; footerMm: number } | null>(null)

  const start = (which: Which) => (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    origin.current = { y: event.clientY, headerMm: bands.headerMm, footerMm: bands.footerMm }
    setDragging(which)
  }

  const move = (which: Which) => (event: React.PointerEvent<HTMLDivElement>) => {
    const from = origin.current
    if (from === null) return
    const deltaMm = (event.clientY - from.y) / scale
    // The first divider moves the header; the second moves the footer upwards, so the
    // picture keeps whatever lies between them.
    const next =
      which === 'header'
        ? { headerMm: from.headerMm + deltaMm, footerMm: from.footerMm }
        : { headerMm: from.headerMm, footerMm: from.footerMm - deltaMm }
    props.onChange(clampBands(next, cellHeightMm))
  }

  const end = (event: React.PointerEvent<HTMLDivElement>) => {
    if (origin.current === null) return
    origin.current = null
    setDragging(null)
    if (event.currentTarget.hasPointerCapture?.(event.pointerId) === true) {
      event.currentTarget.releasePointerCapture?.(event.pointerId)
    }
  }

  const top = bands.headerMm * scale
  const bottom = (cellHeightMm - bands.footerMm) * scale

  return (
    <>
      <div
        aria-hidden="true"
        data-divider="header"
        onPointerDown={start('header')}
        onPointerMove={move('header')}
        onPointerUp={end}
        onPointerCancel={end}
        className={[
          'zone-box absolute inset-x-0 z-10 cursor-row-resize touch-none border-y border-accent/40',
          dragging === 'header' ? 'bg-accent/60' : 'bg-accent/25',
        ].join(' ')}
        style={{ top: top - THICKNESS_PX / 2, height: THICKNESS_PX }}
      />
      <div
        aria-hidden="true"
        data-divider="footer"
        onPointerDown={start('footer')}
        onPointerMove={move('footer')}
        onPointerUp={end}
        onPointerCancel={end}
        className={[
          'zone-box absolute inset-x-0 z-10 cursor-row-resize touch-none border-y border-accent/40',
          dragging === 'footer' ? 'bg-accent/60' : 'bg-accent/25',
        ].join(' ')}
        style={{ top: bottom - THICKNESS_PX / 2, height: THICKNESS_PX }}
      />
    </>
  )
}

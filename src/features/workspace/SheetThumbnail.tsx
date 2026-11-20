import { useMemo } from 'react'
import { cutMarksFor } from '../../lib/imposition/sheet'
import type { Placement, SheetPlan } from '../../lib/imposition/sheet'
import { cn } from '../../lib/cn'
import type { GridLayout, SheetSettings } from '../../types/imposition'
import type { Card } from '../../types/card'

/**
 * One sheet, drawn at thumbnail size.
 *
 * A miniature is the sheet's own geometry scaled down, not a picture of it: the same grid,
 * the same cell rectangles, the same placements, drawn at a few dozen pixels. That is what
 * lets it be honest for free — a sheet with four cards on it looks like it has four cards
 * on it, and a rotated grid looks rotated, without a second renderer to keep in step with
 * the real one.
 *
 * Cards are summarised rather than rendered. At this size a card's type is sub-pixel, so
 * the thumbnail shows the three bands as colour: the header ink, the photo, the footer. It
 * reads as a page at a glance, which is the whole job.
 */

/** How wide a thumbnail is, in CSS pixels. Height follows the sheet's aspect ratio. */
export const THUMB_WIDTH = 44

export interface SheetThumbnailProps {
  readonly sheet: SheetPlan
  readonly settings: SheetSettings
  readonly grid: GridLayout
  readonly cards: Readonly<Record<string, Card>>
  /** `keyFor(cellIndex)` gives the card key for a placed page. */
  readonly keyFor: (placement: Placement) => string
  readonly active: boolean
  readonly onSelect: () => void
}

export function SheetThumbnail(props: SheetThumbnailProps) {
  const { sheet, settings, grid, cards, active } = props
  const scale = THUMB_WIDTH / settings.sheetWidthMm
  const height = settings.sheetHeightMm * scale
  const marks = useMemo(() => cutMarksFor(grid), [grid])

  return (
    <button
      type="button"
      // The miniature is a picture of the page, so it is exempt from the target ladder the
      // same way a card's zones are: it is sized in millimetres, and the strip's own
      // container gives it a real hit area.
      data-target="dense"
      aria-label={`Sheet ${sheet.sheetNumber}`}
      aria-current={active ? 'true' : undefined}
      onClick={props.onSelect}
      className={cn(
        'relative shrink-0 overflow-hidden rounded-[3px] bg-white',
        'transition-colors duration-150 ease-out',
        // The active sheet is an accent ring, not a fill: the miniature has to stay
        // readable, so the border carries the state.
        active
          ? 'outline outline-2 outline-offset-1 outline-accent'
          : 'outline outline-1 outline-offset-0 outline-white/25',
        'hover:outline-white/60 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent',
      )}
      style={{ width: THUMB_WIDTH, height }}
    >
      {grid.cells.map((cell) => {
        const placement = sheet.placements.find((item) => item.cellIndex === cell.index)
        const card = placement === undefined ? undefined : cards[props.keyFor(placement)]

        return (
          <span
            key={cell.index}
            className="absolute overflow-hidden"
            style={{
              left: cell.rect.xMm * scale,
              top: cell.rect.yMm * scale,
              width: cell.rect.widthMm * scale,
              height: cell.rect.heightMm * scale,
            }}
          >
            {card === undefined ? (
              // An empty slot stays empty: the point of the miniature is to show which
              // cells are taken.
              <span className="absolute inset-0 border border-dashed border-zinc-300/70" />
            ) : (
              <CardMiniature card={card} width={cell.rect.widthMm * scale} height={cell.rect.heightMm * scale} />
            )}
          </span>
        )
      })}

      {marks.map((mark, index) => (
        <span
          key={index}
          className="absolute bg-red-400/50"
          style={{
            left: mark.x1Mm * scale,
            top: mark.y1Mm * scale,
            width: Math.max(0.5, Math.abs(mark.x2Mm - mark.x1Mm) * scale),
            height: Math.max(0.5, Math.abs(mark.y2Mm - mark.y1Mm) * scale),
          }}
        />
      ))}
    </button>
  )
}

/** A card at thumbnail scale: three bands of colour, which is all that survives 44px. */
function CardMiniature(props: {
  readonly card: Card
  readonly width: number
  readonly height: number
}) {
  const total = Math.max(1, props.card.bands.headerMm + props.card.bands.footerMm)
  const headerShare = (props.card.bands.headerMm / total) * props.height
  const footerShare = (props.card.bands.footerMm / total) * props.height

  const ink = props.card.headerStyle.color
  const footInk = props.card.bodyStyle.color

  return (
    <span className="absolute inset-0 flex flex-col bg-zinc-100">
      <span style={{ height: headerShare, background: tint(ink) }} />
      <span className="relative flex-1 overflow-hidden bg-zinc-200">
        {props.card.photo === null ? null : (
          // The photo itself is a data URL already in memory; showing it is what makes the
          // miniature look like the page rather than like a bar chart.
          <img src={props.card.photo.dataUrl} alt="" className="size-full object-cover" />
        )}
      </span>
      <span style={{ height: footerShare, background: tint(footInk) }} />
    </span>
  )
}

/** Text ink, flattened to a pale wash so a thumbnail is a page and not a warning light. */
const tint = (hex: string): string => `${hex}22`

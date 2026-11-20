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
 * the same cell rectangles, the same placements. That is what lets it be honest for free —
 * a sheet with four cards on it looks like it has four cards on it, and a rotated grid
 * looks rotated, without a second renderer to keep in step with the real one.
 *
 * It carries the card's *content* too, not just its presence. An earlier version reduced
 * each card to three bands of tint, which at 44px came out as grey bricks: a strip of them
 * said "there are pages" and nothing else, which is the same thing the sheet count in the
 * top bar already said. So the bands render their real text — the dish code, the dish
 * name, the footer — at whatever size the band affords, and the photo is the dish photo.
 * Small type is a smudge, but a smudge with the shape and length of the actual words is
 * recognisably *this* card, where a grey rectangle is recognisably nothing.
 */

/** How wide a thumbnail is, in CSS pixels. Height follows the sheet's aspect ratio. */
export const THUMB_WIDTH = 64

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
        const box = {
          left: cell.rect.xMm * scale,
          top: cell.rect.yMm * scale,
          width: cell.rect.widthMm * scale,
          height: cell.rect.heightMm * scale,
        }

        return (
          <span key={cell.index} className="absolute overflow-hidden" style={box}>
            {card === undefined ? (
              // An empty slot stays empty: the point of the miniature is to show which
              // cells are taken.
              <span className="absolute inset-0 border border-dashed border-zinc-300/70" />
            ) : (
              <CardMiniature card={card} scale={scale} />
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

/**
 * A card at thumbnail scale: its three bands, holding its actual text and its actual photo.
 *
 * Type is set at the band's own height, less a hair, and clipped rather than wrapped — a
 * thumbnail is a view of one line of a card, and wrapping would show three words of a long
 * dish name as a block, which reads as a different kind of content than the card holds.
 * `whitespace-nowrap` plus `overflow-hidden` is exactly "this line, cut at the edge".
 */
function CardMiniature(props: { readonly card: Card; readonly scale: number }) {
  const { card, scale } = props
  const headerPx = card.bands.headerMm * scale
  const footerPx = card.bands.footerMm * scale
  // A floor of 2.5px: below that the browser draws nothing at all, so a thin band would
  // lose its text entirely and the card would go back to being a bar.
  const type = (bandPx: number): number => Math.max(2.5, bandPx * 0.78)

  return (
    <span className="absolute inset-0 flex flex-col bg-white outline outline-[0.5px] outline-zinc-300">
      <span
        className="relative shrink-0 overflow-hidden whitespace-nowrap px-[0.5px] font-medium"
        style={{
          height: headerPx,
          fontSize: type(headerPx),
          lineHeight: `${Math.max(2.5, headerPx)}px`,
          color: card.headerStyle.color,
        }}
      >
        {card.headerText}
      </span>

      <span className="relative min-h-0 flex-1 overflow-hidden bg-white">
        {card.photo === null ? (
          // No photo is not a grey hole: the paper is white on a sheet too, so the card
          // reads as a card with a picture yet to come rather than as a missing image.
          <span className="absolute inset-0 bg-zinc-50" />
        ) : (
          // The photo is already a data URL in memory; showing it is what makes the
          // miniature look like the page rather than like a bar chart.
          <img src={card.photo.dataUrl} alt="" className="size-full object-cover" />
        )}
      </span>

      <span
        className="relative shrink-0 overflow-hidden whitespace-nowrap px-[0.5px]"
        style={{
          height: footerPx,
          fontSize: type(footerPx),
          lineHeight: `${Math.max(2.5, footerPx)}px`,
          color: card.bodyStyle.color,
        }}
      >
        {card.bodyText}
      </span>
    </span>
  )
}

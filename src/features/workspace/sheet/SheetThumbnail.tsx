import { useMemo } from 'react'
import { cutMarksFor } from '../../../lib/imposition/sheet'
import type { Placement, SheetPlan } from '../../../lib/imposition/sheet'
import { cn } from '../../../lib/cn'
import type { GridLayout, SheetSettings } from '../../../types/imposition'
import type { Card } from '../../../types/card'

/**
 * One sheet, drawn at thumbnail size.
 *
 * A miniature is the sheet's own geometry scaled down, not a picture of it: the same grid,
 * the same cell rectangles, the same placements. That is what lets it be honest for free —
 * a sheet with four cards on it looks like it has four cards on it, and a rotated grid
 * looks rotated, without a second renderer to keep in step with the real one.
 *
 * It carries the card's *content* too, not just its presence — but not as type. A card's
 * header band is 6mm; at 64px of thumbnail that is 3.7 CSS pixels, and a 9pt glyph inside
 * it is 0.98px tall. There is no font size at which those words are readable, and setting
 * them anyway produces clipped smears rather than text. So the bands are **greeked**: one
 * rule per line of text, as long as the line is, in the ink the line is set in. Two lines
 * of a long dish name look like two rules of two different lengths, which is recognisably
 * a heading; a single short footer looks like one short rule. That is the most a 20px card
 * can honestly say, and it is a great deal more than a grey rectangle said.
 *
 * The photo is not greeked, because it does not have to be: an image survives downscaling,
 * so the dish photo is the dish photo and is the thing that makes a thumbnail look like
 * the page it came from.
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
 * A card at thumbnail scale: two greeked text bands, the real photo between them.
 *
 * A rule is only drawn when there is room for one — at 3.7px a band holds a single
 * hairline and a second would be indistinguishable from the first. Long words are split
 * at whitespace first so a line breaks where the eye expects it, not at the box edge.
 */
const TEXT_RULE = 1

/** How wide one line of the card's text is, as a fraction of the card, at thumbnail scale. */
function lineWidths(text: string): readonly number[] {
  const lines = text.split('\n').filter((line) => line.trim() !== '')
  if (lines.length === 0) return []
  // Roughly one rule per line, but a very long line is two rules: at this size what reads
  // is the *shape* of the block, and a heading is two or three short rules, not one long.
  return lines.flatMap((line) => {
    const chars = line.trim().length
    const share = Math.min(1, chars / 26)
    return chars > 34 ? [share, share * 0.55] : [share]
  }).slice(0, 3)
}

function GreekedBand(props: {
  readonly text: string
  readonly color: string
  readonly heightPx: number
}) {
  const lines = props.heightPx >= TEXT_RULE * 2 + 1 ? 2 : 1
  const widths = lineWidths(props.text).slice(0, lines)
  if (widths.length === 0) return null

  return (
    <span
      className={cn(
        'relative flex shrink-0 flex-col justify-evenly overflow-hidden px-[1px]',
        'items-start',
      )}
      style={{ height: props.heightPx }}
    >
      {widths.map((share, index) => (
        <span
          key={index}
          aria-hidden="true"
          style={{
            height: TEXT_RULE,
            width: `${Math.round(share * 100)}%`,
            background: props.color,
            opacity: 0.55,
          }}
        />
      ))}
    </span>
  )
}

function CardMiniature(props: { readonly card: Card; readonly scale: number }) {
  const { card, scale } = props
  const headerPx = card.bands.headerMm * scale
  const footerPx = card.bands.footerMm * scale

  return (
    <span className="absolute inset-0 flex flex-col bg-white outline outline-[0.5px] outline-zinc-300">
      <GreekedBand
        text={card.headerText}
        color={card.headerStyle.color}
        heightPx={headerPx}
      />

      <span className="relative min-h-0 flex-1 overflow-hidden bg-zinc-50">
        {card.photo === null ? null : (
          // The photo is already a data URL in memory, and unlike the type it survives a
          // 4x downscale: this is what makes the miniature look like its page.
          <img src={card.photo.dataUrl} alt="" className="size-full object-cover" />
        )}
      </span>

      <GreekedBand
        text={card.bodyText}
        color={card.bodyStyle.color}
        heightPx={footerPx}
      />
    </span>
  )
}

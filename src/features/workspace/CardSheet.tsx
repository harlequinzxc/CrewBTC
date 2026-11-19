import { useCallback, useState } from 'react'
import { cutMarksFor, planSheets } from '../../lib/imposition/sheet'
import type { PageRef } from '../../lib/imposition/sheet'
import type { GridLayout, SheetSettings } from '../../types/imposition'
import { cardKey } from '../../types/card'
import type { Card, CardBands, ImageTransform, TextStyle } from '../../types/card'
import { useElementSize } from '../../lib/use-element-size'
import { Card as CardView } from './Card'
import { CardTextBar } from './CardTextBar'
import { blankCard } from './use-cards'
import type { CardZone } from './Card'

export interface CardSheetProps {
  readonly settings: SheetSettings
  readonly grid: GridLayout
  readonly pages: readonly PageRef[]
  readonly cards: Readonly<Record<string, Card>>
  readonly showCutMarks: boolean
  readonly selectedCell: number | null
  readonly onSelectCell: (cellIndex: number | null) => void
  readonly onCardChange: (key: string, card: Card) => void
}

/** Padding kept around the sheet so it never touches the pane edges. */
const BREATHING_ROOM = 24

interface EditState {
  readonly cellIndex: number
  readonly key: string
  readonly zone: CardZone
}

/**
 * The A4 sheet, drawn at true physical proportions and auto-fitted to the viewport.
 *
 * Every cell holds a `Card`: three zones, its own bands, its own type and framing. This
 * component owns only *which* thing is being edited; the content lives in the card
 * store, so a card looks the same after a re-render, a re-fit or an export.
 */
export function CardSheet(props: CardSheetProps) {
  const { settings, grid, pages, cards, showCutMarks } = props
  const [editing, setEditing] = useState<EditState | null>(null)
  const [pictureEditing, setPictureEditing] = useState<string | null>(null)
  const [containerRef, size] = useElementSize<HTMLDivElement>()

  const sheets = planSheets(pages, grid)
  const first = sheets[0]
  const marks = showCutMarks ? cutMarksFor(grid) : []

  const apply = useCallback(
    (key: string, change: (card: Card) => Card) => {
      const card = cards[key] ?? blankCard(grid.cellHeightMm)
      props.onCardChange(key, change(card))
    },
    [cards, grid.cellHeightMm, props],
  )

  // The sheet's arithmetic is worth showing even with nothing placed yet: it is how a
  // bad cell size or margin is discovered, and it should not need a PDF to appear.
  const summary = (
    <div className="flex h-9 shrink-0 items-center gap-3 overflow-x-auto border-b border-zinc-800 px-3">
      <span className="tabular whitespace-nowrap text-xs text-zinc-300">
        {grid.columns} × {grid.rows} = {grid.cellCount} cells
      </span>
      <span className="tabular whitespace-nowrap text-xs text-zinc-500">
        {grid.utilisationPercent}% of paper
      </span>
    </div>
  )

  if (grid.isEmpty) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {summary}
        <div className="grid flex-1 place-items-center p-6 text-center">
          <p className="max-w-xs text-sm text-zinc-400">
            No cell fits on this sheet. Reduce the cell size, the gutter, or the margin.
          </p>
        </div>
      </div>
    )
  }

  const availableWidth = Math.max(0, size.width - BREATHING_ROOM)
  const availableHeight = Math.max(0, size.height - BREATHING_ROOM)
  const raw = Math.min(
    availableWidth > 0 ? availableWidth / settings.sheetWidthMm : 1,
    availableHeight > 0 ? availableHeight / settings.sheetHeightMm : 1,
  )
  const scale = Number.isFinite(raw) && raw > 0 ? raw : 1

  const activeZone = editing === null ? null : editing.zone

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-9 shrink-0 items-center gap-3 overflow-x-auto border-b border-zinc-800 px-3">
        <span className="tabular whitespace-nowrap text-xs text-zinc-300">
          {grid.columns} × {grid.rows} = {grid.cellCount} cells
        </span>
        <span className="tabular whitespace-nowrap text-xs text-zinc-500">
          {grid.utilisationPercent}% of paper
        </span>
        <span className="tabular whitespace-nowrap text-xs text-zinc-500">
          {sheets.length} {sheets.length === 1 ? 'sheet' : 'sheets'}
        </span>
        <span className="tabular ml-auto whitespace-nowrap text-xs text-zinc-600">
          {Math.round(scale * 100)}% zoom
        </span>
      </div>

      {/* The formatting bar follows whichever text box has the caret. */}
      {editing !== null && (editing.zone === 'header' || editing.zone === 'body') ? (
        <div className="shrink-0 border-b border-zinc-800 px-3 py-1.5">
          <CardTextBar
            zone={editing.zone}
            style={
              (cards[editing.key] ?? blankCard(grid.cellHeightMm))[
                editing.zone === 'header' ? 'headerStyle' : 'bodyStyle'
              ]
            }
            onChange={(style) => apply(editing.key, (card) => styleInto(card, editing.zone, style))}
          />
        </div>
      ) : null}

      <div ref={containerRef} className="grid min-h-0 flex-1 place-items-center overflow-hidden p-3">
        <div
          className="relative shrink-0 bg-white shadow-xl shadow-black/50 ring-1 ring-black/20"
          style={{
            width: `${settings.sheetWidthMm * scale}px`,
            height: `${settings.sheetHeightMm * scale}px`,
          }}
        >
          <button
            type="button"
            data-target="dense"
            aria-label="Sheet preview — deselect card"
            className="absolute inset-0 z-0 min-h-8 cursor-default focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-500"
            onClick={() => {
              setEditing(null)
              setPictureEditing(null)
              props.onSelectCell(null)
            }}
          />

          {grid.cells.map((cell) => {
            const placement = first?.placements.find((item) => item.cellIndex === cell.index)
            if (placement === undefined) {
              return (
                <div
                  key={cell.index}
                  className="absolute border border-dashed border-zinc-300"
                  style={{
                    left: `${cell.rect.xMm * scale}px`,
                    top: `${cell.rect.yMm * scale}px`,
                    width: `${cell.rect.widthMm * scale}px`,
                    height: `${cell.rect.heightMm * scale}px`,
                  }}
                >
                  <span className="absolute left-0.5 top-0.5 text-[9px] leading-none text-zinc-400">
                    {cell.index + 1}
                  </span>
                </div>
              )
            }

            const key = cardKey(cell.index, placement.documentId, placement.pageNumber)
            const card = cards[key] ?? blankCard(grid.cellHeightMm)
            return (
              <CardView
                key={cell.index}
                card={card}
                cell={cell.rect}
                scale={scale}
                cellIndex={cell.index}
                pageLabel={`${placement.fileName}#${placement.pageNumber}`}
                selected={props.selectedCell === cell.index}
                editing={editing?.cellIndex === cell.index ? activeZone : null}
                pictureEditing={pictureEditing === key}
                onSelect={() => props.onSelectCell(cell.index)}
                onBeginTextEdit={(zone) => {
                  props.onSelectCell(cell.index)
                  setEditing({ cellIndex: cell.index, key, zone })
                }}
                onEndEdit={() => setEditing(null)}
                onTextChange={(zone, text) =>
                  apply(key, (current) =>
                    zone === 'header'
                      ? { ...current, headerText: text }
                      : { ...current, bodyText: text },
                  )
                }
                onStyleChange={(zone, style) => apply(key, (current) => styleInto(current, zone, style))}
                onBeginPictureEdit={() => {
                  props.onSelectCell(cell.index)
                  setPictureEditing(key)
                }}
                onEndPictureEdit={() => setPictureEditing(null)}
                onImageChange={(transform: ImageTransform) =>
                  apply(key, (current) => ({ ...current, imageTransform: transform }))
                }
                onBandsChange={(bands: CardBands) =>
                  apply(key, (current) => ({ ...current, bands }))
                }
              />
            )
          })}

          {marks.map((mark, index) => (
            <div
              key={`mark-${index}`}
              aria-hidden="true"
              className="pointer-events-none absolute bg-red-300/50"
              style={{
                left: `${mark.x1Mm * scale}px`,
                top: `${mark.y1Mm * scale}px`,
                width: `${Math.max(1, (mark.x2Mm - mark.x1Mm) * scale)}px`,
                height: `${Math.max(1, (mark.y2Mm - mark.y1Mm) * scale)}px`,
              }}
            />
          ))}
        </div>
      </div>

      <p className="shrink-0 px-3 pb-2 text-xs text-zinc-500">
        {pages.length} {pages.length === 1 ? 'page' : 'pages'} placed · click a text box to type ·
        double-click a photo to move and zoom · select a card for its top/bottom sliders
      </p>
    </div>
  )
}

/** Applies a style to whichever text box the user was in. */
function styleInto(card: Card, zone: CardZone, style: TextStyle): Card {
  return zone === 'header' ? { ...card, headerStyle: style } : { ...card, bodyStyle: style }
}

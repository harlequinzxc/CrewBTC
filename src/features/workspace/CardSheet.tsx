import { useCallback, useState } from 'react'
import { cutMarksFor, planSheets } from '../../lib/imposition/sheet'
import type { PageRef } from '../../lib/imposition/sheet'
import type { GridLayout, SheetSettings } from '../../types/imposition'
import { clampBands } from '../../types/card'
import { cn } from '../../lib/cn'
import type { Card } from '../../types/card'
import { CardTextBar } from './CardTextBar'
import { SheetBody } from './SheetBody'
import { blankCard } from './use-cards'
import { CANVAS_PADDING } from './use-sheet-zoom'
import { activeStyle, styleInto, styleSelection, textInto } from './card-edits'
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
  /** Owned by the workspace, because the top bar draws the same number. */
  readonly scale: number
  readonly fitting: boolean
  readonly paneRef: (node: HTMLDivElement | null) => void
  /** Which sheet of the plan the canvas is showing. Zero-based. */
  readonly sheetIndex: number
}

interface EditState {
  readonly cellIndex: number
  readonly key: string
  readonly zone: CardZone
}

/**
 * The A4 sheet, drawn at true physical proportions.
 *
 * Every cell holds a `Card`: three zones, its own bands, its own type and framing. This
 * component owns only *which* thing is being edited; the content lives in the card store,
 * so a card looks the same after a re-render, a re-fit or an export. Zoom is a prop: the
 * controls live in the top bar, so the value has to come from above.
 */
export function CardSheet(props: CardSheetProps) {
  const {
    settings,
    grid,
    pages,
    cards,
    showCutMarks,
    scale,
    fitting,
    selectedCell,
    onSelectCell,
    paneRef,
    sheetIndex,
  } = props
  const [editing, setEditing] = useState<EditState | null>(null)
  const [pictureEditing, setPictureEditing] = useState<string | null>(null)
  // The caret's selection in the box being edited. Cleared on every edit boundary, so a
  // stale range can never style text the user is no longer looking at.
  const [selection, setSelection] = useState<{
    readonly start: number
    readonly end: number
  } | null>(null)

  const sheets = planSheets(pages, grid)
  // The sheet on the canvas, not necessarily the first: the strip switches which one this
  // is, and everything drawn below — placements, cut marks, the empty-cell numerals —
  // belongs to it.
  const current = sheets[sheetIndex] ?? sheets[0]
  const marks = showCutMarks ? cutMarksFor(grid) : []

  const apply = useCallback(
    (key: string, change: (card: Card) => Card) => {
      const card = cards[key] ?? blankCard(grid.cellHeightMm)
      props.onCardChange(key, change(card))
    },
    [cards, grid.cellHeightMm, props],
  )

  if (grid.isEmpty) {
    return (
      <div className="grid flex-1 place-items-center p-6 text-center">
        <p className="max-w-xs text-[13px] text-ink-secondary">
          No cell fits on this sheet. Reduce the cell size, the gutter, or the margin.
        </p>
      </div>
    )
  }

  const editZone = editing === null || editing.zone === 'picture' ? null : editing.zone
  const barCard =
    editing === null ? blankCard(grid.cellHeightMm) : (cards[editing.key] ?? blankCard(grid.cellHeightMm))

  const activeZone = editing === null ? null : editing.zone

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* The formatting bar follows whichever text box has the caret. */}
      {editing !== null && editZone !== null ? (
        <div className="flex h-8 shrink-0 items-center border-b border-hairline px-2">
          <CardTextBar
            zone={editZone}
            style={barCard[editZone === 'header' ? 'headerStyle' : 'bodyStyle']}
            selection={selection}
            active={activeStyle(barCard, editZone, selection)}
            onChange={(style) => {
              const zone = editZone
              apply(editing.key, (card) =>
                selection === null
                  ? styleInto(card, zone, style)
                  : styleSelection(card, zone, selection, style),
              )
            }}
          />
        </div>
      ) : null}

      <div
        ref={paneRef}
        data-testid="sheet-pane"
        className={cn(
          'min-h-0 flex-1 overflow-auto',
          // Width-fit makes the sheet as wide as the pane and taller than it, so the pane
          // always scrolls vertically. It used to `place-items-center` while fitted, which
          // is exactly what breaks a page taller than its container: centring an
          // overflowing item clips its top and makes the first rows unreachable.
          fitting ? 'flex flex-col items-center' : 'block',
        )}
        style={{ padding: CANVAS_PADDING }}
      >
        <div
          className="relative shrink-0 bg-white shadow-2xl shadow-black/60"
          style={{
            width: `${settings.sheetWidthMm * scale}px`,
            height: `${settings.sheetHeightMm * scale}px`,
            margin: fitting ? undefined : '0 auto',
          }}
        >
          <SheetBody
            grid={grid}
            scale={scale}
            placements={current?.placements}
            marks={marks}
            cards={cards}
            selectedCell={selectedCell}
            activeZone={activeZone}
            editingCell={editing?.cellIndex ?? null}
            pictureKey={pictureEditing}
            onDeselect={() => {
              setEditing(null)
              setPictureEditing(null)
              onSelectCell(null)
            }}
            onSelectCell={onSelectCell}
            onBeginTextEdit={(cellIndex, key, zone) => {
              props.onSelectCell(cellIndex)
              setSelection(null)
              setEditing({ cellIndex, key, zone })
            }}
            onEndEdit={() => {
              setSelection(null)
              setEditing(null)
            }}
            onSelectionChange={(zone, next) => setSelection(zone === editing?.zone ? next : null)}
            onTextChange={(key, zone, text) => apply(key, (current) => textInto(current, zone, text))}
            onStyleChange={(key, zone, style) =>
              apply(key, (current) => styleInto(current, zone, style))
            }
            onBeginPictureEdit={(cellIndex, key) => {
              props.onSelectCell(cellIndex)
              setPictureEditing(key)
            }}
            onEndPictureEdit={() => setPictureEditing(null)}
            onImageChange={(key, transform) =>
              apply(key, (current) => ({ ...current, imageTransform: transform }))
            }
            onBandsChange={(key, bands) =>
              apply(key, (current) => ({ ...current, bands: clampBands(bands, grid.cellHeightMm) }))
            }
          />
        </div>
      </div>
    </div>
  )
}

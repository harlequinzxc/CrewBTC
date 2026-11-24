import { useCallback, useEffect, useState } from 'react'
import { cutMarksFor, planSheets } from '../../../lib/imposition/sheet'
import type { PageRef } from '../../../lib/imposition/sheet'
import type { GridLayout, SheetSettings } from '../../../types/imposition'
import { clampBands } from '../../../types/card'
import { cn } from '../../../lib/cn'
import type { Card } from '../../../types/card'
import { TextBarLayer } from '../cards/TextBarLayer'
import { SheetPaper } from './SheetPaper'
import { blankCard } from '../cards/use-cards'
import { CANVAS_PADDING } from './use-sheet-zoom'
import { sheetOffsets } from './sheet-stack'
import { useSheetScroll } from './use-sheet-scroll'
import { activeStyle, bandsInto, colorInto, styleInto, styleSelection, textInto } from '../cards/card-edits'
import { useTextEditGesture } from '../cards/use-text-edit-gesture'
import { useEditDismissal } from '../cards/use-edit-dismissal'
import type { CardZone } from '../cards/Card'

export interface CardSheetProps {
  readonly settings: SheetSettings
  readonly grid: GridLayout
  readonly pages: readonly PageRef[]
  readonly cards: Readonly<Record<string, Card>>
  readonly showCutMarks: boolean
  readonly selectedCell: number | null
  /** The sheet holding the selected cell, so only that sheet draws the ring. */
  readonly selectionSheet: number | null
  readonly onSelectCell: (cellIndex: number | null) => void
  readonly onCardChange: (key: string, card: Card) => void
  /** Owned by the workspace, because the top bar draws the same number. */
  readonly scale: number
  readonly fitting: boolean
  readonly paneRef: (node: HTMLDivElement | null) => void
  /** Which sheet is highlighted in the strip. Zero-based. */
  readonly sheetIndex: number
  /** Called as the user scrolls the stack, so the strip can follow. */
  readonly onVisibleSheetChange: (sheetIndex: number) => void
  /** Set when something asked to navigate; the stack scrolls to it and clears it. */
  readonly scrollTo: number | null
  readonly onScrollToHandled: () => void
}

interface EditState {
  /** Which sheet the card is on. A cell index alone is a shape, not a place. */
  readonly sheet: number
  readonly cellIndex: number
  readonly key: string
  readonly zone: CardZone
}

/**
 * The sheets, stacked, drawn at true physical proportions.
 *
 * Every sheet sits under the one before it, 24px apart, in **one** scroll container. That
 * is not a layout preference: page three of a twelve-card document is the first row of
 * sheet 2, and a viewer that shows one sheet at a time makes the boundary between them a
 * thing you have to click through instead of scroll past. A batch of 27 files is the same
 * problem three times over.
 *
 * So there is no "current sheet" governing what is drawn — every sheet is drawn. The
 * one thing that survives is *which one you are looking at*, and that is measured from
 * this container's own scroll position rather than stored: scrolling *is* the navigation,
 * and a thumbnail click is the same act, performed by setting `scrollTop`.
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
    selectionSheet,
    onSelectCell,
    paneRef,
    sheetIndex,
    onVisibleSheetChange,
    scrollTo,
    onScrollToHandled,
  } = props
  // One per sheet, never per zone — `use-text-edit-gesture` explains what the other way cost.
  const gesture = useTextEditGesture()
  const [editing, setEditing] = useState<EditState | null>(null)
  const [pictureEditing, setPictureEditing] = useState<string | null>(null)
  // A stale range must never style text nobody is looking at, so every boundary clears it.
  const [selection, setSelection] = useState<{ start: number; end: number } | null>(null)
  // An edit ends when the user acts, never on focus loss: see `use-edit-dismissal`.
  const dismissal = useEditDismissal({
    editingCell: editing?.cellIndex ?? null,
    onEndEdit: () => { setSelection(null); setEditing(null) },
    onSelectCell,
    onDeselect: () => { setPictureEditing(null); onSelectCell(null) },
  })

  const sheets = planSheets(pages, grid)
  const marks = showCutMarks ? cutMarksFor(grid) : []
  const offsets = sheetOffsets(sheets.length, settings.sheetHeightMm, scale)

  const scroll = useSheetScroll({
    offsets,
    scrollTo,
    onScrolled: onVisibleSheetChange,
    onScrollHandled: onScrollToHandled,
  })

  // A shorter document must not open half way down a longer one's leftovers.
  const resetStack = scroll.reset
  useEffect(() => {
    resetStack()
  }, [sheets.length, resetStack])

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
    // The floating pill is positioned against this preview viewport, outside the scroll content.
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Floating overlay; `TextBarLayer` explains why it is not in flow. */}
      {editing !== null && editZone !== null ? (
        <TextBarLayer
          sheet={editing.sheet}
          cell={editing.cellIndex}
          zone={editZone}
          style={barCard[editZone === 'header' ? 'headerStyle' : 'bodyStyle']}
          selection={selection}
          active={activeStyle(barCard, editZone, selection)}
          onColor={(color) => apply(editing.key, (card) => colorInto(card, editZone, selection, color))}
          onChange={(style) => {
            const zone = editZone
            apply(editing.key, (card) =>
              selection === null
                ? styleInto(card, zone, style)
                : styleSelection(card, zone, selection, style),
            )
          }}
        />
      ) : null}
      <div
        ref={(element) => {
          paneRef(element)
          scroll.ref(element)
        }}
        data-testid="sheet-pane"
        onScroll={scroll.onScroll}
        /*
          The ground, not the paper. A pointer-down that reaches this element has missed
          every card, every sheet and the strip, which is the definition of "deselect" —
          and it has to be pointer-down rather than click so it behaves like the click on
          a card that it replaces, instead of waiting for a release that may land on a
          different element.
        */
        onPointerDown={(event) => {
          if (event.target === event.currentTarget) dismissal.selectCell(null)
        }}
        className={cn(
          'relative min-h-0 flex-1 overflow-auto',
          // Width-fit makes the sheet as wide as the pane and taller than it, so the pane
          // always scrolls vertically. It used to `place-items-center` while fitted, which
          // is exactly what breaks a page taller than its container: centring an
          // overflowing item clips its top and makes the first rows unreachable.
          fitting ? 'flex flex-col items-center' : 'block',
        )}
        style={{ padding: CANVAS_PADDING }}
      >
        <div className="flex w-full flex-col items-center">
          {sheets.map((plan, index) => (
            <SheetPaper
              key={plan.sheetNumber}
              plan={plan}
              index={index}
              sheetIndex={sheetIndex}
              settings={settings}
              grid={grid}
              scale={scale}
              marks={marks}
              cards={cards}
              selectedCell={selectedCell}
              selectionHere={selectionSheet === index}
              activeZone={activeZone}
              editing={editing?.sheet === index ? editing : null}
              pictureEditing={pictureEditing}
              showCutMarks={showCutMarks}
              onSelectCell={dismissal.selectCell}
              onDeselect={dismissal.deselect}
              gesture={gesture}
              onBeginTextEdit={(cellIndex, key, zone) => {
                dismissal.selectCell(cellIndex)
                setEditing({ sheet: index, cellIndex, key, zone })
              }}
              onEndEdit={dismissal.endEdit}
              onSelectionChange={(zone, next) => setSelection(zone === editing?.zone ? next : null)}
              onTextChange={(key, zone, text) => apply(key, (current) => textInto(current, zone, text))}
              onStyleChange={(key, zone, style) => apply(key, (current) => styleInto(current, zone, style))}
              onBeginPictureEdit={(cellIndex, key) => {
                props.onSelectCell(cellIndex)
                setPictureEditing(key)
              }}
              onEndPictureEdit={() => setPictureEditing(null)}
              onImageChange={(key, transform) =>
                apply(key, (current) => ({ ...current, imageTransform: transform }))
              }
              // A cut photo is new pixels, so it goes through the same card writer as
              // everything else and the exporter needs no knowledge of how it was made.
              onPhotoReplace={(key, photo) =>
                apply(key, (current) => ({ ...current, photo }))
              }
              // Every card takes this one's split. Driven through `onCardChange`, which the
              // sheet already has, so the workspace stays the only writer.
              onMatchBands={(bands) => {
                for (const [key, card] of Object.entries(cards)) {
                  props.onCardChange(key, bandsInto(card, bands, grid.cellHeightMm))
                }
              }}
              onCornerChange={(key, patch) => apply(key, (current) => ({ ...current, ...patch }))}
              onBandsChange={(key, bands) =>
                apply(key, (current) => ({ ...current, bands: clampBands(bands, grid.cellHeightMm) }))
              }
            />
          ))}
        </div>
      </div>
    </div>
  )
}

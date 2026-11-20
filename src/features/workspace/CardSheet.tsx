import { useCallback, useState } from 'react'
import { cutMarksFor, planSheets } from '../../lib/imposition/sheet'
import type { PageRef } from '../../lib/imposition/sheet'
import type { GridLayout, SheetSettings } from '../../types/imposition'
import { cardKey, clampBands } from '../../types/card'
import { cn } from '../../lib/cn'
import type { Card } from '../../types/card'
import { CardTextBar } from './CardTextBar'
import { SheetBody } from './SheetBody'
import { SheetToolbar } from './SheetToolbar'
import { useElementSize } from '../../lib/use-element-size'
import { useNonPassiveWheel } from '../../lib/use-wheel'
import { fitScale, nextZoom, previousZoom, wheelZoom } from '../../lib/zoom'
import { BandPanel } from './BandPanel'
import { blankCard } from './use-cards'
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
}

const PANE_PADDING = 12

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
  // The caret's selection in the box being edited. Cleared on every edit boundary, so a
  // stale range can never style text the user is no longer looking at.
  const [selection, setSelection] = useState<{ readonly start: number; readonly end: number } | null>(null)

  // `null` means following the pane; a number means the user chose it and the pane scrolls.
  const [manualScale, setManualScale] = useState<number | null>(null)
  const [containerRef, size] = useElementSize<HTMLDivElement>()

  const fit = fitScale(
    Math.max(0, size.width - PANE_PADDING * 2),
    Math.max(0, size.height - PANE_PADDING * 2),
    settings.sheetWidthMm,
    settings.sheetHeightMm,
  )
  const scale = manualScale ?? fit
  const overflows =
    settings.sheetWidthMm * scale > size.width || settings.sheetHeightMm * scale > size.height

  // Ctrl/Cmd + wheel zooms the sheet, not the browser page. Non-passive so the
  // `preventDefault` is honoured — React's delegated wheel listener is passive.
  const paneRef = useNonPassiveWheel<HTMLDivElement>((event) => {
    if (!event.ctrlKey && !event.metaKey) return
    event.preventDefault()
    setManualScale(wheelZoom(scale, event.deltaY))
  })

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

  if (grid.isEmpty) {
    return (
      <div className="grid flex-1 place-items-center p-6 text-center">
        <p className="max-w-xs text-sm text-zinc-400">
          No cell fits on this sheet. Reduce the cell size, the gutter, or the margin.
        </p>
      </div>
    )
  }

  const activeZone = editing === null ? null : editing.zone

  // The card under the caret, used by the formatting bar for both its state and its target.
  const editZone = editing === null || editing.zone === 'picture' ? null : editing.zone
  const barCard = editing === null ? blankCard(grid.cellHeightMm) : (cards[editing.key] ?? blankCard(grid.cellHeightMm))

  // The selected card, resolved once for the docked panel.
  const selectedPlacement =
    props.selectedCell === null
      ? undefined
      : first?.placements.find((item) => item.cellIndex === props.selectedCell)
  const selectedKey =
    props.selectedCell === null || selectedPlacement === undefined
      ? null
      : cardKey(props.selectedCell, selectedPlacement.documentId, selectedPlacement.pageNumber)
  const selectedCard = selectedKey === null ? null : (cards[selectedKey] ?? null)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* The formatting bar follows whichever text box has the caret. */}
      {editing !== null && editZone !== null ? (
        <div className="shrink-0 border-b border-zinc-800 px-3 py-1.5">
          <CardTextBar
            zone={editZone}
            style={barCard[editZone === 'header' ? 'headerStyle' : 'bodyStyle']}
            selection={selection}
            active={activeStyle(barCard, editZone, selection)}
            onChange={(style) => {
              const zone = editZone
              apply(editing.key, (card) =>
                selection === null ? styleInto(card, zone, style) : styleSelection(card, zone, selection, style),
              )
            }}
          />
        </div>
      ) : null}

      <SheetToolbar
        grid={grid}
        sheetCount={sheets.length}
        scale={scale}
        fitting={manualScale === null}
        panned={false}
        onStep={(direction) => setManualScale(direction === 1 ? nextZoom(scale) : previousZoom(scale))}
        onFit={() => setManualScale(null)}
        onResetPan={() => undefined}
      />

      <div
        ref={(node) => {
          containerRef.current = node
          paneRef.current = node
        }}
        data-testid="sheet-pane"
        className={cn(
          'min-h-0 flex-1 p-3',
          overflows ? 'overflow-auto' : 'grid place-items-center overflow-hidden',
        )}
      >
        <div
          className="relative shrink-0 bg-white shadow-xl shadow-black/50 ring-1 ring-black/20"
          style={{
            width: `${settings.sheetWidthMm * scale}px`,
            height: `${settings.sheetHeightMm * scale}px`,
          }}
        >
        <SheetBody
          grid={grid}
          scale={scale}
          placements={first?.placements}
          marks={marks}
          cards={cards}
          selectedCell={props.selectedCell}
          activeZone={activeZone}
          editingCell={editing?.cellIndex ?? null}
          pictureKey={pictureEditing}
          onDeselect={() => {
            setEditing(null)
            setPictureEditing(null)
            props.onSelectCell(null)
          }}
          onSelectCell={props.onSelectCell}
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
          onStyleChange={(key, zone, style) => apply(key, (current) => styleInto(current, zone, style))}
          onBeginPictureEdit={(cellIndex, key) => {
            props.onSelectCell(cellIndex)
            setPictureEditing(key)
          }}
          onEndPictureEdit={() => setPictureEditing(null)}
          onImageChange={(key, transform) => apply(key, (current) => ({ ...current, imageTransform: transform }))}
          onBandsChange={(key, bands) =>
            apply(key, (current) => ({ ...current, bands: clampBands(bands, grid.cellHeightMm) }))
          }
        />
        </div>
      </div>

      <div className="shrink-0 border-t border-zinc-800 bg-zinc-900/60">
        <BandPanel
          card={selectedCard}
          cellIndex={props.selectedCell ?? 0}
          cellHeightMm={grid.cellHeightMm}
          onChange={(bands) => {
            if (selectedKey === null) return
            apply(selectedKey, (current) => ({ ...current, bands }))
          }}
          onTextScaleChange={(textScale) => {
            if (selectedKey === null) return
            apply(selectedKey, (current) => ({ ...current, textScale }))
          }}
        />
      </div>

      <p className="shrink-0 px-3 pb-2 text-xs text-zinc-500">
        {pages.length} {pages.length === 1 ? 'page' : 'pages'} placed · click a text box to type ·
        double-click a photo to move and zoom · select a card for its top/bottom sliders
      </p>
    </div>
  )
}

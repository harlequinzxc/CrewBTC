import { cardKey } from '../../types/card'
import type { Card } from '../../types/card'
import type { GridLayout } from '../../types/imposition'
import { Card as CardView } from './Card'
import { blankCard } from './use-cards'
import type { CardZone } from './Card'

/**
 * Everything painted on the sheet: the empty-cell guides, every card, and the cut marks.
 *
 * Split out of `CardSheet` so that component can stay what its name says — the thing that
 * owns *which* card is being edited — while this one owns the drawing. Both are given the
 * same grid and the same sheet scale, so what is drawn here is what is exported.
 */

/** One page placed into one cell, as the sheet planner produces it. */
export interface Placement {
  readonly cellIndex: number
  readonly documentId: string
  readonly pageNumber: number
  readonly fileName: string
}

export interface SheetBodyProps {
  readonly grid: GridLayout
  readonly scale: number
  readonly placements: readonly Placement[] | undefined
  readonly marks: readonly { readonly x1Mm: number; readonly y1Mm: number; readonly x2Mm: number; readonly y2Mm: number }[]
  readonly cards: Readonly<Record<string, Card>>
  readonly selectedCell: number | null
  /**
   * Whether the selection belongs to *this* sheet. False dims the ring without moving the
   * selection: with every sheet on screen at once, the same cell index exists on several
   * of them and only one of them is the cell the inspector is describing.
   */
  readonly selectionHere?: boolean
  readonly activeZone: CardZone | null
  readonly editingCell: number | null
  readonly pictureKey: string | null
  readonly onDeselect: () => void
  /**
   * A cell was clicked. The page identity travels with it: cell 4 holds a different page
   * on every sheet, so the cell number alone cannot say which sheet the user just pointed
   * at.
   */
  readonly onSelectCell: (
    cellIndex: number,
    page?: { readonly documentId: string; readonly pageNumber: number },
  ) => void
  readonly onBeginTextEdit: (cellIndex: number, key: string, zone: 'header' | 'body') => void
  readonly onEndEdit: () => void
  readonly onSelectionChange: (zone: 'header' | 'body', selection: { readonly start: number; readonly end: number } | null) => void
  readonly onTextChange: (key: string, zone: 'header' | 'body', text: string) => void
  readonly onStyleChange: (key: string, zone: 'header' | 'body', style: Card['headerStyle']) => void
  readonly onBeginPictureEdit: (cellIndex: number, key: string) => void
  readonly onEndPictureEdit: () => void
  readonly onImageChange: (key: string, transform: Card['imageTransform']) => void
  readonly onBandsChange: (key: string, bands: Card['bands']) => void
}

export function SheetBody(props: SheetBodyProps) {
  const { grid, scale, placements, cards } = props

  return (
    <>
      <button
        type="button"
        data-target="dense"
        aria-label="Sheet preview — deselect card"
        className="absolute inset-0 z-0 min-h-8 cursor-default focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        onClick={props.onDeselect}
      />

      {grid.cells.map((cell) => {
        const placement = placements?.find((item) => item.cellIndex === cell.index)
        const geometry = {
          left: `${cell.rect.xMm * scale}px`,
          top: `${cell.rect.yMm * scale}px`,
          width: `${cell.rect.widthMm * scale}px`,
          height: `${cell.rect.heightMm * scale}px`,
        }

        if (placement === undefined) {
          // An empty cell is a place, not a missing thing. At rest it is a whisper of a
          // rule on the paper and a numeral you only notice when looking for it; the
          // rules and the numeral step up together on hover and keyboard focus, so the
          // slots announce themselves when the pointer is hunting for one and stay out
          // of the way of the twelve cards when it is not.
          return (
            <div
              key={cell.index}
              className="group absolute border border-zinc-200/70 transition-colors duration-150 ease-out hover:border-zinc-400 focus-within:border-zinc-400"
              style={geometry}
            >
              <span className="tabular absolute left-0.5 top-0.5 text-[9px] leading-none text-zinc-300 transition-colors duration-150 ease-out group-hover:text-zinc-500">
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
            selected={props.selectionHere !== false && props.selectedCell === cell.index}
            editing={props.editingCell === cell.index ? props.activeZone : null}
            pictureEditing={props.pictureKey === key}
            onSelect={() =>
              props.onSelectCell(cell.index, {
                documentId: placement.documentId,
                pageNumber: placement.pageNumber,
              })
            }
            onBeginTextEdit={(zone) => props.onBeginTextEdit(cell.index, key, zone)}
            onEndEdit={props.onEndEdit}
            onSelectionChange={props.onSelectionChange}
            onTextChange={(zone, text) => props.onTextChange(key, zone, text)}
            onStyleChange={(zone, style) => props.onStyleChange(key, zone, style)}
            onBeginPictureEdit={() => props.onBeginPictureEdit(cell.index, key)}
            onEndPictureEdit={props.onEndPictureEdit}
            onImageChange={(transform) => props.onImageChange(key, transform)}
            onBandsChange={(bands) => props.onBandsChange(key, bands)}
          />
        )
      })}

      {props.marks.map((mark, index) => (
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
    </>
  )
}

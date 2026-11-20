import { cn } from '../../lib/cn'
import { cutMarksFor } from '../../lib/imposition/sheet'
import { SHEET_GAP } from './sheet-stack'
import { SheetBody } from './SheetBody'
import type { TextEditGesture } from './use-text-edit-gesture'
import type { Card } from '../../types/card'
import type { GridLayout, SheetSettings } from '../../types/imposition'
import type { SheetPlan } from '../../lib/imposition/sheet'
import type { CardZone } from './Card'

/**
 * One sheet of the stack: a white page, its cards, and the cut marks it will be printed
 * with.
 *
 * Split from `CardSheet` because the stack draws *every* sheet and the parent's job is
 * now scroll bookkeeping rather than drawing. Every handler here is the same handler for
 * all sheets — a card on sheet 1 and a card on sheet 3 are edited by one code path, which
 * is the reason a single page-at-a-time canvas could not be trusted with a 27-file batch.
 */
export interface SheetPaperProps {
  readonly plan: SheetPlan
  /** Position in the stack. The first sheet gets no leading gap. */
  readonly index: number
  /** The sheet the strip is highlighting, for the label at the fold. */
  readonly sheetIndex: number
  readonly settings: SheetSettings
  readonly grid: GridLayout
  readonly scale: number
  readonly marks: ReturnType<typeof cutMarksFor>
  readonly cards: Readonly<Record<string, Card>>
  readonly selectedCell: number | null
  readonly selectionHere: boolean
  readonly activeZone: CardZone | null
  readonly editing: { readonly cellIndex: number; readonly key: string } | null
  readonly pictureEditing: string | null
  readonly showCutMarks: boolean
  readonly onSelectCell: (
    cellIndex: number | null,
    page?: { readonly documentId: string; readonly pageNumber: number },
  ) => void
  readonly onDeselect: () => void
  readonly gesture: TextEditGesture
  readonly onBeginTextEdit: (
    cellIndex: number,
    key: string,
    zone: 'header' | 'body',
  ) => void
  readonly onEndEdit: () => void
  readonly onSelectionChange: (
    zone: 'header' | 'body',
    selection: { readonly start: number; readonly end: number } | null,
  ) => void
  readonly onTextChange: (key: string, zone: 'header' | 'body', text: string) => void
  readonly onStyleChange: (
    key: string,
    zone: 'header' | 'body',
    style: Card['headerStyle'],
  ) => void
  readonly onBeginPictureEdit: (cellIndex: number, key: string) => void
  readonly onEndPictureEdit: () => void
  readonly onImageChange: (key: string, transform: Card['imageTransform']) => void
  readonly onBandsChange: (key: string, bands: Card['bands']) => void
}

export function SheetPaper(props: SheetPaperProps) {
  const { plan, settings, scale } = props

  return (
    <div
      data-sheet={plan.sheetNumber}
      data-sheet-active={props.index === props.sheetIndex ? 'true' : undefined}
      className="relative shrink-0"
      style={{ marginTop: props.index === 0 ? 0 : SHEET_GAP }}
    >
      {/*
        The numeral sits in the gap above its sheet, on the dark ground. Without it a stack
        of identical white pages gives no clue where one ends and the next begins — the
        cut marks are the same on every page. `aria-hidden` because the strip already
        announces the count and this is a caption for the eye.
      */}
      <span
        aria-hidden="true"
        className={cn(
          'tabular absolute -top-4 right-0 text-[10px] leading-none',
          props.index === props.sheetIndex ? 'text-accent-bright' : 'text-ink-muted',
        )}
      >
        {plan.sheetNumber}
      </span>

      <div
        className={cn('relative bg-white shadow-2xl shadow-black/60')}
        style={{
          width: `${settings.sheetWidthMm * scale}px`,
          height: `${settings.sheetHeightMm * scale}px`,
        }}
      >
        {/*
          The sheet's own margins. Clicking the paper but not a card is the same gesture
          as clicking the backdrop: deselect. It has to sit *under* the cards and *over*
          the page, which is why it is a sibling of the body rather than part of it —
          `SheetBody`'s overlay is already the in-cell background.
        */}
        <div
          aria-hidden="true"
          className="absolute inset-0 z-0"
          onPointerDown={props.onDeselect}
        />

        <SheetBody
          grid={props.grid}
          scale={scale}
          placements={plan.placements}
          marks={props.showCutMarks ? props.marks : []}
          cards={props.cards}
          selectedCell={props.selectedCell}
          selectionHere={props.selectionHere}
          activeZone={props.activeZone}
          editingCell={props.editing?.cellIndex ?? null}
          pictureKey={props.pictureEditing}
          onDeselect={props.onDeselect}
          onSelectCell={props.onSelectCell}
          gesture={props.gesture}
          onBeginTextEdit={props.onBeginTextEdit}
          onEndEdit={props.onEndEdit}
          onSelectionChange={props.onSelectionChange}
          onTextChange={props.onTextChange}
          onStyleChange={props.onStyleChange}
          onBeginPictureEdit={props.onBeginPictureEdit}
          onEndPictureEdit={props.onEndPictureEdit}
          onImageChange={props.onImageChange}
          onBandsChange={props.onBandsChange}
        />
      </div>
    </div>
  )
}

import { CARD_TEXT_PT } from '../../../types/card-typography'
import { CardCornerLabels } from './CardCornerLabels'
import { cn } from '../../../lib/cn'
import { cardZones } from '../../../types/card'
import type { Card, RectMm } from '../../../types/card'
import { CardZoneImage } from './CardZoneImage'
import { CardZoneText } from './CardZoneText'
import { relativeToCard } from './zone-box'
import { ZoneDividers } from './ZoneDividers'
import type { TextEditGesture } from './use-text-edit-gesture'

export type CardZone = 'header' | 'picture' | 'body'

export interface CardProps {
  readonly card: Card
  readonly cell: RectMm
  /** Pixels per millimetre of the preview. */
  readonly scale: number
  readonly cellIndex: number
  readonly pageLabel: string
  readonly selected: boolean
  readonly editing: CardZone | null
  readonly pictureEditing: boolean
  readonly onCornerChange?: ((patch: Pick<Card, 'numberStart'> | Pick<Card, 'cornerLabelStart'>) => void) | undefined
  readonly onSelect: () => void
  readonly onBeginTextEdit: (zone: 'header' | 'body') => void
  readonly onEndEdit: () => void
  readonly onTextChange: (zone: 'header' | 'body', text: string) => void
  readonly onStyleChange: (zone: 'header' | 'body', style: Card['headerStyle']) => void
  /** Reports the caret's selection in the box being edited, for the formatting bar. */
  readonly onSelectionChange: (zone: 'header' | 'body', selection: { readonly start: number; readonly end: number } | null) => void
  readonly onBeginPictureEdit: () => void
  readonly onEndPictureEdit: () => void
  readonly onImageChange: (transform: Card['imageTransform']) => void
  /** Replaces the photo's pixels — the cut-out, and its undo. */
  readonly onPhotoReplace?: ((photo: Card['photo']) => void) | undefined
  /** The sheet's shared press gesture for text boxes. */
  readonly gesture: TextEditGesture
  /** Present only on the selected card: dividers are a pointer gesture on that one card. */
  readonly onBandsChange?: (bands: Card['bands']) => void
  /** Gives every card this card's band split. */
  readonly onMatchBands?: ((bands: Card['bands']) => void) | undefined
}

/**
 * One card on the sheet: top text, photo, bottom text.
 *
 * The three zones come from `cardZones`, the same function the exporter calls, so the
 * card cannot be laid out one way here and another way on paper. Each zone is its own
 * editable thing; there is no joined string to split back apart and no sheet-wide band
 * setting that overrides an individual card.
 */
export function Card(props: CardProps) {
  const { card, cell, scale, selected, editing, pictureEditing } = props
  // `cardZones` answers in sheet millimetres because the exporter draws on the page.
  // The card element is `position: relative`, so its children must be positioned from
  // the card's own corner — otherwise every zone is shifted by the card's offset on the
  // sheet, which is what let the photo escape its cell.
  const zones = cardZones(cell, card.bands)
  const header = relativeToCard(zones.header, cell)
  const picture = relativeToCard(zones.picture, cell)
  const footer = relativeToCard(zones.footer, cell)
  const px = (mm: number): string => `${mm * scale}px`

  return (
    <div
      data-cell={props.cellIndex}
      data-page={props.pageLabel}
      className={cn(
        // Square corners: a cut card has no radius, and the outline is what the exporter
        // draws too, so the preview is not rounding something the print keeps sharp.
        'absolute overflow-hidden bg-white',
        selected ? 'outline outline-2 outline-accent' : 'outline outline-1 outline-zinc-200',
      )}
      style={{
        left: px(cell.xMm),
        top: px(cell.yMm),
        width: px(cell.widthMm),
        height: px(cell.heightMm),
      }}
      onPointerDown={props.onSelect}
    >
      {props.onCornerChange === undefined ? null : <CardCornerLabels card={card} scale={scale} widthMm={cell.widthMm} onInteract={props.onEndEdit} onChange={props.onCornerChange} />}
      <CardZoneText
        gesture={props.gesture}
        text={card.headerText}
        scale={scale}
        xMm={header.xMm}
        yMm={header.yMm}
        widthMm={header.widthMm}
        heightMm={header.heightMm}
        style={card.headerStyle}
        runs={card.headerRuns ?? []}
        editing={editing === 'header'}
        onSelectionChange={(selection) => props.onSelectionChange('header', selection)}
        maxPt={CARD_TEXT_PT}
        textScale={card.textScale ?? 1}
        placeholder="Dish code · Dish name"
        centreVertically
        onBeginEdit={() => props.onBeginTextEdit('header')}
        onChange={(text) => props.onTextChange('header', text)}
        onEndEdit={props.onEndEdit}
        onStyle={(style) => props.onStyleChange('header', style)}
      />

      <CardZoneImage
        box={picture}
        photo={card.photo}
        transform={card.imageTransform}
        scale={scale}
        editing={pictureEditing}
        onBeginEdit={props.onBeginPictureEdit}
        onEndEdit={props.onEndPictureEdit}
        onMatchBands={
          props.onMatchBands === undefined ? undefined : () => props.onMatchBands?.(card.bands)
        }
        onChange={props.onImageChange}
        onPhotoReplace={props.onPhotoReplace}
      />

      <CardZoneText
        gesture={props.gesture}
        text={card.bodyText}
        scale={scale}
        xMm={footer.xMm}
        yMm={footer.yMm}
        widthMm={footer.widthMm}
        heightMm={footer.heightMm}
        style={card.bodyStyle}
        runs={card.bodyRuns ?? []}
        editing={editing === 'body'}
        onSelectionChange={(selection) => props.onSelectionChange('body', selection)}
        maxPt={CARD_TEXT_PT}
        textScale={card.textScale ?? 1}
        placeholder="Plating steps"
        onBeginEdit={() => props.onBeginTextEdit('body')}
        onChange={(text) => props.onTextChange('body', text)}
        onEndEdit={props.onEndEdit}
        onStyle={(style) => props.onStyleChange('body', style)}
      />

      {/*
        Dividers go **last**, and that is the whole fix. They used to sit between the
        header and the body, so the two 7px bands centred on the zone boundaries painted
        over the bottom of the header box and the top of the footer box — and they only
        exist on the *selected* card, which is precisely the card whose text you are trying
        to click. Selecting a card made its own text unclickable within ~3.5px of the band
        edge, which is most of a short header.

        Rendered last they still sit above the zones and stay grabbable, but the zones
        after them can take the pointer, so a click on the words edits the words.
      */}
      {selected && props.onBandsChange !== undefined ? (
        <ZoneDividers
          bands={card.bands}
          cellHeightMm={cell.heightMm}
          scale={scale}
          onChange={props.onBandsChange}
        />
      ) : null}
    </div>
  )
}

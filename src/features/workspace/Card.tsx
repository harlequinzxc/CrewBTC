import { cn } from '../../lib/cn'
import { cardZones } from '../../types/card'
import type { Card, RectMm } from '../../types/card'
import { CardZoneImage } from './CardZoneImage'
import { CardZoneText } from './CardZoneText'
import { relativeToCard } from './zone-box'

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
        'absolute overflow-hidden rounded-[1mm] bg-white',
        selected ? 'outline outline-2 outline-sky-500' : 'outline outline-1 outline-zinc-200',
      )}
      style={{
        left: px(cell.xMm),
        top: px(cell.yMm),
        width: px(cell.widthMm),
        height: px(cell.heightMm),
      }}
      onPointerDown={props.onSelect}
    >
      <CardZoneText
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
        maxPt={9}
        placeholder="Dish code · Dish name"
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
        onChange={props.onImageChange}
      />

      <CardZoneText
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
        maxPt={8}
        placeholder="Plating steps"
        onBeginEdit={() => props.onBeginTextEdit('body')}
        onChange={(text) => props.onTextChange('body', text)}
        onEndEdit={props.onEndEdit}
        onStyle={(style) => props.onStyleChange('body', style)}
      />

    </div>
  )
}

import { cn } from '../../lib/cn'
import { cardZones } from '../../types/card'
import type { Card, RectMm } from '../../types/card'
import { CardZoneImage } from './CardZoneImage'
import { CardZoneText } from './CardZoneText'

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
  const zones = cardZones(cell, card.bands)
  const px = (mm: number): string => `${mm * scale}px`

  return (
    <div
      data-cell={props.cellIndex}
      data-page={props.pageLabel}
      className={cn(
        'absolute rounded-[1mm] bg-white',
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
        widthMm={zones.header.widthMm}
        heightMm={zones.header.heightMm}
        style={card.headerStyle}
        editing={editing === 'header'}
        maxPt={9}
        placeholder="Dish code · Dish name"
        floorPx={9}
        onBeginEdit={() => props.onBeginTextEdit('header')}
        onChange={(text) => props.onTextChange('header', text)}
        onEndEdit={props.onEndEdit}
        onStyle={(style) => props.onStyleChange('header', style)}
      />

      <CardZoneImage
        box={zones.picture}
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
        widthMm={zones.footer.widthMm}
        heightMm={zones.footer.heightMm}
        style={card.bodyStyle}
        editing={editing === 'body'}
        maxPt={8}
        placeholder="Plating steps"
        floorPx={8}
        onBeginEdit={() => props.onBeginTextEdit('body')}
        onChange={(text) => props.onTextChange('body', text)}
        onEndEdit={props.onEndEdit}
        onStyle={(style) => props.onStyleChange('body', style)}
      />

    </div>
  )
}

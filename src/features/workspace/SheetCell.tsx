import { cn } from '../../lib/cn'
import type { CellSlot } from '../../types/imposition'
import type { ImageTransform } from '../../types/edit'
import { cellZones, splitCellText } from '../../types/edit'
import type { PhotoSource, TextStyle } from '../../types/edit'
import { CardText } from './CardText'
import { CellPicture } from './CellPicture'

export interface SheetCellProps {
  readonly cell: CellSlot
  /** Pixels per millimetre — the measured preview scale. */
  readonly scale: number
  readonly documentId: string
  readonly fileName: string
  readonly pageNumber: number
  readonly sourceWidthMm: number
  readonly sourceHeightMm: number
  /** The extracted photo and its own pixel shape, or undefined when the page had none. */
  readonly photo: PhotoSource | undefined
  /** Band heights come from the sheet settings so every cell matches. */
  readonly headerMm: number
  readonly footerMm: number
  readonly transform: ImageTransform
  /** Pasted copy for this cell. First line is the header, the rest the footer. */
  readonly text: string
  readonly selected: boolean
  readonly onSelect: (cellIndex: number) => void
  readonly headerStyle: TextStyle
  readonly footerStyle: TextStyle
  /** Which band of which cell is being typed into, if any. */
  readonly editing: { readonly cellIndex: number; readonly band: 'header' | 'footer' } | null
  readonly onBeginEdit: (cellIndex: number, band: 'header' | 'footer') => void
  readonly onEndEdit: () => void
  readonly onTextChange: (cellIndex: number, band: 'header' | 'footer', text: string) => void
  /** True while this cell's photo is in move/zoom mode. */
  readonly pictureEditing: boolean
  readonly onBeginPictureEdit: (cellIndex: number) => void
  readonly onEndPictureEdit: () => void
  readonly onImageChange: (transform: ImageTransform) => void
}

const LABEL = (fileName: string): string => fileName.replace(/\.pdf$/i, '')

/** Rebuilds the single stored string from the two bands after one of them changed. */
const joinBands = (header: string, footer: string): string =>
  footer.trim() === '' ? header : `${header}\n${footer}`

/**
 * One card on the sheet: header band, picture band, footer band.
 *
 * The picture *covers* its band and is clipped to it, so a card never shows white bars
 * and a zoomed image never creeps into the text or across a cut line. What is drawn
 * here is the same geometry the exporter uses, because both call `cellZones` and
 * `coverRectMm` rather than each doing the arithmetic.
 */
export function SheetCell(props: SheetCellProps) {
  const { cell, scale, headerMm, footerMm, transform, text, selected } = props

  const zones = cellZones(cell.rect, {
    headerMm,
    pictureMm: Math.max(0, cell.rect.heightMm - headerMm - footerMm),
    footerMm,
  })
  const px = (mm: number): string => `${mm * scale}px`

  return (
    <div
      // A stable handle for tests and for anything that needs to reach one card.
      data-cell={cell.index}
      data-page={`${props.fileName}#${props.pageNumber}`}
      className={cn(
        'absolute overflow-hidden border border-dashed bg-white',
        selected ? 'border-sky-500 ring-1 ring-sky-400' : 'border-red-400/70',
      )}
      style={{
        left: px(cell.rect.xMm),
        top: px(cell.rect.yMm),
        width: px(cell.rect.widthMm),
        height: px(cell.rect.heightMm),
      }}
    >
      {/* Header band */}
      <div
        className="absolute overflow-hidden px-1"
        style={{ left: 0, top: 0, width: '100%', height: px(zones.headerMm) }}
      >
        <CardText
          text={splitCellText(text).header}
          scale={scale}
          widthMm={cell.rect.widthMm}
          bandMm={zones.headerMm}
          maxPt={11}
          className="font-medium"
          style={props.headerStyle}
          editing={props.editing?.cellIndex === cell.index && props.editing.band === 'header'}
          onBeginEdit={() => props.onBeginEdit(cell.index, 'header')}
          onChange={(next) =>
            props.onTextChange(cell.index, 'header', joinBands(next, splitCellText(text).footer))
          }
          onEndEdit={props.onEndEdit}
        />
      </div>

      {/* Picture band: the photo at its own shape, clipped to this box, with its own
          move/zoom mode on double-click. */}
      <CellPicture
        box={zones.picture}
        photo={props.photo}
        transform={transform}
        onChange={props.onImageChange}
        scale={scale}
        editing={props.pictureEditing}
        onBeginEdit={() => props.onBeginPictureEdit(cell.index)}
        onEndEdit={props.onEndPictureEdit}
      />

      {/* Footer band */}
      <div
        className="absolute overflow-hidden px-1"
        style={{
          left: 0,
          top: px(zones.headerMm + zones.pictureMm),
          width: '100%',
          height: px(zones.footerMm),
        }}
      >
        <CardText
          text={splitCellText(text).footer}
          scale={scale}
          widthMm={cell.rect.widthMm}
          bandMm={zones.footerMm}
          maxPt={8}
          className=""
          style={props.footerStyle}
          editing={props.editing?.cellIndex === cell.index && props.editing.band === 'footer'}
          onBeginEdit={() => props.onBeginEdit(cell.index, 'footer')}
          onChange={(next) =>
            props.onTextChange(cell.index, 'footer', joinBands(splitCellText(text).header, next))
          }
          onEndEdit={props.onEndEdit}
        />
      </div>

      {/* Selection target: the whole card, above the artwork but below nothing else,
          because nothing on a card is interactive. */}
      <button type="button" data-target="dense"
        onClick={() => props.onSelect(cell.index)}
        aria-pressed={selected}
        aria-label={`Cell ${cell.index + 1}: ${LABEL(props.fileName)} page ${props.pageNumber}`}
        className="absolute inset-0 z-10 min-h-8 cursor-pointer bg-transparent hover:bg-sky-300/10 hover:outline-sky-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-500"
      />
      <span className="absolute right-0.5 top-0.5 z-20 text-[8px] leading-none text-zinc-400">
        {cell.index + 1}
      </span>
    </div>
  )
}

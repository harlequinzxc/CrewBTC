import { useState } from 'react'
import { cn } from '../../lib/cn'
import type { CellSlot } from '../../types/imposition'
import type { EditTarget, ImageTransform, PageEdit } from '../../types/edit'
import { DEFAULT_IMAGE_TRANSFORM, fittedRectMm, blockToCellMm, isEdited } from '../../types/edit'
import type { TextRegion } from '../../types/document'
import { TextOverlay } from './TextOverlay'

export interface SheetCellProps {
  readonly cell: CellSlot
  /** Pixels per millimetre — the measured preview scale. */
  readonly scale: number
  readonly fileName: string
  readonly pageNumber: number
  readonly documentId: string
  readonly sourceWidthMm: number
  readonly sourceHeightMm: number
  readonly thumbnailUrl: string | undefined
  readonly blocks: readonly TextRegion[]
  readonly edit: PageEdit
  readonly selected: boolean
  readonly onSelect: (cellIndex: number) => void
  readonly onTextChange: (target: EditTarget, text: string) => void
  readonly onImageChange: (target: EditTarget, image: ImageTransform) => void
}

const LABEL = (fileName: string): string => fileName.replace(/\.pdf$/i, '')

/** Small square control that keeps the 24 px floor without a cramped hit area. */
function Nudge({
  label,
  onClick,
  children,
}: {
  readonly label: string
  readonly onClick: () => void
  readonly children: React.ReactNode
}) {
  return (
    <button type="button" data-target="dense"
      aria-label={label}
      onClick={onClick}
      className="grid min-h-8 min-w-8 place-items-center rounded border border-zinc-600 bg-zinc-900/95 text-xs leading-none text-zinc-100 hover:bg-zinc-700 focus-visible:bg-zinc-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400"
    >
      {children}
    </button>
  )
}

/**
 * One grid cell: the page artwork, every text block on it (editable in place), and —
 * when selected — the artwork transform controls.
 *
 * Text is always shown when blocks are known, not only while selected: a printed card
 * shows its text whether or not you are editing it, and hiding it would misrepresent
 * the sheet.
 */
export function SheetCell(props: SheetCellProps) {
  const { cell, scale, blocks, edit, selected, thumbnailUrl, fileName, pageNumber } = props
  const [editingBlock, setEditingBlock] = useState<string | null>(null)

  const target: EditTarget = {
    kind: 'text',
    cellIndex: cell.index,
    blockId: editingBlock ?? '',
    documentId: props.documentId,
    pageNumber,
  }
  const imageTarget: EditTarget = {
    kind: 'image',
    cellIndex: cell.index,
    documentId: props.documentId,
    pageNumber,
  }

  const artwork = fittedRectMm(cell, props.sourceWidthMm, props.sourceHeightMm, edit.image)
  const edited = isEdited(edit)

  return (
    <div
      className={cn(
        'absolute border border-dashed',
        selected ? 'border-sky-400' : 'border-red-400/70',
      )}
      style={{
        left: `${cell.rect.xMm * scale}px`,
        top: `${cell.rect.yMm * scale}px`,
        width: `${cell.rect.widthMm * scale}px`,
        height: `${cell.rect.heightMm * scale}px`,
      }}
    >
      <span className="absolute left-0.5 top-0.5 z-20 text-[9px] leading-none text-zinc-400">
        {cell.index + 1}
      </span>

      {/* The cell itself is the picker; artwork below is inert so clicks reach it. */}
      <button type="button" data-target="dense"
        onClick={() => props.onSelect(cell.index)}
        aria-pressed={selected}
        aria-label={`Cell ${cell.index + 1}: ${LABEL(fileName)} page ${pageNumber}`}
        className="absolute inset-0 z-10 min-h-8 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400"
      />

      {/* No artwork yet: fall back to the filename rather than an <img> with no src,
          which renders as a broken image and reports itself as a real one. */}
      {artwork !== null && thumbnailUrl !== undefined ? (
        <img
          src={thumbnailUrl}
          alt=""
          draggable={false}
          className="pointer-events-none absolute select-none"
          style={{
            left: `${artwork.xMm * scale}px`,
            top: `${artwork.yMm * scale}px`,
            width: `${artwork.widthMm * scale}px`,
            height: `${artwork.heightMm * scale}px`,
          }}
        />
      ) : null}

      {thumbnailUrl === undefined ? (
        <span className="pointer-events-none absolute inset-1 flex items-center justify-center overflow-hidden text-center text-[9px] leading-tight text-zinc-400">
          {LABEL(fileName)}
        </span>
      ) : null}

      {/* Text overlays: positioned from the same rect the artwork is drawn at. */}
      {artwork === null
        ? null
        : blocks.map((block) => (
            <TextOverlay
              key={block.id}
              box={blockToCellMm(block.box, artwork)}
              value={edit.text[block.id] ?? block.text}
              edited={edit.text[block.id] !== undefined}
              scale={scale}
              sizePt={block.fontSizeRatio * artwork.heightMm * (72 / 25.4)}
              editing={editingBlock === block.id}
              zoomed={scale * 25.4 / 72 >= 12}
              onBegin={() => {
                setEditingBlock(block.id)
                props.onSelect(cell.index)
              }}
              onChange={(text) => props.onTextChange({ ...target, blockId: block.id }, text)}
              onEnd={() => setEditingBlock(null)}
            />
          ))}

      {selected && artwork !== null ? (
        <div className="absolute bottom-0.5 right-0.5 z-20 flex items-center gap-0.5">
          <Nudge
            label={`Move page ${pageNumber} left`}
            onClick={() =>
              props.onImageChange(imageTarget, {
                ...edit.image,
                offsetXMm: edit.image.offsetXMm - 1,
              })
            }
          >
            ←
          </Nudge>
          <Nudge
            label={`Move page ${pageNumber} right`}
            onClick={() =>
              props.onImageChange(imageTarget, {
                ...edit.image,
                offsetXMm: edit.image.offsetXMm + 1,
              })
            }
          >
            →
          </Nudge>
          <Nudge
            label={`Zoom page ${pageNumber} out`}
            onClick={() =>
              props.onImageChange(imageTarget, { ...edit.image, scale: edit.image.scale / 1.1 })
            }
          >
            −
          </Nudge>
          <Nudge
            label={`Zoom page ${pageNumber} in`}
            onClick={() =>
              props.onImageChange(imageTarget, { ...edit.image, scale: edit.image.scale * 1.1 })
            }
          >
            +
          </Nudge>
          {edited ? (
            <button type="button" data-target="dense"
              onClick={() =>
                props.onImageChange(imageTarget, { ...DEFAULT_IMAGE_TRANSFORM, scale: 1 })
              }
              className="min-h-8 rounded border border-zinc-600 bg-zinc-900/95 px-1.5 text-[10px] text-zinc-200 hover:bg-zinc-700 focus-visible:bg-zinc-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400"
            >
              Reset art
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

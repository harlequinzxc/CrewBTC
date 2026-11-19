import { useState } from 'react'
import { ScanLine } from 'lucide-react'
import { cutMarksFor, planSheets } from '../../lib/imposition/sheet'
import type { PageRef, Placement } from '../../lib/imposition/sheet'
import type { GridLayout, SheetSettings } from '../../types/imposition'
import { useElementSize } from '../../lib/use-element-size'
import { useThumbnails } from './use-thumbnails'
import { thumbnailKey } from '../../lib/pdf/thumbnails'
import { DEFAULT_IMAGE_TRANSFORM, DEFAULT_TEXT_STYLE } from '../../types/edit'
import type { ImageTransform, TextStyle } from '../../types/edit'
import { SheetCell } from './SheetCell'
import { CellTools } from './CellTools'

export interface SheetPreviewProps {
  readonly settings: SheetSettings
  readonly grid: GridLayout
  readonly pages: readonly PageRef[]
  readonly showCutMarks: boolean
  /** Extracted dish photos, keyed `file#page`. Preferred over a page render. */
  readonly photos?: Readonly<Record<string, string>> | undefined
  /** Pasted copy, keyed by page index in the batch. */
  readonly texts: Readonly<Record<string, string>>
  /** Artwork framing, keyed by page index in the batch. */
  readonly images: Readonly<Record<string, ImageTransform>>
  readonly selectedCell: number | null
  readonly onSelectCell: (cellIndex: number | null) => void
  readonly onImageChange: (index: number, image: ImageTransform) => void
  readonly onResetImage: (index: number) => void
  /** Text styles per `index|band`. */
  readonly styles: Readonly<Record<string, TextStyle>>
  readonly onTextChange: (index: number, band: 'header' | 'footer', text: string) => void
  readonly onStyleChange: (index: number, band: 'header' | 'footer', style: TextStyle) => void
}

/** Padding kept around the sheet so it never touches the pane edges. */
const BREATHING_ROOM = 24

/**
 * Draws the sheet at true physical proportions, auto-scaled so the whole sheet always
 * fits the available viewport height (and width). The scale factor is measured, never
 * hardcoded, so resizing the window re-fits the preview immediately.
 */
export function SheetPreview(props: SheetPreviewProps) {
  const { settings, grid, pages, showCutMarks, texts, images, selectedCell, styles } = props
  const [editing, setEditing] = useState<{ cellIndex: number; band: 'header' | 'footer' } | null>(null)
  const [containerRef, size] = useElementSize<HTMLDivElement>()
  const sheets = planSheets(pages, grid)
  const first = sheets[0]
  const marks = showCutMarks ? cutMarksFor(grid) : []

  // Only the cells on the visible sheet need artwork.
  const sheetRequests = (first?.placements ?? []).map((placement) => ({
    fileName: placement.documentId,
    pageNumber: placement.pageNumber,
  }))
  const signature = sheetRequests
    .map((request) => thumbnailKey(request.fileName, request.pageNumber))
    .join('|')
  const thumbnails = useThumbnails(sheetRequests, signature)

  if (grid.isEmpty) {
    return (
      <div className="grid flex-1 place-items-center p-6 text-center">
        <p className="max-w-xs text-sm text-zinc-400">
          No cell fits on this sheet. Reduce the cell size, the gutter, or the margin.
        </p>
      </div>
    )
  }

  // Fit the sheet inside the measured box. Both axes are constrained so a tall sheet
  // scales by height and a wide one by width; whichever is tighter wins.
  const availableWidth = Math.max(0, size.width - BREATHING_ROOM)
  const availableHeight = Math.max(0, size.height - BREATHING_ROOM)
  const scale = Math.min(
    availableWidth > 0 ? availableWidth / settings.sheetWidthMm : 1,
    availableHeight > 0 ? availableHeight / settings.sheetHeightMm : 1,
  )
  const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1
  const scaledWidth = settings.sheetWidthMm * safeScale
  const scaledHeight = settings.sheetHeightMm * safeScale

  // Cells are keyed by page index so copy and framing follow the page, not the slot:
  // changing the grid must not silently move someone's words to another card.
  const pageIndexFor = (placement: Placement): number =>
    pages.findIndex(
      (page) =>
        page.documentId === placement.documentId && page.pageNumber === placement.pageNumber,
    )

  const selectedPlacement =
    selectedCell === null
      ? undefined
      : first?.placements.find((item) => item.cellIndex === selectedCell)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-9 shrink-0 items-center gap-3 overflow-x-auto border-b border-zinc-800 px-3">
        <span className="tabular whitespace-nowrap text-xs text-zinc-300">
          {grid.columns} × {grid.rows} = {grid.cellCount} cells
        </span>
        <span className="tabular whitespace-nowrap text-xs text-zinc-500">
          {grid.utilisationPercent}% of paper
        </span>
        <span className="tabular whitespace-nowrap text-xs text-zinc-500">
          {sheets.length} {sheets.length === 1 ? 'sheet' : 'sheets'}
        </span>
        <span className="tabular whitespace-nowrap text-xs text-zinc-400">
          {selectedCell === null ? 'No cell selected' : `Cell ${selectedCell + 1} selected`}
        </span>
        <span className="tabular ml-auto whitespace-nowrap text-xs text-zinc-600">
          {Math.round(safeScale * 100)}% zoom
        </span>
      </div>

      <div ref={containerRef} className="grid min-h-0 flex-1 place-items-center overflow-hidden p-3">
        <div
          className="relative shrink-0 bg-white shadow-xl shadow-black/50 ring-1 ring-black/20"
          style={{ width: `${scaledWidth}px`, height: `${scaledHeight}px` }}
        >
          <button type="button" data-target="dense"
            className="absolute inset-0 z-0 min-h-8 cursor-default focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-500"
            aria-label="Sheet preview — deselect cell"
            onClick={() => props.onSelectCell(null)}
          />
          {grid.cells.map((cell) => {
            const placement = first?.placements.find((item) => item.cellIndex === cell.index)
            if (placement === undefined) {
              return (
                <div
                  key={cell.index}
                  className="absolute border border-dashed border-zinc-300"
                  style={{
                    left: `${cell.rect.xMm * safeScale}px`,
                    top: `${cell.rect.yMm * safeScale}px`,
                    width: `${cell.rect.widthMm * safeScale}px`,
                    height: `${cell.rect.heightMm * safeScale}px`,
                  }}
                >
                  <span className="absolute left-0.5 top-0.5 text-[9px] leading-none text-zinc-400">
                    {cell.index + 1}
                  </span>
                </div>
              )
            }

            const pageIndex = pageIndexFor(placement)
            const key = `${pageIndex}`

            return (
              <SheetCell
                key={cell.index}
                cell={cell}
                scale={safeScale}
                documentId={placement.documentId}
                fileName={placement.fileName}
                pageNumber={placement.pageNumber}
                sourceWidthMm={placement.sourceWidthMm}
                sourceHeightMm={placement.sourceHeightMm}
                thumbnailUrl={
                  props.photos?.[thumbnailKey(placement.documentId, placement.pageNumber)] ??
                  thumbnails[thumbnailKey(placement.documentId, placement.pageNumber)]
                }
                headerMm={settings.headerMm}
                footerMm={settings.footerMm}
                transform={images[key] ?? DEFAULT_IMAGE_TRANSFORM}
                text={texts[key] ?? ''}
                selected={selectedCell === cell.index}
                onSelect={props.onSelectCell}
                headerStyle={styles[`${pageIndex}|header`] ?? DEFAULT_TEXT_STYLE}
                footerStyle={styles[`${pageIndex}|footer`] ?? DEFAULT_TEXT_STYLE}
                editing={editing}
                onBeginEdit={(cellIndex, band) => {
                  setEditing({ cellIndex, band })
                  props.onSelectCell(cellIndex)
                }}
                onEndEdit={() => setEditing(null)}
                onTextChange={props.onTextChange}
              />
            )
          })}

          {marks.map((mark, index) => (
            <div
              key={`mark-${index}`}
              aria-hidden="true"
              className="pointer-events-none absolute bg-red-300/50"
              style={{
                left: `${mark.x1Mm * safeScale}px`,
                top: `${mark.y1Mm * safeScale}px`,
                width: `${Math.max(1, (mark.x2Mm - mark.x1Mm) * safeScale)}px`,
                height: `${Math.max(1, (mark.y2Mm - mark.y1Mm) * safeScale)}px`,
              }}
            />
          ))}
        </div>
      </div>

      {selectedPlacement === undefined ? (
        <div className="flex h-8 shrink-0 items-center gap-2 overflow-hidden border-t border-zinc-800 px-3 text-xs text-zinc-500">
          <ScanLine aria-hidden="true" strokeWidth={2} className="size-3.5 shrink-0" />
          <span className="truncate">
            {grid.gutterMm > 0
              ? `${grid.gutterMm} mm channels between cells — cut along the centres. Select a cell to frame its picture.`
              : 'No gutter set — cells touch, leaving no room for a blade.'}
          </span>
        </div>
      ) : (
        <CellTools
          placement={selectedPlacement}
          transform={images[`${pageIndexFor(selectedPlacement)}`] ?? DEFAULT_IMAGE_TRANSFORM}
          hasText={textForIndex(texts, pageIndexFor(selectedPlacement))}
          onImageChange={(image) => props.onImageChange(pageIndexFor(selectedPlacement), image)}
          onResetImage={() => props.onResetImage(pageIndexFor(selectedPlacement))}
          onClose={() => props.onSelectCell(null)}
        />
      )}
    </div>
  )
}

const textForIndex = (texts: Readonly<Record<string, string>>, index: number): boolean =>
  (texts[`${index}`] ?? '').trim() !== ''


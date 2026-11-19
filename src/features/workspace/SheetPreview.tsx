import { ScanLine } from 'lucide-react'
import { cutMarksFor, planSheets } from '../../lib/imposition/sheet'
import type { Placement } from '../../lib/imposition/sheet'
import type { GridLayout, SheetSettings } from '../../types/imposition'
import { useElementSize } from '../../lib/use-element-size'
import { useThumbnails } from './use-thumbnails'
import { thumbnailKey } from '../../lib/pdf/thumbnails'
import { pageKey } from '../../lib/pdf/page-text-key'
import { sourceVersion } from '../../lib/export/doc-cache'
import { editFor } from '../../types/edit'
import type { EditTarget, ImageTransform, PageEdit } from '../../types/edit'
import type { TextRegion } from '../../types/document'
import { SheetCell } from './SheetCell'
import { EditStrip } from './EditStrip'

export interface SheetPreviewProps {
  readonly settings: SheetSettings
  readonly grid: GridLayout
  readonly pages: readonly import('../../lib/imposition/sheet').PageRef[]
  readonly showCutMarks: boolean
  /** Per-cell edits, keyed by cell + page. */
  readonly edits: Readonly<Record<string, PageEdit>>
  /** Extracted text blocks, keyed `file#version#page`. */
  readonly blocksByPage: Readonly<Record<string, readonly TextRegion[]>>
  readonly selectedCell: number | null
  readonly onSelectCell: (cellIndex: number | null) => void
  readonly onTextChange: (target: EditTarget, text: string) => void
  readonly onImageChange: (target: EditTarget, image: ImageTransform) => void
  readonly onResetCell: (cellIndex: number) => void
}

/** Padding kept around the sheet so it never touches the pane edges. */
const BREATHING_ROOM = 24

/**
 * Draws the sheet at true physical proportions, auto-scaled so the whole sheet always
 * fits the available viewport height (and width). The scale factor is measured, never
 * hardcoded, so resizing the window re-fits the preview immediately.
 */
export function SheetPreview(props: SheetPreviewProps) {
  const { settings, grid, pages, showCutMarks, edits, blocksByPage, selectedCell } = props
  const [containerRef, size] = useElementSize<HTMLDivElement>()
  const sheets = planSheets(pages, grid)
  const first = sheets[0]
  const marks = showCutMarks ? cutMarksFor(grid) : []

  // Only the cells on the visible sheet need artwork or text.
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

  const selectedPlacement =
    selectedCell === null
      ? undefined
      : first?.placements.find((item) => item.cellIndex === selectedCell)

  const blocksFor = (placement: Placement | undefined): readonly TextRegion[] => {
    if (placement === undefined) return []
    const version = sourceVersion(placement.documentId)
    return blocksByPage[pageKey(placement.documentId, placement.pageNumber, version)] ?? []
  }

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
        {/* Clicking the paper (not a cell) clears the selection. A real button so the
            same escape is reachable by keyboard, which a bare div click handler is not. */}
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
                thumbnailUrl={thumbnails[thumbnailKey(placement.documentId, placement.pageNumber)]}
                blocks={blocksFor(placement)}
                edit={editFor(edits, cell.index, placement.documentId, placement.pageNumber)}
                selected={selectedCell === cell.index}
                onSelect={props.onSelectCell}
                onTextChange={props.onTextChange}
                onImageChange={props.onImageChange}
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
              ? `${grid.gutterMm} mm channels between cells — cut along the centres. Select a cell to edit its text and artwork.`
              : 'No gutter set — cells touch, leaving no room for a blade.'}
          </span>
        </div>
      ) : (
        <EditStrip
          placement={selectedPlacement}
          blocks={blocksFor(selectedPlacement)}
          edit={editFor(
            edits,
            selectedPlacement.cellIndex,
            selectedPlacement.documentId,
            selectedPlacement.pageNumber,
          )}
          onTextChange={props.onTextChange}
          onResetCell={() => props.onResetCell(selectedPlacement.cellIndex)}
          onClose={() => props.onSelectCell(null)}
        />
      )}
    </div>
  )
}

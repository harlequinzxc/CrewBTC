import { ScanLine } from 'lucide-react'
import { cutMarksFor, planSheets } from '../../lib/imposition/sheet'
import type { PageRef } from '../../lib/imposition/sheet'
import type { GridLayout, SheetSettings } from '../../types/imposition'
import { useElementSize } from '../../lib/use-element-size'
import { cn } from '../../lib/cn'

export interface SheetPreviewProps {
  readonly settings: SheetSettings
  readonly grid: GridLayout
  readonly pages: readonly PageRef[]
  readonly showCutMarks: boolean
}

/** Padding kept around the sheet so it never touches the pane edges. */
const BREATHING_ROOM = 24

/**
 * Draws the sheet at true physical proportions, auto-scaled so the whole sheet always
 * fits the available viewport height (and width). The scale factor is measured, never
 * hardcoded, so resizing the window re-fits the preview immediately.
 */
export function SheetPreview({ settings, grid, pages, showCutMarks }: SheetPreviewProps) {
  const [containerRef, size] = useElementSize<HTMLDivElement>()
  const sheets = planSheets(pages, grid)
  const first = sheets[0]
  const marks = showCutMarks ? cutMarksFor(grid) : []

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
        <span className="tabular ml-auto whitespace-nowrap text-xs text-zinc-600">
          {Math.round(safeScale * 100)}% zoom
        </span>
      </div>

      <div ref={containerRef} className="grid min-h-0 flex-1 place-items-center overflow-hidden p-3">
        <div
          className="relative shrink-0 bg-white shadow-xl shadow-black/50 ring-1 ring-black/20"
          style={{ width: `${scaledWidth}px`, height: `${scaledHeight}px` }}
        >
          {grid.cells.map((cell) => {
            const placement = first?.placements.find((item) => item.cellIndex === cell.index)
            return (
              <div
                key={cell.index}
                className={cn(
                  'absolute border border-dashed',
                  placement === undefined ? 'border-zinc-300' : 'border-red-400/70',
                )}
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
                {placement === undefined ? null : (
                  <span className="absolute inset-1 flex items-center justify-center overflow-hidden text-center text-[9px] leading-tight text-zinc-500">
                    {placement.fileName.replace(/\.pdf$/i, '')}
                  </span>
                )}
              </div>
            )
          })}

          {marks.map((mark, index) => (
            <div
              key={`mark-${index}`}
              aria-hidden="true"
              className="absolute bg-red-300/50"
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

      <div className="flex h-8 shrink-0 items-center gap-2 overflow-hidden border-t border-zinc-800 px-3 text-xs text-zinc-500">
        <ScanLine aria-hidden="true" strokeWidth={2} className="size-3.5 shrink-0" />
        <span className="truncate">
          {grid.gutterMm > 0
            ? `${grid.gutterMm} mm channels between cells — cut along the centres.`
            : 'No gutter set — cells touch, leaving no room for a blade.'}
        </span>
      </div>
    </div>
  )
}

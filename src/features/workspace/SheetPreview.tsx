import { Scissors } from 'lucide-react'
import { cn } from '../../lib/cn'
import { cutMarksFor, planSheets } from '../../lib/imposition/sheet'
import type { PageRef } from '../../lib/imposition/sheet'
import type { GridLayout, SheetSettings } from '../../types/imposition'

export interface SheetPreviewProps {
  readonly settings: SheetSettings
  readonly grid: GridLayout
  readonly pages: readonly PageRef[]
  readonly showCutMarks: boolean
}

/**
 * Draws the sheet at true physical proportions. Cells are `mm` units, so what you
 * see is the geometry that will be printed — not an approximation of it.
 */
export function SheetPreview({ settings, grid, pages, showCutMarks }: SheetPreviewProps) {
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

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-11 shrink-0 items-center gap-3 border-b border-zinc-800 px-3">
        <span className="tabular text-xs text-zinc-300">
          {grid.columns} × {grid.rows} = {grid.cellCount} cells
        </span>
        <span className="tabular text-xs text-zinc-500">{grid.utilisationPercent}% of paper</span>
        <span className="tabular text-xs text-zinc-500">
          {sheets.length} {sheets.length === 1 ? 'sheet' : 'sheets'}
        </span>
        {grid.slackRightMm > 0 || grid.slackBottomMm > 0 ? (
          <span className="tabular text-xs text-zinc-600">
            slack {grid.slackRightMm}×{grid.slackBottomMm} mm
          </span>
        ) : null}
      </div>

      <div className="grid min-h-0 flex-1 place-items-center overflow-auto p-6">
        <div
          className="relative bg-white shadow-xl shadow-black/50 ring-1 ring-black/20"
          style={{
            width: `${settings.sheetWidthMm}mm`,
            height: `${settings.sheetHeightMm}mm`,
            // The preview is physical; scale it down so a full sheet fits the pane.
            transform: 'scale(0.42)',
            transformOrigin: 'top center',
          }}
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
                  left: `${cell.rect.xMm}mm`,
                  top: `${cell.rect.yMm}mm`,
                  width: `${cell.rect.widthMm}mm`,
                  height: `${cell.rect.heightMm}mm`,
                }}
              >
                <span className="absolute left-0.5 top-0.5 text-[6px] leading-none text-zinc-400">
                  {cell.index + 1}
                </span>
                {placement === undefined ? null : (
                  <span className="absolute inset-1 flex items-center justify-center overflow-hidden text-center text-[6px] leading-tight text-zinc-500">
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
                left: `${mark.x1Mm}mm`,
                top: `${mark.y1Mm}mm`,
                width: `${Math.max(0.15, mark.x2Mm - mark.x1Mm)}mm`,
                height: `${Math.max(0.15, mark.y2Mm - mark.y1Mm)}mm`,
              }}
            />
          ))}
        </div>
      </div>

      <div className="flex h-9 shrink-0 items-center gap-2 border-t border-zinc-800 px-3 text-xs text-zinc-500">
        <Scissors aria-hidden="true" strokeWidth={2} className="size-3.5" />
        {grid.gutterMm > 0
          ? `${grid.gutterMm} mm channels between cells — cut along the centres.`
          : 'No gutter set — cells touch, which leaves no room for a blade.'}
      </div>
    </div>
  )
}

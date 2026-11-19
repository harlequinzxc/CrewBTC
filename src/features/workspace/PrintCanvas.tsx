import { Minus, Plus, ScanLine } from 'lucide-react'
import { EmptyState } from '../../components/ui/EmptyState'
import { computePageGeometry } from '../../lib/trim'
import type { PageSettings } from '../../types/settings'

export interface PrintCanvasProps {
  readonly settings: PageSettings
  readonly zoom: number
  readonly onZoomChange: (zoom: number) => void
  readonly hasSelection: boolean
  readonly showGuides: boolean
}

const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const

/** Centre pane: the print page at true physical proportions.
 *  Rendered in millimetres so the preview matches the export geometry exactly. */
export function PrintCanvas({
  settings,
  zoom,
  onZoomChange,
  hasSelection,
  showGuides,
}: PrintCanvasProps) {
  const geometry = computePageGeometry(settings)
  const prevZoom = ZOOM_STEPS.filter((step) => step < zoom).pop()
  const nextZoom = ZOOM_STEPS.find((step) => step > zoom)

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-zinc-950">
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-zinc-800 px-3">
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <ScanLine aria-hidden="true" strokeWidth={2} className="size-4" />
          <span className="tabular">
            {geometry.mediaWidthMm.toFixed(1)} × {geometry.mediaHeightMm.toFixed(1)} mm
          </span>
          {geometry.bleedMm > 0 ? (
            <span className="tabular text-zinc-500">· {geometry.bleedMm} mm bleed</span>
          ) : null}
        </div>
        <fieldset className="flex items-center gap-1">
          <legend className="sr-only">Zoom</legend>
          <button type="button" data-target="dense" aria-label="Zoom out" onClick={() => onZoomChange(prevZoom ?? ZOOM_STEPS[0] ?? 0.5)}
            className="grid place-items-center rounded-md px-2 text-zinc-400 transition-colors duration-150 ease-out hover:bg-zinc-800 hover:text-zinc-100 focus-visible:bg-zinc-800 focus-visible:text-zinc-100 focus-visible:ring-2 focus-visible:ring-red-500"
          >
            <Minus aria-hidden="true" strokeWidth={2} className="size-4" />
          </button>
          <span className="tabular w-12 text-center text-xs text-zinc-300">
            {Math.round(zoom * 100)}%
          </span>
          <button type="button" data-target="dense" aria-label="Zoom in" onClick={() => onZoomChange(nextZoom ?? ZOOM_STEPS[ZOOM_STEPS.length - 1] ?? 2)}
            className="grid place-items-center rounded-md px-2 text-zinc-400 transition-colors duration-150 ease-out hover:bg-zinc-800 hover:text-zinc-100 focus-visible:bg-zinc-800 focus-visible:text-zinc-100 focus-visible:ring-2 focus-visible:ring-red-500"
          >
            <Plus aria-hidden="true" strokeWidth={2} className="size-4" />
          </button>
        </fieldset>
      </div>

      <div className="grid min-h-0 flex-1 place-items-center overflow-auto p-6">
        {hasSelection ? (
          <div
            className="relative origin-top bg-white shadow-2xl shadow-black/60 ring-1 ring-black/10"
            style={{
              width: `${geometry.mediaWidthMm * zoom}mm`,
              height: `${geometry.mediaHeightMm * zoom}mm`,
            }}
          >
            <div
              className="absolute border border-dashed border-red-500/60"
              style={{
                inset: `${geometry.bleedOffsetMm * zoom}mm`,
                background: showGuides ? 'rgba(239, 68, 68, 0.03)' : undefined,
              }}
            />
          </div>
        ) : (
          <EmptyState
            icon={<ScanLine strokeWidth={2} className="size-6" />}
            title="Nothing selected"
            description="Add a PDF and choose it in the queue to see the print layout."
          />
        )}
      </div>
    </div>
  )
}

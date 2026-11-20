import { clampBands, defaultBands, PICTURE_MIN_MM, BAND_MIN_MM } from '../../types/card'
import type { Card, CardBands } from '../../types/card'

export interface BandPanelProps {
  /** The selected card, or null when nothing is selected. */
  readonly card: Card | null
  readonly cellIndex: number
  readonly cellHeightMm: number
  readonly onChange: (bands: CardBands) => void
}

/** Half a millimetre: fine enough to tune, coarse enough to feel deliberate. */
const STEP_MM = 0.5

/** The three-zone split drawn at panel size, so the sliders have something to point at. */
function ZoneBar(props: { readonly bands: CardBands; readonly cellHeightMm: number }) {
  const { bands, cellHeightMm } = props
  const total = Math.max(1, cellHeightMm)
  const share = (mm: number): string => `${(mm / total) * 100}%`

  return (
    <div
      className="flex w-full overflow-hidden rounded border border-zinc-700"
      style={{ height: 34 }}
      aria-hidden
    >
      <div className="bg-sky-900/60" style={{ height: share(bands.headerMm) }} />
      <div className="w-full bg-zinc-700" style={{ flex: `${cellHeightMm - bands.headerMm - bands.footerMm}` }} />
      <div className="bg-sky-900/60" style={{ flex: bands.footerMm }} />
    </div>
  )
}

/**
 * Top and bottom heights for the selected card.
 *
 * This lives in a docked panel rather than floating over the sheet: a tuner anchored
 * below the card was clipped by the sheet's edge on the bottom row and covered its
 * neighbour everywhere else, which made it look like the sliders did nothing.
 *
 * The numbers are per card. Nothing here is a sheet setting.
 */
export function BandPanel(props: BandPanelProps) {
  const { card, cellHeightMm } = props

  if (card === null) {
    return (
      <p className="px-3 py-2 text-[11px] text-zinc-500">
        Click a card to tune its top and bottom heights.
      </p>
    )
  }

  const bands = card.bands
  const pictureMm = Math.max(0, cellHeightMm - bands.headerMm - bands.footerMm)
  // Two boxes plus a legible photo; beyond that the sliders would do nothing useful.
  const ceiling = Math.max(BAND_MIN_MM, cellHeightMm - PICTURE_MIN_MM)

  const set = (change: Partial<CardBands>): void =>
    props.onChange(clampBands({ ...bands, ...change }, cellHeightMm))

  return (
    <div className="flex flex-col gap-2 px-3 py-2" data-testid="band-panel">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
          Card {props.cellIndex + 1}
        </span>
        <span className="tabular text-[11px] text-zinc-500">picture {pictureMm.toFixed(1)} mm</span>
      </div>

      <ZoneBar bands={bands} cellHeightMm={cellHeightMm} />

      <label className="flex items-center gap-2">
        <span className="w-10 shrink-0 text-[11px] text-zinc-400">top</span>
        <input
          type="range"
          aria-label="Header height"
          min={BAND_MIN_MM}
          max={ceiling}
          step={STEP_MM}
          value={bands.headerMm}
          onChange={(event) => set({ headerMm: Number(event.target.value) })}
          className="h-4 min-w-0 flex-1 accent-sky-500"
        />
        <span className="tabular w-12 shrink-0 text-right text-[11px] text-zinc-300">
          {bands.headerMm.toFixed(1)} mm
        </span>
      </label>

      <label className="flex items-center gap-2">
        <span className="w-10 shrink-0 text-[11px] text-zinc-400">bottom</span>
        <input
          type="range"
          aria-label="Footer height"
          min={BAND_MIN_MM}
          max={ceiling}
          step={STEP_MM}
          value={bands.footerMm}
          onChange={(event) => set({ footerMm: Number(event.target.value) })}
          className="h-4 min-w-0 flex-1 accent-sky-500"
        />
        <span className="tabular w-12 shrink-0 text-right text-[11px] text-zinc-300">
          {bands.footerMm.toFixed(1)} mm
        </span>
      </label>

      <button
        type="button"
        data-target="dense"
        onClick={() => props.onChange(clampBands(defaultBands(cellHeightMm), cellHeightMm))}
        className="h-8 min-h-8 self-start rounded border border-zinc-700 px-2 text-[11px] text-zinc-300 transition-colors duration-150 ease-out hover:bg-zinc-800 hover:text-zinc-100 focus-visible:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-red-500"
      >
        Reset to default
      </button>
    </div>
  )
}

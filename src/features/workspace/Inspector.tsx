import { Download, FileArchive, Files } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Select } from '../../components/ui/Select'
import { Toggle } from '../../components/ui/Toggle'
import { DEFAULT_PAGE_SETTINGS, TRIM_PRESETS } from '../../types/settings'
import type { PageSettings } from '../../types/settings'
import { computePageGeometry } from '../../lib/trim'

export interface InspectorProps {
  readonly settings: PageSettings
  readonly onSettingsChange: (settings: PageSettings) => void
  readonly includeBleed: boolean
  readonly onIncludeBleedChange: (value: boolean) => void
  readonly drawMarks: boolean
  readonly onDrawMarksChange: (value: boolean) => void
  readonly hasBatch: boolean
  readonly onExport: () => void
  readonly sheetPanel?: React.ReactNode | undefined
}

const trimOptions = TRIM_PRESETS.map((preset) => ({ value: preset.id, label: preset.label }))

/** Right pane: page setup plus the three export routes. */
export function Inspector({
  settings,
  onSettingsChange,
  includeBleed,
  onIncludeBleedChange,
  drawMarks,
  onDrawMarksChange,
  hasBatch,
  onExport,
  sheetPanel,
}: InspectorProps) {
  const geometry = computePageGeometry(settings)
  const activePreset =
    TRIM_PRESETS.find(
      (preset) =>
        preset.widthMm === settings.trimWidthMm && preset.heightMm === settings.trimHeightMm,
    )?.id ?? 'custom'

  return (
    <aside className="hidden w-[320px] shrink-0 flex-col overflow-y-auto border-l border-zinc-800 bg-zinc-950 xl:flex">
      {sheetPanel === undefined ? (
        <div className="border-b border-zinc-800 px-4 py-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Page setup
          </h2>
        </div>
      ) : (
        <>
          <div className="border-b border-zinc-800 px-4 py-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Sheet &amp; cells
            </h2>
          </div>
          {sheetPanel}
          <div className="border-b border-zinc-800 px-4 py-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Trim &amp; bleed
            </h2>
          </div>
        </>
      )}

      <div className="flex flex-col gap-4 border-b border-zinc-800 p-4">
        <Select
          label="Trim size"
          value={activePreset}
          onChange={(event) => {
            const preset = TRIM_PRESETS.find((item) => item.id === event.target.value)
            if (preset === undefined) return
            onSettingsChange({
              ...DEFAULT_PAGE_SETTINGS,
              ...settings,
              trimWidthMm: preset.widthMm,
              trimHeightMm: preset.heightMm,
            })
          }}
          options={[...trimOptions, { value: 'custom', label: 'Custom' }]}
        />
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-2.5">
            <p className="text-[11px] text-zinc-400">Media</p>
            <p className="tabular text-sm font-medium text-zinc-50">
              {geometry.mediaWidthMm.toFixed(1)} × {geometry.mediaHeightMm.toFixed(1)}
            </p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-2.5">
            <p className="text-[11px] text-zinc-400">Bleed</p>
            <p className="tabular text-sm font-medium text-zinc-50">{geometry.bleedMm} mm</p>
          </div>
        </div>
        {geometry.marksFit ? null : (
          <div className="flex items-start gap-2 rounded-lg border border-amber-800 bg-amber-950/50 p-2.5">
            <Badge variant="warning">Marks</Badge>
            <p className="text-xs text-amber-200">
              Crop marks need at least 4 mm of margin outside the bleed.
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 border-b border-zinc-800 p-4">
        <Toggle
          label="Include bleed"
          description="Extends the page edge by the bleed amount."
          checked={includeBleed}
          onChange={onIncludeBleedChange}
          disabled={geometry.bleedMm === 0}
        />
        <Toggle
          label="Draw trim marks"
          description="Adds crop marks outside the bleed area."
          checked={drawMarks}
          onChange={onDrawMarksChange}
          disabled={!geometry.marksFit}
        />
      </div>

      <div className="flex flex-col gap-2 p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Export</h2>
        <Button variant="primary" fullWidth disabled={!hasBatch} onClick={onExport}>
          <Download aria-hidden="true" strokeWidth={2} className="size-4" />
          Export current PDF
        </Button>
        <Button variant="secondary" fullWidth disabled={!hasBatch} onClick={onExport}>
          <FileArchive aria-hidden="true" strokeWidth={2} className="size-4" />
          Export all as .zip
        </Button>
        <Button variant="secondary" fullWidth disabled={!hasBatch} onClick={onExport}>
          <Files aria-hidden="true" strokeWidth={2} className="size-4" />
          Export merged PDF
        </Button>
        <p className="pt-1 text-[11px] leading-relaxed text-zinc-500">
          Vector export with embedded fonts lands in Phase 4. Images keep their native
          resolution; they are not converted to CMYK.
        </p>
      </div>
    </aside>
  )
}

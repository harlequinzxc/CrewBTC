import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Toggle } from '../../components/ui/Toggle'
import { Button } from '../../components/ui/Button'
import { SHEET_PRESETS } from '../../types/imposition'
import type { SheetSettings as SheetSettingsValue } from '../../types/imposition'
import type { GridLayout } from '../../types/imposition'

export interface SheetSettingsProps {
  readonly settings: SheetSettingsValue
  readonly grid: GridLayout
  readonly errors: Readonly<Record<string, string>>
  readonly onChange: (patch: Partial<SheetSettingsValue>) => void
  readonly onReset: () => void
  readonly showCutMarks: boolean
  readonly onShowCutMarksChange: (value: boolean) => void
}

const presetOptions = SHEET_PRESETS.map((preset) => ({ value: preset.id, label: preset.label }))

/** Sheet + cell geometry controls. Every number is millimetres. */
export function SheetSettings({
  settings,
  grid,
  errors,
  onChange,
  onReset,
  showCutMarks,
  onShowCutMarksChange,
}: SheetSettingsProps) {
  const activePreset =
    SHEET_PRESETS.find(
      (preset) =>
        Math.abs(preset.widthMm - settings.sheetWidthMm) < 0.5 &&
        Math.abs(preset.heightMm - settings.sheetHeightMm) < 0.5,
    )?.id ?? 'custom'

  const number = (
    key:
      | 'sheetWidthMm'
      | 'sheetHeightMm'
      | 'cellWidthMm'
      | 'cellHeightMm'
      | 'gutterMm'
      | 'marginMm'
      | 'headerMm'
      | 'footerMm',
    label: string,
    suffix = 'mm',
  ): React.ReactNode => (
    <Input
      key={key}
      label={label}
      type="number"
      inputMode="decimal"
      suffix={suffix}
      value={String(settings[key])}
      error={errors[key]}
      onChange={(event) => {
        const next = Number(event.target.value)
        onChange({ [key]: Number.isFinite(next) ? next : 0 })
      }}
    />
  )

  return (
    <div className="flex flex-col gap-4 border-b border-zinc-800 p-4">
      <Select
        label="Sheet"
        value={activePreset}
        onChange={(event) => {
          const preset = SHEET_PRESETS.find((item) => item.id === event.target.value)
          if (preset === undefined) return
          onChange({ sheetWidthMm: preset.widthMm, sheetHeightMm: preset.heightMm })
        }}
        options={[...presetOptions, { value: 'custom', label: 'Custom' }]}
      />

      <div className="grid grid-cols-2 gap-3">
        {number('cellWidthMm', 'Cell width')}
        {number('cellHeightMm', 'Cell height')}
        {number('gutterMm', 'Gutter')}
        {number('marginMm', 'Margin')}
      </div>

      <div>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          Card bands
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {number('headerMm', 'Header')}
          {number('footerMm', 'Footer')}
        </div>
        <p className="tabular mt-2 text-[11px] text-zinc-500">
          Picture gets{' '}
          {Math.max(0, settings.cellHeightMm - settings.headerMm - settings.footerMm).toFixed(1)} mm
          of {settings.cellHeightMm} mm — the three bands always fill the card.
        </p>
        {errors.footerMm === undefined ? null : (
          <p className="mt-1 text-[11px] text-red-300">{errors.footerMm}</p>
        )}
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-2.5">
        <p className="text-[11px] text-zinc-400">Result</p>
        <p className="tabular text-sm font-medium text-zinc-50">
          {grid.columns} × {grid.rows} = {grid.cellCount} per sheet
        </p>
        <p className="tabular mt-0.5 text-[11px] text-zinc-500">
          {grid.utilisationPercent}% of paper used
          {grid.slackRightMm > 0 ? ` · ${grid.slackRightMm} mm slack on the right` : ''}
        </p>
      </div>

      <Toggle
        label="Rotate cells 90°"
        description="Swaps cell width and height on the sheet."
        checked={settings.rotateCells}
        onChange={(checked) => onChange({ rotateCells: checked })}
      />

      <Toggle
        label="Show cut guides"
        description="Marks the centre of each gutter for scissor lines."
        checked={showCutMarks}
        onChange={onShowCutMarksChange}
      />

      <Button size="sm" variant="ghost" onClick={onReset}>
        Reset to A4 defaults
      </Button>
    </div>
  )
}

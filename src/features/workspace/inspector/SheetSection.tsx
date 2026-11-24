import { DEFAULT_TEXT_SCALE } from '../../../types/card-typography'
import { NumberField } from '../../../components/ui/NumberField'
import { MIN_TEXT_SCALE, MAX_TEXT_SCALE, clampTextScale } from '../../../types/card'
import { ResetButton } from '../../../components/ui/ResetButton'
import { Select } from './fields'
import { Section } from './Section'
import { Switch } from './Switch'
import { SHEET_PRESETS } from '../../../types/imposition'
import type { GridLayout, SheetSettings as SheetSettingsValue } from '../../../types/imposition'
import type { UnitSystem } from '../../../lib/units'

export interface SheetSectionProps {
  readonly sheet: SheetSettingsValue
  readonly grid: GridLayout
  readonly errors: Readonly<Record<string, string>>
  readonly onChange: (patch: Partial<SheetSettingsValue>) => void
  readonly onReset: () => void
  readonly units: UnitSystem
  readonly showCutMarks: boolean
  readonly onShowCutMarksChange: (value: boolean) => void
}

export function SheetSection(props: SheetSectionProps) {
  const { sheet, errors, onChange, units } = props
  const activePreset = SHEET_PRESETS.find((preset) => Math.abs(preset.widthMm - sheet.sheetWidthMm) < 0.5 && Math.abs(preset.heightMm - sheet.sheetHeightMm) < 0.5)?.id ?? 'custom'
  const fields = [
    { label: 'Sheet width', key: 'sheetWidthMm', value: sheet.sheetWidthMm },
    { label: 'Sheet height', key: 'sheetHeightMm', value: sheet.sheetHeightMm },
    { label: 'Cell width', key: 'cellWidthMm', value: sheet.cellWidthMm },
    { label: 'Cell height', key: 'cellHeightMm', value: sheet.cellHeightMm },
    { label: 'Spacing', key: 'gutterMm', value: sheet.gutterMm },
    { label: 'Margin', key: 'marginMm', value: sheet.marginMm },
  ] as const
  return <Section title="Sheet & print" collapsible initiallyOpen={false} action={<ResetButton label="Reset sheet settings" onClick={props.onReset} />}>
    <div className="mb-2 flex items-center justify-between gap-2 text-[11px] text-ink-secondary">
      <span>Preset</span>
      <Select label="Sheet preset" value={activePreset} options={[...SHEET_PRESETS.map((preset) => ({ value: preset.id, label: preset.label })), { value: 'custom', label: 'Custom' }]} onChange={(id) => { const preset = SHEET_PRESETS.find((item) => item.id === id); if (preset !== undefined) onChange({ sheetWidthMm: preset.widthMm, sheetHeightMm: preset.heightMm }) }} />
    </div>
    <div className="grid grid-cols-2 gap-x-2 gap-y-2">
      {fields.map((field) => <NumberField key={field.key} label={field.label} labelAbove name={field.label} valueMm={field.value} units={units} min={0} onChangeMm={(value) => onChange({ [field.key]: value })} className={errors[field.key] === undefined ? 'w-full' : 'w-full border-accent'} />)}
      <NumberField label="Text size" labelAbove name="All text size" suffix="%" value={Math.round((sheet.textScale ?? DEFAULT_TEXT_SCALE) * 100)} min={MIN_TEXT_SCALE * 100} max={MAX_TEXT_SCALE * 100} step={5} onChange={(value) => onChange({ textScale: clampTextScale(value / 100) })} className="w-full" />
    </div>
    <div className="mt-2 flex flex-col gap-1 text-[11px] text-ink-secondary">
      <div className="flex items-center justify-between"><span>Rotate 90°</span><Switch label="Rotate cells 90°" checked={sheet.rotateCells} onChange={(rotateCells) => onChange({ rotateCells })} /></div>
      <div className="flex items-center justify-between"><span>Cut guides</span><Switch label="Show cut guides" checked={props.showCutMarks} onChange={props.onShowCutMarksChange} /></div>
    </div>
    <p className="tabular mt-2 flex items-center justify-between text-[10px] text-ink-muted"><span>{props.grid.columns} × {props.grid.rows} · {props.grid.cellCount} cells</span><span>{props.grid.utilisationPercent}% coverage</span></p>
  </Section>
}

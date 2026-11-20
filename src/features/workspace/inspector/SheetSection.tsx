import { NumberField } from '../../../components/ui/NumberField'
import { MIN_TEXT_SCALE, MAX_TEXT_SCALE, clampTextScale } from '../../../types/card'
import { ResetButton } from '../../../components/ui/ResetButton'
import { Row } from './Row'
import { Select, SizeField, SizePair } from './fields'
import { Section } from './Section'
import { Switch } from './Switch'
import { SHEET_PRESETS } from '../../../types/imposition'
import type { GridLayout, SheetSettings as SheetSettingsValue } from '../../../types/imposition'
import type { UnitSystem } from '../../../lib/units'

/**
 * The sheet and the cells — the document's own properties.
 *
 * Always the second section, and the first one only when nothing is selected. Rows are
 * label-left / control-right at 24px, so the whole grid setup fits without scrolling.
 *
 * Every length here is stored in millimetres and shown in whatever unit the document is
 * set to, so switching to centimetres converts this panel and Settings together.
 *
 * There is no trim, bleed or trim-mark row. Those controls were here and did not reach
 * the exporter; the sheet's own size is what the page is built from, and that is the
 * Preset and Size rows below.
 */
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
  const { sheet, errors, onChange } = props
  const activePreset =
    SHEET_PRESETS.find(
      (preset) =>
        Math.abs(preset.widthMm - sheet.sheetWidthMm) < 0.5 &&
        Math.abs(preset.heightMm - sheet.sheetHeightMm) < 0.5,
    )?.id ?? 'custom'

  return (
    <Section
      title="Sheet & print"
      action={<ResetButton label="Reset sheet settings" onClick={props.onReset} />}
    >
      <div className="flex flex-col gap-1">
        <Row label="Preset">
          <Select
            label="Sheet preset"
            value={activePreset}
            options={[
              ...SHEET_PRESETS.map((preset) => ({ value: preset.id, label: preset.label })),
              { value: 'custom', label: 'Custom' },
            ]}
            onChange={(id) => {
              const preset = SHEET_PRESETS.find((item) => item.id === id)
              if (preset === undefined) return
              onChange({ sheetWidthMm: preset.widthMm, sheetHeightMm: preset.heightMm })
            }}
          />
        </Row>

        <Row label="Size">
          <SizePair
            first={{ name: 'Sheet width', valueMm: sheet.sheetWidthMm, units: props.units, error: errors.sheetWidthMm, onChangeMm: (sheetWidthMm) => onChange({ sheetWidthMm }) }}
            second={{ name: 'Sheet height', valueMm: sheet.sheetHeightMm, units: props.units, error: errors.sheetHeightMm, onChangeMm: (sheetHeightMm) => onChange({ sheetHeightMm }) }}
          />
        </Row>

        <Row label="Cell">
          <SizePair
            first={{ name: 'Cell width', valueMm: sheet.cellWidthMm, units: props.units, error: errors.cellWidthMm, onChangeMm: (cellWidthMm) => onChange({ cellWidthMm }) }}
            second={{ name: 'Cell height', valueMm: sheet.cellHeightMm, units: props.units, error: errors.cellHeightMm, onChangeMm: (cellHeightMm) => onChange({ cellHeightMm }) }}
          />
        </Row>

        {/* "Spacing", not "gutter": it is the space between cards, measured like every
            other length on this sheet. The model keeps `gutterMm` because that is the
            imposition's own word for it. */}
        <Row label="Spacing">
          <SizeField
            name="Spacing"
            valueMm={sheet.gutterMm}
            units={props.units}
            error={errors.gutterMm}
            onChangeMm={(gutterMm) => onChange({ gutterMm })}
          />
        </Row>

        <Row label="Margin">
          <SizeField
            name="Margin"
            valueMm={sheet.marginMm}
            units={props.units}
            error={errors.marginMm}
            onChangeMm={(marginMm) => onChange({ marginMm })}
          />
        </Row>

        <Row label="Text size">
          <NumberField label="" name="All text size" suffix="%" value={Math.round((sheet.textScale ?? 1) * 100)} min={MIN_TEXT_SCALE * 100} max={MAX_TEXT_SCALE * 100} step={5} onChange={(value) => onChange({ textScale: clampTextScale(value / 100) })} />
        </Row>

        <Row label="Rotate 90°">
          <Switch
            label="Rotate cells 90°"
            checked={sheet.rotateCells}
            onChange={(rotateCells) => onChange({ rotateCells })}
          />
        </Row>

        <Row label="Cut guides">
          <Switch
            label="Show cut guides"
            checked={props.showCutMarks}
            onChange={props.onShowCutMarksChange}
          />
        </Row>
      </div>

      {/* The grid's arithmetic is the one number worth showing: it is the difference
          between twelve cards and eight, and it is not otherwise visible anywhere. */}
      <p className="tabular mt-2 flex items-center justify-between text-[10px] text-ink-muted">
        <span>
          {props.grid.columns} × {props.grid.rows} · {props.grid.cellCount} cells
        </span>
        <span>{props.grid.utilisationPercent}% coverage</span>
      </p>
    </Section>
  )
}

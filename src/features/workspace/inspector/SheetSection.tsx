import { ResetButton } from '../../../components/ui/ResetButton'
import { Row } from './Row'
import { Select, SizeField, SizePair } from './fields'
import { Section } from './Section'
import { Switch } from './Switch'
import { SHEET_PRESETS } from '../../../types/imposition'
import { TRIM_PRESETS } from '../../../types/settings'
import type { GridLayout, SheetSettings as SheetSettingsValue } from '../../../types/imposition'
import type { PageSettings } from '../../../types/settings'

/**
 * The sheet, the cells, and the print marks — the document's own properties.
 *
 * Always the second section, and the first one only when nothing is selected. Rows are
 * label-left / control-right at 30px, so seven settings fit in the height the old panel
 * spent on two of them.
 */
export interface SheetSectionProps {
  readonly sheet: SheetSettingsValue
  readonly grid: GridLayout
  readonly errors: Readonly<Record<string, string>>
  readonly onChange: (patch: Partial<SheetSettingsValue>) => void
  readonly onReset: () => void
  readonly page: PageSettings
  readonly onPageChange: (settings: PageSettings) => void
  readonly showCutMarks: boolean
  readonly onShowCutMarksChange: (value: boolean) => void
  readonly includeBleed: boolean
  readonly onIncludeBleedChange: (value: boolean) => void
  readonly drawMarks: boolean
  readonly onDrawMarksChange: (value: boolean) => void
  readonly marksFit: boolean
  readonly bleedMm: number
}

export function SheetSection(props: SheetSectionProps) {
  const { sheet, errors, onChange } = props
  const activePreset =
    SHEET_PRESETS.find(
      (preset) =>
        Math.abs(preset.widthMm - sheet.sheetWidthMm) < 0.5 &&
        Math.abs(preset.heightMm - sheet.sheetHeightMm) < 0.5,
    )?.id ?? 'custom'

  // A trim size the marks cannot sit outside of turns them off rather than silently
  // drawing them over the artwork; the switch reflects that instead of lying.
  const marksAvailable = props.marksFit && props.bleedMm > 0

  return (
    <Section
      // "Sheet & print" only once there is print output to describe; a bare sheet is a
      // sheet, and the title should not promise settings that are not on screen.
      title={props.bleedMm > 0 || props.marksFit ? 'Sheet & print' : 'Sheet'}
      action={<ResetButton label="Reset sheet settings" onClick={props.onReset} />}
    >
      <div className="flex flex-col gap-1.5">
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
            first={{ name: 'Sheet width', value: sheet.sheetWidthMm, error: errors.sheetWidthMm, onChange: (sheetWidthMm) => onChange({ sheetWidthMm }) }}
            second={{ name: 'Sheet height', value: sheet.sheetHeightMm, error: errors.sheetHeightMm, onChange: (sheetHeightMm) => onChange({ sheetHeightMm }) }}
          />
        </Row>

        <Row label="Cell">
          <SizePair
            first={{ name: 'Cell width', value: sheet.cellWidthMm, error: errors.cellWidthMm, onChange: (cellWidthMm) => onChange({ cellWidthMm }) }}
            second={{ name: 'Cell height', value: sheet.cellHeightMm, error: errors.cellHeightMm, onChange: (cellHeightMm) => onChange({ cellHeightMm }) }}
          />
        </Row>

        <Row label="Gutter">
          <SizeField
            name="Gutter"
            value={sheet.gutterMm}
            error={errors.gutterMm}
            onChange={(gutterMm) => onChange({ gutterMm })}
          />
        </Row>

        <Row label="Margin">
          <SizeField
            name="Margin"
            value={sheet.marginMm}
            error={errors.marginMm}
            onChange={(marginMm) => onChange({ marginMm })}
          />
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

        <Row label="Bleed">
          <Switch
            label="Include bleed"
            checked={props.includeBleed}
            disabled={props.bleedMm === 0}
            onChange={props.onIncludeBleedChange}
          />
        </Row>

        <Row label="Trim marks">
          <Switch
            label="Draw trim marks"
            checked={props.drawMarks}
            disabled={!marksAvailable}
            onChange={props.onDrawMarksChange}
          />
        </Row>

        <Row label="Trim">
          <Select
            label="Trim size"
            value={
              TRIM_PRESETS.find(
                (preset) =>
                  preset.widthMm === props.page.trimWidthMm &&
                  preset.heightMm === props.page.trimHeightMm,
              )?.id ?? 'custom'
            }
            options={[
              ...TRIM_PRESETS.map((preset) => ({ value: preset.id, label: preset.label })),
              { value: 'custom', label: 'Custom' },
            ]}
            onChange={(id) => {
              const preset = TRIM_PRESETS.find((item) => item.id === id)
              if (preset === undefined) return
              props.onPageChange({
                ...props.page,
                trimWidthMm: preset.widthMm,
                trimHeightMm: preset.heightMm,
              })
            }}
          />
        </Row>
      </div>

      {/* The grid's arithmetic is the one number worth showing: it is the difference
          between twelve cards and eight, and it is not otherwise visible anywhere. */}
      <p className="tabular mt-2.5 flex items-center justify-between text-[10px] text-ink-muted">
        <span>
          {props.grid.columns} × {props.grid.rows} · {props.grid.cellCount} cells
        </span>
        <span>{props.grid.utilisationPercent}% coverage</span>
      </p>
    </Section>
  )
}


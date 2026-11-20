import { CardSection } from './inspector/CardSection'
import { SheetSection } from './inspector/SheetSection'
import type { Card, CardBands } from '../../types/card'
import type { GridLayout, SheetSettings as SheetSettingsValue } from '../../types/imposition'
import type { UnitSystem } from '../../lib/units'

/**
 * The right rail: whatever is selected, nothing more.
 *
 * Figma's inspector shows the properties of the selection. When something is selected it
 * leads with that thing; when nothing is, it shows the document. So this pane is a fixed
 * 260px column that swaps its top section rather than stacking every control the app has
 * into one scrolling form — which is what produced the four-column, always-full screen it
 * replaces.
 *
 * Nothing here explains itself. Labels do the work.
 */
export interface InspectorProps {
  /** The selected card, or null when the sheet itself is the selection. */
  readonly card: Card | null
  readonly cellIndex: number | null
  readonly cellHeightMm: number
  /** The document's display unit. Every length in this pane is converted with it. */
  readonly units: UnitSystem
  readonly onBandsChange: (bands: CardBands) => void
  readonly onTextScaleChange: (scale: number) => void
  readonly onResetCard: () => void

  readonly showCutMarks: boolean
  readonly onShowCutMarksChange: (value: boolean) => void
  readonly sheet: SheetSettingsValue
  readonly grid: GridLayout
  readonly sheetErrors: Readonly<Record<string, string>>
  readonly onSheetChange: (patch: Partial<SheetSettingsValue>) => void
  readonly onResetSheet: () => void
}

export function Inspector(props: InspectorProps) {
  return (
    <aside
      aria-label="Inspector"
      className="hidden w-[260px] shrink-0 flex-col overflow-y-auto border-l border-hairline bg-surface-panel lg:flex"
    >
      {props.card !== null && props.cellIndex !== null ? (
        <CardSection
          card={props.card}
          cellIndex={props.cellIndex}
          cellHeightMm={props.cellHeightMm}
          units={props.units}
          onBandsChange={props.onBandsChange}
          onTextScaleChange={props.onTextScaleChange}
          onReset={props.onResetCard}
        />
      ) : null}

      <SheetSection
        sheet={props.sheet}
        grid={props.grid}
        errors={props.sheetErrors}
        onChange={props.onSheetChange}
        onReset={props.onResetSheet}
        units={props.units}
        showCutMarks={props.showCutMarks}
        onShowCutMarksChange={props.onShowCutMarksChange}
      />
    </aside>
  )
}

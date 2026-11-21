import { cn } from '../../lib/cn'
import { CardReadout } from './inspector/CardReadout'
import { SheetSection } from './inspector/SheetSection'
import { AutoFormatSection } from './inspector/AutoFormatSection'
import type { Keywords } from '../../types/format-keywords'
import type { Card } from '../../types/card'
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
  /** The document's display unit. Every length in this pane is converted with it. */
  readonly units: UnitSystem

  readonly showCutMarks: boolean
  readonly onShowCutMarksChange: (value: boolean) => void
  readonly sheet: SheetSettingsValue
  readonly grid: GridLayout
  readonly sheetErrors: Readonly<Record<string, string>>
  readonly onSheetChange: (patch: Partial<SheetSettingsValue>) => void
  readonly onResetSheet: () => void
  /**
   * Whether the rail is showing.
   *
   * Hiding returns the 260px to the sheet, which is what the collapse button beside the
   * gear is for. Below `lg` the rail is not rendered at all, so this only decides the
   * width at which it *would* be — the breakpoint still wins, because the breakpoint is
   * a property of the window and the toggle is a property of the session.
   */
  readonly open: boolean
  readonly keywords: Keywords
  readonly onKeywordsChange: (value: Keywords) => void
  readonly onAutomate: () => void
  readonly canAutomate: boolean
  readonly busy: boolean
}

export function Inspector(props: InspectorProps) {
  return (
    <aside
      aria-label="Inspector"
      hidden={!props.open}
      className={cn(
        // `hidden` at the base width is not a duplicate of the `hidden` attribute: below
        // `lg` the rail is not part of the layout at all, open or closed. Without it the
        // 260px column would render as a block under 1024px and squeeze the canvas.
        'hidden w-[260px] shrink-0 flex-col overflow-y-auto border-l border-hairline bg-surface-panel',
        props.open ? 'lg:flex' : undefined,
      )}
    >
      {props.card !== null && props.cellIndex !== null ? <CardReadout card={props.card} cellIndex={props.cellIndex} units={props.units} /> : null}
      <AutoFormatSection keywords={props.keywords} onChange={props.onKeywordsChange} onApply={props.onAutomate} available={props.canAutomate} busy={props.busy} />
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

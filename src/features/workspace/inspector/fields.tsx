import { NumberField } from '../../../components/ui/NumberField'
import { cn } from '../../../lib/cn'
import type { UnitSystem } from '../../../lib/units'

/** A very small select: the preset pickers are two words wide, never a form field. */
export function Select(props: {
  readonly label: string
  readonly value: string
  readonly options: readonly { readonly value: string; readonly label: string }[]
  readonly onChange: (value: string) => void
}) {
  return (
    <select
      aria-label={props.label}
      value={props.value}
      onChange={(event) => props.onChange(event.target.value)}
      className={cn(
        'h-7 min-h-7 max-w-[120px] truncate rounded border border-hairline-strong bg-surface-raised px-1.5',
        'text-[11px] text-ink-primary',
        'focus-visible:border-accent focus-visible:outline-none',
      )}
    >
      {props.options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}

/**
 * One figure in the sheet's units, right-aligned, with the unit inside the box.
 *
 * The width matters: a `w-full` field in a `justify-between` row stretched to the whole
 * remaining rail, so 4 mm read as `4 mm` floating at the far right of an empty 150px box,
 * with the unit a gap away from the number. The `SizePair` above it is two boxes of half
 * that width, so one field is sized to the same proportion and the column reads as one
 * ladder rather than two different kinds of row.
 */
export function SizeField(props: FieldProps) {
  return (
    <NumberField
      label=""
      name={props.name}
      valueMm={props.valueMm}
      units={props.units}
      min={0}
      onChangeMm={props.onChangeMm}
      className={cn('w-[118px]', props.error === undefined ? undefined : 'border-accent')}
    />
  )
}

export interface FieldProps {
  readonly name: string
  /** Stored millimetres. Display units come from `units`. */
  readonly valueMm: number
  readonly units: UnitSystem
  readonly error: string | undefined
  readonly onChangeMm: (valueMm: number) => void
}

/**
 * `W × H` as a pair. The visible glyphs are a letter and an × rather than the words
 * "width" and "height", which is the only way two of these fit in 260px; each field is
 * still named in full for anyone reading it aloud.
 */
export function SizePair(props: { readonly first: FieldProps; readonly second: FieldProps }) {
  return (
    <div className="flex items-center gap-1">
      <NumberField
        label="W"
        name={props.first.name}
        valueMm={props.first.valueMm}
        units={props.first.units}
        min={0}
        onChangeMm={props.first.onChangeMm}
        className={cn('w-full', props.first.error === undefined ? undefined : 'border-accent')}
      />
      <span aria-hidden className="text-[10px] text-ink-muted">
        ×
      </span>
      <NumberField
        label="H"
        name={props.second.name}
        valueMm={props.second.valueMm}
        units={props.second.units}
        min={0}
        onChangeMm={props.second.onChangeMm}
        className={cn('w-full', props.second.error === undefined ? undefined : 'border-accent')}
      />
    </div>
  )
}

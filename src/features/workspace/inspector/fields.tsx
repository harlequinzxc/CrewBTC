import { NumberField } from '../../../components/ui/NumberField'
import { cn } from '../../../lib/cn'

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
        'h-6 min-h-6 max-w-[120px] truncate rounded border border-hairline-strong bg-surface-raised px-1.5',
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

/** One millimetre figure, right-aligned, with the unit inside the box. */
export function SizeField(props: FieldProps) {
  return (
    <NumberField
      label=""
      name={props.name}
      suffix="mm"
      value={props.value}
      min={0}
      step={0.5}
      onChange={props.onChange}
      className={cn('w-full', props.error === undefined ? undefined : 'border-accent')}
    />
  )
}

export interface FieldProps {
  readonly name: string
  readonly value: number
  readonly error: string | undefined
  readonly onChange: (value: number) => void
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
        suffix="mm"
        value={props.first.value}
        min={0}
        step={0.5}
        onChange={props.first.onChange}
        className={cn('w-full', props.first.error === undefined ? undefined : 'border-accent')}
      />
      <span aria-hidden className="text-[10px] text-ink-muted">
        ×
      </span>
      <NumberField
        label="H"
        name={props.second.name}
        suffix="mm"
        value={props.second.value}
        min={0}
        step={0.5}
        onChange={props.second.onChange}
        className={cn('w-full', props.second.error === undefined ? undefined : 'border-accent')}
      />
    </div>
  )
}

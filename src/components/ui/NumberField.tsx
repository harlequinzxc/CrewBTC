import { useEffect, useId, useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import { UNITS, fromMm, toMm } from '../../lib/units'
import type { UnitSystem } from '../../lib/units'

/**
 * A compact numeric field with a unit, meant to sit in a row of three.
 *
 * Not the full-width form `<Input>`: this is inspector furniture, so it has no label above
 * it (the label is the row's own), no hint paragraph, and it is 24px tall against the
 * 44px form ladder. It still edits a real number rather than a slider, because typing
 * `27.5` is faster and more exact than dragging to find it.
 *
 * Two forms, and the difference is the point:
 * - `valueMm` makes the field *unit-aware*. Storage is millimetres; `units` decides how
 *   those millimetres read and what a typed number means. Switching units re-renders the
 *   field with a converted value and a different suffix, and never touches the model, so
 *   nothing drifts.
 * - `value` is a plain number for things that are not lengths — a text scale in percent.
 *
 * It is a field, not a readout, and it has to say so: the surface is `surface-raised`
 * (#1A1C22, a step above the panel it sits on) behind a real 1px border at rest, and the
 * border answers the pointer and the keyboard.
 *
 * Two behaviours that make it usable rather than merely small:
 * - typing is local state, so a half-typed `2.` or a cleared field does not round-trip
 *   through the model and fight the caret;
 * - `↑`/`↓` step by the unit's own step, and `Shift` steps ten times as far. The step is
 *   chosen per unit so a tap in centimetres moves 1 mm and a tap in inches moves about
 *   1.3 mm, rather than 0.5 mm five times over.
 */
export interface NumberFieldProps {
  /** Visible label inside the field, e.g. `Top`. Omit for an unlabelled box in a pair. */
  readonly label: string
  /** Full accessible name when `label` is a visual abbreviation or absent. */
  readonly name?: string | undefined
  /** The value in millimetres. Mutually exclusive with `value`. */
  readonly valueMm?: number | undefined
  /** A value already in display units. Mutually exclusive with `valueMm`. */
  readonly value?: number | undefined
  /** Which unit `valueMm` is displayed in. Required when `valueMm` is used. */
  readonly units?: UnitSystem | undefined
  /** Called with the new value in millimetres when `valueMm` was used. */
  readonly onChangeMm?: ((valueMm: number) => void) | undefined
  /** Called with the new value in display units. */
  readonly onChange?: ((value: number) => void) | undefined
  /** Printed after the number. Defaults to the unit's own suffix. */
  readonly suffix?: string | undefined
  /** Step in display units, for plain-number fields. Unit-aware fields use the unit's own. */
  readonly step?: number | undefined
  /** Lower bound. Millimetres when `valueMm` is used, display units otherwise. */
  readonly min?: number | undefined
  /** Upper bound. Millimetres when `valueMm` is used, display units otherwise. */
  readonly max?: number | undefined
  readonly disabled?: boolean | undefined
  readonly className?: string | undefined
}

export function NumberField(props: NumberFieldProps) {
  const { label, suffix, min, max, disabled, className, units = 'mm' } = props
  const spec = UNITS[units]
  const name = props.name ?? label
  const id = useId()

  const inMm = props.valueMm !== undefined
  const display = inMm ? fromMm(props.valueMm ?? 0, units) : (props.value ?? 0)
  // A length steps by its own unit: 0.1 cm is a millimetre, so a tap in centimetres is a
  // whole millimetre rather than a fifth of one. Plain numbers keep their given step.
  const step = inMm ? spec.step : (props.step ?? 0.5)
  // Bounds are millimetres too, so `BAND_MIN_MM` means the same thing in every unit.
  const minShown = inMm && min !== undefined ? fromMm(min, units) : min
  const maxShown = inMm && max !== undefined ? fromMm(max, units) : max

  const [draft, setDraft] = useState(() => format(display))
  const editing = useRef(false)
  // Units can change under a field that is not being typed into; the draft must follow
  // the new unit as well as the new number, or a `21` in millimetres becomes a `21` in
  // centimetres the moment it is focused.
  const shownUnit = useRef(units)

  // The model is the source of truth whenever the field is not being typed into.
  useEffect(() => {
    if (!editing.current || shownUnit.current !== units) {
      shownUnit.current = units
      setDraft(format(display))
    }
  }, [display, units])

  const emit = (next: number): void => {
    const bounded = Math.min(
      maxShown ?? Number.POSITIVE_INFINITY,
      Math.max(minShown ?? Number.NEGATIVE_INFINITY, next),
    )
    if (inMm) props.onChangeMm?.(toMm(bounded, units))
    else props.onChange?.(bounded)
  }

  const commit = (raw: string): void => {
    const next = Number(raw)
    if (raw.trim() === '' || !Number.isFinite(next)) return
    emit(next)
  }

  const nudge = (direction: 1 | -1, by: number): void => {
    const next = round(display + direction * by, spec.decimals)
    emit(next)
    setDraft(format(next))
  }

  return (
    <div
      className={cn(
        // No vertical padding and a 24px box: the number and its suffix are the whole
        // content, so anything else is a void inside a field.
        'flex h-6 min-h-6 items-center gap-1 rounded-md border bg-surface-raised px-1.5',
        'border-hairline-strong',
        'transition-colors duration-150 ease-out',
        'hover:border-ink-muted focus-within:border-accent',
        disabled === true && 'opacity-50',
        className,
      )}
    >
      {label === '' ? null : (
        <span aria-hidden="true" className="shrink-0 text-[10px] text-ink-secondary">
          {label}
        </span>
      )}
      <input
        id={id}
        type="number"
        inputMode="decimal"
        data-density="compact"
        aria-label={name}
        disabled={disabled === true}
        value={draft}
        step={step}
        onFocus={() => {
          editing.current = true
        }}
        onBlur={() => {
          editing.current = false
          setDraft(format(display))
        }}
        onChange={(event) => {
          setDraft(event.target.value)
          commit(event.target.value)
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowUp') {
            event.preventDefault()
            nudge(1, event.shiftKey ? step * 10 : step)
          }
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            nudge(-1, event.shiftKey ? step * 10 : step)
          }
        }}
        className={cn(
          'tabular h-5 w-full min-w-0 border-0 bg-transparent p-0 text-right text-[12px] leading-none text-ink-primary',
          'focus-visible:shadow-none focus-visible:outline-none',
        )}
      />
      <UnitLabel text={suffix ?? (inMm ? spec.suffix : '')} />
    </div>
  )
}

/** The unit inside the box: one line, no baseline drift against the number beside it. */
function UnitLabel({ text }: { readonly text: string }) {
  if (text === '') return null
  return (
    <span aria-hidden="true" className="shrink-0 text-[10px] leading-none text-ink-muted">
      {text}
    </span>
  )
}

/**
 * What the field shows when it is not being typed into.
 *
 * Milestones are rendered at the unit's own precision and then have their trailing zeros
 * removed: `210` mm reads `210`, `21` cm reads `21`, and `25.4` mm reads `1` in inches
 * rather than `1.000`. A field padded to a fixed number of decimals looks like a
 * spreadsheet and makes three short numbers scan as one long one.
 */
const format = (value: number): string => {
  if (!Number.isFinite(value)) return ''
  const rounded = Math.round(value * 1000) / 1000
  return Number.isInteger(rounded) ? String(rounded) : String(Number.parseFloat(rounded.toFixed(3)))
}

const round = (value: number, decimals: number): number => {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

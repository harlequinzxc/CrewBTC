import { useEffect, useId, useRef, useState } from 'react'
import { cn } from '../../lib/cn'

/**
 * A compact numeric field with a unit, meant to sit in a row of three.
 *
 * Not the full-width form `<Input>`: this is inspector furniture, so it has no label above
 * it (the label is the row's own), no hint paragraph, and it is 28px tall against the
 * 44px form ladder. It still edits a real number rather than a slider, because typing
 * `27.5` is faster and more exact than dragging to find it.
 *
 * Two behaviours that make it usable rather than merely small:
 * - typing is local state, so a half-typed `2.` or a cleared field does not round-trip
 *   through the model and fight the caret;
 * - `↑`/`↓` step by `step`, and `Shift` steps ten times as far.
 */
export interface NumberFieldProps {
  /** Visible label inside the field, e.g. `Top`. Omit for an unlabelled box in a pair. */
  readonly label: string
  /** Full accessible name when `label` is a visual abbreviation or absent. */
  readonly name?: string | undefined
  readonly value: number
  readonly onChange: (value: number) => void
  readonly suffix?: string | undefined
  readonly step?: number | undefined
  readonly min?: number | undefined
  readonly max?: number | undefined
  readonly disabled?: boolean | undefined
  readonly className?: string | undefined
}

export function NumberField(props: NumberFieldProps) {
  const { label, value, onChange, suffix, step = 0.5, min, max, disabled, className } = props
  const name = props.name ?? label
  const id = useId()
  const [draft, setDraft] = useState(String(value))
  const editing = useRef(false)

  // The model is the source of truth whenever the field is not being typed into.
  useEffect(() => {
    if (!editing.current) setDraft(format(value))
  }, [value])

  const commit = (raw: string): void => {
    const next = Number(raw)
    if (raw.trim() === '' || !Number.isFinite(next)) return
    const bounded = Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min ?? Number.NEGATIVE_INFINITY, next))
    onChange(bounded)
  }

  const nudge = (direction: 1 | -1, by: number): void => {
    const next = round(value + direction * by)
    const bounded = Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min ?? Number.NEGATIVE_INFINITY, next))
    onChange(bounded)
    setDraft(format(bounded))
  }

  return (
    <div
      className={cn(
        'flex items-center gap-1 rounded-md border border-hairline bg-surface-raised px-2',
        'focus-within:border-hairline-strong',
        disabled === true && 'opacity-50',
        className,
      )}
    >
      {label === '' ? null : (
        <span aria-hidden="true" className="shrink-0 text-[11px] text-ink-secondary">
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
          setDraft(format(value))
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
          'tabular w-full min-w-0 border-0 bg-transparent p-0 text-right text-[12px] text-ink-primary',
          'focus-visible:shadow-none focus-visible:outline-none',
        )}
      />
      {suffix === undefined ? null : (
        <span aria-hidden="true" className="shrink-0 text-[10px] text-ink-muted">
          {suffix}
        </span>
      )}
    </div>
  )
}

/** One decimal for millimetres, so `6` never sits beside `27.1` as a ragged column. */
const format = (value: number): string => {
  if (!Number.isFinite(value)) return ''
  const rounded = Math.round(value * 100) / 100
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

const round = (value: number): number => Math.round(value * 100) / 100

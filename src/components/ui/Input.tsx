import { useId } from 'react'
import { cn } from '../../lib/cn'

export type FieldInputMode = 'text' | 'numeric' | 'decimal'

export interface InputProps
  extends Omit<React.ComponentPropsWithoutRef<'input'>, 'className' | 'id' | 'inputMode'> {
  readonly label: string
  readonly hint?: string | undefined
  readonly error?: string | undefined
  /** Rendered inside the field on the right, e.g. `mm`. */
  readonly suffix?: string | undefined
  readonly className?: string | undefined
  readonly inputMode?: FieldInputMode | undefined
}

/** §2: h-12, text-base (16px, no iOS zoom), red focus ring, programmatically
 *  associated label — the placeholder is never the label (§3A). */
export function Input({
  label,
  hint,
  error,
  suffix,
  className,
  inputMode = 'text',
  ...rest
}: InputProps) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy =
    [hint === undefined ? null : hintId, error === undefined ? null : errorId]
      .filter((value): value is string => value !== null)
      .join(' ') || undefined

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-medium text-zinc-300">
        {label}
      </label>
      <div className="relative">
        <input
          {...rest}
          id={id}
          inputMode={inputMode}
          aria-invalid={error === undefined ? undefined : true}
          aria-describedby={describedBy}
          className={cn(
            'h-12 w-full rounded-lg border bg-zinc-900 px-3 text-base text-zinc-50',
            'placeholder:text-zinc-500',
            'transition-[border-color,box-shadow] duration-150 ease-out',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500',
            error === undefined ? 'border-zinc-700' : 'border-rose-700',
            suffix === undefined ? 'pr-3' : 'pr-12',
          )}
        />
        {suffix === undefined ? null : (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-zinc-400"
          >
            {suffix}
          </span>
        )}
      </div>
      {hint === undefined ? null : (
        <p id={hintId} className="text-xs text-zinc-400">
          {hint}
        </p>
      )}
      {error === undefined ? null : (
        <p id={errorId} role="alert" className="text-xs text-rose-400">
          {error}
        </p>
      )}
    </div>
  )
}

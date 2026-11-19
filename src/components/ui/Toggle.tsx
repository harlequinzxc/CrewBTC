import { useId } from 'react'
import { cn } from '../../lib/cn'

export interface ToggleProps {
  readonly label: string
  readonly description?: string | undefined
  readonly checked: boolean
  readonly onChange: (checked: boolean) => void
  readonly disabled?: boolean | undefined
  readonly className?: string | undefined
}

/** Accessible switch. Keyboard operable with Space/Enter via the native button. */
export function Toggle({ label, description, checked, onChange, disabled, className }: ToggleProps) {
  const id = useId()
  const descriptionId = `${id}-description`

  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      <div className="min-w-0">
        <span id={`${id}-label`} className="text-sm font-medium text-zinc-200">
          {label}
        </span>
        {description === undefined ? null : (
          <p id={descriptionId} className="mt-0.5 text-xs text-zinc-400">
            {description}
          </p>
        )}
      </div>
      <button id={id} type="button" data-target="dense" role="switch" aria-checked={checked} aria-labelledby={`${id}-label`} aria-describedby={description === undefined ? undefined : descriptionId} disabled={disabled === true} onClick={() => onChange(!checked)} className={cn(
          'min-h-[44px]',
          'relative inline-flex h-8 min-h-8 w-14 shrink-0 items-center rounded-full',
          'transition-[background-color] duration-150 ease-out',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950',
          'disabled:cursor-not-allowed disabled:opacity-50',
          checked ? 'bg-red-700' : 'bg-zinc-700',
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'block size-6 rounded-full bg-white shadow-sm',
            'transition-[transform] duration-150 ease-out',
            checked ? 'translate-x-7' : 'translate-x-1',
          )}
        />
      </button>
    </div>
  )
}

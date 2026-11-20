import { cn } from '../../../lib/cn'

/**
 * A 28 × 16 switch.
 *
 * The old control was 56 × 32 with a 24px white marble — the size of a primary action,
 * for a setting you flip once. This keeps the same semantics (a native switch role, so
 * Space and Enter work) at inspector scale, and uses the accent for the "on" track
 * instead of the browser's default fill.
 */
export interface SwitchProps {
  readonly label: string
  readonly checked: boolean
  readonly onChange: (checked: boolean) => void
  readonly disabled?: boolean | undefined
}

export function Switch({ label, checked, onChange, disabled }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      data-target="dense"
      aria-label={label}
      aria-checked={checked}
      disabled={disabled === true}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-4 min-h-4 w-7 shrink-0 items-center rounded-full',
        'transition-[background-color] duration-150 ease-out',
        'focus-visible:bg-surface-active',
        'disabled:cursor-not-allowed disabled:opacity-40',
        checked ? 'bg-accent' : 'bg-white/12',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'block size-3 rounded-full bg-white shadow-sm',
          'transition-[transform] duration-150 ease-out',
          checked ? 'translate-x-3.5' : 'translate-x-0.5',
        )}
      />
    </button>
  )
}

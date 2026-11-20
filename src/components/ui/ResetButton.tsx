import { RotateCcw } from 'lucide-react'
import { cn } from '../../lib/cn'

/**
 * The one reset in the app.
 *
 * There used to be four: "Reset to A4 defaults", "Reset bands", "Reset text", and a pan
 * reset on the zoom bar. Four buttons that all meant "undo the thing I am looking at" read
 * as clutter and, worse, as four different scopes. There is now a single icon button that
 * resets whatever section it sits in, named by its `label` for assistive tech.
 */
export interface ResetButtonProps {
  readonly label: string
  readonly onClick: () => void
  readonly disabled?: boolean | undefined
  readonly className?: string | undefined
}

export function ResetButton({ label, onClick, disabled, className }: ResetButtonProps) {
  return (
    <button
      type="button"
      data-target="dense"
      aria-label={label}
      title={label}
      disabled={disabled === true}
      onClick={onClick}
      className={cn(
        'grid size-6 place-items-center rounded text-ink-muted',
        'transition-colors duration-150 ease-out',
        'hover:bg-surface-active hover:text-ink-primary focus-visible:bg-surface-active focus-visible:text-ink-primary',
        'disabled:opacity-40 disabled:hover:bg-transparent disabled:focus-visible:bg-transparent',
        className,
      )}
    >
      <RotateCcw aria-hidden className="size-3" />
    </button>
  )
}

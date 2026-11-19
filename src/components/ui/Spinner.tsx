import { Loader2 } from 'lucide-react'
import { cn } from '../../lib/cn'

export interface SpinnerProps {
  readonly className?: string | undefined
  readonly label?: string | undefined
}

/** Decorative spinner. The label is announced once via `role="status"`. */
export function Spinner({ className, label }: SpinnerProps) {
  return (
    <output aria-live="polite" className="inline-flex items-center">
      <Loader2 aria-hidden="true" strokeWidth={2} className={cn('size-4 animate-spin', className)} />
      <span className="sr-only">{label ?? 'Loading'}</span>
    </output>
  )
}

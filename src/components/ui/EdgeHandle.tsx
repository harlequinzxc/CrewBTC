import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react'
import { cn } from '../../lib/cn'

interface Props {
  readonly label: string
  readonly expanded: boolean
  readonly direction: 'left' | 'right' | 'up' | 'down'
  readonly onClick: () => void
  readonly className?: string
}

/** Identical border-docked controls for the three workspace edges. */
export function EdgeHandle({ label, expanded, direction, onClick, className }: Props) {
  const Icon = { left: ChevronLeft, right: ChevronRight, up: ChevronUp, down: ChevronDown }[direction]
  return <button type="button" data-target="dense" aria-label={label} title={label} aria-expanded={expanded} onClick={onClick} className={cn('inline-flex size-8 items-center justify-center rounded-md border border-hairline-strong bg-surface-panel text-ink-secondary shadow-sm transition-colors duration-150 ease-out hover:bg-surface-active hover:text-ink-primary focus-visible:bg-surface-active focus-visible:text-ink-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent', className)}><Icon aria-hidden className="size-3.5" /></button>
}

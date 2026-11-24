import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react'
import { cn } from '../../lib/cn'

interface Props {
  readonly label: string
  readonly expanded: boolean
  readonly direction: 'left' | 'right' | 'up' | 'down'
  readonly onClick: () => void
}

/** Full-span structural rail; the requested 14 px cross-axis replaces floating handles. */
export function EdgeHandle({ label, expanded, direction, onClick }: Props) {
  const Icon = { left: ChevronLeft, right: ChevronRight, up: ChevronUp, down: ChevronDown }[direction]
  const vertical = direction === 'left' || direction === 'right'
  return <button type="button" data-target="dense" aria-label={label} title={label} aria-expanded={expanded} onClick={onClick} className={cn('flex shrink-0 items-center justify-center bg-surface-canvas text-ink-secondary transition-colors duration-150 ease-out hover:bg-[#181A20] hover:text-ink-primary focus-visible:bg-[#181A20] focus-visible:text-ink-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent', vertical ? 'h-full w-3.5 min-h-0 cursor-col-resize border-x border-hairline' : 'h-3.5 min-h-0 w-full cursor-pointer border-y border-hairline')}><Icon aria-hidden className="size-3 shrink-0" /></button>
}

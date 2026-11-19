import { cn } from '../../lib/cn'

export type BadgeVariant = 'neutral' | 'accent' | 'warning' | 'danger'

const VARIANTS: Record<BadgeVariant, string> = {
  neutral: 'border-zinc-700 bg-zinc-800 text-zinc-300',
  accent: 'border-red-800 bg-red-950 text-red-200',
  warning: 'border-amber-800 bg-amber-950 text-amber-200',
  danger: 'border-rose-800 bg-rose-950 text-rose-200',
}

export interface BadgeProps {
  readonly variant?: BadgeVariant | undefined
  readonly children: React.ReactNode
  readonly className?: string | undefined
}

/** §2: exactly four semantic variants. No ad-hoc pill styling anywhere else. */
export function Badge({ variant = 'neutral', children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5',
        'text-[11px] font-medium leading-5 tracking-wide',
        VARIANTS[variant],
        className,
      )}
    >
      {children}
    </span>
  )
}

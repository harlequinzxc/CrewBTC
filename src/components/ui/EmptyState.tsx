import { cn } from '../../lib/cn'

export interface EmptyStateProps {
  readonly icon: React.ReactNode
  readonly title: string
  readonly description: string
  readonly action?: React.ReactNode | undefined
  readonly className?: string | undefined
}

/** §6/Appendix C: an empty state is never a dead end. */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-zinc-800 px-6 py-10 text-center',
        className,
      )}
    >
      <span aria-hidden="true" className="text-zinc-500">
        {icon}
      </span>
      <div className="space-y-1">
        <p className="text-sm font-medium text-zinc-200">{title}</p>
        <p className="max-w-xs text-xs text-zinc-400">{description}</p>
      </div>
      {action === undefined ? null : <div className="pt-1">{action}</div>}
    </div>
  )
}

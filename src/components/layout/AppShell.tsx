import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export interface AppShellProps {
  readonly sidebar: ReactNode
  readonly header: ReactNode
  readonly children: ReactNode
  readonly className?: string
}

/** Full-height desktop shell. §4.3: use the small-viewport height unit here. */
export function AppShell({ sidebar, header, children, className }: AppShellProps) {
  return (
    <div className={cn('flex min-h-[100svh] w-full overflow-x-hidden bg-zinc-950', className)}>
      <aside className="hidden w-[260px] shrink-0 border-r border-zinc-800 bg-zinc-950 lg:flex lg:flex-col">
        {sidebar}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-zinc-800 bg-zinc-950 px-4">
          {header}
        </header>
        <main className="flex min-h-0 flex-1 flex-col">{children}</main>
      </div>
    </div>
  )
}

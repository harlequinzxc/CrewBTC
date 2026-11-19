import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export interface AppShellProps {
  readonly sidebar: ReactNode
  readonly header: ReactNode
  readonly children: ReactNode
  readonly className?: string
}

/**
 * Full-height desktop shell that never scrolls as a whole: the page is pinned to the
 * viewport height and each pane owns its own scroll region. §4.3 forbids the
 * large-viewport unit; `h-[100svh]` plus `overflow-hidden` keeps the chrome fixed
 * while panes scroll.
 */
export function AppShell({ sidebar, header, children, className }: AppShellProps) {
  return (
    <div
      className={cn(
        'flex h-[100svh] max-h-[100svh] w-full overflow-hidden bg-zinc-950',
        className,
      )}
    >
      <aside className="hidden w-[260px] shrink-0 overflow-y-auto border-r border-zinc-800 bg-zinc-950 lg:flex lg:flex-col">
        {sidebar}
      </aside>
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-zinc-800 bg-zinc-950 px-4">
          {header}
        </header>
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</main>
      </div>
    </div>
  )
}

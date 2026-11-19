import { FileStack, Settings2 } from 'lucide-react'
import { cn } from '../../lib/cn'
import { APP_NAME } from '../../config/brand'

export type ViewId = 'workspace' | 'settings'

export interface SidebarNavProps {
  readonly active: ViewId
  readonly onSelect: (view: ViewId) => void
}

const ITEMS = [
  { id: 'workspace', label: 'Workspace', icon: FileStack },
  { id: 'settings', label: 'Settings', icon: Settings2 },
] as const

/** §4.2: persistent sidebar at >=768px, one primary action per screen. */
export function SidebarNav({ active, onSelect }: SidebarNavProps) {
  return (
    <nav aria-label="Primary" className="flex flex-col gap-1 p-3">
      <div className="mb-4 flex items-center gap-2 px-2 py-1">
        <span aria-hidden="true" className="grid size-7 place-items-center rounded-md bg-red-700">
          <FileStack strokeWidth={2} className="size-4 text-white" />
        </span>
        <span className="text-sm font-semibold tracking-tight text-zinc-50">{APP_NAME}</span>
      </div>
      {ITEMS.map((item) => {
        const Icon = item.icon
        const isActive = item.id === active
        return (
          <button key={item.id} type="button" data-target="default" aria-current={isActive ? 'page' : undefined} onClick={() => onSelect(item.id)} className={cn(
              'min-h-[44px]',
              'flex h-11 min-h-[44px] items-center gap-3 rounded-lg px-3 text-sm transition-colors duration-150 ease-out',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500',
              isActive
                ? 'bg-zinc-900 font-medium text-zinc-50'
                : 'text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-200 focus-visible:bg-zinc-900/60',
            )}
          >
            <Icon
              aria-hidden="true"
              strokeWidth={2}
              className={cn('size-4', isActive ? 'text-red-400' : 'text-zinc-500')}
            />
            {item.label}
          </button>
        )
      })}
    </nav>
  )
}

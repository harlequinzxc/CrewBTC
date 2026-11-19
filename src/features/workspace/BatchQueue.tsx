import { FilePlus2, Printer, RefreshCw, Trash2 } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'

export interface QueueItem {
  readonly id: string
  readonly name: string
  readonly status: 'parsed' | 'edited' | 'warning'
}

export interface BatchQueueProps {
  readonly items: readonly QueueItem[]
  readonly activeId: string | null
  readonly onSelect: (id: string) => void
  readonly onAdd: () => void
  readonly onReRun: () => void
  readonly onClear: () => void
  readonly busy: boolean
}

const STATUS_BADGE = {
  parsed: { variant: 'neutral', label: 'Parsed' },
  edited: { variant: 'accent', label: 'Edited' },
  warning: { variant: 'warning', label: 'Low DPI' },
} as const

/** Left pane (§4 of the spec): the batch queue with bulk actions. */
export function BatchQueue({
  items,
  activeId,
  onSelect,
  onAdd,
  onReRun,
  onClear,
  busy,
}: BatchQueueProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-zinc-800 px-3 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Batch queue
        </h2>
        <span className="tabular text-xs text-zinc-500">{items.length}</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {items.length === 0 ? (
          <EmptyState
            icon={<Printer strokeWidth={2} className="size-6" />}
            title="No PDFs yet"
            description="Drop a folder of PDFs to start a batch."
            action={
              <Button size="sm" variant="primary" onClick={onAdd}>
                Add PDFs
              </Button>
            }
          />
        ) : (
          <ul className="flex flex-col gap-0.5">
            {items.map((item) => {
              const badge = STATUS_BADGE[item.status]
              const isActive = item.id === activeId
              return (
                <li key={item.id}>
                  <button type="button" data-target="default" aria-current={isActive ? 'true' : undefined} onClick={() => onSelect(item.id)} className={
                      isActive
                        ? 'flex min-h-[44px] w-full items-center gap-2 rounded-lg bg-zinc-800 px-2 py-2 text-left'
                        : 'flex min-h-[44px] w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors duration-150 ease-out hover:bg-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500'
                    }
                  >
                    <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-md border border-zinc-700 bg-zinc-900 text-[10px] text-zinc-500">
                      PDF
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium text-zinc-100">
                        {item.name}
                      </span>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="grid grid-cols-2 gap-1.5 border-t border-zinc-800 p-2">
        <Button size="sm" variant="secondary" onClick={onAdd} disabled={busy} className="col-span-2">
          <FilePlus2 aria-hidden="true" strokeWidth={2} className="size-4" />
          Add more PDFs
        </Button>
        <Button size="sm" variant="ghost" onClick={onReRun} disabled={busy || items.length === 0}>
          <RefreshCw aria-hidden="true" strokeWidth={2} className="size-4" />
          Re-run
        </Button>
        <Button size="sm" variant="ghost" onClick={onClear} disabled={busy || items.length === 0}>
          <Trash2 aria-hidden="true" strokeWidth={2} className="size-4" />
          Clear
        </Button>
      </div>
    </div>
  )
}

import { FilePlus2, FileText, RefreshCw, Trash2 } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { Spinner } from '../../components/ui/Spinner'
import { cn } from '../../lib/cn'
import type { IngestedDocument } from '../../types/document'
import { formatBytes } from '../../lib/format'

export interface BatchQueueProps {
  readonly documents: readonly IngestedDocument[]
  readonly activeId: string | null
  readonly onSelect: (id: string) => void
  readonly onAdd: () => void
  readonly onReRun: () => void
  readonly onClear: () => void
  readonly busy: boolean
}

function statusOf(document: IngestedDocument): {
  variant: 'neutral' | 'accent' | 'warning' | 'danger'
  label: string
} {
  if (document.status === 'failed') return { variant: 'danger', label: 'Failed' }
  if (document.status === 'parsing') return { variant: 'accent', label: 'Parsing' }
  if (document.regions.length === 0) return { variant: 'warning', label: 'No text found' }
  return { variant: 'neutral', label: 'Parsed' }
}

/** Left pane: the batch queue with bulk actions. */
export function BatchQueue({
  documents,
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
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Queue</h2>
        <span className="tabular text-xs text-zinc-500">{documents.length}</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {documents.length === 0 ? (
          <EmptyState
            icon={<FileText strokeWidth={2} className="size-6" />}
            title="No PDFs yet"
            description="Drop a folder of PDFs to start a batch."
            action={
              <Button size="sm" variant="primary" onClick={onAdd} disabled={busy}>
                Add PDFs
              </Button>
            }
          />
        ) : (
          <ul className="flex flex-col gap-0.5">
            {documents.map((document) => {
              const badge = statusOf(document)
              const isActive = document.id === activeId
              return (
                <li key={document.id}>
                  <button type="button" data-target="default" aria-current={isActive ? 'true' : undefined} onClick={() => onSelect(document.id)} className={cn(
                      'flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left',
                      'transition-colors duration-150 ease-out focus-visible:ring-2 focus-visible:ring-red-500',
                      isActive ? 'bg-zinc-800' : 'hover:bg-zinc-900 focus-visible:bg-zinc-900',
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-md border border-zinc-700 bg-zinc-950"
                    >
                      {document.pagePreviewUrl === null ? (
                        <FileText strokeWidth={2} className="size-4 text-zinc-500" />
                      ) : (
                        <img
                          src={document.pagePreviewUrl}
                          alt=""
                          className="size-full object-cover"
                        />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium text-zinc-100">
                        {document.fileName}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1.5">
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                        <span className="tabular text-[10px] text-zinc-500">
                          {formatBytes(document.byteLength)}
                        </span>
                      </span>
                    </span>
                    {document.status === 'parsing' ? <Spinner className="size-4" /> : null}
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
        <Button size="sm" variant="ghost" onClick={onReRun} disabled={busy || documents.length === 0}>
          <RefreshCw aria-hidden="true" strokeWidth={2} className="size-4" />
          Re-run
        </Button>
        <Button size="sm" variant="ghost" onClick={onClear} disabled={busy || documents.length === 0}>
          <Trash2 aria-hidden="true" strokeWidth={2} className="size-4" />
          Clear
        </Button>
      </div>
    </div>
  )
}

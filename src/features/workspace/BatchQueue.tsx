import { FilePlus2, FileText, RefreshCw, RotateCw, Trash2 } from 'lucide-react'
import { cn } from '../../lib/cn'
import type { IngestedDocument } from '../../types/document'

/**
 * The file queue: one row per PDF, and one button to add more.
 *
 * Rows are a 28px thumbnail and a single truncated name. Status lives in a 6px dot rather
 * than a badge with its own label. The old rows spent 40px of height and two extra lines
 * per file saying "Parsed" and "59 KB", neither of which changed what you did next.
 *
 * Re-run and clear sit on the queue header as icon actions, which is why there is no
 * longer a second `Add PDFs` anywhere: one action per area.
 */
export interface BatchQueueProps {
  readonly documents: readonly IngestedDocument[]
  readonly activeId: string | null
  readonly onSelect: (id: string) => void
  readonly onAdd: () => void
  readonly onReRun: () => void
  readonly onClear: () => void
  readonly busy: boolean
}

type Status = 'failed' | 'parsing' | 'empty' | 'parsed'

const DOT: Record<Status, string> = {
  failed: 'bg-accent',
  parsing: 'bg-ink-secondary animate-pulse',
  empty: 'bg-amber-500',
  parsed: 'bg-emerald-500',
}

const STATUS_TEXT: Record<Status, string> = {
  failed: 'Failed',
  parsing: 'Parsing',
  empty: 'No text found',
  parsed: 'Parsed',
}

function statusOf(document: IngestedDocument): Status {
  if (document.status === 'failed') return 'failed'
  if (document.status === 'parsing') return 'parsing'
  if (document.regions.length === 0) return 'empty'
  return 'parsed'
}

const iconAction = cn(
  'grid size-6 place-items-center rounded text-ink-muted',
  'transition-colors duration-150 ease-out',
  'hover:bg-surface-active hover:text-ink-primary focus-visible:bg-surface-active focus-visible:text-ink-primary',
  'disabled:opacity-30 disabled:hover:bg-transparent disabled:focus-visible:bg-transparent',
)

export function BatchQueue(props: BatchQueueProps) {
  const { documents, busy } = props
  const empty = documents.length === 0

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-hairline pl-3 pr-1.5">
        <h2 className="text-[11px] font-medium uppercase tracking-[0.06em] text-ink-secondary">
          Files
        </h2>
        <div className="flex items-center">
          <button
            type="button"
            data-target="dense"
            aria-label="Re-run all files"
            title="Re-run"
            disabled={busy || empty}
            onClick={props.onReRun}
            className={iconAction}
          >
            <RefreshCw aria-hidden className="size-3" />
          </button>
          <button
            type="button"
            data-target="dense"
            aria-label="Clear all files"
            title="Clear"
            disabled={busy || empty}
            onClick={props.onClear}
            className={iconAction}
          >
            <Trash2 aria-hidden className="size-3" />
          </button>
        </div>
      </div>

      <div className="p-1.5">
        <button
          type="button"
          data-target="dense"
          onClick={props.onAdd}
          disabled={busy}
          className={cn(
            'flex h-7 w-full items-center justify-center gap-1.5 rounded-md',
            'border border-dashed border-hairline-strong text-[11px] text-ink-secondary',
            'transition-colors duration-150 ease-out',
            'hover:border-accent hover:bg-accent/10 hover:text-ink-primary focus-visible:border-accent focus-visible:bg-accent/10 focus-visible:text-ink-primary',
            'disabled:opacity-40',
          )}
        >
          <FilePlus2 aria-hidden className="size-3.5" />
          Add PDFs
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-1.5">
        {empty ? (
          <p className="px-1.5 py-2 text-[11px] text-ink-muted">No files</p>
        ) : (
          <ul className="flex flex-col gap-px">
            {documents.map((document) => {
              const status = statusOf(document)
              const isActive = document.id === props.activeId
              // Only a failed or skipped file gets a per-row action. A healthy row has
              // nothing to do to it, and a re-run icon on all twelve would put twelve
              // controls on screen to serve the two that need one.
              const canRetry = status === 'failed' || status === 'empty'
              return (
                <li key={document.id} className="relative">
                  <button
                    type="button"
                    data-target="dense"
                    aria-current={isActive ? 'true' : undefined}
                    onClick={() => props.onSelect(document.id)}
                    className={cn(
                      'flex h-8 w-full items-center gap-2 rounded px-1.5 text-left',
                      'transition-colors duration-150 ease-out',
                      'focus-visible:bg-surface-active',
                      isActive ? 'bg-accent/12' : 'hover:bg-surface-active focus-visible:bg-surface-active',
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        'grid size-7 shrink-0 place-items-center overflow-hidden rounded border bg-surface-canvas',
                        isActive ? 'border-accent/60' : 'border-hairline',
                      )}
                    >
                      {document.pagePreviewUrl === null ? (
                        <FileText aria-hidden className="size-3 text-ink-muted" />
                      ) : (
                        <img
                          src={document.pagePreviewUrl}
                          alt=""
                          className="size-full object-cover"
                        />
                      )}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[11px] text-ink-primary">
                      {document.fileName}
                    </span>
                    <span
                      aria-hidden="true"
                      title={STATUS_TEXT[status]}
                      className={cn('size-1.5 shrink-0 rounded-full', DOT[status])}
                    />
                  </button>

                  {canRetry ? (
                    <button
                      type="button"
                      data-target="dense"
                      aria-label={`Re-run ${document.fileName}`}
                      onClick={props.onReRun}
                      disabled={busy}
                      className="absolute right-1 top-1/2 grid size-5 -translate-y-1/2 place-items-center rounded bg-surface-panel text-ink-secondary transition-colors duration-150 ease-out hover:text-ink-primary focus-visible:text-ink-primary disabled:opacity-30"
                    >
                      <RotateCw aria-hidden className="size-2.5" />
                    </button>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

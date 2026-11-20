import { useMemo, useState } from 'react'
import { FilePlus2, RefreshCw, Search, Trash2, X } from 'lucide-react'
import { cn } from '../../lib/cn'
import type { IngestedDocument } from '../../types/document'
import { firstPlacementOf } from './sheet-navigation'
import type { PagePlacement } from './sheet-navigation'
import { FileRow } from './FileRow'
import { statusOf } from './file-status'

/**
 * The file queue: one row per PDF, and one button to add more.
 *
 * Rows are a 28px thumbnail and a single truncated name. Status lives in a 6px dot rather
 * than a badge with its own label. The old rows spent 40px of height and two extra lines
 * per file saying "Parsed" and "59 KB", neither of which changed what you did next.
 *
 * Two things earn the extra furniture now that batches run to 27 files:
 *
 * - **A filter**, because a list of 27 names is a haystack and the user knows which file
 *   they want. Names only: the search box is not a query language, and matching page
 *   contents would promise a precision this app does not have.
 * - **A slot marker** (`S2 · 07`), because the question a batch raises is not "which files
 *   did I add" but "where did *this* one land". It sits right-aligned in the muted scale of
 *   a coordinate, not in the scale of a label — it is a hint, and the name is the content.
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
  /** Where each document's first page landed, for the `S1 · 01` hint. */
  readonly placements: ReadonlyMap<string, ReadonlyMap<number, PagePlacement>>
  /** Jump to a document's card. Falls back to selecting it when it has no card. */
  readonly onReveal: (document: IngestedDocument) => void
}

const iconAction = cn(
  'grid size-6 place-items-center rounded text-ink-muted',
  'transition-colors duration-150 ease-out',
  'hover:bg-surface-active hover:text-ink-primary focus-visible:bg-surface-active focus-visible:text-ink-primary',
  'disabled:opacity-30 disabled:hover:bg-transparent disabled:focus-visible:bg-transparent',
)

export function BatchQueue(props: BatchQueueProps) {
  const { documents, busy } = props
  const [query, setQuery] = useState('')
  const empty = documents.length === 0

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (needle === '') return documents
    return documents.filter((document) => document.fileName.toLowerCase().includes(needle))
  }, [documents, query])

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

      <div className="flex flex-col gap-1 p-1.5">
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

        {/*
          A filter, not a search field: it narrows the list already on screen, so it has no
          button and no results page. `type="search"` is what gives it the clear affordance a
          browser and a screen reader both understand, and the wrapper keeps that clear
          button from colliding with the magnifier on a hover.
        */}
        <div className="relative flex items-center">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-1.5 size-3 text-ink-muted"
          />
          <input
            type="search"
            value={query}
            disabled={empty}
            aria-label="Filter files by name"
            placeholder={empty ? 'Filter' : `Filter ${documents.length} files`}
            onChange={(event) => setQuery(event.target.value)}
            className={cn(
              'h-7 w-full rounded-md border border-hairline-strong bg-surface-raised pl-6 pr-6',
              'text-[11px] text-ink-primary placeholder:text-ink-muted',
              'transition-colors duration-150 ease-out',
              'hover:border-ink-muted focus-visible:border-accent focus-visible:outline-none',
              'disabled:opacity-40',
              // The native clear button is a second X next to ours, one at each end.
              '[&::-webkit-search-cancel-button]:appearance-none',
            )}
          />
          {query === '' ? null : (
            <button
              type="button"
              data-target="dense"
              aria-label="Clear filter"
              onClick={() => setQuery('')}
              className="absolute right-1 grid size-5 place-items-center rounded text-ink-muted transition-colors duration-150 ease-out hover:text-ink-primary focus-visible:text-ink-primary"
            >
              <X aria-hidden className="size-3" />
            </button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-1.5">
        {empty ? (
          <p className="px-1.5 py-2 text-[11px] text-ink-muted">No files</p>
        ) : shown.length === 0 ? (
          <p className="px-1.5 py-2 text-[11px] text-ink-muted">
            No file matches “{query.trim()}”.
          </p>
        ) : (
          <ul className="flex flex-col gap-px">
            {shown.map((document) => (
              <FileRow
                key={document.id}
                document={document}
                status={statusOf(document)}
                active={document.id === props.activeId}
                busy={busy}
                placed={firstPlacementOf(props.placements, document.fileName)}
                onSelect={() => {
                  props.onSelect(document.id)
                  props.onReveal(document)
                }}
                onReRun={props.onReRun}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

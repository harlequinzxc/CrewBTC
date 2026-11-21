import { FileText, RotateCw } from 'lucide-react'
import { cn } from '../../../lib/cn'
import type { IngestedDocument } from '../../../types/document'
import { STATUS_TEXT } from './file-status'
import type { FileStatus } from './file-status'
import type { PagePlacement } from '../sheet/sheet-navigation'

/**
 * One file in the queue.
 *
 * Split from `BatchQueue` for the same reason the queue was split from the rail: the row
 * is a small state machine of its own — active, retryable, placed or unplaced — and it was
 * pushing the list past its line budget. Nothing here decides anything the queue does; it
 * draws four facts and raises two events.
 */
/** One dot per state. Colour only, because the word is already the row's `title`. */
const DOT: Record<FileStatus, string> = {
  failed: 'bg-accent',
  parsing: 'bg-ink-secondary animate-pulse',
  empty: 'bg-amber-500',
  parsed: 'bg-emerald-500',
}

export interface FileRowProps {
  readonly document: IngestedDocument
  readonly status: FileStatus
  readonly active: boolean
  readonly busy: boolean
  readonly placed: (PagePlacement & { readonly pageNumber: number }) | null
  readonly onSelect: () => void
  readonly onReRun: () => void
}

export function FileRow(props: FileRowProps) {
  const { document, status, active, placed } = props
  // Only a failed or skipped file gets a per-row action. A healthy row has nothing to do
  // to it, and a re-run icon on all twelve would put twelve controls on screen to serve
  // the two that need one.
  const canRetry = status === 'failed' || status === 'empty'

  return (
    <li className="relative">
      <button
        type="button"
        data-target="dense"
        aria-current={active ? 'true' : undefined}
        title={
          placed === null
            ? `${document.fileName} — not placed on a sheet`
            : `${document.fileName} — sheet ${placed.sheetIndex + 1}, card ${placed.cellIndex + 1}`
        }
        onClick={props.onSelect}
        className={cn(
          'flex h-8 w-full items-center gap-2 rounded px-1.5 text-left',
          'transition-colors duration-150 ease-out',
          'focus-visible:bg-surface-active',
          active ? 'bg-accent/12' : 'hover:bg-surface-active focus-visible:bg-surface-active',
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'grid size-7 shrink-0 place-items-center overflow-hidden rounded border bg-surface-canvas',
            active ? 'border-accent/60' : 'border-hairline',
          )}
        >
          {document.pagePreviewUrl === null ? (
            <FileText aria-hidden className="size-3 text-ink-muted" />
          ) : (
            <img src={document.pagePreviewUrl} alt="" className="size-full object-cover" />
          )}
        </span>
        <span className="min-w-0 flex-1 truncate text-[11px] text-ink-primary">
          {document.fileName}
        </span>
        {placed === null ? null : (
          /*
            A coordinate, not a label: `S2 · 07` is where the card is. Hidden from
            assistive tech because the row's title already says it in words, and a screen
            reader reading "S two middle dot zero seven" is noise beside "sheet 2, card 7".
          */
          <span aria-hidden="true" className="tabular shrink-0 text-[10px] text-ink-muted">
            S{placed.sheetIndex + 1} · {String(placed.cellIndex + 1).padStart(2, '0')}
          </span>
        )}
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
          disabled={props.busy}
          className="absolute right-1 top-1/2 grid size-5 -translate-y-1/2 place-items-center rounded bg-surface-panel text-ink-secondary transition-colors duration-150 ease-out hover:text-ink-primary focus-visible:text-ink-primary disabled:opacity-30"
        >
          <RotateCw aria-hidden className="size-2.5" />
        </button>
      ) : null}
    </li>
  )
}

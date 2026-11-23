import { useCallback, useRef, useState } from 'react'
import { Ellipsis, FileText, RotateCw } from 'lucide-react'
import { downloadBytes } from '../../../lib/export/download'
import { getProjectSource } from '../../../lib/storage/project-sources'
import { FileDownloadMenu } from './FileDownloadMenu'
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
 * pushing the list past its line budget. It also provides access to the stored original PDF.
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
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const [error, setError] = useState(false)
  const options = useRef<HTMLButtonElement>(null)
  const close = useCallback((restoreFocus: boolean) => {
    setMenu(null)
    if (restoreFocus) options.current?.focus()
  }, [])
  const download = async () => {
    close(true)
    setError(false)
    const bytes = await getProjectSource(document.id)
    if (bytes === null) { setError(true); return }
    try { downloadBytes(new Uint8Array(bytes), document.fileName) } catch { setError(true) }
  }
  // Retry is only useful on failed or empty files.
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
        onContextMenu={(event) => { event.preventDefault(); setMenu({ x: event.clientX, y: event.clientY }) }}
        onClick={props.onSelect}
        className={cn(
          'flex h-8 w-full items-center gap-2 rounded pl-1.5 pr-14 text-left',
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

      <button ref={options} type="button" data-target="dense" aria-label={`Options for ${document.fileName}`} aria-haspopup="menu" aria-expanded={menu !== null} onClick={(event) => { const rect = event.currentTarget.getBoundingClientRect(); setMenu(menu === null ? { x: rect.left, y: rect.bottom } : null) }} className="absolute right-1 top-1 grid size-6 place-items-center rounded text-ink-secondary hover:bg-surface-active focus-visible:bg-surface-active">
        <Ellipsis aria-hidden className="size-4" />
      </button>
      {menu === null ? null : <FileDownloadMenu position={menu} onClose={close} onDownload={() => { void download() }} />}
      {error ? <p role="alert" className="px-2 py-1 text-[11px] text-ink-primary">Original PDF unavailable or could not be downloaded. Re-add the original file if you have it.</p> : null}
      {canRetry ? (
        <button
          type="button"
          data-target="dense"
          aria-label={`Re-run ${document.fileName}`}
          onClick={props.onReRun}
          disabled={props.busy}
          className="absolute right-8 top-1.5 grid size-5 place-items-center rounded bg-surface-panel text-ink-secondary transition-colors duration-150 ease-out hover:text-ink-primary focus-visible:text-ink-primary disabled:opacity-30"
        >
          <RotateCw aria-hidden className="size-2.5" />
        </button>
      ) : null}
    </li>
  )
}

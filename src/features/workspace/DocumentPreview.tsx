import { FileWarning, ScanText } from 'lucide-react'
import { EmptyState } from '../../components/ui/EmptyState'
import { Badge } from '../../components/ui/Badge'
import { formatBytes, formatDateTime } from '../../lib/format'
import type { IngestedDocument } from '../../types/document'

export interface DocumentPreviewProps {
  readonly document: IngestedDocument | null
}

/** Centre pane for Phase 2: the parsed page, its text blocks, and page metrics. */
export function DocumentPreview({ document }: DocumentPreviewProps) {
  if (document === null) {
    return (
      <EmptyState
        icon={<ScanText strokeWidth={2} className="size-6" />}
        title="Nothing selected"
        description="Add a PDF and choose it in the queue to see what was extracted."
      />
    )
  }

  const dims =
    document.metrics === null
      ? '—'
      : `${(document.metrics.widthPt / 2.83465).toFixed(0)} × ${(
          document.metrics.heightPt / 2.83465
        ).toFixed(0)} mm`

  return (
    <div className="flex min-h-0 w-full max-w-3xl flex-col gap-4 overflow-y-auto p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-medium text-zinc-100">{document.fileName}</h2>
          <p className="tabular mt-0.5 text-xs text-zinc-500">
            {dims} · {document.metrics?.pageCount ?? '—'}{' '}
            {document.metrics?.pageCount === 1 ? 'page' : 'pages'} ·{' '}
            {formatBytes(document.byteLength)} · {formatDateTime(document.addedAt)}
          </p>
        </div>
        <Badge variant={document.status === 'failed' ? 'danger' : 'neutral'}>
          {document.status === 'failed' ? 'Failed' : `${document.regions.length} blocks`}
        </Badge>
      </div>

      {document.error === null ? null : (
        <div className="flex items-start gap-2 rounded-lg border border-amber-800 bg-amber-950/40 p-3">
          <FileWarning aria-hidden="true" strokeWidth={2} className="mt-0.5 size-4 text-amber-300" />
          <p className="text-xs text-amber-200">{document.error}</p>
        </div>
      )}

      {document.pagePreviewUrl === null ? null : (
        <img
          src={document.pagePreviewUrl}
          alt={`First page of ${document.fileName}`}
          className="mx-auto max-h-72 rounded-lg border border-zinc-800 bg-white object-contain"
        />
      )}

      {document.regions.length === 0 ? (
        <EmptyState
          icon={<ScanText strokeWidth={2} className="size-6" />}
          title="No text blocks found"
          description="This PDF may be a scan. Text extraction needs a text layer."
        />
      ) : (
        <ol className="flex flex-col gap-2">
          {document.regions.map((region) => (
            <li key={region.id} className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                  {region.id.replace('block', 'block ')}
                </span>
                <span className="tabular text-[10px] text-zinc-500">
                  y {region.box.y.toFixed(3)} · {region.box.width.toFixed(2)} wide
                </span>
              </div>
              <p className="mt-1 text-sm leading-relaxed text-zinc-200">{region.text}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import type { CardExportOptions } from '../sheet/use-card-export'
import { usePdfPreview } from './use-pdf-preview'

interface Props extends Omit<CardExportOptions, 'notify'> {
  readonly sheetCount: number
  readonly initialSheet: number
  readonly onClose: () => void
}

export function PdfPreview({ sheetCount, initialSheet, onClose, ...options }: Props) {
  const [requestedSheet, setRequestedSheet] = useState(initialSheet)
  const [lastEditorSheet, setLastEditorSheet] = useState(initialSheet)
  const [zoom, setZoom] = useState(100)
  if (lastEditorSheet !== initialSheet) {
    setLastEditorSheet(initialSheet)
    setRequestedSheet(initialSheet)
  }
  const requested = lastEditorSheet !== initialSheet ? initialSheet : requestedSheet
  const sheet = Math.max(0, Math.min(requested, Math.max(0, sheetCount - 1)))
  const preview = usePdfPreview(options, sheet)
  const root = useRef<HTMLElement>(null)
  const close = () => { onClose(); document.getElementById('pdf-preview-toggle')?.focus({ preventScroll: true }) }
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && root.current?.contains(document.activeElement)) {
        event.stopPropagation()
        onClose()
        document.getElementById('pdf-preview-toggle')?.focus({ preventScroll: true })
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <aside ref={root} aria-label="PDF preview" className="absolute bottom-0 right-0 top-0 z-30 flex w-[min(65%,480px)] min-w-[320px] flex-col border-l border-hairline bg-surface-panel shadow-xl xl:static xl:z-auto xl:w-[38%] xl:max-w-[480px] xl:shrink-0 xl:shadow-none">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-hairline px-3">
        <h2 className="flex-1 text-xs font-semibold text-ink-primary">PDF preview</h2>
        <button type="button" data-target="dense" aria-label="Previous preview sheet" disabled={sheet <= 0} onClick={() => setRequestedSheet(sheet - 1)} className="min-h-8 rounded px-2 text-xs text-ink-primary hover:bg-surface-active focus-visible:bg-surface-active focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-40">Previous</button>
        <span className="whitespace-nowrap text-xs text-ink-secondary">{sheet + 1} / {sheetCount}</span>
        <button type="button" data-target="dense" aria-label="Next preview sheet" disabled={sheet + 1 >= sheetCount} onClick={() => setRequestedSheet(sheet + 1)} className="min-h-8 rounded px-2 text-xs text-ink-primary hover:bg-surface-active focus-visible:bg-surface-active focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-40">Next</button>
        <button type="button" data-target="dense" aria-label="Close PDF preview" onClick={close} className="grid size-8 place-items-center rounded text-ink-primary hover:bg-surface-active focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"><X aria-hidden className="size-4" /></button>
      </div>
      <div className="flex items-center gap-1 border-b border-hairline px-3" aria-label="PDF preview zoom">
        <button type="button" data-target="dense" aria-label="Zoom out PDF preview" disabled={zoom <= 100} onClick={() => setZoom((value) => Math.max(100, value - 25))} className="grid size-8 place-items-center rounded text-ink-primary hover:bg-surface-active focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-40">−</button>
        <span className="min-w-10 text-center text-xs text-ink-secondary">{zoom}%</span>
        <button type="button" data-target="dense" aria-label="Zoom in PDF preview" disabled={zoom >= 300} onClick={() => setZoom((value) => Math.min(300, value + 25))} className="grid size-8 place-items-center rounded text-ink-primary hover:bg-surface-active focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-40">+</button>
        <button type="button" data-target="dense" onClick={() => setZoom(100)} className="min-h-8 rounded px-2 text-xs text-ink-primary hover:bg-surface-active focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">Fit</button>
      </div>
      <output className="block px-3 py-1 text-[11px] text-ink-secondary">{preview.message}</output>
      {sheetCount > 1 ? <p className="px-3 pb-1 text-[11px] text-ink-secondary">This sheet export currently writes sheet 1. Choose All sheets to export every sheet.</p> : null}
      <div className="min-h-0 flex-1 overflow-auto bg-surface-canvas p-3">
        {preview.image === null ? null : <img src={preview.image} alt={`Generated PDF, sheet ${sheet + 1}`} style={{ width: `${zoom}%`, maxWidth: 'none' }} className="mx-auto block bg-white shadow-lg" />}
      </div>
    </aside>
  )
}

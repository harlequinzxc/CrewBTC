import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Download } from 'lucide-react'

export interface ExportControlProps {
  readonly hasBatch: boolean
  readonly hasMoreThanOneSheet: boolean
  readonly exporting: boolean
  readonly onExportCurrent: () => void
  readonly onExportAll: () => void
  readonly hasProjectCards?: boolean
  readonly onCustomSelection?: (() => void) | undefined
}

export function ExportControl(props: ExportControlProps) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    const down = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false) }
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus() } }
    document.addEventListener('pointerdown', down, true)
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('pointerdown', down, true); document.removeEventListener('keydown', key) }
  }, [open])
  const disabled = !props.hasBatch || props.exporting
  const menuDisabled = (!props.hasBatch && !props.hasProjectCards) || props.exporting
  const item = 'block min-h-8 w-full px-3 py-2 text-left text-xs text-ink-primary hover:bg-surface-active focus-visible:bg-surface-active disabled:opacity-40'
  return <div ref={root} className="relative shrink-0">
    <button ref={trigger} type="button" data-target="dense" aria-label="Export PDF" title="Export PDF" aria-haspopup="menu" aria-expanded={open} disabled={menuDisabled} onClick={() => setOpen(!open)} className="flex h-8 items-center gap-1.5 rounded-md bg-accent-solid px-3 text-xs font-medium text-white hover:bg-accent-bright focus-visible:bg-accent-bright disabled:opacity-40">
      <Download aria-hidden className="size-3.5" /><span>Export</span><ChevronDown aria-hidden className="size-3" />
    </button>
    {open ? <div role="menu" aria-label="Export options" className="absolute right-0 top-9 z-30 w-44 overflow-hidden rounded-lg border border-hairline bg-surface-raised shadow-xl shadow-black/50">
      <button type="button" role="menuitem" data-target="dense" disabled={disabled} className={item} onClick={() => { setOpen(false); props.onExportCurrent() }}>This sheet</button>
      {props.hasMoreThanOneSheet ? <button type="button" role="menuitem" data-target="dense" disabled={disabled} className={item} onClick={() => { setOpen(false); props.onExportAll() }}>All sheets</button> : null}
      {props.onCustomSelection === undefined ? null : <button type="button" role="menuitem" data-target="dense" disabled={!props.hasProjectCards} className={item} onClick={() => { setOpen(false); props.onCustomSelection?.() }}>Custom selection</button>}
    </div> : null}
  </div>
}

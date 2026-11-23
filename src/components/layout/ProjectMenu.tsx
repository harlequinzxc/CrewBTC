import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Folder } from 'lucide-react'

interface Props {
  readonly busy: boolean
  readonly hasProject: boolean
  readonly onNew?: (() => void) | undefined
  readonly onOpen?: (() => void) | undefined
  readonly onSave?: (() => void) | undefined
}

export function ProjectMenu({ busy, hasProject, onNew, onOpen, onSave }: Props) {
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
  const item = 'block min-h-8 w-full px-3 py-2 text-left text-xs text-ink-primary hover:bg-surface-active focus-visible:bg-surface-active disabled:opacity-40'
  return <div ref={root} className="relative shrink-0">
    <button ref={trigger} type="button" data-target="dense" aria-label="Project options" title="Project options" aria-expanded={open} aria-haspopup="menu" disabled={busy} onClick={() => setOpen(!open)} className="flex h-8 items-center gap-1 rounded-md px-2 text-xs text-ink-secondary hover:bg-surface-active hover:text-ink-primary focus-visible:bg-surface-active disabled:opacity-40"><Folder aria-hidden className="size-4" /><span className="hidden xl:inline">Project</span><ChevronDown aria-hidden className="size-3" /></button>
    {open ? <div role="menu" aria-label="Project options" className="absolute left-0 top-9 z-30 w-40 overflow-hidden rounded-lg border border-hairline bg-surface-raised shadow-xl shadow-black/50">
      <button type="button" role="menuitem" data-target="dense" className={item} onClick={() => { setOpen(false); onNew?.() }}>New project</button>
      <button type="button" role="menuitem" data-target="dense" className={item} onClick={() => { setOpen(false); onOpen?.() }}>Open project</button>
      <button type="button" role="menuitem" data-target="dense" className={item} disabled={!hasProject} onClick={() => { setOpen(false); onSave?.() }}>Save project</button>
    </div> : null}
  </div>
}

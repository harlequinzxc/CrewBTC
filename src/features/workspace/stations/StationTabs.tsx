import { useCallback, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import type { StationWorkspace } from '../../../types/station'

interface Props {
  readonly stations: readonly StationWorkspace[]
  readonly activeId: string
  readonly busy: boolean
  readonly onSwitch: (id: string) => void
  readonly onAdd: (name: string) => void
  readonly onRename: (id: string, name: string) => void
}

export function StationTabs({ stations, activeId, busy, onSwitch, onAdd, onRename }: Props) {
  const [editing, setEditing] = useState<string | null>(null)
  const [name, setName] = useState('')
  const cancelled = useRef(false)
  const tabs = useRef(new Map<string, HTMLButtonElement>())
  const focusInput = useCallback((node: HTMLInputElement | null) => { if (node !== null) { node.focus(); node.select() } }, [])
  const tabRef = (id: string) => (node: HTMLButtonElement | null) => { if (node === null) tabs.current.delete(id); else tabs.current.set(id, node) }
  const start = (station: StationWorkspace) => {
    cancelled.current = false
    setName(station.name)
    setEditing(station.id)
  }
  return <div className="flex h-8 shrink-0 items-center gap-0.5 overflow-x-auto border-b border-hairline bg-surface-canvas px-3" aria-label="Station workspaces">
    {stations.map((station) => {
      const active = station.id === activeId
      const isEditing = editing === station.id
      return <div key={station.id} className={`relative flex h-8 shrink-0 items-center justify-center border-b-2 ${isEditing ? '' : 'max-w-40'} ${active ? 'border-accent bg-surface-panel font-semibold text-ink-primary' : 'border-transparent text-ink-secondary'}`}>
        {isEditing ? <>
          <span aria-hidden="true" className="invisible whitespace-pre px-3 text-base leading-none tabular-nums">{name || '\u00a0'}</span>
          <input ref={focusInput} data-density="compact" aria-label={`Rename ${station.name}`} value={name} onChange={(event) => setName(event.target.value)} onBlur={() => { if (!cancelled.current && !busy) onRename(station.id, name); setEditing(null) }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === 'Escape') { if (event.key === 'Escape') cancelled.current = true; event.currentTarget.blur(); requestAnimationFrame(() => tabs.current.get(station.id)?.focus()) } }} className="absolute left-0 w-full appearance-none rounded border border-white/20 bg-surface-raised px-[11px] text-base font-[inherit] leading-none tabular-nums text-ink-primary outline-none" />
        </> :
          <button ref={tabRef(station.id)} type="button" data-target="dense" disabled={busy} aria-current={active ? 'page' : undefined} title={`${station.name} — double-click to rename`} onClick={() => onSwitch(station.id)} onDoubleClick={() => start(station)} className="inline-flex h-8 max-w-40 items-center justify-center truncate px-3 text-base leading-none tabular-nums hover:bg-surface-active focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50"><span className="truncate">{station.name}</span></button>}
      </div>
    })}
    <button type="button" data-target="dense" aria-label="New station" title="New station" disabled={busy} onClick={() => { const value = window.prompt('Name the new station'); if (value !== null) onAdd(value) }} className="inline-flex size-8 shrink-0 items-center justify-center rounded leading-none text-ink-secondary hover:bg-surface-active hover:text-ink-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50"><Plus aria-hidden className="size-4" /></button>
  </div>
}

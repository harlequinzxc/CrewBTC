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
  const start = (station: StationWorkspace) => { cancelled.current = false; setName(station.name); setEditing(station.id) }
  return <div className="flex h-9 shrink-0 items-stretch gap-0.5 overflow-x-auto border-b border-hairline bg-surface-canvas px-3" aria-label="Station workspaces">
    {stations.map((station) => editing === station.id ? <input key={station.id} ref={focusInput} aria-label={`Rename ${station.name}`} value={name} onChange={(event) => setName(event.target.value)} onFocus={(event) => event.currentTarget.select()} onBlur={() => { if (!cancelled.current && !busy) onRename(station.id, name); setEditing(null) }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === 'Escape') { if (event.key === 'Escape') cancelled.current = true; event.currentTarget.blur(); requestAnimationFrame(() => tabs.current.get(station.id)?.focus()) } }} className="my-1 w-32 shrink-0 rounded border border-hairline-strong bg-surface-panel px-2 text-base text-ink-primary focus:outline focus:outline-1 focus:outline-accent" /> :
      <button key={station.id} ref={tabRef(station.id)} type="button" data-target="dense" disabled={busy} aria-current={station.id === activeId ? 'page' : undefined} title={`${station.name} — double-click or press F2 to rename`} onClick={() => onSwitch(station.id)} onDoubleClick={() => start(station)} onKeyDown={(event) => { if (event.key === 'F2') { event.preventDefault(); start(station) } }} className={`relative min-h-8 max-w-40 shrink-0 truncate border-b-2 px-3 text-xs tabular-nums hover:bg-surface-active focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50 ${station.id === activeId ? 'border-accent bg-surface-panel font-semibold text-ink-primary' : 'border-transparent text-ink-secondary'}`}>{station.name}</button>)}
    <button type="button" data-target="dense" aria-label="New station" title="New station" disabled={busy} onClick={() => { const value = window.prompt('Name the new station'); if (value !== null) onAdd(value) }} className="my-0.5 grid size-8 shrink-0 place-items-center rounded text-ink-secondary hover:bg-surface-active hover:text-ink-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50"><Plus aria-hidden className="size-4" /></button>
  </div>
}

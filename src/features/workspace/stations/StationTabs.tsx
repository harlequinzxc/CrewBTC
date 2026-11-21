import type { StationWorkspace } from '../../../types/station'
interface Props {
  readonly stations: readonly StationWorkspace[]
  readonly activeId: string
  readonly busy: boolean
  readonly onSwitch: (id: string) => void
  readonly onAdd: (name: string) => void
  readonly onRename: (name: string) => void
}
const button = 'min-h-8 shrink-0 rounded px-3 text-xs text-ink-primary hover:bg-surface-active focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50'
export function StationTabs({ stations, activeId, busy, onSwitch, onAdd, onRename }: Props) {
  const active = stations.find((station) => station.id === activeId)
  return <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-hairline bg-surface-panel px-3" aria-label="Station workspaces">
    {stations.map((station) => <button key={station.id} type="button" data-target="dense" disabled={busy} aria-current={station.id === activeId ? 'page' : undefined} onClick={() => onSwitch(station.id)} className={`${button} ${station.id === activeId ? 'border-b-2 border-accent font-semibold' : ''}`}>{station.name}</button>)}
    <button type="button" data-target="dense" disabled={busy} onClick={() => { const name = window.prompt('Name the new station'); if (name !== null) onAdd(name) }} className={button}>+ New station</button>
    <button type="button" data-target="dense" disabled={busy} onClick={() => { const name = window.prompt('Rename this station', active?.name ?? ''); if (name !== null) onRename(name) }} className={button}>Rename station</button>
  </div>
}

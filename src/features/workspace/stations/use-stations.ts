import { useMemo, useState } from 'react'
import type { WorkspaceSnapshot } from '../../../types/persisted'
import { emptyStation } from '../../../types/station'
import type { StationWorkspace } from '../../../types/station'
import type { useBatch } from '../files/use-batch'
import type { useCards } from '../cards/use-cards'

const INITIAL = emptyStation('station-default', 'Station 1')

/** Station switching snapshots the live editor before replacing its batch and cards. */
export function useStations(snapshot: WorkspaceSnapshot | null, batch: ReturnType<typeof useBatch>, store: ReturnType<typeof useCards>) {
  const [stored, setStored] = useState<readonly StationWorkspace[]>([INITIAL])
  const [activeId, setActiveId] = useState(INITIAL.id)
  const [restored, setRestored] = useState<WorkspaceSnapshot | null>(null)
  if (snapshot !== null && snapshot !== restored) {
    setRestored(snapshot)
    setStored(snapshot.stations)
    setActiveId(snapshot.activeStationId)
  }
  const stations = useMemo(() => stored.map((station) => station.id === activeId
    ? { ...station, documents: batch.documents, cards: store.cards, activeId: batch.activeId }
    : station), [stored, activeId, batch.documents, batch.activeId, store.cards])
  const switchTo = (id: string) => {
    if (id === activeId || batch.busy) return
    const next = stations.find((station) => station.id === id)
    if (next === undefined) return
    setStored(stations)
    setActiveId(id)
    batch.replaceProject(next.documents, next.activeId)
    store.restoreCards(next.cards)
  }
  const add = (name: string) => {
    const trimmed = name.trim()
    if (!trimmed || batch.busy) return
    const next = emptyStation(crypto.randomUUID(), trimmed)
    setStored([...stations, next]); setActiveId(next.id)
    batch.replaceProject([], null); store.restoreCards({})
  }
  const replace = (next: readonly StationWorkspace[], selected: string) => {
    const station = next.find((item) => item.id === selected)
    if (station === undefined) return
    setStored(next); setActiveId(selected)
    batch.replaceProject(station.documents, station.activeId); store.restoreCards(station.cards)
  }
  const rename = (id: string, name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    setStored(stations.map((station) => station.id === id ? { ...station, name: trimmed } : station))
  }
  return { stations, activeId, switchTo, add, replace, rename }
}

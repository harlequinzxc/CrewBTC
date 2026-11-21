import { useRef } from 'react'
import { computeGrid } from '../../../lib/imposition/grid'
import { DEFAULT_SHEET } from '../../../types/imposition'
import type { SheetSettings } from '../../../types/imposition'
import type { useSheet } from '../sheet/use-sheet'
import type { useStations } from './use-stations'
import { rebaseStationCards } from './rebase-cards'

/** Keep the card's content attached to its page when sheet capacity changes. */
export function useSharedSheet(sheet: ReturnType<typeof useSheet>, stations: ReturnType<typeof useStations>) {
  const lastGrid = useRef(sheet.grid)
  const update = (patch: Partial<SheetSettings>) => {
    const nextGrid = computeGrid({ ...sheet.settings, ...patch })
    if (!nextGrid.isEmpty) {
      const next = stations.stations.map((station) => rebaseStationCards(station, lastGrid.current, nextGrid))
      if (next.some((station, index) => station !== stations.stations[index])) stations.replace(next, stations.activeId)
      lastGrid.current = nextGrid
    }
    sheet.update(patch)
  }
  const reset = () => update(DEFAULT_SHEET)
  const applied = (settings: SheetSettings) => { lastGrid.current = computeGrid(settings) }
  return { update, reset, applied }
}

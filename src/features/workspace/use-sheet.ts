import { useCallback, useEffect, useMemo, useState } from 'react'
import { DEFAULT_SHEET } from '../../types/imposition'
import type { SheetSettings } from '../../types/imposition'
import { computeGrid, validateSheet } from '../../lib/imposition/grid'
import type { GridLayout } from '../../types/imposition'

const STORAGE_KEY = 'crewbtc.sheet'

function readStored(): SheetSettings | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw === null) return null
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return null
    const candidate = parsed as Partial<SheetSettings>
    const merged: SheetSettings = { ...DEFAULT_SHEET, ...candidate }
    return validateSheet(merged).ok ? merged : null
  } catch {
    return null
  }
}

export interface SheetApi {
  readonly settings: SheetSettings
  readonly grid: GridLayout
  readonly errors: Readonly<Record<string, string>>
  readonly update: (patch: Partial<SheetSettings>) => void
  readonly reset: () => void
}

/** Sheet geometry lives here so the preview, the inspector, and the exporter agree. */
export function useSheet(): SheetApi {
  const [settings, setSettings] = useState<SheetSettings>(() => readStored() ?? DEFAULT_SHEET)

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    } catch {
      // Storage can be unavailable; the in-memory settings still drive this session.
    }
  }, [settings])

  const update = useCallback((patch: Partial<SheetSettings>) => {
    setSettings((current) => ({ ...current, ...patch }))
  }, [])

  const reset = useCallback(() => setSettings(DEFAULT_SHEET), [])

  const grid = useMemo(() => computeGrid(settings), [settings])
  const validation = useMemo(() => validateSheet(settings), [settings])

  return { settings, grid, errors: validation.errors, update, reset }
}

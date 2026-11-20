import { useCallback, useEffect, useState } from 'react'
import { readSettings, requestPersistence, writeSettings } from '../../lib/storage/db'
import { DEFAULT_PAGE_SETTINGS, normalisePageSettings } from '../../types/settings'
import type { PageSettings } from '../../types/settings'

/**
 * The document's preferences, restored on mount and written through on change.
 *
 * A record written by an older build carries trim and bleed it can no longer use, so the
 * read is normalised rather than trusted — an upgrade must never hand the interface a
 * `units` value it does not understand.
 */
export interface PageSettingsStore {
  readonly settings: PageSettings
  readonly update: (next: PageSettings) => void
}

export function usePageSettings(): PageSettingsStore {
  const [settings, setSettings] = useState<PageSettings>(DEFAULT_PAGE_SETTINGS)

  useEffect(() => {
    void (async () => {
      const previous = normalisePageSettings(await readSettings())
      setSettings(previous)
      await requestPersistence()
    })()
  }, [])

  const update = useCallback((next: PageSettings) => {
    setSettings(next)
    void writeSettings(next)
  }, [])

  return { settings, update }
}

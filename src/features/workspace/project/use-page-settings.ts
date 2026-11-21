import { useCallback, useEffect, useState } from 'react'
import { readSettings, requestPersistence, writeSettings } from '../../../lib/storage/db'
import { DEFAULT_PAGE_SETTINGS, normalisePageSettings } from '../../../types/settings'
import type { PageSettings } from '../../../types/settings'

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
    /*
      A flag rather than an abort: the read is a database round-trip, and a screen closed
      while it is in flight must not come back to set state on an unmounted component.
      React lets that call through to `dispatchSetState`, which reaches for `window` and
      throws where there is none — during test teardown, for instance. It surfaced as an
      intermittent "window is not defined" from this line, four tests into a suite it had
      nothing to do with.
    */
    let live = true
    void (async () => {
      const previous = normalisePageSettings(await readSettings())
      if (!live) return
      setSettings(previous)
      await requestPersistence()
    })()
    return () => {
      live = false
    }
  }, [])

  const update = useCallback((next: PageSettings) => {
    setSettings(next)
    void writeSettings(next)
  }, [])

  return { settings, update }
}

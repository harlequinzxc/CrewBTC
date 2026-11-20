import { useEffect, useState } from 'react'

const KEY = 'crewbtc.cut-guides'

/** Cut guides are a project setting; opening a project must survive the next reload. */
export function useCutGuides() {
  const [shown, setShown] = useState(() => {
    try { return window.localStorage.getItem(KEY) !== 'false' } catch { return true }
  })
  useEffect(() => {
    try { window.localStorage.setItem(KEY, String(shown)) } catch { /* storage unavailable */ }
  }, [shown])
  return [shown, setShown] as const
}

import { useEffect, useState } from 'react'
import { EMPTY_KEYWORDS, validKeywords } from '../../../types/format-keywords'
import type { Keywords } from '../../../types/format-keywords'

const KEY = 'crewbtc.format-keywords.v1'

export function useKeywords() {
  const [keywords, setKeywords] = useState<Keywords>(() => {
    try {
      const value: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? 'null')
      return validKeywords(value) ? value : EMPTY_KEYWORDS
    } catch { return EMPTY_KEYWORDS }
  })
  useEffect(() => {
    try { window.localStorage.setItem(KEY, JSON.stringify(keywords)) } catch { /* storage unavailable */ }
  }, [keywords])
  return [keywords, setKeywords] as const
}

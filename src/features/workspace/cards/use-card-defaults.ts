import { useCallback, useState } from 'react'
import type { CardBands } from '../../../types/card'

const KEY = 'crewbtc.card-bands.v1'
export const INITIAL_CARD_BANDS: CardBands = { headerMm: 8.56, footerMm: 35.45 }

function read(): CardBands {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (typeof value !== 'object' || value === null) return INITIAL_CARD_BANDS
    const candidate = value as Partial<CardBands>
    if (typeof candidate.headerMm !== 'number' || typeof candidate.footerMm !== 'number' ||
        !Number.isFinite(candidate.headerMm) || !Number.isFinite(candidate.footerMm) ||
        candidate.headerMm < 6 || candidate.footerMm < 6 || candidate.headerMm > 600 || candidate.footerMm > 600) return INITIAL_CARD_BANDS
    return { headerMm: candidate.headerMm, footerMm: candidate.footerMm }
  } catch { return INITIAL_CARD_BANDS }
}

export function useCardDefaults() {
  const [bands, setBands] = useState(read)
  const save = useCallback((next: CardBands) => {
    setBands(next)
    try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* Session remains usable. */ }
  }, [])
  return { bands, save, reset: () => save(INITIAL_CARD_BANDS) }
}

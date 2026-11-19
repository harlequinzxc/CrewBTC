import { useEffect, useState } from 'react'

/** SSR/test-safe media query hook. Falls back to `innerWidth` when `matchMedia`
 *  cannot answer (jsdom reports no media support, which would otherwise pin every
 *  breakpoint to `false`). */
export function useMediaQuery(query: string, fallbackWidthRem = 64): boolean {
  const evaluate = (): boolean => {
    if (typeof window === 'undefined') return false
    if (typeof window.matchMedia === 'function') {
      const result = window.matchMedia(query)
      if (typeof result.matches === 'boolean' && result.media !== '') return result.matches
    }
    return window.innerWidth >= fallbackWidthRem * 16
  }

  const [matches, setMatches] = useState<boolean>(evaluate)

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const mql = window.matchMedia(query)
    // Only subscribe here. Syncing on mount would be a synchronous setState inside an
    // effect; the initial value is already computed during render above.
    const onChange = (event: MediaQueryListEvent): void => setMatches(event.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])

  return matches
}

/** Matches Tailwind's `lg` breakpoint (64rem). */
export const DESKTOP_QUERY = '(min-width: 64rem)'

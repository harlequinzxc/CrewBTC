import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { readStoredReducedMotion, systemPrefersReducedMotion } from '../../lib/motion'
import { MotionContext } from './motion-context'
import type { MotionChoice, MotionContextValue } from './motion-context'

function resolveInitialChoice(): MotionChoice {
  const stored = readStoredReducedMotion()
  if (stored !== null) return stored ? 'on' : 'off'
  return systemPrefersReducedMotion() ? 'on' : 'off'
}

/** Single source of truth for `data-reduced-motion` (§3).
 *  A saved choice wins; otherwise the OS preference decides. */
export function MotionProvider({ children }: { readonly children: ReactNode }) {
  const [choice, setChoiceState] = useState<MotionChoice>(resolveInitialChoice)

  useEffect(() => { document.documentElement.dataset.reducedMotion = choice === 'on' ? 'true' : 'false' }, [choice])

  const setChoice = useCallback((next: MotionChoice) => {
    setChoiceState(next)
    try {
      window.localStorage.setItem('ps.reduced-motion', next)
    } catch {
      // Private mode can refuse writes; the in-memory state still applies.
    }
    document.documentElement.dataset.reducedMotion = next === 'on' ? 'true' : 'false'
  }, [])

  const value = useMemo<MotionContextValue>(
    () => ({ choice, reduced: choice === 'on', setChoice }),
    [choice, setChoice],
  )

  return <MotionContext.Provider value={value}>{children}</MotionContext.Provider>
}

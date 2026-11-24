import { useEffect, useState } from 'react'
import { isReducedMotion, MOTION } from '../../lib/motion'

/** Keep a closed surface mounted only for its bounded exit animation. */
export function useRetainedPresence(open: boolean): boolean {
  const [retained, setRetained] = useState(open)
  if (open && !retained) setRetained(true)
  useEffect(() => {
    if (open || !retained) return
    const timer = window.setTimeout(() => setRetained(false), isReducedMotion() ? 80 : MOTION.sheetExit)
    return () => window.clearTimeout(timer)
  }, [open, retained])
  return open || retained
}

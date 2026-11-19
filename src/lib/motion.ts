/**
 * Motion tokens (§3). Durations come from `index.css` `@theme` so the reduced-motion
 * override is the only thing that can change them at runtime.
 */
export const MOTION = {
  /** Micro-interactions: hover, press, focus. */
  micro: 150,
  /** Sheets, drawers, expansions — entering. */
  sheetEnter: 260,
  /** Exiting must never exceed entering. */
  sheetExit: 200,
  /** Hard ceiling for any standard UI transition. */
  ceiling: 350,
} as const

export const EASE = {
  micro: 'ease-out',
  sheet: 'cubic-bezier(0.32, 0.72, 0, 1)',
} as const

export type Phase = 'enter' | 'exit'

export interface Presence {
  /** Whether the node is currently mounted at all. */
  readonly mounted: boolean
  /** Whether it is animating out — styles should target the exit state. */
  readonly phase: Phase
}

export function isReducedMotion(): boolean {
  if (typeof document === 'undefined') return false
  return document.documentElement.dataset.reducedMotion === 'true'
}

export function readStoredReducedMotion(): boolean | null {
  try {
    const raw = window.localStorage.getItem(REDUCED_MOTION_KEY)
    if (raw === 'on') return true
    if (raw === 'off') return false
    return null
  } catch {
    return null
  }
}

export const REDUCED_MOTION_KEY = 'ps.reduced-motion'

export function systemPrefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Duration in ms for a phase, floored so exit never exceeds enter (§3). */
export function phaseDuration(phase: Phase): number {
  if (isReducedMotion()) return 0
  return phase === 'enter' ? MOTION.sheetEnter : MOTION.sheetExit
}

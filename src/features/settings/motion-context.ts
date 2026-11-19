import { createContext } from 'react'

export type MotionChoice = 'on' | 'off'

export interface MotionContextValue {
  readonly choice: MotionChoice
  readonly reduced: boolean
  readonly setChoice: (choice: MotionChoice) => void
}

/** Kept separate from the provider component so fast refresh stays component-only. */
export const MotionContext = createContext<MotionContextValue | null>(null)

import { useContext } from 'react'
import { MotionContext } from './motion-context'
import type { MotionContextValue } from './motion-context'

export function useMotion(): MotionContextValue {
  const value = useContext(MotionContext)
  if (value === null) {
    throw new Error('useMotion must be used inside <MotionProvider>')
  }
  return value
}

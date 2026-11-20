import { useEffect, useRef } from 'react'

/**
 * A wheel listener that can actually call `preventDefault`.
 *
 * React attaches `wheel` through its own delegation at the root, which is passive in
 * modern browsers — `preventDefault()` inside an `onWheel` handler is ignored, so the
 * page keeps scrolling or the browser keeps zooming underneath the gesture. Attaching the
 * listener directly with `{ passive: false }` is the only way to own it.
 *
 * Used twice: the sheet pane must not zoom the browser on Ctrl+wheel, and the photo must
 * not scroll or zoom the sheet while the photo is being framed.
 */
export function useNonPassiveWheel<T extends HTMLElement>(
  handler: (event: WheelEvent) => void,
  enabled = true,
): React.RefObject<T | null> {
  const ref = useRef<T | null>(null)
  // The handler closes over changing state, so it is read through a ref: re-binding the
  // listener on every render would drop scroll events mid-gesture.
  const handlerRef = useRef(handler)
  useEffect(() => {
    handlerRef.current = handler
  }, [handler])

  useEffect(() => {
    const element = ref.current
    if (element === null || !enabled) return

    const onWheel = (event: WheelEvent): void => handlerRef.current(event)
    element.addEventListener('wheel', onWheel, { passive: false })
    return () => element.removeEventListener('wheel', onWheel)
  }, [enabled])

  return ref
}

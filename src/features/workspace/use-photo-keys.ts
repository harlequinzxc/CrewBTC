import { useEffect, useRef } from 'react'

/**
 * Leaving adjust mode, and the keyboard that does it.
 *
 * Both effects read the callback through a ref: they subscribe once per editing session,
 * and re-subscribing mid-gesture would drop a `keydown` that arrived between renders.
 */
export function usePhotoDismissal(
  editing: boolean,
  onEndEdit: () => void,
  root: React.RefObject<HTMLDivElement | null>,
): void {
  const endEdit = useRef(onEndEdit)
  useEffect(() => {
    endEdit.current = onEndEdit
  }, [onEndEdit])

  useEffect(() => {
    if (!editing) return
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' && event.key !== 'Enter') return
      event.preventDefault()
      endEdit.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editing])

  // A press outside the box leaves adjust mode, as in any picture editor.
  useEffect(() => {
    if (!editing) return
    const onDown = (event: PointerEvent): void => {
      const node = root.current
      if (node !== null && !node.contains(event.target as Node)) endEdit.current()
    }
    document.addEventListener('pointerdown', onDown, true)
    return () => document.removeEventListener('pointerdown', onDown, true)
  }, [editing, root])
}

/**
 * Arrow keys move the photo, held down for shift to move it further.
 *
 * Returns the handler rather than subscribing, because the button owns the event and the
 * arrow keys must not scroll the sheet underneath.
 */
export function usePhotoNudge(
  editing: boolean,
  nudgeMm: number,
  move: (dxMm: number, dyMm: number) => void,
): (event: React.KeyboardEvent<HTMLButtonElement>) => void {
  const moveRef = useRef(move)
  useEffect(() => {
    moveRef.current = move
  }, [move])

  return (event) => {
    if (!editing) return
    const step = event.shiftKey ? nudgeMm * 4 : nudgeMm
    const moves: Record<string, readonly [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    }
    const delta = moves[event.key]
    if (delta === undefined) return
    event.preventDefault()
    moveRef.current(delta[0], delta[1])
  }
}

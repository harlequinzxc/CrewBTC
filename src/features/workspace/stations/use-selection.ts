import { useEffect, useRef, useState } from 'react'

/** Checkbox range selection and a dedicated mouse-drag handle; keyboard checkboxes stay native. */
export function useSelection(ids: readonly string[]) {
  const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set())
  const anchor = useRef<string | null>(null)
  const drag = useRef<boolean | null>(null)
  useEffect(() => {
    const stop = () => { drag.current = null }
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
    window.addEventListener('blur', stop)
    return () => { window.removeEventListener('pointerup', stop); window.removeEventListener('pointercancel', stop); window.removeEventListener('blur', stop) }
  }, [])
  const toggle = (items: readonly string[], checked: boolean) => setChosen((previous) => {
    const next = new Set(previous)
    for (const id of items) { if (checked) next.add(id); else next.delete(id) }
    return next
  })
  const select = (id: string, checked: boolean, shift: boolean) => {
    const start = anchor.current === null ? -1 : ids.indexOf(anchor.current)
    const end = ids.indexOf(id)
    if (shift && start >= 0 && end >= 0) toggle(ids.slice(Math.min(start, end), Math.max(start, end) + 1), checked)
    else { toggle([id], checked); anchor.current = id }
  }
  const startDrag = (id: string) => {
    const checked = !chosen.has(id)
    drag.current = checked
    anchor.current = id
    toggle([id], checked)
  }
  const enterDrag = (id: string, buttons: number) => {
    if (drag.current !== null && (buttons & 1) !== 0) toggle([id], drag.current)
  }
  return { chosen, toggle, select, startDrag, enterDrag }
}

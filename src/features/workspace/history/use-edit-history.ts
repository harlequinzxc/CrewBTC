import { useCallback, useEffect, useRef, useState } from 'react'
import type { Card } from '../../../types/card'
import type { SheetSettings } from '../../../types/imposition'

type Cards = Readonly<Record<string, Card>>
type Change = { kind: 'cards'; before: Cards; after: Cards } | { kind: 'sheet'; before: SheetSettings; after: SheetSettings }
type Entry = { change: Change; group: string | null; time: number }
const LIMIT = 80

// Immutable cards often share a large original image; compare shared references before
// descending so a keystroke never serializes the image into every history entry.
function same(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) return false
  const left = Object.keys(a), right = Object.keys(b)
  if (left.length !== right.length) return false
  const x = a as Record<string, unknown>, y = b as Record<string, unknown>
  return left.every((key) => Object.hasOwn(y, key) && same(x[key], y[key]))
}

/** Session-only action history. Project/station/document changes invalidate it. */
export function useEditHistory(applyCards: (cards: Cards) => void, applySheet: (sheet: SheetSettings) => void) {
  const stack = useRef<{ undo: Entry[]; redo: Entry[] }>({ undo: [], redo: [] })
  const actions = useRef({ applyCards, applySheet })
  const [counts, setCounts] = useState({ undo: 0, redo: 0 })
  const refresh = useCallback(() => setCounts({ undo: stack.current.undo.length, redo: stack.current.redo.length }), [])
  useEffect(() => { actions.current = { applyCards, applySheet } }, [applyCards, applySheet])
  const record = useCallback((change: Change, group: string | null = null) => {
    if (same(change.before, change.after)) return
    const now = Date.now(), prior = stack.current.undo.at(-1)
    if (group !== null && prior?.group === group && prior.change.kind === change.kind && now - prior.time < 1000) {
      prior.change = { ...change, before: prior.change.before } as Change
      prior.time = now
      if (same(prior.change.before, prior.change.after)) stack.current.undo.pop()
    } else {
      stack.current.undo.push({ change, group, time: now })
      if (stack.current.undo.length > LIMIT) stack.current.undo.shift()
    }
    stack.current.redo = []
    refresh()
  }, [refresh])
  const clear = useCallback(() => { stack.current = { undo: [], redo: [] }; refresh() }, [refresh])
  const breakGroup = useCallback(() => { const last = stack.current.undo.at(-1); if (last) last.group = null }, [])
  const move = useCallback((direction: 'undo' | 'redo') => {
    const from = stack.current[direction], to = stack.current[direction === 'undo' ? 'redo' : 'undo']
    const entry = from.pop()
    if (!entry) return
    entry.group = null
    const value = direction === 'undo' ? entry.change.before : entry.change.after
    if (entry.change.kind === 'cards') actions.current.applyCards(value as Cards)
    else actions.current.applySheet(value as SheetSettings)
    to.push(entry)
    refresh()
  }, [refresh])
  const undo = useCallback(() => move('undo'), [move])
  const redo = useCallback(() => move('redo'), [move])
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.defaultPrevented) return
      const target = event.target
      if (target instanceof HTMLElement && (target.isContentEditable || target.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]'))) return
      const key = event.key.toLowerCase()
      const isUndo = key === 'z' && !event.shiftKey
      const isRedo = (key === 'z' && event.shiftKey) || (key === 'y' && !event.shiftKey)
      if (!isUndo && !isRedo) return
      event.preventDefault()
      move(isUndo ? 'undo' : 'redo')
    }
    window.addEventListener('keydown', keydown)
    window.addEventListener('pointerup', breakGroup)
    window.addEventListener('pointercancel', breakGroup)
    return () => { window.removeEventListener('keydown', keydown); window.removeEventListener('pointerup', breakGroup); window.removeEventListener('pointercancel', breakGroup) }
  }, [move, breakGroup])
  return { record, clear, undo, redo, canUndo: counts.undo > 0, canRedo: counts.redo > 0 }
}

import { useCallback, useMemo, useState } from 'react'
import type { EditTarget, ImageTransform, PageEdit } from '../../types/edit'
import { DEFAULT_IMAGE_TRANSFORM, MAX_IMAGE_SCALE, MIN_IMAGE_SCALE, editKey } from '../../types/edit'

export interface EditsApi {
  readonly edits: Readonly<Record<string, PageEdit>>
  readonly setText: (target: EditTarget, text: string) => void
  readonly setImage: (target: EditTarget, image: ImageTransform) => void
  readonly resetCell: (cellIndex: number) => void
  readonly clear: () => void
}

const keepScale = (scale: number): number =>
  Math.min(MAX_IMAGE_SCALE, Math.max(MIN_IMAGE_SCALE, scale))

/** A blank record-shaped edit for a target, so updates never spread `undefined`. */
function seed(target: EditTarget): { readonly key: string; readonly edit: PageEdit } {
  return {
    key: editKey(target.cellIndex, target.documentId, target.pageNumber),
    edit: {
      documentId: target.documentId,
      pageNumber: target.pageNumber,
      image: DEFAULT_IMAGE_TRANSFORM,
      text: {},
    },
  }
}

/**
 * Owns per-cell edits. Deliberately a plain record rather than a store: the sheet is
 * small (12 cells), edits are sparse, and immutable updates keep React honest.
 */
export function useEdits(): EditsApi {
  const [edits, setEdits] = useState<Readonly<Record<string, PageEdit>>>({})

  const setText = useCallback((target: EditTarget, text: string) => {
    if (target.kind !== 'text') return
    setEdits((current) => {
      const { key, edit } = seed(target)
      const existing = current[key] ?? edit
      return { ...current, [key]: { ...existing, text: { ...existing.text, [target.blockId]: text } } }
    })
  }, [])

  const setImage = useCallback((target: EditTarget, image: ImageTransform) => {
    if (target.kind !== 'image') return
    setEdits((current) => {
      const { key, edit } = seed(target)
      const existing = current[key] ?? edit
      return {
        ...current,
        [key]: {
          ...existing,
          image: {
            offsetXMm: Number.isFinite(image.offsetXMm) ? image.offsetXMm : 0,
            offsetYMm: Number.isFinite(image.offsetYMm) ? image.offsetYMm : 0,
            scale: keepScale(image.scale),
          },
        },
      }
    })
  }, [])

  const resetCell = useCallback((cellIndex: number) => {
    setEdits((current) => {
      const next: Record<string, PageEdit> = {}
      for (const [key, value] of Object.entries(current)) {
        if (!key.startsWith(`${cellIndex}|`)) next[key] = value
      }
      return next
    })
  }, [])

  const clear = useCallback(() => setEdits({}), [])

  return useMemo(
    () => ({ edits, setText, setImage, resetCell, clear }),
    [edits, setText, setImage, resetCell, clear],
  )
}

/** Moves artwork by a delta, clamped so the page never leaves the cell entirely. */
export function nudgeTransform(
  transform: ImageTransform,
  delta: { readonly dxMm: number; readonly dyMm: number },
  bounds: { readonly cellWidthMm: number; readonly cellHeightMm: number },
): ImageTransform {
  const limitX = bounds.cellWidthMm
  const limitY = bounds.cellHeightMm
  const clamp = (value: number, limit: number): number =>
    Math.min(limit, Math.max(-limit, value))

  return {
    offsetXMm: clamp(transform.offsetXMm + delta.dxMm, limitX),
    offsetYMm: clamp(transform.offsetYMm + delta.dyMm, limitY),
    scale: keepScale(transform.scale),
  }
}

/** Scale step, exponential so every click feels the same at any zoom. */
export function zoomTransform(transform: ImageTransform, direction: 1 | -1): ImageTransform {
  const factor = direction === 1 ? 1.1 : 1 / 1.1
  return { ...transform, scale: keepScale(transform.scale * factor) }
}

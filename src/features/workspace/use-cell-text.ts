import { useCallback, useMemo, useState } from 'react'
import type { CellText, ImageTransform } from '../../types/edit'
import { imageKey, textKey } from '../../types/edit'

export interface CellTextApi {
  readonly texts: Readonly<Record<string, CellText>>
  readonly images: Readonly<Record<string, ImageTransform>>
  readonly setText: (cellIndex: number, documentId: string, pageNumber: number, text: string) => void
  readonly setImage: (
    cellIndex: number,
    documentId: string,
    pageNumber: number,
    image: ImageTransform,
  ) => void
  readonly resetImage: (cellIndex: number, documentId: string, pageNumber: number) => void
  readonly clear: () => void
}

/**
 * Owns what the user typed and how they framed each picture, keyed per cell so the
 * same page used twice can differ. A plain record: twelve cells, sparse edits, and
 * immutable updates keep React honest without a store.
 */
export function useCellText(): CellTextApi {
  const [texts, setTexts] = useState<Readonly<Record<string, CellText>>>({})
  const [images, setImages] = useState<Readonly<Record<string, ImageTransform>>>({})

  const setText = useCallback(
    (cellIndex: number, documentId: string, pageNumber: number, text: string) => {
      setTexts((current) => ({
        ...current,
        [textKey(cellIndex, documentId, pageNumber)]: { documentId, pageNumber, text },
      }))
    },
    [],
  )

  const setImage = useCallback(
    (cellIndex: number, documentId: string, pageNumber: number, image: ImageTransform) => {
      setImages((current) => ({
        ...current,
        [imageKey(cellIndex, documentId, pageNumber)]: {
          offsetXMm: Number.isFinite(image.offsetXMm) ? image.offsetXMm : 0,
          offsetYMm: Number.isFinite(image.offsetYMm) ? image.offsetYMm : 0,
          scale: Number.isFinite(image.scale) && image.scale > 0 ? image.scale : 1,
        },
      }))
    },
    [],
  )

  const resetImage = useCallback((cellIndex: number, documentId: string, pageNumber: number) => {
    setImages((current) => {
      const next = { ...current }
      delete next[imageKey(cellIndex, documentId, pageNumber)]
      return next
    })
  }, [])

  const clear = useCallback(() => {
    setTexts({})
    setImages({})
  }, [])

  return useMemo(
    () => ({ texts, images, setText, setImage, resetImage, clear }),
    [texts, images, setText, setImage, resetImage, clear],
  )
}


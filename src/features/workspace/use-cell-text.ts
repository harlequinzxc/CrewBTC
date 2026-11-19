import { useCallback, useMemo, useState } from 'react'
import type { CellText, ImageTransform, TextStyle } from '../../types/edit'
import { imageKey, textKey } from '../../types/edit'

export interface CellTextApi {
  readonly texts: Readonly<Record<string, CellText>>
  readonly images: Readonly<Record<string, ImageTransform>>
  /** True when the user has edited this page's copy, so the source must not override it. */
  readonly isTouched: (index: number) => boolean
  /** Fill from the source page. Refuses to overwrite anything the user typed. */
  readonly fillFromSource: (index: number, header: string, footer: string) => boolean
  readonly setText: (cellIndex: number, documentId: string, pageNumber: number, text: string) => void
  readonly setImage: (
    cellIndex: number,
    documentId: string,
    pageNumber: number,
    image: ImageTransform,
  ) => void
  readonly resetImage: (cellIndex: number, documentId: string, pageNumber: number) => void
  /** Per page index, per band. */
  readonly styles: Readonly<Record<string, TextStyle>>
  readonly setStyle: (index: number, band: 'header' | 'footer', style: TextStyle) => void
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
  const [touched, setTouched] = useState<Readonly<Record<string, true>>>({})
  const [styles, setStyles] = useState<Readonly<Record<string, TextStyle>>>({})

  const setStyle = useCallback(
    (index: number, band: 'header' | 'footer', style: TextStyle) => {
      setTouched((current) => ({ ...current, [`${index}`]: true }))
      setStyles((current) => ({ ...current, [`${index}|${band}`]: style }))
    },
    [],
  )

  const isTouched = useCallback((index: number) => touched[`${index}`] === true, [touched])

  const fillFromSource = useCallback(
    (index: number, header: string, footer: string) => {
      const text = [header, footer].filter((part) => part.trim() !== '').join('\n')
      if (text.trim() === '') return false

      let accepted = false
      setTexts((current) => {
        // A second line of defence behind `useAutoCopy`: never replace typed copy, even
        // if a caller asks. Both layers are tested.
        if (`${index}` in current) return current
        accepted = true
        return { ...current, [`${index}`]: { documentId: '', pageNumber: index + 1, text } }
      })
      return accepted
    },
    [],
  )

  const setText = useCallback(
    (cellIndex: number, documentId: string, pageNumber: number, text: string) => {
      setTouched((current) => ({ ...current, [`${cellIndex}`]: true }))
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
    setTouched({})
    setStyles({})
  }, [])

  return useMemo(
    () => ({
      texts,
      images,
      isTouched,
      fillFromSource,
      setText,
      setImage,
      resetImage,
      styles,
      setStyle,
      clear,
    }),
    [texts, images, isTouched, fillFromSource, setText, setImage, resetImage, styles, setStyle, clear],
  )
}


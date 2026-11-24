import { Scissors, Settings2, Undo2 } from 'lucide-react'
import { useState } from 'react'
import { DEFAULT_TOLERANCE } from '../../../lib/photo/cutout'
import { cutoutDataUrl } from '../../../lib/photo/cutout-image'
import type { PhotoSource } from '../../../types/card'

interface PhotoCutoutControlsProps {
  readonly photo: PhotoSource
  readonly onReplace: ((photo: PhotoSource) => void) | undefined
}

const BUTTON =
  'grid h-6 min-h-6 w-6 place-items-center rounded-sm bg-surface-panel/90 text-ink-primary shadow-md shadow-black/30 hover:bg-surface-active focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50'

/**
 * Remove the background behind a dish, and put it back.
 *
 * The cut is classical rather than modelled, so it is right on a plain plate and wrong on
 * a busy counter. That makes undo part of the feature instead of a nicety: the original
 * pixels are held here and restored exactly, and nothing is discarded until the user has
 * seen the result. The original lives in this component rather than in the card because a
 * rejected cut should not survive a reload as if it were the user's photo.
 */
export function PhotoCutoutControls({ photo, onReplace }: PhotoCutoutControlsProps) {
  const [sensitivity, setSensitivity] = useState(DEFAULT_TOLERANCE)
  const [showSensitivity, setShowSensitivity] = useState(false)
  const [message, setMessage] = useState('')
  const [cutting, setCutting] = useState(false)
  const [original, setOriginal] = useState<PhotoSource | null>(null)

  const cut = (): void => {
    if (cutting) return
    setCutting(true)
    setMessage('')
    void cutoutDataUrl((original ?? photo).dataUrl, { tolerance: sensitivity }).then((dataUrl) => {
      setCutting(false)
      // `null` means the fill found nothing to remove, or everything: either way the
      // honest result is to leave the photograph alone.
      if (dataUrl === null || dataUrl === '') {
        setMessage('No background removed. Try a different sensitivity.')
        return
      }
      setOriginal((current) => current ?? photo)
      onReplace?.({ ...photo, dataUrl })
    }).catch(() => {
      setCutting(false)
      setMessage('Could not remove the background.')
    })
  }

  return (
    <div className="absolute bottom-1 left-1 flex items-center gap-1">
      {message === '' ? null : <output className="absolute bottom-14 left-0 w-40 rounded-sm bg-surface-panel p-1 text-[10px] text-ink-primary">{message}</output>}
      {original === null ? null : (
        <button
          type="button"
          data-target="dense"
          aria-label="Put the original photo back"
          title="Undo the cut-out"
          disabled={cutting}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation()
            onReplace?.(original)
            setOriginal(null)
          }}
          className={BUTTON}
        >
          <Undo2 aria-hidden className="size-3.5" />
        </button>
      )}
      {showSensitivity ? (
        <label className="absolute bottom-7 left-0 flex items-center gap-1 rounded-sm bg-surface-panel px-1 text-[10px] text-ink-primary" onPointerDown={(event) => event.stopPropagation()}>
          Sensitivity
          <input aria-label="Background removal sensitivity" type="range" min="0" max="100" value={sensitivity} onChange={(event) => setSensitivity(Number(event.target.value))} className="w-16" />
          <span>{sensitivity}</span>
        </label>
      ) : null}
      <button type="button" data-target="dense" aria-expanded={showSensitivity} aria-label="Adjust background removal sensitivity" title="Adjust background removal sensitivity" className={BUTTON} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); setShowSensitivity((current) => !current) }}><Settings2 aria-hidden className="size-3.5" /></button>
      <button
        type="button"
        data-target="dense"
        aria-label="Remove the background"
        aria-busy={cutting}
        title="Remove the background behind the dish"
        disabled={cutting}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation()
          cut()
        }}
        className={BUTTON}
      >
        <Scissors aria-hidden className="size-3.5" />
      </button>
    </div>
  )
}

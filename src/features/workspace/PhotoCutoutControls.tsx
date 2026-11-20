import { Scissors, Undo2 } from 'lucide-react'
import { useState } from 'react'
import { cutoutDataUrl } from '../../lib/photo/cutout-image'
import type { PhotoSource } from '../../types/card'

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
  const [cutting, setCutting] = useState(false)
  const [original, setOriginal] = useState<PhotoSource | null>(null)

  const cut = (): void => {
    if (cutting) return
    setCutting(true)
    void cutoutDataUrl(photo.dataUrl).then((dataUrl) => {
      setCutting(false)
      // `null` means the fill found nothing to remove, or everything: either way the
      // honest result is to leave the photograph alone.
      if (dataUrl === null || dataUrl === '') return
      setOriginal((current) => current ?? photo)
      onReplace?.({ ...photo, dataUrl })
    })
  }

  return (
    <div className="absolute bottom-1 left-1 flex items-center gap-1">
      {original === null ? null : (
        <button
          type="button"
          data-target="dense"
          aria-label="Put the original photo back"
          title="Undo the cut-out"
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
      <button
        type="button"
        data-target="dense"
        aria-label="Remove the background"
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

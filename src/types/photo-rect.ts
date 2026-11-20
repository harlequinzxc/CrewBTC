import { DEFAULT_IMAGE_TRANSFORM, IMAGE_INSET_MM, MAX_IMAGE_SCALE, MIN_IMAGE_SCALE } from './card'
import type { ImageTransform, RectMm } from './card'

/**
 * Where a photo actually lands inside its box.
 *
 * Separated from the card model because it is geometry, not content: the preview and the
 * exporter both call these, and neither should have to import the whole card type to find
 * out how big a picture is.
 */

/**
 * The rectangle a photo is actually drawn at: fitted to the box, then zoomed, centred,
 * and finally offset by however far the user has dragged it.
 *
 * Fit, never cover: the scale comes from the photo's own pixels, so a dish keeps its
 * shape whatever shape the box happens to be. Returns null for a photo or box with no
 * area, so callers can say "nothing to draw" instead of drawing a zero.
 */
export function containRectMm(
  box: RectMm,
  photoWidthPx: number,
  photoHeightPx: number,
  transform: ImageTransform = DEFAULT_IMAGE_TRANSFORM,
  insetMm: number = IMAGE_INSET_MM,
): RectMm | null {
  if (
    box.widthMm <= 0 ||
    box.heightMm <= 0 ||
    photoWidthPx <= 0 ||
    photoHeightPx <= 0
  ) {
    return null
  }

  // A negative inset would push the photo outside its own box.
  const inset = Math.max(0, Math.min(insetMm, box.widthMm / 2, box.heightMm / 2))
  const roomWidth = Math.max(0.001, box.widthMm - inset * 2)
  const roomHeight = Math.max(0.001, box.heightMm - inset * 2)

  const fit = Math.min(roomWidth / photoWidthPx, roomHeight / photoHeightPx)
  const scale = Math.min(MAX_IMAGE_SCALE, Math.max(MIN_IMAGE_SCALE, transform.scale))

  const widthMm = photoWidthPx * fit * scale
  const heightMm = photoHeightPx * fit * scale

  // Centred on the *scaled* size, so zoom grows about the middle of the box rather
  // than pinning one corner.
  const xMm = box.xMm + (box.widthMm - widthMm) / 2 + transform.offsetXMm
  const yMm = box.yMm + (box.heightMm - heightMm) / 2 + transform.offsetYMm

  return { xMm, yMm, widthMm, heightMm }
}

/** The largest `widthPx:heightPx` rectangle that fits a box. Never stretched. */
export function fitInsideMm(
  boxWidthMm: number,
  boxHeightMm: number,
  widthPx: number,
  heightPx: number,
): { widthMm: number; heightMm: number } {
  if (widthPx <= 0 || heightPx <= 0) return { widthMm: boxWidthMm, heightMm: boxHeightMm }
  const factor = Math.min(boxWidthMm / widthPx, boxHeightMm / heightPx)
  return { widthMm: widthPx * factor, heightMm: heightPx * factor }
}

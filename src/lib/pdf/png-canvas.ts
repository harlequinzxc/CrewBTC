/** Enough for a 64 mm card at 300 dpi (756 px), with headroom for zooming. */
export const MAX_OUTPUT_SIDE_PX = 1200

/**
 * Paints RGB bytes into a canvas and reads back a PNG data URL.
 *
 * Oversized photos are scaled down first. A 4000 px scan encodes to megabytes of base64
 * that then has to sit in memory and in the exported file, for detail a 64 mm card cannot
 * show.
 */
export function encodePng(
  rgb: Uint8ClampedArray,
  width: number,
  height: number,
): string | null {
  try {
    const source = document.createElement('canvas')
    source.width = width
    source.height = height
    const sourceContext = source.getContext('2d')
    if (sourceContext === null) return null

    const imageData = sourceContext.createImageData(width, height)
    imageData.data.set(rgb)
    sourceContext.putImageData(imageData, 0, 0)

    const largest = Math.max(width, height)
    if (largest <= MAX_OUTPUT_SIDE_PX) return source.toDataURL('image/png')

    const factor = MAX_OUTPUT_SIDE_PX / largest
    const scaled = document.createElement('canvas')
    scaled.width = Math.max(1, Math.round(width * factor))
    scaled.height = Math.max(1, Math.round(height * factor))
    const scaledContext = scaled.getContext('2d')
    if (scaledContext === null) return source.toDataURL('image/png')

    scaledContext.imageSmoothingQuality = 'high'
    scaledContext.drawImage(source, 0, 0, scaled.width, scaled.height)
    return scaled.toDataURL('image/png')
  } catch {
    return null
  }
}

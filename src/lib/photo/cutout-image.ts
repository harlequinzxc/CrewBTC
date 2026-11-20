import { removeBackground, type CutoutOptions } from './cutout'

/**
 * The browser half of the cut-out: decode a data URL, run the fill, encode a PNG.
 *
 * Kept apart from the algorithm so the algorithm stays a pure function that a test can
 * drive without a canvas — which is what makes the interesting cases (a hole the border
 * cannot reach, a photo with nothing to remove) checkable at all.
 */

/**
 * Applies a removal and re-encodes as PNG, which keeps the alpha a JPEG would discard.
 *
 * `OffscreenCanvas` is used when present — it is the cheaper path and does not touch the
 * document — with a plain canvas as the fallback for older browsers.
 */
export async function cutoutDataUrl(dataUrl: string, options: CutoutOptions = {}): Promise<string | null> {
  const loaded = await loadPixels(dataUrl)
  if (loaded === null) return null
  const cleared = removeBackground(loaded.pixels, options)
  if (cleared === null) return null
  return encodePng(cleared)
}

interface LoadedPixels {
  readonly pixels: ImageData
  readonly width: number
  readonly height: number
}

function canvasPair(width: number, height: number): {
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
  canvas: HTMLCanvasElement | OffscreenCanvas
} | null {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height)
    const context = canvas.getContext('2d')
    if (context !== null) return { canvas, context }
  }
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  return context === null ? null : { canvas, context }
}

async function loadPixels(dataUrl: string): Promise<LoadedPixels | null> {
  const bitmap = await bitmapFrom(dataUrl)
  if (bitmap === null) return null
  const pair = canvasPair(bitmap.width, bitmap.height)
  if (pair === null) return null
  pair.context.drawImage(bitmap, 0, 0)
  return {
    pixels: pair.context.getImageData(0, 0, bitmap.width, bitmap.height),
    width: bitmap.width,
    height: bitmap.height,
  }
}

/**
 * Decodes a data URL to something drawable, two ways.
 *
 * `createImageBitmap` is the modern path and avoids the main thread's image cache. It is
 * absent in older browsers — and in the test environment, which is how the missing fallback
 * below was found: without it the whole feature silently returned `null` and did nothing,
 * which is the failure mode a user would report as "the button doesn't work".
 */
async function bitmapFrom(dataUrl: string): Promise<ImageBitmap | HTMLImageElement | null> {
  if (typeof createImageBitmap !== 'undefined') {
    try {
      const blob = await (await fetch(dataUrl)).blob()
      return await createImageBitmap(blob)
    } catch {
      // A decode failure falls through to the element, which may still succeed.
    }
  }
  if (typeof Image === 'undefined') return null
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => resolve(null)
    image.src = dataUrl
  })
}

async function encodePng(pixels: ImageData): Promise<string | null> {
  const pair = canvasPair(pixels.width, pixels.height)
  if (pair === null) return null
  pair.context.putImageData(pixels, 0, 0)
  if (pair.canvas instanceof OffscreenCanvas) {
    const blob = await pair.canvas.convertToBlob({ type: 'image/png' })
    return blobToDataUrl(blob)
  }
  return pair.canvas.toDataURL('image/png')
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
    reader.onerror = () => resolve('')
    reader.readAsDataURL(blob)
  })
}

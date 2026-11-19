import type { PDFPageProxy } from 'pdfjs-dist'

/**
 * Pulls the *embedded image* out of a recipe page, rather than re-rendering the page.
 *
 * A recipe card is a title, one dish photo, and an instruction box. Re-rendering the
 * page would put the title and the box into the picture band too, which is exactly
 * what the card layout is trying to avoid. So the page's operator list is walked for
 * image-paint operations and the largest real image object is decoded directly.
 *
 * Decoding is done through the operator list rather than by parsing content streams
 * because PDF.js has already resolved colour spaces, masks, and predictors by then.
 */

/** Keeps the check honest: an image has to look like a photo, not a bullet glyph. */
const MIN_SIDE_PX = 48
const MAX_SIDE_PX = 6000

export interface EmbeddedPhoto {
  /** PNG data URL, always RGB — never a mask, never a 1-bit stencil. */
  readonly dataUrl: string
  readonly widthPx: number
  readonly heightPx: number
  /** Where the image was drawn, normalised 0–1 against the page, top-left origin. */
  readonly box: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }
}

export interface DecodedImage {
  readonly kind: number
  readonly width: number
  readonly height: number
  /** Any byte view; PDF.js builds differ in the concrete type. */
  readonly data: ArrayBufferView
}

/**
 * PDF.js 6 hands back image data as an `ArrayBufferView` that is *not* a `Uint8Array`
 * instance in every build — checking `instanceof Uint8Array` silently rejects every
 * real photo. Any byte view of the right length is accepted instead.
 */
const isByteView = (value: unknown): value is ArrayBufferView =>
  ArrayBuffer.isView(value) && 'length' in value && typeof (value as { length: unknown }).length === 'number'

const isDecodedImage = (value: unknown): value is DecodedImage => {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<DecodedImage>
  return (
    typeof candidate.width === 'number' &&
    typeof candidate.height === 'number' &&
    typeof candidate.kind === 'number' &&
    isByteView(candidate.data)
  )
}

/** PDF.js ImageKind values; kept local so the module does not import its internals. */
const GRAYSCALE_1BPP = 1
const RGB_24BPP = 2
const RGBA_32BPP = 3

/**
 * Converts whatever PDF.js decoded into RGB bytes for a canvas.
 *
 * Exported because it is the part with real rules in it — alpha compositing, byte layout,
 * and refusing masks — and it is worth testing directly rather than through a page.
 */
export function toPlainRgb(image: DecodedImage): { rgb: Uint8ClampedArray; width: number; height: number } | null {
  const { width, height } = image
  // Normalise whatever view PDF.js returned into bytes before indexing it.
  const data = new Uint8Array(
    image.data.buffer as ArrayBuffer,
    image.data.byteOffset,
    image.data.byteLength,
  )
  if (width <= 0 || height <= 0) return null

  if (image.kind === RGB_24BPP && data.length >= width * height * 3) {
    return { width, height, rgb: new Uint8ClampedArray(data.subarray(0, width * height * 3)) }
  }

  if (image.kind === RGBA_32BPP && data.length >= width * height * 4) {
    const rgb = new Uint8ClampedArray(width * height * 3)
    for (let index = 0, target = 0; index < width * height * 4; index += 4, target += 3) {
      const alpha = (data[index + 3] ?? 255) / 255
      // Composite onto white: a transparent PNG is still a photo on paper.
      rgb[target] = Math.round((data[index] ?? 0) * alpha + 255 * (1 - alpha))
      rgb[target + 1] = Math.round((data[index + 1] ?? 0) * alpha + 255 * (1 - alpha))
      rgb[target + 2] = Math.round((data[index + 2] ?? 0) * alpha + 255 * (1 - alpha))
    }
    return { width, height, rgb }
  }

  // 1-bit stencils and exotic colour spaces are not dish photos; skipping them keeps
  // the "largest image wins" rule from picking a rule or a bullet.
  return null
}

/**
 * The largest embedded image on the page, as a PNG data URL.
 *
 * Returns null when the page has no usable raster image — a vector illustration, a
 * scan flattened to paths, or a text-only page. The caller falls back to cropping the
 * rendered page in that case, so a card is never left with an empty picture band.
 */
export async function extractEmbeddedPhoto(page: PDFPageProxy): Promise<EmbeddedPhoto | null> {
  try {
    const operatorList = await page.getOperatorList()
    const viewport = page.getViewport({ scale: 1 })

    // Every image id on the page, in paint order. Synthetic ids (`g_d0_f2`, `#000000`)
    // are fonts and colours, and are filtered out when they fail to resolve.
    const ids = new Set<string>()
    for (let index = 0; index < operatorList.fnArray.length; index += 1) {
      const args = operatorList.argsArray[index]
      if (!Array.isArray(args)) continue
      const objId = args[0]
      if (typeof objId === 'string') ids.add(objId)
    }

    // The worker delivers image data *after* the operator list resolves in a real
    // browser: `objs.has()` is false and `objs.get()` throws at this point. Reading
    // synchronously works only against a fake worker, which is why this looked correct
    // in a Node probe and still showed page renders in the app.
    const resolved = await Promise.all([...ids].map((objId) => resolveImage(page, objId)))

    let best: DecodedImage | null = null
    let bestArea = 0

    for (const image of resolved) {
      if (image === null) continue
      if (image.width < MIN_SIDE_PX || image.height < MIN_SIDE_PX) continue
      if (image.width > MAX_SIDE_PX || image.height > MAX_SIDE_PX) continue
      if (image.kind === GRAYSCALE_1BPP) continue

      const areaPx = image.width * image.height
      if (areaPx > bestArea) {
        best = image
        bestArea = areaPx
      }
    }

    if (best === null) return null

    const converted = toPlainRgb(best)
    if (converted === null) return null

    const dataUrl = encodePng(converted.rgb, converted.width, converted.height)
    if (dataUrl === null) return null

    // The drawn box is the image's own aspect, centred on the page. Exact placement is
    // not needed: the card's picture band covers and clips whatever it is given.
    const box = {
      x: 0.1,
      y: 0.15,
      width: 0.8,
      height: 0.6,
    }
    void viewport

    return { dataUrl, widthPx: converted.width, heightPx: converted.height, box }
  } catch {
    return null
  }
}

/**
 * Waits for one image object, however the build chooses to hand it over.
 *
 * Three shapes exist in practice: already resolved (read it), delivered later (use the
 * callback), or not an image at all (a font or colour name, so skip it). All are treated
 * as normal rather than as errors.
 */
const IMAGE_WAIT_MS = 4000

function resolveImage(page: PDFPageProxy, objId: string): Promise<DecodedImage | null> {
  const immediate = safeGet(page, objId)
  if (immediate !== null) return Promise.resolve(immediate)

  if (!page.objs.has(objId) && !looksLikeImageName(objId)) {
    // Not queued and not an image id: a font or colour, nothing will arrive.
    return Promise.resolve(null)
  }

  return new Promise<DecodedImage | null>((resolve) => {
    let settled = false
    const done = (value: DecodedImage | null): void => {
      if (settled) return
      settled = true
      resolve(value)
    }

    try {
      page.objs.get(
        objId,
        (value: unknown) => {
          if (isDecodedImage(value)) return done(value)
          const wrapped = (value as { data?: unknown } | null)?.data
          return done(isDecodedImage(wrapped) ? wrapped : null)
        },
        () => done(null),
      )
    } catch {
      return done(null)
    }

    // A page that never delivers must not stall an upload forever.
    setTimeout(() => done(null), IMAGE_WAIT_MS)
  })
}

/** PDF.js names real image objects `img_p<page>_<n>`; fonts and colours do not. */
function looksLikeImageName(objId: string): boolean {
  return /^img_/.test(objId)
}

/** Reads an image object when it is already resolved. Never throws. */
function safeGet(page: PDFPageProxy, objId: string): DecodedImage | null {
  try {
    if (!page.objs.has(objId)) return null
    const value: unknown = page.objs.get(objId)
    if (isDecodedImage(value)) return value
    // Some builds hand back the image wrapped in a promise-like result.
    const asRecord = value as { data?: unknown } | null
    if (asRecord !== null && isDecodedImage(asRecord?.data)) return asRecord.data
    return null
  } catch {
    return null
  }
}

/** Paints RGB bytes into a canvas and reads back a PNG data URL. jsdom returns null. */
function encodePng(rgb: Uint8ClampedArray, width: number, height: number): string | null {
  try {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (context === null) return null

    const imageData = context.createImageData(width, height)
    imageData.data.set(rgb)
    context.putImageData(imageData, 0, 0)

    return canvas.toDataURL('image/png')
  } catch {
    return null
  }
}

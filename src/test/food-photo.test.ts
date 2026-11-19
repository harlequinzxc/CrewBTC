import { describe, expect, it } from 'vitest'
import type { PDFPageProxy } from 'pdfjs-dist'
import { extractEmbeddedPhoto, toPlainRgb } from '../lib/pdf/food-photo'

/**
 * The picture band must show the dish photo, never a re-render of the page. These tests
 * fake the parts of PDF.js that matter — the operator list and the resolved image
 * objects — so the selection rule is checked without needing a real PDF.
 */

/** ImageKind values as PDF.js defines them. */
const GRAYSCALE_1BPP = 1
const RGB_24BPP = 2
const RGBA_32BPP = 3

function rgbImage(width: number, height: number): {
  kind: number
  width: number
  height: number
  data: Uint8Array
} {
  const data = new Uint8Array(width * height * 3)
  data.fill(120)
  return { kind: RGB_24BPP, width, height, data }
}

interface FakePageOptions {
  readonly ops: readonly { readonly id?: string; readonly args?: readonly unknown[] }[]
  readonly objects: Readonly<Record<string, unknown>>
}

function fakePage(options: FakePageOptions): PDFPageProxy {
  const fnArray = options.ops.map(() => 85) // OPS.paintImageXObject
  const argsArray = options.ops.map((op) => (op.args === undefined ? [] : [...op.args]))

  return {
    getOperatorList: async () => ({ fnArray, argsArray }),
    getViewport: () => ({ width: 420, height: 595 }),
    objs: {
      has: (id: string) => id in options.objects,
      get: (id: string) => {
        if (!(id in options.objects)) throw new Error('not resolved')
        return options.objects[id]
      },
    },
  } as unknown as PDFPageProxy
}

describe('choosing the dish photo', () => {
  it('takes the largest real image and ignores a tiny bullet graphic', () => {
    const page = fakePage({
      ops: [{ args: ['bullet'] }, { args: ['photo'] }],
      objects: { bullet: rgbImage(12, 12), photo: rgbImage(360, 260) },
    })
    return extractEmbeddedPhoto(page).then((photo) => {
      expect(photo?.widthPx).toBe(360)
      expect(photo?.heightPx).toBe(260)
    })
  })

  it('skips 1-bit stencils, which are masks and not photographs', () => {
    const stencil = { kind: GRAYSCALE_1BPP, width: 800, height: 600, data: new Uint8Array(60000) }
    const page = fakePage({
      ops: [{ args: ['mask'] }, { args: ['photo'] }],
      objects: { mask: stencil, photo: rgbImage(200, 150) },
    })
    return extractEmbeddedPhoto(page).then((photo) => {
      expect(photo?.widthPx).toBe(200)
    })
  })

  it('decodes a real image into a PNG the card can show', async () => {
    const page = fakePage({ ops: [{ args: ['p'] }], objects: { p: rgbImage(300, 200) } })
    const photo = await extractEmbeddedPhoto(page)

    expect(photo).not.toBeNull()
    expect(photo?.dataUrl.startsWith('data:image/png;base64,')).toBe(true)
    expect(photo?.widthPx).toBe(300)
    expect(photo?.heightPx).toBe(200)
  })

  it('returns null for a page with no embedded image at all', async () => {
    const page = fakePage({ ops: [], objects: {} })
    await expect(extractEmbeddedPhoto(page)).resolves.toBeNull()
  })

  it('returns null rather than throwing when PDF.js fails to decode', async () => {
    const page = {
      getOperatorList: async () => {
        throw new Error('broken page')
      },
    } as unknown as PDFPageProxy
    await expect(extractEmbeddedPhoto(page)).resolves.toBeNull()
  })

  it('returns null when the object is listed but never resolved', async () => {
    const page = fakePage({ ops: [{ args: ['late'] }], objects: {} })
    await expect(extractEmbeddedPhoto(page)).resolves.toBeNull()
  })

  it('never offers a data URL without real dimensions', async () => {
    const page = fakePage({ ops: [{ args: ['x'] }], objects: { x: { kind: 2 } } })
    await expect(extractEmbeddedPhoto(page)).resolves.toBeNull()
  })
})

describe('colour conversion', () => {
  it('copies RGB bytes through unchanged', () => {
    const converted = toPlainRgb({
      kind: RGB_24BPP,
      width: 2,
      height: 1,
      data: new Uint8Array([255, 0, 0, 0, 128, 255]),
    })
    expect(converted).not.toBeNull()
    expect(Array.from(converted?.rgb ?? [])).toEqual([255, 0, 0, 0, 128, 255])
  })

  it('composites a transparent pixel onto white rather than black', () => {
    const converted = toPlainRgb({
      kind: RGBA_32BPP,
      width: 2,
      height: 1,
      // Fully transparent, then fully opaque black.
      data: new Uint8Array([10, 20, 30, 0, 0, 0, 0, 255]),
    })
    expect(Array.from(converted?.rgb ?? [])).toEqual([255, 255, 255, 0, 0, 0])
  })

  it('composites a half-transparent mid-grey towards white', () => {
    const converted = toPlainRgb({
      kind: RGBA_32BPP,
      width: 1,
      height: 1,
      data: new Uint8Array([0, 0, 0, 128]),
    })
    const [red = -1] = Array.from(converted?.rgb ?? [])
    expect(red).toBeGreaterThan(120)
    expect(red).toBeLessThan(136)
  })

  it('extracts a photo whose bytes arrive as a Uint8ClampedArray (PDF.js 6)', async () => {
    // Regression: `data instanceof Uint8Array` rejected every real photo, because PDF.js
    // hands image bytes back as a Uint8ClampedArray. The type guard runs inside
    // `safeGet`, so the case has to go through the page, not just the converter.
    const clamped = new Uint8ClampedArray(64 * 64 * 3)
    clamped.fill(90)
    const page = fakePage({
      ops: [{ args: ['real'] }],
      objects: { real: { kind: RGB_24BPP, width: 64, height: 64, data: clamped } },
    })

    const photo = await extractEmbeddedPhoto(page)
    expect(photo).not.toBeNull()
    expect(photo?.widthPx).toBe(64)
  })

  it('accepts a byte view with a non-zero offset', async () => {
    const backing = new Uint8ClampedArray(64 * 64 * 3 + 8)
    backing.fill(70)
    const page = fakePage({
      ops: [{ args: ['sliced'] }],
      objects: { sliced: { kind: RGB_24BPP, width: 64, height: 64, data: backing.subarray(4, 4 + 64 * 64 * 3) } },
    })
    await expect(extractEmbeddedPhoto(page)).resolves.not.toBeNull()
  })

  it('refuses a 1-bit mask, which is not a photograph', () => {
    expect(
      toPlainRgb({ kind: GRAYSCALE_1BPP, width: 4, height: 4, data: new Uint8Array(16) }),
    ).toBeNull()
  })

  it('refuses a buffer too short for its stated size', () => {
    expect(toPlainRgb({ kind: RGB_24BPP, width: 10, height: 10, data: new Uint8Array(4) })).toBeNull()
  })
})

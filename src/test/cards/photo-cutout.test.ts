import { describe, expect, it } from 'vitest'
import { DEFAULT_TOLERANCE, cutoutPixels, type Pixels } from '../../lib/photo/cutout'

/**
 * jsdom has no `ImageData`, so the arrays are built by hand. That is also the point of
 * keeping the cut-out a pure function of a pixel buffer: the interesting behaviour — which
 * pixels go, which stay, what the edge does — is testable without a canvas or a browser.
 */
function image(width: number, height: number, pixel: (x: number, y: number) => [number, number, number]): Pixels {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4
      const [r, g, b] = pixel(x, y)
      data[i] = r
      data[i + 1] = g
      data[i + 2] = b
      data[i + 3] = 255
    }
  }
  return { data, width, height }
}

const alphaAt = (img: Pixels, x: number, y: number): number => img.data[(y * img.width + x) * 4 + 3] ?? -1

/** A white frame with a solid dark square in the middle, like a plate on a tablecloth. */
const plate = (): Pixels =>
  image(40, 40, (x, y) => (x >= 12 && x < 28 && y >= 12 && y < 28 ? [200, 40, 40] : [249, 249, 249]))

describe('removeBackground', () => {
  it('clears a plain background to transparency and keeps the subject opaque', () => {
    const result = cutoutPixels(plate())
    expect(result).not.toBeNull()
    const cleared = result as ImageData

    // Corner is background: fully transparent, not white.
    expect(alphaAt(cleared, 0, 0)).toBe(0)
    expect(alphaAt(cleared, 39, 39)).toBe(0)
    // Centre of the dish is untouched.
    expect(alphaAt(cleared, 20, 20)).toBe(255)
    const centre = (20 * cleared.width + 20) * 4
    expect(cleared.data[centre]).toBe(200)
    expect(cleared.data[centre + 1]).toBe(40)
  })

  it('leaves the source untouched, so a bad cut can be undone', () => {
    const source = plate()
    const before = Uint8ClampedArray.from(source.data)
    cutoutPixels(source)
    expect(Array.from(source.data)).toEqual(Array.from(before))
  })

  it('feathers the boundary rather than cutting a hard step', () => {
    const cleared = cutoutPixels(plate()) as ImageData
    // The ring at the dish's own edge keeps half alpha instead of dropping to zero.
    const ring = alphaAt(cleared, 11, 20)
    expect(ring).toBe(128)
  })

  it('does not reach a same-coloured island the border cannot flood to', () => {
    // Background colour inside the subject: a hole of tablecloth framed by the plate.
    const withHole = image(40, 40, (x, y) => {
      const inHole = x >= 18 && x < 22 && y >= 18 && y < 22
      const inPlate = x >= 12 && x < 28 && y >= 12 && y < 28
      if (inHole) return [249, 249, 249]
      return inPlate ? [200, 40, 40] : [249, 249, 249]
    })
    const cleared = cutoutPixels(withHole) as ImageData
    // The enclosed island is not connected to the frame, so it survives.
    expect(alphaAt(cleared, 20, 20)).toBe(255)
  })

  it('reports nothing to do instead of returning a blank or pointless image', () => {
    // One flat colour: the fill would take everything, which is not a cut.
    expect(cutoutPixels(image(20, 20, () => [250, 250, 250]))).toBeNull()
    // A border of colours the fill cannot seed from at all: with no tolerance nothing
    // matches the sampled background, so there is nothing to remove.
    const speckled = image(20, 20, (x, y) => [
      (x * 13 + 3) % 251,
      (y * 17 + 5) % 251,
      (x * y * 7 + 11) % 251,
    ])
    expect(cutoutPixels(speckled, { tolerance: 0 })).toBeNull()
  })

  it('refuses images too small to be a photograph', () => {
    expect(cutoutPixels(image(4, 4, () => [0, 0, 0]))).toBeNull()
  })

  it('handles a dish photographed on a tray: grey field, round plate', () => {
    // The everyday case, at the shape the fixture photo had (square, subject well inside).
    const tray = image(200, 200, (x, y) => {
      const dx = x - 100
      const dy = y - 100
      return dx * dx + dy * dy <= 55 * 55 ? [190, 40, 40] : [238, 238, 236]
    })
    const cleared = cutoutPixels(tray) as Pixels

    expect(alphaAt(cleared, 2, 2)).toBe(0)
    expect(alphaAt(cleared, 197, 197)).toBe(0)
    expect(alphaAt(cleared, 99, 99)).toBe(255)
    /*
      Nothing of the tray survives, and nothing of the plate is eaten — measured from the
      middle outwards. The boundary itself is ambiguous by design: the feather keeps half
      alpha on the ring, so the outermost plate pixels are neither fully there nor fully
      gone, which is the point.
    */
    let leaked = 0
    let eaten = 0
    for (let y = 0; y < 200; y += 1) {
      for (let x = 0; x < 200; x += 1) {
        const radius = Math.hypot(x - 100, y - 100)
        const alpha = alphaAt(cleared, x, y)
        if (radius < 50 && alpha !== 255) eaten += 1
        if (radius > 58 && alpha !== 0) leaked += 1
      }
    }
    expect(eaten).toBe(0)
    expect(leaked).toBe(0)
  })
})


describe('DEFAULT_TOLERANCE', () => {
  it('is a percentage the caller can pass straight through', () => {
    expect(DEFAULT_TOLERANCE).toBeGreaterThan(0)
    expect(DEFAULT_TOLERANCE).toBeLessThanOrEqual(100)
  })
})

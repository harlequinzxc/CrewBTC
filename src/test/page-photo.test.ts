import { createCanvas, loadImage } from '@napi-rs/canvas'
import { describe, expect, it } from 'vitest'
import { photoForPage, photoMap, photosForDocument } from '../lib/pdf/page-photo'
import {
  buildFlatCard,
  buildPdf,
  installDocument,
  open,
  pngSize,
} from './pdf-fixtures'

/**
 * Step 1: every page yields one dish photo.
 *
 * These run against a real PDF through the real PDF.js, because the failures that
 * mattered were all in the library's own behaviour — image data arriving late, and a
 * page whose photo is not an addressable image object.
 */

/** Counts real decoded pixels close to a colour. */
async function pixelsNear(dataUrl: string, hex: string): Promise<number> {
  const [r, g, b] = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16)) as [
    number,
    number,
    number,
  ]

  const binary = atob(dataUrl.split(',')[1] ?? '')
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  const decoded = await loadImage(bytes)

  const surface = createCanvas(decoded.width, decoded.height)
  const context = surface.getContext('2d')
  context.drawImage(decoded, 0, 0)
  const { width, height } = surface
  if (width === 0 || height === 0) return 0

  const data = context.getImageData(0, 0, width, height).data
  let hits = 0
  for (let index = 0; index < data.length; index += 4) {
    if (
      Math.abs((data[index] ?? 0) - r) < 24 &&
      Math.abs((data[index + 1] ?? 0) - g) < 24 &&
      Math.abs((data[index + 2] ?? 0) - b) < 24
    ) {
      hits += 1
    }
  }
  return hits
}

describe('a page with an embedded photo', () => {
  it('returns the embedded image', async () => {
    installDocument()
    const { doc, destroy } = await open(await buildPdf())

    const page = await doc.getPage(1)
    const photo = await photoForPage(page)
    await destroy()

    expect(photo).not.toBeNull()
    expect(photo?.source).toBe('embedded')
    expect(photo?.dataUrl.startsWith('data:image/png;base64,')).toBe(true)
  })

  it('keeps the photo at its own aspect, not the page’s', async () => {
    installDocument()
    const { doc, destroy } = await open(await buildPdf())

    const page = await doc.getPage(1)
    const photo = await photoForPage(page)
    await destroy()

    const size = pngSize(photo?.dataUrl ?? '')
    expect(size).not.toBeNull()
    // The photo was drawn 360x300, so a 6:5 image — not a 420x595 page.
    expect((size?.width ?? 0) / (size?.height ?? 1)).toBeCloseTo(1.2, 1)
  })
})

describe('a page whose photo is not an embedded image', () => {
  it('falls back to cropping the rendered page', async () => {
    // Text only, so there is nothing to decode as an image object. The fallback must
    // still produce a picture rather than "No image on this page".
    installDocument()
    const { doc, destroy } = await open(await buildPdf({ withEmbeddedImage: false, withText: true }))

    const page = await doc.getPage(1)
    const photo = await photoForPage(page)
    await destroy()

    expect(photo).not.toBeNull()
    expect(photo?.source).toBe('cropped')
  })

  it('crops the middle band, not the whole page', async () => {
    installDocument()
    const { doc, destroy } = await open(await buildPdf({ withEmbeddedImage: false, withText: true }))

    const page = await doc.getPage(1)
    const photo = await photoForPage(page)
    await destroy()

    const size = pngSize(photo?.dataUrl ?? '')
    expect(size).not.toBeNull()

    // Title at the top and two step lines at the bottom are carved away, so the crop is
    // shorter than the full 420x595 page.
    expect((size?.height ?? 0) / (size?.width ?? 1)).toBeLessThan(595 / 420)
  })
})

describe('a flattened card, where the whole page is one picture', () => {
  it('crops the card rather than handing back the whole page', async () => {
    installDocument()
    const { doc, destroy } = await open(await buildFlatCard())

    const page = await doc.getPage(1)
    const photo = await photoForPage(page)
    await destroy()

    expect(photo).not.toBeNull()
    expect(photo?.source).toBe('cropped')

    const size = pngSize(photo?.dataUrl ?? '')
    expect(size).not.toBeNull()
    // A whole-page image would be 420:595. The cropped dish is wider than it is tall.
    const ratio = (size?.width ?? 0) / (size?.height ?? 1)
    expect(ratio).toBeGreaterThan(1)
    expect(ratio).not.toBeCloseTo(420 / 595, 1)
  })

  it('leaves the title block out of the crop', async () => {
    installDocument()
    const { doc, destroy } = await open(await buildFlatCard())

    const page = await doc.getPage(1)
    const photo = await photoForPage(page)
    await destroy()

    // The title is a black bar near the top. The crop starts below it, so black pixels
    // should be far rarer than the dish's red.
    const black = await pixelsNear(photo?.dataUrl ?? '', '#111111')
    const red = await pixelsNear(photo?.dataUrl ?? '', '#c0392b')
    expect(red).toBeGreaterThan(0)
    expect(black).toBeLessThan(red)
  })
})

describe('every page of a document', () => {
  it('gives each page its own photo', async () => {
    installDocument()
    const { doc, destroy } = await open(await buildPdf({ pages: 3 }))

    const photos = await photosForDocument(doc)
    await destroy()

    expect(photos).toHaveLength(3)
    expect(photos.map((photo) => photo.pageNumber)).toEqual([1, 2, 3])
    // Each page has a different plate, so the encodings must differ.
    expect(new Set(photos.map((photo) => photo.dataUrl)).size).toBe(3)
  })

  it('maps them by page number, which is how a document stores them', async () => {
    installDocument()
    const { doc, destroy } = await open(await buildPdf({ pages: 2 }))

    const map = photoMap(await photosForDocument(doc))
    await destroy()

    expect(Object.keys(map).sort()).toEqual(['1', '2'])
    expect(Object.values(map).every((photo) => photo.dataUrl.startsWith('data:image/png'))).toBe(true)
    // The shape travels with the photo, which is what stops the card stretching it.
    expect(Object.values(map).every((photo) => photo.widthPx > 0 && photo.heightPx > 0)).toBe(true)
  })
})

describe('what must never happen', () => {
  it('never returns the whole page as the photo', async () => {
    installDocument()
    const { doc, destroy } = await open(await buildPdf())

    const page = await doc.getPage(1)
    const photo = await photoForPage(page)
    await destroy()

    const size = pngSize(photo?.dataUrl ?? '')
    // A full-page render would be 420:595. The photo is not that.
    const pageRatio = 420 / 595
    expect((size?.width ?? 0) / (size?.height ?? 1)).not.toBeCloseTo(pageRatio, 2)
  })

  it('has real colour in it, not a blank canvas', async () => {
    installDocument()
    const { doc, destroy } = await open(await buildPdf())

    const page = await doc.getPage(1)
    const photo = await photoForPage(page)
    await destroy()

    expect(await pixelsNear(photo?.dataUrl ?? '', '#8e44ad')).toBeGreaterThan(0)
  })
})

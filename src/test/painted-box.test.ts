import { describe, expect, it, vi } from 'vitest'
import { MIDDLE_BAND, paintedBoxOf, photoMiddleOf } from '../lib/pdf/painted-box'
import type { PDFPageProxy } from 'pdfjs-dist'

/**
 * Recovering where a photo sits on its page.
 *
 * This is what decides which text is a dish name and which is an instruction, so a
 * wrong answer here silently moves a title into the steps. The maths is PDF matrix
 * multiplication, which is easy to get subtly wrong and impossible to see in a
 * screenshot.
 */

/** pdf.js operator codes used by the walker. */
const SAVE = 10
const RESTORE = 11
const TRANSFORM = 12
const PAINT = 85

function fakePage(script: readonly (readonly [number, unknown])[]): PDFPageProxy {
  return {
    getOperatorList: async () => ({
      fnArray: script.map(([fn]) => fn),
      argsArray: script.map(([, args]) => args),
    }),
  } as unknown as PDFPageProxy
}

const VIEWPORT = { width: 100, height: 200 }

describe('finding the painted rectangle', () => {
  it('maps an untransformed paint of the whole page onto the whole page', async () => {
    const page = fakePage([[PAINT, ['img_1', 1, 1]]])
    const box = await paintedBoxOf(page, 'img_1', VIEWPORT)

    // No `cm` before it: the unit square, i.e. one point, not the page.
    expect(box.x).toBeCloseTo(0, 6)
    expect(box.width).toBeCloseTo(1 / 100, 6)
  })

  it('reads a placement matrix as a page fraction', async () => {
    // A 40 x 100 pt image drawn 10 pt from the left and 20 pt from the bottom.
    const page = fakePage([
      [TRANSFORM, [40, 0, 0, 100, 10, 20]],
      [PAINT, ['img_1', 1, 1]],
    ])
    const box = await paintedBoxOf(page, 'img_1', VIEWPORT)

    expect(box.x).toBeCloseTo(0.1, 6)
    expect(box.width).toBeCloseTo(0.4, 6)
    expect(box.height).toBeCloseTo(0.5, 6)
    // PDF measures from the bottom; this reports from the top.
    // Bottom edge is 20 pt up, 100 pt tall, on a 200 pt page: top is at 120 pt from
    // the bottom, so 80 pt from the top.
    expect(box.y).toBeCloseTo(0.4, 6)
  })

  it('respects the save/restore stack', async () => {
    const page = fakePage([
      [SAVE, null],
      [TRANSFORM, [50, 0, 0, 50, 0, 0]],
      [RESTORE, null],
      [PAINT, ['img_1', 1, 1]],
    ])
    const box = await paintedBoxOf(page, 'img_1', VIEWPORT)

    // The transform was discarded by the restore, so this is the unit square again.
    expect(box.width).toBeCloseTo(1 / 100, 6)
  })

  it('composes nested transforms', async () => {
    const page = fakePage([
      [TRANSFORM, [2, 0, 0, 2, 0, 0]],
      [TRANSFORM, [10, 0, 0, 10, 0, 0]],
      [PAINT, ['img_1', 1, 1]],
    ])
    const box = await paintedBoxOf(page, 'img_1', VIEWPORT)
    expect(box.width).toBeCloseTo(20 / 100, 6)
  })

  it('ignores a different image being painted first', async () => {
    // Real pdf.js wraps each image in save/restore, so placements do not leak between
    // them. This models that shape rather than a bare sequence of transforms.
    const page = fakePage([
      [SAVE, null],
      [TRANSFORM, [10, 0, 0, 10, 0, 0]],
      [PAINT, ['img_other', 1, 1]],
      [RESTORE, null],
      [SAVE, null],
      [TRANSFORM, [60, 0, 0, 10, 0, 0]],
      [PAINT, ['img_1', 1, 1]],
      [RESTORE, null],
    ])
    const box = await paintedBoxOf(page, 'img_1', VIEWPORT)
    expect(box.width).toBeCloseTo(0.6, 6)
  })

  it('matches a real PDF’s placement', async () => {
    // The operator sequence pdf.js actually emits for a 120x90 image drawn at (40,400)
    // on a 400x600 page: translate, identity, scale, identity. Composing these the
    // wrong way round puts the image at 4800 pt instead of 40 — silently, no error.
    const page = fakePage([
      [SAVE, null],
      [TRANSFORM, [1, 0, 0, 1, 40, 400]],
      [TRANSFORM, [1, 0, 0, 1, 0, 0]],
      [TRANSFORM, [120, 0, 0, 90, 0, 0]],
      [TRANSFORM, [1, 0, 0, 1, 0, 0]],
      [PAINT, ['img_p0_1', 120, 90]],
      [RESTORE, null],
    ])
    const box = await paintedBoxOf(page, 'img_p0_1', { width: 400, height: 600 })

    expect(box.x).toBeCloseTo(40 / 400, 6)
    expect(box.width).toBeCloseTo(120 / 400, 6)
    expect(box.height).toBeCloseTo(90 / 600, 6)
    // Top edge is 490 pt up the page, i.e. 110 pt down from the top.
    expect(box.y).toBeCloseTo(110 / 600, 6)
  })

  it('falls back to the middle band when the image is never painted', async () => {
    const page = fakePage([[PAINT, ['img_other', 1, 1]]])
    expect(await paintedBoxOf(page, 'img_1', VIEWPORT)).toEqual(MIDDLE_BAND)
  })

  it('falls back rather than throwing when the page cannot be read', async () => {
    const page = { getOperatorList: vi.fn().mockRejectedValue(new Error('boom')) }
    expect(await paintedBoxOf(page as unknown as PDFPageProxy, 'img_1', VIEWPORT)).toEqual(
      MIDDLE_BAND,
    )
  })
})

describe('the split point for the text', () => {
  it('is the middle of the photo, not the middle of the page', async () => {
    // Photo occupies the top half of the page: its middle is at 0.25.
    const page = fakePage([
      [TRANSFORM, [100, 0, 0, 100, 0, 100]],
      [PAINT, ['img_1', 1, 1]],
    ])
    expect(await photoMiddleOf(page, 'img_1', VIEWPORT)).toBeCloseTo(0.25, 6)
  })

  it('is the page middle when the page has no photo', async () => {
    const page = fakePage([])
    expect(await photoMiddleOf(page, null, VIEWPORT)).toBe(0.5)
  })

  it('stays inside the page however odd the placement', async () => {
    const page = fakePage([
      [TRANSFORM, [100, 0, 0, 100, 0, -500]],
      [PAINT, ['img_1', 1, 1]],
    ])
    const middle = await photoMiddleOf(page, 'img_1', VIEWPORT)
    expect(middle).toBeGreaterThanOrEqual(0)
    expect(middle).toBeLessThanOrEqual(1)
  })
})

describe('the split follows the photo, not the page', () => {
  it('keeps text that sits above a low photo in the header', async () => {
    // The case that motivates all of this: a photo in the lower half of the page, with
    // dish notes between the title and the photo. Splitting at the page middle would
    // turn those notes into instruction steps; splitting at the photo keeps them as
    // part of the title block, where they belong.
    const { splitRecipeText } = await import('../lib/pdf/recipe-text')
    const lines = [
      { text: 'CHK-07', top: 0.05, bottom: 0.08, x: 0 },
      { text: 'Low Photo Dish', top: 0.09, bottom: 0.12, x: 0 },
      { text: 'Served with jasmine rice', top: 0.58, bottom: 0.61, x: 0 },
      { text: '1. Plate it', top: 0.85, bottom: 0.88, x: 0 },
    ]

    const aroundPhoto = splitRecipeText(lines, 0.65)
    expect(aroundPhoto.header).toContain('Served with jasmine rice')
    expect(aroundPhoto.footer).toContain('Plate it')

    // The old behaviour, for contrast: the note becomes a step.
    const atMiddle = splitRecipeText(lines, 0.5)
    expect(atMiddle.footer).toContain('jasmine rice')
  })
})

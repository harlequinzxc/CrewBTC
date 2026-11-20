import { describe, expect, it } from 'vitest'
import {
  cardZones,
  clampBands,
  containRectMm,
  defaultBands,
  PICTURE_MIN_MM,
  BAND_MIN_MM,
} from '../types/card'
import type { RectMm } from '../types/card'

/**
 * A card is three zones that tile its cell exactly: top text, photo, bottom text.
 *
 * These are the numbers the preview and the exporter both work from, so a mistake here
 * is a mistake on paper.
 */

const CELL: RectMm = { xMm: 4, yMm: 17, widthMm: 64, heightMm: 90 }

describe('the three zones tile the cell', () => {
  const bands = { headerMm: 13, footerMm: 20 }
  const zones = cardZones(CELL, bands)

  it('stacks header, picture and footer with no gaps', () => {
    expect(zones.header.yMm).toBe(CELL.yMm)
    expect(zones.picture.yMm).toBe(zones.header.yMm + zones.header.heightMm)
    expect(zones.footer.yMm).toBe(zones.picture.yMm + zones.picture.heightMm)
  })

  it('fills the cell exactly, top to bottom', () => {
    const total = zones.header.heightMm + zones.picture.heightMm + zones.footer.heightMm
    expect(total).toBeCloseTo(CELL.heightMm, 9)
    expect(zones.footer.yMm + zones.footer.heightMm).toBeCloseTo(CELL.yMm + CELL.heightMm, 9)
  })

  it('gives the photo whatever the two text boxes leave', () => {
    expect(zones.picture.heightMm).toBeCloseTo(CELL.heightMm - 13 - 20, 9)
  })

  it('gives every zone the full cell width', () => {
    for (const zone of [zones.header, zones.picture, zones.footer]) {
      expect(zone.xMm).toBe(CELL.xMm)
      expect(zone.widthMm).toBe(CELL.widthMm)
    }
  })

  it('never overlaps, whatever the bands', () => {
    for (const headerMm of [0, 5, 30, 60]) {
      for (const footerMm of [0, 5, 30, 60]) {
        const z = cardZones(CELL, { headerMm, footerMm })
        expect(z.picture.yMm).toBeGreaterThanOrEqual(z.header.yMm + z.header.heightMm - 1e-9)
        expect(z.footer.yMm).toBeGreaterThanOrEqual(z.picture.yMm + z.picture.heightMm - 1e-9)
      }
    }
  })
})

describe('bands are tuned per card, within limits', () => {
  it('keeps a sane default split for a 90 mm cell', () => {
    const bands = defaultBands(90)
    expect(bands.headerMm).toBeGreaterThan(BAND_MIN_MM)
    expect(bands.footerMm).toBeGreaterThan(bands.headerMm)
    // Still leaves the photo the majority of the card.
    expect(90 - bands.headerMm - bands.footerMm).toBeGreaterThan(40)
  })

  it('stops the header from eating the whole card', () => {
    const clamped = clampBands({ headerMm: 200, footerMm: 20 }, 90)
    expect(clamped.headerMm).toBeLessThanOrEqual(90 - PICTURE_MIN_MM)
  })

  it('stops the two boxes from squeezing the photo out', () => {
    const clamped = clampBands({ headerMm: 60, footerMm: 60 }, 90)
    const picture = 90 - clamped.headerMm - clamped.footerMm
    expect(picture).toBeGreaterThanOrEqual(PICTURE_MIN_MM - 1e-9)
  })

  it('refuses a negative or absurdly small band', () => {
    const clamped = clampBands({ headerMm: -10, footerMm: 0 }, 90)
    expect(clamped.headerMm).toBeGreaterThanOrEqual(BAND_MIN_MM)
    expect(clamped.footerMm).toBeGreaterThanOrEqual(BAND_MIN_MM)
  })
})

describe('the photo inside its box', () => {
  const box: RectMm = { xMm: 4, yMm: 30, widthMm: 64, heightMm: 57 }

  it('keeps a 4:3 photo 4:3', () => {
    const rect = containRectMm(box, 400, 300)!
    expect(rect.widthMm / rect.heightMm).toBeCloseTo(4 / 3, 6)
  })

  it('keeps a tall photo tall instead of filling the box', () => {
    const rect = containRectMm(box, 300, 500)!
    expect(rect.widthMm / rect.heightMm).toBeCloseTo(3 / 5, 6)
    expect(rect.heightMm).toBeLessThanOrEqual(box.heightMm)
  })

  it('leaves the inset as padding on the binding axis', () => {
    const rect = containRectMm(box, 400, 300)!
    // 4:3 is wider than this box is tall, so width is the constrained axis.
    expect(rect.widthMm).toBeCloseTo(box.widthMm - 1.6, 6)
  })

  it('starts centred', () => {
    const rect = containRectMm(box, 400, 300)!
    expect(rect.xMm + rect.widthMm / 2).toBeCloseTo(box.xMm + box.widthMm / 2, 6)
    expect(rect.yMm + rect.heightMm / 2).toBeCloseTo(box.yMm + box.heightMm / 2, 6)
  })

  it('moves by exactly the offset it is given', () => {
    const centred = containRectMm(box, 400, 300)!
    const moved = containRectMm(box, 400, 300, { offsetXMm: 3, offsetYMm: -2, scale: 1 })!
    expect(moved.xMm - centred.xMm).toBeCloseTo(3, 6)
    expect(moved.yMm - centred.yMm).toBeCloseTo(-2, 6)
  })

  it('keeps its shape when zoomed', () => {
    const zoomed = containRectMm(box, 400, 300, { offsetXMm: 0, offsetYMm: 0, scale: 3 })!
    expect(zoomed.widthMm / zoomed.heightMm).toBeCloseTo(4 / 3, 6)
  })

  it('returns nothing for a box or photo with no area', () => {
    expect(containRectMm({ ...box, widthMm: 0 }, 400, 300)).toBeNull()
    expect(containRectMm(box, 0, 300)).toBeNull()
  })
})

describe('clampBands keeps the picture alive', () => {
  /**
   * Exhaustive, because the bug this replaces only showed up for some inputs: the old
   * implementation clamped the header and then the footer, so a large header could still
   * leave a 6 mm photo. Sampling the range would have missed it.
   */
  it('never lets the photo fall below its minimum, for any pair of requests', () => {
    const height = 67
    for (let header = -5; header <= height + 5; header += 0.5) {
      for (let footer = -5; footer <= height + 5; footer += 0.5) {
        const clamped = clampBands({ headerMm: header, footerMm: footer }, height)
        const picture = height - clamped.headerMm - clamped.footerMm
        expect(picture).toBeGreaterThanOrEqual(PICTURE_MIN_MM - 1e-9)
        expect(clamped.headerMm).toBeGreaterThanOrEqual(BAND_MIN_MM)
        expect(clamped.footerMm).toBeGreaterThanOrEqual(BAND_MIN_MM)
      }
    }
  })

  it('never lets the zones overflow the cell', () => {
    for (let header = 0; header <= 200; header += 5) {
      for (let footer = 0; footer <= 200; footer += 5) {
        const clamped = clampBands({ headerMm: header, footerMm: footer }, 67)
        expect(clamped.headerMm + clamped.footerMm).toBeLessThanOrEqual(67 - PICTURE_MIN_MM + 1e-9)
      }
    }
  })

  it('leaves a request that already fits completely alone', () => {
    expect(clampBands({ headerMm: 10, footerMm: 15 }, 67)).toEqual({ headerMm: 10, footerMm: 15 })
    expect(clampBands({ headerMm: 30, footerMm: 20 }, 67)).toEqual({ headerMm: 30, footerMm: 20 })
  })

  it('splits the overflow proportionally rather than starving one box', () => {
    const clamped = clampBands({ headerMm: 40, footerMm: 40 }, 67)
    // Both asked for the same excess, so both end up the same size.
    expect(clamped.headerMm).toBeCloseTo(clamped.footerMm, 2)
  })
})

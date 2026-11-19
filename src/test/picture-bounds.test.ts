import { describe, expect, it } from 'vitest'
import {
  pictureBoundsFromText,
  textBounds,
  WHOLE_PAGE,
} from '../lib/pdf/picture-bounds'

/**
 * The picture box must hold picture, not the source page's typography. These tests are
 * about the crop maths, with the same normalised convention the extractor uses.
 */
const page = { w: 520, h: 670 } // a 52 x 67 mm card, in points

/** One text item at a given fraction of the page, the shape PDF.js reports. */
function item(
  at: { x: number; y: number; w?: number; h?: number },
  text = 'words',
): { transform: number[]; width: number; height: number; str: string } {
  const heightPt = (at.h ?? 0.05) * page.h
  return {
    // [a, b, c, d, e, f] with f measured from the bottom of the page.
    transform: [1, 0, 0, heightPt, at.x * page.w, (1 - at.y) * page.h - heightPt],
    width: (at.w ?? 0.6) * page.w,
    height: heightPt,
    str: text,
  }
}

describe('finding the text on a page', () => {
  it('returns null when there is no text at all', () => {
    expect(textBounds([], page.w, page.h)).toBeNull()
    expect(textBounds([{ transform: [1, 0, 0, 10, 5, 5], width: 40, height: 10, str: '   ' }], page.w, page.h)).toBeNull()
  })

  it('surrounds every text item', () => {
    const bounds = textBounds(
      [item({ x: 0.1, y: 0.05 }), item({ x: 0.1, y: 0.9 })],
      page.w,
      page.h,
    )
    expect(bounds).not.toBeNull()
    expect(bounds!.y).toBeCloseTo(0.05, 5)
    expect(bounds!.y + bounds!.height).toBeCloseTo(0.95, 5)
    expect(bounds!.x).toBeCloseTo(0.1, 5)
  })

  it('refuses nonsense page dimensions instead of dividing by zero', () => {
    expect(textBounds([item({ x: 0.1, y: 0.1 })], 0, page.h)).toBeNull()
  })
})

describe('cropping to the picture', () => {
  it('keeps the whole page when there is no text to avoid', () => {
    expect(pictureBoundsFromText(null)).toEqual(WHOLE_PAGE)
  })

  it('keeps the clear band below text that sits at the top', () => {
    // Text occupies the top 20%; the picture is the 80% beneath it.
    const bounds = pictureBoundsFromText({ x: 0.05, y: 0, width: 0.9, height: 0.2 })
    expect(bounds.cropped).toBe(true)
    expect(bounds.y).toBeCloseTo(0.2, 5)
    expect(bounds.height).toBeCloseTo(0.8, 5)
  })

  it('keeps the clear band above text that sits at the bottom', () => {
    const bounds = pictureBoundsFromText({ x: 0.05, y: 0.75, width: 0.9, height: 0.25 })
    expect(bounds.cropped).toBe(true)
    expect(bounds.y).toBe(0)
    expect(bounds.height).toBeCloseTo(0.75, 5)
  })

  it('falls back to the whole page when text covers it edge to edge', () => {
    // Nothing clear to crop to: a full-page crop is better than a sliver.
    expect(pictureBoundsFromText({ x: 0, y: 0.02, width: 1, height: 0.96 })).toEqual(WHOLE_PAGE)
  })

  it('takes whichever clear side is larger, not simply the bottom', () => {
    // Text low on the card: the big clear area is ABOVE it, so the crop takes the top.
    const bounds = pictureBoundsFromText({ x: 0, y: 0.7, width: 1, height: 0.28 })
    expect(bounds.cropped).toBe(true)
    expect(bounds.y).toBe(0)
    expect(bounds.height).toBeCloseTo(0.7, 5)
  })

  it('takes the bottom when the text is high and the gap below is bigger', () => {
    const bounds = pictureBoundsFromText({ x: 0, y: 0.03, width: 1, height: 0.1 })
    expect(bounds.y).toBeCloseTo(0.13, 5)
    expect(bounds.height).toBeCloseTo(0.87, 5)
  })
})

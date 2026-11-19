import { describe, expect, it } from 'vitest'
import {
  formatSteps,
  splitRecipeText,
  stripStepMarker,
  toLines,
} from '../lib/pdf/recipe-text'

/** A 420 x 595 pt page, the shape of a recipe sheet. */
const W = 420
const H = 595

/** Builds a PDF.js-shaped text item at a fraction of the page from the top. */
function item(text: string, at: { x: number; top: number }, sizePt = 12): {
  str: string
  transform: number[]
  width: number
  height: number
} {
  return {
    str: text,
    transform: [1, 0, 0, sizePt, at.x * W, (1 - at.top) * H - sizePt],
    width: text.length * sizePt * 0.5,
    height: sizePt,
  }
}

describe('reading lines off the page', () => {
  it('joins items that share a baseline into one line', () => {
    const lines = toLines(
      [item('JCL', { x: 0.1, top: 0.08 }), item('- BNAPD', { x: 0.25, top: 0.08 })],
      W,
      H,
    )
    expect(lines).toHaveLength(1)
    expect(lines[0]?.text).toBe('JCL - BNAPD')
  })

  it('orders lines top to bottom however the items arrive', () => {
    const lines = toLines(
      [item('third', { x: 0.1, top: 0.5 }), item('first', { x: 0.1, top: 0.1 })],
      W,
      H,
    )
    expect(lines.map((line) => line.text)).toEqual(['first', 'third'])
  })

  it('ignores empty items and nonsense dimensions', () => {
    expect(toLines([item('   ', { x: 0.1, top: 0.1 })], W, H)).toHaveLength(0)
    expect(toLines([item('x', { x: 0.1, top: 0.1 })], 0, H)).toHaveLength(0)
  })
})

describe('splitting into header and footer', () => {
  const page = [
    item('JCL - BNAPD - BTC', { x: 0.1, top: 0.06 }, 16),
    item('Ayam Percik dan Nasi Ulam', { x: 0.1, top: 0.11 }, 13),
    item('1. Grill the chicken until charred', { x: 0.1, top: 0.72 }, 9),
    item('2. Plate with nasi ulam', { x: 0.1, top: 0.78 }, 9),
    item('3. Garnish with torch ginger', { x: 0.1, top: 0.84 }, 9),
  ]

  it('puts the title block in the header', () => {
    const result = splitRecipeText(toLines(page, W, H))
    expect(result.header).toBe('JCL - BNAPD - BTC\nAyam Percik dan Nasi Ulam')
  })

  it('turns the numbered instructions into bullets', () => {
    const result = splitRecipeText(toLines(page, W, H))
    expect(result.footer).toBe(
      ['• Grill the chicken until charred', '• Plate with nasi ulam', '• Garnish with torch ginger'].join(
        '\n',
      ),
    )
  })

  it('splits around the photo, not at a fixed midpoint', () => {
    // Photo low on the page: the title runs to 45% and is still a title.
    const lowPhoto = [
      item('Title', { x: 0.1, top: 0.1 }),
      item('Still title', { x: 0.1, top: 0.44 }),
      item('Step', { x: 0.1, top: 0.85 }),
    ]
    const result = splitRecipeText(toLines(lowPhoto, W, H), 0.6)
    expect(result.header).toContain('Still title')
    expect(result.footer).toBe('• Step')
  })

  it('reports empty for a page with no words at all', () => {
    const result = splitRecipeText([])
    expect(result.empty).toBe(true)
    expect(result.header).toBe('')
    expect(result.footer).toBe('')
  })

  it('keeps a page whose text is all below the photo', () => {
    const belowOnly = toLines([item('Step one', { x: 0.1, top: 0.8 })], W, H)
    const result = splitRecipeText(belowOnly, 0.5)
    // Nothing is silently dropped: the header takes the first line if the top is bare.
    expect(result.header).toBe('Step one')
    expect(result.empty).toBe(false)
  })
})

describe('cleaning up step lines', () => {
  it('strips numbers, bullets and dashes', () => {
    expect(stripStepMarker('1. Grill')).toBe('Grill')
    expect(stripStepMarker('2) Grill')).toBe('Grill')
    expect(stripStepMarker('• Grill')).toBe('Grill')
    expect(stripStepMarker('- Grill')).toBe('Grill')
    expect(stripStepMarker('* Grill')).toBe('Grill')
  })

  it('leaves an unnumbered line alone', () => {
    expect(stripStepMarker('Grill the chicken')).toBe('Grill the chicken')
  })

  it('drops punctuation-only lines such as a box rule', () => {
    expect(formatSteps(['|', '1. Grill', '——', '2. Plate'])).toBe('• Grill\n• Plate')
  })

  it('returns nothing when there are no steps', () => {
    expect(formatSteps([])).toBe('')
  })
})

import { describe, expect, it } from 'vitest'
import { computeGrid } from '../lib/imposition/grid'
import { DEFAULT_SHEET } from '../types/imposition'
import {
  cellZones,
  coverRectMm,
  DEFAULT_IMAGE_TRANSFORM,
  splitCellText,
} from '../types/edit'
import { layoutBand, MIN_BAND_TEXT_PT } from '../lib/export/text-band'

/**
 * The card is three contiguous bands. These assertions are about arithmetic that both
 * the preview and the exporter depend on, so a bug here would print wrong, not just
 * look wrong.
 */
const grid = computeGrid(DEFAULT_SHEET)
const cell = grid.cells[0]!
const bands = {
  headerMm: DEFAULT_SHEET.headerMm,
  pictureMm: DEFAULT_SHEET.cellHeightMm - DEFAULT_SHEET.headerMm - DEFAULT_SHEET.footerMm,
  footerMm: DEFAULT_SHEET.footerMm,
}

describe('the three bands fill the card', () => {
  it('adds up to the cell height exactly, leaving no unused space', () => {
    const zones = cellZones(cell.rect, bands)
    const total = zones.headerMm + zones.pictureMm + zones.footerMm
    expect(total).toBeCloseTo(cell.rect.heightMm, 6)
  })

  it('stacks header, picture and footer with no overlap', () => {
    const zones = cellZones(cell.rect, bands)
    expect(zones.header.yMm).toBe(cell.rect.yMm)
    expect(zones.picture.yMm).toBeCloseTo(zones.header.yMm + zones.header.heightMm, 6)
    expect(zones.footer.yMm).toBeCloseTo(zones.picture.yMm + zones.picture.heightMm, 6)
    expect(zones.footer.yMm + zones.footer.heightMm).toBeCloseTo(
      cell.rect.yMm + cell.rect.heightMm,
      6,
    )
  })

  it('stretches the bands when the cell grows, rather than leaving a gap', () => {
    const tall = { ...cell.rect, heightMm: cell.rect.heightMm * 2 }
    const zones = cellZones(tall, bands)
    expect(zones.headerMm + zones.pictureMm + zones.footerMm).toBeCloseTo(tall.heightMm, 6)
  })

  it('never yields a negative picture band', () => {
    const zones = cellZones(cell.rect, { headerMm: 50, pictureMm: 0, footerMm: 50 })
    expect(zones.pictureMm).toBeGreaterThanOrEqual(0)
    expect(zones.footerMm).toBeGreaterThanOrEqual(0)
  })
})

describe('the picture covers its box', () => {
  const box = { xMm: 0, yMm: 10, widthMm: 52, heightMm: 44 }

  it('fills the box completely for a portrait source', () => {
    const rect = coverRectMm(box, 52, 67, DEFAULT_IMAGE_TRANSFORM)
    expect(rect).not.toBeNull()
    // Cover means at least as large as the box on both axes.
    expect(rect!.widthMm).toBeGreaterThanOrEqual(box.widthMm - 1e-9)
    expect(rect!.heightMm).toBeGreaterThanOrEqual(box.heightMm - 1e-9)
  })

  it('fills the box for a wide source too', () => {
    const rect = coverRectMm(box, 200, 40, DEFAULT_IMAGE_TRANSFORM)
    expect(rect!.widthMm).toBeGreaterThanOrEqual(box.widthMm - 1e-9)
    expect(rect!.heightMm).toBeGreaterThanOrEqual(box.heightMm - 1e-9)
  })

  it('is centred before any offset is applied', () => {
    const rect = coverRectMm(box, 52, 67, DEFAULT_IMAGE_TRANSFORM)!
    const centreX = rect.xMm + rect.widthMm / 2
    const centreY = rect.yMm + rect.heightMm / 2
    expect(centreX).toBeCloseTo(box.xMm + box.widthMm / 2, 6)
    expect(centreY).toBeCloseTo(box.yMm + box.heightMm / 2, 6)
  })

  it('moves exactly as far as it is told', () => {
    const base = coverRectMm(box, 52, 67, DEFAULT_IMAGE_TRANSFORM)!
    const moved = coverRectMm(box, 52, 67, { offsetXMm: 5, offsetYMm: -3, scale: 1 })!
    expect(moved.xMm - base.xMm).toBeCloseTo(5, 6)
    expect(moved.yMm - base.yMm).toBeCloseTo(-3, 6)
  })

  it('scales about the centre, so zooming does not drift', () => {
    const base = coverRectMm(box, 52, 67, DEFAULT_IMAGE_TRANSFORM)!
    const zoomed = coverRectMm(box, 52, 67, { offsetXMm: 0, offsetYMm: 0, scale: 2 })!
    expect(zoomed.widthMm).toBeCloseTo(base.widthMm * 2, 6)
    expect(zoomed.xMm + zoomed.widthMm / 2).toBeCloseTo(base.xMm + base.widthMm / 2, 6)
  })

  it('refuses a source with no measurable size instead of guessing', () => {
    expect(coverRectMm(box, 0, 67, DEFAULT_IMAGE_TRANSFORM)).toBeNull()
    expect(coverRectMm(box, 52, Number.NaN, DEFAULT_IMAGE_TRANSFORM)).toBeNull()
  })
})

describe('splitting pasted copy', () => {
  it('takes the first line as the header and the rest as the footer', () => {
    expect(splitCellText('Limited Edition\nHand-numbered\n2026')).toEqual({
      header: 'Limited Edition',
      footer: 'Hand-numbered\n2026',
    })
  })

  it('treats a single line as a header only', () => {
    expect(splitCellText('Just a title')).toEqual({ header: 'Just a title', footer: '' })
  })

  it('skips leading blank lines rather than making an empty header', () => {
    expect(splitCellText('\n\nReal header\nfooter')).toEqual({
      header: 'Real header',
      footer: 'footer',
    })
  })

  it('returns nothing for whitespace, so an empty box prints no text', () => {
    expect(splitCellText('   \n\n  ')).toEqual({ header: '', footer: '' })
  })
})

describe('band text shrinks to fit', () => {
  // 6 pt per character at size 10: crude but monotonic, which is all the wrapper needs.
  const measure = (text: string, sizePt: number): number => text.length * sizePt * 0.6

  it('keeps type at its maximum when there is room', () => {
    const layout = layoutBand('Hi', 0, 52, 11, 11, 1.18, measure)
    expect(layout.lines).toHaveLength(1)
    expect(layout.lines[0]?.sizePt).toBeCloseTo(11, 6)
    expect(layout.overflow).toBe(false)
  })

  it('wraps a long line instead of running past the card edge', () => {
    const layout = layoutBand(
      'a much longer header than fits on one short line',
      0,
      52,
      11,
      11,
      1.18,
      measure,
    )
    expect(layout.lines.length).toBeGreaterThan(1)
    for (const line of layout.lines) {
      expect(measure(line.text, line.sizePt)).toBeLessThanOrEqual(52 + 1e-6)
    }
  })

  it('shrinks rather than overflowing a short band', () => {
    const layout = layoutBand('Three\nshort\nlines', 0, 52, 5, 11, 1.18, measure)
    expect(layout.lines.every((line) => line.sizePt >= MIN_BAND_TEXT_PT - 1e-9)).toBe(true)
    const bottom = Math.max(...layout.lines.map((line) => line.yMm))
    expect(bottom).toBeLessThanOrEqual(5 + 1e-6)
  })

  it('reports overflow instead of printing over the picture', () => {
    const many = Array.from({ length: 40 }, (_unused, index) => `line ${index}`).join('\n')
    const layout = layoutBand(many, 0, 52, 4, 8, 1.18, measure)
    expect(layout.overflow).toBe(true)
    expect(layout.lines.length).toBeGreaterThan(0)
  })

  it('draws nothing for empty copy', () => {
    const layout = layoutBand('   ', 0, 52, 11, 11, 1.18, measure)
    expect(layout.lines).toHaveLength(0)
    expect(layout.overflow).toBe(false)
  })
})

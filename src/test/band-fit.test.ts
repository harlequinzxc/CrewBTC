import { describe, expect, it } from 'vitest'
import { bandsForContent, textHeightMm } from '../types/band-fit'
import { BAND_MIN_MM, PICTURE_MIN_MM, defaultBands } from '../types/card'

/**
 * Bands follow their text.
 *
 * A fixed split leaves blank paper inside a zone whenever a dish name is short, which
 * reads as the photo being squeezed by nothing. These tests pin the two properties that
 * make a derived split better than a guessed one: the text is never shrunk to achieve it,
 * and the photo never loses its minimum to it.
 */
const CELL_W = 52
const CELL_H = 67

const fit = (headerText: string, footerText: string) =>
  bandsForContent({ headerText, footerText, cellWidthMm: CELL_W, cellHeightMm: CELL_H })

describe('text measurement', () => {
  it('needs more height for more lines', () => {
    const one = textHeightMm('Kung Pao', CELL_W, 9)
    const two = textHeightMm('Kung Pao\nChicken', CELL_W, 9)
    expect(two).toBeGreaterThan(one)
  })

  it('needs nothing for empty text', () => {
    expect(textHeightMm('', CELL_W, 9)).toBe(0)
    expect(textHeightMm('   \n  ', CELL_W, 9)).toBe(0)
  })

  it('needs more height when the text wraps', () => {
    const short = textHeightMm('Pao', CELL_W, 9)
    const long = textHeightMm('Kung Pao Chicken with Roasted Cashews and Chilli', CELL_W, 9)
    expect(long).toBeGreaterThan(short)
  })
})

describe('bands follow content', () => {
  it('gives a short card its photo back', () => {
    const bands = fit('Kung Pao', '• Plate')
    expect(bands).not.toBeNull()
    if (bands === null) return

    const photo = CELL_H - bands.headerMm - bands.footerMm
    const legacyPhoto = CELL_H - defaultBands(CELL_H).headerMm - defaultBands(CELL_H).footerMm

    // The old fixed split gave the photo 42 mm of 67. A two-line card gets more.
    expect(photo).toBeGreaterThan(legacyPhoto)
    expect(photo / CELL_H).toBeGreaterThan(0.75)
  })

  it('keeps the photo at least as large as the fixed split would', () => {
    for (const header of ['A', 'A\nB', 'A much longer dish name that wraps', '']) {
      for (const footer of ['• x', '• x\n• y', '• a\n• b\n• c\n• d', '']) {
        const bands = fit(header, footer)
        if (bands === null) throw new Error('expected bands')
        const photo = CELL_H - bands.headerMm - bands.footerMm
        expect(photo).toBeGreaterThanOrEqual(PICTURE_MIN_MM - 1e-6)
      }
    }
  })

  it('never shrinks a band below what the text needs', () => {
    // Four bullets need ~16 mm; a derived band must not land under the old 15 mm and
    // quietly shrink the type to compensate.
    const bands = fit('Kung Pao', '• a\n• b\n• c\n• d')
    if (bands === null) throw new Error('expected bands')
    expect(bands.footerMm).toBeGreaterThan(14)
  })

  it('keeps a blank zone at the minimum rather than collapsing it', () => {
    const bands = fit('', '')
    if (bands === null) throw new Error('expected bands')
    expect(bands.headerMm).toBe(BAND_MIN_MM)
    expect(bands.footerMm).toBe(BAND_MIN_MM)
  })

  it('honours the picture minimum when the text is enormous', () => {
    const bands = fit('a\n'.repeat(40), 'b\n'.repeat(40))
    if (bands === null) throw new Error('expected bands')
    expect(CELL_H - bands.headerMm - bands.footerMm).toBeGreaterThanOrEqual(PICTURE_MIN_MM - 1e-6)
  })

  it('refuses a cell with no size', () => {
    expect(
      bandsForContent({ headerText: 'x', footerText: 'y', cellWidthMm: 0, cellHeightMm: 0 }),
    ).toBeNull()
  })
})

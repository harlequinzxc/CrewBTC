import { describe, expect, it } from 'vitest'
import { UNITS, fromMm, toMm } from '../../lib/units'

/**
 * A unit is how a length is read, never what is stored.
 *
 * Every dimension in the model and in the exported PDF is millimetres. These tests pin
 * the two properties that keep a unit switch from changing a document: converting out and
 * back is the identity in the units that divide evenly (mm, cm), and switching units never
 * touches the stored value at all.
 */
describe('unit conversion', () => {
  it('reads 210 mm as 21 cm and as 8.268 in', () => {
    expect(fromMm(210, 'mm')).toBe(210)
    expect(fromMm(210, 'cm')).toBe(21)
    expect(fromMm(210, 'in')).toBe(8.268)
  })

  it('reads a small length without losing it', () => {
    // 6 mm is the band minimum; it must read as 0.6 cm, not 1 cm or 0.
    expect(fromMm(6, 'cm')).toBe(0.6)
    expect(fromMm(6, 'mm')).toBe(6)
    expect(fromMm(25.4, 'in')).toBe(1)
  })

  it('converts back exactly for units that divide millimetres evenly', () => {
    for (const mm of [210, 297, 52, 67, 4, 6, 10, 15.5]) {
      expect(toMm(fromMm(mm, 'mm'), 'mm')).toBe(mm)
      expect(toMm(fromMm(mm, 'cm'), 'cm')).toBe(mm)
    }
  })

  it('is lossless across a switch and back', () => {
    for (const mm of [210, 297, 52, 67, 4]) {
      expect(toMm(fromMm(mm, 'cm'), 'cm')).toBe(mm)
    }
  })

  it('keeps a value typed in centimetres at exact millimetres', () => {
    expect(toMm(21, 'cm')).toBe(210)
    expect(toMm(0.6, 'cm')).toBe(6)
    expect(toMm(2.54, 'cm')).toBe(25.4)
    expect(toMm(1, 'in')).toBe(25.4)
  })

  it('rounds to hundredths of a millimetre, never finer', () => {
    // 8.27 in is 210.058 mm; print tolerance is nowhere near that, and float noise in a
    // stored dimension is worse than a rounded one.
    expect(toMm(8.27, 'in')).toBe(210.06)
    expect(toMm(1, 'in')).toBe(25.4)
  })

  it('drops trailing zeros so a field reads as a number, not a spreadsheet', () => {
    expect(String(fromMm(210, 'cm'))).toBe('21')
    expect(String(fromMm(25.4, 'in'))).toBe('1')
    expect(String(fromMm(25, 'in'))).toBe('0.984')
  })

  it('gives each unit the step that matches its size', () => {
    // A tap in centimetres must move a whole millimetre, not a fifth of one.
    expect(UNITS.cm.step * UNITS.cm.mm).toBeCloseTo(1, 6)
    expect(UNITS.mm.step).toBe(0.5)
    expect(UNITS.in.step * UNITS.in.mm).toBeCloseTo(1.27, 6)
  })

  it('names each unit the way the dropdown shows it', () => {
    expect(UNITS.mm.label).toBe('Millimetres (mm)')
    expect(UNITS.cm.label).toBe('Centimetres (cm)')
    expect(UNITS.in.label).toBe('Inches (in)')
  })
})

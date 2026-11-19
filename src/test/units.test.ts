import { describe, expect, it } from 'vitest'
import { mmToPt, ptToMm, inToMm, mmToIn, formatMm, fromMm, toMm } from '../lib/units'

describe('unit conversion', () => {
  it('converts millimetres to points at 2.834645 pt/mm', () => {
    expect(mmToPt(10)).toBeCloseTo(28.3465, 3)
    expect(mmToPt(0)).toBe(0)
  })

  it('round-trips mm to pt and back', () => {
    for (const mm of [1, 3, 210, 297, 1234.5]) {
      expect(ptToMm(mmToPt(mm))).toBeCloseTo(mm, 9)
    }
  })

  it('converts inches and millimetres symmetrically', () => {
    expect(inToMm(8.5)).toBeCloseTo(215.9, 6)
    expect(mmToIn(215.9)).toBeCloseTo(8.5, 6)
    expect(mmToIn(0)).toBe(0)
  })

  it('formats mm to two decimals', () => {
    expect(formatMm(210)).toBe('210.00 mm')
    expect(formatMm(215.94)).toBe('215.94 mm')
  })

  it('converts display units without losing stored precision', () => {
    expect(fromMm(210, 'mm')).toBe(210)
    expect(fromMm(215.9, 'in')).toBe(8.5)
    expect(toMm(8.5, 'in')).toBe(215.9)
    expect(toMm(210, 'mm')).toBe(210)
  })

  it('does not emit NaN for zero or negative input', () => {
    expect(fromMm(0, 'in')).toBe(0)
    expect(toMm(0, 'mm')).toBe(0)
    expect(Number.isNaN(fromMm(-1, 'in'))).toBe(false)
  })
})

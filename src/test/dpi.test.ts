import { describe, expect, it } from 'vitest'
import { classifyDpi, describeDpi, effectiveDpi, maxPlacementForDpi } from '../lib/dpi'

describe('effective dpi', () => {
  it('computes native dpi from pixels and placed size', () => {
    // 2480 px across 210 mm = 300 dpi
    expect(effectiveDpi({ pixelWidth: 2480, pixelHeight: 3508, placedWidthMm: 210, placedHeightMm: 297 })).toBe(300)
  })

  it('uses the worse of the two axes', () => {
    const value = effectiveDpi({ pixelWidth: 3000, pixelHeight: 300, placedWidthMm: 254, placedHeightMm: 254 })
    expect(value).not.toBeNull()
    expect(value).toBeLessThan(100)
  })

  it('returns null for zero, negative, and non-finite input', () => {
    expect(effectiveDpi({ pixelWidth: 0, pixelHeight: 100, placedWidthMm: 10, placedHeightMm: 10 })).toBeNull()
    expect(effectiveDpi({ pixelWidth: -5, pixelHeight: 100, placedWidthMm: 10, placedHeightMm: 10 })).toBeNull()
    expect(effectiveDpi({ pixelWidth: 100, pixelHeight: 100, placedWidthMm: 0, placedHeightMm: 10 })).toBeNull()
    expect(effectiveDpi({ pixelWidth: Number.NaN, pixelHeight: 100, placedWidthMm: 10, placedHeightMm: 10 })).toBeNull()
    expect(effectiveDpi({ pixelWidth: 100, pixelHeight: 100, placedWidthMm: Number.POSITIVE_INFINITY, placedHeightMm: 10 })).toBeNull()
  })
})

describe('dpi classification', () => {
  it('classifies thresholds', () => {
    expect(classifyDpi(300)).toBe('ok')
    expect(classifyDpi(299)).toBe('warning')
    expect(classifyDpi(200)).toBe('warning')
    expect(classifyDpi(199)).toBe('critical')
    expect(classifyDpi(null)).toBe('unknown')
  })

  it('never renders NaN or Infinity in a label', () => {
    expect(describeDpi(null).label).toBe('—')
    expect(describeDpi(300).label).not.toContain('NaN')
    expect(describeDpi(150).label).toContain('too low')
  })
})

describe('max placement', () => {
  it('returns the largest physical size that holds the target dpi', () => {
    expect(maxPlacementForDpi(2480, 300)).toBeCloseTo(209.97, 1)
  })

  it('returns null for unusable input', () => {
    expect(maxPlacementForDpi(0, 300)).toBeNull()
    expect(maxPlacementForDpi(100, 0)).toBeNull()
    expect(maxPlacementForDpi(Number.NaN, 300)).toBeNull()
  })
})

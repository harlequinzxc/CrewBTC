import { describe, expect, it } from 'vitest'
import { computePageGeometry, cropMarkSegments, validatePageSettings } from '../lib/trim'
import { DEFAULT_PAGE_SETTINGS } from '../types/settings'
import type { PageSettings } from '../types/settings'

const base: PageSettings = { ...DEFAULT_PAGE_SETTINGS }

describe('page geometry', () => {
  it('adds bleed and mark margin to the media box', () => {
    const geometry = computePageGeometry(base)
    expect(geometry.mediaWidthMm).toBe(210 + (3 + 5) * 2)
    expect(geometry.mediaHeightMm).toBe(297 + (3 + 5) * 2)
    expect(geometry.bleedOffsetMm).toBe(8)
  })

  it('keeps trim dimensions when bleed and margin are zero', () => {
    const geometry = computePageGeometry({ ...base, bleedMm: 0, markMarginMm: 0 })
    expect(geometry.mediaWidthMm).toBe(210)
    expect(geometry.mediaHeightMm).toBe(297)
  })

  it('never yields NaN or Infinity for degenerate input', () => {
    const geometry = computePageGeometry({
      ...base,
      trimWidthMm: Number.NaN,
      trimHeightMm: Number.POSITIVE_INFINITY,
      bleedMm: -5,
      markMarginMm: Number.NaN,
    })
    expect(Number.isFinite(geometry.mediaWidthMm)).toBe(true)
    expect(Number.isFinite(geometry.mediaHeightMm)).toBe(true)
    expect(geometry.bleedMm).toBe(0)
  })

  it('flags marks as unfittable when the margin is too small', () => {
    expect(computePageGeometry({ ...base, markMarginMm: 2 }).marksFit).toBe(false)
    expect(computePageGeometry({ ...base, markMarginMm: 5 }).marksFit).toBe(true)
  })
})

describe('crop marks', () => {
  it('returns eight segments when enabled and fitted', () => {
    const geometry = computePageGeometry(base)
    expect(cropMarkSegments(geometry, { enabled: true })).toHaveLength(8)
  })

  it('returns none when disabled or unfitted', () => {
    const geometry = computePageGeometry(base)
    expect(cropMarkSegments(geometry, { enabled: false })).toHaveLength(0)
    const tight = computePageGeometry({ ...base, markMarginMm: 1 })
    expect(cropMarkSegments(tight, { enabled: true })).toHaveLength(0)
  })

  it('keeps every mark outside the trim box', () => {
    const geometry = computePageGeometry(base)
    const marks = cropMarkSegments(geometry, { enabled: true, gapMm: 1.5, lengthMm: 4 })
    const inset = geometry.bleedOffsetMm
    const trimLeft = inset
    const trimRight = geometry.mediaWidthMm - inset
    for (const mark of marks) {
      const isVertical = mark.x1 === mark.x2
      if (isVertical) {
        expect(mark.x1 <= trimLeft || mark.x1 >= trimRight).toBe(true)
      } else {
        expect(mark.y1 <= inset || mark.y1 >= geometry.mediaHeightMm - inset).toBe(true)
      }
    }
  })
})

describe('settings validation', () => {
  it('accepts the defaults', () => {
    expect(validatePageSettings(base)).toEqual({ ok: true, errors: {} })
  })

  it('rejects zero, negative, and out-of-range dimensions', () => {
    const result = validatePageSettings({ ...base, trimWidthMm: 0, trimHeightMm: -1 })
    expect(result.ok).toBe(false)
    expect(result.errors.trimWidthMm).toBeDefined()
    expect(result.errors.trimHeightMm).toBeDefined()
  })

  it('rejects non-finite values', () => {
    const result = validatePageSettings({ ...base, bleedMm: Number.NaN })
    expect(result.ok).toBe(false)
    expect(result.errors.bleedMm).toBeDefined()
  })

  it('rejects bleed beyond the allowed maximum', () => {
    const result = validatePageSettings({ ...base, bleedMm: 25 })
    expect(result.ok).toBe(false)
  })
})

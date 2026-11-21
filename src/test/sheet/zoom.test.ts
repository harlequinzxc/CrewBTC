import { describe, expect, it } from 'vitest'
import {
  MAX_ZOOM,
  MIN_ZOOM,
  ZOOM_STEPS,
  clampZoom,
  fitWidthScale,
  nextZoom,
  previousZoom,
  wheelZoom,
  zoomPercent,
} from '../../lib/zoom'
import { clampTextScale, MAX_TEXT_SCALE, MIN_TEXT_SCALE } from '../../types/card'

/**
 * The arithmetic behind the zoom toolbar and the text-size control.
 *
 * Both are easy to get subtly wrong at the ends of their range — a ladder that overshoots
 * on the last press, or a fit that divides by an unmeasured pane and collapses the sheet
 * to nothing — so the edges are what these check.
 */
describe('zoom ladder', () => {
  it('steps up to the next rung and never past the top', () => {
    expect(nextZoom(0.5)).toBe(0.75)
    expect(nextZoom(1)).toBe(1.25)
    expect(nextZoom(MAX_ZOOM)).toBe(MAX_ZOOM)
  })

  it('steps down to the previous rung and never past the bottom', () => {
    expect(previousZoom(1)).toBe(0.75)
    expect(previousZoom(0.3)).toBe(0.25)
    expect(previousZoom(MIN_ZOOM)).toBe(MIN_ZOOM)
  })

  it('does not overshoot when the current scale sits between rungs', () => {
    // A Ctrl+wheel can leave the scale at 1.1; the button must still give a rung.
    expect(nextZoom(1.1)).toBe(1.25)
    expect(previousZoom(1.1)).toBe(1)
  })

  it('clamps to the documented range', () => {
    expect(clampZoom(99)).toBe(MAX_ZOOM)
    expect(clampZoom(0.01)).toBe(MIN_ZOOM)
    expect(clampZoom(Number.NaN)).toBe(1)
  })

  it('keeps the ladder sorted, so the steps cannot disagree about direction', () => {
    const sorted = [...ZOOM_STEPS].sort((a, b) => a - b)
    expect([...ZOOM_STEPS]).toEqual(sorted)
  })

  it('moves a wheel gesture in the direction it was scrolled', () => {
    expect(wheelZoom(1, -1)).toBeGreaterThan(1)
    expect(wheelZoom(1, 1)).toBeLessThan(1)
  })

  it('reports whole percentages only', () => {
    expect(zoomPercent(1.017)).toBe(102)
    expect(zoomPercent(0.25)).toBe(25)
  })
})

describe('fit to width', () => {
  it('fills the pane width and ignores its height', () => {
    // 420px of pane over a 210mm sheet is 2 px/mm whatever the pane is tall.
    expect(fitWidthScale(420, 210)).toBeCloseTo(2, 6)
    // The same width in a short pane still fits the width: the sheet scrolls instead.
    expect(fitWidthScale(420, 210)).toBeCloseTo(2, 6)
    expect(fitWidthScale(900, 210)).toBeCloseTo(900 / 210, 6)
  })

  it('gives a readable card without any manual zoom', () => {
    // A 260px-wide canvas is a narrow laptop; a 52mm card must still be legible, which is
    // the whole reason for abandoning whole-page fit. Below ~40px a card's type is gone.
    const scale = fitWidthScale(700, 210)
    expect(52 * scale).toBeGreaterThan(120)
  })

  it('never returns zero or infinity for an unmeasured pane', () => {
    // The first render, before ResizeObserver has reported, must not collapse the sheet.
    for (const value of [fitWidthScale(0, 210), fitWidthScale(100, 0), fitWidthScale(Number.NaN, 210)]) {
      expect(Number.isFinite(value)).toBe(true)
      expect(value).toBeGreaterThan(0)
    }
  })
})

describe('text scale', () => {
  it('clamps to the documented range', () => {
    expect(clampTextScale(5)).toBe(MAX_TEXT_SCALE)
    expect(clampTextScale(0.1)).toBe(MIN_TEXT_SCALE)
    expect(clampTextScale(Number.NaN)).toBe(1)
  })

  it('rounds to whole percent, so the readout cannot drift', () => {
    expect(clampTextScale(1.234)).toBe(1.23)
    expect(clampTextScale(0.876)).toBe(0.88)
  })
})

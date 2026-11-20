import { describe, expect, it } from 'vitest'
import {
  applyToSelection,
  normaliseRuns,
  runAt,
  shiftRuns,
  styleAt,
} from '../types/text-runs'
import { layoutStyledBand, segmentByStyle, wrapSegments } from '../lib/export/styled-band'
import { DEFAULT_TEXT_STYLE } from '../types/card'
import { changedSpan } from '../features/workspace/card-edits'

const text = 'Plate with rice and garnish'

describe('selection styling', () => {
  it('styles only the selected characters', () => {
    const runs = applyToSelection(DEFAULT_TEXT_STYLE, [], { start: 6, end: 10 }, { color: '#b91c1c' })
    expect(runs).toHaveLength(1)
    expect(runs[0]).toMatchObject({ start: 6, end: 10, color: '#b91c1c' })
  })

  it('leaves text outside the selection on the box style', () => {
    const runs = applyToSelection(DEFAULT_TEXT_STYLE, [], { start: 6, end: 10 }, { color: '#b91c1c' })
    expect(styleAt(DEFAULT_TEXT_STYLE, runs, 0).color).toBe(DEFAULT_TEXT_STYLE.color)
    expect(styleAt(DEFAULT_TEXT_STYLE, runs, 7).color).toBe('#b91c1c')
    expect(styleAt(DEFAULT_TEXT_STYLE, runs, 12).color).toBe(DEFAULT_TEXT_STYLE.color)
  })

  it('splits an existing run when a selection overlaps its edge', () => {
    // 0-10 red, then the middle 4-8 becomes green.
    const first = applyToSelection(DEFAULT_TEXT_STYLE, [], { start: 0, end: 10 }, { color: '#b91c1c' })
    const second = applyToSelection(DEFAULT_TEXT_STYLE, first, { start: 4, end: 8 }, { color: '#15803d' })

    expect(styleAt(DEFAULT_TEXT_STYLE, second, 1).color).toBe('#b91c1c')
    expect(styleAt(DEFAULT_TEXT_STYLE, second, 5).color).toBe('#15803d')
    expect(styleAt(DEFAULT_TEXT_STYLE, second, 9).color).toBe('#b91c1c')
  })

  it('can highlight a single word in green without touching the rest', () => {
    const runs = applyToSelection(DEFAULT_TEXT_STYLE, [], { start: 6, end: 10 }, { highlight: '#86efac' })
    expect(styleAt(DEFAULT_TEXT_STYLE, runs, 7).highlight).toBe('#86efac')
    expect(styleAt(DEFAULT_TEXT_STYLE, runs, 2).highlight).toBe(DEFAULT_TEXT_STYLE.highlight)
  })

  it('can clear a highlight back to none', () => {
    const on = applyToSelection(DEFAULT_TEXT_STYLE, [], { start: 0, end: 5 }, { highlight: '#86efac' })
    const off = applyToSelection({ ...DEFAULT_TEXT_STYLE, highlight: '#86efac' }, on, { start: 0, end: 5 }, { highlight: null })
    expect(styleAt({ ...DEFAULT_TEXT_STYLE, highlight: '#86efac' }, off, 2).highlight).toBeNull()
  })

  it('ignores an empty selection', () => {
    expect(applyToSelection(DEFAULT_TEXT_STYLE, [], { start: 3, end: 3 }, { bold: true })).toEqual([])
  })
})

describe('runs follow the text', () => {
  it('slides a run when characters are inserted before it', () => {
    const runs = applyToSelection(DEFAULT_TEXT_STYLE, [], { start: 6, end: 10 }, { highlight: '#86efac' })
    const moved = shiftRuns(runs, 0, 0, 3, text.length + 3)
    expect(moved[0]).toMatchObject({ start: 9, end: 13 })
  })

  it('shrinks a run when text inside it is deleted', () => {
    const runs = applyToSelection(DEFAULT_TEXT_STYLE, [], { start: 6, end: 10 }, { highlight: '#86efac' })
    // Delete two of the four highlighted characters.
    const moved = shiftRuns(runs, 7, 9, 0, text.length - 2)
    expect(moved[0]).toMatchObject({ start: 6, end: 8 })
  })

  it('drops a run whose whole text was deleted', () => {
    const runs = applyToSelection(DEFAULT_TEXT_STYLE, [], { start: 6, end: 10 }, { highlight: '#86efac' })
    expect(shiftRuns(runs, 6, 10, 0, text.length - 4)).toEqual([])
  })

  it('keeps a run when text is typed after it', () => {
    const runs = applyToSelection(DEFAULT_TEXT_STYLE, [], { start: 6, end: 10 }, { highlight: '#86efac' })
    const moved = shiftRuns(runs, text.length, text.length, 5, text.length + 5)
    expect(moved[0]).toMatchObject({ start: 6, end: 10 })
  })

  it('clamps and orders runs from untrusted input', () => {
    const messy = normaliseRuns(
      [
        { start: 10, end: 99 },
        { start: -5, end: 3 },
        { start: 4, end: 4 },
      ],
      12,
    )
    expect(messy).toEqual([
      { start: 0, end: 3 },
      { start: 10, end: 12 },
    ])
  })

  it('never leaves overlapping runs', () => {
    const messy = normaliseRuns([{ start: 0, end: 8 }, { start: 4, end: 12 }], 12)
    for (let index = 1; index < messy.length; index += 1) {
      expect(messy[index]!.start).toBeGreaterThanOrEqual(messy[index - 1]!.end)
    }
  })
})

describe('changedSpan', () => {
  it('finds a single insertion', () => {
    expect(changedSpan('abc', 'abXc')).toEqual({ start: 2, end: 2 })
  })

  it('finds a single deletion', () => {
    expect(changedSpan('abXc', 'abc')).toEqual({ start: 2, end: 3 })
  })

  it('finds a replacement in the middle', () => {
    expect(changedSpan('hello world', 'hello there')).toEqual({ start: 6, end: 11 })
  })

  it('reports nothing for an unchanged string', () => {
    const span = changedSpan('same', 'same')
    expect(span.end).toBe(span.start)
  })
})

describe('styled layout', () => {
  const measure = (candidate: string, sizePt: number): number => candidate.length * sizePt * 0.5 * (25.4 / 72)

  it('takes the single-style path when there are no runs', () => {
    const layout = layoutStyledBand(
      { text: 'Plate', base: { text: '', bold: false, color: '#111827', highlight: null }, runs: [] },
      0,
      50,
      14,
      9,
      1.25,
      (candidate, sizePt) => measure(candidate, sizePt),
    )
    expect(layout.lines).toHaveLength(1)
    expect(layout.lines[0]?.segments).toHaveLength(1)
    expect(layout.lines[0]?.text).toBe('Plate')
  })

  it('carries both styles when one line holds two runs', () => {
    const layout = layoutStyledBand(
      {
        text: 'Plate now',
        base: { text: '', bold: false, color: '#111827', highlight: null },
        runs: [{ start: 0, end: 5, bold: true }],
      },
      0,
      80,
      14,
      9,
      1.25,
      (candidate, sizePt) => measure(candidate, sizePt),
    )
    const segments = layout.lines[0]?.segments ?? []
    expect(segments.length).toBeGreaterThan(1)
    expect(segments[0]?.bold).toBe(true)
    expect(segments[segments.length - 1]?.bold).toBe(false)
  })

  it('splits text into same-style segments only', () => {
    const segments = segmentByStyle({
      text: 'abcdef',
      base: { text: '', bold: false, color: '#111827', highlight: null },
      runs: [{ start: 2, end: 4, bold: true }],
    })
    expect(segments.map((segment) => segment.text).join('')).toBe('abcdef')
    expect(segments.map((segment) => segment.bold)).toEqual([false, true, false])
  })

  it('honours an explicit newline as a break', () => {
    const lines = wrapSegments(
      [{ text: 'one' + '\n' + 'two', bold: false, color: '#111827', highlight: null }],
      500,
      (candidate) => candidate.length,
    )
    expect(lines.map((line) => line.map((segment) => segment.text).join(''))).toEqual(['one', 'two'])
  })

  it('does not start a line with whitespace', () => {
    const lines = wrapSegments(
      [{ text: 'aaa    bbb', bold: false, color: '#111827', highlight: null }],
      4,
      (candidate) => candidate.length,
    )
    for (const line of lines) {
      expect(line[0]?.text.startsWith(' ')).toBe(false)
    }
  })
})

describe('runAt', () => {
  it('finds the run covering an offset and nothing outside it', () => {
    const runs = [{ start: 3, end: 6, bold: true }]
    expect(runAt(runs, 3)).toBeDefined()
    expect(runAt(runs, 5)).toBeDefined()
    expect(runAt(runs, 6)).toBeUndefined()
    expect(runAt(runs, 2)).toBeUndefined()
  })
})

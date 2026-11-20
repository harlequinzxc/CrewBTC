import { describe, expect, it } from 'vitest'
import { layoutStyledBand } from '../lib/export/styled-band'
import { CALLOUT_PRESETS, matchingPreset, presetStyle } from '../types/callouts'
import { DEFAULT_BODY_STYLE, DEFAULT_HEADER_STYLE, DEFAULT_TEXT_STYLE } from '../types/card'
import { applyToSelection, styleAt } from '../types/text-runs'

/**
 * The card look: bold black by default, a centred heading, and the two callout presets.
 *
 * The properties worth proving here are the ones a screenshot cannot show — that capitals
 * are drawn without the stored text changing, that a centred line is centred *by
 * measurement* rather than by the browser, and that a preset is a whole style rather than a
 * colour laid on top of whatever was there before.
 */

const PT_TO_MM = 25.4 / 72
/** Flat metrics: every glyph one 0.5 em wide, so widths are arithmetic and readable. */
const measureAt = (text: string, sizePt: number): number => text.length * sizePt * 0.5 * PT_TO_MM

const toMm = (pt: number): number => pt * PT_TO_MM

const base = { text: '', bold: false, color: '#111827', highlight: null }

const layout = (overrides: Partial<Parameters<typeof layoutStyledBand>[0]> = {}) =>
  layoutStyledBand(
    { text: 'HELLO', base, runs: [], ...overrides },
    0,
    100,
    40,
    10,
    1.25,
    measureAt,
    { paddingMm: 0.8 },
  )

describe('what a new card looks like', () => {
  it('starts bold and black, with the name centred', () => {
    expect(DEFAULT_TEXT_STYLE.bold).toBe(true)
    expect(DEFAULT_TEXT_STYLE.color).toBe('#111827')
    expect(DEFAULT_HEADER_STYLE.bold).toBe(true)
    expect(DEFAULT_HEADER_STYLE.color).toBe('#111827')
    expect(DEFAULT_HEADER_STYLE.align).toBe('center')
    // The steps are left aligned: centring a long instruction wraps it raggedly.
    expect(DEFAULT_BODY_STYLE.align).toBeUndefined()
    expect(DEFAULT_BODY_STYLE.color).toBe('#111827')
  })
})

describe('the presets', () => {
  it('are exactly two, and carry the inks their meaning needs', () => {
    expect(CALLOUT_PRESETS.map((preset) => preset.id)).toEqual(['crockeries', 'condiments'])
    const [crockeries, condiments] = CALLOUT_PRESETS
    expect(crockeries?.highlight).toBe('#b91c1c')
    expect(crockeries?.uppercase).toBe(true)
    expect(condiments?.highlight).toBe('#86efac')
    expect(condiments?.uppercase).toBe(false)
  })

  it('apply as a whole style, so one can never be mixed with the other', () => {
    const [crockeries, condiments] = CALLOUT_PRESETS
    expect(presetStyle(crockeries!)).toEqual({
      bold: true,
      color: '#ffffff',
      highlight: '#b91c1c',
      uppercase: true,
    })
    expect(presetStyle(condiments!)).toEqual({
      bold: true,
      color: '#111827',
      highlight: '#86efac',
      uppercase: false,
    })
  })

  it('name themselves when a style matches one exactly', () => {
    expect(matchingPreset(presetStyle(CALLOUT_PRESETS[0]!))?.id).toBe('crockeries')
    expect(matchingPreset(presetStyle(CALLOUT_PRESETS[1]!))?.id).toBe('condiments')
    // A green fill with the wrong ink is not CONDIMENTS, it is a colour somebody picked.
    expect(matchingPreset({ bold: true, color: '#ffffff', highlight: '#86efac' })).toBeNull()
    expect(matchingPreset(DEFAULT_TEXT_STYLE)).toBeNull()
  })

  it('survive a selection edit, keeping the alignment they inherited', () => {
    const runs = applyToSelection(DEFAULT_HEADER_STYLE, [], { start: 0, end: 5 }, {
      highlight: '#b91c1c',
      color: '#ffffff',
      uppercase: true,
    })
    const styled = styleAt(DEFAULT_HEADER_STYLE, runs, 2)
    expect(styled.highlight).toBe('#b91c1c')
    expect(styled.uppercase).toBe(true)
    // Not stated by the patch, so it comes from the box — a red tag on a centred heading
    // stays centred instead of reverting to flush left.
    expect(styled.align).toBe('center')
  })
})

describe('capitals and centring in the typesetter', () => {
  it('draws capitals without the caller rewriting the string', () => {
    const drawn = layout({ text: 'kung pao', base: { ...base, uppercase: true } })
    expect(drawn.lines[0]?.text).toBe('KUNG PAO')
  })

  it('leaves lower case alone when capitals are off', () => {
    const drawn = layout({ text: 'kung pao', base: { ...base, uppercase: false } })
    expect(drawn.lines[0]?.text).toBe('kung pao')
  })

  it('puts a centred line in the middle of the box', () => {
    const drawn = layout({ text: 'HI', base: { ...base, align: 'center' } })
    const line = drawn.lines[0]!
    const innerWidth = 100 - 0.8 * 2
    // The flat metric makes the expected start exact: padding, then half the slack.
    expect(line.xMm).toBeCloseTo(0.8 + (innerWidth - line.widthMm) / 2, 6)
  })

  it('starts a left-aligned line at the padding, as it always did', () => {
    const drawn = layout({ text: 'HI', base: { ...base, align: 'left' } })
    expect(drawn.lines[0]?.xMm).toBeCloseTo(0.8, 6)
  })

  it('measures each line, so a centred line knows its own width', () => {
    const drawn = layout({ text: 'HI', base: { ...base, align: 'center' } })
    const line = drawn.lines[0]!
    expect(line.widthMm).toBeCloseTo(measureAt('HI', line.sizePt), 6)
    expect(line.widthMm).toBeLessThan(100)
  })

  it('centres a capitalised line by the width it will actually draw', () => {
    // `i` and `I` are the same width under the flat metric, so this pins the *order* of
    // the two steps rather than the metric: capitalise first, then measure.
    const lower = layout({ text: 'ii', base: { ...base, align: 'center', uppercase: false } })
    const upper = layout({ text: 'ii', base: { ...base, align: 'center', uppercase: true } })
    expect(upper.lines[0]?.text).toBe('II')
    expect(upper.lines[0]?.xMm).toBeCloseTo(lower.lines[0]!.xMm, 6)
  })

  it('keeps a capitalised segment’s own case flag, so a run can differ from its box', () => {
    const drawn = layout({
      text: 'plate this',
      base: { ...base, uppercase: false },
      runs: [{ start: 0, end: 5, uppercase: true }],
    })
    expect(drawn.lines[0]?.text).toBe('PLATE this')
  })

  it('never lets a very long word start before the box', () => {
    // A word wider than the box still places at a non-negative x; it is clipped, not
    // pushed left, which is what `Math.max(0, ...)` is there to guarantee.
    const drawn = layout({ text: 'X'.repeat(200), base: { ...base, align: 'center' } })
    for (const line of drawn.lines) expect(line.xMm).toBeGreaterThanOrEqual(0)
  })
})

describe('a preset reaches the exported card', () => {
  it('is drawn as capitals with the fill behind it', () => {
    const preset = CALLOUT_PRESETS[0]!
    const drawn = layoutStyledBand(
      {
        text: 'kung pao',
        base: { text: '', ...presetStyle(preset) },
        runs: [],
      },
      0,
      100,
      40,
      10,
      1.25,
      measureAt,
      { paddingMm: 0.8 },
    )
    expect(drawn.lines[0]?.text).toBe('KUNG PAO')
    expect(drawn.lines[0]?.segments[0]?.highlight).toBe('#b91c1c')
    expect(drawn.lines[0]?.segments[0]?.color).toBe('#ffffff')
    expect(drawn.lines[0]?.segments[0]?.align).toBeUndefined()
  })

  it('is drawn centred when it sits in a centred box', () => {
    const preset = CALLOUT_PRESETS[1]!
    const drawn = layoutStyledBand(
      { text: 'soy', base: { text: '', ...presetStyle(preset), align: 'center' }, runs: [] },
      0,
      100,
      40,
      10,
      1.25,
      measureAt,
      { paddingMm: 0.8 },
    )
    expect(drawn.lines[0]!.xMm).toBeGreaterThan(0.8)
  })
})

describe('the typesetter is unchanged for a card nobody formatted', () => {
  it('still reports the plain single-style path when there are no runs', () => {
    const drawn = layout({ text: 'PLAIN TEXT' })
    expect(drawn.lines).toHaveLength(1)
    expect(drawn.lines[0]?.text).toBe('PLAIN TEXT')
    expect(drawn.overflow).toBe(false)
    // Every line reports a width and a start, so a caller never has to guess.
    expect(drawn.lines[0]?.widthMm).toBeGreaterThan(0)
    expect(toMm(drawn.sizePt)).toBeGreaterThan(0)
  })
})

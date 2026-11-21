import { describe, expect, it } from 'vitest'
import { colorInto, styleInto } from '../../features/workspace/cards/card-edits'
import { blankCard } from '../../features/workspace/cards/use-cards'
import { styleAt } from '../../types/text-runs'
import { DEFAULT_BODY_STYLE } from '../../types/card'

const red = '#b91c1c'
const card = {
  ...blankCard(67),
  bodyText: 'one two three',
  bodyRuns: [{ start: 4, end: 7, bold: false, highlight: '#86efac', color: '#000000' }],
}

describe('DIRECTIONS ink', () => {
  it('colours only the selected span without flattening its mixed formatting', () => {
    const changed = colorInto(card, 'body', { start: 1, end: 9 }, red)
    const at = (offset: number) => styleAt(changed.bodyStyle, changed.bodyRuns ?? [], offset)
    expect(at(0).color).toBe(card.bodyStyle.color)
    expect(at(1).color).toBe(red)
    expect(at(5)).toMatchObject({ color: red, bold: false, highlight: '#86efac' })
    expect(at(8)).toMatchObject({ color: red, bold: true, highlight: null })
    expect(at(9).color).toBe(card.bodyStyle.color)
    expect(changed.bodyText).toBe(card.bodyText)
    expect(colorInto(changed, 'body', { start: 1, end: 9 }, red)).toEqual(changed)
  })

  it('removes an identical red highlight so the new red ink stays legible', () => {
    const tagged = { ...card, bodyStyle: { ...card.bodyStyle, highlight: red } }
    const selected = colorInto(tagged, 'body', { start: 0, end: 3 }, red)
    expect(styleAt(selected.bodyStyle, selected.bodyRuns ?? [], 1)).toMatchObject({ color: red, highlight: null })
    expect(styleAt(selected.bodyStyle, selected.bodyRuns ?? [], 8).highlight).toBe(red)
    const whole = colorInto(tagged, 'body', null, red)
    expect(whole.bodyStyle).toMatchObject({ color: red, highlight: null })
  })

  it('colours the whole active zone including existing colour overrides', () => {
    const changed = colorInto(card, 'body', null, red)
    expect(changed.bodyStyle.color).toBe(red)
    expect(styleAt(changed.bodyStyle, changed.bodyRuns ?? [], 5)).toMatchObject({
      color: red, bold: false, highlight: '#86efac',
    })
    expect(changed.headerStyle).toEqual(card.headerStyle)
    const cleared = styleInto(changed, 'body', DEFAULT_BODY_STYLE)
    expect(styleAt(cleared.bodyStyle, cleared.bodyRuns ?? [], 5).color).toBe(DEFAULT_BODY_STYLE.color)
  })
})

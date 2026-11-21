import { describe, expect, it } from 'vitest'
import { automateCard, EMPTY_KEYWORDS } from '../../features/workspace/cards/auto-format'
import { blankCard } from '../../features/workspace/cards/use-cards'
import { styleAt } from '../../types/text-runs'

const keywords = { crockeries: 'plate\nsmall bowl', directions: 'drizzle', condiments: 'soy sauce' }
const get = (card: ReturnType<typeof blankCard>, position: number) => styleAt(card.bodyStyle, card.bodyRuns ?? [], position)

describe('automated formatting', () => {
  it('bullets actual nonempty lines, matches keywords ignoring case, and preserves wraps as text', () => {
    const card = { ...blankCard(67), bodyText: 'Place on Plate\nDrIzZle soy sauce over everything\n\n• done' }
    const result = automateCard(card, keywords)
    expect(result.bodyText).toBe('• Place on PLATE\n• DrIzZle soy sauce over everything\n\n• done')
    expect(get(result, result.bodyText.indexOf('PLATE'))).toMatchObject({ color: '#ffffff', highlight: '#b91c1c' })
    expect(get(result, result.bodyText.indexOf('DrIzZle'))).toMatchObject({ color: '#b91c1c', highlight: null })
    expect(get(result, result.bodyText.indexOf('soy sauce'))).toMatchObject({ color: '#111827', highlight: '#86efac' })
    expect(automateCard(result, keywords)).toEqual(result)
  })
  it('leaves matching top text and its existing styles entirely untouched', () => {
    const headerRuns = [{ start: 0, end: 5, color: '#15803d', bold: false }]
    const card = { ...blankCard(67), headerText: 'plate drizzle soy sauce', headerRuns, bodyText: 'plate' }
    const result = automateCard(card, keywords)
    expect(result.headerText).toBe(card.headerText)
    expect(result.headerStyle).toEqual(card.headerStyle)
    expect(result.headerRuns).toEqual(headerRuns)
    expect(result.bodyText).toBe('• PLATE')
  })
  it('does not match partial words and leaves empty lines and already numbered bullets alone', () => {
    const card = { ...blankCard(67), bodyText: 'plateful\n1. plate\n- drizzle\n\n  ' }
    const result = automateCard(card, keywords)
    expect(result.bodyText).toBe('• plateful\n1. PLATE\n• drizzle\n\n  ')
    expect(get(result, 2).highlight).toBeNull()
  })
  it('changes only leading dash markers and keeps formatting offsets intact', () => {
    const card = { ...blankCard(67), bodyText: '  - one\n- two\nUse - as text\n* three', bodyRuns: [{ start: 4, end: 7, color: '#15803d' }] }
    const result = automateCard(card, EMPTY_KEYWORDS)
    expect(result.bodyText).toBe('  • one\n• two\n• Use - as text\n* three')
    expect(get(result, result.bodyText.indexOf('one')).color).toBe('#15803d')
    expect(automateCard(result, EMPTY_KEYWORDS)).toEqual(result)
  })
  it('uses longest phrase first and a stable category priority for ties', () => {
    const card = { ...blankCard(67), bodyText: 'soy sauce' }
    const result = automateCard(card, { crockeries: 'soy', directions: 'soy sauce', condiments: 'soy sauce' })
    expect(result.bodyText).toBe('• soy sauce')
    expect(get(result, 2).color).toBe('#b91c1c')
    expect(get(result, 2).highlight).toBeNull()
  })
  it('retains existing formatting offsets when adding bullets and still supports no keywords', () => {
    const card = { ...blankCard(67), bodyText: 'hi\nworld', bodyRuns: [{ start: 3, end: 8, bold: false, color: '#15803d' }] }
    const result = automateCard(card, EMPTY_KEYWORDS)
    expect(result.bodyText).toBe('• hi\n• world')
    expect(get(result, result.bodyText.indexOf('world'))).toMatchObject({ bold: false, color: '#15803d' })
  })
})

import { describe, expect, it } from 'vitest'
import { automateCard, EMPTY_KEYWORDS } from '../../features/workspace/cards/auto-format'
import { removeCalloutFormatting } from '../../features/workspace/cards/remove-auto-format'
import { blankCard } from '../../features/workspace/cards/use-cards'
import { styleAt } from '../../types/text-runs'

describe('remove callout formatting', () => {
  it('clears all three callouts while retaining text, bullets, unrelated styles and bold', () => {
    const card = { ...blankCard(67), headerText: 'plate', bodyText: 'plate drizzle salt blue', bodyRuns: [{ start: 19, end: 23, color: '#15803d', bold: false }] }
    const formatted = { ...automateCard(card, { crockeries: 'plate', directions: 'drizzle', condiments: 'salt' }), headerText: 'PLATE', headerRuns: [{ start: 0, end: 5, bold: true, color: '#ffffff', highlight: '#b91c1c', uppercase: true }] }
    const result = removeCalloutFormatting(formatted)
    expect(result.headerText).toBe('PLATE')
    expect(result.bodyText).toBe('• PLATE drizzle salt blue')
    for (const word of ['PLATE', 'drizzle', 'salt']) {
      expect(styleAt(result.bodyStyle, result.bodyRuns ?? [], result.bodyText.indexOf(word))).toMatchObject({ color: '#111827', highlight: null, bold: true })
    }
    expect(styleAt(result.bodyStyle, result.bodyRuns ?? [], result.bodyText.indexOf('blue'))).toMatchObject({ color: '#15803d', bold: false })
    expect(styleAt(result.headerStyle, result.headerRuns ?? [], 0)).toMatchObject({ color: '#111827', highlight: null, align: 'center' })
    expect(removeCalloutFormatting(result)).toEqual(result)
  })
  it('removes box-wide styles and only the preset fields from mixed runs', () => {
    const card = { ...blankCard(67), bodyText: 'red green', bodyStyle: { bold: false, color: '#b91c1c', highlight: null }, bodyRuns: [{ start: 4, end: 9, color: '#111827', highlight: '#86efac', bold: true }] }
    const result = removeCalloutFormatting(card)
    expect(result.bodyStyle).toMatchObject({ bold: false, color: '#111827', highlight: null })
    expect(styleAt(result.bodyStyle, result.bodyRuns ?? [], 5)).toMatchObject({ bold: true, color: '#111827', highlight: null })
    expect(result.bodyText).toBe(card.bodyText)
  })
  it('leaves unrelated cards and formatting alone', () => {
    const card = automateCard({ ...blankCard(67), bodyText: 'hello', bodyRuns: [{ start: 0, end: 5, color: '#15803d', highlight: '#fde68a' }] }, EMPTY_KEYWORDS)
    expect(removeCalloutFormatting(card)).toEqual(card)
  })
})

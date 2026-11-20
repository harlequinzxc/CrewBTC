import { describe, expect, it } from 'vitest'
import { splitOcrText } from '../lib/pdf/ocr'

/**
 * Dividing OCR text into a title block and instruction lines.
 *
 * OCR output has no coordinates worth trusting — lines come back in reading order with
 * whatever spacing the recogniser found — so the split has to be made from the shape of
 * the text itself. Getting it wrong on a scanned card means a dish name ending up in
 * the steps.
 */

describe('splitting recognised text', () => {
  it('puts the code and name in the header, the steps in the body', () => {
    const split = splitOcrText(
      ['CHK-01', 'Kung Pao Chicken', '1. Plate with rice', '2. Garnish with peanuts'].join('\n'),
    )
    expect(split.headerText).toBe('CHK-01\nKung Pao Chicken')
    expect(split.bodyText).toBe('1. Plate with rice\n2. Garnish with peanuts')
  })

  it('recognises bullets as the start of the steps', () => {
    const split = splitOcrText(['GRL-04', 'Grilled Fish', '• Serve hot', '• With lime'].join('\n'))
    expect(split.headerText).toContain('Grilled Fish')
    expect(split.bodyText).toContain('Serve hot')
  })

  it('keeps every step on its own line', () => {
    const split = splitOcrText(
      ['A-1', 'Dish', '1. First', '2. Second', '3. Third'].join('\n'),
    )
    expect(split.bodyText.split('\n')).toHaveLength(3)
  })

  it('copes with a page that has only a title', () => {
    const split = splitOcrText('CHK-01')
    expect(split.headerText).toBe('CHK-01')
    expect(split.bodyText).toBe('')
  })

  it('returns nothing for text with no words in it', () => {
    expect(splitOcrText('  \n\t\n ...  ')).toEqual({ headerText: '', bodyText: '' })
  })

  it('does not lose words it cannot classify', () => {
    const raw = ['CHK-01', 'Dish', 'Served with tea', 'Plate it'].join('\n')
    const split = splitOcrText(raw)
    expect(`${split.headerText}\n${split.bodyText}`).toContain('Served with tea')
    expect(`${split.headerText}\n${split.bodyText}`).toContain('Plate it')
  })
})

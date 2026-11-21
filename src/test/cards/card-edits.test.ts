import { describe, expect, it } from 'vitest'
import { DEFAULT_TEXT_STYLE } from '../../types/card'
import { activeStyle, styleSelection, textInto } from '../../features/workspace/cards/card-edits'

/**
 * The edits a card receives from the editor, without a browser.
 *
 * These are the ones that are easy to get subtly wrong: a run is an offset, so anything
 * that changes the text has to move it, and anything that changes one word must leave the
 * rest of the box alone.
 */
const card = {
  headerText: 'Plate with rice',
  bodyText: 'Garnish',
  photo: null,
  headerStyle: DEFAULT_TEXT_STYLE,
  bodyStyle: DEFAULT_TEXT_STYLE,
  imageTransform: { offsetXMm: 0, offsetYMm: 0, scale: 1 },
  bands: { headerMm: 10, footerMm: 15 },
}

const greened = () =>
  styleSelection(card, 'header', { start: 6, end: 10 }, {
    ...DEFAULT_TEXT_STYLE,
    highlight: '#86efac',
  })

describe('a card edited through the selection helpers', () => {
  it('greens only the selected word and keeps everything else black', () => {
    const styled = greened()
    expect(styled.headerRuns).toHaveLength(1)
    expect(activeStyle(styled, 'header', { start: 7 }).highlight).toBe('#86efac')
    expect(activeStyle(styled, 'header', { start: 1 }).highlight).toBe(null)
  })

  it('keeps that highlight after typing in front of it', () => {
    const typed = textInto(greened(), 'header', 'Hot Plate with rice')
    expect(typed.headerRuns?.[0]).toBeDefined()
    expect(activeStyle(typed, 'header', { start: 11 }).highlight).toBe('#86efac')
  })

  it('drops the highlight when the highlighted word is deleted', () => {
    const styled = greened()
    expect(textInto(styled, 'header', 'Plate  rice').headerRuns).toEqual([])
  })

  it('leaves the box style alone until the box itself is restyled', () => {
    expect(greened().headerStyle).toEqual(DEFAULT_TEXT_STYLE)
  })

  it('restyles the whole box when nothing is selected', () => {
    const red = { ...DEFAULT_TEXT_STYLE, color: '#b91c1c' }
    expect(activeStyle(card, 'header', null)).toEqual(DEFAULT_TEXT_STYLE)
    expect(activeStyle({ ...card, headerStyle: red }, 'header', null)).toEqual(red)
  })
})

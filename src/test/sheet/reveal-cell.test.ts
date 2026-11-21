import { describe, expect, it } from 'vitest'
import { revealScrollTop } from '../../features/workspace/sheet/reveal-cell'

/**
 * Where the canvas should scroll to show a cell.
 *
 * Pure arithmetic, so it is pinned here rather than through the DOM: the behaviour that
 * matters is "centre it if it fits, otherwise align its top, and never move when it is
 * already comfortably visible". The alternative — always scrolling the sheet to its top —
 * is what left the card below the fold on a short viewport.
 */
const viewport = { top: 100, bottom: 700 }

describe('revealing a cell', () => {
  it('leaves the canvas alone when the cell is already in view', () => {
    expect(revealScrollTop({ top: 300, bottom: 400 }, viewport, 500)).toBe(500)
  })

  it('centres a cell that has fallen below the fold', () => {
    // Cell sits 800px down a pane whose visible window starts at 100.
    const next = revealScrollTop({ top: 900, bottom: 1000 }, viewport, 0)
    // Centred: the cell's midpoint lands on the viewport's midpoint.
    expect(next).toBe(900 + 50 - 400)
  })

  it('centres a cell that is above the fold, without going negative', () => {
    // A cell above the viewport asks for a smaller scrollTop than exists; the canvas has
    // no negative position, so the answer clamps at the top.
    expect(revealScrollTop({ top: -300, bottom: -200 }, viewport, 500)).toBe(0)
    // Further down, the same relationship holds without clamping.
    expect(revealScrollTop({ top: 0, bottom: 100 }, viewport, 500)).toBe(500 + 50 - 400)
  })

  it('aligns the top of a cell taller than the viewport', () => {
    // Aligning instead of centring keeps the band with the text on it on screen; centring
    // a tall card puts its top — the part worth reading — above the fold.
    const next = revealScrollTop({ top: 800, bottom: 1600 }, viewport, 0)
    expect(next).toBe(800 - 100 - 24)
  })

  it('never scrolls past the top of the canvas', () => {
    expect(revealScrollTop({ top: 0, bottom: 50 }, viewport, 0)).toBe(0)
  })

  it('treats a cell just inside the margin as needing a nudge', () => {
    // 10px of clearance is not comfortable; 40px is.
    expect(revealScrollTop({ top: 110, bottom: 200 }, viewport, 300)).not.toBe(300)
    expect(revealScrollTop({ top: 140, bottom: 200 }, viewport, 300)).toBe(300)
  })
})

import { describe, expect, it } from 'vitest'
import {
  SHEET_GAP,
  activeSheetAt,
  scrollTopForSheet,
  sheetOffsets,
} from '../../features/workspace/sheet/sheet-stack'
import { scrollToTop } from '../../features/workspace/sheet/scroll-stack'

/**
 * The stack, as arithmetic.
 *
 * Two-way binding is the thing worth testing here. The strip can scroll the canvas and the
 * canvas can move the strip, and if those two disagree about where a sheet is, the
 * highlight ends up on sheet 1 while you look at sheet 3 — which is worse than having no
 * highlight at all, because it is confidently wrong.
 */
const A4 = 297
const scale = 2

describe('where the sheets sit', () => {
  it('starts the first sheet at zero and leaves a 24px gap', () => {
    const offsets = sheetOffsets(3, A4, scale)
    expect(offsets).toHaveLength(3)
    expect(offsets[0]?.top).toBe(0)
    expect(offsets[1]?.top).toBe(A4 * scale + SHEET_GAP)
    expect(offsets[2]?.top).toBe(2 * (A4 * scale + SHEET_GAP))
    expect(SHEET_GAP).toBe(24)
  })

  it('draws nothing for an empty document', () => {
    // Not one zero-height sheet: a plan with no pages has no pages to show.
    expect(sheetOffsets(0, A4, scale)).toHaveLength(0)
  })
})

describe('which sheet the viewport is on', () => {
  const offsets = sheetOffsets(3, A4, scale)
  const viewport = 800

  it('is the first sheet at the top', () => {
    expect(activeSheetAt(0, viewport, offsets)).toBe(0)
  })



  it('is the last sheet at the bottom, however short it is', () => {
    const bottom = (offsets[2]?.top ?? 0) + 2000
    expect(activeSheetAt(bottom, viewport, offsets)).toBe(2)
  })

  it('has an answer for a document with no sheets', () => {
    expect(activeSheetAt(0, viewport, [])).toBe(0)
  })
})

describe('scrolling to a sheet', () => {
  const offsets = sheetOffsets(3, A4, scale)

  it('round-trips: scrolling to a sheet makes that sheet current', () => {
    for (const index of [0, 1, 2]) {
      // The two directions are the same arithmetic read from either end.
      expect(activeSheetAt(scrollTopForSheet(offsets, index), 800, offsets)).toBe(index)
    }
  })

  it('clamps rather than scrolling to nowhere', () => {
    expect(scrollTopForSheet(offsets, 99)).toBe(offsets[2]?.top)
    expect(scrollTopForSheet(offsets, -4)).toBe(0)
  })
})

describe('moving the stack without a browser', () => {
  it('uses scrollTo when the element has one', () => {
    const calls: ScrollToOptions[] = []
    const node = {
      scrollTop: 0,
      clientHeight: 800,
      scrollTo: (options: ScrollToOptions) => calls.push(options),
    }
    scrollToTop(node, 120)
    expect(calls).toEqual([{ top: 120, behavior: 'smooth' }])
    expect(node.scrollTop).toBe(0)
  })

  it('falls back to scrollTop when it does not', () => {
    // jsdom is this case. Unguarded, `scrollTo` threw inside an effect and took the whole
    // render down — the canvas would not have drawn a single sheet in a test.
    const node = { scrollTop: 0, clientHeight: 800 }
    scrollToTop(node, 240)
    expect(node.scrollTop).toBe(240)
  })
})

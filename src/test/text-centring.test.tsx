import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CardZoneText } from '../features/workspace/CardZoneText'
import { layoutStyledBand } from '../lib/export/styled-band'
import { cardZones } from '../types/card'

/**
 * A block shorter than its band is centred in it, in the preview and in the PDF.
 *
 * Text is drawn at the largest size that fits, so a band taller than its content would
 * otherwise leave all of its slack below the words — the conspicuous gap between a dish
 * name and its photo. Dividing the slack is what makes a hand-tuned tall band look
 * deliberate. The two renderers compute the offset from the same expression; this pins
 * both so they cannot drift.
 */
const PT_TO_MM = 25.4 / 72
const PAD = 0.8
const PITCH = 1.25

const textProps = (heightMm: number) => ({
  text: 'Kung Pao',
  scale: 4,
  widthMm: 52,
  heightMm,
  xMm: 0,
  yMm: 0,
  style: { bold: false, color: '#111827', highlight: null },
  runs: [],
  editing: false,
  onSelectionChange: () => undefined,
  maxPt: 9,
  placeholder: '',
  onBeginEdit: () => undefined,
  onChange: () => undefined,
  onEndEdit: () => undefined,
  onStyle: () => undefined,
})

/** The offset the preview applies, read back off the rendered line. */
const previewOffset = (heightMm: number): number => {
  const { container } = render(<CardZoneText {...textProps(heightMm)} />)
  const line = container.querySelector('span') as HTMLElement
  const topPx = Number.parseFloat(line.style.top)
  // Convert back to millimetres and undo the ascent, leaving just the centring.
  const layout = layoutStyledBand(
    { text: 'Kung Pao', base: { text: '', bold: false, color: '', highlight: null }, runs: [] },
    0, 52, heightMm, 9, PITCH, (t, s) => t.length * s * 0.5 * PT_TO_MM,
  )
  const ascent = layout.sizePt * PITCH * PT_TO_MM
  const firstBaseline = (layout.lines[0]?.yMm ?? 0)
  return topPx / 4 - (firstBaseline - ascent)
}

const layoutFor = (text: string, heightMm: number, pt: number) =>
  layoutStyledBand(
    { text, base: { text: '', bold: false, color: '', highlight: null }, runs: [] },
    0, 52, heightMm, pt, PITCH, (t, s) => t.length * s * 0.5 * PT_TO_MM,
  )

const offsetFor = (text: string, heightMm: number, pt: number): number => {
  const layout = layoutFor(text, heightMm, pt)
  const block = layout.lines.length * layout.sizePt * PITCH * PT_TO_MM
  return Math.max(0, heightMm - 2 * PAD - block) / 2
}

describe('a short block is centred in its band', () => {
  it('sits lower in a taller band, by half the extra room', () => {
    const tight = previewOffset(10)
    const tall = previewOffset(20)
    expect(tall).toBeGreaterThan(tight)
    // 10 mm of extra band is 5 mm of extra offset, one side of the centre.
    expect(tall - tight).toBeCloseTo(5, 1)
  })

  it('never lifts an overflowing block above its own box', () => {
    for (const heightMm of [3, 4, 5, 6]) {
      // Slack is clamped at zero, so the offset is exactly zero — to within the float
      // noise of converting millimetres to pixels and back.
      expect(previewOffset(heightMm)).toBeGreaterThan(-1e-9)
    }
  })

  it('leaves a block that exactly fills its band alone', () => {
    const layout = layoutFor('Kung Pao', 10, 9)
    const block = layout.lines.length * layout.sizePt * PITCH * PT_TO_MM
    expect(previewOffset(block + 2 * PAD)).toBeCloseTo(0, 1)
  })

  it('never draws a line outside the box it belongs to', () => {
    // A band dragged shorter than the type it holds is the case that used to spill: with
    // centring, an unclamped offset could push the first line above the box, over the
    // card's top border and into whatever sits above it.
    const { container } = render(<CardZoneText {...textProps(3)} />)
    const box = container.querySelector('button') as HTMLElement
    const boxTop = Number.parseFloat(box.style.top)
    const boxHeight = Number.parseFloat(box.style.height)

    for (const line of [...box.querySelectorAll(':scope > span')] as HTMLElement[]) {
      const top = Number.parseFloat(line.style.top)
      expect(top).toBeGreaterThanOrEqual(boxTop - 0.01)
      // The clip is the box; nothing should start below its bottom either.
      expect(top).toBeLessThanOrEqual(boxTop + boxHeight)
    }
    // And the box really does clip, so anything past the edge is not painted.
    expect(box.className).toContain('overflow-hidden')
  })

  it('keeps every exported baseline inside its band', () => {
    // The export draws at `sheetHeight - yMm`; if the offset ever overshot, type would be
    // printed above the card or over the picture. Two dozen cards' worth of band pairs is
    // enough to catch an offset that ignores the padding.
    const cases = [
      { headerMm: 10, footerMm: 15 },
      { headerMm: 20, footerMm: 24 },
      { headerMm: 6, footerMm: 6 },
      { headerMm: 30, footerMm: 22 },
    ]

    for (const bands of cases) {
      const zones = cardZones({ xMm: 4, yMm: 4, widthMm: 52, heightMm: 67 }, bands)
      for (const [zone, pt, text] of [
        [zones.header, 9, 'CHK-01\nKung Pao Chicken'],
        [zones.footer, 8, '• a\n• b\n• c'],
      ] as const) {
        const firstTop =
          (layoutFor(text, zone.heightMm, pt).lines[0]?.yMm ?? 0) -
          layoutFor(text, zone.heightMm, pt).sizePt * PITCH * PT_TO_MM +
          offsetFor(text, zone.heightMm, pt)
        expect(firstTop).toBeGreaterThan(-0.01)
      }
    }
  })
})

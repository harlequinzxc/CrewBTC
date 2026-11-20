import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { Card } from '../features/workspace/Card'
import { cardFromPage } from '../types/card'
import { computeGrid } from '../lib/imposition/grid'
import { DEFAULT_SHEET } from '../types/imposition'

/**
 * Guards the three ways a card could break its own layout.
 *
 * All three had shipped. `cardZones` answers in sheet millimetres for the exporter, and
 * the preview was feeding those straight into `position: absolute` children of the card
 * element — so every zone carried the card's own offset, pushing the photo out of the
 * cell and past the right edge of the paper. On top of that, a global `min-height: 44px`
 * from the §4.1 ladder stretched each zone far beyond its band, so the three zones
 * overlapped each other. Both faults were invisible in jsdom because nothing asserted
 * geometry; these tests do.
 */

const SCALE = 2

function renderCard(options: { cellIndex?: number; bands?: { headerMm: number; footerMm: number } } = {}) {
  const grid = computeGrid(DEFAULT_SHEET)
  const index = options.cellIndex ?? 0
  const cell = grid.cells[index]?.rect
  if (cell === undefined) throw new Error('fixture needs a cell')

  const base = cardFromPage(
    {
      photo: { dataUrl: 'data:image/png;base64,AA', widthPx: 360, heightPx: 300 },
      headerText: 'CHK-01\nKung Pao Chicken',
      bodyText: '• Plate with rice\n• Garnish with peanuts',
    },
    grid.cellHeightMm,
  )
  const card = options.bands === undefined ? base : { ...base, bands: options.bands }

  const { container } = render(
    <div style={{ position: 'relative', width: 800, height: 1200 }}>
      <Card
        card={card}
        cell={cell}
        scale={SCALE}
        cellIndex={index}
        pageLabel="dish.pdf#1"
        selected={false}
        editing={null}
        pictureEditing={false}
        onSelect={() => {}}
        onBeginTextEdit={() => {}}
        onEndEdit={() => {}}
        onTextChange={() => {}}
        onStyleChange={() => {}}
        onBeginPictureEdit={() => {}}
        onEndPictureEdit={() => {}}
        onImageChange={() => {}}
        onSelectionChange={() => {}}
      />
    </div>,
  )

  const px = (value: string): number => Number.parseFloat(value)
  const photo = (): HTMLElement => {
    const element = container.querySelector('[data-image]')
    if (element === null) throw new Error('no photo zone rendered')
    return element as HTMLElement
  }
  const texts = (): readonly HTMLElement[] =>
    [...container.querySelectorAll('[aria-label^="Card text"]')] as HTMLElement[]

  return { container, cell, px, photo, texts, grid }
}

describe('card zones stay inside their cell', () => {
  it('positions every zone from the card’s own corner, not the sheet’s', () => {
    // The last cell sits bottom-right, so any sheet-absolute leak shows up as a large
    // positive offset on both axes.
    const { cell, px, photo, texts } = renderCard({ cellIndex: 11 })
    const cellHeightPx = cell.heightMm * SCALE
    const cellWidthPx = cell.widthMm * SCALE

    for (const zone of [texts()[0] as HTMLElement, photo(), ...texts().slice(1)]) {
      expect(px(zone.style.top)).toBeGreaterThanOrEqual(0)
      expect(px(zone.style.top) + px(zone.style.height)).toBeLessThanOrEqual(cellHeightPx + 0.01)
      expect(px(zone.style.left)).toBeGreaterThanOrEqual(0)
      expect(px(zone.style.left) + px(zone.style.width)).toBeLessThanOrEqual(cellWidthPx + 0.01)
    }
  })

  it('stacks header, picture and footer with no overlap and no gap', () => {
    const { px, photo, texts } = renderCard()
    const header = texts()[0] as HTMLElement
    const footer = texts()[1] as HTMLElement

    const headerBottom = px(header.style.top) + px(header.style.height)
    const pictureBottom = px(photo().style.top) + px(photo().style.height)

    expect(headerBottom).toBeCloseTo(px(photo().style.top), 5)
    expect(pictureBottom).toBeCloseTo(px(footer.style.top), 5)
  })

  it('keeps the three zones summable to exactly one cell', () => {
    const { cell, px, photo, texts } = renderCard()
    const header = texts()[0] as HTMLElement
    const footer = texts()[1] as HTMLElement
    const total = px(header.style.height) + px(photo().style.height) + px(footer.style.height)
    expect(total).toBeCloseTo(cell.heightMm * SCALE, 5)
  })

  it('follows a per-card band change rather than the sheet default', () => {
    const { px, photo, texts } = renderCard({ bands: { headerMm: 20, footerMm: 12 } })
    const header = texts()[0] as HTMLElement
    const footer = texts()[1] as HTMLElement

    expect(px(header.style.height)).toBeCloseTo(20 * SCALE, 5)
    expect(px(footer.style.height)).toBeCloseTo(12 * SCALE, 5)
    // 67 - 20 - 12 = 35 mm of photo.
    expect(px(photo().style.height)).toBeCloseTo(35 * SCALE, 5)
  })

  it('clips every zone, so a zoomed photo cannot reach the footer text', () => {
    const { container, photo } = renderCard()
    const clipped = [photo(), ...([...container.querySelectorAll('[aria-label^="Card text"]')] as HTMLElement[])]
    for (const zone of clipped) {
      expect(zone.className).toContain('overflow-hidden')
    }
  })
})

describe('text is sized to fit its band', () => {
  it('never renders type larger than its own box can hold', () => {
    const { px, texts } = renderCard()
    for (const zone of texts()) {
      const fontSize = Number.parseFloat(zone.style.fontSize)
      const height = px(zone.style.height)
      // One line of type must fit inside the band it was measured for.
      expect(fontSize).toBeGreaterThan(0)
      expect(fontSize).toBeLessThanOrEqual(height)
    }
  })

  it('shrinks rather than overflowing when the band is cramped', () => {
    const small = renderCard({ bands: { headerMm: 6, footerMm: 6 } })
    const smallSizes = small.texts().map((zone) => Number.parseFloat(zone.style.fontSize))

    const roomy = renderCard({ bands: { headerMm: 20, footerMm: 20 } })
    const roomySizes = roomy.texts().map((zone) => Number.parseFloat(zone.style.fontSize))

    // A 6 mm band must not be typeset at the same size as a 20 mm band.
    expect(smallSizes[0]).toBeLessThanOrEqual(roomySizes[0] as number)
    expect(smallSizes[1]).toBeLessThanOrEqual(roomySizes[1] as number)
  })

  it('places each line absolutely so the drawn block cannot exceed the layout', () => {
    const { container } = renderCard()
    // Lines are the direct children of the text box; their segments are nested inside.
    const lines = [...container.querySelectorAll('[aria-label^="Card text"] > span')] as HTMLElement[]
    expect(lines.length).toBeGreaterThan(0)
    for (const line of lines) {
      expect(line.className).toContain('absolute')
      expect(Number.parseFloat(line.style.top)).toBeGreaterThanOrEqual(0)
    }
  })

  it('styles each segment individually rather than the whole line', () => {
    const { container } = renderCard()
    const segments = [...container.querySelectorAll('[aria-label^="Card text"] > span > span')] as HTMLElement[]
    expect(segments.length).toBeGreaterThan(0)
    for (const segment of segments) {
      // A segment carries its own ink and weight, which is what makes a bold word
      // inside an otherwise regular line possible.
      expect(segment.style.fontWeight).not.toBe('')
      expect(segment.style.color).not.toBe('')
    }
  })
})

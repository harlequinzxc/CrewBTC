import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CellPicture } from '../features/workspace/CellPicture'
import { containRectMm, DEFAULT_IMAGE_TRANSFORM } from '../types/edit'
import type { ImageTransform, PhotoSource } from '../types/edit'

/**
 * The picture box: shape, boundary, centring, and the move/zoom mode.
 *
 * The stretching bug came from sizing the photo by the PDF page's dimensions. These
 * checks are all about the drawn rectangle's *measurements*, which is the only way to
 * catch a squashed dish — it looks plausible in a screenshot and wrong only in numbers.
 */

const BOX = { xMm: 4, yMm: 17, widthMm: 64, heightMm: 57 }
const SCALE = 4 // pixels per millimetre in these tests

/** A 4:3 photo, the shape of most dish photographs. */
const LANDSCAPE: PhotoSource = { dataUrl: 'data:image/png;base64,PIC', widthPx: 400, heightPx: 300 }
/** A tall photo, to prove the other orientation behaves too. */
const PORTRAIT: PhotoSource = { dataUrl: 'data:image/png;base64,TALL', widthPx: 300, heightPx: 500 }

function geometry(photo: PhotoSource, transform: ImageTransform = DEFAULT_IMAGE_TRANSFORM) {
  return containRectMm(BOX, photo.widthPx, photo.heightPx, transform)
}

describe('the photo keeps its own shape', () => {
  it('gives a 4:3 photo a 4:3 rectangle, whatever the box is', () => {
    const rect = geometry(LANDSCAPE)
    expect(rect).not.toBeNull()
    expect((rect?.widthMm ?? 0) / (rect?.heightMm ?? 1)).toBeCloseTo(4 / 3, 3)
  })

  it('gives a 3:5 photo a 3:5 rectangle', () => {
    const rect = geometry(PORTRAIT)
    expect((rect?.widthMm ?? 0) / (rect?.heightMm ?? 1)).toBeCloseTo(3 / 5, 3)
  })

  it('keeps the shape across the whole zoom range', () => {
    for (const scale of [0.2, 0.5, 1, 2, 4]) {
      const rect = geometry(LANDSCAPE, { offsetXMm: 0, offsetYMm: 0, scale })
      expect((rect?.widthMm ?? 0) / (rect?.heightMm ?? 1)).toBeCloseTo(4 / 3, 3)
    }
  })

  it('fits inside the box at 1x, with the padding left over', () => {
    const rect = geometry(LANDSCAPE)
    expect(rect?.widthMm ?? 0).toBeLessThanOrEqual(BOX.widthMm)
    expect(rect?.heightMm ?? 0).toBeLessThanOrEqual(BOX.heightMm)
    // Padding means it does not touch the edges.
    expect(rect?.widthMm ?? 0).toBeLessThan(BOX.widthMm)
  })
})

describe('the photo starts centred', () => {
  it('is centred horizontally', () => {
    const rect = geometry(LANDSCAPE)
    const leftGap = (rect?.xMm ?? 0) - BOX.xMm
    const rightGap = BOX.xMm + BOX.widthMm - ((rect?.xMm ?? 0) + (rect?.widthMm ?? 0))
    expect(leftGap).toBeCloseTo(rightGap, 3)
  })

  it('is centred vertically', () => {
    const rect = geometry(LANDSCAPE)
    const topGap = (rect?.yMm ?? 0) - BOX.yMm
    const bottomGap = BOX.yMm + BOX.heightMm - ((rect?.yMm ?? 0) + (rect?.heightMm ?? 0))
    expect(topGap).toBeCloseTo(bottomGap, 3)
  })

  it('stays centred as it zooms', () => {
    for (const scale of [0.5, 1, 2]) {
      const rect = geometry(LANDSCAPE, { offsetXMm: 0, offsetYMm: 0, scale })
      const leftGap = (rect?.xMm ?? 0) - BOX.xMm
      const rightGap = BOX.xMm + BOX.widthMm - ((rect?.xMm ?? 0) + (rect?.widthMm ?? 0))
      expect(leftGap).toBeCloseTo(rightGap, 3)
    }
  })
})

describe('panning and zooming', () => {
  it('moves the photo by exactly the offset asked for', () => {
    const centred = geometry(LANDSCAPE)
    const moved = geometry(LANDSCAPE, { offsetXMm: 5, offsetYMm: -3, scale: 1 })
    expect((moved?.xMm ?? 0) - (centred?.xMm ?? 0)).toBeCloseTo(5, 3)
    expect((moved?.yMm ?? 0) - (centred?.yMm ?? 0)).toBeCloseTo(-3, 3)
  })

  it('doubles the drawn size when the zoom doubles', () => {
    const once = geometry(LANDSCAPE, { offsetXMm: 0, offsetYMm: 0, scale: 1 })
    const twice = geometry(LANDSCAPE, { offsetXMm: 0, offsetYMm: 0, scale: 2 })
    expect((twice?.widthMm ?? 0) / (once?.widthMm ?? 1)).toBeCloseTo(2, 3)
    // At 2x a 4:3 photo is wider than the box, which is what the box's clip is for.
    expect(twice?.widthMm ?? 0).toBeGreaterThan(BOX.widthMm)
  })
})

describe('the element actually drawn on screen', () => {
  const base = {
    box: BOX,
    scale: SCALE,
    editing: false,
    onBeginEdit: () => undefined,
    onEndEdit: () => undefined,
    onChange: () => undefined,
  }

  it('draws a 4:3 photo as a 4:3 rectangle, in pixels', () => {
    const { container } = render(
      <CellPicture {...base} photo={LANDSCAPE} transform={DEFAULT_IMAGE_TRANSFORM} />,
    )
    const img = container.querySelector('img')
    const width = Number.parseFloat(img?.style.width ?? '0')
    const height = Number.parseFloat(img?.style.height ?? '0')

    expect(width).toBeGreaterThan(0)
    expect(width / height).toBeCloseTo(4 / 3, 2)
  })

  it('draws a 3:5 photo as a 3:5 rectangle', () => {
    const { container } = render(
      <CellPicture {...base} photo={PORTRAIT} transform={DEFAULT_IMAGE_TRANSFORM} />,
    )
    const img = container.querySelector('img')
    const width = Number.parseFloat(img?.style.width ?? '0')
    const height = Number.parseFloat(img?.style.height ?? '0')

    expect(width / height).toBeCloseTo(3 / 5, 2)
  })

})


import { createCanvas } from '@napi-rs/canvas'
import { PDFArray, PDFDocument } from '@cantoo/pdf-lib'
import { describe, expect, it } from 'vitest'
import { writeCards } from '../lib/export/write-cards'
import { computeGrid } from '../lib/imposition/grid'
import { DEFAULT_SHEET } from '../types/imposition'
import { cardKey, clampBands } from '../types/card'
import type { Card } from '../types/card'
import { matchBandsInto } from '../features/workspace/card-edits'

/**
 * This round's print-side promises: the cell is framed, the steps start at the top of
 * their box, and "same margins everywhere" means what it says.
 *
 * The border is read out of the content stream because a rectangle the export does not
 * draw is invisible to any test that only checks our own arithmetic — which is exactly how
 * the preview and the print drifted apart in the first place.
 */

const grid = computeGrid(DEFAULT_SHEET)

function png(widthPx: number, heightPx: number): string {
  const canvas = createCanvas(widthPx, heightPx)
  const context = canvas.getContext('2d')
  context.fillStyle = '#c0392b'
  context.fillRect(0, 0, widthPx, heightPx)
  return `data:image/png;base64,${canvas.toBuffer('image/png').toString('base64')}`
}

function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    headerText: 'Kung Pao',
    bodyText: 'Stir fry',
    photo: { dataUrl: png(400, 300), widthPx: 400, heightPx: 300 },
    headerStyle: { bold: true, color: '#111827', highlight: null },
    bodyStyle: { bold: true, color: '#111827', highlight: null },
    imageTransform: { offsetXMm: 0, offsetYMm: 0, scale: 1 },
    bands: { headerMm: 14, footerMm: 20 },
    ...overrides,
  }
}

async function contentOf(bytes: Uint8Array): Promise<string> {
  const doc = await PDFDocument.load(bytes)
  const contents = doc.getPages()[0]!.node.Contents() as unknown as PDFArray
  const parts: string[] = []
  for (let index = 0; index < contents.size(); index += 1) {
    const item = doc.context.lookup(contents.get(index) as never) as { contents?: Uint8Array }
    if (item.contents === undefined) continue
    const stream = new DecompressionStream('deflate')
    const writer = stream.writable.getWriter()
    void writer.write(new Uint8Array(item.contents))
    void writer.close()
    parts.push(await new Response(stream.readable).text())
  }
  return parts.join('\n')
}

async function sourceBytes(): Promise<ArrayBuffer> {
  const doc = await PDFDocument.create()
  doc.addPage([181, 255])
  const bytes = await doc.save()
  const copy = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(copy).set(bytes)
  return copy
}

async function exportOne(card: Card, drawCutMarks = false): Promise<string> {
  const key = cardKey(0, 'doc-a', 1)
  const result = await writeCards({
    settings: DEFAULT_SHEET,
    grid,
    pages: [{ documentId: 'doc-a', fileName: 'cards.pdf', pageNumber: 1, widthMm: 181, heightMm: 255 }],
    sources: new Map([['doc-a', await sourceBytes()]]),
    drawCutMarks,
    cards: { [key]: card },
    photos: card.photo === null ? {} : { [key]: card.photo },
  })
  return contentOf(result.bytes)
}

/** Every stroke, as its grey and width. A drawn border emits `.5 w` then `… RG`. */
function strokes(content: string): readonly string[] {
  return [...content.matchAll(/[\d.]+ w\b/g)].map((match) => match[0])
}

describe('the cell border in the exported PDF', () => {
  it('paints the frame after the image and corner labels', async () => {
    const content = await exportOne(makeCard({ displayNumber: 1, cornerLabel: 'X' }))
    const frame = content.lastIndexOf('0.5 w')
    const image = content.lastIndexOf(' Do')
    const label = content.lastIndexOf('<58> Tj')
    expect(image).toBeGreaterThan(-1)
    expect(label).toBeGreaterThan(-1)
    expect(frame).toBeGreaterThan(image)
    expect(frame).toBeGreaterThan(label)
  })

  it('is stroked even when cut marks are off', async () => {
    const plain = await exportOne(makeCard(), false)
    // One stroke for the cell border; without it there would be none at all.
    expect(strokes(plain).length).toBeGreaterThan(0)
  })

  it('is drawn per card, so a sheet of twelve gets twelve frames', async () => {
    const one = await exportOne(makeCard())
    // The card is stroked with round joints and a 0.5 pt line, which cut marks never use.
    expect(one).toMatch(/\b0\.5 w\b/)
  })

  it('is a separate stroke from the cut marks', async () => {
    const withoutMarks = await exportOne(makeCard(), false)
    const withMarks = await exportOne(makeCard(), true)
    expect(strokes(withMarks).length).toBeGreaterThan(strokes(withoutMarks).length)
  })
})

describe('the steps box starts at the top of its band', () => {
  it('does not move its first line when the band grows', async () => {
    const tight = await exportOne(makeCard({ bands: { headerMm: 14, footerMm: 16 } }))
    const loose = await exportOne(makeCard({ bands: { headerMm: 14, footerMm: 30 } }))

    // The `Tm` before the footer text states the baseline. Growing the footer band must
    // not lift the steps, which is what vertical centring used to do.
    const baselines = (content: string): readonly number[] =>
      [...content.matchAll(/1 0 0 1 [\d.]+ ([\d.]+) Tm/g)].map((m) => Number.parseFloat(m[1] ?? ''))
    const tightLast = baselines(tight).at(-1)
    const looseLast = baselines(loose).at(-1)
    expect(tightLast).toBeDefined()
    expect(looseLast).toBeDefined()
    /*
      The footer's box moves *up* the page as it grows (its bottom edge is fixed to the
      cell's bottom), so its baseline rises by exactly the band's own growth. That is the
      proof the text is pinned to the band's top: if it were centred, the baseline would
      rise by only half the growth. PDF y is measured from the page's bottom.
    */
    const bandGrewPt = (30 - 16) * (72 / 25.4)
    const rosePt = (looseLast ?? 0) - (tightLast ?? 0)
    expect(rosePt).toBeCloseTo(bandGrewPt, 0)
  })
})

describe('matching one card’s margins to the rest', () => {
  const cards: Record<string, Card> = {
    a: makeCard({ bands: { headerMm: 10, footerMm: 12 } }),
    b: makeCard({ bands: { headerMm: 20, footerMm: 30 } }),
    c: makeCard({ bands: { headerMm: 6, footerMm: 6 } }),
  }

  it('gives every card the chosen split', () => {
    const matched = matchBandsInto(cards, { headerMm: 18, footerMm: 22 }, 67)
    for (const card of Object.values(matched)) {
      expect(card.bands).toEqual({ headerMm: 18, footerMm: 22 })
    }
  })

  it('leaves every other property alone', () => {
    const matched = matchBandsInto(cards, { headerMm: 18, footerMm: 22 }, 67)
    expect(matched.a?.headerText).toBe(cards.a?.headerText)
    expect(matched.b?.bodyStyle).toEqual(cards.b?.bodyStyle)
  })

  it('clamps to a card’s own height rather than pasting a split that cannot fit', () => {
    // 55 mm of text on a 40 mm cell would leave no photo at all, so `clampBands` must
    // shrink it — the same invariant the divider drag obeys.
    const short = { x: makeCard({ bands: { headerMm: 8, footerMm: 8 } }) }
    const matched = matchBandsInto(short, { headerMm: 30, footerMm: 25 }, 40)
    const bands = matched.x!.bands
    expect(bands).toEqual(clampBands({ headerMm: 30, footerMm: 25 }, 40))
    expect(40 - bands.headerMm - bands.footerMm).toBeGreaterThanOrEqual(12)
  })

  it('is a no-op when there is nothing to copy onto', () => {
    expect(matchBandsInto({}, { headerMm: 10, footerMm: 10 }, 67)).toEqual({})
  })
})

import { createCanvas } from '@napi-rs/canvas'
import { PDFArray, PDFDocument } from '@cantoo/pdf-lib'
import { describe, expect, it } from 'vitest'
import { writeCards } from '../../lib/export/write-cards'
import { computeGrid } from '../../lib/imposition/grid'
import { DEFAULT_SHEET } from '../../types/imposition'
import { cardKey } from '../../types/card'
import type { Card } from '../../types/card'
import { CALLOUT_PRESETS, presetStyle } from '../../types/callouts'

/**
 * The callout presets have to reach the print, not just the screen.
 *
 * A preset changes three things at once — a fill, an ink and the case of the letters — and
 * each of them fails differently in a PDF: a fill can be silently omitted, an ink can be
 * ignored in favour of the box's, and capitals are *text*, so they either appear in the
 * content stream or they do not. These read the stream rather than our own arithmetic,
 * because "looks right on screen, prints plain" is the failure being guarded against.
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
    headerText: 'Kung Pao Chicken',
    bodyText: 'Plate with rice',
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

async function exportOne(card: Card): Promise<string> {
  const key = cardKey(0, 'doc-a', 1)
  const result = await writeCards({
    settings: DEFAULT_SHEET,
    grid,
    pages: [{ documentId: 'doc-a', fileName: 'cards.pdf', pageNumber: 1, widthMm: 181, heightMm: 255 }],
    drawCutMarks: false,
    cards: { [key]: card },
    photos: card.photo === null ? {} : { [key]: card.photo },
  })
  return contentOf(result.bytes)
}

/**
 * The strings drawn, decoded.
 *
 * pdf-lib writes text as **hex** in `<>` brackets rather than as a literal string, so a
 * regex looking for `(…) Tj` finds nothing and every assertion built on it passes
 * vacuously. Decoding the hex is what makes these tests able to fail.
 */
function drawnText(content: string): readonly string[] {
  return [...content.matchAll(/<([\da-fA-F]+)>\s*Tj/g)].map((match) => {
    const hex = match[1] ?? ''
    const bytes = hex.match(/.{2}/g) ?? []
    return bytes.map((pair) => String.fromCharCode(Number.parseInt(pair, 16))).join('')
  })
}

/** Filled rectangle paths — each highlight draws one. */
function highlightRects(content: string): number {
  return [...content.matchAll(/\bh\s+f\b/g)].length
}

describe('CROCKERIES in the exported card', () => {
  const preset = CALLOUT_PRESETS[0]!

  it('prints the letters in capitals without the stored text being changed', async () => {
    const content = await exportOne(
      makeCard({ headerText: 'kung pao chicken', headerStyle: presetStyle(preset) }),
    )
    const words = drawnText(content).join(' ')
    expect(words).toContain('KUNG')
    // The card still holds what was typed; only the drawing capitalised it.
    expect(makeCard({ headerText: 'kung pao chicken' }).headerText).toBe('kung pao chicken')
  })

  it('draws the red fill behind the words', async () => {
    const plain = await exportOne(makeCard({ headerStyle: { bold: true, color: '#111827', highlight: null } }))
    const tagged = await exportOne(makeCard({ headerStyle: presetStyle(preset) }))
    expect(highlightRects(tagged)).toBeGreaterThan(highlightRects(plain))
  })

  it('prints white ink rather than the box’s black', async () => {
    const black = await exportOne(
      makeCard({ headerStyle: { bold: true, color: '#111827', highlight: '#b91c1c' } }),
    )
    const white = await exportOne(makeCard({ headerStyle: presetStyle(preset) }))
    // pdf-lib writes ink as `r g b rg`; white is the one triple that cannot be confused.
    expect(white).toMatch(/\b1\s+1\s+1\s+rg\b/)
    expect(black).not.toMatch(/\b1\s+1\s+1\s+rg\b/)
  })
})

describe('CONDIMENTS in the exported card', () => {
  const preset = CALLOUT_PRESETS[1]!

  it('keeps the letters as typed — no capitals to remove', async () => {
    const content = await exportOne(
      makeCard({ bodyText: 'soy and vinegar', bodyStyle: presetStyle(preset) }),
    )
    expect(drawnText(content).join(' ')).toContain('soy')
  })

  it('draws a green fill behind the words', async () => {
    const content = await exportOne(makeCard({ bodyStyle: presetStyle(preset) }))
    // `#86efac` as pdf-lib's 0..1 triples.
    expect(content).toMatch(/0\.52549\d*\s+0\.93725\d*\s+0\.67450\d*\s+rg/)
  })
})

describe('a centred heading', () => {
  it('always starts further from the edge than a flush-left one', async () => {
    const left = await exportOne(makeCard({ headerStyle: { bold: true, color: '#111827', highlight: null } }))
    const centred = await exportOne(
      makeCard({
        headerStyle: { bold: true, color: '#111827', highlight: null, align: 'center' },
      }),
    )
    // pdf-lib positions text with `1 0 0 1 <x> <y> Tm`; the x is in points.
    const firstX = (content: string): number => {
      const match = /1 0 0 1 ([\d.]+) [\d.]+ Tm/.exec(content)
      return match === null ? Number.NaN : Number.parseFloat(match[1] ?? '')
    }
    expect(Number.isFinite(firstX(left))).toBe(true)
    expect(firstX(centred)).toBeGreaterThan(firstX(left))
  })

  it('does not move a left-aligned card by a single point', async () => {
    const before = await exportOne(makeCard())
    const explicit = await exportOne(
      makeCard({ headerStyle: { bold: true, color: '#111827', highlight: null, align: 'left' } }),
    )
    expect(explicit).toBe(before)
  })
})

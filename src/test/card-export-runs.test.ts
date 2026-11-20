import { createCanvas } from '@napi-rs/canvas'
import { PDFArray, PDFDocument } from '@cantoo/pdf-lib'
import { describe, expect, it } from 'vitest'
import { writeCards } from '../lib/export/write-cards'
import { computeGrid } from '../lib/imposition/grid'
import { DEFAULT_SHEET } from '../types/imposition'
import { cardKey } from '../types/card'
import type { Card } from '../types/card'

/**
 * Formatting a *selection* has to reach the print, not just the screen.
 *
 * These read the PDF's own content stream, because the failure being guarded against — a
 * card that looks highlighted on screen and prints plain — is invisible to any test that
 * only inspects our own arithmetic.
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
    headerText: 'CHK-01\nKung Pao Chicken',
    bodyText: 'Plate with rice\n• Garnish with peanuts',
    photo: { dataUrl: png(400, 300), widthPx: 400, heightPx: 300 },
    headerStyle: { bold: true, color: '#111827', highlight: null },
    bodyStyle: { bold: false, color: '#b91c1c', highlight: '#fde68a' },
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

async function exportOne(card: Card): Promise<string> {
  const key = cardKey(0, 'doc-a', 1)
  const result = await writeCards({
    settings: DEFAULT_SHEET,
    grid,
    pages: [{ documentId: 'doc-a', fileName: 'cards.pdf', pageNumber: 1, widthMm: 181, heightMm: 255 }],
    sources: new Map([['doc-a', await sourceBytes()]]),
    drawCutMarks: false,
    cards: { [key]: card },
    photos: card.photo === null ? {} : { [key]: card.photo },
  })
  return contentOf(result.bytes)
}

/**
 * Filled rectangle paths in the stream — each highlight draws one.
 *
 * pdf-lib emits a rectangle as `x y m … l … l … h f` rather than the `re` shorthand, so
 * counting `re` finds nothing.
 */
function highlightRects(content: string): number {
  return [...content.matchAll(/\bh\s+f\b/g)].length
}

describe('selection-level styling', () => {
  it('highlights only the selected run, not the whole box', async () => {
    const boxWide = await exportOne(makeCard({ headerStyle: { bold: false, color: '#111827', highlight: '#86efac' } }))
    const runOnly = await exportOne(
      makeCard({
        headerStyle: { bold: false, color: '#111827', highlight: null },
        headerRuns: [{ start: 6, end: 10, highlight: '#86efac' }],
      }),
    )

    // A box-wide highlight paints a rectangle per line; a four-character run paints one,
    // so the run is strictly cheaper than the box and strictly more than nothing.
    const none = highlightRects(await exportOne(makeCard({ headerStyle: { bold: false, color: '#111827', highlight: null } })))
    const runRectCount = highlightRects(runOnly)
    expect(runRectCount).toBeGreaterThan(none)
    expect(runRectCount).toBeLessThan(highlightRects(boxWide))
  })

  it('prints both weights when one line carries a bold run', async () => {
    const plain = await exportOne(
      makeCard({
        headerStyle: { bold: false, color: '#111827', highlight: null },
        headerText: 'Plate with rice',
      }),
    )
    const mixed = await exportOne(
      makeCard({
        headerStyle: { bold: false, color: '#111827', highlight: null },
        headerText: 'Plate with rice',
        headerRuns: [{ start: 6, end: 10, bold: true }],
      }),
    )

    // Every pdf-lib font resource is named `/Helvetica-<hash>`. Two weights means two
    // resources, so a mixed line names more of them than a single-weight one — which is
    // only true if the run genuinely switched faces mid-line.
    const fonts = (content: string): number =>
      new Set([...content.matchAll(/\/(Helvetica-\d+)\s+[\d.]+\s+Tf/g)].map((match) => match[1])).size
    expect(fonts(mixed)).toBeGreaterThan(fonts(plain))
  })

  it('leaves a card with no runs printing exactly as before', async () => {
    const withoutRuns = await exportOne(makeCard())
    const withEmptyRuns = await exportOne(makeCard({ headerRuns: [], bodyRuns: [] }))
    expect(withEmptyRuns).toBe(withoutRuns)
  })
})

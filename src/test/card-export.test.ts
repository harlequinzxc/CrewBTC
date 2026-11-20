import { createCanvas } from '@napi-rs/canvas'
import { PDFArray, PDFDocument } from '@cantoo/pdf-lib'
import { describe, expect, it } from 'vitest'
import { writeCards } from '../lib/export/write-cards'
import { computeGrid } from '../lib/imposition/grid'
import { DEFAULT_SHEET } from '../types/imposition'
import { cardKey } from '../types/card'
import type { Card } from '../types/card'

/**
 * The exported sheet must print what the card shows: the text, its colour, its
 * highlight, the bold header, and the photo at its own shape.
 *
 * These read the PDF's own content stream rather than trusting our arithmetic, because
 * the failure mode being guarded against — a card that looks right on screen and prints
 * wrong — is invisible to any test that only checks our own numbers.
 */

const grid = computeGrid(DEFAULT_SHEET)

/** A real PNG, so embedding exercises the real path. */
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

/** The page's decompressed content stream, as text. */
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
    pages: [
      { documentId: 'doc-a', fileName: 'cards.pdf', pageNumber: 1, widthMm: 181, heightMm: 255 },
    ],
    drawCutMarks: false,
    cards: { [key]: card },
    photos: card.photo === null ? {} : { [key]: card.photo },
  })
  return contentOf(result.bytes)
}

/** Text drawn on the page, decoded from the hex strings pdf-lib writes for glyphs. */
function drawnText(content: string): string {
  return [...content.matchAll(/<([\da-fA-F]+)>\s*Tj/g)]
    .map((match) => {
      const hex = match[1] ?? ''
      let out = ''
      for (let index = 0; index < hex.length; index += 2) {
        out += String.fromCharCode(Number.parseInt(hex.slice(index, index + 2), 16))
      }
      return out
    })
    .join('\n')
}

describe('the card prints its text', () => {
  it('prints the header and the body', async () => {
    const text = drawnText(await exportOne(makeCard()))
    expect(text).toContain('CHK-01')
    expect(text).toContain('Kung Pao Chicken')
    expect(text).toContain('Plate with rice')
    expect(text).toContain('Garnish with peanuts')
  })

  it('uses the bold face for a bold header', async () => {
    const plain = await exportOne(makeCard({ headerStyle: { bold: false, color: '#111827', highlight: null } }))
    const bold = await exportOne(makeCard())

    expect(plain).toContain('/Helvetica-')
    expect(bold).toContain('/Helvetica-Bold-')
  })

  it('prints the body in the chosen colour', async () => {
    const content = await exportOne(makeCard())
    // #b91c1c = 185/255, 28/255, 28/255.
    expect(content).toContain('0.7254901960784313 0.10980392156862745 0.10980392156862745 rg')
  })

  it('prints the chosen highlight behind the words', async () => {
    const content = await exportOne(makeCard())
    // #fde68a, the amber highlighter.
    expect(content).toContain('0.9921568627450981 0.9019607843137255 0.5411764705882353 rg')
  })

  it('draws no highlight when none was chosen', async () => {
    const content = await exportOne(
      makeCard({ bodyStyle: { bold: false, color: '#b91c1c', highlight: null } }),
    )
    expect(content).not.toContain('0.9921568627450981')
  })

  it('prints nothing for an empty box, and does not throw', async () => {
    const content = await exportOne(makeCard({ headerText: '', bodyText: '' }))
    expect(drawnText(content).trim()).toBe('')
  })
})

describe('the card prints its photo at its own shape', () => {
  /** The `w 0 0 h 0 0 cm` an image is drawn with, ignoring pdf-lib's identity matrices. */
  function imageRect(content: string): { width: number; height: number } {
    const found = [...content.matchAll(/([\d.]+) 0 0 ([\d.]+) 0 0 cm/g)]
      .map((match) => ({ width: Number(match[1]), height: Number(match[2]) }))
      .filter((rect) => rect.width > 1 && rect.height > 1)
      .at(-1)
    return found ?? { width: 0, height: 0 }
  }

  it('prints a landscape photo landscape', async () => {
    const rect = imageRect(await exportOne(makeCard()))
    expect(rect.width / rect.height).toBeCloseTo(4 / 3, 2)
  })

  it('prints a portrait photo portrait, not squashed into the box', async () => {
    const portrait = { dataUrl: png(300, 500), widthPx: 300, heightPx: 500 }
    const content = await exportOne(makeCard({ photo: portrait }))
    const rect = imageRect(content)
    expect(rect.width / rect.height).toBeCloseTo(3 / 5, 2)
  })

  it('keeps a zoomed photo inside its box with a real clip', async () => {
    const content = await exportOne(
      makeCard({ imageTransform: { offsetXMm: 0, offsetYMm: 0, scale: 2 } }),
    )
    // `W n` is the clip operator pair: without it a zoomed dish would cross a cut line.
    expect(/W\s*\nn/.test(content)).toBe(true)
  })

  it('draws no photo when the page had none', async () => {
    const content = await exportOne(makeCard({ photo: null }))
    expect(imageRect(content)).toEqual({ width: 0, height: 0 })
    // The words are still printed: a missing photo must not cost the recipe.
    expect(drawnText(content)).toContain('Kung Pao Chicken')
  })
})

describe('the card prints its own band heights', () => {
  /** The drawn image's height in points. */
  function imageHeight(content: string): number {
    const found = [...content.matchAll(/([\d.]+) 0 0 ([\d.]+) 0 0 cm/g)]
      .map((match) => ({ width: Number(match[1]), height: Number(match[2]) }))
      .filter((rect) => rect.width > 1 && rect.height > 1)
      .at(-1)
    return found?.height ?? 0
  }

  it('gives the photo whatever the two text boxes leave', async () => {
    // A tall portrait photo is limited by the picture box's height, so the box's height
    // is directly visible in the printed image.
    const portrait = { dataUrl: png(300, 500), widthPx: 300, heightPx: 500 }
    const roomy = await exportOne(
      makeCard({ photo: portrait, bands: { headerMm: 8, footerMm: 8 } }),
    )
    const cramped = await exportOne(
      makeCard({ photo: portrait, bands: { headerMm: 26, footerMm: 26 } }),
    )

    expect(imageHeight(roomy)).toBeGreaterThan(imageHeight(cramped))
  })

  it('anchors the instructions to the bottom of the card, whatever the header', async () => {
    const yOfLastText = (content: string): number => {
      const match = [...content.matchAll(/1 0 0 1 [\d.]+ ([\d.]+) Tm/g)].at(-1)
      return Number(match?.[1] ?? 0)
    }
    const shortHeader = await exportOne(makeCard({ bands: { headerMm: 8, footerMm: 20 } }))
    const tallHeader = await exportOne(makeCard({ bands: { headerMm: 26, footerMm: 20 } }))

    // The three zones tile the card, so the footer sits on the card's floor regardless.
    expect(yOfLastText(tallHeader)).toBeCloseTo(yOfLastText(shortHeader), 1)
  })
})

describe('unavailable card photos', () => {
  it('counts a broken photo as incomplete rather than silently claiming success', async () => {
    const key = cardKey(0, 'doc-a', 1)
    const photo = { dataUrl: 'data:image/png;base64,not-a-valid-png', widthPx: 10, heightPx: 10 }
    const result = await writeCards({
      settings: DEFAULT_SHEET, grid,
      pages: [{ documentId: 'doc-a', fileName: 'cards.pdf', pageNumber: 1, widthMm: 181, heightMm: 255 }],
      drawCutMarks: false, cards: { [key]: makeCard({ photo }) }, photos: { [key]: photo },
    })
    expect(result.cardsDrawn).toBe(0)
    expect(result.cardsSkipped).toBe(1)
  })
})

it('counts a missing card as skipped', async () => {
  const result = await writeCards({
    settings: DEFAULT_SHEET, grid,
    pages: [{ documentId: 'doc-a', fileName: 'cards.pdf', pageNumber: 1, widthMm: 181, heightMm: 255 }],
    drawCutMarks: false, cards: {}, photos: {},
  })
  expect(result.cardsDrawn).toBe(0)
  expect(result.cardsSkipped).toBe(1)
})

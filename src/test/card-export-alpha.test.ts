import { createCanvas } from '@napi-rs/canvas'
import { PDFDocument } from '@cantoo/pdf-lib'
import { describe, expect, it } from 'vitest'
import { writeCards } from '../lib/export/write-cards'
import { computeGrid } from '../lib/imposition/grid'
import { DEFAULT_SHEET } from '../types/imposition'
import { cardKey } from '../types/card'
import type { Card } from '../types/card'

/**
 * A cut-out photograph must reach the page as a *transparent* picture, not one flattened
 * onto white on the way — otherwise the card stock never shows through and the feature has
 * done nothing the print can see.
 *
 * Checked on the written bytes rather than on the preview, because a preview that paints
 * white behind the image looks identical and would pass a screenshot test forever.
 */

const grid = computeGrid(DEFAULT_SHEET)
const key = cardKey(0, 'doc-a', 1)

async function sourceBytes(): Promise<ArrayBuffer> {
  const doc = await PDFDocument.create()
  doc.addPage([181, 255])
  const bytes = await doc.save()
  const copy = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(copy).set(bytes)
  return copy
}

function cardWith(photo: Card['photo']): Card {
  return {
    headerText: 'CHK-01',
    bodyText: 'Plate with rice',
    photo,
    headerStyle: { bold: true, color: '#111827', highlight: null },
    bodyStyle: { bold: false, color: '#111827', highlight: null },
    imageTransform: { offsetXMm: 0, offsetYMm: 0, scale: 1 },
    bands: { headerMm: 14, footerMm: 20 },
  }
}

/**
 * The cut-out's whole point is that the card stock shows through — so the transparency has
 * to reach the page as a soft mask, not be flattened onto white somewhere between the
 * canvas and the PDF. A preview cannot tell the difference, so this reads the written file:
 * an alpha image produces a second image stream carrying `/SMask`, and an opaque one does
 * not. Both are asserted, or the first check would pass on a document that always wrote one.
 */
describe('a cut-out photo keeps its transparency in the PDF', () => {
  async function exportPng(dataUrl: string, widthPx: number, heightPx: number): Promise<string> {
    const photo = { dataUrl, widthPx, heightPx }
    const result = await writeCards({
      settings: DEFAULT_SHEET,
      grid,
      pages: [{ documentId: 'doc-a', fileName: 'cards.pdf', pageNumber: 1, widthMm: 181, heightMm: 255 }],
      sources: new Map([['doc-a', await sourceBytes()]]),
      drawCutMarks: false,
      cards: { [key]: cardWith(photo) },
      photos: { [key]: photo },
    })
    // The document as latin1 text: enough to see a dictionary key without a Node Buffer.
    let text = ''
    for (const byte of result.bytes) text += String.fromCharCode(byte)
    return text
  }

  const pngWith = (clear: boolean): string => {
    const canvas = createCanvas(40, 40)
    const context = canvas.getContext('2d')
    if (clear) context.clearRect(0, 0, 40, 40)
    else {
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, 40, 40)
    }
    context.fillStyle = '#c0392b'
    context.fillRect(12, 12, 16, 16)
    return `data:image/png;base64,${canvas.toBuffer('image/png').toString('base64')}`
  }

  it('writes a soft mask for a cut-out and none for an opaque photo', async () => {
    const cut = await exportPng(pngWith(true), 40, 40)
    const opaque = await exportPng(pngWith(false), 40, 40)

    expect(cut).toContain('/SMask')
    expect(opaque).not.toContain('/SMask')
  })
})

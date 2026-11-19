import { createCanvas } from '@napi-rs/canvas'

/**
 * A real PNG as a data URL, for export tests that need a card's picture band filled.
 *
 * Real bytes matter: `embedPng` rejects a stand-in string, and a test that passes a
 * placeholder would prove nothing about the picture reaching the page.
 */
export function tinyPng(colour = '#8e44ad'): string {
  const canvas = createCanvas(8, 8)
  const context = canvas.getContext('2d')
  context.fillStyle = colour
  context.fillRect(0, 0, 8, 8)
  return `data:image/png;base64,${canvas.toBuffer('image/png').toString('base64')}`
}

/**
 * Photos for pages 0..count-1, keyed `cellIndex|documentId|pageNumber`.
 *
 * Cell indexes restart on every sheet, which is what the exporter asks for.
 */
export function photosFor(
  count: number,
  documentId = 'doc-a',
  perSheet = 9,
): Record<string, string> {
  const png = tinyPng()
  const out: Record<string, string> = {}
  for (let index = 0; index < count; index += 1) {
    out[`${index % perSheet}|${documentId}|${index + 1}`] = png
  }
  return out
}

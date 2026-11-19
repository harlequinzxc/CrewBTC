/**
 * Turns a stored dish photo into bytes the PDF writer can embed.
 *
 * Photos are held as PNG data URLs (that is what the canvas produces and what the preview
 * shows). Anything else — an SVG, a blob URL, a malformed string — yields `null` so that
 * one bad card is skipped rather than failing the whole export.
 */
export function toPngBytes(dataUrl: string): Uint8Array | null {
  const match = /^data:image\/png;base64,(.+)$/s.exec(dataUrl.trim())
  if (match === null) return null

  try {
    const binary = atob(match[1] ?? '')
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
    return bytes.byteLength === 0 ? null : bytes
  } catch {
    return null
  }
}

/** The photo for one placed page, keyed `cellIndex|documentId|pageNumber`. */
export function photoFor(
  photos: Readonly<Record<string, string>>,
  cellIndex: number,
  documentId: string,
  pageNumber: number,
): Uint8Array | null {
  const url = photos[`${cellIndex}|${documentId}|${pageNumber}`]
  return url === undefined ? null : toPngBytes(url)
}

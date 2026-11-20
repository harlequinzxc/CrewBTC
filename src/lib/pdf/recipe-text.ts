import type { PDFPageProxy } from 'pdfjs-dist'

/**
 * Splits a recipe page's text into the card's header and footer.
 *
 * A recipe card is a code + dish name at the top, a photo, then a bordered box of
 * plating steps. Rather than hand the user an empty box, upload reads that split out of
 * the page itself:
 *
 *   header — the title lines above the photo
 *   footer — the instructions below it, one clean bullet per step
 *
 * Geometry decides the split, not wording: text above the middle is the title, text
 * below it is the instructions. A recipe in another language, or with no dish name at
 * all, still lands in the right band.
 */

export interface RecipeText {
  /** Header band: first line is the code, the rest is the dish name. */
  readonly header: string
  /** Footer band: one bullet per instruction. */
  readonly footer: string
  /** True when nothing useful was found, so the caller can say so. */
  readonly empty: boolean
}

export const EMPTY_RECIPE_TEXT: RecipeText = { header: '', footer: '', empty: true }

interface TextLine {
  readonly text: string
  /** Normalised 0–1 from the page's top. */
  readonly top: number
  readonly bottom: number
  readonly x: number
}

interface RawItem {
  readonly str?: unknown
  readonly transform?: unknown
  readonly width?: unknown
  readonly height?: unknown
}

/** Groups items into lines by shared baseline, then sorts them top to bottom. */
export function toLines(
  items: readonly RawItem[],
  pageWidthPt: number,
  pageHeightPt: number,
): readonly TextLine[] {
  if (pageWidthPt <= 0 || pageHeightPt <= 0) return []

  const entries: { text: string; x: number; top: number; baseline: number; sizePt: number }[] = []

  for (const item of items) {
    if (typeof item.str !== 'string' || item.str.trim() === '') continue
    const transform = item.transform
    if (!Array.isArray(transform) || transform.length < 6) continue
    const e = transform[4]
    const f = transform[5]
    if (typeof e !== 'number' || typeof f !== 'number') continue

    const sizePt = typeof transform[3] === 'number' ? Math.abs(transform[3]) : 10
    entries.push({
      text: item.str,
      x: e / pageWidthPt,
      baseline: f,
      top: 1 - (f + sizePt) / pageHeightPt,
      sizePt,
    })
  }

  if (entries.length === 0) return []

  // Same baseline (within half a line) means same line.
  entries.sort((left, right) => right.baseline - left.baseline || left.x - right.x)

  const groups: (typeof entries)[] = []
  for (const entry of entries) {
    const group = groups[groups.length - 1]
    const reference = group?.[0]
    if (group !== undefined && reference !== undefined && Math.abs(entry.baseline - reference.baseline) <= reference.sizePt * 0.5) {
      group.push(entry)
    } else {
      groups.push([entry])
    }
  }

  return groups.map((group) => {
    const ordered = [...group].sort((left, right) => left.x - right.x)
    const text = ordered.map((entry) => entry.text).join(' ').replace(/\s+/g, ' ').trim()
    const maxSize = Math.max(...ordered.map((entry) => entry.sizePt))
    return {
      text,
      x: ordered[0]?.x ?? 0,
      top: 1 - ((ordered[0]?.baseline ?? 0) + maxSize) / pageHeightPt,
      bottom: 1 - (ordered[0]?.baseline ?? 0) / pageHeightPt,
    }
  })
}

/** Numbered, bulleted, or plain — all reduced to the words of the step. */
export function stripStepMarker(line: string): string {
  return line
    .replace(/^\s*(?:[•·▪◦*‣-]|\d{1,2}[.)])\s*/u, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** One bullet per step, joined with newlines. */
export function formatSteps(lines: readonly string[]): string {
  const steps = lines
    .map(stripStepMarker)
    .filter((line) => line !== '')
    // A box border or a stray rule often extracts as punctuation only.
    .filter((line) => /[\p{L}\p{N}]/u.test(line))
  return steps.map((step) => `• ${step}`).join('\n')
}

/**
 * @param photoMiddle where the photo sits as a fraction of the page height, so the
 * header ends and the footer begins around it rather than at a guessed midpoint.
 */
export function splitRecipeText(
  lines: readonly TextLine[],
  photoMiddle = 0.5,
): RecipeText {
  const usable = lines
    .map((line) => ({ ...line, text: line.text.replace(/\s+/g, ' ').trim() }))
    .filter((line) => /[\p{L}\p{N}]/u.test(line.text))

  if (usable.length === 0) return EMPTY_RECIPE_TEXT

  // Text that starts above the middle of the photo belongs to the title block; text
  // that starts below it belongs to the instructions. The photo's own band is the
  // divider, which is more reliable than 50% of the page.
  const splitAt = photoMiddle
  const top = usable.filter((line) => line.top < splitAt)
  const below = usable.filter((line) => line.top >= splitAt)

  // A page with all its text at the top still has a title; a page with all of it at the
  // bottom still has instructions. Nothing is silently dropped.
  const headerSource = top.length > 0 ? top : usable.slice(0, 1)
  const footerSource = below.length > 0 ? below : usable.slice(headerSource.length)

  const header = headerSource
    .sort((left, right) => left.top - right.top)
    .map((line) => line.text)
    .join('\n')
    .trim()

  const footer = formatSteps(
    footerSource
      .sort((left, right) => left.top - right.top)
      .map((line) => line.text),
  )

  return { header, footer, empty: header === '' && footer === '' }
}

/** Reads and splits one page. Never throws: an unreadable page yields empty bands. */
export async function readRecipeText(
  page: PDFPageProxy,
  photoMiddle = 0.5,
): Promise<RecipeText> {
  try {
    const viewport = page.getViewport({ scale: 1 })
    const content = await page.getTextContent()
    const lines = toLines(
      content.items as readonly RawItem[],
      viewport.width,
      viewport.height,
    )
    return splitRecipeText(lines, photoMiddle)
  } catch {
    return EMPTY_RECIPE_TEXT
  }
}

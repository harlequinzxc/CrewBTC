import type { StyledBandInput, StyledSegment } from './styled-band'

/**
 * Turning raw card text into measurable lines.
 *
 * Split from `styled-band` when that file reached its line budget: the two functions here
 * are pure string work — what style a character has, and where a line may break — while the
 * file that remains is about picking a size that fits. They travel together, and
 * `layoutStyledBand` is their only caller.
 */

/** Splits text into consecutive same-style segments; newlines stay inside their segment. */
export function segmentByStyle(input: StyledBandInput): readonly StyledSegment[] {
  const { text, base, runs } = input
  const styleOf = (offset: number): StyledSegment => {
    const run = runs.find((item) => offset >= item.start && offset < item.end)
    if (run === undefined) return { ...base, text: '' }
    const style: StyledSegment = {
      text: '',
      bold: run.bold ?? base.bold,
      color: run.color ?? base.color,
      highlight: run.highlight === undefined ? base.highlight : run.highlight,
    }
    // Only assigned when present, so `exactOptionalPropertyTypes` keeps "absent" and
    // "explicitly left" as the different claims they are.
    const uppercase = run.uppercase ?? base.uppercase
    const align = run.align ?? base.align
    return {
      ...style,
      ...(uppercase === undefined ? {} : { uppercase }),
      ...(align === undefined ? {} : { align }),
    }
  }

  /*
    Capitals are produced per code point, not per segment: `toUpperCase` can change a
    string's length (`ß` → `SS`), which would shift every run offset after it and drag a
    highlight off its word. `Array.from` splits by code point rather than by UTF-16 unit, so
    an emoji or an accented pair stays one character instead of becoming two garbled ones.
  */
  const displayOf = (style: StyledSegment, raw: string): string =>
    (style.uppercase ?? base.uppercase) === true
      ? Array.from(raw, (ch) => ch.toUpperCase()).join('')
      : raw

  const out: StyledSegment[] = []
  let index = 0
  while (index < text.length) {
    const style = styleOf(index)
    let end = index + 1
    while (end < text.length) {
      const next = styleOf(end)
      if (
        next.bold !== style.bold ||
        next.color !== style.color ||
        next.highlight !== style.highlight ||
        (next.uppercase ?? false) !== (style.uppercase ?? false) ||
        (next.align ?? 'left') !== (style.align ?? 'left')
      ) {
        break
      }
      end += 1
    }
    out.push({ ...style, text: displayOf(style, text.slice(index, end)) })
    index = end
  }
  return out
}

/**
 * Greedy wrap over styled segments. A newline forces a break, a word that would overflow
 * starts a new line, and the style travels with each word so one line can be several
 * styles. Trailing whitespace is dropped from each visual line, as typesetting does.
 */
export function wrapSegments(
  segments: readonly StyledSegment[],
  maxWidthMm: number,
  measure: (text: string, bold: boolean) => number,
): readonly (readonly StyledSegment[])[] {
  const lines: StyledSegment[][] = []
  let current: StyledSegment[] = []
  let currentWidth = 0

  const pushLine = (): void => {
    if (current.length > 0) lines.push(current)
    current = []
    currentWidth = 0
  }

  for (const segment of segments) {
    for (const piece of segment.text.split(/(\n)/)) {
      if (piece === '\n') {
        pushLine()
        continue
      }
      if (piece === '') continue

      for (const word of piece.split(/(\s+)/)) {
        if (word === '') continue

        if (/^\s+$/.test(word)) {
          // Whitespace never starts a line and never forces one.
          if (current.length > 0) {
            current.push({ ...segment, text: word })
            currentWidth += measure(word, segment.bold)
          }
          continue
        }

        const width = measure(word, segment.bold)
        const hasWords = current.some((item) => item.text.trim() !== '')
        if (currentWidth + width > maxWidthMm && hasWords) pushLine()
        current.push({ ...segment, text: word })
        currentWidth += width
      }
    }
  }
  pushLine()

  return lines
    .map((line) => {
      const trimmed = [...line]
      while (trimmed.length > 0) {
        const last = trimmed[trimmed.length - 1]
        if (last === undefined) break
        const text = last.text.replace(/\s+$/, '')
        if (text === '') {
          trimmed.pop()
          continue
        }
        trimmed[trimmed.length - 1] = { ...last, text }
        break
      }
      return trimmed
    })
    .filter((line) => line.some((segment) => segment.text.trim() !== ''))
}

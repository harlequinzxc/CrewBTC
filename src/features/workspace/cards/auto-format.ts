import { CALLOUT_PRESETS, presetStyle } from '../../../types/callouts'
import { shiftRuns } from '../../../types/text-runs'
import type { Card } from '../../../types/card'
import { colorInto, styleSelection } from './card-edits'

export { EMPTY_KEYWORDS } from '../../../types/format-keywords'
import type { Keywords } from '../../../types/format-keywords'

type Category = keyof Keywords
interface Match { readonly start: number; readonly end: number; readonly category: Category }
const categories: readonly Category[] = ['crockeries', 'directions', 'condiments']

/** Whole words/phrases; longest overlap wins, with category order breaking ties. */
export function findMatches(text: string, keywords: Keywords): readonly Match[] {
  const candidates: Match[] = []
  for (const category of categories) {
    const phrases = new Set(keywords[category].split(/\r?\n/).map((word) => word.trim()).filter(Boolean))
    for (const phrase of phrases) {
      const literal = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const expression = new RegExp(`(?<![\\p{L}\\p{N}_])${literal}(?![\\p{L}\\p{N}_])`, 'giu')
      for (const match of text.matchAll(expression)) {
        candidates.push({ start: match.index, end: match.index + match[0].length, category })
      }
    }
  }
  candidates.sort((a, b) => (b.end - b.start) - (a.end - a.start) || categories.indexOf(a.category) - categories.indexOf(b.category) || a.start - b.start)
  const chosen: Match[] = []
  for (const match of candidates) {
    if (!chosen.some((item) => item.start < match.end && match.start < item.end)) chosen.push(match)
  }
  return chosen.sort((a, b) => b.start - a.start)
}

/** Add a bullet to each non-empty physical line; keep existing lists intact. */
function bulletBody(card: Card): Card {
  let text = card.bodyText
  let runs = card.bodyRuns ?? []
  const positions: number[] = []
  let offset = 0
  for (const line of text.split('\n')) {
    const dash = /^([ \t]*)- /u.exec(line)
    if (dash !== null) {
      const marker = offset + (dash[1]?.length ?? 0)
      text = `${text.slice(0, marker)}•${text.slice(marker + 1)}`
    } else if (line.trim() !== '' && !/^\s*(?:[•●▪◦*-]\s|\d+[.)]\s)/u.test(line)) positions.push(offset)
    offset += line.length + 1
  }
  for (const position of positions.reverse()) {
    text = `${text.slice(0, position)}• ${text.slice(position)}`
    runs = shiftRuns(runs, position, position, 2, text.length)
  }
  return text === card.bodyText ? card : { ...card, bodyText: text, bodyRuns: runs }
}

function formatZone(card: Card, zone: 'header' | 'body', keywords: Keywords): Card {
  let next = card
  const text = zone === 'header' ? card.headerText : card.bodyText
  for (const match of findMatches(text, keywords)) {
    let end = match.end
    if (match.category === 'crockeries') {
      const current = zone === 'header' ? next.headerText : next.bodyText
      const upper = current.slice(match.start, end).toUpperCase()
      if (upper !== current.slice(match.start, end)) {
        const changed = current.slice(0, match.start) + upper + current.slice(end)
        const runs = shiftRuns(zone === 'header' ? next.headerRuns ?? [] : next.bodyRuns ?? [], match.start, end, upper.length, changed.length)
        next = zone === 'header' ? { ...next, headerText: changed, headerRuns: runs } : { ...next, bodyText: changed, bodyRuns: runs }
        end = match.start + upper.length
      }
    }
    const selection = { start: match.start, end }
    if (match.category === 'directions') next = colorInto(next, zone, selection, '#b91c1c')
    else next = styleSelection(next, zone, selection, presetStyle(CALLOUT_PRESETS[match.category === 'crockeries' ? 0 : 1]!))
  }
  return next
}

export function automateCard(card: Card, keywords: Keywords): Card {
  return formatZone(formatZone(bulletBody(card), 'header', keywords), 'body', keywords)
}

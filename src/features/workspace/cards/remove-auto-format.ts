import { DEFAULT_TEXT_STYLE } from '../../../types/card'
import type { Card, TextStyle, TextRun } from '../../../types/card'
import { styleAt } from '../../../types/text-runs'

/** Stored styles do not retain preset provenance: matching colours are treated as callouts. */
function clearStyle(style: TextStyle, fallback: string): TextStyle {
  const crockeries = style.highlight === '#b91c1c'
  const condiments = style.highlight === '#86efac'
  const directions = style.color === '#b91c1c'
  if (!crockeries && !condiments && !directions) return style
  return {
    ...style,
    color: directions || (crockeries && style.color === '#ffffff') ? fallback : style.color,
    highlight: crockeries || condiments ? null : style.highlight,
    ...(crockeries ? { uppercase: false } : {}),
  }
}

function clearZone(card: Card, zone: 'header' | 'body'): Card {
  const base = zone === 'header' ? card.headerStyle : card.bodyStyle
  const runs = zone === 'header' ? card.headerRuns : card.bodyRuns
  const nextBase = clearStyle(base, DEFAULT_TEXT_STYLE.color)
  let changed = nextBase !== base
  const nextRuns = runs?.map((run): TextRun => {
    const effective = styleAt(base, [run], run.start)
    const cleared = clearStyle(effective, nextBase.color)
    if (cleared !== effective) changed = true
    // If the base changed, preserve each run's independent appearance as well.
    return nextBase !== base || cleared !== effective ? { ...run, ...cleared } : run
  })
  if (!changed) return card
  return zone === 'header'
    ? { ...card, headerStyle: nextBase, ...(nextRuns === undefined ? {} : { headerRuns: nextRuns }) }
    : { ...card, bodyStyle: nextBase, ...(nextRuns === undefined ? {} : { bodyRuns: nextRuns }) }
}

/** Clear only the three callout colours on both zones, without changing stored text. */
export function removeCalloutFormatting(card: Card): Card {
  return clearZone(clearZone(card, 'header'), 'body')
}

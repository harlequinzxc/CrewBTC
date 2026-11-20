import type { TextStyle } from './card'

/**
 * The two callout presets, and why they are not just "red" and "green".
 *
 * A plating card is read at arm's length by someone whose hands are busy, so it carries two
 * kinds of note that must never be confused for one another: what the dish is served in,
 * and what it is served with. Both are one click rather than three, because tagging them by
 * hand means picking a fill, then an ink, then remembering to capitalise — three decisions
 * where the card only has two meanings.
 *
 * Each preset is a **whole style**, not a highlight colour, so the pair can never be mixed
 * by applying one on top of the other. Applying CROCKERIES to text already tagged
 * CONDIMENTS replaces it outright.
 *
 * The inks are picked for contrast, not for taste: white on `#b91c1c` measures 6.5:1 and
 * black on `#86efac` measures 12.6:1, both clear of the 4.5:1 AA floor for normal text.
 * A green fill dark enough to carry white type would fail at this size.
 */

export interface CalloutPreset {
  /** Matches `data-preset` on the toolbar button and the exported card. */
  readonly id: 'crockeries' | 'condiments'
  /** Drawn on the swatch in caps, and used as its accessible name. */
  readonly label: string
  /** Fill behind the words. */
  readonly highlight: string
  /** Ink in front of them. */
  readonly color: string
  /** CROCKERIES is capitalised; CONDIMENTS is not, which is the distinction. */
  readonly uppercase: boolean
  /** One line, for a tooltip: what this tag means on a card. */
  readonly meaning: string
}

export const CALLOUT_PRESETS: readonly CalloutPreset[] = [
  {
    id: 'crockeries',
    label: 'CROCKERIES',
    highlight: '#b91c1c',
    color: '#ffffff',
    uppercase: true,
    meaning: 'What the dish is served in',
  },
  {
    id: 'condiments',
    label: 'CONDIMENTS',
    highlight: '#86efac',
    color: '#111827',
    uppercase: false,
    meaning: 'What the dish is served with',
  },
]

/** A preset as the style patch the editor and the exporter both apply. */
export function presetStyle(preset: CalloutPreset): TextStyle {
  return {
    bold: true,
    color: preset.color,
    highlight: preset.highlight,
    // Written out rather than omitted, because this preset's whole point is its case:
    // `undefined` would inherit the box's caps setting and CROCKERIES would print as
    // whatever the rest of the card happened to be. `exactOptionalPropertyTypes` is the
    // reason this is expressible at all — `false` and "no opinion" stay different things.
    uppercase: preset.uppercase,
  }
}

/** Which preset, if any, a style exactly matches. `null` when it matches neither. */
export function matchingPreset(style: TextStyle): CalloutPreset | null {
  return (
    CALLOUT_PRESETS.find(
      (preset) =>
        style.highlight === preset.highlight &&
        style.color === preset.color &&
        (style.uppercase ?? false) === preset.uppercase,
    ) ?? null
  )
}

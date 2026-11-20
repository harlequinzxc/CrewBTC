/**
 * The one place the chrome's colours are decided.
 *
 * Everything structural reads from these tokens: three layered surfaces, two text weights,
 * a hairline, and exactly one accent. Nothing in the app uses a raw `zinc-*`/`red-*`
 * utility for chrome any more, so a palette change is a change here rather than a hunt
 * through forty files.
 *
 * Numbers come from the §3.1 contrast gate, which checks the same hex values; if a token
 * moves, that script must move with it or the gate will disagree with the screen.
 */

export const SURFACE = {
  /** Behind the sheet — the darkest layer, so the paper reads as lit. */
  canvas: '#0D0E11',
  /** Side panels and the top bar. */
  panel: '#131418',
  /** Raised rows, inputs, and the inspector's own cards. */
  raised: '#1A1C22',
  /** Hover and selected states. */
  active: '#22252C',
} as const

export const TEXT = {
  primary: '#F4F4F6',
  secondary: '#A0A5B0',
  /** Deliberately quiet: metadata, never instructions. */
  muted: '#6E7480',
} as const

/**
 * One accent — one hue, three roles.
 *
 * `#E5484D` at its nominal value measures 3.91:1 against white, which is short of AA for a
 * 13px button label, so the hue is used at three depths instead of being tinted or faked:
 *
 * - `base`   rings, active borders, selection, the caret — anything non-text at 3:1.
 * - `solid`  fills carrying white text, five points deeper to clear 4.5:1.
 * - `bright` accent *text* on a dark panel, where `base` is only 4.7:1 and reads muddy.
 *
 * Three shades of one hue still count as one accent; what the rule forbids is a second
 * colour family competing for attention, and there isn't one.
 */
export const ACCENT = {
  base: '#E5484D',
  solid: '#D33A3F',
  bright: '#FF6369',
  /** Tinted fills behind selected rows. */
  wash: 'rgba(229, 72, 77, 0.14)',
} as const

/** 1px borders. A hairline at low opacity reads as an edge without drawing a line. */
export const HAIRLINE = 'rgba(255, 255, 255, 0.08)'
export const HAIRLINE_STRONG = 'rgba(255, 255, 255, 0.14)'

/** Chrome type sizes. 12–13px only; the sheet's own type is separate and physical. */
export const CHROME_TEXT = {
  label: '12px',
  control: '13px',
} as const

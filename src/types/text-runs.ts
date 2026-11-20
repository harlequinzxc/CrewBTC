import type { TextStyle } from './card'

/**
 * How much larger or smaller a card's type is drawn, as a multiple.
 *
 * This multiplier sets the requested sheet-wide type size. Text wraps at that size;
 * it does not shrink automatically when a band is too small.
 */
export const MIN_TEXT_SCALE = 0.6
export const MAX_TEXT_SCALE = 2

export const clampTextScale = (value: number): number =>
  !Number.isFinite(value)
    ? 1
    : Math.min(MAX_TEXT_SCALE, Math.max(MIN_TEXT_SCALE, Math.round(value * 100) / 100))

/**
 * Styling applied to part of a text box, on top of the box's own style.
 *
 * The box style is the default for every character; a run overrides it for one stretch.
 * `start` and `end` are offsets into the zone's plain text, `end` exclusive, and they
 * follow the text as it is edited (see `shiftRuns`) so a formatted word survives typing
 * around it.
 *
 * Only what is *overridden* is stored. `null` means "inherit", which keeps a run written
 * when the box was black correct after the box is recoloured.
 */
export interface TextRun {
  readonly start: number
  readonly end: number
  readonly bold?: boolean
  readonly color?: string
  readonly highlight?: string | null
  readonly uppercase?: boolean
  readonly align?: 'left' | 'center'
}

/**
 * Copies only the properties that are actually defined.
 *
 * `exactOptionalPropertyTypes` is on, and rightly: `{ uppercase: undefined }` and `{}` are
 * different claims — the first says "this run has no opinion", the second says nothing at
 * all. Spreading an optional value straight in would quietly widen the type and let a
 * later reader treat "undefined" as "explicitly off".
 */
const withOptional = <T extends object>(base: T, extra: Record<string, unknown>): T => {
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) }
  for (const [key, value] of Object.entries(extra)) {
    if (value !== undefined) out[key] = value
  }
  return out as T
}

/** Runs kept in order, non-overlapping, and inside the text's length. */
export function normaliseRuns(runs: readonly TextRun[], length: number): readonly TextRun[] {
  const cleaned = runs
    .map((run) => ({
      ...run,
      start: Math.max(0, Math.min(Math.trunc(run.start), length)),
      end: Math.max(0, Math.min(Math.trunc(run.end), length)),
    }))
    .filter((run) => run.end > run.start)
    .sort((left, right) => left.start - right.start || left.end - right.end)

  // Overlaps are resolved by letting the earlier run keep its ground: a selection edit
  // normally replaces runs outright, so surviving overlaps are stale and trimming them
  // is safer than carrying two answers for one character.
  const out: TextRun[] = []
  let cursor = 0
  for (const run of cleaned) {
    const start = Math.max(run.start, cursor)
    if (run.end > start) {
      out.push({ ...run, start })
      cursor = run.end
    }
  }
  return out
}

/**
 * Moves runs in step with a text edit, so a highlighted phrase keeps its highlight.
 *
 * `changeStart`/`changeEnd` describe the replaced span in the *old* text; `newLength` is
 * what replaced it. A run wholly inside the replaced span is dropped; one that merely
 * spans across it grows or shrinks with the edit.
 */
export function shiftRuns(
  runs: readonly TextRun[],
  changeStart: number,
  changeEnd: number,
  newLength: number,
  nextLength: number,
): readonly TextRun[] {
  const delta = newLength - (changeEnd - changeStart)
  const moved: TextRun[] = []

  for (const run of runs) {
    // Entirely before the edit.
    if (run.end <= changeStart) {
      moved.push(run)
      continue
    }
    // Entirely inside the replaced span: the text it styled is gone.
    if (run.start >= changeStart && run.end <= changeEnd) continue
    // Entirely after: slide it.
    if (run.start >= changeEnd) {
      moved.push({ ...run, start: run.start + delta, end: run.end + delta })
      continue
    }
    // Straddles the edit: keep the surviving prefix and suffix, joined across the change.
    const start = run.start < changeStart ? run.start : changeStart + newLength
    const end = run.end > changeEnd ? run.end + delta : changeStart + newLength
    if (end > start) moved.push({ ...run, start, end })
  }

  return normaliseRuns(moved, nextLength)
}

/** The run covering an offset, or undefined when it inherits the box style. */
export function runAt(runs: readonly TextRun[], offset: number): TextRun | undefined {
  return runs.find((run) => offset >= run.start && offset < run.end)
}

/** A base style plus the runs that override parts of it — what a layout is built from. */
export interface StyledText {
  readonly text: string
  readonly base: TextStyle
  readonly runs: readonly TextRun[]
}

/** The style in force at one character: the box style with any run's overrides applied. */
export function styleAt(base: TextStyle, runs: readonly TextRun[], offset: number): TextStyle {
  const run = runAt(runs, offset)
  if (run === undefined) return base
  // A run that says nothing about caps or alignment inherits the box's, rather than
  // resetting it: otherwise a one-word colour change would un-centre a heading.
  return withOptional(
    {
      bold: run.bold ?? base.bold,
      color: run.color ?? base.color,
      highlight: run.highlight === undefined ? base.highlight : run.highlight,
    },
    { uppercase: run.uppercase ?? base.uppercase, align: run.align ?? base.align },
  )
}

/** Every offset where the effective style changes, plus 0 — the boundaries to lay out. */
export function styleBreakpoints(runs: readonly TextRun[], length: number): readonly number[] {
  const points = new Set<number>([0])
  for (const run of runs) {
    if (run.start > 0 && run.start < length) points.add(run.start)
    if (run.end > 0 && run.end < length) points.add(run.end)
  }
  return [...points].sort((left, right) => left - right)
}

/**
 * Applies one change to every character in a selection, splitting runs at its edges so
 * the result is a selection-only edit rather than a whole-box one.
 */
export function applyToSelection(
  base: TextStyle,
  runs: readonly TextRun[],
  selection: { readonly start: number; readonly end: number },
  patch: Partial<Omit<TextRun, 'start' | 'end'>>,
): readonly TextRun[] {
  const { start, end } = selection
  if (end <= start) return runs

  const kept: TextRun[] = []
  for (const run of runs) {
    if (run.end <= start || run.start >= end) {
      kept.push(run)
      continue
    }
    // Slice off the parts that lie outside the selection.
    if (run.start < start) kept.push({ ...run, end: start })
    if (run.end > end) kept.push({ ...run, start: end })
  }

  // The selected span inherits whatever it looked like, then takes the change.
  const inherited = styleAt(base, runs, start)
  const applied = withOptional<TextRun>(
    {
      start,
      end,
      bold: patch.bold ?? inherited.bold,
      color: patch.color ?? inherited.color,
      highlight: patch.highlight === undefined ? inherited.highlight : patch.highlight,
    },
    { uppercase: patch.uppercase ?? inherited.uppercase, align: patch.align ?? inherited.align },
  )
  return normaliseRuns([...kept, applied], Number.MAX_SAFE_INTEGER)
}

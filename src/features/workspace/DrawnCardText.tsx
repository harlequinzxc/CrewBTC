import type { CSSProperties } from 'react'
import type { StyledLine } from '../../lib/export/styled-band'

/**
 * The card text as it is **drawn** — the opposite of the editable field beside it.
 *
 * Split out because it is a stateless leaf, and because the editing branch that remains in
 * `CardZoneText` had grown to the file budget explaining three separate focus defects. A
 * line is placed absolutely from the same `layoutBand` measurement the exporter uses, so
 * what is on screen breaks where the printed card breaks.
 */
export interface DrawnCardTextProps {
  readonly lines: readonly StyledLine[]
  readonly positionPx: (line: StyledLine) => string
  /** The line's own left edge, already including padding or centring slack. */
  readonly leftPx: (line: StyledLine) => string
  readonly box: CSSProperties
  /**
   * The inset the drawn lines are positioned from, in pixels.
   *
   * It must be the same number the editable field uses (`0.8 mm` at the current scale),
   * not a Tailwind step. `p-1` is 4 px at any zoom; the field inset scales with the sheet.
   * The two disagreeing by a fraction of a pixel is enough to shift every line sideways
   * when the box is clicked — the jump this component exists to prevent.
   */
  readonly insetPx: string
  readonly label: string
  readonly onBeginEdit: () => void
  readonly onPress: (event: React.PointerEvent<HTMLButtonElement>) => void
  /** Lets the sheet-level gesture open this specific box. */
  readonly attach: (element: HTMLButtonElement | null) => void
  readonly onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => void
}

export function DrawnCardText(props: DrawnCardTextProps) {
  return (
    <button
      type="button"
      data-target="dense"
      ref={(element) => props.attach(element)}
      onPointerDown={props.onPress}
      onClick={(event) => {
        event.stopPropagation()
        props.onBeginEdit()
      }}
      onKeyDown={props.onKeyDown}
      // Chrome-free: a sheet box is a picture of paper. The only affordances are the
      // cursor and the focus ring, neither of which moves a glyph.
      className="zone-box absolute block cursor-text overflow-hidden border-0 bg-transparent p-0 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      /*
        The same box model the field uses, so the two states occupy one rectangle.

        `insetPx` is the field's own millimetre padding, and the surface and corner come
        from `props.box`, which `CardZoneText` fills with the field's values. An earlier
        draft of this block re-declared `background: 'transparent'` and `color: 'inherit'`
        *after* the spread, which silently undid both — the surface stayed see-through and
        clicking still changed the box. Anything set after the spread has to be something
        the spread does not carry.
      */
      style={{ ...props.box, padding: props.insetPx, outlineOffset: 0 }}
      aria-label={props.label}
    >
      {props.lines.map((line, index) => (
        <span
          key={`${index}-${line.text}`}
          // A line is a run of segments, each with the style it was measured in. Bold
          // characters are wider, so per-segment styling is what keeps on-screen breaks
          // equal to the ones the exporter computed.
          /*
            `pointer-events-none` on every glyph run. The press must belong to the button,
            whose handler is the one that starts the edit — a span that receives it is a
            span that has to be trusted to bubble, and text still has to be selectable.
            This also makes the target independent of where on the line the pointer lands:
            a one-pixel-tall glyph and an empty pixel both resolve to the button.
          */
          className="pointer-events-none absolute whitespace-pre"
          /*
            `left` comes from the layout, not from zero. A centred line starts partway into
            the box, and the layout is the only thing that knows by how much: it measured
            the line's width with the same metrics the exporter uses, so the two agree on
            where the first glyph sits. Left-aligned lines report the plain padding here,
            which is where they have always started.
          */
          style={{ top: props.positionPx(line), left: props.leftPx(line), fontWeight: 400 }}
        >
          {line.segments.map((segment, segmentIndex) => (
            <span
              key={`${segmentIndex}-${segment.text}`}
              style={{
                background: segment.highlight ?? 'transparent',
                color: segment.color,
                fontWeight: segment.bold ? 700 : 400,
              }}
            >
              {segment.text}
            </span>
          ))}
        </span>
      ))}
    </button>
  )
}

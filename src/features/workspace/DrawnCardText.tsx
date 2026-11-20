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
  readonly box: CSSProperties
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
      className="zone-box absolute block cursor-text overflow-hidden border-0 bg-transparent p-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      style={props.box}
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
          style={{ top: props.positionPx(line), left: 0, fontWeight: 400 }}
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

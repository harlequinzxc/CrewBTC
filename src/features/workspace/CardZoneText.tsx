import { useEffect, useRef } from 'react'
import { layoutStyledBand } from '../../lib/export/styled-band'
import type { TextStyle, TextRun } from '../../types/card'

export interface CardZoneTextProps {
  readonly text: string
  /** Pixels per millimetre of the preview. */
  readonly scale: number
  /** Card-relative geometry of this box. */
  readonly widthMm: number
  readonly heightMm: number
  readonly xMm: number
  readonly yMm: number
  readonly style: TextStyle
  /** Per-selection styling on top of `style`. */
  readonly runs: readonly TextRun[]
  readonly editing: boolean
  /** Reports the live selection so the formatting bar can act on it. */
  readonly onSelectionChange: (selection: { readonly start: number; readonly end: number } | null) => void
  readonly maxPt: number
  /** Multiplier on the size the layout settles on. 1 is unmodified. */
  readonly textScale?: number
  readonly placeholder: string
  readonly onBeginEdit: () => void
  readonly onChange: (text: string) => void
  readonly onEndEdit: () => void
  readonly onStyle: (style: TextStyle) => void
}

/** Points to millimetres — the one conversion this component needs. */
const PT_TO_MM = 25.4 / 72

/** Line pitch, matching the exporter so a break lands on the same line in both. */
const LINE_HEIGHT = 1.25

/** Approximate width of a character at a given size, used for on-screen wrapping only. */
const measure = (text: string, sizePt: number): number => text.length * sizePt * 0.5 * PT_TO_MM

/**
 * One text zone of a card: typeset at its true size, editable in place.
 *
 * The line breaking on screen comes from `layoutBand` — the same function the exporter
 * uses — so words wrap onto the same lines on the sheet as on paper. Below a legibility
 * floor the type is drawn larger rather than as a smudge; the breaks still match.
 */
export function CardZoneText(props: CardZoneTextProps) {
  const { text, scale, widthMm, heightMm, xMm, yMm, style, editing } = props
  const fieldRef = useRef<HTMLTextAreaElement>(null)
  const px = (mm: number): string => `${mm * scale}px`

  useEffect(() => {
    if (!editing) return
    const field = fieldRef.current
    if (field === null) return
    field.focus()
    field.select()
  }, [editing])

  // `layoutBand` measures down from `boxTopMm`, so the box's own top is passed rather
  // than a height. This is the same function the exporter calls, which is what keeps a
  // line break in the same place on screen and on paper.
  const shown = text === '' ? props.placeholder : text
  // The multiplier is applied to the *requested* size, so `layoutBand` still shrinks the
  // result until it fits — a bigger scale wraps sooner rather than overflowing.
  const layout = layoutStyledBand(
    {
      text: shown,
      // A placeholder is never styled: it is a hint, not content.
      base: {
        text: '',
        bold: text === '' ? false : style.bold,
        color: text === '' ? '#9ca3af' : style.color,
        highlight: text === '' ? null : style.highlight,
      },
      runs: text === '' ? [] : props.runs,
    },
    0,
    widthMm,
    heightMm,
    props.maxPt * (props.textScale ?? 1),
    LINE_HEIGHT,
    (candidate, sizePt, bold) => (bold ? measure(candidate, sizePt) * 1.06 : measure(candidate, sizePt)),
  )
  // Drawn at the size the layout chose, with no legibility floor. A constant floor is
  // what made a 10 mm header overflow into the photo: at this preview scale a floor of
  // 9 px is many millimetres of type, and it grew instead of shrinking to fit.
  const fontSize = Math.max(0, layout.sizePt * scale * PT_TO_MM)
  const lineHeight = fontSize * LINE_HEIGHT

  // A block shorter than its band is centred in it rather than pinned to the top. Text is
  // drawn at the largest size that fits, so a zone taller than it needs is a zone with
  // room to spare — dividing that room either side is what makes a hand-tuned tall band
  // look deliberate, instead of leaving one conspicuous gap under the words.
  const blockMm = layout.lines.length * layout.sizePt * LINE_HEIGHT * PT_TO_MM
  // Slack is what the inner box has left over, never less than nothing. A block that
  // overflows (the layout keeps a legibility floor, so a very short band can hold more
  // than it should) therefore gets no offset at all and is clipped at the box edge, rather
  // than being lifted until it covers the card above it.
  const slackMm = Math.max(0, heightMm - 2 * 0.8 - blockMm)
  const centreMm = slackMm / 2

  // Lines are placed on the band's own rhythm so the drawn block is no taller than the
  // block `layoutBand` measured — the check that guarantees it fits. `yMm` is the baseline
  // and already carries the band's padding, so only the ascent comes off it.
  const positionPx = (line: (typeof layout.lines)[number]): string =>
    `${(line.yMm - layout.sizePt * LINE_HEIGHT * PT_TO_MM + centreMm) * scale}px`

  if (editing) {
    return (
      <textarea
        ref={fieldRef}
        value={text}
        onChange={(event) => props.onChange(event.target.value)}
        onBlur={props.onEndEdit}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation()
            props.onEndEdit()
          }
          // Enter makes a new line; only the sheet's own shortcuts are swallowed.
          event.stopPropagation()
        }}
        onPointerDown={(event) => event.stopPropagation()}
        onSelect={(event) => {
          const field = event.currentTarget
          const start = field.selectionStart
          const end = field.selectionEnd
          props.onSelectionChange(end > start ? { start, end } : null)
        }}
        className="zone-box absolute resize-none overflow-hidden rounded-sm border-0 bg-white/95 p-1 outline outline-2 outline-accent"
        style={{
          left: px(xMm),
          top: px(yMm),
          width: px(widthMm),
          height: px(heightMm),
          fontSize,
          lineHeight: `${lineHeight}px`,
          color: style.color,
          fontWeight: style.bold ? 700 : 400,
          // A highlight tint behind the field, so the box does not hide what is styled.
          background: style.highlight ?? 'rgba(255,255,255,0.95)',
        }}
        aria-label="Edit card text"
      />
    )
  }

  return (
    <button
      type="button"
      data-target="dense"
      onClick={(event) => {
        event.stopPropagation()
        props.onBeginEdit()
      }}
      className="zone-box absolute block cursor-text overflow-hidden border-0 bg-transparent p-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      style={{
        left: px(xMm),
        top: px(yMm),
        width: px(widthMm),
        height: px(heightMm),
        fontSize,
        lineHeight: `${lineHeight}px`,
        fontWeight: 400,
      }}
      aria-label={`Card text: ${text === '' ? props.placeholder : text}`}
    >
      {layout.lines.map((line, index) => (
        <span
          key={`${index}-${line.text}`}
          // A line is a run of segments, each with the style it was measured in. Bold
          // characters are wider, so per-segment styling is what keeps on-screen breaks
          // equal to the ones the exporter computed.
          className="absolute whitespace-pre"
          style={{ top: positionPx(line), left: 0, fontWeight: 400 }}
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

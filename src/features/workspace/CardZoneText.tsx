import { useCallback, useEffect, useRef } from 'react'
import { DrawnCardText } from './DrawnCardText'
import type { TextEditGesture } from './use-text-edit-gesture'
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
  /** The sheet's shared press gesture; see `use-text-edit-gesture`. */
  readonly gesture: TextEditGesture
  readonly onChange: (text: string) => void
  readonly onEndEdit: () => void
  readonly onStyle: (style: TextStyle) => void
}

/** Points to millimetres — the one conversion this component needs. */
const PT_TO_MM = 25.4 / 72

/** Line pitch, matching the exporter so a break lands on the same line in both. */
const LINE_HEIGHT = 1.25
/** The exporter's band padding (`PADDING_MM` in `draw-card`). Previews must match it. */
const PADDING_MM = 0.8

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

  /**
   * Focus the field once per edit, from an effect.
   *
   * **Not from a ref callback.** A ref callback runs on every commit where the field is
   * re-attached, and this one called `focus()` when the field was not already focused.
   * That looks like a harmless guard and is not: it re-focuses the field during renders
   * the user did not ask for, and the churn is enough that the press never settles into a
   * caret — clicking the text appeared to do nothing at all. It shipped in v1.8.1 and made
   * every version after it unable to open a text box, which is exactly what was reported
   * for four releases running.
   *
   * The caret goes to the **end**, not to a selection. `select()` made the first keystroke
   * replace the whole dish name: type "X" into "Kung Pao Chicken" and you are left with
   * "X", which reads as the text being broken rather than edited.
   */
  const takeFocus = useCallback((field: HTMLTextAreaElement | null) => {
    if (field === null) return
    field.focus({ preventScroll: true })
    const end = field.value.length
    field.setSelectionRange(end, end)
  }, [])

  useEffect(() => {
    if (!editing) return
    const field = fieldRef.current
    if (field === null) return
    // `preventScroll`: a bare `focus()` scrolls the nearest scrollable ancestor to reveal
    // the element, which moved the stack under the pointer.
    takeFocus(field)
  }, [editing, takeFocus])

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
  const innerMm = Math.max(0, heightMm - PADDING_MM * 2)
  // Slack is what the inner box has left over, never less than nothing. A block that
  // overflows gets no offset at all rather than being lifted until it covers the card
  // above it; the box below clips it, which is the backstop, not the plan — `layoutBand`
  // has already picked a size that fits, and only a band dragged shorter than its own
  // type can get here.
  const centreMm = Math.max(0, innerMm - blockMm) / 2

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
        /*
          Blur is not the same thing as "the user finished".

          A newly focused element blurs for reasons that have nothing to do with the user:
          the window losing focus to another window, a scroll, a layout shift caused by the
          field mounting in the first place. Any of those ended the edit, and since the
          editor is only ever closed here, a blur that arrives milliseconds after the press
          closes the box as soon as it opens — mount and unmount inside one gesture.

          So the end of an edit is decided by *what the user did next*, not by focus. The
          box closes on Escape (below), or when the press moves somewhere else (the sheet's
          own deselect), or when the user clicks another card. `focusout` is kept only as a
          fallback for the one legitimate case: focus moving to another control that is not
          part of this box.
        */
        onBlur={(event) => {
          const next = event.relatedTarget as Node | null
          /*
            Focus leaving to nothing at all is not a user action: a window that lost focus,
            a scroll, a layout shift caused by the field itself mounting. Keep the editor
            open — and put the caret back, because a field that is open but not focused
            takes no typing, which looks exactly as broken as one that never opened.
          */
          if (next === null) {
            window.setTimeout(() => {
              if (document.activeElement !== event.currentTarget) takeFocus(fieldRef.current)
            }, 0)
            return
          }
          // Moving between the field and something inside the same zone is not a finish.
          if (event.currentTarget.contains(next)) return
          props.onEndEdit()
        }}
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
        className="zone-box absolute resize-none overflow-hidden rounded-sm border-0 bg-white/95 outline outline-2 outline-accent"
        // Same 0.8 mm inset as the drawn text, so the caret starts where the glyphs will.
        // Without it the field's own padding made the first character jump left by 4px
        // the moment editing ended.
        style={{
          left: px(xMm),
          top: px(yMm),
          width: px(widthMm),
          height: px(heightMm),
          padding: px(PADDING_MM),
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
    <DrawnCardText
      lines={layout.lines}
      positionPx={positionPx}
      label={`Card text: ${text === '' ? props.placeholder : text}`}
      onBeginEdit={props.onBeginEdit}
      onPress={(event) => {
        // Proof of arrival for the click probe: see `use-click-probe`.
        ;(event.currentTarget as HTMLElement).dataset.pressHandled = 'true'
        props.gesture.press(event, props.onBeginEdit)
      }}
      attach={(element) => props.gesture.register(element, props.onBeginEdit)}
      onKeyDown={(event) => {
        // The formatting bar overlays the pane once editing begins, so the field cannot be
        // relied on to receive its own Escape.
        if (event.key === 'Escape' && editing) {
          event.stopPropagation()
          props.onEndEdit()
        }
      }}
      box={{
        left: px(xMm),
        top: px(yMm),
        width: px(widthMm),
        height: px(heightMm),
        fontSize,
        lineHeight: `${lineHeight}px`,
        fontWeight: 400,
      }}
    />
  )
}

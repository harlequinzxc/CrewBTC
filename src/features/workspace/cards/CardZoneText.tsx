import { CARD_FONT_STACK } from '../../../types/card-typography'
import { DrawnCardText } from './DrawnCardText'
import { TextFieldLayer } from './TextFieldLayer'
import type { TextEditGesture } from './use-text-edit-gesture'
import { layoutZone, PADDING_MM } from './zone-layout'
import type { TextStyle, TextRun } from '../../../types/card'

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
  /** Centres a short block in its box. The name box does; the steps box does not. */
  readonly centreVertically?: boolean
  readonly onBeginEdit: () => void
  /** The sheet's shared press gesture; see `use-text-edit-gesture`. */
  readonly gesture: TextEditGesture
  readonly onChange: (text: string) => void
  readonly onEndEdit: () => void
  readonly onStyle: (style: TextStyle) => void
}

/**
 * One text zone of a card: typeset at its true size, editable in place.
 *
 * The line breaking on screen comes from `layoutBand` — the same function the exporter
 * uses — so words wrap onto the same lines on the sheet as on paper. Below a legibility
 * floor the type is drawn larger rather than as a smudge; the breaks still match.
 */
export function CardZoneText(props: CardZoneTextProps) {
  const { text, scale, widthMm, heightMm, xMm, yMm, style, editing } = props
  const px = (mm: number): string => `${mm * scale}px`

  // The typesetting, in millimetres converted to this sheet's pixels. Same function the
  // exporter calls, which is what keeps a line break in the same place on screen and on
  // paper — and now keeps a centred heading centred in both.
  const { layout, fontSize, lineHeight, positionPx, leftPx, caps, centrePx, textTopPx } = layoutZone(
    {
      text,
      placeholder: props.placeholder,
      style,
      runs: props.runs,
      widthMm,
      heightMm,
      maxPt: props.maxPt,
      textScale: props.textScale ?? 1,
      // The name is a heading and centres in its band; the steps start at the top.
      centreVertically: props.centreVertically ?? false,
    },
    scale,
  )

  if (editing) {
    return (
      <TextFieldLayer
        text={text}
        placeholder={props.placeholder}
        style={style}
        caps={caps}
        xMm={xMm}
        yMm={yMm}
        widthMm={widthMm}
        heightMm={heightMm}
        fontSize={fontSize}
        lineHeight={lineHeight}
        centrePx={centrePx}
        textTopPx={textTopPx}
        px={px}
        onChange={props.onChange}
        onEndEdit={props.onEndEdit}
        onSelectionChange={props.onSelectionChange}
      />
    )
  }

  return (
    <DrawnCardText
      lines={layout.lines}
      positionPx={positionPx}
      leftPx={leftPx}
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
      // The field's own padding, so the two states cannot drift apart.
      insetPx={px(PADDING_MM)}
      box={{
        left: px(xMm),
        top: px(yMm),
        width: px(widthMm),
        height: px(heightMm),
        fontSize,
        fontFamily: CARD_FONT_STACK,
        lineHeight: `${lineHeight}px`,
        color: style.color,
        fontWeight: style.bold ? 700 : 400,
        // The paper white the field paints: nothing changes when the caret arrives.
        background: style.highlight ?? 'rgba(255,255,255,0.95)',
        // `rounded-sm` in this Tailwind build, written out: the class is on the field and
        // inline styles beat utilities, so the drawn box has to carry the same value.
        borderRadius: '0.25rem',
      }}
    />
  )
}

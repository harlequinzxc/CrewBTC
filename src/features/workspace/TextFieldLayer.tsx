import { useEffect, useRef } from 'react'
import type { TextStyle } from '../../types/card'
import { PADDING_MM } from './zone-layout'

/**
 * The editable half of a text box: a textarea that occupies exactly the drawn box's
 * rectangle, so the caret arrives without anything moving.
 *
 * Split out of `CardZoneText` when that file hit its line budget. The split is natural:
 * this component owns one thing the drawn one does not — focus — and the reasons it is
 * handled so oddly are worth a file that can explain them without being read in a hurry.
 */
export interface TextFieldLayerProps {
  readonly text: string
  readonly placeholder: string
  readonly style: TextStyle
  readonly caps: boolean
  readonly xMm: number
  readonly yMm: number
  readonly widthMm: number
  readonly heightMm: number
  readonly fontSize: number
  readonly lineHeight: number
  readonly px: (mm: number) => string
  readonly onChange: (text: string) => void
  readonly onEndEdit: () => void
  readonly onSelectionChange: (
    selection: { readonly start: number; readonly end: number } | null,
  ) => void
}

/** Moves the caret to the end rather than selecting everything. */
const takeFocus = (field: HTMLTextAreaElement): void => {
  field.focus({ preventScroll: true })
  const end = field.value.length
  field.setSelectionRange(end, end)
}

export function TextFieldLayer(props: TextFieldLayerProps) {
  const { text, style, caps, px } = props
  const fieldRef = useRef<HTMLTextAreaElement>(null)

  /*
    Focus the field once per edit, from an effect. **Not from a ref callback.** A ref
    callback runs on every commit where the field is re-attached, and calling `focus()`
    there looked like a harmless guard while re-focusing during renders the user did not
    ask for — enough churn that the press never settled into a caret, so clicking the text
    appeared to do nothing at all. It shipped in v1.8.1 and broke every version after it.
  */
  useEffect(() => {
    const field = fieldRef.current
    if (field !== null) takeFocus(field)
  }, [])

  return (
    <textarea
      ref={fieldRef}
      value={text}
      onChange={(event) => props.onChange(event.target.value)}
      /*
        A lost focus never ends an edit. Not "sometimes": never.

        `onBlur={onEndEdit}` closed the box on any focus loss, and a newly focused field
        blurs on its own — window focus, a scroll, the layout shift from the field
        mounting. Ignoring a blur to nothing was still not enough: something takes focus
        one frame after any field appears, and it is not the user. So the editor closes on
        Escape, on a press elsewhere, or on the card being deselected — all things a user
        did, delivered as user actions rather than inferred from focus.

        The focus is taken *back* rather than merely kept, because a field that is open and
        unfocused takes no typing, which looks exactly as broken as one that never opened —
        with one exception, below.
      */
      onBlur={() => {
        window.setTimeout(() => {
          const field = fieldRef.current
          if (field === null) return
          if (document.activeElement === field) return
          /*
            The exception: a deliberate move into the formatting bar.

            Taking focus back unconditionally made the bar unreachable by keyboard — Tab
            landed on it, this handler pulled it away again, and Tab appeared to cycle
            between the field and nothing. The presets were mouse-only, which is exactly
            the kind of thing a pointer-driven test never notices.

            The bar is the one place focus may go, because it only exists while this field
            is being edited and its controls act on this field. Anything else that takes
            focus — a scroll, a window change, a layout shift — still gets it back.
          */
          const next = document.activeElement
          if (next instanceof HTMLElement && next.closest('[data-testid="card-text-bar"]') !== null) {
            return
          }
          takeFocus(field)
        }, 0)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation()
          props.onEndEdit()
        }
        /*
          Tab leaves the box for the formatting bar, not for the next card.

          The bar is rendered by the sheet, above the cards in document order, so plain Tab
          from the field walked *forwards* to the neighbouring zone — a place the user was
          not going, and one whose button then had the caret pulled back out of it. Sending
          Tab to the bar explicitly is what makes the presets reachable without a mouse.
          Shift+Tab keeps the browser's own behaviour.
        */
        if (event.key === 'Tab' && !event.shiftKey) {
          const bar = document.querySelector('[data-testid="card-text-bar"]')
          const first = bar?.querySelector('button')
          if (first instanceof HTMLElement) {
            event.preventDefault()
            first.focus()
          }
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
      /*
        Every property here matches `DrawnCardText`, so a caret is the only difference
        between the two states. They used to differ in padding (a Tailwind step against a
        scaled millimetre inset), surface and corner radius — which is the jump.

        `placeholder:text-[#9ca3af] placeholder:opacity-100` pins the hint to the grey the
        drawn box uses. Left alone the browser draws it as the field's own ink at half
        alpha: right in isolation, wrong here, where nothing may change on focus.
      */
      className="zone-box absolute resize-none overflow-hidden rounded-sm border-0 bg-white/95 outline outline-2 outline-accent placeholder:text-[#9ca3af] placeholder:opacity-100"
      style={{
        left: px(props.xMm),
        top: px(props.yMm),
        width: px(props.widthMm),
        height: px(props.heightMm),
        padding: px(PADDING_MM),
        fontSize: props.fontSize,
        lineHeight: `${props.lineHeight}px`,
        color: style.color,
        fontWeight: style.bold ? 700 : 400,
        // A highlight tint behind the field, so the box does not hide what is styled.
        background: style.highlight ?? 'rgba(255,255,255,0.95)',
        /*
          The last two properties are what make a preset look the same in both states.
          `textAlign` centres the caret and the typing; `textTransform` capitalises what is
          drawn while `value` keeps the characters the user typed, which is why a
          CROCKERIES tag can be switched off again without having lost anything. The
          transform is inherited by `::placeholder`, so the hint capitalises too.
        */
        textAlign: style.align === 'center' ? 'center' : 'left',
        textTransform: caps ? 'uppercase' : 'none',
      }}
      /*
        A placeholder on the field, where there was none.

        The drawn box shows "Plating steps" for an empty zone and the field showed nothing,
        so clicking an empty bottom box made its hint vanish. A `placeholder` is not
        content: it cannot be typed over or saved, and it disappears once there is a value.
      */
      placeholder={props.placeholder}
      aria-label="Edit card text"
    />
  )
}

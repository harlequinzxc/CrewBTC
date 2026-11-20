import { CARD_FONT_STACK, CARD_LINE_HEIGHT, CARD_TEXT_PT, cornerHeightMm } from '../../types/card-typography'
import { ptToMm } from '../../lib/units'
import type { Card } from '../../types/card'

interface Props {
  readonly card: Card
  readonly scale: number
  readonly widthMm: number
  readonly onInteract: () => void
  readonly onChange: (patch: Pick<Card, 'numberStart'> | Pick<Card, 'cornerLabelStart'>) => void
}

/** Two equal overlay fields; print uses slightly less vertical padding. */
export function CardCornerLabels({ card, scale, widthMm, onChange, onInteract }: Props) {
  const textScale = card.textScale ?? 1
  const fontSize = ptToMm(CARD_TEXT_PT * textScale) * scale
  const style = {
    width: `${widthMm * 0.22 * scale}px`, height: `${cornerHeightMm(textScale) * scale}px`,
    fontFamily: CARD_FONT_STACK, fontSize: `${fontSize}px`, lineHeight: `${fontSize * CARD_LINE_HEIGHT}px`,
    fontWeight: 700, textAlign: 'center' as const,
  }
  const field = 'absolute top-0 z-20 box-border min-w-0 border border-zinc-400 bg-zinc-200 p-0 text-black'
  return (
    <>
      <select data-corner-label title="Choose a card number" onFocus={onInteract} aria-label="Card number" value={card.displayNumber ?? 1} style={{ ...style, textAlignLast: 'center' }} className={`${field} left-0 appearance-none`} onChange={(event) => onChange({ numberStart: Number(event.target.value) })}>
        {Array.from({ length: 40 }, (_, i) => <option value={i + 1} key={i}>{i + 1}</option>)}
      </select>
      <input data-corner-label onFocus={onInteract} aria-label="Card corner label" placeholder="XXXXX" value={card.displayCornerLabel ?? card.cornerLabelStart ?? card.cornerLabel ?? ''} title="Changes this and following card labels" style={style} className={`${field} right-0`} onChange={(event) => onChange({ cornerLabelStart: event.target.value })} />
    </>
  )
}

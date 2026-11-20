import type { Card } from '../../types/card'

interface Props {
  readonly card: Card
  readonly scale: number
  readonly widthMm: number
  readonly onChange: (patch: Pick<Card, 'numberStart'> | Pick<Card, 'cornerLabel'>) => void
}

/** Two equal overlay fields; geometry is shared with the PDF renderer. */
export function CardCornerLabels({ card, scale, widthMm, onChange }: Props) {
  const style = { width: `${widthMm * 0.22 * scale}px`, height: `${5 * scale}px`, fontSize: `${2.47 * scale * (card.textScale ?? 1)}px` }
  const field = 'absolute top-0 z-20 box-border min-w-0 border border-zinc-400 bg-zinc-200 px-0.5 text-black leading-none'
  return (
    <>
      <select data-corner-label aria-label="Card number" value={card.displayNumber ?? 1} style={style} className={`${field} left-0`} onChange={(event) => onChange({ numberStart: Number(event.target.value) })}>
        {Array.from({ length: 40 }, (_, i) => <option value={i + 1} key={i}>{i + 1}</option>)}
      </select>
      <input data-corner-label aria-label="Card corner label" placeholder="XXXXX" value={card.cornerLabel ?? ''} style={style} className={`${field} right-0`} onChange={(event) => onChange({ cornerLabel: event.target.value })} />
    </>
  )
}

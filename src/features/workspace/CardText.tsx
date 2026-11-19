import { layoutBand } from '../../lib/export/text-band'

export interface CardTextProps {
  readonly text: string
  /** Pixels per millimetre of the preview. */
  readonly scale: number
  readonly widthMm: number
  readonly bandMm: number
  readonly maxPt: number
  readonly className: string
}

/**
 * Header or footer copy, typeset at its real size.
 *
 * Sizing comes from `layoutBand` — the very function the exporter uses — so the words
 * break onto the same lines on screen as they will on paper. An earlier version used a
 * fixed 8 px in the browser and computed millimetres in the PDF, so the preview lied
 * about both the size and the line breaks.
 *
 * Below roughly 5 px the real size is unreadable, so the type is drawn at a legible
 * floor instead of becoming a smudge. The line breaks still match the print, which is
 * the part that matters for checking your copy.
 */
export function CardText(props: CardTextProps) {
  const { text, scale, widthMm, bandMm, maxPt, className } = props
  if (text.trim() === '') return null

  // Rough Helvetica advance; exact per-pixel metrics are unavailable before paint, and
  // a small over-estimate breaks lines slightly early rather than overflowing.
  const measure = (candidate: string, sizePt: number): number =>
    candidate.length * 0.5 * sizePt * (25.4 / 72)

  const layout = layoutBand(text, 0, widthMm, bandMm, maxPt, 1.18, measure, {
    paddingMm: 0.8,
  })
  if (layout.lines.length === 0) return null

  const pxPerPt = scale * (25.4 / 72)
  const sizePx = Math.max(5, layout.sizePt * pxPerPt)

  return (
    <div className={className} style={{ paddingLeft: `${0.8 * scale}px`, paddingTop: `${0.8 * scale}px` }}>
      {layout.lines.map((line, index) => (
        <div
          key={`${index}-${line.text}`}
          style={{ fontSize: `${sizePx}px`, lineHeight: 1.18, whiteSpace: 'pre' }}
        >
          {line.text}
        </div>
      ))}
    </div>
  )
}

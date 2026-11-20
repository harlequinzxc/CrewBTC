import type { ReactNode } from 'react'

/**
 * A label and its control on one 26px line.
 *
 * Label left, control right, no description under either. Ten of these occupy the height
 * two old form fields did, which is how the whole sheet setup now fits in a rail without
 * scrolling past the sheet.
 */
export interface RowProps {
  readonly label: string
  readonly children: ReactNode
}

export function Row({ label, children }: RowProps) {
  return (
    <div className="flex min-h-6 items-center justify-between gap-2">
      <span className="shrink-0 text-[11px] text-ink-secondary">{label}</span>
      <div className="flex min-w-0 flex-1 items-center justify-end">{children}</div>
    </div>
  )
}

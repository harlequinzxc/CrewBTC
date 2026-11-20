import type { ReactNode } from 'react'

/**
 * A label and its control on one 24px line.
 *
 * Label left, control right, no description under either. The 24px is the input's own
 * height: a row taller than its field is padding around nothing, and seven of those add up
 * to the empty strip that used to sit under the last control.
 */
export interface RowProps {
  readonly label: string
  readonly children: ReactNode
}

export function Row({ label, children }: RowProps) {
  return (
    <div className="flex h-6 items-center justify-between gap-2">
      <span className="shrink-0 text-[11px] text-ink-secondary">{label}</span>
      <div className="flex min-w-0 flex-1 items-center justify-end">{children}</div>
    </div>
  )
}

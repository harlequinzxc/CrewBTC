import type { ReactNode } from 'react'

/**
 * One titled block of the inspector.
 *
 * A hairline above, 12px uppercase label, optional single action on the right. No
 * description under the title: the section is named after the thing it edits, which is
 * the whole explanation.
 */
export interface SectionProps {
  readonly title: string
  readonly action?: ReactNode | undefined
  readonly children: ReactNode
}

export function Section({ title, action, children }: SectionProps) {
  return (
    <section className="border-b border-hairline px-3 py-2.5 last:border-b-0">
      <div className="mb-1.5 flex h-4 items-center justify-between">
        <h2 className="text-[11px] font-medium uppercase tracking-[0.06em] text-ink-secondary">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  )
}

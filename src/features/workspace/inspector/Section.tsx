import { useId, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'

/** Inspector section, optionally collapsible without unmounting its controls. */
export interface SectionProps {
  readonly title: string
  readonly action?: ReactNode | undefined
  readonly children: ReactNode
  readonly collapsible?: boolean
  readonly initiallyOpen?: boolean
}

export function Section({ title, action, children, collapsible = false, initiallyOpen = true }: SectionProps) {
  const [open, setOpen] = useState(initiallyOpen)
  const id = useId()
  return <section className="border-b border-hairline px-3 py-2 last:border-b-0">
    <div className="flex min-h-8 items-center justify-between gap-1">
      <h2 className="min-w-0 flex-1 text-[11px] font-medium uppercase tracking-[0.06em] text-ink-secondary">
        {collapsible ? <button type="button" data-target="dense" aria-label={`Toggle ${title} section`} aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)} className="flex min-h-8 w-full items-center gap-1 text-left hover:text-ink-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">{open ? <ChevronDown aria-hidden className="size-3 shrink-0" /> : <ChevronRight aria-hidden className="size-3 shrink-0" />}<span>{title}</span></button> : title}
      </h2>
      {action}
    </div>
    {collapsible ? <div id={id} className="inspector-accordion" data-expanded={open} aria-hidden={!open} inert={!open}>
      <div><div className="pt-1">{children}</div></div>
    </div> : <div id={id} className="pt-1">{children}</div>}
  </section>
}

import { useId } from 'react'
import { cn } from '../../lib/cn'

export interface FormFieldProps {
  readonly label: string
  readonly error?: string | undefined
  readonly hint?: string | undefined
  readonly children: (props: { readonly id: string }) => React.ReactNode
  readonly className?: string | undefined
}

/** Label wrapper for controls that are not `<Input />`/`<Select />`. */
export function FormField({ label, error, hint, children, className }: FormFieldProps) {
  const id = useId()
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <span id={`${id}-label`} className="text-sm font-medium text-zinc-300">
        {label}
      </span>
      {children({ id })}
      {hint === undefined ? null : <p className="text-xs text-zinc-400">{hint}</p>}
      {error === undefined ? null : (
        <p role="alert" className="text-xs text-rose-400">
          {error}
        </p>
      )}
    </div>
  )
}

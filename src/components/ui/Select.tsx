import { useId } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '../../lib/cn'

export interface SelectOption {
  readonly value: string
  readonly label: string
}

export interface SelectProps
  extends Omit<React.ComponentPropsWithoutRef<'select'>, 'className' | 'id'> {
  readonly label: string
  readonly options: readonly SelectOption[]
  readonly className?: string | undefined
}

/** §2: h-12, text-base, red focus ring, associated label, native control for
 *  keyboard and screen-reader parity (§3A). */
export function Select({ label, options, className, ...rest }: SelectProps) {
  const id = useId()

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-medium text-zinc-300">
        {label}
      </label>
      <div className="relative">
        <select
          {...rest}
          id={id}
          className={cn(
            'h-12 w-full appearance-none rounded-lg border border-zinc-700 bg-zinc-900',
            'px-3 pr-10 text-base text-zinc-50',
            'transition-[border-color,box-shadow] duration-150 ease-out',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500',
          )}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden="true"
          strokeWidth={2}
          className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400"
        />
      </div>
    </div>
  )
}

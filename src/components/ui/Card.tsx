import { cn } from '../../lib/cn'

export interface CardProps extends Omit<React.ComponentPropsWithoutRef<'section'>, 'className'> {
  readonly className?: string | undefined
  readonly padded?: boolean | undefined
}

/** §2: rounded-2xl, p-4 mobile / p-5 desktop, one hairline border, one elevation level. */
export function Card({ className, padded = true, children, ...rest }: CardProps) {
  return (
    <section
      {...rest}
      className={cn(
        'rounded-2xl border border-zinc-800 bg-zinc-900',
        padded && 'p-4 lg:p-5',
        className,
      )}
    >
      {children}
    </section>
  )
}

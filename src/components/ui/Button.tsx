import { Spinner } from './Spinner'
import { cn } from '../../lib/cn'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

const VARIANTS: Record<ButtonVariant, string> = {
  // §3.1: red-700 carries white 14px text at 6.47:1. red-500 behind small white text fails AA.
  primary:
    'bg-red-700 text-white hover:bg-red-600 focus-visible:bg-red-600 disabled:bg-red-900 disabled:text-red-200/60',
  secondary:
    'border border-zinc-700 bg-zinc-900 text-zinc-50 hover:border-zinc-600 hover:bg-zinc-800 focus-visible:border-zinc-600 focus-visible:bg-zinc-800',
  ghost:
    'text-zinc-300 hover:bg-zinc-800 hover:text-zinc-50 focus-visible:bg-zinc-800 focus-visible:text-zinc-50',
  danger:
    'border border-red-900 bg-red-950/40 text-red-200 hover:bg-red-900/60 focus-visible:bg-red-900/60',
}

// §4.1 target ladder lives in CSS, keyed off `data-target` (see index.css).
// Only non-size utilities belong here.
const SIZES: Record<ButtonSize, string> = {
  sm: 'gap-1.5 px-2.5 text-sm',
  md: 'gap-2 px-4 text-sm',
  lg: 'gap-2 px-5 text-base',
}

export interface ButtonProps {
  readonly variant?: ButtonVariant | undefined
  readonly size?: ButtonSize | undefined
  readonly loading?: boolean | undefined
  readonly fullWidth?: boolean | undefined
  readonly className?: string | undefined
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  fullWidth = false,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps & Omit<React.ComponentPropsWithoutRef<'button'>, 'className'>) {
  const isBusy = loading || rest['aria-busy'] === true

  return (
    <button {...rest} type={type} data-target={size === 'sm' ? 'dense' : 'default'} disabled={disabled === true || isBusy} aria-busy={isBusy || undefined} className={cn(
        'inline-flex select-none items-center justify-center rounded-lg font-medium',
        'transition-[background-color,border-color,color,opacity,transform] duration-150 ease-out',
        'active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60',
        'disabled:cursor-not-allowed disabled:active:scale-100',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500',
        'focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950',
        VARIANTS[variant],
        SIZES[size],
        fullWidth && 'w-full',
        className,
      )}
    >
      {loading ? <Spinner className="size-4" label="Working" /> : null}
      {children}
    </button>
  )
}

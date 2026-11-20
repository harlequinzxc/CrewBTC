import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RotateCw } from 'lucide-react'

/**
 * A render error must not white-screen the app.
 *
 * React unmounts the whole tree when a render throws, so without a boundary one bad card
 * — a malformed stored snapshot, a photo that decodes to nothing — leaves a blank page and
 * takes every unsaved edit with it. This catches it, keeps the chrome, and offers the one
 * action that can help.
 *
 * **It is a class, and that is not negotiable.** `getDerivedStateFromError` and
 * `componentDidCatch` have no hook equivalent; a function component cannot be a boundary.
 *
 * The reload is deliberately a *button*, not an automatic recovery: reloading is the only
 * thing that clears a broken render, and doing it silently would discard the very state
 * the boundary exists to protect.
 */
export interface ErrorBoundaryProps {
  readonly children: ReactNode
  /** Shown instead of the default copy. Keep it about the surface, not the exception. */
  readonly title?: string
}

interface State {
  readonly error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, State> {
  override state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // The console is the only sink this app has; a boundary that swallows the stack makes
    // the report from the user impossible to act on.
    console.error('Render failed', error, info.componentStack)
  }

  override render(): ReactNode {
    const { error } = this.state
    if (error === null) return this.props.children

    return (
      <div role="alert" className="grid min-h-[100svh] place-items-center bg-surface-canvas p-6">
        <div className="w-full max-w-sm rounded-lg border border-hairline bg-surface-panel p-5 text-center">
          <AlertTriangle aria-hidden className="mx-auto size-5 text-accent-bright" />
          <h1 className="mt-2 text-[13px] font-medium text-ink-primary">
            {this.props.title ?? 'Something went wrong'}
          </h1>
          <p className="mt-1 text-[11px] leading-relaxed text-ink-secondary">
            The screen could not be drawn. Reloading is the only way out of this, and it
            will clear anything not yet exported.
          </p>
          <button
            type="button"
            data-target="dense"
            onClick={() => window.location.reload()}
            className="mx-auto mt-3 flex h-8 items-center gap-1.5 rounded-md bg-accent-solid px-3 text-[12px] font-medium text-white transition-colors duration-150 ease-out hover:bg-accent-bright focus-visible:bg-accent-bright"
          >
            <RotateCw aria-hidden className="size-3.5" />
            Reload
          </button>
          <p className="mt-3 select-text break-words text-left text-[10px] text-ink-muted">
            {error.message}
          </p>
        </div>
      </div>
    )
  }
}

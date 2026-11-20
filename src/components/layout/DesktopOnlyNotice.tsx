import { MonitorUp } from 'lucide-react'

/**
 * §4 override, declared in the project README: this build targets desktop. Below
 * 1024px we state the constraint instead of rendering a crushed 3-pane layout.
 */
export function DesktopOnlyNotice() {
  return (
    <div className="flex min-h-[100svh] items-center justify-center bg-surface-canvas p-6">
      <div className="max-w-sm rounded-xl border border-hairline bg-surface-panel p-6 text-center">
        <span className="mx-auto mb-3 grid size-11 place-items-center rounded-xl bg-surface-active">
          <MonitorUp aria-hidden="true" strokeWidth={2} className="size-5 text-accent-bright" />
        </span>
        <h1 className="text-base font-semibold text-ink-primary">Designed for desktop</h1>
        <p className="mt-1.5 text-sm text-ink-secondary">
          This needs a wider window for the template canvas. Widen this browser window to
          at least 1024 pixels to continue.
        </p>
      </div>
    </div>
  )
}

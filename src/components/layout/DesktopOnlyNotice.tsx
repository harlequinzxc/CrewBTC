import { MonitorUp } from 'lucide-react'

/**
 * §4 override, declared in the project README: this build targets desktop. Below
 * 1024px we state the constraint instead of rendering a crushed 3-pane layout.
 */
export function DesktopOnlyNotice() {
  return (
    <div className="flex min-h-[100svh] items-center justify-center bg-zinc-950 p-6">
      <div className="max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-center">
        <span className="mx-auto mb-3 grid size-11 place-items-center rounded-xl bg-zinc-800">
          <MonitorUp aria-hidden="true" strokeWidth={2} className="size-5 text-red-400" />
        </span>
        <h1 className="text-base font-semibold text-zinc-50">Designed for desktop</h1>
        <p className="mt-1.5 text-sm text-zinc-400">
          This needs a wider window for the template canvas. Widen this browser window to
          at least 1024 pixels to continue.
        </p>
      </div>
    </div>
  )
}

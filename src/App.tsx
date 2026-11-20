import { MotionProvider } from './features/settings/MotionProvider'
import { ToastHub } from './components/ui/ToastHub'
import { useToasts } from './components/ui/use-toasts'
import { WorkspaceScreen } from './features/workspace/WorkspaceScreen'
import { DesktopOnlyNotice } from './components/layout/DesktopOnlyNotice'
import { DESKTOP_QUERY, useMediaQuery } from './lib/use-media-query'

export default function App() {
  return (
    <MotionProvider>
      <Shell />
    </MotionProvider>
  )
}

/**
 * The window is either a workspace or a notice, and the workspace never stops existing.
 *
 * The notice used to *replace* the workspace below 1024px, which unmounted it — and an
 * unmount throws away everything that lives only in memory: the uploaded PDFs, the photos
 * extracted from them, every card edit, and the zoom you had chosen. Dragging a window
 * narrower than 1024px and back was enough to lose a session's work.
 *
 * So the workspace is always mounted. Below the breakpoint it is hidden with `display`
 * and taken out of the accessible tree, which keeps its state, its effects and its refs
 * intact while the notice is what you see. Widening the window brings the sheet back
 * exactly as it was.
 */
function Shell() {
  const isDesktop = useMediaQuery(DESKTOP_QUERY)
  const toasts = useToasts()

  return (
    <>
      <div
        // `hidden` rather than a conditional render: this is the whole fix. `inert` and
        // `aria-hidden` only apply while it is hidden, so a screen reader is never told
        // about a sheet it cannot see, and a focus ring cannot land inside it either.
        className={isDesktop ? 'contents' : 'hidden'}
        {...(isDesktop ? {} : { inert: true, 'aria-hidden': true })}
      >
        <WorkspaceScreen notify={toasts.show} />
        <ToastHub api={toasts} />
      </div>

      {isDesktop ? null : <DesktopOnlyNotice />}
    </>
  )
}

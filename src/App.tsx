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

/** Desktop-only by decision (README §4 override). Chosen in JS rather than media
 *  classes so the same branch holds in tests and in a browser. */
function Shell() {
  const isDesktop = useMediaQuery(DESKTOP_QUERY)
  const toasts = useToasts()
  if (!isDesktop) return <DesktopOnlyNotice />

  return (
    <>
      <WorkspaceScreen notify={toasts.show} />
      <ToastHub api={toasts} />
    </>
  )
}

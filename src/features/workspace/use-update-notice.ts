import { useEffect, useRef } from 'react'
import { reloadPage } from './reload-page'

/**
 * Noticing that a newer build has taken over, and offering to reload.
 *
 * The service worker is generated with `registerType: 'autoUpdate'`, so a new worker
 * calls `skipWaiting()` + `clientsClaim()` and takes control as soon as it is
 * installed. That is only half the job: the *page* is still running the old JavaScript
 * it loaded into memory, so without this the app looks unchanged until the user
 * refreshes by hand — which is exactly how "the fix didn't work" gets reported against
 * a version that was never actually running.
 *
 * Reloading automatically is the other half, and it is worse than it sounds. A reload
 * throws away everything held in memory: the cards, their photos, whatever was typed
 * but not yet exported. A background tab left open overnight would reload itself and
 * lose that work with no warning.
 *
 * So: detect the change, say so, and let the user choose when. One reload per worker,
 * and never before the page has settled.
 */

export interface UpdateNotice {
  /**
   * Reloads into the new version. The caller decides *when* — this hook never does it
   * on its own, because a reload discards whatever the user has not saved.
   */
  readonly reload: () => void
}

/** How long to wait after load before treating a controller change as an update. */
const SETTLE_MS = 1500

/**
 * Watches for the service worker being replaced.
 *
 * Returns `available: false` outside a browser, when there is no service worker, or
 * when this is the first install — a first install also fires `controllerchange`, and
 * reloading then would cost the user a pointless page load.
 */
export function useUpdateNotice(onAvailable: () => void): UpdateNotice {
  // Held in a ref so the listener, attached once, always calls the latest callback.
  // Assigned in an effect rather than during render: writing a ref while rendering is
  // unsafe under concurrent rendering, where a render can be thrown away.
  const notifyRef = useRef(onAvailable)
  useEffect(() => {
    notifyRef.current = onAvailable
  }, [onAvailable])
  const announcedRef = useRef(false)
  const settleRef = useRef(false)

  useEffect(() => {
    // Read it once: `navigator.serviceWorker` is absent in jsdom, in some embedded
    // browsers, and in a non-secure context, and a stale reference is how the cleanup
    // ends up calling into `undefined`.
    const workers = typeof navigator === 'undefined' ? undefined : navigator.serviceWorker
    if (workers === undefined || workers === null) return

    // A page that loaded *with* a controller means this is an update, not a first
    // install: the previous build was already in charge.
    const wasControlled = workers.controller !== null
    const timer = window.setTimeout(() => {
      settleRef.current = true
    }, SETTLE_MS)

    const onControllerChange = (): void => {
      // Ignore the first install, and ignore a change that lands while the page is
      // still starting up — mid-render reloads look like a crash.
      if (!wasControlled || !settleRef.current) return
      if (announcedRef.current) return

      announcedRef.current = true
      notifyRef.current()
    }

    workers.addEventListener('controllerchange', onControllerChange)
    return () => {
      window.clearTimeout(timer)
      workers.removeEventListener('controllerchange', onControllerChange)
    }
  }, [])

  // One implementation of "reload safely", shared with the app's toast.
  return { reload: reloadPage }
}

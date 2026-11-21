import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useUpdateNotice } from '../../features/workspace/use-update-notice'

/**
 * Noticing that a new build has taken over.
 *
 * The service worker updates itself (`skipWaiting` + `clientsClaim`), but the page
 * keeps running the JavaScript it already loaded, so an update is invisible until the
 * document reloads. These tests pin down the two things that go wrong here: reloading
 * on a *first* install, and reloading without warning while the user has unsaved cards.
 */

/** A service worker container the hook can subscribe to, driven by the test. */
function installServiceWorker(controlled: boolean) {
  type Listener = () => void
  const listeners = new Set<Listener>()

  const container = {
    controller: controlled ? {} : null,
    addEventListener: (_type: string, listener: Listener) => listeners.add(listener),
    removeEventListener: (_type: string, listener: Listener) => listeners.delete(listener),
  }

  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    writable: true,
    value: container,
  })

  return {
    /** Fires `controllerchange` as a new worker taking over would. */
    takeOver: () => {
      for (const listener of [...listeners]) listener()
    },
    listenerCount: () => listeners.size,
  }
}

/**
 * Replaces `window.location` with a plain object whose `reload` is spyable.
 *
 * jsdom makes `location.reload` non-configurable, so it cannot be spied on in place.
 */
function reloadStub(): ReturnType<typeof vi.fn> {
  const reload = vi.fn()
  const fake = { reload } as unknown as Location
  vi.spyOn(window, 'location', 'get').mockReturnValue(fake)
  return reload
}

const original = navigator.serviceWorker

afterEach(() => {
  vi.useRealTimers()
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    writable: true,
    value: original,
  })
  vi.restoreAllMocks()
})

beforeEach(() => {
  vi.useFakeTimers()
})

describe('a new build taking over', () => {
  it('says nothing on a first install', async () => {
    // No controller means this page IS the first version; there is nothing newer.
    const worker = installServiceWorker(false)
    const onAvailable = vi.fn()

    renderHook(() => useUpdateNotice(onAvailable))
    await act(async () => {
      vi.advanceTimersByTime(5000)
    })

    worker.takeOver()
    await act(async () => {
      vi.advanceTimersByTime(100)
    })
    expect(onAvailable).not.toHaveBeenCalled()
  })

  it('announces once a new worker takes over an already-controlled page', async () => {
    const worker = installServiceWorker(true)
    const onAvailable = vi.fn()

    renderHook(() => useUpdateNotice(onAvailable))
    await act(async () => {
      vi.advanceTimersByTime(2000)
    })

    worker.takeOver()
    expect(onAvailable).toHaveBeenCalledTimes(1)
  })

  it('does not reload the page by itself', async () => {
    // The whole point: the user keeps their unsaved cards until they choose to reload.
    const worker = installServiceWorker(true)
    const reload = reloadStub()

    renderHook(() => useUpdateNotice(vi.fn()))
    await act(async () => {
      vi.advanceTimersByTime(2000)
    })
    worker.takeOver()
    await act(async () => {
      vi.advanceTimersByTime(5000)
    })

    expect(reload).not.toHaveBeenCalled()
  })

  it('stays quiet while the page is still starting up', async () => {
    // A controller change during the first second of load is MID-RENDER, and reloading
    // there looks like the app crashed.
    const worker = installServiceWorker(true)
    const onAvailable = vi.fn()

    renderHook(() => useUpdateNotice(onAvailable))
    worker.takeOver()
    await act(async () => {
      vi.advanceTimersByTime(100)
    })

    expect(onAvailable).not.toHaveBeenCalled()
  })

  it('announces only once, however many changes arrive', async () => {
    const worker = installServiceWorker(true)
    const onAvailable = vi.fn()

    renderHook(() => useUpdateNotice(onAvailable))
    await act(async () => {
      vi.advanceTimersByTime(2000)
    })

    worker.takeOver()
    worker.takeOver()
    worker.takeOver()
    expect(onAvailable).toHaveBeenCalledTimes(1)
  })

  it('stops listening once unmounted', async () => {
    const worker = installServiceWorker(true)
    const onAvailable = vi.fn()

    const { unmount } = renderHook(() => useUpdateNotice(onAvailable))
    await act(async () => {
      vi.advanceTimersByTime(2000)
    })
    expect(worker.listenerCount()).toBe(1)

    unmount()
    expect(worker.listenerCount()).toBe(0)

    worker.takeOver()
    expect(onAvailable).not.toHaveBeenCalled()
  })

  it('does nothing when the browser has no service worker', async () => {
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      writable: true,
      value: undefined,
    })
    const onAvailable = vi.fn()

    expect(() => renderHook(() => useUpdateNotice(onAvailable))).not.toThrow()
    expect(onAvailable).not.toHaveBeenCalled()
  })
})

describe('reloading into the new version', () => {
  it('reloads when asked, just after the current task', async () => {
    installServiceWorker(true)
    const reload = reloadStub()

    const { result } = renderHook(() => useUpdateNotice(vi.fn()))
    act(() => {
      result.current.reload()
    })
    // Not synchronous: the new worker needs its activation to finish first.
    expect(reload).not.toHaveBeenCalled()

    await act(async () => {
      vi.advanceTimersByTime(10)
    })
    expect(reload).toHaveBeenCalledTimes(1)
  })
})

describe('the notice the user actually sees', () => {
  it('offers a Reload action rather than reloading by itself', async () => {
    const worker = installServiceWorker(true)
    const { ToastHub } = await import('../../components/ui/ToastHub')
    const { useToasts } = await import('../../components/ui/use-toasts')
    const { render, screen } = await import('@testing-library/react')

    function Host() {
      const toasts = useToasts()
      const update = useUpdateNotice(() =>
        toasts.show({
          variant: 'info',
          title: 'New version ready',
          undo: () => update.reload(),
          action: 'Reload',
        }),
      )
      return <ToastHub api={toasts} />
    }

    render(<Host />)
    await act(async () => {
      vi.advanceTimersByTime(2000)
    })
    worker.takeOver()
    await act(async () => {
      vi.advanceTimersByTime(50)
    })

    expect(screen.getByText('New version ready')).toBeInTheDocument()
    // The action is a button, so reloading is a choice rather than a surprise.
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument()
  })
})

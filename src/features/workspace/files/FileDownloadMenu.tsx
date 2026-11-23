import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  readonly position: { readonly x: number; readonly y: number }
  readonly onDownload: () => void
  readonly onClose: (restoreFocus: boolean) => void
}

/** A single action, portalled so the scrolling file list cannot clip it. */
export function FileDownloadMenu({ position, onDownload, onClose }: Props) {
  const menu = useRef<HTMLDivElement>(null)
  useEffect(() => {
    menu.current?.querySelector('button')?.focus()
    const down = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node)) onClose(false)
    }
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(true) }
    }
    const scroll = () => onClose(false)
    document.addEventListener('pointerdown', down, true)
    document.addEventListener('keydown', key)
    window.addEventListener('scroll', scroll, true)
    return () => {
      document.removeEventListener('pointerdown', down, true)
      document.removeEventListener('keydown', key)
      window.removeEventListener('scroll', scroll, true)
    }
  }, [onClose])
  return createPortal(
    <div ref={menu} role="menu" aria-label="File options" style={{ left: Math.max(0, Math.min(position.x, window.innerWidth - 180)), top: Math.max(0, Math.min(position.y, window.innerHeight - 48)) }} className="fixed z-50 w-44 rounded-lg border border-hairline bg-surface-raised p-1 shadow-xl shadow-black/50">
      <button type="button" role="menuitem" data-target="dense" onClick={onDownload} className="min-h-8 w-full rounded px-3 py-2 text-left text-[12px] text-ink-primary hover:bg-surface-active focus-visible:bg-surface-active">Download original</button>
    </div>, document.body,
  )
}

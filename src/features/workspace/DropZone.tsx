import { useCallback, useState } from 'react'
import { FileUp } from 'lucide-react'
import { cn } from '../../lib/cn'
import { isPdfFile } from '../../lib/pdf/ingest'

export interface DropZoneProps {
  readonly onFiles: (files: readonly File[]) => void
  readonly disabled?: boolean | undefined
}

/** Drag-and-drop surface. HTML5 DnD plus a visible trigger keeps this keyboard-reachable. */
export function DropZone({ onFiles, disabled }: DropZoneProps) {
  const [active, setActive] = useState(false)

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      setActive(false)
      if (disabled === true) return
      const files = Array.from(event.dataTransfer.files).filter(isPdfFile)
      if (files.length > 0) onFiles(files)
    },
    [disabled, onFiles],
  )

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault()
        if (disabled !== true) setActive(true)
      }}
      onDragLeave={() => setActive(false)}
      onDrop={handleDrop}
      className={cn(
        'flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-8 text-center',
        'transition-colors duration-150 ease-out',
        active ? 'border-red-600 bg-red-950/20' : 'border-zinc-800 bg-zinc-900/40',
        disabled === true && 'opacity-60',
      )}
    >
      <FileUp aria-hidden="true" strokeWidth={2} className="size-5 text-zinc-500" />
      <p className="text-sm text-zinc-300">Drag PDFs here</p>
      <p className="text-xs text-zinc-500">or use Add PDFs to browse</p>
    </div>
  )
}

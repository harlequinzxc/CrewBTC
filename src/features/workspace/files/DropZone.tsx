import { useCallback, useState } from 'react'
import { FileUp } from 'lucide-react'
import { cn } from '../../../lib/cn'
import { isPdfFile } from '../../../lib/pdf/ingest'

export interface DropZoneProps {
  readonly onFiles: (files: readonly File[]) => void
  readonly disabled?: boolean | undefined
}

/**
 * Drag-and-drop target for the empty sheet.
 *
 * This is the one place a prompt is allowed, because there is genuinely nothing else on
 * screen and no other way in from the canvas. It says what it accepts and stops; the
 * previous version added a sentence about what a page becomes, which is documentation,
 * not user interface.
 */
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
        'flex w-full max-w-xs flex-col items-center gap-2.5 rounded-xl border border-dashed px-8 py-10',
        'transition-colors duration-150 ease-out',
        active ? 'border-accent bg-accent/8' : 'border-hairline-strong bg-white/[0.02]',
        disabled === true && 'opacity-60',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'grid size-9 place-items-center rounded-lg border',
          active ? 'border-accent/60 text-accent-bright' : 'border-hairline text-ink-muted',
        )}
      >
        <FileUp className="size-4" />
      </span>
      <p className="text-[13px] font-medium text-ink-primary">Drop PDFs</p>
      <p className="text-[11px] text-ink-muted">or add them from the Files panel</p>
    </div>
  )
}

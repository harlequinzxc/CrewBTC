import { useCallback, useRef, useState } from 'react'
import type { IngestedDocument } from '../../types/document'
import { ingestBatch } from '../../lib/pdf/ingest-batch'
import { keepSource, releaseAll } from '../../lib/export/doc-cache'
import { releaseProxies } from '../../lib/pdf/proxy-cache'
import type { ToastInput } from '../../components/ui/use-toasts'

export interface BatchApi {
  readonly documents: readonly IngestedDocument[]
  readonly activeId: string | null
  readonly busy: boolean
  readonly select: (id: string | null) => void
  readonly addFiles: (files: readonly File[]) => void
  readonly reRun: () => void
  readonly clear: () => void
}

export interface BatchOptions {
  readonly notify: (input: ToastInput) => void
  readonly storeBytes?: ((document: IngestedDocument, file: File) => void) | undefined
}

/** Owns the batch: parse queue, progress, active selection, and error reporting. */
export function useBatch({ notify, storeBytes }: BatchOptions): BatchApi {
  const [documents, setDocuments] = useState<readonly IngestedDocument[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const sources = useRef(new Map<string, File>())
  const cancelled = useRef(false)

  const runIn = useCallback(
    async (files: readonly File[]) => {
      if (files.length === 0) return
      cancelled.current = false
      setBusy(true)

      try {
        const results = await ingestBatch(files, {
          shouldContinue: () => !cancelled.current,
          onUpdate: (document) => {
            setDocuments((current) => {
              const next = current.filter((item) => item.id !== document.id)
              return [...next, document]
            })
            setActiveId((current) => current ?? document.id)
            const source = files.find((file) => file.name === document.fileName)
            if (source !== undefined) {
              sources.current.set(document.id, source)
              storeBytes?.(document, source)
            }
          },
        })

        // Commit the settled results as well as the progressive updates. Relying on
        // the producer's callback alone means a callback change silently empties the
        // queue — the original "Add PDFs does nothing" failure mode.
        if (results.length > 0) {
          setDocuments((current) => {
            const settled = new Map(results.map((item) => [item.id, item] as const))
            const kept = current.filter((item) => !settled.has(item.id))
            return [...kept, ...settled.values()]
          })
        }

        const parsed = results.filter((item) => item.status === 'parsed').length
        const failed = results.length - parsed
        if (failed === 0) {
          notify({
            variant: 'success',
            title: `${parsed} ${parsed === 1 ? 'PDF' : 'PDFs'} added`,
            description: 'Text blocks extracted and ready to review.',
          })
        } else {
          notify({
            variant: 'warning',
            title: `${parsed} parsed, ${failed} could not be read`,
            description: 'Failed files stay in the queue with the reason shown.',
          })
        }
      } finally {
        setBusy(false)
      }
    },
    [notify, storeBytes],
  )

  const addFiles = useCallback(
    (files: readonly File[]) => {
      // Cache the bytes before parsing so the exporter can embed real pages later.
      void (async () => {
        const bytes = await Promise.all(
          files.map(async (file) => {
            try {
              return await file.arrayBuffer()
            } catch {
              return null
            }
          }),
        )
        bytes.forEach((buffer, index) => {
          const file = files[index]
          if (buffer !== null && file !== undefined) {
            keepSource(file.name, buffer)
          }
        })
        await runIn(files)
      })()
    },
    [runIn],
  )

  const reRun = useCallback(() => {
    const pending = documents
      .map((document) => sources.current.get(document.id))
      .filter((file): file is File => file !== undefined)
    if (pending.length === 0) {
      notify({ variant: 'info', title: 'Nothing to re-run', description: 'Add PDFs first.' })
      return
    }
    setDocuments([])
    setActiveId(null)
    void runIn(pending)
  }, [documents, notify, runIn])

  const clear = useCallback(() => {
    cancelled.current = true
    const removed = documents.length
    setDocuments([])
    setActiveId(null)
    sources.current.clear()
    releaseAll()
    releaseProxies()
    if (removed > 0) {
      notify({ variant: 'info', title: `Cleared ${removed} ${removed === 1 ? 'PDF' : 'PDFs'}` })
    }
  }, [documents.length, notify])

  const select = useCallback((id: string | null) => {
    setActiveId(id)
  }, [])

  return { documents, activeId, busy, select, addFiles, reRun, clear }
}

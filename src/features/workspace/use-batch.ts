import { useCallback, useRef, useState } from 'react'
import type { IngestedDocument } from '../../types/document'
import { ingestBatch } from '../../lib/pdf/ingest-batch'
import { keepSource, releaseAll } from '../../lib/export/doc-cache'
import { getProjectSource, putProjectSource, retireProjectSources } from '../../lib/storage/project-sources'
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
  /**
   * Put documents back after a clear, selection included.
   *
   * Undo is only honest if it restores exactly what was removed, so this takes the
   * documents that were cleared rather than re-reading the files — the bytes may be gone
   * from memory by then, and re-parsing would produce a *different* batch, not the same
   * one.
   */
  readonly restoreCleared: (documents: readonly IngestedDocument[], activeId: string | null) => void
  readonly replaceProject: (documents: readonly IngestedDocument[], activeId: string | null) => void
  /**
   * False until the restored batch has been applied (or it was decided there was none).
   *
   * The session writer waits for this. Arming it on "the read finished" is not enough:
   * the read finishing and the batch taking the value are two different renders, and a
   * writer that fires in between would save an empty batch over the session it had just
   * loaded.
   */
  readonly hydrated: boolean
}

export interface BatchOptions {
  readonly notify: (input: ToastInput) => void
  /**
   * A session restored from disk, applied once on mount.
   *
   * Passed in rather than read here so the batch hook stays free of storage: it takes a
   * starting value, exactly as it would take a prop. `null` means "nothing to restore",
   * which is both the first run and the case where the snapshot was rejected.
   */
  readonly restore?: readonly IngestedDocument[] | null
  readonly restoreActiveId?: string | null
}

/** Owns the batch: parse queue, progress, active selection, and error reporting. */
export function useBatch({ notify, restore, restoreActiveId }: BatchOptions): BatchApi {
  const [documents, setDocuments] = useState<readonly IngestedDocument[]>(restore ?? [])
  const [activeId, setActiveId] = useState<string | null>(restoreActiveId ?? null)
  const [busy, setBusy] = useState(false)
  const sources = useRef(new Map<string, File>())
  const cancelled = useRef(false)
  /**
   * The restored batch, applied **during render** rather than in an effect.
   *
   * The read is asynchronous, so on a refresh this hook is first constructed with nothing
   * to construct it from; the snapshot arrives a render or two later, and this is the seam
   * where it lands. Doing it in an effect would mean an extra commit that paints an empty
   * rail first — and, worse, a state update inside an effect is exactly what the compiler
   * lint forbids, because it starts a second render to arrive at a value that was already
   * known.
   *
   * The adjustment is guarded by the value it is comparing against, so it happens once
   * per distinct snapshot and a batch the user has since changed is never overwritten.
   */
  const [restoredFrom, setRestoredFrom] = useState<readonly IngestedDocument[] | null>(null)
  if (restore !== undefined && restore !== null && restore !== restoredFrom) {
    setRestoredFrom(restore)
    setDocuments(restore)
    setActiveId(restoreActiveId ?? null)
  }
  // Hydrated means "the read has finished one way or the other" — there is nothing to wait
  // for once `restore` is no longer `undefined`, because the value above is applied by the
  // time this renders.
  const hydrated = restore !== undefined

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
            }
          },
        })

        // Store originals before leaving the busy state. Failure does not discard cards;
        // Save Project will explicitly report any originals that could not be included.
        await Promise.all(results.map(async (document) => {
          const file = sources.current.get(document.id)
          if (file !== undefined) {
            try { await putProjectSource(document.id, await file.arrayBuffer()) } catch { /* quota */ }
          }
        }))

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
    [notify],
  )

  const addFiles = useCallback(
    (files: readonly File[]) => {
      // Disable replacement while the upload bytes are being read.
      setBusy(true)
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
    // Resolve every source by document identity; never re-run only part of a batch.
    setBusy(true)
    void (async () => {
      const pending = (await Promise.all(documents.map(async (document) => {
        const held = sources.current.get(document.id)
        if (held !== undefined) return held
        const bytes = await getProjectSource(document.id)
        const derived = bytes === null ? null : new File([bytes], document.fileName, { type: 'application/pdf' })
        if (derived !== null) sources.current.set(document.id, derived)
        return derived
      }))).filter((file): file is File => file !== null)
      if (pending.length !== documents.length || pending.length === 0) {
        setBusy(false)
        notify(documents.length === 0
          ? { variant: 'info', title: 'Nothing to re-run', description: 'Add PDFs first.' }
          : { variant: 'info', title: 'Re-run needs the original files', description: 'Some original PDFs are unavailable. Add them again to re-read the text.' })
        return
      }
      setDocuments([])
      setActiveId(null)
      await runIn(pending)
      void retireProjectSources(documents.map((document) => document.id)).catch(() => undefined)
    })()
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

  const restoreCleared = useCallback(
    (restored: readonly IngestedDocument[], restoredActiveId: string | null) => {
      setDocuments(restored)
      setActiveId(restoredActiveId)
    },
    [],
  )

  const replaceProject = useCallback((restored: readonly IngestedDocument[], selected: string | null) => {
    sources.current.clear()
    setDocuments(restored)
    setActiveId(selected)
  }, [])
  return { documents, activeId, busy, select, addFiles, reRun, clear, restoreCleared, replaceProject, hydrated }
}

import { useEffect, useState } from 'react'
import { SNAPSHOT_VERSION } from '../../../types/persisted'
import type { WorkspaceSnapshot } from '../../../types/persisted'
import { writeSnapshot } from '../../../lib/storage/snapshot'
import { sweepProjectSources } from '../../../lib/storage/project-sources'
import type { StationWorkspace } from '../../../types/station'
import type { Card } from '../../../types/card'
import type { IngestedDocument } from '../../../types/document'

/**
 * Keeps the session on disk.
 *
 * Two rules make this safe:
 *
 * - **The first render never writes.** The restore read is asynchronous, so for one frame
 *   the store is empty even when a snapshot exists. Writing then would delete the very
 *   session being loaded — the same class of bug as a cache that outlives its data. The
 *   writer arms itself only after `restored` is true.
 * - **Writes are debounced, and one record replaces the whole thing.** Dragging a band
 *   divider fires a change per frame; a batch is written as a unit so a partial write can
 *   never leave cards pointing at pages that are not there.
 */
export interface RestoredSession {
  /** False until the snapshot has been read (or decided against). Writers stay off. */
  readonly restored: boolean
  readonly snapshot: WorkspaceSnapshot | null
}

/** The read half: what was on disk. Starts empty and settles once. */
export function useRestoredSession(): RestoredSession {
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot | null>(null)
  const [restored, setRestored] = useState(false)

  useEffect(() => {
    let live = true
    void (async () => {
      const { readSnapshot } = await import('../../../lib/storage/snapshot')
      const stored = await readSnapshot()
      void sweepProjectSources().catch(() => undefined)
      if (!live) return
      setSnapshot(stored)
      setRestored(true)
    })()
    return () => {
      live = false
    }
  }, [])

  return { restored, snapshot }
}

/**
 * The write half: debounce, then replace the whole record.
 *
 * `hydrated` is "the read has finished *and* the stores have taken its value" — see
 * `BatchApi.hydrated`. Writing on the read alone would persist an empty batch over the
 * session being restored.
 */
export function useSaveSession(
  hydrated: boolean,
  input: {
    readonly documents: readonly IngestedDocument[]
    readonly cards: Readonly<Record<string, Card>>
    readonly activeId: string | null
    readonly stations: readonly StationWorkspace[]
    readonly activeStationId: string
  },
): void {
  const { documents, cards, activeId, stations, activeStationId } = input

  useEffect(() => {
    if (!hydrated) return
    const timer = window.setTimeout(() => {
      const next: WorkspaceSnapshot = {
        version: SNAPSHOT_VERSION,
        documents,
        cards,
        activeId,
        stations, activeStationId,
        savedAt: new Date().toISOString(),
      }
      // An empty batch is a snapshot too: the user cleared the files, and restoring them
      // on the next load would undo the action they just took. The record simply *is* the
      // state, including the empty one.
      void writeSnapshot(next).then(() => sweepProjectSources()).catch(() => undefined)
    }, 400)
    return () => window.clearTimeout(timer)
  }, [hydrated, documents, cards, activeId, stations, activeStationId])
}

import type { Card } from './card'
import type { IngestedDocument } from './document'

/**
 * What survives a reload.
 *
 * A batch is not just a list of files any more: it is a set of placements, hand-tuned
 * band heights, swapped photos and per-card framing. Re-parsing a PDF cannot reproduce
 * those, so the *result* of the parse has to be stored, not the input to it. That is why
 * this snapshots `IngestedDocument` rather than holding PDF bytes and re-running ingest:
 * a restored session is exactly what the user left, not a second opinion about it.
 */
export interface WorkspaceSnapshot {
  readonly version: 1
  /** In ingest order — the rail's order and the rail's selection both depend on it. */
  readonly documents: readonly IngestedDocument[]
  readonly cards: Readonly<Record<string, Card>>
  readonly activeId: string | null
  readonly savedAt: string
}

/** Whatever was on disk, before it has been trusted. Never read fields off this directly. */
export type UnknownSnapshot = unknown

export const SNAPSHOT_VERSION = 1

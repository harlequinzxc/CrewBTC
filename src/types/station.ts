import type { Card } from './card'
import type { IngestedDocument } from './document'

/** Each station owns its documents and edited cards; sheet settings are project-wide. */
export interface StationWorkspace {
  readonly id: string
  readonly name: string
  readonly documents: readonly IngestedDocument[]
  readonly cards: Readonly<Record<string, Card>>
  readonly activeId: string | null
}

export function emptyStation(id: string, name: string): StationWorkspace {
  return { id, name, documents: [], cards: {}, activeId: null }
}

import { useMemo } from 'react'
import { planSheets } from '../../lib/imposition/sheet'
import type { PageRef } from '../../lib/imposition/sheet'
import { cardKey } from '../../types/card'
import type { GridLayout } from '../../types/imposition'
import type { IngestedDocument } from '../../types/document'
import type { CardSeed } from './use-cards'

/**
 * One seed per *placed* page, keyed the way the canvas will look it up.
 *
 * The key has to be built from `placement.cellIndex`, not from the page's position in the
 * flattened list: ordinal 12 is cell 0 of sheet 2, so a positional key populated the first
 * sheet and left every sheet after it blank. The plan is the only thing that knows which
 * cell a page really landed in, so it is what seeds are built from.
 */
export function useCardSeeds(
  pageRefs: readonly PageRef[],
  grid: GridLayout,
  documents: readonly IngestedDocument[],
): readonly CardSeed[] {
  return useMemo(
    () =>
      planSheets(pageRefs, grid).flatMap((plan) =>
        plan.placements.map((placement) => {
          // `documentId` is the *file name* (the exporter resolves source bytes by it),
          // not the internal id.
          const document = documents.find((item) => item.fileName === placement.documentId)
          const copy = document?.copies[placement.pageNumber]
          return {
            key: cardKey(placement.cellIndex, placement.documentId, placement.pageNumber),
            headerText: copy?.header ?? '',
            bodyText: copy?.footer ?? '',
            photo: document?.photos[placement.pageNumber] ?? null,
          }
        }),
      ),
    [pageRefs, documents, grid],
  )
}

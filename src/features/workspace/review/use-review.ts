import { useEffect, useState } from 'react'
import type { Card } from '../../../types/card'
import type { GridLayout } from '../../../types/imposition'
import type { SheetPlan } from '../../../lib/imposition/sheet'
import { reviewCards } from './review-cards'
import type { ReviewIssue } from './review-cards'

export function useReview(sheets: readonly SheetPlan[], grid: GridLayout, cards: Readonly<Record<string, Card>>) {
  const [result, setResult] = useState<{ sheets: readonly SheetPlan[]; grid: GridLayout; cards: Readonly<Record<string, Card>>; issues: ReviewIssue[] | null } | null>(null)
  useEffect(() => {
    let active = true
    const timer = window.setTimeout(() => {
      void reviewCards(sheets, grid, cards).then(
        (issues) => { if (active) setResult({ sheets, grid, cards, issues }) },
        () => { if (active) setResult({ sheets, grid, cards, issues: null }) },
      )
    }, 300)
    return () => { active = false; window.clearTimeout(timer) }
  }, [sheets, grid, cards])
  if (result?.sheets !== sheets || result.grid !== grid || result.cards !== cards) return { status: 'checking' as const, issues: [] }
  return result.issues === null ? { status: 'error' as const, issues: [] } : { status: 'ready' as const, issues: result.issues }
}

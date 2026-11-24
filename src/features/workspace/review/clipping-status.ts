import type { ReviewIssue } from './review-cards'

/** Count affected cards, not messages; retain the wider review for non-clipping warnings. */
export function clippingStatus(status: 'checking' | 'error' | 'ready', issues: readonly ReviewIssue[]) {
  if (status !== 'ready') return { status, count: 0 }
  if (issues.some((issue) => issue.messages.some((message) => message.endsWith('text could not be checked')))) return { status: 'error' as const, count: 0 }
  return { status, count: issues.filter((issue) => issue.messages.some((message) => message.endsWith('text may clip') || message === 'Corner label will be truncated')).length }
}

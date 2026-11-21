import { Section } from '../inspector/Section'
import type { ReviewIssue } from './review-cards'

interface Props {
  readonly status: 'checking' | 'error' | 'ready'
  readonly issues: readonly ReviewIssue[]
  readonly onJump: (issue: ReviewIssue) => void
}
export function BatchReview({ status, issues, onJump }: Props) {
  return <Section title="Print & batch review">
    <div id="batch-review" tabIndex={-1} className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">
      {status === 'checking' ? <p className="text-xs text-ink-secondary">Checking cards…</p> : null}
      {status === 'error' ? <p className="text-xs text-ink-secondary">Could not check cards. Inspect the generated PDF before printing.</p> : null}
      {status === 'ready' && issues.length === 0 ? <p className="text-xs text-ink-secondary">No issues found. Inspect the PDF before printing.</p> : null}
      {status === 'ready' && issues.length > 0 ? <>
        <p className="mb-2 text-xs text-ink-secondary">{issues.length} {issues.length === 1 ? 'card needs' : 'cards need'} review. Missing content can be intentional.</p>
        <ol className="max-h-48 space-y-1 overflow-auto">{issues.map((issue) => <li key={`${issue.sheetIndex}-${issue.cellIndex}`}>
          <button type="button" data-target="dense" onClick={() => onJump(issue)} className="min-h-8 w-full rounded px-1 text-left text-xs text-ink-primary hover:bg-surface-active focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">
            Sheet {issue.sheetIndex + 1}, card {issue.cellIndex + 1}: {issue.messages.join(', ')}
          </button>
        </li>)}</ol>
      </> : null}
    </div>
  </Section>
}

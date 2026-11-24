import { describe, expect, it } from 'vitest'
import { clippingStatus } from '../../features/workspace/review/clipping-status'
import type { ReviewIssue } from '../../features/workspace/review/review-cards'

const issue = (...messages: string[]): ReviewIssue => ({ sheetIndex: 0, cellIndex: 0, documentId: 'one', pageNumber: 1, messages })
describe('clipping status', () => {
  it('counts affected cards, including truncated corner labels, not unrelated warnings', () => {
    expect(clippingStatus('ready', [issue('Missing photo'), issue('Top text may clip', 'Bottom text may clip'), issue('Corner label will be truncated')])).toEqual({ status: 'ready', count: 2 })
    expect(clippingStatus('ready', [issue('Missing photo')])).toEqual({ status: 'ready', count: 0 })
  })
  it('does not report ready while checking or if a text check fails', () => {
    expect(clippingStatus('checking', [])).toEqual({ status: 'checking', count: 0 })
    expect(clippingStatus('ready', [issue('Bottom text could not be checked')])).toEqual({ status: 'error', count: 0 })
    expect(clippingStatus('error', [])).toEqual({ status: 'error', count: 0 })
  })
})

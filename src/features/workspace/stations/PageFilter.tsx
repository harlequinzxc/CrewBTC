import type { IngestedDocument } from '../../../types/document'
import { parsePageFilter } from './page-filter'

export function PageFilter({ document, onChange }: { readonly document: IngestedDocument; readonly onChange: (pages: readonly number[]) => void }) {
  const count = document.metrics?.pageCount ?? 0
  if (count < 2) return null
  const current = document.includedPages === undefined ? 'all' : document.includedPages.join(',') || 'none'
  return <div className="border-t border-hairline p-2 text-xs text-ink-secondary">
    <p>{document.fileName}: {document.includedPages?.length ?? count} of {count} pages in this station</p>
    <button type="button" data-target="dense" onClick={() => {
      const answer = window.prompt('Pages for this station: enter all, none, or numbers/ranges such as 1,3-5. Add this PDF to another station to use other pages there.', current)
      if (answer === null) return
      const pages = parsePageFilter(answer, count)
      if (pages === null) { window.alert('Invalid page list. Use all, none, or page numbers and ranges within this PDF.'); return }
      onChange(pages)
    }} className="min-h-8 rounded px-1 text-ink-primary hover:bg-surface-active focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">Choose pages for this station</button>
  </div>
}

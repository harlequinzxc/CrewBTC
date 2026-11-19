import type { PageRef } from '../../lib/imposition/sheet'

/** How many pages have copy, for the tab badge and the list footer. */
export function copyProgress(
  pages: readonly PageRef[],
  texts: Readonly<Record<string, string>>,
): string {
  const filled = pages.filter((_page, index) => (texts[`${index}`] ?? '').trim() !== '').length
  return `${filled}/${pages.length}`
}

/** A comma-separated list of 1-based page numbers and inclusive ranges. */
export function parsePageFilter(input: string, max: number): number[] | null {
  const text = input.trim().toLowerCase()
  if (text === 'all') return Array.from({ length: max }, (_, index) => index + 1)
  if (text === 'none') return []
  if (!text) return null
  const pages = new Set<number>()
  for (const term of text.split(',')) {
    const match = /^\s*(\d+)\s*(?:-\s*(\d+)\s*)?$/.exec(term)
    if (!match) return null
    const first = Number(match[1]); const last = Number(match[2] ?? match[1])
    if (first < 1 || last < first || last > max) return null
    for (let page = first; page <= last; page += 1) pages.add(page)
  }
  return [...pages].sort((a, b) => a - b)
}

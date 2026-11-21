/** Editable lists: one literal keyword or phrase per line. */
export interface Keywords {
  readonly crockeries: string
  readonly directions: string
  readonly condiments: string
}
export const EMPTY_KEYWORDS: Keywords = { crockeries: '', directions: '', condiments: '' }
export function validKeywords(value: unknown): value is Keywords {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const item = value as Record<string, unknown>
  return ['crockeries', 'directions', 'condiments'].every((key) => typeof item[key] === 'string' && item[key].length <= 10000)
}

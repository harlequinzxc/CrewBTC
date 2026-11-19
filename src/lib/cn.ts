type ClassValue = string | number | null | false | undefined | readonly ClassValue[]

/** Minimal class joiner. Replaces `clsx` — one fewer dependency for one function (§1). */
export function cn(...values: readonly ClassValue[]): string {
  const out: string[] = []

  const walk = (value: ClassValue): void => {
    if (value === null || value === undefined || value === false || value === '') return
    if (typeof value === 'string') {
      out.push(value)
      return
    }
    if (typeof value === 'number') {
      out.push(String(value))
      return
    }
    for (const inner of value) walk(inner)
  }

  for (const value of values) walk(value)
  return out.join(' ')
}

// Palette gate — `src/config/theme.ts` and `src/index.css` must declare the same colours.
//
// theme.ts is the palette as data (read by `brand.ts`, and the values the contrast gate
// argues about); index.css is the same palette as `@theme` custom properties, which is
// what utilities like `bg-surface-panel` compile to. They cannot be one file — a TS
// module cannot emit `@theme`, and CSS cannot be imported by app code — so they are kept
// identical here instead of by hope.
import { readFileSync } from 'node:fs'

const root = process.argv[2] ?? '.'
const ts = readFileSync(`${root}/src/config/theme.ts`, 'utf8')
const css = readFileSync(`${root}/src/index.css`, 'utf8')

/** Pull `name: '#hex'` out of a const object block in theme.ts. */
const fromTs = (block, name) => {
  const group = new RegExp(`export const ${block} = \\{([\\s\\S]*?)\\} as const`).exec(ts)
  if (group === null) throw new Error(`no ${block} in theme.ts`)
  const hit = new RegExp(`\\b${name}:\\s*'([^']+)'`).exec(group[1])
  return hit === null ? null : hit[1]
}

const fromCss = (name) => {
  const hit = new RegExp(`--color-${name}:\\s*([^;]+);`).exec(css)
  return hit === null ? null : hit[1].trim()
}

const PAIRS = [
  ['SURFACE', 'canvas', 'surface-canvas'],
  ['SURFACE', 'panel', 'surface-panel'],
  ['SURFACE', 'raised', 'surface-raised'],
  ['SURFACE', 'active', 'surface-active'],
  ['TEXT', 'primary', 'ink-primary'],
  ['TEXT', 'secondary', 'ink-secondary'],
  ['TEXT', 'muted', 'ink-muted'],
  ['ACCENT', 'base', 'accent'],
  ['ACCENT', 'solid', 'accent-solid'],
  ['ACCENT', 'bright', 'accent-bright'],
]

let bad = 0
for (const [block, key, cssName] of PAIRS) {
  const a = fromTs(block, key)
  const b = fromCss(cssName)
  const ok = a !== null && b !== null && a.toLowerCase() === b.toLowerCase()
  if (!ok) bad++
  console.log(`${ok ? '✓' : '✗'} ${block}.${key} = ${a ?? '(missing)'}  ↔  --color-${cssName} = ${b ?? '(missing)'}`)
}

// §3.1: never pure black. The canvas is the darkest surface and it is #0D0E11.
if (/#000000|#000\b/i.test(ts.replace(/\/\*[\s\S]*?\*\//g, ''))) {
  console.error('✗ theme.ts declares pure black')
  bad++
}

console.log(bad ? `\n✗ ${bad} palette mismatch(es)` : '\n✓ theme.ts and index.css agree')
process.exit(bad ? 1 : 0)

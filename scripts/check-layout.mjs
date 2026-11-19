// Layout gate — bans 100vh, sub-16px inputs, sub-24px targets, hidden scrollbars,
// non-composited animations, and hover-only paths. Regex structural lint, not a parser.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { extname, join, relative } from 'node:path'
const root = process.argv[2] ?? '.'
const SKIP = new Set(['node_modules','dist','build','.git','coverage','out','.next','.vite'])
const EXT = new Set(['.tsx','.jsx','.html','.css','.ts','.js'])
const out = []
function walk(dir) {
  for (const e of readdirSync(dir)) {
    if (SKIP.has(e)) continue
    const f = join(dir, e)
    if (statSync(f).isDirectory()) walk(f)
    else if (EXT.has(extname(e))) scan(f)
  }
}
function scan(file) {
  const isTest = /\.(test|spec)\.[tj]sx?$/.test(file)
  const lines = readFileSync(file, 'utf8').split('\n')
  lines.forEach((t, i) => {
    const hit = rule => out.push(`${relative(process.cwd(), file)}:${i+1}  [${rule}]\n    ${t.trim()}`)
    if (/\b100vh\b(?!-)/.test(t)) hit('§4.3 use 100svh (shells) or 100dvh (sheets), never 100vh')
    if (isTest) return
    if (/<input\b/.test(t) && /\btext-(sm|xs|\[1[0-5]px\])/.test(t)) hit('§2 input must be text-base (16px)+')
    const tgt = t.match(/\b(?:min-h|h|size)-\[(\d+)px\]/)
    if (/<(button|a|input|select)\b/.test(t) && tgt && Number(tgt[1]) < 24) hit(`§4.1 target ${tgt[1]}px is below the 24px floor`)
    const okTarget = /min-h-(\[44px\]|11|8)(?![\w[])/.test(t) || /(?:^|[\s"'{])h-(11|8)(?![\w[])/.test(t)  // §4.1 ladder
    // Satisfied structurally by the CSS target ladder in index.css:
    // `button[data-target='dense']`, and the global 44px floor for all other buttons.
    const structural = /data-target/.test(t) || /<button\b[^>]*data-target/.test(t)
    if (/<button\b/.test(t) && !okTarget && !structural) hit('§4.1 button needs min-h-[44px] (default) or min-h-8 (dense desktop)')
    if (/transition-\[?(height|width|top|left|box-shadow)\b/.test(t)) hit('§3 animate transform/opacity/clip-path only')
    if (/scrollbar-width:\s*none|scrollbarWidth:\s*['"]none['"]/.test(t)) hit('§4.1 keep scrollbars visible')
    if (/::-webkit-scrollbar\b/.test(t) && /display:\s*none/.test(lines.slice(i, i+4).join(' '))) hit('§4.1 keep scrollbars visible')
    if (/\bhover:/.test(t) && !/focus/.test(t) && !/group-hover/.test(t)) hit('§4.1 hover needs a focus/focus-visible equivalent')
  })
}
walk(root)
if (!out.length) { console.log(`✓ layout gates passed (${root})`); process.exit(0) }
console.error(`✗ ${out.length} layout violation(s):\n` + out.join('\n'))
process.exit(1)

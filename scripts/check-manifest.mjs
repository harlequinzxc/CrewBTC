// Manifest gate — every declared icon must exist on disk; maskable + standalone required.
import { readFileSync, existsSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
const mp = process.argv[2] ?? 'public/manifest.json'
const pub = resolve(process.argv[3] ?? join(dirname(mp), '..', 'public'))
const errs = []
if (!existsSync(mp)) { console.error(`✗ manifest not found: ${mp}`); process.exit(1) }
let m
try { m = JSON.parse(readFileSync(mp, 'utf8')) } catch (e) { console.error(`✗ invalid JSON: ${e.message}`); process.exit(1) }
if (m.display !== 'standalone') errs.push(`display must be "standalone" (found ${JSON.stringify(m.display)})`)
const icons = Array.isArray(m.icons) ? m.icons : []
if (!icons.length) errs.push('no icons declared')
const sizes = new Set()
for (const ic of icons) {
  if (!ic.src) { errs.push('icon entry with no src'); continue }
  const f = join(pub, ic.src.replace(/^\//, ''))
  if (!existsSync(f)) { errs.push(`missing icon file: ${ic.src}`); continue }
  if (statSync(f).size === 0) errs.push(`empty icon file: ${ic.src}`)
  if (ic.sizes) ic.sizes.split(/\s+/).forEach(x => sizes.add(x))
}
for (const req of ['192x192','512x512']) if (!sizes.has(req)) errs.push(`no icon declared at ${req}`)
if (!icons.some(i => String(i.purpose ?? '').includes('maskable'))) errs.push('no maskable icon (purpose: "maskable")')
const idx = join(pub, '..', 'index.html')
if (existsSync(idx)) {
  const html = readFileSync(idx, 'utf8')
  if (!/rel="apple-touch-icon"/.test(html)) errs.push('index.html has no <link rel="apple-touch-icon">')
  for (const mm of html.matchAll(/<link[^>]+rel="(?:apple-touch-icon|icon)"[^>]+href="([^"]+)"/g)) {
    const h = mm[1].replace(/^\//, '')
    if (!/^https?:/.test(h) && !existsSync(join(pub, h))) errs.push(`index.html references missing icon: ${mm[1]}`)
  }
}
if (errs.length) { console.error('✗ manifest violations:\n' + errs.map(e => '  - ' + e).join('\n')); process.exit(1) }
console.log(`✓ manifest passed (${icons.length} icons, standalone, maskable present)`)

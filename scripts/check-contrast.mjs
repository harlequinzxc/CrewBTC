// Contrast gate — verifies the palette pairs declared in §3.1 against WCAG 2.2 AA.
// Edit PAIRS if the palette changes. Pairs marked expect:'fail' are known-unusable and must stay failing.
const AA_NORMAL = 4.5, AA_LARGE = 3.0
const C = { 'zinc-50':'#fafafa','zinc-400':'#a1a1aa','zinc-500':'#71717a','zinc-900':'#18181b',
  'zinc-950':'#09090b','white':'#ffffff','red-500':'#ef4444','red-600':'#dc2626',
  'red-700':'#b91c1c','amber-500':'#f59e0b' }
const hex = h => [1,3,5].map(i => parseInt(h.slice(i,i+2),16)/255)
const lin = c => c <= 0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4)
const lum = h => { const [r,g,b] = hex(h).map(lin); return 0.2126*r + 0.7152*g + 0.0722*b }
const ratio = (a,b) => { const [hi,lo] = [lum(a),lum(b)].sort((x,y) => y-x); return Number(((hi+0.05)/(lo+0.05)).toFixed(2)) }
const PAIRS = [
  { name:'zinc-50 on red-500 fill', fg:'zinc-50', bg:'red-500', level:'normal', expect:'fail' },
  { name:'white on red-500 fill', fg:'white', bg:'red-500', level:'normal', expect:'fail' },
  { name:'white on red-600 fill', fg:'white', bg:'red-600', level:'normal', expect:'pass' },
  { name:'white on red-700 fill', fg:'white', bg:'red-700', level:'normal', expect:'pass' },
  { name:'red-500 text on zinc-950', fg:'red-500', bg:'zinc-950', level:'normal', expect:'pass' },
  { name:'red-600 text on white', fg:'red-600', bg:'white', level:'normal', expect:'pass' },
  { name:'zinc-50 on zinc-950', fg:'zinc-50', bg:'zinc-950', level:'normal', expect:'pass' },
  { name:'zinc-400 on zinc-950', fg:'zinc-400', bg:'zinc-950', level:'normal', expect:'pass' },
  { name:'zinc-400 on zinc-900', fg:'zinc-400', bg:'zinc-900', level:'normal', expect:'pass' },
  { name:'zinc-500 on zinc-50', fg:'zinc-500', bg:'zinc-50', level:'normal', expect:'pass' },
  { name:'amber-500 on zinc-950', fg:'amber-500', bg:'zinc-950', level:'normal', expect:'pass' },
  { name:'red-500 focus ring on zinc-950', fg:'red-500', bg:'zinc-950', level:'ui', expect:'pass' },
]
let bad = 0
for (const p of PAIRS) {
  const min = p.level === 'normal' ? AA_NORMAL : AA_LARGE
  const r = ratio(C[p.fg], C[p.bg])
  const meets = r >= min
  const ok = p.expect === 'pass' ? meets : !meets
  if (!ok) bad++
  console.log(`${ok ? '✓' : '✗'} ${String(r).padStart(5)}:1  ${p.name} (needs ${min}:1, expected to ${p.expect})`)
}
console.log(bad ? `\n✗ ${bad} pair(s) disagree with §3.1` : '\n✓ all pairs match §3.1')
process.exit(bad ? 1 : 0)

// Contrast gate — verifies the palette pairs declared in §3.1 against WCAG 2.2 AA.
// Edit PAIRS if the palette changes. Pairs marked expect:'fail' are known-unusable and must
// stay failing. Every colour below is a token from `src/config/theme.ts`; if a token moves,
// this list moves with it, so the gate always argues about the palette on screen.
const AA_NORMAL = 4.5, AA_LARGE = 3.0

const C = {
  canvas: '#0d0e11',
  panel: '#131418',
  raised: '#1a1c22',
  hover: '#22252c',
  primary: '#f4f4f6',
  secondary: '#a0a5b0',
  muted: '#89909c',
  accent: '#e5484d',
  accentSolid: '#d33a3f',
  accentBright: '#ff6369',
  white: '#ffffff',
  red700: '#b91c1c',
}

const hex = h => [1,3,5].map(i => parseInt(h.slice(i,i+2),16)/255)
const lin = c => c <= 0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4)
const lum = h => { const [r,g,b] = hex(h).map(lin); return 0.2126*r + 0.7152*g + 0.0722*b }
const ratio = (a,b) => { const [hi,lo] = [lum(a),lum(b)].sort((x,y) => y-x); return Number(((hi+0.05)/(lo+0.05)).toFixed(2)) }

const PAIRS = [
  // Text on every surface it is actually painted on.
  { name:'primary on canvas',        fg:'primary',      bg:'canvas',  level:'normal', expect:'pass' },
  { name:'primary on panel',         fg:'primary',      bg:'panel',   level:'normal', expect:'pass' },
  { name:'primary on raised',        fg:'primary',      bg:'raised',  level:'normal', expect:'pass' },
  { name:'secondary on panel',       fg:'secondary',    bg:'panel',   level:'normal', expect:'pass' },
  { name:'secondary on raised',      fg:'secondary',    bg:'raised',  level:'normal', expect:'pass' },
  { name:'secondary on hover',       fg:'secondary',    bg:'hover',   level:'normal', expect:'pass' },

  // Metadata is still normal-sized text; check all surfaces at the 4.5:1 floor.
  { name:'muted on panel', fg:'muted', bg:'panel', level:'normal', expect:'pass' },
  { name:'muted on raised', fg:'muted', bg:'raised', level:'normal', expect:'pass' },
  { name:'muted on hover', fg:'muted', bg:'hover', level:'normal', expect:'pass' },

  // The single accent: as text, as a fill under white, and as a focus ring.
  { name:'accent-bright on panel',   fg:'accentBright', bg:'panel',   level:'normal', expect:'pass' },
  { name:'accent on canvas (ring)',  fg:'accent',       bg:'canvas',  level:'ui',     expect:'pass' },
  // The nominal accent is too light to carry a white label (3.91:1), so accent-coloured
  // fills use the deeper `solid` step. Both pairs are checked, including the failure, so a
  // future palette edit cannot quietly move white text back onto the lighter fill.
  { name:'white on accent fill',     fg:'white',        bg:'accent',  level:'normal', expect:'fail' },
  { name:'white on red hover', fg:'white', bg:'red700', level:'normal', expect:'pass' },
  { name:'white on accent-solid',    fg:'white',        bg:'accentSolid', level:'normal', expect:'pass' },
]

let bad = 0
for (const p of PAIRS) {
  const min = p.level === 'normal' ? AA_NORMAL : p.level === 'large' ? AA_LARGE : 3.0
  const r = ratio(C[p.fg], C[p.bg])
  const meets = r >= min
  const ok = p.expect === 'pass' ? meets : !meets
  if (!ok) bad++
  console.log(`${ok ? '✓' : '✗'} ${String(r).padStart(5)}:1  ${p.name} (needs ${min}:1, expected to ${p.expect})`)
}
console.log(bad ? `\n✗ ${bad} pair(s) disagree with §3.1` : '\n✓ all pairs match §3.1')
process.exit(bad ? 1 : 0)

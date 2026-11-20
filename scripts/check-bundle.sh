#!/usr/bin/env bash
# §7A bundle budget. The budget applies to JS the browser must download to paint the
# first screen — not to lazily-loaded chunks (PDF.js, the exporter), which are
# requested only when a route needs them.
#
# Initial route = the entry chunk + its static imports, resolved from
# dist/.vite/manifest.json. Lazy chunks are reported separately and must stay lazy.
set -uo pipefail
if [ ! -f dist/.vite/manifest.json ]; then
  echo "✗ dist/.vite/manifest.json not found — run the build first"
  exit 1
fi

BUDGET=200000
CSS_BUDGET=40000

node --input-type=module -e '
import { readFileSync, statSync } from "node:fs"
import { gzipSync } from "node:zlib"
import { join } from "node:path"

const BUDGET = 200000, CSS_BUDGET = 40000
const manifest = JSON.parse(readFileSync("dist/.vite/manifest.json", "utf8"))

const gz = (file) => gzipSync(readFileSync(join("dist", file))).length
const isCss = (f) => f.endsWith(".css")

// Walk the static import graph of the entry only. Dynamic imports are excluded —
// that is the whole point of the code split.
const seen = new Set()
const initialJs = []
const initialCss = []
const lazy = []

const walk = (key) => {
  if (!key || seen.has(key)) return
  seen.add(key)
  const entry = manifest[key]
  if (!entry) return
  if (entry.file) (isCss(entry.file) ? initialCss : initialJs).push(entry.file)
  for (const css of entry.css ?? []) initialCss.push(css)
  for (const dep of entry.imports ?? []) walk(dep)
  for (const dep of entry.dynamicImports ?? []) if (manifest[dep]?.file) lazy.push(manifest[dep].file)
}

walk(manifest["index.html"]?.isEntry ? "index.html" : Object.keys(manifest).find((k) => manifest[k].isEntry))

const sum = (files) => [...new Set(files)].reduce((total, f) => total + gz(f), 0)
const jsBytes = sum(initialJs)
const cssBytes = sum(initialCss)

let failed = false
console.log("initial route JS  " + jsBytes + " B  (budget " + BUDGET + ")")
console.log("initial route CSS " + cssBytes + " B  (budget " + CSS_BUDGET + ")")
for (const f of [...new Set(lazy)]) console.log("lazy chunk        " + f + " — " + gz(f) + " B gzip (not counted)")

const cssText = [...new Set(initialCss)].map((f) => readFileSync(join("dist", f), "utf8")).join("")
// A stale dist passes every size check while shipping the previous build of the chrome.
// Spot that by looking for rules only the current UI emits, so a failed build cannot
// masquerade as a passing gate.
const required = [
  { rule: ".m-auto{", why: "the settings dialog centres with m-auto" },
  { rule: "width:min(32rem", why: "the settings dialog is a bounded panel" },
]
for (const { rule, why } of required) {
  if (!cssText.includes(rule)) {
    console.error("✗ built CSS is missing " + rule + " — " + why + " (stale dist?)")
    failed = true
  }
}

if (jsBytes > BUDGET) { console.error("✗ initial JS over budget"); failed = true }
if (cssBytes > CSS_BUDGET) { console.error("✗ initial CSS over budget"); failed = true }
if (lazy.length === 0) { console.error("✗ expected at least one lazy chunk (PDF.js must stay out of the shell)"); failed = true }
process.exit(failed ? 1 : 0)
'

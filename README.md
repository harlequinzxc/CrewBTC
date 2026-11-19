# CrewBTC

A PC-first, fully client-side PWA that batch-parses consistently formatted PDFs and
recreates them as print-ready vector PDFs. No backend, no upload, no network calls.

Built against [`ENGINEERING_RULES.md`](./ENGINEERING_RULES.md).

---

## Decisions of record

These are binding for the project. Changing one is a doc change plus a SemVer bump.

| Decision | Value | Why |
|---|---|---|
| **Storage library** | **`idb`** (not Dexie, not `idb-keyval`) | §5A allows one. `idb-keyval` has no schema version, so §5's tested upgrade path is unsatisfiable with it. |
| **Preview engine** | DOM in physical `mm` units + a shared layout engine | Konva rasterises preview text, which cannot match `pdf-lib`'s vector layout. WYSIWYG required DOM. |
| **Font strategy** | Base-14 standard fonts first; user-uploaded `.ttf`/`.otf` for brand fonts | `@fontsource/inter` ships **woff/woff2 only**, and fontkit needs ttf/otf. Bundling font binaries is a Phase 4 decision. |
| **Surface support** | **Desktop only**, explicitly declared | Overrides §4's equal-peers rule. Below 1024 px the app states the constraint instead of rendering a crushed layout. |
| **Export honesty** | CMYK for vector text via `cmyk()`; images stay RGB; **not PDF/X** | `pdf-lib` cannot emit PDF/X with an output intent or encode CMYK JPEGs. The UI says so. |
| **Trim/bleed** | User-configurable, validated | §3 of the spec left `[e.g., A4]` placeholders, which §5 forbids in shipping code. |

### §4 override in force

§4 of the engineering rules treats PC and mobile as equal peers. **This build is
desktop-only by user decision.** Consequences, stated so they are never silent:

- **Overridden:** §4.3 mobile layout rules, §4.4 installed-mode check *on mobile*,
  §4.1 mobile touch baseline.
- **Still enforced:** §4.2 in full, §4.4 on desktop, the `1440/1280/1024` breakpoint
  ladder plus `320 px @ 200% zoom`, §3A accessibility, the §4.1 target ladder,
  visible scrollbars, no hover-only paths, and `100svh` for the shell.

---

## Architecture

```
Batch PDFs ──► pdfjs-dist ──► extraction ──► layout engine ──┬─► DOM preview (mm)
                                │                            └─► pdf-lib export
                                └─► IndexedDB (idb, versioned)
```

**The one rule that keeps the preview honest:** a single layout engine computes every
line break, offset, and baseline once, and *both* the preview and the exporter render
from that output. Nothing re-flows at export time.

```
src/
  components/ui/       design-system primitives (§2) — Button Card Input Select
                       Toggle Badge BottomSheet Toast Spinner EmptyState FormField
  components/layout/   AppShell SidebarNav DesktopOnlyNotice
  features/workspace/  BatchQueue PrintCanvas Inspector
  features/settings/   SettingsView MotionProvider use-motion
  lib/                 units (mm↔pt) trim (geometry, crop marks) dpi motion cn
  lib/storage/         db.ts (idb) + migrations/
  types/               page, template, settings, async
  data/changelog.ts    release notes, synchronised with package.json (§9)
scripts/               the Appendix A/B gates, runnable via `npm run gate:*`
```

## Target-size ladder (§4.1)

Defined **once**, in `src/index.css`, so it cannot drift per call site:

- `44px` — default for every interactive element.
- `32px` — dense desktop chrome, table rows, icon clusters (`data-target="dense"`).
- `24px` — absolute floor. Nothing below it.

## Commands

```bash
npm run dev            # dev server on :5173
npm run build          # tsc -b && vite build
npm run typecheck      # tsc -b --noEmit   ← plain `tsc --noEmit` is a lie here; see below
npm run lint           # oxlint, max-lines enforced at 250
npm run lint:types     # oxlint --type-aware (floating promises live only here)
npm test               # vitest
npm run gate           # every gate in Appendix A/D order
```

### Why `tsc -b` and not `tsc`

Verified in this repo on Vite 8.3.8 / TypeScript 7.0.2, with a planted
`const label: string = 42`:

| Command | Exit |
|---|---|
| `npx tsc --noEmit` | **0** — compiles an empty file set, reports nothing |
| `npx tsc -b --noEmit` | **1** — catches the error |

`tsconfig.json` is solution-style (`"files": []` + project references), so only the
`-b` form actually type-checks `src/`.

### Why two lint passes

`no-floating-promises` is type-aware and does not fire in a plain `oxlint` run.
Verified with a planted floating promise: plain run reported **0** warnings,
`--type-aware` reported **1** and exited **1**. Both passes are required.

## Known limitations

- **Not PDF/X.** No output intent, no CMYK image conversion. Fine for digital and
  short-run; a shop requiring PDF/X will bounce these files.
- **No bundled print font yet.** Base-14 only until Phase 4 decides the font payload.
- **Browser verification is manual.** Chromium downloads are blocked in the build
  sandbox, so breakpoint/installed-mode passes are reported as `not run` rather than
  claimed. Extraction is covered end-to-end by a Node test against a real PDF.
- **PDF.js is loaded lazily** on the first import. The initial route is ~83 KB gzip;
  the 132 KB PDF chunk is requested only when a PDF is added. `scripts/check-bundle.sh`
  enforces both facts.
- **Standard-14 font data and CMaps are shipped** under `public/pdfjs/` (2.5 MB served,
  not in the JS bundle). Without `standardFontDataUrl`, PDF.js cannot substitute
  Helvetica/Times/Courier and extraction of such text fails.

## Phase status

| Phase | Scope | State |
|---|---|---|
| 1 | Shell, design system, geometry, storage skeleton, PWA | **done — v0.1.0** |
| 2 | `pdfjs-dist` extraction engine + queue and preview | **in progress — v0.2.0** (calibration modal still to come) |
| 3 | Interactive canvas, DPI readout, synced inspector | not started |
| 4 | Vector PDF exporter, bleed/marks, single/merged/zip | not started |

# CrewBTC — developer notes

This is the implementation side of [CrewBTC](./README.md). For what the app does and how
to use it, read the README first.

Built against [`ENGINEERING_RULES.md`](./ENGINEERING_RULES.md). Those rules are binding:
the §-references below point into that document.

---

## Stack

| Concern | Choice |
|---|---|
| UI | React 19 + TypeScript, Vite 8, Tailwind 4 |
| PDF reading | `pdfjs-dist` |
| PDF writing | `@cantoo/pdf-lib` |
| OCR | `tesseract.js` — lazy, English, language data from CDN |
| Storage | `idb` |
| Tests | `vitest` + `@testing-library/react` (jsdom), `fake-indexeddb` |
| Lint | `oxlint`, plus a type-aware pass |

## Commands

```bash
npm run dev            # dev server on :5173
npm run build          # tsc -b && vite build
npm run typecheck      # tsc -b --noEmit
npm run lint           # oxlint, max-lines enforced at 250
npm run lint:types     # type-aware pass — floating promises live only here
npm test               # vitest
npm run gate           # every gate, in Appendix A order
```

### Why `tsc -b` and not `tsc`

`tsconfig.json` is solution-style (`"files": []` plus project references), so plain
`tsc --noEmit` compiles an empty file set and exits `0` even when `src/` is full of
type errors. Only `-b` actually checks the source. Measured in this repo with a planted
`const label: string = 42`: `tsc --noEmit` exited `0`, `tsc -b --noEmit` exited `1`.

### Why two lint passes

`no-floating-promises` is type-aware and does not fire in a plain `oxlint` run. With a
planted floating promise, the plain pass reported zero warnings and `--type-aware`
reported one. Both passes are required.

## Architecture

```
PDF ──► pdfjs-dist ──► ingest ──► Card ──┬─► DOM preview (mm)
                                          └─► pdf-lib export
```

**The rule that keeps the preview honest:** one layout engine computes every zone
rectangle and every picture fit, and *both* the preview and the exporter render from
that same output. Nothing re-flows at export time.

```
src/
  components/ui/       design-system primitives (§2) — NumberField, ResetButton, Toast
  components/layout/   TopBar, DesktopOnlyNotice
  features/workspace/  the card editor — Card, CardSheet, the Inspector, zone components
  features/settings/   SettingsDialog (a native <dialog>), MotionProvider
  config/theme.ts      the palette and the single accent, as data
  lib/pdf/             extraction: ingest, recipe-text, food-photo, painted-box, ocr
  lib/export/          draw-card (the renderer), write-cards, band-clip, doc-cache
  lib/imposition/      grid + sheet geometry
  lib/storage/         db.ts (idb) + versioned migrations
  types/card.ts        the card model and the zone arithmetic
  data/changelog.ts    release notes, synchronised with package.json (§9)
scripts/               the Appendix A/B gates
```

### The shared functions

Everything visual traces back to two pure functions in `src/types/card.ts`:

- `cardZones(cell, bands)` splits a cell into header / picture / footer. The zones tile
  the cell exactly — no gaps, no overlap — by construction.
- `containRectMm(box, wPx, hPx, transform)` fits a photo inside its box, applies scale
  and offset, and never distorts. Returns `null` for a degenerate box so callers can
  skip drawing rather than emit a zero.

`layoutBand` / `layoutStyledBand` (`lib/export/text-band.ts`, `styled-band.ts`) and
`drawCard` (`lib/export/draw-card.ts`) do the same job for text and pictures: one set of
measurements produces both the on-screen card and the printed one.

### Selection-level text formatting

A card carries a box style (`headerStyle` / `bodyStyle`) and, on top of it, a list of
**runs** (`headerRuns` / `bodyRuns`) that override bold, ink or highlight for a stretch of
characters. Only overridden properties are stored, so a run written when the box was black
stays correct after the box is recoloured.

- `types/text-runs.ts` — the run model: clamping, `shiftRuns` (runs move with the text),
  `applyToSelection` (restyle only what is selected), `styleAt`.
- `features/workspace/card-edits.ts` — the pure card edits the UI applies: `styleInto`,
  `styleSelection`, `textInto`, `changedSpan`, `activeStyle`.
- `lib/export/styled-band.ts` — wraps per style segment, because a bold word measures
  wider than a regular one. A box with no runs takes the single-style path unchanged.
- `draw-card.ts` — draws each segment at its own x offset, so printed output matches.
- `textScale` multiplies the requested point size before layout, so the type still
  shrinks to fit the band. It is applied in `CardZoneText` and in `drawCard`, from the
  same number, which is what keeps the print equal to the preview.

## Geometry

Defaults live in `DEFAULT_SHEET` (`src/types/imposition.ts`):

| Setting | Default |
|---|---|
| Sheet | A4, 210 × 297 mm |
| Cell | 52 × 67 mm |
| Gutter / margin | 4 mm / 4 mm |
| Grid | 3 × 4 = **12 cells**, 67% coverage |
| Card zones | derived per card by `defaultBands(cellHeightMm)` |

`defaultBands(67)` gives 10 / 42 / 15 mm. Cards clamp to `BAND_MIN_MM = 6` per text box
and `PICTURE_MIN_MM = 12` for the photo, so a card can never become two text boxes with
nothing between them.

Sheet settings persist to `localStorage` under `crewbtc.sheet` and are validated on read
— a corrupt or out-of-range value falls back to the defaults rather than rendering a
broken grid.

## The chrome

The app is one screen: a 48px `TopBar`, a 220px Files rail, the canvas, and a 260px
`Inspector`. There is no navigation and no bottom drawer — Settings is a `<dialog>` opened
from the gear, and the card's own controls live in the inspector beside the sheet rather
than under it.

Colours come from `src/config/theme.ts` and the matching `@theme` block in `index.css`.
`bg-surface-panel`, `text-ink-secondary`, `border-hairline`, `bg-accent` and friends are
the only way a surface names a colour, so the palette is one edit rather than forty. There
is exactly one accent (`#E5484D`), used at three depths: the base for rings and selection,
`accent-solid` for fills that carry white text (4.72:1), and `accent-bright` for accent
text on a dark panel. `scripts/check-contrast.mjs` measures all three.

The inspector is contextual: `CardSection` appears when a card is selected, `SheetSection`
is always there. It does not take a callback from the canvas — `selectedCardKey()` derives
which card is meant from the selected cell and the sheet plan, so there is only one answer.

## Workspace zoom

`lib/zoom.ts` holds the ladder and the arithmetic. The controls are in the `TopBar`, which
sits outside the pane the sheet is fitted into, so `useSheetZoom` measures the *canvas*
region and owns the single value both of them read.

Measurement goes through `useElementSize`, which attaches its `ResizeObserver` with a
callback ref rather than an effect. That is not a style preference: the pane does not exist
on first render — it appears with the first batch and disappears when the batch is cleared —
and an effect that measured once on mount therefore measured nothing and left the sheet at
100% permanently. The callback ref re-binds whenever the node changes. It also drops writes
that do not change the size, because a ref callback that writes state on every attach can
detach and re-attach itself into an infinite render loop. `Fit` is a mode
(`manualScale === null`), not a one-off calculation, so a window resize keeps the sheet
fitted until the user steps the zoom. Once the sheet is larger than the pane it scrolls —
it is never silently shrunk.

The wheel listener is attached through `lib/use-wheel.ts`, which binds with
`{ passive: false }`. React's delegated `wheel` handler is passive, so `preventDefault`
inside an `onWheel` does nothing; that is why the photo's scroll-to-zoom and the pane's
Ctrl+wheel both use the direct listener.

## Export

`writeCards` builds the output PDF page by page:

1. Compute the grid from the sheet settings (same `computeGrid` the preview uses).
2. For each placed page, draw its card into the cell.
3. Draw crop marks from `cutMarksFor(grid)` (`lib/imposition/sheet.ts`).

Text is drawn as vector text via `draw-card.ts`. Photos are re-embedded from the
extracted PNG bytes (`embedPng`), at the resolution they were extracted at. The source
PDF page is **not** embedded — that approach was replaced, and any comment or doc that
still claims `embedPage` per cell is out of date.

## Extraction

Each PDF becomes an `IngestedDocument` with one `RecipeCopy` per page.

- **Photo** — `getOperatorList` + `paintImageXObject` to lift the page's own embedded
  image. Falls back to rendering at 2× and cropping the middle region
  (`food-photo.ts`, `painted-box.ts`).
- **Text** — `extractPageText`, then `readRecipeText` splits lines above the photo into
  the header and lines below into the body, one instruction per line.
- **OCR** — only when `getTextContent()` yields nothing (`ocr.ts`). Lazy-imported, one
  worker cached across pages, and failures return empty strings rather than throwing so
  an upload never dies on a bad page.

`PageRef.documentId` is the **file name**, not `IngestedDocument.id`. Matching on `id`
produces blank cards while extraction is perfectly fine — this has been the source of
one "image not extracted" bug already.

## PWA and updates

- `registerType: 'autoUpdate'` — the built worker calls `skipWaiting()` and
  `clientsClaim()`, and precaches 12 entries with a navigation fallback, so the app
  opens offline.
- `useUpdateNotice` listens for `controllerchange` and surfaces a toast with a **Reload**
  action. It deliberately does **not** reload on its own: that would discard unexported
  cards. See §7 for the rule this implements.
- It ignores the first install (no controller means this page *is* the first version),
  ignores changes in the first 1.5 s, and fires at most once per worker.

## Performance

Measured on the production build, gzip:

| Chunk | Size | Loaded |
|---|---|---|
| Initial route JS | ~101 KB | on first paint |
| Initial route CSS | ~7.6 KB | on first paint |
| `pdf` chunk | ~128 KB | first PDF import |
| `es` chunk (pdf-lib) | ~242 KB | first export |

Budgets (§7A) are 200 KB JS and 40 KB CSS for the initial route; `check-bundle.sh`
enforces that the heavy chunks stay off the first paint.

## Testing

199 tests across 22 files. The ones that protect against specific past bugs:

- `card-seeding.test.tsx` — drives the real `App` through upload to placed card. Guards
  the `documentId`-by-file-name behaviour; reintroducing the `id` lookup fails 3 of 7.
- `card-zones.test.ts` — the zone arithmetic, including clamping and degenerate input.
- `card-export.test.ts` — export produces the expected page count and geometry.
- `update-notice.test.tsx` — the three suppression conditions for the update toast.

Scratch `zz-*.test.tsx` files inside `src/test` are picked up by the gate — delete them
before running it.

## Known gaps

- **Not PDF/X.** No output intent; images stay RGB.
- **OCR has never been run against real language data** in this environment — it is
  tested structurally, not end to end.
- **ZIP export** (one file per page) is not built.
- **No font upload.** Base-14 standard fonts only.
- **Browser passes are manual.** Chromium downloads are blocked in the build sandbox, so
  breakpoint and installed-mode checks are reported as `not run`, never claimed.

## Release process

SemVer per §9: PATCH for fixes/docs/refactors, MINOR for new user-facing capability,
MAJOR for breaking storage or API changes. Every release updates `package.json` **and**
prepends an entry to `src/data/changelog.ts`; the two must agree.

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
rectangle and picture fit, and *both* the preview and exporter use that geometry. Text
uses shared layout logic but browser and PDF font metrics can differ, so inspect print
output for clipping or wrapping differences.

```
src/
  components/ui/       design-system primitives (§2) — NumberField, ResetButton, Toast
  components/layout/   TopBar, DesktopOnlyNotice
  features/workspace/  editor shell; cards/, sheet/, files/, project/ and inspector/
  features/settings/   SettingsDialog (a native <dialog>), MotionProvider
  config/theme.ts      the palette and the single accent, as data
  lib/pdf/             extraction: ingest, recipe-text, food-photo, painted-box, ocr
  lib/export/          draw-card (the renderer), write-cards, band-clip, doc-cache
  lib/imposition/      grid + sheet geometry
  lib/storage/         IndexedDB settings, session and original-source storage
  lib/project/         versioned portable project validation and encoding
  types/card.ts        the card model and the zone arithmetic
  data/changelog.ts    typed adapter for the Markdown release history
src/test/              grouped unit tests and shared fixtures
CHANGELOG.md           project memory, current state and canonical release history
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
`drawCard` (`lib/export/draw-card.ts`) share layout rules for text and pictures; actual
glyph measurements come from the browser and PDF fonts respectively.

### Selection-level text formatting

A card carries a box style (`headerStyle` / `bodyStyle`) and, on top of it, a list of
**runs** (`headerRuns` / `bodyRuns`) that override bold, ink or highlight for a stretch of
characters. Only overridden properties are stored, so a run written when the box was black
stays correct after the box is recoloured.

- `types/text-runs.ts` — the run model: clamping, `shiftRuns` (runs move with the text),
  `applyToSelection` (restyle only what is selected), `styleAt`.
- `features/workspace/cards/card-edits.ts` — the pure card edits the UI applies: `styleInto`,
  `styleSelection`, `colorInto`, `textInto`, `changedSpan`, `activeStyle`.
- `lib/export/styled-band.ts` — wraps per style segment, because a bold word measures
  wider than a regular one. A box with no runs takes the single-style path unchanged.
- `draw-card.ts` — draws each segment at its own x offset, so printed output matches.
- Sheet-wide `textScale` multiplies the requested point size. Text wraps at that size
  and clips on overflow; it never automatically shrinks to fit the band.

## Geometry

Defaults live in `DEFAULT_SHEET` (`src/types/imposition.ts`):

| Setting | Default |
|---|---|
| Sheet | A4, 210 × 297 mm |
| Cell | 52 × 67 mm |
| Gutter / margin | 4 mm / 4 mm |
| Grid | 3 × 4 = **12 cells**, 67% coverage |
| New card bands | Top 7.28 mm; bottom 35.45 mm where feasible |
| Text size | 80% sheet-wide |

`defaultBands(cellHeightMm)` supplies the split to newly seeded cards; `clampBands`
keeps a minimum for the text bands and photo, including smaller cells. Existing cards
keep their own bands. The inspector reads those measurements; the card dividers change
them, and the sparkles action copies one split across cards. Header text is centred;
body text is top-aligned. Text wraps at the chosen size and overflow is clipped.

## Units

Every dimension in the model and in the PDF is millimetres. `lib/units.ts` is the only
place that knows otherwise: `fromMm` turns a stored length into the number a field shows,
`toMm` turns a typed number back, and nothing else in the app does arithmetic on units.
That is what makes the switch total — `NumberField` takes `valueMm` + `units` and does the
conversion at its own edge, so the inspector and Settings convert together without either
of them holding a converted copy of anything. Switching units never writes to the model;
only typing does, and it writes millimetres.

`NumberField` has two forms, and the distinction matters: a length passes `valueMm`,
`units` and `onChangeMm`, while a percentage passes plain `value` and `onChange`. The text
scale is the only plain one, because 100% is not 25.4 of anything.

## What is deliberately not here

There is no bleed, trim box or crop-mark setting, and `lib/trim.ts` is gone. Those
controls existed in Settings and in the inspector and none of them reached the exporter:
`writeCards` builds every page at exactly the sheet's own width and height, and the only
marks it can draw are the cut guides between cells. A trim box and a real bleed are a print
pipeline, not a label on a form — until one exists, a switch claiming to do it is worse
than no switch.

Sheet settings persist to `localStorage` under `crewbtc.sheet.v2` (with `crewbtc.sheet` as a legacy fallback) and are validated on read
— a corrupt or out-of-range value falls back to the defaults rather than rendering a
broken grid.

## Card identity and seeding

A card's key is `cellIndex|fileName|pageNumber` — `cardKey` in `types/card.ts`. The cell is
the drawing cell, and every reader must agree: the canvas, the exporter, the strip and the
inspector all key off `placement.cellIndex`. Seeding used to key off the page's ordinal in
the flattened page list, which is correct only while there is one sheet: page 13 is cell 0
of sheet 2, not cell 12 of anything. The cards were written, just somewhere nothing reads.

`useSeedCards` walks every seed on every change rather than remembering what it has done.
`seedCard` refuses to overwrite an existing card, so re-running is free — and a cache would
be a second source of truth that outlives the cards it describes. It did: a `Set` of seeded
keys survived `cardStore.reset()`, so clearing the uploads and loading again matched every
key and seeded nothing. Do not reintroduce a cache here; ask the store.

## Sheets and navigation

`planSheets` splits pages into sheets, twelve to an A4 cell grid. **Every sheet is drawn.**
`CardSheet` renders the whole column, 24px apart, in one scroll container — the canvas used
to draw `sheets[0]`, which meant a thirteenth page existed in the export and nowhere on
screen, and then drew one sheet at a time behind a strip, which made the boundary between
two sheets something you clicked through.

Two consequences worth knowing before touching any of it:

- **"Which sheet" is a measurement, not a choice.** `sheet-stack.ts` owns the arithmetic:
  where each sheet sits, and which one the viewport is on. The canvas reports that on
  scroll; the strip only ever draws it. A `useState` holding a current sheet alongside
  this is the bug this design exists to prevent — they disagree the first time someone
  scrolls by hand.
- **Cell indices repeat across sheets.** Cell 3 exists on all of them, so `selectedCell`
  alone would ring twelve cards. Selection is `(cellIndex, sheet)` — `selectionSheet` in
  `use-sheet-navigation`, and `selectedCardKey` resolves the inspector's card against it.
  `SheetPaper` takes a per-sheet `selectionHere`, which is what keeps the ring on one card.

A thumbnail click is a *request* (`scrollTo`), because the canvas owns the scroll
container and effect ordering is not a contract. The canvas scrolls and clears it. Do not
turn this into a stored index mirrored in two components.

**Selecting a card never scrolls.** `selectCell` records the selection and nothing else.
The press that selects a card is the same press that places a caret in its text and grabs
its photo, so any scroll on that gesture moves the paper out from under the pointer and the
caret or drag is lost. Movement is an explicit act with exactly two triggers — the strip and
a file row — and both call `goToSheet` at the call site. If you find yourself wanting a
third, check whether the card is already on screen: every sheet is drawn, so it usually is.

`SheetThumbnail` is the sheet's own geometry scaled down, not a second renderer: the same
grid, the same cell rectangles, the same placements. The card's text is **greeked**, not
set: a 6mm header band at 64px of thumbnail is 3.7 CSS pixels, and a 9pt glyph inside it is
0.98px — every font size that fits is an unreadable smear, so the band draws one rule per
line of text, as wide as that line is. The photo is real, because an image survives the
downscale. Do not "fix" the thumbnail by raising the font size; the geometry is the
constraint, not the styling.

## Session persistence

The workspace is stored in its own IndexedDB database (`crewbtc-session`), one record,
replaced whole. Three decisions there are load-bearing:

- **Its own database, not a store in `crewbtc`.** Adding a store means a schema bump, and
  `onupgradeneeded` is the only unrecoverable place in IndexedDB — a bad step leaves a
  database the app cannot open at all. This feature shares no records with settings, so it
  does not earn that risk. It is still the same library (`idb`), which is what one-storage-
  library means.
- **A snapshot of the *result*, not the PDF bytes.** Band heights, photo framing and text
  edits cannot be reproduced by re-parsing a PDF, so what is stored is the parsed documents
  plus the card map. A restored session is what the user left, not a second opinion.
- **The writer is armed only after the batch has taken the snapshot** (`BatchApi.hydrated`).
  The read is asynchronous, so the batch is constructed before there is anything to
  construct it from. A writer armed on "the read finished" would — for one render — save an
  empty batch over the session it had just loaded.

`validate` in `lib/storage/snapshot.ts` rejects an unknown shape rather than coercing it,
and migrates snapshot versions 1 and 2 to version 3 while retaining card edits; unknown
future versions are rejected. An **empty** batch is valid and is stored — it means the
user cleared their files.

Original PDFs are retained separately in `crewbtc-project-sources` by document UUID.
Array-keyed retirement markers coexist with older string-keyed source records without a
schema bump. Clear, re-run and project replacement retire removed sources; cleanup waits
past the Undo window and checks the saved workspace before deleting. Undo and reopening a
project cancel retirement. Expired markers are revisited after reload; storage errors leave
sources in place rather than proving them unused. Existing unmarked older orphans are not
automatically removed. Clear browser site data to remove retained copies manually.

Portable `.crewbtc` files are versioned JSON (`lib/project/project.ts`): snapshot, sheet,
unit preference, cut guides and available base64 original PDFs. Validation happens before
replacing the workspace. Missing originals produce a warning; cards still export without
source PDFs. Project files may be large and contain private content.

Selecting a card, or entering a text box, must never move the canvas. `focus()` scrolls the
nearest scrollable ancestor unless given `preventScroll`, and the formatting bar floats over
the sheet rather than taking height from it, for the same reason: editing text must not move
the page.

## Width-fit zoom

`fitWidthScale` looks at width and nothing else. Fitting the whole page made an A4 sheet
small enough that a card's type was unreadable on load, which is the opposite of what a
working canvas is for; the sheet is taller than the pane as a result and the pane scrolls.
The pane therefore cannot use `place-items-center` while fitted — centring an overflowing
item clips its top and makes the first rows unreachable — so it is `items-center` on a
column instead.

Fit is momentary. `TopBar` renders no `aria-pressed` and no accent fill, because the app
already *rests* in width-fit: a permanently lit Fit described the default state while
looking like a chosen one. The percentage readout carries the "fitted" label instead.

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

The inspector is contextual: `CardReadout` appears when a card is selected, `SheetSection`
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

1. Plan sheets using the grid shared with the preview.
2. Draw cut guides when enabled, then each card and its corner overlays.
3. Stroke each cell border last, above the photo and overlays.

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
| Initial route JS | ~127 KB | on first paint |
| Initial route CSS | ~8 KB | on first paint |
| `pdf` chunk | ~128 KB | first PDF import |
| `es` chunk (pdf-lib) | ~242 KB | first export |

Budgets (§7A) are 200 KB JS and 40 KB CSS for the initial route; `check-bundle.sh`
enforces that the heavy chunks stay off the first paint.

## End-to-end tests

`e2e/` runs Playwright against the **preview build**, not the dev server: every bug that
suite exists for lived in production CSS and production timing.

```bash
npx playwright install chromium   # once, needs network
npm run build                    # test against the current production build
npm run test:e2e
```

Where that CDN is blocked, `bash scripts/fetch-chromium.sh` gets a real Chromium from npm
instead and prints the two environment variables the config reads. `npm run gate` runs
`gate:e2e`, which executes the suite if a browser can be found and otherwise reports
**`NOT RUN`** with the test count — it never claims a pass. Treat `NOT RUN` as an open
gate, not a green one.

Blocked service workers matter: the app is a PWA, so a reused browser profile serves a
**precached previous build** and every measurement silently describes the wrong code. The
config blocks service workers everywhere except `offline.spec.ts`, which exists to test
them.

Every spec says why it exists. The short version: jsdom has no layout, no hit-testing and
no default browser behaviour, so a click swallowed by an element that mounted between press
and release is invisible to it — which is exactly how that bug shipped twice.

## Testing

Run `npm test` for the current test counts. Some tests protecting past bugs:

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
- **Installed-mode and full cross-browser inspection** are separate from the automated
  Chromium suite; report them as not run unless actually performed.
- **Corner labels:** unsupported font characters are dropped and long labels truncated
  in print; review the exported PDF.
- **This sheet export** currently selects the first sheet, not the sheet in view.
- **Original source cleanup** does not remove unmarked orphan records created by older builds.

## Release process

SemVer per §9: PATCH for fixes/docs/refactors, MINOR for new user-facing capability,
MAJOR for breaking storage or API changes. Every release updates `package.json` **and**
prepends an entry to the release-history section of `CHANGELOG.md`; the two must agree.
Update its current-state ledger whenever behavior, architecture or known gaps change.
The build reads only the release section into the app, through `src/data/changelog.ts`.

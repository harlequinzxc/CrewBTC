# CrewBTC — Project Memory and State Ledger

This is the project's durable engineering memory and current implementation state. It
records what exists, why it exists, what was replaced, known failures and incomplete work.
It describes the implementation, not a second rules file or a speculative roadmap. For
user instructions see [README.md](README.md); for development commands and engineering
rules see [CONTRIBUTING.md](CONTRIBUTING.md) and [ENGINEERING_RULES.md](ENGINEERING_RULES.md).

Update the current-state sections when behavior, storage, architecture, or known gaps
change. Record evidence and mark unverified behavior as such; do not erase historical
release entries. Under **Release history**, add newest-first entries using the format
`### VERSION — YYYY-MM-DD — TITLE` followed by one-line `- ` highlights. Dates use
Singapore time (Asia/Singapore, UTC+8) and refer to the release commit date. The app's typed
adapter parses that section for the in-app changelog and visible version; the state ledger
above it is not shown as release notes. `package.json` and the newest entry must agree.

## Current product and architecture

- CrewBTC is a browser-only, desktop-oriented recipe-card editor. Imported PDFs are
  extracted into editable text and photos, laid out on sheets, and exported as print PDFs.
  Below 1024 px a notice appears while the workspace stays mounted. No server receives PDFs.
- React/TypeScript and Vite provide the UI; PDF.js handles extraction, `@cantoo/pdf-lib`
  writes PDFs, `idb` wraps IndexedDB, and Tesseract OCR is lazy-loaded for pages without
  text. First-use OCR needs network access and is English-only. The app shell is a PWA.
- Workspace composition is `src/features/workspace/WorkspaceScreen.tsx`. `cards/` owns
  card content, formatting, dividers and photo controls; `sheet/` owns sheet rendering,
  navigation and export orchestration; `files/` owns the batch and file rail;
  `project/` owns project and session hooks; `inspector/` contains inspector controls.
  Cross-cutting shell components remain at the workspace root. Pure PDF extraction,
  geometry, export, storage and project-format code live under `src/lib/`.
- Unit tests are grouped under `src/test/{cards,sheet,pdf,persistence,ui}` with shared
  helpers in `src/test/fixtures`; `src/test/setup.ts` is Vitest's global setup. Browser
  tests live in `e2e/` and run against a production preview. Runtime PDF.js character
  maps and fonts in `public/pdfjs/` are required assets, not disposable build output.

## Implemented behavior and invariants

- The default sheet is A4, 210 × 297 mm, with twelve 52 × 67 mm cells, 4 mm spacing and
  margin. New cards start at top 8.56 mm and bottom 35.45 mm when feasible; smaller cells
  clamp the bands to retain photo space. Existing card measurements are not overwritten.
- Header and footer text default to bold black; the header is centred, the footer is
  top-aligned. Sheet-wide text starts at 90%; text wraps and can clip, but does not shrink
  implicitly. The inspector reads Top, Bottom and Text; dividers adjust bands. Single-click
  presets apply formatting; CROCKERIES destructively uppercases stored text. DIRECTIONS
  applies red ink to selected text or the whole active box; an identical red highlight is
  removed for legibility, while other formatting is retained. The floating formatting pill
  follows the active card and is clamped to the live sheet viewport without changing layout.
- The inspector stores one keyword or phrase per line for each callout category. Automate
  formatting scans only the bottom text of all occupied cards, case-insensitively at whole-word
  boundaries, choosing
  the longest overlap then CROCKERIES, DIRECTIONS, CONDIMENTS for ties. It bullets non-empty
  physical lines in bottom text, converts leading dash-space markers to bullets, preserves
  existing bullets and numbered lists, and does not treat visual wrapping as a line break. It asks for confirmation because CROCKERIES changes
  stored text to uppercase; Undo restores only cards not subsequently edited. Lists persist
  locally and in projects. They start empty; no semantic inference or default keyword list.
  Remove formatting clears the three callout colours in both zones on all occupied cards without removing
  bullets or reversing uppercase text, and offers Undo. Stored styles have no preset origin,
  so matching manually applied colours are also treated as callouts.
- The optional live PDF preview uses the export writer and PDF.js, updates after a short
  debounce, and supports sheet navigation and zoom. It splits the workspace at 1280 px and
  wider and overlays it on narrower supported windows. Failed or partial renders are reported.
- Each file row offers a right-click and keyboard-accessible action to download its stored
  original PDF, with an explanation when the original is unavailable.
- The header has inline project actions, a print-review status and export choices; a bottom
  bar carries paper size, sheet count and centered zoom controls. The status counts cards
  with any review warnings and is informational; details remain in the inspector.
  Full-span 14 px structural rails collapse Files, the sheet strip and the inspector without clipping.
  The inspector uses accordions: Automate formatting starts open, while New card defaults and Sheet & print start closed.
  Session-only undo/redo tracks up to 80 card, formatting and sheet-setting actions;
  native text inputs keep their own undo. Switching stations, changing files or replacing
  a project clears the history.
  Station tabs and sheet thumbnails do not scroll vertically.
  Reduced motion follows the saved choice or system preference, preserves static layout
  transforms and makes UI state changes and scrolling immediate when enabled. When off,
  inspector accordions, Settings, toasts, Export, print selection and release notes animate;
  other state transitions remain under review. Side rails and the fitted sheet resize together
  before paint. The click diagnostic remains in Settings.
  Station tabs are horizontally scrollable and support inline rename by double-click;
  the rename field sizes itself to the text and reveals the beginning when opened.
- Station tabs isolate batches and cards, while settings are shared. Page filters can place
  different pages of an uploaded PDF in different station workspaces. Custom selection packs
  chosen stations/cards into temporary sheets and preserves the originals and their labels.
- This sheet exports the sheet visible in the editor. Batch review flags missing card
  content, likely text overflow, unsupported characters, and corner label truncation;
  warnings are advisory and link to the affected card. The preview can expand full screen.
- A locally saved band-height preset applies to newly seeded cards, clamped to cell size;
  existing cards are unchanged. Text size is sheet-wide and remains separately remembered.
- Clicking a photo enters adjustment; the sparkles copy a card's bands to others. Background
  removal uses a local classical cut-out with sensitivity and undo, not a downloaded model.
- Number boxes wrap from 40 to 1. Editable right-hand labels propagate forward from an
  override until the next override. Both corner boxes overlay content and print, and share
  the sheet's base font/size. The dropdown arrow is not printed.
- Card identity is `cellIndex|fileName|pageNumber`; `cellIndex` repeats on each sheet.
  Page references use file name, not document UUID. Selection and editing must also identify
  the sheet; never treat a bare cell index as globally unique. Duplicate file names remain
  an identity limitation and must be considered before changing this scheme.
- Preview and export share geometry, but browser and PDF font metrics can wrap differently.
  Export draws from saved cards and photos, not source PDF pages; the cell frame is drawn
  last so photos and labels cannot cover it. Verify actual downloaded PDFs, not just toasts.

## Persistence and portability

- `crewbtc-session` IndexedDB stores a whole version-4 snapshot with all stations and active
  selection. Versions 1–3 migrate to one station; future versions are rejected.
  `crewbtc` IndexedDB stores page preferences; `crewbtc.sheet.v2`, `crewbtc.cut-guides` and `crewbtc.format-keywords.v1`
  are local-storage settings. See `src/lib/storage/` and the migration tests before changes.
- `crewbtc-project-sources` stores original PDF bytes by document UUID. Removed sources are
  marked for retirement after a 10-second Undo grace period; cleanup checks the persisted
  snapshot, and Undo or reopening a project cancels retirement. Cleanup is best effort and
  old unmarked orphan records are not automatically purged. Do not equate a missing source
  with missing editable cards; report missing originals instead of discarding work.
- A `.crewbtc` project is versioned JSON with the snapshot, sheet, units, cut-guide setting,
  formatting keywords and available base64 source PDFs. Version 4 deduplicates identical
  image and PDF assets. Version 3 contains stations; version 2 adds keywords and version 1
  opens with empty lists. Older app versions cannot open version 4 projects. Opening
  validates before replacement and confirms before overwriting a populated workspace. Project files are explicit downloads, not live saves.
  Source files may contain private data; clearing site data also removes local workspace data.

## History and reasons that matter

- A text-editing failure came from per-sheet cell indices being treated as global and a
  focus/press interaction. Repeated press-only fixes missed the duplicate editor. The
  historical investigation is in [docs/ROOT-CAUSE-text-editing.md](docs/ROOT-CAUSE-text-editing.md);
  its withdrawn release numbers overlap later releases and must not be read as current state.
- Earlier exports after reload were blank because source PDF bytes were held only in memory.
  Export now draws persisted card models and photos; original PDF bytes are still relevant
  for re-running extraction and portable projects.
- Units once failed to persist because an IndexedDB store with an inline key was given a
  separate key to `put`. Keep the real-storage regression test as well as browser coverage.
- Content-based automatic band sizing and editable inspector band fields were replaced with
  configurable new-card band defaults, draggable dividers and read-only current-value inspection.

## Known limitations and verification status

- Long corner labels are truncated in print, and characters unsupported by the standard PDF
  font are replaced. Text can also clip when a band is too short. The advisory review flags likely issues but cannot guarantee a print-ready PDF; inspect the exported PDF.
- Page references use the first page's dimensions for the entire source document. The app
  assumes similar PDF layouts; OCR is a fallback, not a full document-scanning workflow.
- No PDF/X output intent, ZIP of separate sheets, font upload or mobile editor is implemented.
  Offline OCR requires previously available OCR assets; first-use language data is networked.
- Existing unmarked orphan originals can persist in browser storage. Source retirement is
  best effort, not a claim that clearing files securely wipes all local data.
- Chromium unit/browser gates do not prove installed-mode, all browsers, real OCR language
  data, service-worker update timing, or screen-reader behavior. Report unrun checks honestly.
  The v1.16.0 full gate passed 511 unit tests and 74 Chromium browser tests. These results
  are not evidence for later changes; use `npm run gate` and inspect results for each release.

## Release history

### 1.24.4 — 2026-11-24 — Synchronize side rail changes

- Update the fitted sheet in the same frame as left and right rail collapse or expansion.
- Test both reduced-motion preference sources and both directions on each rail.

### 1.24.3 — 2026-11-24 — Make reduced motion immediate

- Disable animations, transitions, fades and smooth scrolling when Reduced Motion is on.
- Remove visual exit delays in reduced motion and preserve static layout transforms.
- Clarify the engineering rule and cover tabs, dialogs, menus and accordions in browser tests.

### 1.24.2 — 2026-11-24 — Continue motion and accessibility audit

- Animate the Export menu, print selection dialog and Settings release notes with non-interactive exit states.
- Improve muted-text and button-hover contrast, and expose busy states on several async controls.
- Document remaining motion and accessibility gaps; the app is not yet fully audited for all-state motion.

### 1.24.1 — 2026-11-24 — Respect motion preferences

- Respect reduced motion in sheet navigation and preserve static layout transforms.
- Add bounded motion and timer-based cleanup for Settings, inspector accordions and toast actions.
- Record the broader engineering-rule audit and outstanding review items.

### 1.24.0 — 2026-11-24 — Undo and redo edits

- Add keyboard shortcuts and bottom-bar undo and redo for card edits, formatting, dividers and sheet settings.
- Preserve native text-field undo and bound session history to 80 actions.

### 1.23.0 — 2026-11-24 — Keep formatting near the active card

- Replace the canvas-wide formatting bar with a floating pill anchored to the active card.
- Flip and clamp the pill within the live preview as cards scroll, zoom or panels resize.

### 1.22.1 — 2026-11-24 — Refine panel and inspector defaults

- Use a pointer cursor on all panel collapse and expand rails.
- Open Automate formatting by default, close the other inspector accordions, and simplify its helper copy.

### 1.22.0 — 2026-11-24 — Structural rails and inspector refresh

- Replace floating edge handles with full-span 14 px rails that remain available when panels collapse.
- Organize inspector settings into accordions, refresh automation controls, and align sheet fields in two columns.

### 1.21.1 — 2026-11-24 — Keep tabs and edge handles visible

- Prevent vertical scrolling in the station tab row while preserving horizontal navigation.
- Keep all 24 px panel handles fully visible and clickable in expanded and collapsed states.

### 1.21.0 — 2026-11-24 — Unified panel edge handles

- Add matching edge controls for Files, the sheet strip and inspector; keep print status informational.
- Remove vertical overflow from the sheet thumbnails while retaining horizontal scrolling.

### 1.20.1 — 2026-11-24 — Keep export status in sync

- Count all cards with print-review warnings, not only clipping warnings, before showing Ready.

### 1.20.0 — 2026-11-24 — Bottom zoom and export status

- Move sheet dimensions and zoom to a bottom bar; put New, Open and Save in the header.
- Show a clipping-check status while retaining the wider print review and click diagnostic.

### 1.19.4 — 2026-11-24 — Align header controls

- Keep top-bar icons and labels on one centered line with tooltips for utility controls.

### 1.19.3 — 2026-11-24 — Show the start of station names

- Give inline station renaming extra text room and reveal the first character on entry.

### 1.19.2 — 2026-11-24 — Fit station names while editing

- Size the inline station rename field to its text as it changes.

### 1.19.1 — 2026-11-24 — Align station tab editing

- Keep station tabs and the plus button aligned while renaming, without duplicate accent borders.
- Enter rename by double-click; single-click only switches stations.

### 1.19.0 — 2026-11-24 — Compact header and station tabs

- Center zoom, group project actions, and choose a print option from the Export menu.
- Use compact scrolling station tabs; double-click or press F2 to rename inline.

### 1.18.0 — 2026-11-24 — Download original PDFs

- Download the original PDF from its file row via right-click or the options button.

### 1.17.0 — 2026-11-24 — Smaller projects and custom export

- Store identical images and original PDFs once per project, without reducing image quality.
- Open custom selection from Export; use Shift-click or drag handles for faster selection.

### 1.16.0 — 2026-11-21 — Station workspaces and flexible printing

- Organise PDF pages and editable cards in station workspaces, saved together in one project.
- Select stations and individual cards for a compact combined PDF, with a generated preview.
- Start a new project while keeping inspector settings; new defaults are 8.56 / 35.45 mm and 90% text.

### 1.15.0 — 2026-11-21 — Print review and card defaults

- Export the sheet currently in view, and review possible print issues across the batch.
- Expand the higher-resolution PDF preview and save selected band heights for new cards.

### 1.14.0 — 2026-11-21 — Live PDF preview

- Preview the actual generated PDF while editing, with sheet navigation, zoom and responsive layout.
- Report preview errors and skipped cards, and warn about the existing first-sheet export limitation.

### 1.13.1 — 2026-11-21 — Keep automated formatting in bottom text
- Restricted keyword formatting and bullets to bottom text; top text and its existing styles remain untouched.

### 1.13.0 — 2026-11-21 — Remove callout formatting and tidy bullets
- Added Remove formatting below Automate formatting to clear callout colours across cards, with Undo.
- Converted leading dash-space list markers to bullets during automated formatting.
- Made the two buttons compact and vertically centred.

### 1.12.0 — 2026-11-21 — Keyword-based automated formatting
- Add editable keyword lists to the inspector and apply CROCKERIES, DIRECTIONS and CONDIMENTS to matching text across occupied cards.
- Add bullets to non-empty bottom-text lines without treating visual wraps as new lines; confirm and offer Undo for the batch.
- Save keyword lists locally and in version 2 projects; open version 1 projects with empty lists.

### 1.11.0 — 2026-11-21 — Red directions and Singapore release dates
- Added DIRECTIONS to colour selected text or the active box red, including in exported PDFs.
- Moved the release-notes build plugin into scripts/ without changing the changelog source.
- Stabilised ingestion wiring tests by waiting for asynchronous processing to finish.
- Corrected historical release dates against their commits using Singapore time.
- Established Singapore time as the required timezone for changelog release dates.

### 1.10.2 — 2026-11-21 — Organised workspace and project memory
- Grouped workspace code and tests by responsibility without changing card editing, extraction or export.
- Replaced the release-notes JSON with a Markdown project memory and state ledger; the in-app changelog reads the same release history.
- Updated the engineering rule to maintain that Markdown file as the source of truth for release history and current project state.

### 1.10.1 — 2026-11-21 — Reliable units and tidier local storage
- Fixed: units selected in Settings and restored from projects now survive a reload.
- Removed original PDFs are reclaimed after the Undo window when safe; Undo and re-opened projects keep their originals.
- Removed unused code and updated the user and developer documentation to match the current editor.

### 1.10.0 — 2026-11-21 — Save and open editable projects
- Save an editable project containing cards, photos, labels, sheet settings and available original PDFs; open it on this or another computer.
- Original PDFs are retained locally when storage allows. Older sessions without them can still save their cards, with a warning that re-running extraction needs the originals.
- Opening a project confirms before replacing your current work; damaged or unsupported files leave it untouched.

### 1.9.8 — 2026-11-21 — Export restored cards after reload
- Export uses saved cards and photos even after a reload, without needing the original PDF to remain in memory.
- Incomplete exports now show a warning, and exports with no complete cards report an error instead of a misleading success.

### 1.9.7 — 2026-11-21 — New card margins and a visible print border
- Newly extracted cards start with a 7.28 mm top band and a 35.45 mm bottom band, where the cell has room. Existing cards keep their own measurements; smaller cells clamp the split to preserve photo space.
- The printed card border is now drawn above the image and corner labels so it stays visible.

### 1.9.6 — 2026-11-21 — Card measurements and editable label runs
- Select a card to see its Top and Bottom band heights and the current sheet-wide Text percentage in the inspector. These are read-only values; the dividers and sheet text control still make the changes.
- Each right-hand corner label is editable. A change applies from that card onward until another card changes it; earlier cards keep their labels, and the same runs appear in the PDF.
- Older saved cards are retained when sessions are upgraded. Their first corner label continues to supply the initial run.

### 1.9.5 — 2026-11-21 — One shared corner label and a smaller print box
- The first card’s right-hand corner label now appears on all following populated cards, including across sheets. Edit the first card to change or clear every mirrored label.
- Both grey corner boxes print with slightly less vertical padding, while keeping the same type size and centred text.
- New sheet settings default to 80% text size. A previously saved text-size choice is kept.

### 1.9.4 — 2026-11-21 — One text size across the card
- The top and bottom text now use the same base size, and both corner fields use that same size and font. The sheet-wide Text size setting changes all four together on screen and in the PDF.
- The grey corner boxes grow with the text size, keep a little space above and below it, and centre the text. The number dropdown remains selectable, but its arrow is not printed.

### 1.9.3 — 2026-11-21 — Numbered corners, sheet-wide type and adjustable photo cut-outs
- The inspector now focuses on sheet and print settings. A single Text size control changes all card text on screen and in the PDF; card band dividers remain draggable on the sheet.
- Two equal light-grey corner fields sit over each populated card. Pick a number from 1 to 40; following cards count up across sheets and wrap after 40. The other field accepts a short label, and both fields print.
- Background removal now has a sensitivity slider. Higher values remove a broader range of colours; change it and cut again to try the original photo at a different setting. Undo restores the original while the photo controls remain open.

### 1.9.2 — 2026-11-21 — Cut the background off a dish, adjust a photo in one click, and text that stays put
- New: a cut-out button inside the photo frame removes the background behind the dish, leaving it on a transparent field so the card's own paper shows through — on screen and in the printed PDF
- The photo frame now opens on a single click. Moving, zooming and the margin buttons are one gesture away instead of two, and the same click still selects the card so its margins can be dragged
- Clicking a text box no longer shifts the words. The first line was landing about 3px low when the field opened, which read as a flinch on every click; top and bottom boxes now begin on the same row in both states
- Removing the background keeps the original: an undo button appears beside the cut-out once it has run, so a busy counter behind a plate can be put back without re-importing the file
- Set the text size instead of it changing on you — the Text % control is the size knob, and dragging a margin now only re-wraps the words, never shrinks them

### 1.9.1 — 2026-11-21 — Square cards that print framed, steps that start at the top, and same margins in one click
- The steps now begin at the top of their box instead of floating in the middle. The name still centres, because it is a heading with nothing under it; a printed step list should start where a reader's eye expects it. The PDF follows the same rule, so a card tall enough to show the difference prints the same way
- New: a sparkles button inside the photo frame, while you are adjusting it, gives every card the margins of the one you are looking at. Adjust one, tag it, done — rather than dragging twelve dividers to match
- Cell corners are square. A cut card has no radius, and the preview was rounding something the print kept sharp
- The cell border now prints. The preview has drawn one since the sheet existed and the export did not, so a card that looked like a card on screen printed as bare paper with only the registration marks saying where to cut
- The formatting bar no longer says “whole box”. Every box starts that way, so the label said nothing and took room the presets need; “selection” still appears when a stretch of text is selected, because that is the case worth warning about

### 1.9.0 — 2026-11-21 — Callout presets, bold black text, and the selection that was silently dropped
- Fixed, and it was mine: no card could be selected. v1.8.2 changed the dismiss rule so a press on a card would end an edit — and in doing so dropped the page identity that press carried. The canvas compares that identity against each sheet to decide which card is highlighted, so it compared nothing against everything: no card ever drew as selected, and the band dividers, which only exist on the selected card, never appeared at all. That is why the photo could not be resized; the drag was never unreachable. Selection now passes the identity through, and dragging the dividers resizes the photo again
- Fixed: clicking an empty bottom box made its hint vanish. The drawn box shows “Plating steps”; the field it becomes had no placeholder, so the box went blank and its grey text disappeared. The field now carries the same hint, in the same grey, at the same weight and alignment — the browser’s default placeholder ink is the field’s own colour at half strength, which is a different grey
- All card text now starts bold and black, and the top box starts centred. It used to be plain black on top and plain red below, which described the PDF’s typography rather than the card a cook reads
- New: two recipe callout presets replace nine colour and highlight swatches. CROCKERIES tags a callout in red with white capitals; CONDIMENTS tags it in green with black type. One click each, and clicking the active one again clears it
- The capitals are drawn, never stored: “kung pao chicken” stays exactly that in the file and prints as KUNG PAO CHICKEN. Clearing the tag gives the lower case back, and the export carries the fill, the ink and the case into the PDF
- Clear formatting puts a box back to the default look in one click, and Bold stays. The bar is four controls where it was nine

### 1.8.3 — 2026-11-21 — The text box no longer changes when you click into it, and the formatting bar stopped covering the header
- Fixed: clicking a card’s text made it jump. The drawn box and the field you type into were two different boxes — the drawn one carried a 4px padding and sat on the bare card, while the focused one carried 0.8mm of padding on a near-white plate with rounded corners. The moment the caret arrived, every letter moved. The drawn box now uses the focused box’s measurements, colour and plate, so what you see before clicking is exactly what you get after
- Fixed: the formatting toolbar appeared across the very top of the window, over the zoom controls and the Export button. The bar is positioned against its nearest positioned ancestor, and the sheet had none — so the bar climbed all the way to the app root. One missing class; it now sits at the top of the canvas, below the header, and Export is never covered
- Both are now held by tests that were shown to fail on the old code first: the box is compared before and after the caret arrives on seven computed properties and on the exact pixel the type starts at, and the bar is checked to start below the header and below Export
- Described in full, the bar offers: the zone name, whether you are restyling the whole box or just the selection, a Bold toggle, four text colours and four highlight colours plus an off switch — and every control keeps your selection alive when you click it

### 1.8.2 — 2026-11-21 — The text box stops closing itself, and only one sheet opens it
- Fixed the reported bug: clicking a card’s text did nothing. The truth was not that the press was lost — it always arrived and always ran the handler. There were two faults, and each hid the other
- First: which card was being edited was recorded by cell number, and every sheet draws the same cell numbers. Opening cell 3 therefore opened a text field on every sheet in the stack, and the fields took the caret from each other in a loop. That is the flicker. Editing now records the sheet it began on, so only that sheet opens a field, exactly as selecting a card already worked
- Second: an edit ended whenever the field lost focus, and a field loses focus for reasons nobody chose — the window losing focus, a scroll, the layout shift from the field appearing. With an editor open on more than one sheet the caret is contested, so the box could open and close within a millisecond. Edits now end on Escape, on a press on another card, or on a press on the canvas around the sheets
- Why it took so long: fixing either fault alone left the bug. Suppressing the default press handling, moving when focus is taken, and opening the box from a fallback listener were all real improvements that could not have worked on their own, and each one was measured against a field that was closing itself before anything could see it
- The lesson recorded in docs/ROOT-CAUSE-text-editing.md: when a container changes from showing one item to showing all of them, every key that identifies a place must be re-read. A bare index is a place only while there is one list

### 1.8.1 — 2026-11-20 — One click on a card’s text now edits it
- Fixed: the first click on a card’s text only selected the card, so editing took two clicks and the second one landed on something that had moved. Selecting a card reveals its band dividers, and those appeared under the pointer between press and release, swallowing the click
- Text now begins editing on press rather than on release, so the gesture completes before anything can appear underneath it
- The band dividers are drawn after the text boxes rather than between them, so they no longer paint over the last few pixels of a header or footer band

### 1.8.0 — 2026-11-20 — Your work survives a reload, and Clear all can be undone
- Your session is saved: uploads, placements and every card edit are restored when you come back, so closing the tab is no longer a total loss
- Clear all files now offers Undo. It used to be one click that destroyed the batch and every edit made to it, with no copy anywhere to recover from
- Fixed: clicking into a card’s text moved the canvas. Focusing a text box scrolled the stack to reveal it, and the formatting bar appearing above the sheet shrank the canvas — both moved the page out from under the pointer
- The text formatting bar now floats over the top of the sheet instead of taking 32px of canvas height the moment you start editing
- Fixed: an unhandled render error white-screened the app and took every unsaved edit with it. A boundary now catches it and offers a reload
- Removed the unused `batches` store from the database schema and the storage hook nothing called — a store that promised persistence the app did not have

### 1.7.1 — 2026-11-20 — Selecting a card no longer drags the page out from under the pointer
- Fixed: clicking a card scrolled the canvas. Since clicking a card is also how you place a caret in its text or grab its photo, the paper moved mid-click and the caret or the drag was lost before it started
- Selection and navigation are now separate: pressing a card selects it and nothing else. The canvas moves when you click a thumbnail or a file row, which are the two gestures that mean “take me there”

### 1.7.0 — 2026-11-20 — All the sheets at once, a strip that looks like the paper, and a rail you can search
- Sheets are now one continuous column: every page of a 27-file batch is stacked in the canvas, 24px apart, and you scroll from the first to the last instead of paging through them
- The sheet strip shows real miniatures — the dish photo at full fidelity, and each card’s text greeked into rules whose lengths follow the words, because a 6mm band at 64px is 3.7px tall and no font size survives that
- Scrolling the canvas moves the active thumbnail, and clicking a thumbnail scrolls the canvas: one answer to which sheet you are on, whichever way you ask
- Clicking the dark canvas beside the paper, or the white margin around its cells, clears the red selection and puts the right rail back to Sheet & print
- Files gains a filter under Add PDFs for batches too long to scan, and each row shows where its first card landed (S2 · 07). Clicking a file scrolls to its card and selects it
- The right rail can be collapsed from a button beside the Settings gear, giving its 260px back to the sheet
- Top, Bottom and Text in the card inspector are a three-column grid with their labels stacked above the boxes, so a number is never squeezed between a label and its unit
- Numeric fields are 28px tall rather than 24px: at 24 the digits sat on the border and the field read as a readout instead of something you can type into
- Fixed: the sheet strip’s header could clip against the canvas on a long document

### 1.6.1 — 2026-11-20 — Sheet two gets its text and photos, and a cleared document comes back
- Fixed: the second sheet showed empty cards — no text, no photo. Every page past the first twelve was seeded under its position in the page list instead of the cell it actually landed in, so the cards existed in the wrong place and the sheet looked blank
- Fixed: after clearing the uploads and loading a PDF again, nothing came back — not even the first sheet. The seeding step remembered which cards it had already filled, and that memory outlived the cleared cards, so the second load filled nothing
- The seeding step now asks the card store whether a card exists rather than trusting a cache, which is also what keeps it from overwriting a card you have edited

### 1.6.0 — 2026-11-20 — Every sheet is reachable, and a narrow window stops eating your work
- Fixed: shrinking the window below 1024px used to unmount the workspace, and an unmount threw away your uploaded PDFs, photos and card edits. The workspace now stays mounted behind the notice, so widening the window brings everything back exactly as it was
- The sheet opens fitted to the width of the window instead of the whole page, so every card is readable on load without zooming — the sheet scrolls vertically instead
- Fit is a momentary action again: it returns the sheet to width-fit but never stays lit, because width-fit is already where the app rests
- Sheet navigation: documents longer than twelve cards get a strip of sheet miniatures along the bottom of the canvas. Click one to jump to that sheet, or collapse it to a Sheets (2) pill to get the canvas height back
- The canvas shows every sheet, not just the first — a thirteenth page used to exist in the export and nowhere on screen
- Clicking a file in the Files rail jumps to the sheet its first card is on, and clicking a card on another sheet moves the canvas to it
- Spacing and Margin fields are now sized like one half of a Size or Cell pair, so the number sits hard against its unit instead of floating at the far edge of an empty box
- Numeric fields use tabular figures, so a unit never shifts sideways as the digits change

### 1.5.0 — 2026-11-20 — One unit for the whole sheet, and the dead print controls are gone
- Units now offers millimetres, centimetres and inches, and the choice converts every field at once — the inspector, the sheet size, the cell size and the card boxes all read in the unit you picked
- Nothing is stored in your chosen unit: dimensions stay millimetres in the document and in the exported PDF, so 21 cm and 210 mm are the same sheet and switching units cannot shift a value
- Bleed, Trim marks and the Trim size dropdown have been removed. They never reached the file — the page was always the sheet's own size, and no trim mark was ever drawn — so they now stop promising one
- The space between cards is called Spacing instead of Gutter
- Number fields are 24px with no internal padding, so a number and its unit sit together instead of floating in an empty box; the inspector's rows and section padding are tightened to match
- The header shows the app's real icon rather than a lettered red square
- Text in a card's boxes is clipped to its own box with the exporter's own padding, so a short band can never bleed type into the photo or the next card
- Fit is lit only while the sheet is actually fitted; any manual zoom clears it in the same gesture
- The explanatory line under Print output is gone, along with the section it described

### 1.4.2 — 2026-11-20 — The photo gets the room the words do not need
- Card text boxes now size themselves to their own text — a short dish name hands the surplus to the photo instead of leaving a blank band between the name and the picture, which grows from 63% to about 78% of the card
- Text sits in the middle of its box instead of the top, so raising a box spreads the air on both sides of the words rather than opening one obvious gap beneath them
- Settings opens on General: Units and Reduced motion first, then print output marked as global defaults for every sheet, with What's new still folded away at the bottom
- Inspector numbers are visibly editable again — the field surface sits a step above the panel behind a real border that answers hover and focus, instead of blending in as static labels
- Empty cell slots rest as a whisper on the paper and step up only under the pointer or keyboard focus, so an unfilled sheet no longer looks like a list of errors

### 1.4.1 — 2026-11-20 — The sheet opens fitted, and settings stops burying its own toggles
- Fixed: the sheet came up at a literal 100% instead of filling the window — the canvas measurer attached to an element that did not exist yet and never looked again
- The percentage is the real scale whether or not you chose it, and Fit is highlighted while the fit is live, so a computed 283% cannot be mistaken for one you set
- Settings is centred over the sheet rather than appearing in the corner, and is a bounded panel instead of a full-height drawer
- What's new is one collapsed row naming the current version, instead of eight releases above the fold — print output and reduced motion no longer need scrolling to reach
- The sheet dimensions appear only in the inspector, where the sheet is; settings keeps trim, bleed, units and motion

### 1.4.0 — 2026-11-20 — One sheet, one bar, one inspector
- The far-left navigation rail and the docked drawer under the sheet are gone: the A4 sheet now runs from the top bar to the bottom of the window
- A single 48px bar holds the logo, − % + and Fit, the settings gear, and Export with a menu for every sheet as one PDF
- The right rail is a contextual 260px inspector: a card's Top, Bottom and Text numbers when a card is selected, the sheet and print settings otherwise
- Card heights are typed rather than dragged to: compact millimetre fields with arrow-key stepping, in place of the sliders' 6–55 mm sweep
- One + Add PDFs button in the Files queue, with compact rows and hover-only retry actions; the duplicate header button, per-row size badges and the one-item tab strip are gone
- One accent across selection, active borders, toggles and the primary button; no browser-blue sliders and no pure black
- Settings opens as a dialog over the sheet instead of replacing the whole screen
- Every explanatory paragraph under the controls is gone — the labels do the work

### 1.3.0 — 2026-11-20 — Zoom into the sheet, and shape a card by dragging it
- The sheet zooms properly now: −, the percentage, +, and Fit in the toolbar, plus Ctrl/Cmd + wheel over the workspace
- Fit is a mode — resizing the window keeps the sheet fitted until you step the zoom yourself, after which the pane scrolls
- The floating slider and buttons over a photo are gone: double-click the frame to adjust, drag to pan, scroll to zoom, and Escape or a second double-click leaves with the framing kept
- Scrolling while adjusting a photo zooms the photo and nothing else — the sheet no longer moves underneath it
- Drag the boundary lines on a selected card to resize the text boxes directly, instead of reaching for the sliders
- A text scale control makes a card's type bigger or smaller without touching the picture band: the layout re-wraps until it fits
- Fixed a band clamp that could leave a 6 mm photo where 12 mm was promised — it affected any card given a large header

### 1.2.0 — 2026-11-20 — Format the words you select, not the whole box
- Select some text and Bold, ink colour and highlight apply to just that stretch — the rest of the box keeps its own style
- Red, green, amber and blue highlight boxes to match a reference card, plus an off switch
- The formatting bar says whether it is about to change a selection or the whole box, so the two are never confused
- Formatting survives typing: a highlighted word keeps its highlight when text is added, changed or deleted around it
- Printed output matches: the export draws each stretch in its own weight, ink and highlight, verified against the PDF's own content stream
- Picture controls were already complete — double-click to adjust, drag to pan, wheel or +/−/Reset to zoom — and now have tests covering each one
- Panning no longer re-subscribes its listeners on every pointer move, which is what made dragging feel sticky

### 1.1.1 — 2026-11-20 — Photos stay in their cell, and the three zones stop overlapping
- Cards are positioned from their own corner now — the preview was passing sheet coordinates into card-relative boxes, which shifted every zone down and right, pushing photos out of the cell and off the paper
- The three zones stack with no overlap: header top, photo middle, footer bottom, tiling the card exactly
- The card no longer obeys the 44 px control ladder. That ladder was a UI guideline, not geometry, and it was stretching a 10 mm header band to several times its real height
- Text is typeset at the size the layout engine chose — it shrinks to fit a 52 mm wide band instead of growing past it, and lines are placed individually so the block can never outgrow its box
- Every text and photo box has its own clipped, positioned container, so nothing can reach a neighbour

### 1.1.0 — 2026-11-20 — Twelve cards per sheet, and a README written for people who print things
- Default sheet now holds twelve 52 x 67 mm cards — three across, four down — instead of nine larger ones
- Each card starts at 10 / 42 / 15 mm, derived from the cell height rather than fixed, so a different card size still gets a sensible split
- Reset in the band panel now returns to that per-card default instead of a hardcoded 13 / 20 tuned for the old 90 mm card
- The export panel no longer claims pages are embedded as vectors — it says what actually happens: vector text, photos at their extracted resolution
- README rewritten for the people using the app; build commands, architecture and release process moved to CONTRIBUTING.md

### 1.0.3 — 2026-11-20 — A deploy must reach a running client — now an engineering rule
- §7 now requires all three parts of a working update path: a self-updating service worker, a controllerchange listener, and a visible reload affordance
- The rule names the trap directly: a page keeps running the JavaScript it loaded at first paint, so an installed worker alone leaves the user on the old build
- Auto-reload is allowed only where the app provably holds no unsaved state; otherwise the update is announced and the user chooses
- The three conditions worth testing — not on first install, not during startup, once per worker — are written down with the code
- §4.4 now notes that an installed PWA has no address bar, so the update notice is the only route to a new build

### 1.0.2 — 2026-11-20 — New versions now tell you they are ready
- A deployed update used to take effect only after a manual refresh, because the page kept running the JavaScript it had already loaded
- A “New version ready” notice now appears within a second or two of a new build taking over, with a Reload button
- Reloading stays your choice: an automatic refresh would discard unsaved cards, which matters for a tab left open
- The notice is not shown on a first install, and not while the page is still starting up

### 1.0.1 — 2026-11-20 — Fixed: cards arrived empty, and the band sliders were hidden
- Fixed: a page was placed on the sheet but its card was seeded empty, so no photo and no text appeared — the lookup matched a document’s internal id against the file name the sheet uses
- The top and bottom sliders now sit in a docked panel under the sheet, where nothing can clip or cover them
- Selecting a card is enough to tune it; the sliders no longer have to be hunted for on the card itself
- The panel draws the three-zone split and names the picture height, so the effect of a drag is visible as a number

### 1.0.0 — 2026-11-20 — Rebuilt around a three-zone card
- Every cell is one card with three zones — top text, photo, bottom text — and each zone is edited in place
- The Text tab and the sheet-wide Card Bands sliders are gone; a card carries its own top and bottom heights, tuned by selecting it
- Upload now reads a page once and returns the dish photo, the name above it and the steps below it together
- The header/instructions split follows where the photo actually sits on the page, so dish notes above a low photo stay with the name instead of becoming steps
- Scanned pages with no text layer are read with OCR, so their cards are not blank; OCR loads only when needed and is never fetched for a normal PDF
- Bold, ink colour and highlighter are per box, applied from a bar that appears under the card being edited
- The exported PDF prints exactly the card: same bold, same colours, same highlights, same band heights, same photo framing
- Fixed: photo placement is read from the PDF’s own transform matrices, which were being composed in the wrong order

### 0.9.0 — 2026-11-19 — Dish photos keep their shape, and can be moved and zoomed
- Photos are no longer stretched: a dish keeps its own proportions however wide or tall the card is
- Each photo sits in a defined picture box with a small inset, centred, leaving clear room for the text above and below
- Anything zoomed past the box is clipped to it, so a picture can never sit on the text or cross a cut line
- Double-click a photo to move and zoom it: drag to pan, scroll or pinch to zoom, or use the corner slider
- Framing is kept per cell, so a dish stays where it was put — in the preview and in the printed sheet
- Escape or Enter leaves the mode, and a reset button puts the photo back where it started

### 0.8.0 — 2026-11-19 — Step 1: every cell gets its dish photo
- Each uploaded PDF places its own dish photo into its own cell
- The embedded image is used when there is one, at full resolution and its own shape
- When there is no embedded image — or the only one is the whole page — the page is rendered offscreen and the dish cropped out of the middle
- A flattened card is recognised by its page-shaped image and cropped rather than shown whole
- Fixed: the crop looked up the page in a cache the preview never filled, so it always came back empty
- Oversized photos are scaled down, so a large scan cannot bloat the document

### 0.7.2 — 2026-11-19 — Three boxes on the card: type, photo, type
- The exported card now holds the cropped dish photo only — the source page is never embedded, so its printed title and border box cannot come along
- Fixed: image data arrives from the PDF worker after the page is read, so extraction was quietly failing and cards fell back to a page render
- Page renders are gone from the card picture band entirely; a page with no photo says so instead of showing a screenshot
- Header and footer stay live, editable text on the sheet and in the exported PDF
- Layout, cell size and grid are unchanged

### 0.7.1 — 2026-11-19 — The dish photo is the photo, on every page
- Fixed: the cell picture lookup could never find the extracted photo, so every card showed a full-page render instead
- Fixed: photos and copy were read from page 1 only, so later pages of a multi-card PDF showed the first dish
- Each card now takes its words and its photo from its own page, and never borrows another page’s dish
- A page with no readable photo or copy leaves that band empty rather than showing another dish
- Layout, cell size and grid are unchanged

### 0.7.0 — 2026-11-19 — The card fills itself, and the photo is the photo
- A card arrives already written: the dish code, the dish name, and the plating steps are read off the page on upload
- Steps come out as clean bullets, not a copy of the box they were printed in
- The picture band shows the dish photo itself, pulled out of the PDF — not a re-render of the whole page
- Click the words on any card to type into them; Escape or Enter puts them back
- Colour and highlight for each card’s header and footer, on screen and in the exported PDF
- Three across and three down: nine 64 × 90 mm cards on A4, 83% of the paper used
- A page with no readable text leaves its card empty rather than inventing copy
- Fixed: photo bytes handed back as a Uint8ClampedArray were rejected, so no photo ever appeared

### 0.6.1 — 2026-11-19 — The picture box holds picture, and the type is the right size
- The picture band now shows the artwork only — the source page’s own printed text is cropped away
- Text at both ends of a page: the artwork between them is kept, instead of the whole page
- Header and footer are set at their real size and wrap where the printed card breaks
- Fixed: card text was measured in points against a width in millimetres, so every word wrapped

### 0.6.0 — 2026-11-19 — A card with three bands, and one box to type in
- Cards are header, picture, footer — the three bands always fill the card
- Paste your copy once per page in the new Text tab; first line is the header, the rest is the footer
- The picture fills its band completely and is clipped, so no white gaps
- Move and zoom the picture inside its box; a framed picture can never reach the text
- Header and footer heights are yours to set, in millimetres

### 0.5.0 — 2026-11-19 — Edit the sheet directly
- Text on every cell is now editable in place — click a block and type
- Move and zoom the page inside its cell; the text moves with it
- Edits are per cell, so a page repeated twice can differ in each copy
- The extra read-only preview pane is gone: the sheet is the workspace
- Edited text is re-typeset in the exported PDF, still as vector, never a picture

### 0.4.1 — 2026-11-19 — See your pages in the cells
- Every grid cell now shows the real page artwork, not just a filename
- Artwork sits exactly where it will print, so the preview matches the export
- Pages render once and are cached — switching sheets is instant
- Pages that cannot render fall back to the filename instead of breaking
- Returning to a sheet you already viewed shows its artwork straight away
- Re-uploading a file with the same name shows the new pages, never the old ones

### 0.4.0 — 2026-11-19 — Print-ready sheet export
- Export writes a real multi-page PDF — one output page per sheet
- Source pages are embedded as vectors: text stays selectable, no rasterising
- Cells are contain-fitted, so nothing is ever cropped
- Cut guides are drawn on the gutter centrelines
- Unreadable sources are skipped and reported, never faked

### 0.3.1 — 2026-11-19 — Fits the window
- The app is exactly one viewport tall — no page scrolling
- The sheet preview auto-scales to the space available, with a live zoom readout
- Each pane owns its own scroll region

### 0.3.0 — 2026-11-19 — Multi-up sheet imposition
- A4 sheet fits 12 cells at 52 x 67 mm with a 4 mm gutter for scissors
- Cell size, gutter, margin, and sheet size are all adjustable, with a live cell count
- Every page of every PDF becomes its own placeable object
- Pages are contain-fitted into cells, so nothing is ever cropped
- Cell numbers and cut guides show exactly where the sheet will be cut

### 0.2.0 — 2026-11-19 — Add PDFs actually imports
- Add PDFs and Add more PDFs open a real file picker; drag and drop works too
- Text blocks are extracted and grouped per page, with a first-page thumbnail
- PDF reading runs in a lazily-loaded worker, so the app shell still loads fast
- Unreadable, empty, and password-protected files fail with a clear reason
- Renamed to CrewBTC

### 0.1.0 — 2026-11-19 — Desktop workspace shell
- Three-pane workspace: batch queue, print canvas, inspector
- Configurable trim, bleed, and crop-mark margins
- Reduced-motion toggle that persists locally
- Installable PWA with offline caching

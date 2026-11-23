# CrewBTC

Turn a folder of recipe PDFs into print-ready cards.

Drop in one PDF or fifty. CrewBTC reads each page, rebuilds it as an editable card —
photo, title, instructions — and lays twelve of them out on an A4 sheet with cut
guides, ready to print and chop up.

Everything happens inside your browser. No account, no upload, no server. Your PDFs
never leave your computer.

---

## What it does

**Reads the PDF for you.** Each page becomes one card. CrewBTC extracts an embedded
photo when possible, otherwise crops the page render; it takes the title above the image
and plating steps below it. Review the results, especially for different source layouts.

**Scanned pages still work.** A page with no text layer is read with OCR instead of
being left blank. It needs a connection the first time, and it reads English only.

**You edit the card, not the PDF.** Three zones: text on top, photo in the middle,
text underneath.

- Both text boxes are real text fields. Type in them, add or remove lines, and select
  text to format it. **CROCKERIES** and **CONDIMENTS** apply their callout styles;
  **DIRECTIONS** makes text red. **Bold** and **Clear formatting** are also available.
  Controls apply to the selection, or to the whole box when nothing is selected.
- In the inspector, enter keywords or phrases (one per line) for each callout and choose
  **Automate formatting** after cards are populated. It affects bottom text only; matches
  ignore case and respect whole word boundaries. It adds bullets to non-empty bottom-text lines, not visual wraps, and
  converts leading dash-space markers to bullets, and leaves existing bullets and numbered
  lines alone. **Remove formatting** clears callout colours in both zones without removing bullets or
  restoring original casing; matching manually applied colours are also cleared. Review the
  results; CROCKERIES changes matched text to uppercase. Undo is available for cards not
  subsequently edited.
- The photo is never stretched. Click it to enter adjustment mode, then drag to move it
  or scroll to zoom. Click outside or press `Escape` when finished. The image is clipped
  to its box. The scissors remove a plain background locally, with sensitivity and undo;
  the sparkles copy this card's band heights to the other cards.
- Drag a selected card's dividers to resize its text boxes. The inspector shows its actual
  **Top**, **Bottom** and **Text** values; the sheet's **Text size** control changes type
  for all cards. Both text zones start bold and black; the top is centred, the bottom is
  top-aligned.
- Each card has a number and an editable right-hand corner label. Numbers wrap after 40;
  editing a label applies it from that card onward until another label overrides it.

**Prints properly.** Export gives you a real PDF at print resolution. Text is drawn as
vector text, so it stays crisp at any size. Cards use the same geometry, styles and
photo framing as the preview, with optional cut guides. Check the exported PDF for
clipped text or corner labels before printing.

## The screen

Three columns and a bar across the top:

- **Files** on the left, 220px: your PDFs, one row each, and the single **Add PDFs**
  button.
- **The sheet** in the middle, as big as the window allows.
- **The inspector** on the right, 260px. It shows the document's own settings — sheet
  size, cell size, spacing, margin, rotation, cut guides — and when you select a card it
  puts that card's **Top**, **Bottom** and **Text** numbers above them.
- **The gear** opens settings over the sheet rather than on a page of its own: units,
  reduced motion, and the changelog folded into one row that names the version you are on.

Measurements read in millimetres, centimetres or inches, and the choice is applied to
every field at once — the inspector, the sheet size, the card boxes. Changing it converts
the display and nothing else: the document is stored and printed in millimetres either
way, so 21 cm and 210 mm are the same sheet.

## Save and open editable projects

Use **Save** in the top bar to download a `.crewbtc` project. It contains all station workspaces, editable cards, photos, labels, sheet settings,
formatting keywords and available original PDFs. **Open** loads that
file in CrewBTC, including on another computer; it replaces the current workspace after
confirmation. Export PDF remains the separate print-only action. Save a project again
when you make changes: the downloaded file does not update automatically.

Right-click a PDF in the Files rail and choose **Download original**, or use its options button. This downloads the original upload, not the edited cards.

Original uploads are also kept in browser storage for later project saves and re-runs,
subject to browser storage limits. Older sessions and storage failures may be missing
original PDFs; a warning tells you if a saved project is incomplete. The cards and photos
remain editable and printable, but re-running extraction needs the original PDFs. Removed
originals are reclaimed after the Undo window when local storage is available; older
retained copies may require clearing browser site data.
Project files and locally stored originals can contain your source documents: keep them
private and clear browser site data if you need to remove the local copies.

## Station workspaces and printing

Use **+ New station** to create a named tab, and switch tabs to edit each station's PDFs and cards. Sheet and inspector settings are shared. New cards start with the station name in the corner label; you can still edit labels and their existing forward propagation applies. Renaming a tab does not change labels already on cards.

If a PDF has pages for different stations, add it to each relevant station, select the PDF in the Files rail, and choose **Choose pages for this station**. Enter `all`, `none`, or page numbers and ranges such as `1,3-5`. Excluded card edits remain stored if you include those pages again.

Choose **Export → Custom selection** to select whole stations and/or individual cards. Use Shift-click for a range, or drag a card’s handle to select or deselect several. The generated-PDF preview packs the selected cards together across stations to minimise wasted cells. Exporting this selection does not move or change the original cards. The usual Export button still exports the active station's current sheet or all its sheets.

**New project** clears all stations after confirmation, leaving shared inspector settings and saved defaults in place. Save first if you need the current work. Existing single-workspace projects and sessions open as one station. New project files deduplicate identical images and original PDFs without changing their quality. They cannot be opened by older versions of CrewBTC.

## Zooming the sheet

`−`, the current percentage, `+` and **Fit** sit in the middle of the top bar. The sheet
opens **fitted to the width of the window**, not to the whole page: filling the width is
what makes a card's type readable without zooming, and the sheet simply scrolls down past
the bottom of the screen. The percentage shows the real scale, and is labelled as fitted
while the sheet is still following the window.

Scroll with the wheel or the scrollbar to read down the page, zoom with `−`, `+` or
`Ctrl`/`Cmd` + wheel, and **Fit** puts the sheet back to the window's width. Fit is a
momentary action — it never stays lit, because width-fit is already where the app rests.

## Sheets

Twelve cards fit one A4 sheet, so a document longer than twelve pages has more than one.
When that happens a strip of sheet miniatures appears along the bottom of the canvas:
click one to move the canvas to that sheet, or collapse it to a `Sheets (2)` pill to get
the height back. Clicking a file in the **Files** rail jumps to the sheet its first card
is on. The active sheet is the one with the accent border.

## Getting started

1. Open CrewBTC in a desktop browser.
2. Drag PDFs onto the window, or use **Add PDFs**.
3. Pick a card, then edit its text, colour and photo.
4. Drag the selected card’s dividers; check the heights in the inspector.
5. Open **Preview PDF** beside Export to inspect the generated PDF as you edit. Navigate sheets, zoom, fit or expand the preview; it updates shortly after changes. On narrower windows it overlays part of the editor.
6. Use **Review** to find possible print issues and missing card content, and jump to each affected card. Warnings are advisory: missing content can be intentional, and the check does not replace inspecting the PDF.
7. To reuse band heights, select a card and choose **Use selected card** under New card defaults. The saved heights apply only to newly seeded cards; text size remains sheet-wide.
8. **Save** an editable project if needed. **Export** prints the active station; **Export → Custom selection** combines chosen cards from any station.

Your sheet settings are remembered between visits.

### Desktop only

CrewBTC is built for a desktop browser. Narrower than 1024 pixels you get a notice asking
for a wider window — but nothing is thrown away while it is up: your files, cards and
edits are all still there when you widen it again.
Below that it tells you so rather than squeezing the layout into something unusable.
A phone-sized version isn't planned.

## The sheet

By default you get **A4 at 210 × 297 mm**, holding **twelve cards of 52 × 67 mm** —
three across, four down — with a 4 mm gap between cards and a 4 mm margin at the edge.
That puts 67% of the paper to work, and the 4 mm channels are wide enough to get
scissors or a guillotine between cards without shaving the edge off a card.

Change any of it: A3, A5, US Letter or square paper, a different card size, a wider
gutter or margin, or turn the grid 90° on the sheet. CrewBTC tells you when a setting
won't fit rather than printing a broken sheet.

### Cards are 52 × 67 mm by default

Each newly extracted card starts with an **8.56 mm top band** and a **35.45 mm bottom
band**, where the cell has room. Smaller cells clamp the split to preserve photo space.
Existing cards keep their own measurements. Drag the dividers to adjust individual bands;
the inspector displays their current heights. Text size starts at **90%** and is set for
the whole sheet. Text wraps rather than automatically shrinking; content that exceeds a
band is clipped, so check it before printing.

## What it won't do

Being straight about the limits is more useful than discovering them at the printer.

- **Not PDF/X.** No output intent, and colour images stay RGB. Fine for digital and
  short-run printing; a shop that demands PDF/X will bounce the file.
- **Not a scanner.** A page with no text layer goes through OCR, which reads English
  and needs a connection the first time. It's a safety net, not a document scanner.
- **One PDF out, not a zip.** "Export all sheets" gives you one file. Separate files,
  one per page, are still to come.
- **Portable typefaces only.** Print output uses the standard PDF fonts, so nothing
  needs embedding. Uploading a brand font isn't built yet.
- **Corner labels have print limits.** Long labels are truncated to the box and characters
  unsupported by the standard PDF font are replaced. Check the exported PDF.
- **Mixed page sizes.** Each document uses the first page’s dimensions for its page references.
- **It assumes the PDFs look alike.** The app reads a title above the picture and steps
  below it. Wildly inconsistent layouts will need fixing by hand — which is what the
  editable cards are for.

## Privacy

There is no backend. CrewBTC has no server to send anything to.

- Your PDFs are opened in the tab and never uploaded.
- Cards, photos and available original PDFs are stored locally in your browser; sheet
  settings use local storage. Downloaded project files also contain this content.
- A service worker caches the app so it can reopen offline after it has been loaded.

Loading or updating the app uses the network. The first OCR use also fetches the
recognition engine and English language data. If that fails, the card still opens with empty text
boxes for you to fill in — you don't lose the upload.

## Updates

When a new version is deployed, an open tab tells you a new version is ready and offers
a **Reload** button. It won't refresh on its own, because that would throw away cards
you hadn't exported yet. Reload when it suits you.

If you miss the notice, a normal refresh may pick up the latest version; a service-worker
update can take an additional reload to take control.

## Requirements

- A desktop browser — recent Chrome, Edge, Firefox or Safari.
- That's it. No install, no account, no plugin.

---

## For developers

Build commands, architecture, the engineering rules and the release process live in
[CONTRIBUTING.md](./CONTRIBUTING.md). The project is built against
[ENGINEERING_RULES.md](./ENGINEERING_RULES.md). Current state, known limitations and
release history are recorded in [CHANGELOG.md](./CHANGELOG.md).

## Licence

Private project. All rights reserved.

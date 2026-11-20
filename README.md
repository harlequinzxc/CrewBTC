# CrewBTC

Turn a folder of recipe PDFs into print-ready cards.

Drop in one PDF or fifty. CrewBTC reads each page, rebuilds it as an editable card —
photo, title, instructions — and lays twelve of them out on an A4 sheet with cut
guides, ready to print and chop up.

Everything happens inside your browser. No account, no upload, no server. Your PDFs
never leave your computer.

---

## What it does

**Reads the PDF for you.** Each page becomes one card. CrewBTC pulls the dish photo
out of the PDF's own embedded image, takes the title from the text above the photo,
and the plating steps from the text below — one step per line.

**Scanned pages still work.** A page with no text layer is read with OCR instead of
being left blank. It needs a connection the first time, and it reads English only.

**You edit the card, not the PDF.** Three zones: text on top, photo in the middle,
text underneath.

- Both text boxes are real text fields. Type in them, add or remove lines, and select
  text to format it. **Bold**, ink colour and a red / green / amber highlight apply to
  whatever you have selected; with nothing selected they set the whole box.
- The photo is never stretched. Double-click the frame to adjust it: drag to move,
  scroll to zoom. Anything that spills past the box is clipped, so a tall photo can't
  push the text out of the way. Double-click again, click outside or press `Escape`
  when you are happy — the framing is kept.
- Each card tunes its own proportions. Drag the boundary lines on a selected card to
  resize its text boxes, or select the card and type exact numbers into **Top**,
  **Bottom** and **Text** in the inspector. **Text** makes the type bigger or smaller
  without shortening the photo.

**Prints properly.** Export gives you a real PDF at print resolution. Text is drawn as
vector text, so it stays crisp at any size, and the sheet comes out exactly as it
looked on screen — same words, same colours, same photo position — with the cut guides
you turned on drawn into the file.

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
4. Adjust the top and bottom heights in the inspector.
5. **Export** when you're happy — the arrow beside it offers every sheet as one PDF.

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

Each card splits into a top box, a photo, and a bottom box — and the split follows the
text. A one-line dish name with two bullets gives the photo about **78%** of the card,
because a box that is taller than its words is paper spent on nothing. A four-bullet
method buys its lines the room instead, and the type never shrinks to make a box look
tidy.

That split is a starting point, not a rule: every card has its own, adjustable with two
fields. Nothing can be tuned into an overlap — there's a minimum for each text box and a
minimum for the photo, so a card can never become two text boxes with no picture. Text
sits in the middle of its box rather than at the top, so raising a box spreads the air
on both sides of the words instead of opening one gap beneath them.

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
- **It assumes the PDFs look alike.** The app reads a title above the picture and steps
  below it. Wildly inconsistent layouts will need fixing by hand — which is what the
  editable cards are for.

## Privacy

There is no backend. CrewBTC has no server to send anything to.

- Your PDFs are opened in the tab and never uploaded.
- Sheet settings live in your browser's local storage.
- A service worker caches the app so it opens without a network connection.

The only time CrewBTC reaches the internet is the first time it needs OCR, when it
fetches the recognition engine. If that fails, the card still opens with empty text
boxes for you to fill in — you don't lose the upload.

## Updates

When a new version is deployed, an open tab tells you a new version is ready and offers
a **Reload** button. It won't refresh on its own, because that would throw away cards
you hadn't exported yet. Reload when it suits you.

If you miss the notice entirely, a normal refresh picks up the latest version.

## Requirements

- A desktop browser — recent Chrome, Edge, Firefox or Safari.
- That's it. No install, no account, no plugin.

---

## For developers

Build commands, architecture, the engineering rules and the release process live in
[CONTRIBUTING.md](./CONTRIBUTING.md). The project is built against
[ENGINEERING_RULES.md](./ENGINEERING_RULES.md).

## Licence

Private project. All rights reserved.

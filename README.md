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

- Both text boxes are real text fields. Type in them, mark them bold, change the ink
  colour, or run a highlighter behind the words.
- The photo is never stretched. It fits inside its box, and double-clicking lets you
  pan and zoom within it. Anything that spills past the box is clipped, so a tall
  photo can't push the text out of the way.
- Each card tunes its own proportions. The top and bottom heights are yours to set
  per card, so a dish with long instructions and a dish with a short name can both
  be laid out the way they need.

**Prints properly.** Export gives you a real PDF at print resolution. Text is drawn as
vector text, so it stays crisp at any size, and the sheet comes out exactly as it
looked on screen — same words, same colours, same photo position — with crop marks
for cutting.

## Getting started

1. Open CrewBTC in a desktop browser.
2. Drag PDFs onto the window, or use **Add PDFs**.
3. Pick a card, then edit its text, colour and photo.
4. Adjust the top and bottom heights in the band panel under the sheet.
5. **Export** when you're happy.

Your sheet settings are remembered between visits.

### Desktop only

CrewBTC is built for a desktop browser and asks for at least 1024 pixels of width.
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

Each card splits into a **10 mm** top box, a **42 mm** photo, and a **15 mm** bottom
box. That split is a starting point, not a rule — every card has its own, adjustable
with two sliders. Nothing can be tuned into an overlap: there's a minimum for each text
box and a minimum for the photo, so a card can never become two text boxes with no
picture.

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

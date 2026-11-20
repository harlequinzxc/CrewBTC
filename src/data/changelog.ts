export interface ReleaseNote {
  readonly version: string
  readonly date: string
  readonly title: string
  readonly highlights: readonly string[]
}

/** Single source of truth for release notes, kept in sync with package.json (§9). */
export const CHANGELOG: readonly ReleaseNote[] = [
  {
    version: '1.0.2',
    date: '2026-11-19',
    title: 'New versions now tell you they are ready',
    highlights: [
      'A deployed update used to take effect only after a manual refresh, because the page kept running the JavaScript it had already loaded',
      'A “New version ready” notice now appears within a second or two of a new build taking over, with a Reload button',
      'Reloading stays your choice: an automatic refresh would discard unsaved cards, which matters for a tab left open',
      'The notice is not shown on a first install, and not while the page is still starting up',
    ],
  },
  {
    version: '1.0.1',
    date: '2026-11-19',
    title: 'Fixed: cards arrived empty, and the band sliders were hidden',
    highlights: [
      'Fixed: a page was placed on the sheet but its card was seeded empty, so no photo and no text appeared — the lookup matched a document’s internal id against the file name the sheet uses',
      'The top and bottom sliders now sit in a docked panel under the sheet, where nothing can clip or cover them',
      'Selecting a card is enough to tune it; the sliders no longer have to be hunted for on the card itself',
      'The panel draws the three-zone split and names the picture height, so the effect of a drag is visible as a number',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-11-19',
    title: 'Rebuilt around a three-zone card',
    highlights: [
      'Every cell is one card with three zones — top text, photo, bottom text — and each zone is edited in place',
      'The Text tab and the sheet-wide Card Bands sliders are gone; a card carries its own top and bottom heights, tuned by selecting it',
      'Upload now reads a page once and returns the dish photo, the name above it and the steps below it together',
      'The header/instructions split follows where the photo actually sits on the page, so dish notes above a low photo stay with the name instead of becoming steps',
      'Scanned pages with no text layer are read with OCR, so their cards are not blank; OCR loads only when needed and is never fetched for a normal PDF',
      'Bold, ink colour and highlighter are per box, applied from a bar that appears under the card being edited',
      'The exported PDF prints exactly the card: same bold, same colours, same highlights, same band heights, same photo framing',
      'Fixed: photo placement is read from the PDF’s own transform matrices, which were being composed in the wrong order',
    ],
  },
  {
    version: '0.9.0',
    date: '2026-11-19',
    title: 'Dish photos keep their shape, and can be moved and zoomed',
    highlights: [
      'Photos are no longer stretched: a dish keeps its own proportions however wide or tall the card is',
      'Each photo sits in a defined picture box with a small inset, centred, leaving clear room for the text above and below',
      'Anything zoomed past the box is clipped to it, so a picture can never sit on the text or cross a cut line',
      'Double-click a photo to move and zoom it: drag to pan, scroll or pinch to zoom, or use the corner slider',
      'Framing is kept per cell, so a dish stays where it was put — in the preview and in the printed sheet',
      'Escape or Enter leaves the mode, and a reset button puts the photo back where it started',
    ],
  },
  {
    version: '0.8.0',
    date: '2026-11-19',
    title: 'Step 1: every cell gets its dish photo',
    highlights: [
      'Each uploaded PDF places its own dish photo into its own cell',
      'The embedded image is used when there is one, at full resolution and its own shape',
      'When there is no embedded image — or the only one is the whole page — the page is rendered offscreen and the dish cropped out of the middle',
      'A flattened card is recognised by its page-shaped image and cropped rather than shown whole',
      'Fixed: the crop looked up the page in a cache the preview never filled, so it always came back empty',
      'Oversized photos are scaled down, so a large scan cannot bloat the document',
    ],
  },
  {
    version: '0.7.2',
    date: '2026-11-19',
    title: 'Three boxes on the card: type, photo, type',
    highlights: [
      'The exported card now holds the cropped dish photo only — the source page is never embedded, so its printed title and border box cannot come along',
      'Fixed: image data arrives from the PDF worker after the page is read, so extraction was quietly failing and cards fell back to a page render',
      'Page renders are gone from the card picture band entirely; a page with no photo says so instead of showing a screenshot',
      'Header and footer stay live, editable text on the sheet and in the exported PDF',
      'Layout, cell size and grid are unchanged',
    ],
  },
  {
    version: '0.7.1',
    date: '2026-11-19',
    title: 'The dish photo is the photo, on every page',
    highlights: [
      'Fixed: the cell picture lookup could never find the extracted photo, so every card showed a full-page render instead',
      'Fixed: photos and copy were read from page 1 only, so later pages of a multi-card PDF showed the first dish',
      'Each card now takes its words and its photo from its own page, and never borrows another page’s dish',
      'A page with no readable photo or copy leaves that band empty rather than showing another dish',
      'Layout, cell size and grid are unchanged',
    ],
  },
  {
    version: '0.7.0',
    date: '2026-11-19',
    title: 'The card fills itself, and the photo is the photo',
    highlights: [
      'A card arrives already written: the dish code, the dish name, and the plating steps are read off the page on upload',
      'Steps come out as clean bullets, not a copy of the box they were printed in',
      'The picture band shows the dish photo itself, pulled out of the PDF — not a re-render of the whole page',
      'Click the words on any card to type into them; Escape or Enter puts them back',
      'Colour and highlight for each card’s header and footer, on screen and in the exported PDF',
      'Three across and three down: nine 64 × 90 mm cards on A4, 83% of the paper used',
      'A page with no readable text leaves its card empty rather than inventing copy',
      'Fixed: photo bytes handed back as a Uint8ClampedArray were rejected, so no photo ever appeared',
    ],
  },
  {
    version: '0.6.1',
    date: '2026-11-19',
    title: 'The picture box holds picture, and the type is the right size',
    highlights: [
      'The picture band now shows the artwork only — the source page’s own printed text is cropped away',
      'Text at both ends of a page: the artwork between them is kept, instead of the whole page',
      'Header and footer are set at their real size and wrap where the printed card breaks',
      'Fixed: card text was measured in points against a width in millimetres, so every word wrapped',
    ],
  },
  {
    version: '0.6.0',
    date: '2026-11-19',
    title: 'A card with three bands, and one box to type in',
    highlights: [
      'Cards are header, picture, footer — the three bands always fill the card',
      'Paste your copy once per page in the new Text tab; first line is the header, the rest is the footer',
      'The picture fills its band completely and is clipped, so no white gaps',
      'Move and zoom the picture inside its box; a framed picture can never reach the text',
      'Header and footer heights are yours to set, in millimetres',
    ],
  },
  {
    version: '0.5.0',
    date: '2026-11-19',
    title: 'Edit the sheet directly',
    highlights: [
      'Text on every cell is now editable in place — click a block and type',
      'Move and zoom the page inside its cell; the text moves with it',
      'Edits are per cell, so a page repeated twice can differ in each copy',
      'The extra read-only preview pane is gone: the sheet is the workspace',
      'Edited text is re-typeset in the exported PDF, still as vector, never a picture',
    ],
  },
  {
    version: '0.4.1',
    date: '2026-11-19',
    title: 'See your pages in the cells',
    highlights: [
      'Every grid cell now shows the real page artwork, not just a filename',
      'Artwork sits exactly where it will print, so the preview matches the export',
      'Pages render once and are cached — switching sheets is instant',
      'Pages that cannot render fall back to the filename instead of breaking',
      'Returning to a sheet you already viewed shows its artwork straight away',
      'Re-uploading a file with the same name shows the new pages, never the old ones',
    ],
  },
  {
    version: '0.4.0',
    date: '2026-11-19',
    title: 'Print-ready sheet export',
    highlights: [
      'Export writes a real multi-page PDF — one output page per sheet',
      'Source pages are embedded as vectors: text stays selectable, no rasterising',
      'Cells are contain-fitted, so nothing is ever cropped',
      'Cut guides are drawn on the gutter centrelines',
      'Unreadable sources are skipped and reported, never faked',
    ],
  },
  {
    version: '0.3.1',
    date: '2026-11-19',
    title: 'Fits the window',
    highlights: [
      'The app is exactly one viewport tall — no page scrolling',
      'The sheet preview auto-scales to the space available, with a live zoom readout',
      'Each pane owns its own scroll region',
    ],
  },
  {
    version: '0.3.0',
    date: '2026-11-19',
    title: 'Multi-up sheet imposition',
    highlights: [
      'A4 sheet fits 12 cells at 52 x 67 mm with a 4 mm gutter for scissors',
      'Cell size, gutter, margin, and sheet size are all adjustable, with a live cell count',
      'Every page of every PDF becomes its own placeable object',
      'Pages are contain-fitted into cells, so nothing is ever cropped',
      'Cell numbers and cut guides show exactly where the sheet will be cut',
    ],
  },
  {
    version: '0.2.0',
    date: '2026-11-19',
    title: 'Add PDFs actually imports',
    highlights: [
      'Add PDFs and Add more PDFs open a real file picker; drag and drop works too',
      'Text blocks are extracted and grouped per page, with a first-page thumbnail',
      'PDF reading runs in a lazily-loaded worker, so the app shell still loads fast',
      'Unreadable, empty, and password-protected files fail with a clear reason',
      'Renamed to CrewBTC',
    ],
  },
  {
    version: '0.1.0',
    date: '2026-11-19',
    title: 'Desktop workspace shell',
    highlights: [
      'Three-pane workspace: batch queue, print canvas, inspector',
      'Configurable trim, bleed, and crop-mark margins',
      'Reduced-motion toggle that persists locally',
      'Installable PWA with offline caching',
    ],
  },
]

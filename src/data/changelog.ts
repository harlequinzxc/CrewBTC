export interface ReleaseNote {
  readonly version: string
  readonly date: string
  readonly title: string
  readonly highlights: readonly string[]
}

/** Single source of truth for release notes, kept in sync with package.json (§9). */
export const CHANGELOG: readonly ReleaseNote[] = [
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

export interface ReleaseNote {
  readonly version: string
  readonly date: string
  readonly title: string
  readonly highlights: readonly string[]
}

/** Single source of truth for release notes, kept in sync with package.json (§9). */
export const CHANGELOG: readonly ReleaseNote[] = [
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

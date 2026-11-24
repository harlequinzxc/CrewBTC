# Engineering-rule audit — 2026-11-24 (Singapore)

Scope: repository inspection, the automated release gate and targeted Chromium motion tests.
This is not a certification of WCAG, performance, installed-mode behavior, or all engineering
rules. `[REVIEW]` and `[CRAFT]` items need the manual checks called for in the rules.

## Follow-up — v1.24.4

A frame-by-frame Chromium reproduction found the side rails changed immediately but the
width-fitted sheet resized one frame later through ResizeObserver. The fit measurement now
runs before paint when either side rail changes. Targeted tests check both directions of
both rails and the sheet width over successive frames for system and saved reduced-motion
preferences. This does not certify other surfaces or the unrun manual review below.

## Follow-up — v1.24.3

The reduced-motion rule now explicitly requires immediate state changes, with no fades,
transitions, animations, animated scrolling or delayed visual exit. Earlier references to
80 ms fades below are historical, not the current requirement. CSS disables motion for
the root, descendants, pseudo-elements and dialog backdrops; static layout transforms are
preserved. Dialog and toast exits do not wait in reduced motion, and enabling the setting
cancels in-progress scrolling. Targeted browser tests cover tabs, menu, modal, accordion,
the system preference and restoring motion; unit tests cover immediate toast dismissal.
A full manual app-wide and real-device walkthrough remains unrun, and the motion-off
all-state gaps and other audit findings remain outstanding.

## Follow-up — v1.24.2

This follow-up supersedes the relevant v1.24.1 findings below, which are retained as
historical audit evidence. **All-state motion compliance is not yet confirmed.**

- Export menu, print-selection dialog and Settings release notes now have enter/exit or
  expansion motion. Closed surfaces are inert and hidden from assistive technology;
  modal interaction is released immediately on close. Targeted Chromium tests exercise
  menu/dialog close, selection reset and release-note expansion.
- Muted text is now #89909c: measured contrast is 5.73:1 on panel, 5.30:1 on raised and
  4.77:1 on hover surfaces. Export and error-boundary white-on-red hover use #b91c1c
  (6.47:1). The contrast gate now covers these combinations, not every app combination.
- Several export, project, batch and photo-cutout controls expose aria-busy; the full
  async inventory and announcements are not verified.
- PDF preview, panel/strip collapse, station active indicator and other state/list
  changes still need motion work and review. The color-transition property concern,
  ongoing loading pulse, theme and design-system gaps remain. A full interaction and
  reduced-motion walkthrough, manual accessibility and device/performance checks below
  have not been completed. Automated tests cannot establish universal compliance.
- Full gate before release metadata: 523 unit and 97 Chromium tests passed. Two additional
  targeted Chromium motion tests also passed; final release gate results follow below.

## Motion (§3)

- **Addressed:** the saved reduced-motion choice takes precedence over the system default;
  initialization also falls back to the system when storage is blocked (`index.html`,
  `MotionProvider.tsx`). CSS no longer removes *all* static transforms. Programmatic sheet
  navigation now explicitly requests `auto`, not `smooth`, when reduced motion is enabled.
- **Addressed:** inspector accordions animate grid rows and opacity; closed controls are
  inert and hidden from accessibility, and retain their values. Settings has panel and
  backdrop enter/exit, cancellable exit timers and Escape handling. Toasts enter and leave;
  their actions run immediately and dismissal has an explicit timer. Reduced motion uses
  short opacity-only changes where applicable.
- **Still fails the all-state-motion review:** the print-selection dialog, Export menu,
  PDF preview, panel/strip collapse, station active indicator, and Settings' What's New
  expansion still mount, unmount or switch state without the requested enter/exit motion.
  `FileRow.tsx` also uses a continuous Tailwind pulse for parsing; the standard-transition
  ceiling and the requested treatment of ongoing loading indicators should be reviewed.
- **Property rule needs further work:** many existing `transition-colors` utilities animate
  color rather than the strictly allowed composited properties in §3. The layout scanner
  only catches selected Tailwind property names, not all CSS/keyframes or actual runtime
  animations; a passing scanner is not evidence of full compositor compliance.
- **Not run:** a manual full-app reduced-motion walk-through and visual inspection of every
  interaction, loading/list mutation, active state, and interruption/reopen path.

## Other concrete findings

- **Contrast — fail:** `#6e7480` muted text on `#131418` is approximately **3.92:1**;
  it is used for small text, such as the 10px sheet settings metrics and 11px empty-state
  copy, which need 4.5:1 for normal text. The contrast script currently treats muted
  metadata as large text. `ExportControl.tsx` uses white text on `#ff6369` while hovered,
  approximately **2.90:1**. The palette gate does not cover that combination.
- **Async state — fail by inspection:** the rules require `aria-busy` on active async
  submissions; no `aria-busy` usage was found in `src`. Some actions do disable while busy,
  but that does not substitute for the requested status semantics.
- **Design-system reuse — fail by inspection:** many recurring button/field styles are
  implemented directly in feature components instead of the centralized primitives required
  by §2. This audit did not refactor them, because doing so changes a wide shared surface.
- **Theme — fail by inspection:** the application initializes dark mode; an adaptive or
  toggleable light theme required by §3 was not found.
- **Explicit user exception:** the requested 14px structural panel rails are below §4.1's
  24px target floor. The user's direct sizing instruction takes precedence. CrewBTC's
  desktop-only notice below 1024px is also an explicit scope exception in the rules.
- **Automation limits:** `scripts/check-layout.mjs` uses regex heuristics and structural
  annotations; it cannot prove hit-target sizes, focus behavior, motion properties, or all
  contrast combinations. Lint, types, tests and the gates are regression checks, not a full
  design/accessibility audit.

## Appendix A.2 review status

- **Focus trap and restoration:** partial pass for Settings close/Escape in Chromium;
  complete keyboard Tab-cycle and every other modal: **not run**.
- **Live regions:** toast `role=status`/`role=alert` and `aria-live` inspected; full async
  results and screen-reader announcements: **not run**.
- **Keyboard parity:** targeted formatting and undo tests exist; a complete primary task
  without a pointer: **not run**.
- **Breakpoints:** browser regression suite covers 1024, 1280 and 1440; the complete
  768/390/320 at 200% ladder: **not run**, subject to the desktop-only exception.
- **Installed mode and safe-area insets:** **not run** on physical desktop/mobile devices.
- **Repeat-firing lifecycle:** Settings reopen and toast timer cleanup covered; every
  other surface and submission cycle: **not run**.
- **Error-boundary forced throw and all five interaction states:** **not run** in this audit.
- **Service-worker update on a deployed running client and SPA deep-link rewrite:**
  **not run** in this audit; automated tests/configuration alone are not deployment proof.
- **Forced colors:** **not run**. Performance metrics LCP/CLS/INP on throttled hardware:
  **not run**. Bundle-size gate is distinct from those measurements.

## Shared dependents reviewed

`Section` is used by CardDefaults, CardReadout, AutoFormatSection, SheetSection and
BatchReview. `Switch` is used by SettingsView and SheetSection. Toasts are provided through
ToastHub/useToasts and consumed by WorkspaceScreen, batch, project, export and automation
flows. MotionProvider wraps App; SettingsDialog is hosted by WorkspaceScreen. `scrollToTop`
is called by useSheetScroll. Root CSS and the early HTML script affect the whole app.
No dependencies or persisted data formats were added.

## Automated verification for v1.24.1

- `npm run gate` with the configured Chromium binary: **exit 0**; 523 unit tests and
  97 Chromium tests passed. The gate includes typecheck, both lint passes, production
  build, contrast/layout/manifest/placeholder/secrets/bundle checks and browser tests.
- The bundle check measured **143,230 B gzip initial JS** and **8,867 B gzip initial CSS**.
  These are bundle measurements, not LCP, CLS or INP measurements.
- Previous gate attempts exposed a broad `[inert]` test assumption and Settings exit
  blocking the workspace. The scoped test and immediate modal release were corrected;
  the complete gate above was rerun successfully.
- Regression tests were not separately run against every pre-fix version; that portion of
  §8B's mutation-proofing review is **not run**.

## Automated verification for v1.24.2

- `npm run gate` with the configured Chromium binary: **exit 0**, 523 unit tests and
  99 Chromium tests passed, including the new menu, print-dialog and release-notes tests.
- This verifies the automated regression gate only; it does not resolve or prove the
  outstanding manual and all-state motion findings described above.

## Automated verification for v1.24.3

- `npm run gate` with the configured Chromium binary: **exit 0**, 523 unit tests and
  100 Chromium tests passed. These are regression checks, not a full manual motion audit.

## Automated verification for v1.24.4

- `npm run gate` with the configured Chromium binary: **exit 0**, 523 unit tests and
  102 Chromium tests passed. The added browser checks cover both side rails with the
  system and saved reduced-motion preferences.

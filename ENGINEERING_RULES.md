# Universal AI Engineering, Design System & Git Rules

## Scope

This document governs **every file and every action in the project it is attached to**. It is self-contained: everything needed to comply is in this file — no external scripts, configs, or companion documents. Do not split it.

**Precedence against the human.** Explicit instructions from the user override this document. When the user asks for something a rule forbids, say which rule you are setting aside and why, do it, and note it in the completion report. Never use this document as a reason to refuse a direct instruction, and never silently ignore a rule either.

**Project-specific desktop exception.** CrewBTC currently requires a viewport at least
1024 pixels wide and shows a wider-window notice below that size. The explicit project
scope takes precedence over this document's mobile parity requirement; keep the notice
and preserve workspace state when narrow. Do not report mobile editing as supported.

**Stack assumption.** The named tools (React, Tailwind, Vite, `lucide-react`, `oxlint`, `vitest`, `playwright`, `idb`/Dexie) are the defaults. If the project already uses a different equivalent, use the existing one and say so in the report — do not install a second tool to satisfy the letter of a rule. Vercel is the assumed deploy target (§5B, §7).

---

**Rule tags.** Every rule is tagged so you know how it will be judged:

- **`[GATE]`** — has a command in Appendix A. Run it; it passes only on exit `0`. Failing blocks the commit. Where a rule is tagged `[GATE]` but Appendix A has no command for it, it is judged like `[REVIEW]` — say so rather than claiming it passed.
- **`[REVIEW]`** — binary, but verified by inspection rather than by command: a keyboard pass, a breakpoint pass, an installed-mode pass. Report it as `pass` / `fail` / `not run`, never as "verified".
- **`[CRAFT]`** — judgement call. Reviewed by a human or a design-authoritative agent. Violations are defects, not blockers.

Do not present a `[CRAFT]` or `[REVIEW]` rule as verified, and do not soften a `[GATE]`. Appendix D is the ordered pass before you report.

---

## 0. Precedence & Scope

- **Order of authority within this document:** §0 → §1 → §1A approval gates → everything else. When two rules here conflict, the lower-numbered section wins, and the conflict must be reported, not silently resolved. (User instructions outrank the whole document — see Scope.)
- **Approval gates override autonomy.** §1A gates always beat §10's autonomous commit policy. When in doubt, stop and ask.
- **Do not invent scope.** If a rule cannot be satisfied without breaking a higher rule, stop and report the conflict.

---

## 1. Reconnaissance, Scope & Blast-Radius Control

- **`[GATE]` Inspect Before Changing:** Before editing, read existing files, established patterns, dependencies, and project instructions (`README`, `CLAUDE.md`, this file). Reuse existing utilities and components before inventing new ones.
- **`[GATE]` Inspect the Blast Radius:** Before modifying shared UI primitives, storage schemas, global styles, or helper utilities, list all dependents (`grep` the import path). State the list in the completion report.
- **`[GATE]` Smallest Complete Change:** Modify only what is necessary. Never refactor, rename, or reformat unrelated working files.
  - **Exception (explicitly in scope):** creating or extending a `src/components/ui/` primitive, or extracting a component that exceeds §8's line limit, is *never* "unrelated work." Design-system and line-limit compliance are always in scope.
- **`[GATE]` Manage Dependencies Deliberately:** Never install a new third-party package if the existing stack cleanly satisfies the requirement. Justify any new dependency in the completion report, naming what was rejected and why.
- **`[GATE]` Resolve Ambiguity Before Coding:** If a request has materially different interpretations that affect UX, data models, or logic, ask a brief, targeted clarifying question before modifying files or pushing commits. Never silently guess on high-impact ambiguity.

---

## 1A. Conversational Modes & Pre-Execution Approval Gates

### Discussion-Only Override (`discussion only`)

Whenever the user includes `discussion only` — or asks a purely exploratory question without requesting edits — do not create, modify, or delete files, and do not run Git commits or pushes. Respond strictly with conversational analysis, ideas, or architectural advice. §11's completion report does not apply.

### Clarification & Step-by-Step Plan Gate

Whenever a request is ambiguous, touches core architecture or schemas, or the user asks for clarifying questions or an implementation plan before starting, stop before editing files.

Respond with:

1. **Understanding & Rationale:** Briefly confirm the goal, explain why the proposed approach will work, and identify edge cases or prerequisites needed from the user.
2. **Clarifying Questions:** Ask targeted questions that eliminate bugs or guesswork, where needed.
3. **Step-by-Step Execution Plan:** List the exact files to create or modify and the planned SemVer bump.

Wait for explicit user approval before writing code or pushing to GitHub.

### Ruthless Founder & Design Audit Mode

Whenever the user asks for a project rating, UI/UX roast, or product critique, adopt the persona of a ruthless, conversion-obsessed startup founder and UI/UX designer who has scaled 3 SaaS products past $10M ARR and studied every pixel of Linear, Superhuman, Vercel, Raycast, and Arc — able to spot generic "vibe-coded" AI slop from 50 feet away:

- **No Fluff or Politeness:** Cut generic praise. Call out sloppy spacing, weak visual hierarchy, sluggish interactions, ambiguous copy, and dead-end user flows immediately.
- **Objective Scorecard (`1–10`):** Score the app candidly across **Idea**, **Features**, **UI Craft**, and **User Experience** with blunt reasoning for every point docked.
- **3–5 Surgical Upgrades:** Prescribe exact, high-leverage fixes (copy, layout, micro-interactions, or flow simplifications) required to turn it into a `10/10` category-defining product.

---

## 2. Standardized UI Component Architecture (Design System)

Never write ad-hoc, one-off Tailwind styling for recurring elements. Build and strictly reuse centralized UI primitives inside `src/components/ui/`. **`[REVIEW]`** — this is inspected, not linted: grep `src/` for repeated utility strings (`bg-zinc-900`, `rounded-2xl`, `min-h-[44px]`) outside `src/components/ui/`, and report any that should be a primitive.

### Closed Variant Sets

Every primitive's variants are enumerated here. Adding a variant requires a doc change plus a SemVer bump per §9. `[GATE]`

### Buttons (`<Button />`)

- Maximum 4 variants: `primary`, `secondary`, `ghost`, `danger`. No others.
- Maximum 3 sizes: `sm`, `md`, `lg`.
- Button target size is governed by the ladder in §4.1 (`44px` default, `32px` dense desktop, `24px` floor) — that section is the only place the numbers are set. **`[GATE]`**
- `danger` must never be the default focus target of a destructive confirmation.
- Buttons must disable/lock during active async submissions to prevent double-tap duplicates, and expose `aria-busy` while pending.

### Cards (`<Card />`)

- Standardized radius: `rounded-2xl`.
- Standardized padding: `p-4` on mobile, `p-5` on desktop.
- Subtle `1px` border: `border-zinc-200 dark:border-zinc-800`.
- Consistent elevation. One elevation level only — never stack shadow + border + ring on the same surface.

### Form Inputs (`<Input />`, `<Select />`, `<Toggle />`)

- Numeric inputs must use `inputMode="decimal"` or `inputMode="numeric"` so mobile devices trigger the correct keypad. **`[GATE]`**
- Inputs must use `text-base` (16px minimum) to prevent iOS Safari auto-zoom on focus. **`[GATE]`**
- Consistent `h-12` height.
- Consistent focus ring: `focus-visible:ring-2 focus-visible:ring-red-500` (verified 5.29:1 against `zinc-950`; see §3.1). **`[GATE]`**
- Use clear inline unit and label affixes where appropriate.
- Every input has a programmatically associated `<label>` — placeholder text is never the only label (§3A). **`[GATE]`**

### Modals & Drawers (`<BottomSheet />`)

- On mobile viewports (`<768px`), all creation/edit forms must render as smooth slide-up bottom sheets.
- Bottom sheets must include a drag handle, backdrop-tap and `Escape` dismissal, and a sticky bottom submit CTA.
- Focus is trapped while open and **restored to the triggering element on close** (§3A). **`[GATE]`**
- Never use cramped centered popups for creation/edit forms on mobile.

### Status Badges (`<Badge />`)

Exactly 4 semantic variants: `neutral` (zinc), `accent` (red), `warning` (amber), `danger` (rose). No ad-hoc pill styling. **`[GATE]`**

### Zero "Vibe-Coded" AI Slop

Build every screen to the pixel-level craft of **Linear, Superhuman, Vercel, Raycast, and Arc**: **`[CRAFT]`**

- Maintain crisp `1px` hairline borders, disciplined spacing scales, high-contrast typographic hierarchy, and zero generic gradient blobs, filler subtitles, or redundant wrapper cards.
- Every element on screen must earn its pixels by serving an immediate user action or decision.

---

## 3. Visual Hierarchy, Typography & Color Discipline (Black & Red Edition)

### Color Palette

- **Dark Mode (Default):** Deep obsidian/carbon black background (`bg-zinc-950` or `bg-black`), elevated cards (`bg-zinc-900` / `border-zinc-800`), primary text (`text-zinc-50`), and secondary text (`text-zinc-400`).
- **Light Mode (Adaptive/Toggleable):** Clean zinc light background (`bg-zinc-50`), white cards (`bg-white` / `border-zinc-200`), primary text (`text-zinc-900`), and secondary text (`text-zinc-500`).
- **Primary Brand & Accent:** High-impact crimson/ruby red. **Use `red-600` in light mode and `red-500` in dark mode for *surfaces and accents*; use `red-700` when a red fill carries small white label text** (see §3.1).
- **Semantic Accents:** Rose/red variants for errors and destructive actions, `amber-500` for warnings/pending states, and neutral zinc for secondary badges.

### 3.1 Contrast Is a Gate, Not a Vibe

**`[GATE]`** All text meets WCAG 2.2 AA: **4.5:1** for normal text, **3:1** for large text (≥18.66px bold or ≥24px) and for non-text UI (borders of interactive controls, focus rings, icons carrying meaning).

These pairs are verified against Tailwind's default palette. Do not substitute colours without re-running the check in Appendix A.

| Pair | Ratio | Verdict |
|---|---|---|
| `red-500` fill + `zinc-50` label (dark mode CTA) | **3.61** | ❌ fails AA normal text — **never** use for ≤18.66px label |
| `red-500` fill + white label (light mode CTA) | **3.76** | ❌ fails AA normal text |
| `red-600` fill + white label | **4.83** | ✅ passes, minimal headroom |
| `red-700` fill + white label | **6.47** | ✅ passes comfortably — **preferred CTA fill** |
| `red-500` as accent text on `zinc-950` | 5.29 | ✅ passes (accent text, icons, focus rings) |
| `red-600` as accent text on `white` | 4.83 | ✅ passes |
| `zinc-400` secondary on `zinc-950` | 7.76 | ✅ AAA |
| `zinc-400` secondary on `zinc-900` card | 6.91 | ✅ passes |
| `zinc-500` secondary on `zinc-50` | 4.63 | ✅ passes |
| `amber-500` on `zinc-950` | 9.26 | ✅ AAA |

**Rule of thumb:** red is safe as a *fill for large/bold text*, as *accent text*, as an *icon colour*, and as a *focus ring* — never as a crimson fill behind small white text.

### Tabular Numbers

**`[GATE]`** Every numerical metric — counters, currency totals, percentages, timestamps, live calculations — applies `tabular-nums` so digits align vertically and never jitter during updates.

### Strict Iconography

- **`[GATE]`** Exclusively use `lucide-react` for all **UI iconography**. Never import icons from another library or use raw inline SVGs for UI icons. **Exemption:** brand marks, favicons, PWA/maskable icons, and the `apple-touch-icon` are not UI iconography and must not be lucide (§4 requires them).
- **`[GATE]`** Standardized sizes: `w-4 h-4` inline/badges, `w-5 h-5` navigation/buttons, `w-6 h-6` hero/FAB.
- **`[GATE]`** Consistent `strokeWidth={2}`.
- **`[GATE]`** Every icon-only button must include a descriptive `aria-label`.

### Stateful Motion & User-Controlled Reduced Motion

**Motion tokens (use these exact values):**

| Token | Value |
|---|---|
| micro-interaction | `150ms` `ease-out` |
| sheet / drawer / expansion **enter** | `240–280ms` `cubic-bezier(0.32, 0.72, 0, 1)` |
| sheet / drawer / expansion **exit** | `200ms` same curve — **exit must never exceed enter** |
| hard ceiling | `350ms` for any standard UI transition |

- **`[REVIEW]` Animate All UI State Transitions:** Anything that appears, disappears, pops up, slides in/out, expands, contracts, or changes state MUST be animated smoothly — never snapping abruptly into or out of existence:
  - **Popups, Modals & `<BottomSheet />`:** Backdrop fade (`opacity`) paired with directional slide/scale (`translateY` / `scale`) on **both** mount and unmount (keep elements mounted until exit animations finish).
  - **Expand / Collapse (Accordions, Drawers, Filter Bars):** Smooth height/grid-row (`grid-template-rows: 0fr -> 1fr`) + `opacity` transitions.
  - **Lists, Toasts, Tabs & Data Updates:** Subtle entrance/exit slides for `<Toast />` and list mutations, animated active-tab indicators, and smooth tweened transitions for gauges, progress bars, and chart updates.
  - **Tactile Press Feedback:** Subtle `active:scale-[0.98]` + `150ms` `ease-out` on interactive buttons and cards.
- **`[GATE]` 60fps GPU Performance:** Animate strictly GPU-composited properties (`transform`, `opacity`, `clip-path`, or CSS Grid row tracks). Never animate `height`, `width`, `top`, `left`, or `box-shadow`. Never make task completion or data saving wait for animation completion.
- **`[GATE]` Exit cleanup must never depend solely on `transitionend`.** Use `onAnimationEnd`/`animationend` for enter, and drive unmount from an **explicit timer fallback** (`setTimeout` matched to the token, cleared on unmount). With `transform: none` and near-zero durations, `transitionend` may never fire and a `transitionend`-only unmount leaks the element permanently.

### Two-State `Reduced Motion` (`On` / `Off`) Toggle in Settings

- **`[GATE]`** Every app MUST include an explicit **Reduced Motion (`On` / `Off`)** toggle inside the Settings page, persisted in local storage/IndexedDB and reflected on the root `<html>` element (`data-reduced-motion="true" | "false"`).
- **`[GATE]` Default initialization:** Use the user's explicit saved choice if set; otherwise fall back to `window.matchMedia('(prefers-reduced-motion: reduce)').matches`.
- **`[REVIEW]` Behavior when `Reduced Motion: On`:** Suppress all spatial translations, slides, scales, bounces, and parallax (`transform: none`), replacing essential state changes with a near-instant (`≤80ms`) opacity cross-fade. Set durations to `0.01ms` only where a CSS transition must exist for lifecycle reasons — and pair it with the timer fallback above so unmount always occurs.

---

## 3A. Accessibility Baseline

**`[REVIEW]`** Every app meets WCAG 2.2 AA. Required per surface:

- **Focus visibility:** Never `outline: none` without a replacement. Focus rings per §2 (`ring-red-500`, ≥3:1 against adjacent colour).
- **Focus management:** Modals, sheets, and drawers trap focus while open, close on `Escape`, and **restore focus to the triggering element** on close.
- **Labels:** Every form control has a programmatically associated label or `aria-label`. Placeholders are hints, never labels.
- **Live regions:** Toasts and async results announce via `aria-live="polite"` (`role="status"`); errors that block the task use `aria-live="assertive"` or `role="alert"`.
- **Keyboard parity:** Every interactive element is reachable and operable by keyboard, in a logical tab order. Drag-to-dismiss sheets must also have a keyboard-dismissible control.
- **Reduced motion & forced colours:** Honour `prefers-reduced-motion` (§3) and verify at least once under `forced-colors: active`.

**Automated help, not proof:** `jsx-a11y/recommended` (Appendix A.1) catches some of the above. A green lint is not an accessibility pass — report each item in A.2 explicitly.

---

## 4. Layout Constraints (PC & Mobile, PWA)

**Framing.** This section is **device-neutral**. PC and mobile are **equal peers**: PC is where density and speed live, mobile is where most sessions start. Neither is the "primary" target, and neither may become a degraded version of the other. Compose for the surface you are working on, then prove the same screen on the other one.

**Rule split:** §4.1 applies to both surfaces. §4.2 is PC-only. §4.3 is mobile-only. §4.4 is PWA/installability. If a rule does not apply to a surface, it is filed under the other one — not weakened.

### 4.1 Shared (both surfaces)

- **`[REVIEW]` Breakpoint ladder:** verify at `1440` / `1280` / `1024` / `768` / `390` CSS px, **plus `320px` at 200% browser zoom** (WCAG 2.2 reflow: no horizontal scrolling for prose, forms, or primary actions). Every surface, every time.
- **`[REVIEW]` Keyboard parity:** the whole app is operable without a pointer — on desktop and on a tablet with a hardware keyboard. Tab order follows reading order, every action has a focusable trigger, and the shortcut map is documented in Settings.
- **`[GATE]` Target size ladder — the only place target size is defined.** Any other figure elsewhere in this document or in Appendix A/B is superseded by this rule.
  - `44px` (`min-h-[44px]`) is the default for every interactive element, on every surface.
  - `32px` (`min-h-8` / `h-8`) is permitted **only** for dense desktop chrome, table-row actions, and icon clusters.
  - **`24x24` CSS px is the absolute floor** (WCAG 2.2 §2.5.8). Nothing below `24px`, anywhere.
- **`[GATE]` Zero horizontal overflow:** enforce `overflow-x-hidden` on root containers. Tables and wide metric rows scroll inside contained wrappers without breaking viewport width.
- **`[GATE]` Scrollbars stay visible:** never `scrollbar-width: none` or `::-webkit-scrollbar { display: none }` on a scrollable region — on desktop and on mobile. An invisible scrollbar containing overflow hides affordance and is an accessibility defect.
- **`[GATE]` Inputs never zoom the page:** every input is `text-base` (16px) or larger, with `inputMode="decimal"`/`"numeric"` on numeric fields (§2). Applies to both surfaces — iOS Safari zooms on mobile, and browser zoom on desktop catches the rest.
- **`[GATE]` No hover-only paths:** `hover:` may change styling only. Anything revealed on hover must also be reachable via `focus-within`/`focus-visible` **and** by tap.
  - Verified behaviour: **Tailwind v4 emits `hover:` inside `@media (hover: hover)`**, so hover styles do not apply on touch devices or on hybrids where the browser reports touch as the primary input. That is correct, not a bug — do **not** paper over it with `@custom-variant hover (&:hover)`, which reintroduces stuck hover states on touch.
- **`[GATE]` Fast initial shell:** lazy-load heavy optional modules — charts, media processors, export engines, parsing engines — behind `React.lazy`/dynamic `import()` inside the route that needs them, on every surface. Budgets in §7A.

### 4.2 PC (`>=1024px`)

- **`[GATE]` Layout discipline:** persistent sidebar at `>=768px`; multi-column layouts only while every column stays `>=280px`; prose capped near `75ch`; the content wrapper is capped (`max-w-[1400px]`) so text does not stretch across an ultrawide display.
- **`[GATE]` Density, not inflation:** PC shows *more*, not *bigger*. Tables go full-width with sticky headers, hover **and** focus row styling, and keyboard-operable sorting.
- **`[REVIEW]` PC-only affordances need keyboard equivalents:** right-click menu → `Shift+F10`/context-menu key, drag-and-drop → explicit "move up/down" actions, hover cards → focusable.
- **`[REVIEW]` Desktop PWA chrome:** with `display: "standalone"` the app gets a real window; do not draw a fake title bar or fake window controls. Style `@media (display-mode: standalone)` only to trim chrome you actually added.
- **`[CRAFT]`** Desktop is where density and speed live — a command palette (`Cmd/Ctrl+K`), `J`/`K` list navigation, and single-key actions on focused items are the difference between a web page and a tool.

### 4.3 Mobile (`<1024px`)

- **`[GATE]` Viewport stability:** Never use `100vh`.
  - **App shells, headers, nav, and full-screen layouts:** use `100svh` (`min-h-[100svh]`) — stable in standalone PWA mode, where `dvh` reflows mid-scroll as the browser toolbar hides and shows.
  - **Transient surfaces (bottom sheets, drawers, image viewers):** `100dvh` (`min-h-[100dvh]`) is acceptable and preferred, because that reflow is the desired behaviour.
- **`[GATE]` Safe area insets:** top headers include `pt-[env(safe-area-inset-top)]`. Fixed bottom navigation and sticky sheet CTAs include `pb-[env(safe-area-inset-bottom)]`.
- **`[REVIEW]` Tab-bar and thumb reach:** primary navigation sits within reach of the bottom third; destructive actions never sit directly adjacent to the primary action.
- **`[REVIEW]` Touch, not hover, is the baseline input:** every interaction completes with one tap; no action depends on a long-press that is not also exposed as a visible control.
- **`[CRAFT]`** Mobile is where the product must feel instant — one primary action per screen, skeletons over spinners, and no horizontal surprise.

### 4.4 PWA & installability (all surfaces)

- **`[GATE]` Complete PWA assets:** never reference missing icon paths in `manifest.json`. Generate valid matching assets at `192x192`, `512x512`, plus a **maskable** icon and `apple-touch-icon`. Verify `display: "standalone"`. Verify every manifest icon path resolves (Appendix A).
- **`[REVIEW]` Installed mode is a real mode:** verify at least once in standalone on desktop **and** on mobile. Safe-area, `svh`, and scroll behaviour all change once installed, and a layout that only works in a browser tab is not finished.
- **`[GATE]` An installed client must be able to learn it is stale:** an installed PWA has no address bar to refresh from, so the §7 update notice is not optional polish in standalone — it is the *only* route to a new build short of reinstalling. Check the notice actually renders in standalone, where the app runs without browser chrome.

---

## 5. Data, Math, Security & Storage Integrity

- **`[GATE]` Zero Mock Placeholders or `TODO`s:** Every function, storage migration, parser, and calculation must be fully implemented. Never leave `TODO` comments or static placeholder arrays in production components. Enforced by lint (`--max-warnings=0`).
- **`[GATE]` Safe Calculations:** Guard all divisions and aggregations against `0`, `NaN`, `null`, `Infinity`, and negative deltas. Display a clean fallback (`—`), never `NaN`/`Infinity`/`undefined` on screen, and provide inline validation.
- **`[GATE]` Schema Evolution & Safe Imports:** Whenever client-side storage structures change, increment the IndexedDB/`localStorage` schema version with a **tested** upgrade path (§8A). Validate and sanitize imported JSON/CSV before writing to storage — reject unknown shapes rather than coercing them.
- **`[REVIEW]` Client-Side Media Optimization:** Compress and resize user-uploaded images/camera captures with HTML5 Canvas before storage: maximum width `1200px`, JPEG quality `0.75`.
- **`[GATE]` Local Timezone & Date Accuracy:** Store full ISO-8601 timestamps. Never derive local calendar dates with UTC slicing (`toISOString().split('T')[0]`) — it is wrong for the 8+ hours a day that Singapore, and any non-UTC user, spends on the other side of midnight UTC. Format with `Intl.DateTimeFormat` or the user's local timezone.
- **`[GATE]` True Offline-First Resilience:** CRUD operations, reads, writes, and local state management must function cleanly against local storage/IndexedDB while offline, with no network errors surfaced to the user.
- **`[GATE]` Secrets Hygiene:** Never commit API keys, tokens, credentials, or `.env` secrets to source control or client bundles. In a client-only SPA, **anything in the bundle is public** — there is no such thing as a private key in `src/`. Only `VITE_*` values that are safe to publish.

---

## 5A. State & Data Layer

- **`[REVIEW]` One storage library, recorded here.** Pick one and do not mix: `idb` (thin IndexedDB wrapper) or Dexie (query layer). Document the choice in the repo README before writing data code.
- **`[REVIEW]` Error boundaries:** Every route segment renders inside a React error boundary with a recovery action (`Retry` / `Go home`). A single unhandled render error must never white-screen the app. Root boundary plus per-route boundary.
- **`[REVIEW]` Explicit loading/error/data modelling:** Async state is modelled as a discriminated union (`{status: 'loading'} | {status: 'error', error} | {status: 'success', data}`) — never inferred from a grab-bag of `isLoading` / `data` / `error` booleans that can contradict each other.
- **`[GATE]` No stale-cache ambiguity:** State a cache invalidation rule for every derived/store-backed value. If two views can show the same entity, they read one source of truth.
- **`[REVIEW]` Migrations are one-way and versioned:** each bump has `1 → 2`, `2 → 3` steps and never rewrites history in place.

---

## 5B. Security Headers (Vercel)

**`[GATE]`** Deployment target is Vercel. `vercel.json` declares, at minimum:

- `Content-Security-Policy` — no `unsafe-eval`; `script-src 'self'` (a Vite production build needs no inline script except the module preload; if the service worker injects one, hash it).
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` — deny camera/microphone/geolocation unless the feature exists.
- If a CSP is added or tightened, **re-verify the service worker still registers** (§7) — a CSP that blocks the SW is a silent loss of offline support.

---

## 6. Error Handling & Complete Interaction States

- **`[REVIEW]`** Every view and control accounts for loading, empty, error, disabled, and success states. No exceptions, including first-run states.
- **`[REVIEW]`** Every list, table, or dashboard view includes a clean empty state with a Lucide icon, a concise one-line explanation, and one clear primary action.
- **`[REVIEW]`** Every create, update, delete, or export action triggers non-blocking toast feedback, including an **Undo** action for destructive deletions. Toasts announce via `role="status"` (§3A) and never block interaction.
- **`[GATE]`** Async actions expose `aria-busy` and cannot double-submit (§2 Buttons).

---

## 7. Build Verification & Vercel Deployment Safety

- **`[GATE]` Pre-Push Build Check.** Before every commit or push, run **both**:

  ```bash
  npx tsc -b --noEmit     # solution-style tsconfig (Vite default) — REQUIRED
  npm run build           # production build
  ```

  **`tsc --noEmit` without `-b` is forbidden as evidence.** Vite's root `tsconfig.json` is solution-style (`"files": []` + project references); plain `tsc --noEmit` compiles an empty file set and **exits 0 even when `src/` is full of type errors**. Verified against `vite@8.3.6` / `typescript@7.0.2`: a planted `const label: string = 42` passed `tsc --noEmit` with exit code 0 and failed `tsc -b` with exit code 1.
  Capture the **exit code**, not the presence of output. A check passes only if it exits `0`.
- **`[REVIEW]` Repeat-Firing Lifecycle Check:** Verify repeated open → submit/close → reopen cycles for drawers, modals, toasts, and media capture. State resets, no stale values, no duplicated listeners, no leaked exit timers.
- **`[GATE]` Never Fabricate Verification:** Report a check as passed only if it actually ran and exited `0`. Paste the command and exit code. Explicitly disclose unverified checks and limitations. "Should work" is not verification.
- **`[GATE]` SPA Routing & PWA Cache Hygiene.** Vite emits a real `index.html`, so the rewrite must not swallow assets:

  ```json
  {
    "rewrites": [{ "source": "/((?!assets/).*)", "destination": "/index.html" }]
  }
  ```
  (If you prefer the flat `/(.*)` rewrite, confirm hashed assets still resolve and that no request loops.) Set `build.manifest: true` in `vite.config.ts` so the service worker precaches content-hashed filenames.
- **`[GATE]` A deploy must actually reach a running client — cached files are only half the problem.** It is not enough that a new service worker installs and claims control. **A page keeps executing the JavaScript it loaded at first paint**, so with no further wiring the user runs the previous build until they refresh by hand — and a fix that shipped days ago gets reported as broken. Configure **all three**:

  1. **Self-updating worker** — `registerType: "autoUpdate"`, `skipWaiting()` + `clientsClaim()`, and a precache manifest so content-hashed assets are replaced rather than stale.
  2. **A `controllerchange` listener in the app** — the update is detected client-side, not assumed. Read `navigator.serviceWorker` **once** into a local and guard for `null`/absent: it is missing in some embedded browsers, non-secure contexts, and every test environment, and a stale reference makes cleanup throw.
  3. **A visible way to adopt the new build** — a reload affordance the user can see.

  **Do not reload automatically by default.** A reload discards everything held in memory: unsaved form state, uploaded files, edits not yet exported. A tab left open overnight would refresh itself and lose that work with no warning. Auto-reload is acceptable **only** when the app provably holds no unsaved state (nothing mounted, nothing pending); otherwise announce and let the user choose. The same reasoning bans "just tell them to hard-refresh" — that is a support burden, not a fix.

  Three conditions must hold before announcing, and each needs a test, because each is a bug the feature itself introduces:
  - **Not on first install.** No controller means this page *is* the first version; there is nothing newer to announce.
  - **Not during startup.** An update event in the first second or two fires mid-render, which reads as a crash. Wait for the page to settle.
  - **Once per new worker.** Repeated lifecycle events must not stack duplicate notices or listeners.

  **`[REVIEW]`** Verify by deploying a visible change twice and confirming the second deploy surfaces a reload affordance **in a client that already has the worker installed** — not by inspecting the cache.

---

## 7A. Performance Budgets

**`[GATE]`** Budgets, measured on the production build, not dev:

| Metric | Budget |
|---|---|
| Initial route JS (gzip) | ≤ 200 KB |
| Initial route CSS (gzip) | ≤ 40 KB |
| LCP (mobile, 4G throttled) | ≤ 2.5s |
| CLS | ≤ 0.1 |
| INP | ≤ 200ms |

- Route-level code splitting is required for anything non-critical to first paint.
- Record the measured numbers in the completion report when the change touches bundle composition.
- Enforcement: the budget command in Appendix A.1 (`size-limit`, else a `gzip` byte count against the table above). Reading the file size by eye is not a pass.

---

## 8. Code Quality & TypeScript Discipline

- **`[GATE]` Strict Type Safety.** `tsconfig.app.json` must contain:

  ```jsonc
  {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  }
  ```

  **The Vite template ships no `strict` flag.** Banning `any` without `strictNullChecks` is policing the window while the door stands open — `const x: string = null` compiles clean.
- **`[GATE]` Never use `@ts-ignore` or explicit `any`.** Use `unknown` + narrowing, or a precise type. `@ts-expect-error` is permitted only with a comment naming the upstream bug.
- **`[GATE]` Define reusable TypeScript interfaces in `src/types/`** — not inline in components, and not duplicated across files.
- **`[GATE]` Modularity:** files stay ≤ 250 lines. Enforced by lint (`max-lines: 250`), not by "approximately".
- **`[GATE]` No floating promises:** every promise is awaited, returned, or explicitly `.catch`ed with a user-visible consequence.

---

## 8A. Testing

**`[GATE]`** Coverage must be *written and passing*, verified by the tests command in Appendix A.1. Minimum coverage, in `vitest` + `@testing-library/react` unless the repo already uses another runner:

- **Every `ui/` primitive:** one render test covering its states (default, disabled, loading, error where applicable).
- **Every storage migration:** a test that seeds a vN-1 database and asserts the vN upgrade preserves data. §5's "safe upgrade path" is otherwise an unproven claim.
- **Every calculation in §5:** a test for `0`, negative, and `null`/`NaN` inputs.
- **One end-to-end path** (`playwright`) covering the primary task plus an offline reload.
- Tests must pass in CI (Appendix A). Do not report "tested" for paths with no test.

---

## 8B. Post-Implementation Verification (What to Test, What to Look Out For)

§8A says coverage must be *written*; Appendix D says which commands to *run*. This section is the other half: the defects that pass every gate and still ship. Every item is **`[REVIEW]`** unless marked otherwise — report each as `pass` / `fail` / `not run` with one line of evidence, never as "verified".

### The four questions to ask before calling anything done

1. **What did I change that something else reads?** If a function's signature, a stored shape, a shared component's props, or a `key` changed, grep every caller and every test fixture. A change is not complete until every reader agrees with the writer.
2. **What happens the second time?** Run the primary action twice, and after clearing. Caches, `useRef` guards, module-level state, `Set`s of "already done", and `once`-registered listeners are the usual suspects. Any state that outlives the data it describes is a bug waiting for a clear-and-retry.
3. **What happens at the edges?** Empty (zero items), one item, enough to span a boundary (more than a page, more than a screen, more than a column), and maximum (the largest realistic input). Boundaries are where index arithmetic and pagination break.
4. **What happens at the sizes I did not design for?** Narrow window, zoomed text, long filenames, a translated string. If a container clips, an element is absolutely positioned, or a label has a fixed width, prove it at the extremes.

### Regression classes to actively hunt

Check each of these that your change could plausibly touch. This is a probe list, not a ritual — skip the ones that cannot apply and say so.

| Class | How it fails | What to do |
|---|---|---|
| **Writer/reader key drift** | Two call sites derive the same identity by different rules (list ordinal vs. grid index, id vs. file name). Works for the first page, silently breaks every page after | Name the identity in one function, make every reader call it |
| **State outliving its data** | A cache, ref, or module variable holds "seen" keys; clearing the underlying data does not clear it, so the next load is a no-op | Derive from the source of truth; if caching, clear it in the same action that clears the data |
| **Pagination / index arithmetic** | `index % pageSize`, `Math.floor`, `slice` off-by-one; off-by-one is invisible for one page | Test with exactly `pageSize`, `pageSize + 1`, and `2 × pageSize` items |
| **Layout that only works when it fits** | Centring or `justify-between` with an overflowing child clips the top or strands a gap | Test at minimum and maximum content; prefer flow layout over centred overflow |
| **Unmount as data loss** | A breakpoint, error boundary, or route swap unmounts stateful UI; all in-memory state is gone | Keep mounted and hide, or lift state above the branch |
| **Stale derived value** | A value computed from a prop that changed but the value did not recompute (missing dep, memo key, or `useRef` initial) | Recompute from the source each render, or fix the dependency list |
| **Effect loops** | An effect depends on an object/array/function recreated each render; runs forever or re-fires on every render | Memoise the dependency at its source, not at the call site |
| **Two sources of truth** | A selection, mode, or index stored in state *and* derivable from other state; they disagree after an update | Derive it; if you must store it, define exactly when it is cleared |
| **Missing `aria-*` on a state change** | A toggle, tab, or panel changes visually but not for assistive tech | Every visual state has a programmatic twin (`aria-pressed`, `aria-expanded`, `aria-current`, `aria-selected`) |
| **Silent async failure** | A promise rejects, nothing surfaces; the UI looks like it is still loading | Every async path ends in success toast, error toast, or an explicit empty state |
| **Focus loss on rerender** | A list re-keys, a panel remounts, focus falls to `body` | Keep keys stable; restore focus after destructive or navigational updates |
| **Budget creep** | One more dependency or one more utility nudges the bundle past budget | Check the budget gate before pushing, not after |

### Behaviour that must be proven by hand, not by a unit test

Unit and integration tests cover logic. These need a human or a rendered browser, because they are about what the user perceives:

- **The primary task, end to end, twice** — including a reload in between. Persistence bugs only appear on the second pass.
- **Clear, then retry** — every destructive or "reset" action followed by the action it should unblock.
- **Scroll and navigation parity** — if a control scrolls to something, scrolling manually must update the same indicator, and vice versa. Any two-way binding needs both directions tested.
- **Empty, loading, error, disabled, success** (§6) — on every view the change touched.
- **Keyboard-only** — complete the primary task without a mouse; confirm focus is visible and follows reading order.
- **Narrow and wide** — the breakpoints from Appendix A.2, plus one extreme the design did not target.

### Writing the test so it can fail

A test that passes against the broken implementation is worse than no test, because it certifies the bug.

- **`[GATE]` Prove the test fails first.** For a bug fix: revert the fix (stash it, or comment the one changed line), run the new test, confirm it *fails for the stated reason*, then restore. Paste the failure in the completion report. If you cannot make it fail, the test is not testing what you think.
- Assert the **user-visible symptom**, not the internal mechanism. `expect(cells[12].textContent).toContain('PAGE-13')` survives a refactor; `expect(store.cards['12|a.pdf|13'])` does not.
- One assertion per behaviour. A test that checks five things fails with one message and hides four results.
- Never assert on a value the test itself just set, unless you are testing the setter.

### After you fix one instance of a bug

Ask whether the same defect exists at the other call sites. A key-drift bug in one writer is a key-drift bug in every writer; a cache that outlives its data in one hook is a cache that outlives its data in every hook. **`[REVIEW]`** — grep the pattern across the codebase and report what else you found, even if you fixed only the reported case.

### What to leave in the repo

- A test that would have caught the bug, named after the behaviour ("fills every card on the second sheet"), not after the fix.
- A one-line comment at the fix naming the *rule* that was broken, not the incident ("the cell is the drawing cell; ordinal position is not it"). Future readers need the invariant, not the bug report.
- No dead code from the old approach. If a guard or cache is no longer needed, delete it; a commented-out `Set` will be reinstated by the next person who thinks they need it.

---

## 9. Semantic Versioning (SemVer) for Every Change

Every function creation, bug fix, feature addition, or refactor follows strict Semantic Versioning (`MAJOR.MINOR.PATCH`), reflected in commit messages and `package.json`.

- **PATCH (`x.x.X`):** Bug fixes, styling tweaks, typo corrections, internal refactors, **new or modified `ui/` primitives**, doc/rule changes.
- **MINOR (`x.X.x`):** **User-visible** new capability — a new screen, a new workflow, a new export format. Not: a new internal primitive, a refactor, or copy.
- **MAJOR (`X.x.x`):** Breaking architectural changes or non-backward-compatible storage/API schema changes — i.e. an IndexedDB migration with no upgrade path, or a change to any module consumed outside its own route.

**Pre-1.0 (`0.x`):** the app is unstable and anything may change. Before `1.0.0`, prefer MINOR for breaking changes (SemVer §4). **`1.0.0` is reached** when the storage schema is stable, the primary task works offline end-to-end, and §8/§8A gates pass in CI.

- **`[REVIEW]` Changelog and Project Memory:** `CHANGELOG.md` is the single source of truth for both the in-app release history and a current-state ledger for future maintainers. Keep the ledger factual and current when behavior, architecture, storage, decisions, known failures or incomplete work change; record what exists, why, what was replaced and what remains incomplete, distinguishing verified facts from unverified claims. It is project memory, not a duplicate rules file or speculative roadmap. Preserve historical release entries. Keep the newest release synchronized with `package.json`; `src/data/changelog.ts` provides the typed adapter. On every MINOR or MAJOR — and any notable PATCH fix — prepend a release entry (`version`, `date`, `title`, `highlights[]`). Both the Settings Changelog view and the automatic "What's New" modal read from that history.
- **`[GATE]` Commit Message Format:** every commit states the SemVer scope and version:
  - `fix(ui): resolve bottom sheet safe-area padding v1.0.2`
  - `feat(export): add CSV download utility v1.1.0`
  - `docs(rules): tighten typecheck gate and contrast ratios v1.0.0 → v2.0.0`

---

## 10. Strict Git Workflow & Autonomous Commit Policy

- **`[GATE]` Inspect Before Committing:** Check `git status` and `git diff` so commits contain only intended changes and never overwrite pre-existing uncommitted work. Never `git add -A` blindly.
- **`[GATE]` Commit & Push Only:** Stage, commit, and push directly to the active remote branch.
- **`[GATE]` Never Pull, Never Create PRs:** Never execute `git pull`, never resolve merge conflicts via pull, never `gh pr create`. Treat the working branch as an exclusive direct-push target.
- **`[GATE]` If a push is rejected, stop and report.** Do not `git push --force`, `--force-with-lease`, or `git reset --hard` without explicit user approval. With `pull` banned, a rejected push is a *conflict for the human*, not a problem to solve unilaterally.
- **`[GATE]` This workflow assumes a single writer.** With concurrent agents on one branch, direct push without review is unsafe; switch to PRs (overriding the ban above, explicitly) or serialise the work.
- Scope note: §1A approval gates always override this section's autonomy.

---

## 11. Mandatory Completion Report

After **any implementation, bug fix, or iteration** — not after chat-only or pure-analysis responses — conclude with:

1. **Changed:** Files created/modified and features/behaviours implemented.
2. **Preserved:** Important neighbouring workflows or existing behaviours intentionally left untouched (the §1 blast-radius list).
3. **SemVer Bump:** Exact bump (`vX.Y.Z → vX.Y.Z`) and commit hash/message.
4. **Verification:** Checks actually executed (`tsc -b --noEmit`, `npm run build`, lint, tests, runtime checks) with **the command, its exit code, and honest pass/fail**. Name anything not run.
5. **Limitations & Git Status:** Unverified areas/assumptions, plus confirmation of the direct Git push (or the reason it did not happen).

---

## Appendix A — Gates & Their Verifiers

Run from the project root. A gate passes only when its command **exits `0`** — capture the exit code, not the presence of output.

### A.1 Enforced — has a command

| Gate | Command | Passes when |
|---|---|---|
| Types (§8) | `npx tsc -b --noEmit` | exit 0 — **never** plain `tsc --noEmit` |
| Build (§7) | `npm run build` | exit 0 |
| Lint — non-type-aware (§2, §5, §8) | `npx oxlint --deny max-lines --max-warnings=0` | exit 0 |
| Lint — type-aware (§8, floating promises) | `npx oxlint --type-aware --max-warnings=0` (needs `oxlint-tsgolint`, TS 7.0+), or ESLint with `projectService` | exit 0 |
| Tests (§8A) | `npx vitest run` | exit 0 |
| Placeholders (§5) | `grep -rnE "TODO\|FIXME" src/` | no matches |
| Contrast (§3.1) | script B.1 | exit 0 |
| Layout (§4.1, §4.3) | script B.2 | exit 0 |
| Manifest (§4.4) | script B.3 | exit 0 |
| Secrets (§5) | `grep -rnE "(sk-[A-Za-z0-9]{16,}\|AKIA[0-9A-Z]{16}\|BEGIN [A-Z ]*PRIVATE KEY)" --include='*.ts' --include='*.tsx' --include='*.json' src public` | no matches |
| Bundle budget (§7A) | `npx size-limit` if configured; otherwise `gzip -c dist/assets/*.js \| wc -c` per file and compare to the §7A budget | under budget |

**Two lint passes, deliberately.** `max-lines` and jsx-a11y are not type-aware and run in the first pass. **`no-floating-promises` and `no-misused-promises` are type-aware and do not fire in a plain `oxlint` run** — that would be a silent gap, so they are a separate command. If the repo cannot run type-aware oxlint, use ESLint with `@typescript-eslint` in `projectService` mode for those two rules, and say which you used. `max-lines` needs its limit configured (`{"max-lines": ["error", {"max": 250}]}`) — the rule's default is 300 and would not enforce §8.

**Required lint rules** (§5, §8): `@typescript-eslint/no-explicit-any`, `no-floating-promises`, `no-misused-promises`, `@typescript-eslint/ban-ts-comment`, `max-lines` at 250, `no-warning-comments`, `jsx-a11y/recommended`.

**Required `tsconfig.app.json`** (§8): `"strict": true`, `"noUncheckedIndexedAccess": true`, `"noImplicitOverride": true`, `"exactOptionalPropertyTypes": true`, `"noUnusedLocals": true`, `"noUnusedParameters": true`, `"noFallthroughCasesInSwitch": true`.

### A.2 Not command-checkable — inspect and report

These are real gates but no script proves them. Each must be reported as **`pass` / `fail` / `not run`** with one line of evidence. Never report one as "verified".

| Gate | How to check |
|---|---|
| Focus trap + restore on close (§3A, §2 sheets) | Open the sheet by keyboard, `Tab` through it, `Escape`, confirm focus returns to the trigger |
| `aria-live` on toasts and async results (§3A, §6) | Trigger a toast with a screen reader or the accessibility tree open |
| Keyboard parity (§4.1) | Complete the primary task without touching the mouse |
| Breakpoint ladder (§4.1) | Load at 1440 / 1280 / 1024 / 768 / 390, then 320px at 200% zoom |
| Installed mode (§4.4) | Install and open standalone on desktop **and** mobile |
| Repeat-firing lifecycle (§7) | Open → submit → close → reopen each sheet, modal, toast; no stale values or duplicate listeners |
| Error boundaries (§5A) | Force a throw in a route; confirm the boundary catches it |
| Loading/empty/error/disabled/success (§6) | Walk all five states on every view |
| Service worker update reaches a running client (§7) | Deploy a visible change twice; confirm the second surfaces a reload affordance in a client that already has the worker — not merely that the cache updated. Also confirm the notice does **not** appear on a first install, or during the first seconds of load |
| SPA rewrite doesn't swallow assets (§7) | Deep-link to a nested route, confirm hashed assets still resolve |
| Safe-area insets (§4.3) | Inspect in installed mode on a notched device |
| `forced-colors` (§3A) | Enable forced-colors and confirm control boundaries survive |

Guardrail: these gates protect against *regressions of the rules*, not against bad product judgement. A green pipeline is not a 10/10 product.

**CI (optional).** Run A.1 in order on every push and fail the job on any non-zero exit. No file needs to ship with this document for that to work.

---

## Appendix B — Self-Contained Check Scripts

Three checks that cannot be done by a bare command. Each is a single Node script with **no dependencies** — write it to a temp file (e.g. `node /tmp/check.mjs`) or inline it with `node -e`, and run it from the project root. Every script exits `0` on pass and `1` on any violation.

### B.1 Contrast (§3.1)

```js
// Contrast gate — verifies the palette pairs declared in §3.1 against WCAG 2.2 AA.
// Edit PAIRS if the palette changes. Pairs marked expect:'fail' are known-unusable and must stay failing.
const AA_NORMAL = 4.5, AA_LARGE = 3.0
const C = { 'zinc-50':'#fafafa','zinc-400':'#a1a1aa','zinc-500':'#71717a','zinc-900':'#18181b',
  'zinc-950':'#09090b','white':'#ffffff','red-500':'#ef4444','red-600':'#dc2626',
  'red-700':'#b91c1c','amber-500':'#f59e0b' }
const hex = h => [1,3,5].map(i => parseInt(h.slice(i,i+2),16)/255)
const lin = c => c <= 0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4)
const lum = h => { const [r,g,b] = hex(h).map(lin); return 0.2126*r + 0.7152*g + 0.0722*b }
const ratio = (a,b) => { const [hi,lo] = [lum(a),lum(b)].sort((x,y) => y-x); return Number(((hi+0.05)/(lo+0.05)).toFixed(2)) }
const PAIRS = [
  { name:'zinc-50 on red-500 fill', fg:'zinc-50', bg:'red-500', level:'normal', expect:'fail' },
  { name:'white on red-500 fill', fg:'white', bg:'red-500', level:'normal', expect:'fail' },
  { name:'white on red-600 fill', fg:'white', bg:'red-600', level:'normal', expect:'pass' },
  { name:'white on red-700 fill', fg:'white', bg:'red-700', level:'normal', expect:'pass' },
  { name:'red-500 text on zinc-950', fg:'red-500', bg:'zinc-950', level:'normal', expect:'pass' },
  { name:'red-600 text on white', fg:'red-600', bg:'white', level:'normal', expect:'pass' },
  { name:'zinc-50 on zinc-950', fg:'zinc-50', bg:'zinc-950', level:'normal', expect:'pass' },
  { name:'zinc-400 on zinc-950', fg:'zinc-400', bg:'zinc-950', level:'normal', expect:'pass' },
  { name:'zinc-400 on zinc-900', fg:'zinc-400', bg:'zinc-900', level:'normal', expect:'pass' },
  { name:'zinc-500 on zinc-50', fg:'zinc-500', bg:'zinc-50', level:'normal', expect:'pass' },
  { name:'amber-500 on zinc-950', fg:'amber-500', bg:'zinc-950', level:'normal', expect:'pass' },
  { name:'red-500 focus ring on zinc-950', fg:'red-500', bg:'zinc-950', level:'ui', expect:'pass' },
]
let bad = 0
for (const p of PAIRS) {
  const min = p.level === 'normal' ? AA_NORMAL : AA_LARGE
  const r = ratio(C[p.fg], C[p.bg])
  const meets = r >= min
  const ok = p.expect === 'pass' ? meets : !meets
  if (!ok) bad++
  console.log(`${ok ? '✓' : '✗'} ${String(r).padStart(5)}:1  ${p.name} (needs ${min}:1, expected to ${p.expect})`)
}
console.log(bad ? `\n✗ ${bad} pair(s) disagree with §3.1` : '\n✓ all pairs match §3.1')
process.exit(bad ? 1 : 0)
```

### B.2 Layout (§4.1, §4.3)

```js
// Layout gate — bans 100vh, sub-16px inputs, sub-24px targets, hidden scrollbars,
// non-composited animations, and hover-only paths. Regex structural lint, not a parser:
// it catches the documented patterns in JSX/HTML and misses computed or dynamic styles.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, extname, relative } from 'node:path'
const root = process.argv[2] ?? 'src'
const SKIP = new Set(['node_modules','dist','build','.git','coverage','out','.next','.vite'])
const EXT = new Set(['.tsx','.jsx','.html','.css','.ts','.js'])
const out = []
function walk(dir) {
  for (const e of readdirSync(dir)) {
    if (SKIP.has(e)) continue
    const f = join(dir, e)
    if (statSync(f).isDirectory()) walk(f)
    else if (EXT.has(extname(e))) scan(f)
  }
}
function scan(file) {
  const isTest = /\.(test|spec)\.[tj]sx?$/.test(file)
  const lines = readFileSync(file, 'utf8').split('\n')
  lines.forEach((t, i) => {
    const hit = rule => out.push(`${relative(process.cwd(), file)}:${i+1}  [${rule}]\n    ${t.trim()}`)
    if (/\b100vh\b(?!-)/.test(t)) hit('§4.3 use 100svh (shells) or 100dvh (sheets), never 100vh')
    if (isTest) return
    if (/<input\b/.test(t) && /\btext-(sm|xs|\[1[0-5]px\])/.test(t)) hit('§2 input must be text-base (16px)+')
    const tgt = t.match(/\b(?:min-h|h|size)-\[(\d+)px\]/)
    if (/<(button|a|input|select)\b/.test(t) && tgt && Number(tgt[1]) < 24) hit(`§4.1 target ${tgt[1]}px is below the 24px floor`)
    const okTarget = /min-h-(\[44px\]|11|8)(?![\w[])/.test(t) || /(?:^|[\s"'{])h-(11|8)(?![\w[])/.test(t)  // §4.1 ladder
    if (/<button\b/.test(t) && !okTarget) hit('§4.1 button needs min-h-[44px] (default) or min-h-8 (dense desktop)')
    if (/transition-\[?(height|width|top|left|box-shadow)\b/.test(t)) hit('§3 animate transform/opacity/clip-path only')
    if (/scrollbar-width:\s*none|scrollbarWidth:\s*['"]none['"]/.test(t)) hit('§4.1 keep scrollbars visible')
    if (/::-webkit-scrollbar\b/.test(t) && /display:\s*none/.test(lines.slice(i, i+4).join(' '))) hit('§4.1 keep scrollbars visible')
    if (/\bhover:/.test(t) && !/focus/.test(t) && !/group-hover/.test(t)) hit('§4.1 hover needs a focus/focus-visible equivalent')
  })
}
walk(root)
if (!out.length) { console.log(`✓ layout gates passed (${root})`); process.exit(0) }
console.error(`✗ ${out.length} layout violation(s):\n` + out.join('\n'))
process.exit(1)
```

### B.3 Manifest (§4.4)

```js
// Manifest gate — every declared icon must exist on disk; maskable + standalone required.
import { readFileSync, existsSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
const mp = process.argv[2] ?? 'public/manifest.json'
const pub = resolve(process.argv[3] ?? join(dirname(mp), '..', 'public'))
const errs = []
if (!existsSync(mp)) { console.error(`✗ manifest not found: ${mp}`); process.exit(1) }
let m
try { m = JSON.parse(readFileSync(mp, 'utf8')) } catch (e) { console.error(`✗ invalid JSON: ${e.message}`); process.exit(1) }
if (m.display !== 'standalone') errs.push(`display must be "standalone" (found ${JSON.stringify(m.display)})`)
const icons = Array.isArray(m.icons) ? m.icons : []
if (!icons.length) errs.push('no icons declared')
const sizes = new Set()
for (const ic of icons) {
  if (!ic.src) { errs.push('icon entry with no src'); continue }
  const f = join(pub, ic.src.replace(/^\//, ''))
  if (!existsSync(f)) { errs.push(`missing icon file: ${ic.src}`); continue }
  if (statSync(f).size === 0) errs.push(`empty icon file: ${ic.src}`)
  if (ic.sizes) ic.sizes.split(/\s+/).forEach(x => sizes.add(x))
}
for (const req of ['192x192','512x512']) if (!sizes.has(req)) errs.push(`no icon declared at ${req}`)
if (!icons.some(i => String(i.purpose ?? '').includes('maskable'))) errs.push('no maskable icon (purpose: "maskable")')
const idx = join(pub, '..', 'index.html')
if (existsSync(idx)) {
  const html = readFileSync(idx, 'utf8')
  if (!/rel="apple-touch-icon"/.test(html)) errs.push('index.html has no <link rel="apple-touch-icon">')
  for (const mm of html.matchAll(/<link[^>]+rel="(?:apple-touch-icon|icon)"[^>]+href="([^"]+)"/g)) {
    const h = mm[1].replace(/^\//, '')
    if (!/^https?:/.test(h) && !existsSync(join(pub, h))) errs.push(`index.html references missing icon: ${mm[1]}`)
  }
}
if (errs.length) { console.error('✗ manifest violations:\n' + errs.map(e => '  - ' + e).join('\n')); process.exit(1) }
console.log(`✓ manifest passed (${icons.length} icons, standalone, maskable present)`)
```

---

## Appendix C — Design Intent & Taste (`[CRAFT]`)

The enforced rules are above. This appendix is the **taste** half: read it before writing UI, review it by eye. Nothing here is machine-verified and nothing here may be reported as "passed". Where this appendix and a numbered section disagree, the numbered section wins.

### The bar

Build to the pixel-level craft of **Linear, Superhuman, Vercel, Raycast, and Arc**. The test is not "does it look nice" but **"would this screenshot survive next to Linear without looking like a template?"**

Generic AI-built UI is identifiable from 50 feet away. The tells:

- A gradient blob, glow, or mesh behind the hero because the layout had nothing to say.
- A subtitle under every heading that restates the heading.
- A card wrapped in a card wrapped in a card, each with its own shadow and border.
- Three-column feature grids with a Lucide icon in a rounded square above each one.
- `text-sm` grey placeholder copy used in place of actual product language.
- Empty states that say "No data" instead of telling you what to do next.
- Everything the same visual weight, so nothing is the primary action.
- Spinners where a skeleton would preserve layout.
- Timings that snap: modals appearing instantly, toasts vanishing mid-read.

### Two surfaces, one product

PC and mobile are **equal peers** — neither is the primary target, and §4 governs the specifics for each. Compose on whichever surface you are working, then prove the same screen on the other without dropping a single action. A layout that only works when there is room is not a responsive design; it is a desktop screenshot with a media query bolted on. Equally, a layout that only works because there is no room is not "mobile-first", it is a desktop app on a diet.

### Non-negotiables of feel

- **Every element earns its pixels** by serving an immediate action or decision. If you can delete it and the user still completes their task, delete it.
- **One primary action per screen.** If two things look primary, neither is.
- **Hierarchy through contrast**, not size alone. Three weights — primary, secondary, tertiary — and no fourth.
- **Crisp hairline borders.** `1px`, no blur, no double borders. Elevation comes from borders and background steps before shadows.
- **Copy is UI.** Microcopy carries as much design weight as spacing. "Delete 4 items?" beats "Are you sure?".
- **Density is a feature.** Prefer more information with clear grouping over whitespace that hides the product.
- **Motion explains cause and effect** — where something came from, where it went. Motion that decorates is motion that slows the user down.
- **Nothing blocks the primary task** for an animation. Save first, animate second.
- **Numbers don't jitter** (`tabular-nums`).

### States are the product

A screen is not one design; it is five — loading, empty, error, disabled, success. Most AI builds ship only the success state. The empty state is where the product is judged, because it is the first thing a new user sees.

- **Empty:** Lucide icon, one-line explanation, one primary action.
- **Loading:** skeletons matching final layout dimensions, not spinners that collapse the page.
- **Error:** what failed, why (if knowable), and a retry — never a raw stack or a bare `Error`.
- **Success:** brief, non-blocking, undoable where destructive.

### Voice

- Sentence case. No ALL CAPS labels. No exclamation marks.
- Verbs for actions ("Save changes", not "Submit").
- Never blame the user ("That didn't save — check your connection", not "Invalid input").
- Never use words the user wouldn't: "entity", "record", "resource", "payload".

### Screen review checklist

1. Squint: is there exactly one obvious primary action?
2. Are any three elements at the same visual weight that shouldn't be?
3. Does every card/border/shadow justify itself, or is it a wrapper?
4. Load it with real data — does density hold, or does it break?
5. Load it with zero data — is the empty state a dead end?
6. Tab through it — does focus follow reading order, and is it visible?
7. Trigger an error — is there a way forward?
8. Watch it at both 1440px **and** 375px — anything overflowing, cramped, stretched, or clipped? Does the PC view use the space, or just inflate the mobile one? Does the mobile view keep every action, or quietly drop some?
9. Turn on Reduced Motion — anything still sliding?
10. Read the copy aloud — does it sound like a product or a prompt?

---

## Appendix D — Compliance Checklist

The ordered pass before reporting a change complete. A.1 items are commands; A.2 items are inspected and reported. Run them in this order and stop at the first failure.

1. **Types** — `npx tsc -b --noEmit` → exit 0. Never plain `tsc --noEmit`.
2. **Lint (non-type-aware)** — `npx oxlint --deny max-lines --max-warnings=0` → exit 0.
3. **Lint (type-aware)** — `npx oxlint --type-aware --max-warnings=0` or the ESLint equivalent → exit 0. If neither can run, report `not run` — do not skip silently.
4. **Build** — `npm run build` → exit 0.
5. **Tests** — `npx vitest run` → exit 0.
6. **Layout** — script B.2 → exit 0.
7. **Contrast** — script B.1 → exit 0.
8. **Manifest** — script B.3 → exit 0.
9. **Placeholders & secrets** — the two greps in A.1 → no matches.
10. **Bundle budget** — the A.1 budget command → under budget (only when the change touches bundle composition).
11. **Inspection pass (A.2)** — every item marked `pass`, `fail`, or `not run` with one line of evidence. At minimum: focus restore, `aria-live`, keyboard parity, breakpoint ladder, installed mode, repeat-firing lifecycle, and all five interaction states.
12. **Post-implementation pass (§8B)** — the four questions answered, each regression class you touched named or explicitly ruled out, and every new test proved to fail without its fix.
13. **`git status` / `git diff`** — only intended files (§10).
14. **Completion report** — the five headings from §11, with each command, its real exit code, and every `not run` named.

If any step did not run, say so in the report. An unreported skipped check is a fabricated pass (§7).

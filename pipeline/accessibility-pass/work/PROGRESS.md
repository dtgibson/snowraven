# Implementation progress — accessibility-pass (Stage 2, The Engineer)

Status as of 2026-06-12 ~19:40 PDT. Baseline: **774/774 frontend tests green**,
`tsc --noEmit` clean.

## DONE (on disk, tested)

- **Tokens (globals.css)** — complete, reported, manifest at `work/tokens-manifest.md`.
  128 contrast checks pass. Fully resolves F103, F059, F043, F077, F063; partials
  (new tokens minted, awaiting component wiring) for F017, F066, F003, F004, F018,
  F031, F100, F104, F069, F006, F028, F052, F072.
- **map-explorer group (MapExplorer.tsx, +307 lines)** — the fixer agent completed
  its edits on disk before the limit killed its report. Verified present in the diff:
  filter select/date `aria-label`s (F001), `role="alert"` errors (F010), the focus-trap
  rebuild + fullscreen Escape/restore (F011), kind-legend `aria-pressed` (F008 instance),
  Nearest Targets list, accordion `aria-expanded` + grid/inert clamp (F069/F090),
  lat/lng `aria-label`s. Treat map-explorer as DONE pending the completion check.
- **Filter aria-label sweep (manual, this session)** — `aria-label` added to the
  County select + From/To date inputs in **SpeciesDetail.tsx, LifeList.tsx,
  BreedingCodeList.tsx** (resolves F015, F016, and the LifeList/BreedingCode instances
  of F007/F057). Map Explorer's were already done by its agent.

## REMAINING (for the fleet at weekly-limit reset, 11pm PDT)

Six groups, no edits yet beyond the aria-labels above:
- **maps-shared** — SegControl `aria-pressed` (F008), Media Targets keyboard (F009),
  DOM markers as buttons (F014), map target text colors (F018), popup Escape/close,
  border-input token (F104), rotate/pitch gesture (F105), attribution target (F094).
- **species** — combobox Escape focus return (F029/F084), chevron span (F073), favicon
  names/targets (F067/F075), per-coord checklist links (F014 alt), tier pill `-fg` (F003).
- **stats** — aria-hidden focusable SVG (F002), jump-link focus (F023), named ↗ links
  (F053), milestone + rank-pin token wiring (F031/F100), fixed-px text (F061/F089),
  tooltip hoverability (F-gap), hue-only series (F078).
- **settings-help** — Settings keyboard reorder buttons (F013), drag-handle aria (F017-axe),
  radio-group arrow keys (F037/F083), text-disabled→muted (F012), Help focus restore +
  TOC collapse classNames (F006/F027/F065), WelcomeScreen focus (F021), DropZone (F050/F066-min).
- **lifelist-breeding** — sortable th→buttons + aria-sort (F032), row-header (F081),
  tier text (F003), no-media icon (F080), filter-count live region (F010-gap),
  empty-state message (F011-gap), breeding-code hover meanings (F001-gap).
- **checklists-comparers** — badge contrast tokens (F004/F005), badge state semantics
  (F039/F052), tablist→group (F071), one-shot button focus (F028), placeholder labels (F057),
  consistent eBird-link id (F003-gap), comparer reflow className (F052), moon-emoji (F082, byte-parity trio).
- **app-shell** — landmarks/header/nav (F040/structure), skip-link anchor + #sr-main (F069),
  per-view document.title + Tauri setTitle (F-structure), live-region fixes (F034/F035),
  update-check timing (F005-gap/F007-gap), heading outline.
- **docs** — ACCESSIBILITY.md made true, CHANGELOG 0.5.31, version bump, README/HELP.

Plan: fresh scoped Workflow at reset (tokens + map-explorer excluded — already done;
agents read current code so the aria-labels already in place are skipped), with the same
disjoint-ownership + integration-gate + completion-check + docs structure.

## Post-fleet autonomous catch (2026-06-12 ~21:50 PDT)

While verifying the fleet's output, found a false published claim + a real residual
AA failure that slipped the completion check:

- **F032 / ACCESSIBILITY.md accuracy.** The "complete checklists" meter
  (BirdingStats.tsx ~1138) is the ONE in-bar percentage label left in the app. It
  used `--sr-on-accent`, whose dark value (#052E16) is only **4.05:1** on the
  dark-theme blue fill (#3B82F6) — below AA for the 11px label. Yet the docs agent
  had written ACCESSIBILITY.md to claim bars "no longer print percentage figures
  inside their saturated fills." Both were wrong.
- **Fix:** new theme-aware token `--sr-on-chart-blue-dark` (#FFFFFF light = 6.70 on
  #1D4ED8; #0A0A0A dark = 5.38 on #3B82F6 — the fill needs opposite text colors per
  theme, so a single value couldn't pass). Swapped the label to it. Reworded the
  ACCESSIBILITY.md sentence to describe the actual behavior accurately.
- Verified: both ratios computed ≥4.5; tsc clean; 857/857 frontend green.

Confirmed this is the only on-fill chart label (donut centers sit in the hole over
the surface; all BarRow labels are adjacent).

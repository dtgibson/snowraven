# Change Brief — mobile-responsive-sweep

## What is changing

Make every screen flow and read well from ~320px-wide phones up to large
(≥1440px) desktops, with no overlapping or sideways-scrolling content. The app
today is styled almost entirely with inline styles and has a single
`@media (max-width: 640px)` block reaching only five class names — so 119 audit
findings (19 hard overlaps/overflows, 37 medium, 63 polish) collapse into ~8
recurring defect families. We fix them by **extending** the existing class-hook
pattern, not rewriting inline styles: add a small shared class vocabulary
(`.sr-action-row`, self-collapsing `.sr-grid-auto`, `.sr-grid-2/-3`, a
`.sr-container` max-width cap), add breakpoint tiers (~480 small-phone, keep
640, ~1024 tablet, ≥1440 desktop cap), migrate the offending containers to
those hooks, add `min-width:0`/ellipsis on leaf text spans, give the two
crushing Stats tables the existing `width:max-content` scroll pattern, let the
native date-input groups wrap, add an `overflow-x` page backstop, and tidy
chart/iframe heights to aspect-ratios. Scope is **exhaustive** (high + medium +
all 63 low polish). Also delete the dead `index.css` and `App.css` (only
`globals.css` is imported — confirmed).

## Why now

Preparing to launch the mobile app, which builds on this same frontend. The user
confirmed real overlaps on a phone (the Pi web build) — most likely the Map
Explorer's four-pill mode bar and the space-between rows that can't wrap.

## User-facing impact

No new behavior, data, or copy — same screens, same flows. Layouts reflow and
stop overlapping; phones become usable and desktops gain a sensible max width.
Must hold at the in-app text-size scale up to 200%.

## Decisions touched

Extends (never reverses) these `DECISIONS.md` entries — the Chronicler logs that
the responsive system was generalized:
- Responsive nav: dropdown + overflow-driven collapse (2026-05-27) — keep the
  ResizeObserver mechanism; only cap the dropdown height. No JS window/resize
  checks added.
- Map Explorer mobile overlay + the v0.1.1 specificity rule (never put `display`
  on a class-toggled element); preserve z-index 1200.
- Table `wideMode` / `width:max-content` pattern — reuse it for the Stats tables,
  don't refactor the existing tables.
- In-app text-size scale — fixes must hold at 200%; do not convert rem→px.

## What done looks like

At 320px and 360px (and 360px @ 200% text-scale), every tab scrolls with no
sideways page scroll, no clipped content inside `overflow:hidden` cards, and no
overlapping rows; large desktops show a capped, balanced layout. Full CI mirror
(lint + typecheck + test + build) green. Regression guards intact: map overlay
display-toggle/z-index, focus traps, the `wideMode` tables. Detail and the
per-screen fix list live in `responsive-audit.md`.

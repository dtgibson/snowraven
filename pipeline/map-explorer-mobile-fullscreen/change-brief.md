# Change Brief — Map Explorer Mobile Fullscreen Toggle

**Lane:** Improve
**Date:** 2026-06-02

## Problem
On small/mobile screens, the app's marketing header (bird logo +
"SnowRaven" + tagline) plus the tab dropdown and mode tabs consume
roughly the top third of the viewport, leaving little room for the
Map Explorer's map. (See Dave's screenshot: iPhone, Hotspots mode —
the map starts well below the fold of useful chrome.)

## Goal
Let the Map Explorer occupy the **full viewport** on small screens via
an explicit, reversible **fullscreen toggle**, without changing any
other tab. (Chosen over auto-hide at the Stage 1 gate: true
full-screen, predictable, robust against mobile browser-toolbar height
quirks.)

## Approach (for the Engineer to confirm)

**State — lifted to `App.tsx`.**
- New `mapFullscreen` boolean state in `App.tsx`.
- The Map Explorer `tabpanel` wrapper (currently
  `height: calc(100vh - 178px)`) switches to a fixed overlay when
  `mapFullscreen` is true:
  `position: fixed; inset: 0; width: 100vw; height: 100dvh; z-index: 1200; background: var(--sr-bg)`
  — covering the header, TabNav, and mode tabs. `100dvh` (dynamic
  viewport height) handles the Safari/Chrome mobile toolbar.
- While fullscreen, set `document.body` overflow hidden (effect),
  restore on exit.
- Pass `isFullscreen={mapFullscreen}` and
  `onToggleFullscreen={() => setMapFullscreen(v => !v)}` to
  `MapExplorer`.

**Control — in `MapExplorer.tsx`, next to Filters.**
- A new floating icon button, paired with the existing mobile-only
  `.sr-map-filters-btn` (which is `bottom: 20px; right: 16px`). Place
  the toggle just left of it (e.g. `right: 64px`), as a 36px circular
  button. `Maximize2` icon to enter, `Minimize2` to exit
  (lucide-react). `aria-label` "Enter/Exit fullscreen", `aria-pressed`,
  `tabIndex={0}` (per the WKWebView tab-order convention in CLAUDE.md).
- New CSS class `.sr-map-fullscreen-btn`: `display: none` by default,
  `display: flex` inside the existing `@media (max-width: 640px)` block
  — so it appears only on small screens, exactly like the Filters
  button. Themed via `var(--sr-*)` tokens.
- Visibility mirrors Filters: shown when the filter sidebar is closed
  (`!sidebarOpen`). The minimize affordance is therefore always
  reachable on mobile (close the sidebar → button reappears).

**Leaflet resize gotcha.**
- Toggling fullscreen changes the map container's size. Leaflet must
  `map.invalidateSize()` after the change or tiles render greyed/clipped.
  Reuse the existing `AutoSizeMap` pattern, or add a small effect child
  that calls `invalidateSize()` when `isFullscreen` changes (next paint).

## Acceptance
- On a ≤640px screen, a fullscreen (maximize) button appears next to
  Filters in the Map Explorer (all three modes).
- Tapping it makes the map fill the entire viewport — app header, tab
  dropdown, and mode tabs hidden; map + zoom controls + Filters + a
  minimize button remain usable.
- Tapping minimize restores the normal layout.
- Map tiles fill correctly on both enter and exit (no grey/clipped
  area) — `invalidateSize` fires.
- The button does **not** appear above 640px; other tabs are visually
  and behaviorally unchanged.
- Works in light and dark themes; button is keyboard-focusable.

## Out of scope
- Auto fullscreen on mobile (the rejected alternative).
- Desktop fullscreen (the control is mobile-only by design).
- The browser's own Fullscreen API (`requestFullscreen`) — we use a
  CSS overlay, which is more reliable in WKWebView / iOS Safari.
- Any change to the other tabs.

## Notes / decisions touched
- Reuses the existing 640px mobile breakpoint and the floating-button
  pattern (`.sr-map-filters-btn`). No new dependency. No backend, no
  privacy impact.
- z-index 1200 follows the CLAUDE.md "overlays over a map" convention.

## Feature Check
A responsive-layout refinement of an existing tab — no new product
capability or surface beyond one toggle that re-flows existing content.
**Stays in the Improve lane.**

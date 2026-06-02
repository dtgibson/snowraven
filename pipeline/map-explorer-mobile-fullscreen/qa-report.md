# QA Report — Map Explorer Mobile Fullscreen Toggle

**Date:** 2026-06-02
**Lane:** Improve
**Result:** PASSED

## Automated checks
- TypeScript (`tsc --noEmit`): clean
- ESLint: **0 problems**
- Frontend build (`vite build`): clean
- Unit tests (vitest): **266 passing / 0 failing** (15 files)

## Acceptance
| ID | Check | Result |
|---|---|---|
| F-1 | Fullscreen (maximize) button appears next to Filters on ≤640px screens | ✓ (live, multiple device sizes) |
| F-2 | Button hidden above 640px; other tabs unchanged | ✓ — cluster is `display:none` until the 640px media query |
| F-3 | Tapping it makes the map fill the whole viewport (header, tab dropdown, mode tabs hidden) | ✓ — panel becomes `position:fixed; inset:0; height:100dvh; z-index:1200` |
| F-4 | Minimize restores the normal layout | ✓ |
| F-5 | Map tiles fill correctly on enter/exit (no clipped/blank area) | ✓ — existing `AutoSizeMap` ResizeObserver invalidates size |
| F-6 | Button does not overlap Filters at any label width | ✓ (fixed) — flex cluster `.sr-map-fab-cluster`, 10px gap, fullscreen left of Filters |
| F-7 | Uncovered map area reads as ocean, not grey | ✓ (fixed) — `.leaflet-container.leaflet-container` background = `--sr-map-void` (#AAD3DF) |
| F-8 | Keyboard focusable; aria-pressed reflects state | ✓ — `tabIndex={0}`, `aria-label` Enter/Exit, `aria-pressed` |
| F-9 | Background scroll locked while fullscreen; cleared on exit/leave | ✓ — body overflow effect guarded on `mapFullscreen && activeTab==='map-explorer'` |
| F-10 | In-map navigation (Go to Settings / target species) exits fullscreen | ✓ — both callbacks clear `mapFullscreen` |

## Feedback rounds (resolved live, confirmed by Dave)
1. **Button overlapped Filters** → replaced fixed `right:64px` with a flex cluster so the two buttons lay out side-by-side regardless of width.
2. **Grey backdrop persisted** → root cause was CSS cascade order (Leaflet's `.leaflet-container{background:#ddd}` loads after globals.css, tied on specificity). Fixed by doubling the class (`.leaflet-container.leaflet-container`, specificity 0,2,0 > 0,1,0). Backdrop now the OSM ocean tone.

## Regression
- Full suite green (266). Changes are additive (new state/prop/button + CSS); the map-panel style only differs when `mapFullscreen` is true. Other tabs and the desktop layout are untouched (controls gated behind the 640px breakpoint).

## Notes / limitations
- Control is mobile-only by design (≤640px). Desktop has no fullscreen entry (and needs none).
- Uses a CSS overlay (not the browser Fullscreen API) — more reliable in iOS Safari / WKWebView; `100dvh` handles the mobile browser toolbar.

## Convention flags (for The Chronicler)
- New `--sr-map-void` token + `.leaflet-container` backdrop — note the cascade-order gotcha (third-party Leaflet CSS loads after globals.css; raise specificity, don't rely on order) in CLAUDE.md.
- New mobile floating-control cluster pattern `.sr-map-fab-cluster`.

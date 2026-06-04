# QA Report — Keyless Basemap Upgrade + Layer Switcher

**Date:** 2026-06-03
**Lane:** Improve
**Result:** PASSED

## Automated checks
- TypeScript (`tsc --noEmit`): clean
- ESLint: **0 problems**
- Frontend build (`vite build`): clean
- Unit tests (vitest): **266 passing / 0 failing**

## Acceptance
| ID | Check | Result |
|---|---|---|
| B-1 | No map loads `tile.openstreetmap.org` | ✓ — all three maps use `<MapBaseLayers>`; grep-clean |
| B-2 | CARTO Positron is the default base everywhere | ✓ — `DEFAULT_BASE='positron'`; Stats uses it (no switcher) |
| B-3 | Switcher on Map Explorer + Species Detail: Map/Satellite/Topo + Trails | ✓ (live) — brand-styled control, top-right |
| B-4 | Correct per-layer attribution | ✓ — each layer carries its own `attribution` |
| B-5 | Esri/USGS use `{z}/{y}/{x}`; CARTO/Waymarked `{z}/{x}/{y}` | ✓ — verified in `lib/basemaps.ts` |
| B-6 | Tiles align + fill; void backdrop matches active base | ✓ (live) — Positron light void; Satellite dark void |
| B-7 | Selection persists across sessions | ✓ (live) — base + trails via storage seam |
| B-8 | Heatmap, atlas blocks, pins, popups, fullscreen still work | ✓ (live) — layers unchanged; base swap only |
| B-9 | Labels legible (Positron native, crisp @2x) | ✓ — Dave chose Positron native after comparing 2x and Voyager |
| B-10 | Light/dark themes; keyboard-focusable control; mobile (control top-right) | ✓ |

## Iteration log (resolved live with Dave)
1. Positron labels "a touch small" → tried 512px @2x + zoomOffset −1 (bigger).
2. That read "too big" → tried CARTO Voyager (naturally medium labels).
3. Dave preferred the original Positron look → reverted to Positron native (@2x, tileSize 256). Final.
   - Established constraint: raster label size is effectively binary (native vs 2×); a true in-between needs a different style (Voyager) or vector tiles (deferred).

## Docs / privacy
- HELP.md + README document the switcher.
- PRIVACY_POLICY.md adds a "Map Tiles" section disclosing CARTO/Esri/USGS/Waymarked (closed a pre-existing gap that omitted even OSM tiles); effective date bumped.

## Regression
- Full suite green (266). Change is the basemap layer + a new shared component; other map layers untouched.

## Known limitations / honest flags
- "Keyless" ≠ contractually unlimited (CARTO, Esri are keyless in practice; prefer an account at high volume) — accepted per the no-key rule.
- USGS Topo is US-only (blank elsewhere) — labeled "(US)".
- Vector basemap (MapLibre + OpenFreeMap) deferred — the only path to custom label sizing on a minimal style.

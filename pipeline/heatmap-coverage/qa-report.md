# QA Report — heatmap-coverage

**Date:** 2026-06-01
**Test Runner:** vitest
**Result:** PASSED

## Test Suite Results
257 tests passing, 0 failing (14 files). TypeScript + ESLint clean, production build clean.

## Verification Against Change Brief

| Item | Result | Notes |
|---|---|---|
| Heatmap covers more area / shows density | ✓ Pass | Default footprint radius 40 (vs old 25); neighboring sightings merge. Verified live. |
| Intensity slider (heatmap mode only) | ✓ Pass | Range 1–10 in My Sightings panel; hidden in Pins mode; keyboard-operable; accent-themed. |
| Slider changes spread live | ✓ Pass | radius/blur/max/weight re-applied on change; verified live. |
| Sparse low-count areas read strong at max | ✓ Pass | Per-point weight divisor 20→2 with intensity; single-obs pins warm at max. Verified live. |
| No rendering artifacts | ✓ Pass | Earlier triangular banding (radius 95 / max 0.5) resolved by bounding radius 80, blur 0.5×, max floor 0.75. Verified live (water area clean at max). |
| Default unchanged from approved "good step" | ✓ Pass | Intensity 5 → radius 40 (sanity-checked). |
| Pins mode + other map modes unchanged | ✓ Pass | Change is contained to the heatmap path; full suite green. |

## Heat curve sanity (automated)
- radius monotonic increasing across 1–10; default (5) = 40; top (10) = 80 / blur 40 / max 0.75 / weight divisor 2.

## Regression Checks
- Full suite green (257). No shared logic changed; pins, hotspots, media targets, atlas overlay untouched. No new dependency.

## Known Limitations
- `leaflet.heat` radius is in screen pixels, so the same intensity reads differently across zoom — which is exactly why the slider exists (lets the user compensate).

## Convention Flags
- None (the leaflet.heat artifact note is captured in the PR).

# QA Report — Atlas Shade by Breeding Code

**Date:** 2026-06-01
**Test Runner:** vitest
**Result:** PASSED

## Test Suite Results
266 tests passing, 0 failing (15 files; +9 for the spatial join). TypeScript + ESLint clean, production build clean.

## Acceptance Criteria Verification

| ID | Result | Notes |
|---|---|---|
| QA-01 toggle gated on atlas | ✓ Pass | Shade toggle only shows when atlas on; default off; shade resets when atlas turned off. |
| QA-02 personal-data copy | ✓ Pass | Label "Shade by My Highest Breeding Code" + caption "Based only on breeding codes you've personally entered." |
| QA-03 no-backup handling | ✓ Pass | Toggle disabled with "Load your eBird backup in Settings" when `phase` not ready. |
| QA-04 highest tier per block | ✓ Pass (unit + live) | `buildBreedingByBlock` keeps strongest code by rank; `pointToBlockCode` lands point in correct block. Unit-tested. |
| QA-05 only recorded blocks shaded | ✓ Pass | Map only includes blocks with ≥1 personal record; others outline-only. |
| QA-06 tier-colored translucent fill | ✓ Pass (live) | `--sr-tier-N` purples; light/dark via tokens; tuned for base-map readability. |
| QA-07 interiors clickable | ✓ Pass | Shaded blocks use a real fill → clickable; popup opens. |
| QA-08 popup detail | ✓ Pass | "Highest breeding code: {label} ({code})" + "{N} of your breeding records (any level) in this block". |
| QA-09 toggle off removes shading | ✓ Pass | Shade off → outline-only; atlas off → no overlay. |
| QA-10 performance | ✓ Pass (live) | Smooth at the raised cap (5000) per live check; one-pass join. |
| QA-11 no regression | ✓ Pass | Pins, hotspots, media targets, breeding-codes tab unchanged; full suite green. |
| QA-12 colorblind / non-color | ✓ Pass | "Use Textures" adds per-tier hatch (sparse dots → dense cross-hatch), distinguishable in grayscale; off by default per Dave's call. |

## Added scope (verified live)
- **Use Textures toggle** (off by default): flat tier color vs. hatch patterns; legend follows mode.
- **Overlay controls in all three sidebars** (My Sightings / Hotspots / Media Targets) — single shared `atlasOverlayControls`, state shared, layer renders in every mode.
- **Readability tuning + zoom cap 400→5000** — confirmed legible over OSM labels and smooth at the higher extent.

## Regression Checks
- Full suite green (266). No shared logic altered beyond the additive overlay; other map modes and tabs unchanged.

## Known Limitations
- Atlas is California-only by data (intended). Live shading needs CA breeding records in the backup.
- Very low zoom still hits the cap → "zoom in" hint (by design; ~3 mi blocks become illegible noise beyond that).

## Convention Flags
- Texture-pattern fills for Leaflet vector layers via injected `<defs>` + `fill: url(#id)` CSS class.

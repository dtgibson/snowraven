# QA Report — Map Atlas Blocks & Nearest Hotspots

**Date:** 2026-05-29
**Test Runner:** vitest
**Result:** PASSED

## Test Suite Results
257 tests passing, 0 failing (14 files; +11 for `atlasBlocks`). TypeScript build clean, ESLint clean, production build clean. The atlas data asset code-splits into its own lazy chunk (160 KB raw / 34 KB gzip) — initial bundle unaffected.

## Data Integrity (atlas blocks)
- **Exact 1:1 fidelity:** regenerating every block from the bundled gazetteer yields **16,527** block codes that match the official KML's set exactly — 0 generated-not-official, 0 official-not-generated. Generation is faithful, not approximate.
- 2,878 quads, 232 partial edge quads (correctly carry only their present positions), 0 irregular, 0 missing quad ids.
- Spot-checked geometry reproduces a known block exactly (Farallon Islands Oe N SW).

## Acceptance Criteria Verification

| ID | Result | Notes |
|---|---|---|
| QA-01 toggle shows/hides (default off) | ✓ Pass | Verified live. |
| QA-02 viewport render + update | ✓ Pass | Verified live; `blocksInBounds` unit-tested. |
| QA-03 local/offline data | ✓ Pass | Bundled lazy chunk; no runtime third-party fetch. |
| QA-04 lazy load | ✓ Pass | Separate chunk confirmed in build; loads on first enable. |
| QA-05 block name on click | ✓ Pass | Interior clickable (transparent fill); popup shows name. |
| QA-06 scale / out-of-area | ✓ Pass | "Zoom in" pill when over cap; nothing outside CA; `blocksInBounds` tooMany unit-tested. |
| QA-07 visual distinctness | ✓ Pass | Slate outline, transparent fill — pins not obscured; light/dark verified. |
| QA-08 nearest-10 unvisited list | ✓ Pass | Below legend (per final placement); name + distance. |
| QA-09 row links | ✓ Pass | Rows link to eBird hotspot pages (new tab). |
| QA-10 recompute / empty | ✓ Pass | Memo recomputes on search/center; section absent when empty. |
| QA-11 accessibility | ✓ Pass | Toggle `role="switch"`/`aria-checked`/`tabIndex`; rows are anchors; tokens; light/dark. |
| (added) block → eBird link | ✓ Pass | Popup name links to `https://ebird.org/atlascalifornia/block/<code>`; codes verified 1:1 with KML. |

## Regression Checks
- Full suite green (257). Existing map modes (My Sightings, Media Targets) untouched; nearest-unvisited reuses the proven `distanceMiles`/`panTarget` pieces without altering them.

## Known Limitations
- Atlas overlay is California-only by data (intended). Coverage/effort tracking out of scope.

## Convention Flags
- Outline-only Leaflet polygons need a transparent fill (`fillOpacity: 0`) for interior click hit-testing — not `pointer-events` overrides (Leaflet's interactive-path CSS wins on specificity).

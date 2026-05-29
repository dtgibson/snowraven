# QA Report — docs-ml-export-and-ordering

**Date:** 2026-05-29
**Test Runner:** vitest
**Result:** PASSED

## Test Suite Results
246 tests passing, 0 failing. Frontend production build clean (HELP.md bundles via `?raw` at build time — confirmed it still compiles).

## Verification Against Change Brief

| Item | Result | Notes |
|---|---|---|
| ML export: "All" media filter stated | ✓ Pass | HELP.md: "Set the media-type filter to **All** rather than Birds…" |
| ML export: leave filename unchanged + reason | ✓ Pass | HELP.md explains the user ID is read from the filename for personalized links; README echoes it briefly. |
| README echo of the guidance | ✓ Pass | Media List "How it works" step 1 updated, links to HELP. |
| HELP per-tab order matches default tab order | ✓ Pass | Weather → Species Detail → Statistics → Map Explorer → Media List → Breeding Codes → Life List Comparer → Settings. |
| README Tools order matches default tab order | ✓ Pass | Same order confirmed. |
| Docs completeness | ✓ Pass | Two gaps found and fixed: HELP Tab Layout now notes the responsive dropdown; HELP Map Explorer location text now covers macOS + Windows + web (was macOS-only). |
| No code/behavior change | ✓ Pass | Only README.md and docs/HELP.md content changed. |

## Regression Checks
- Full suite green (246). No source changes, so no functional regression surface.
- HELP content still imports/bundles (`?raw`) — build clean.
- Accuracy: the filename guidance matches `parseMLUserId` in `LifeList.tsx` (expects `ML__..._<userid>.csv`).

## Known Limitations
- None. Documentation-only change.

## Convention Flags
- None.

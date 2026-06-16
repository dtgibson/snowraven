# QA Report — mobile-responsive-sweep

**Date:** 2026-06-16
**Test Runner:** vitest
**Result:** PASSED WITH NOTES

## Test Suite Results

932 tests passing, 0 failing (75 files). Lint clean, typecheck clean,
production build (`tsc -b && vite build`) succeeds — the full CI mirror.

## Acceptance Criteria Verification

Verified by driving the running app with Playwright across all ten tabs at
desktop (1440px), phone (360px) and the strict small-phone width (320px), and
measuring real horizontal page-scroll (`window.scrollX`).

| Criterion | Result | Notes |
|---|---|---|
| No horizontal page scroll at 320px (every tab) | ✓ Pass | All 10 tabs `scrollX = 0` |
| No horizontal page scroll at 360px (every tab) | ✓ Pass | All 10 tabs `scrollX = 0` |
| No overlapping rows on a phone | ✓ Pass | Map mode pills wrap 2×2; Settings/filter/comparer rows wrap or stack |
| Wide tables scroll within a box, not the page | ✓ Pass | Breeding matrix + Stats tables contained; sr-only-span escape fixed |
| Large desktop capped, not stretched | ✓ Pass | `.sr-panel` max-width 1280, centered |
| Holds at 200% in-app text scale | ⚠ Partial | 9/10 tabs clean at 360px@200%. Statistics keeps ~34px residual scroll at 360px@200% (more at 320px) — see Known Limitations |

## Edge Cases Tested

- 320px (smallest common phone) in addition to 360px.
- 200% in-app text scale (`--sr-text-scale: 2`) across all tabs — the audit's
  top coverage gap; surfaced and fixed two real overflows (BarRow value labels,
  table `.sr-scroll-x` containment) before the residual below.
- Map Explorer fullscreen overlay, the collapsed nav dropdown, the breeding-code
  matrix horizontal scroll, the Rainbow Warrior long-location truncation.

## Known Limitations

- **Statistics at 200% text scale** still scrolls the page ~34px at 360px
  (~73px at 320px). The cause is the dense filter-pill rows (e.g. the breeding
  tier filter): a nested `flex-wrap` group whose pills don't re-wrap once the
  text is doubled. It affects only the Statistics tab, only at the 200% text
  setting, and the content stays readable. At normal text size every screen is
  clean. Fixing it cleanly means reworking those pill rows' layout (risking the
  normal-scale appearance), so it's flagged for a decision rather than forced.

## Regression Check

No regressions. The 932-test suite (incl. 19 map tests, TabNav, charts) passes.
The documented guards hold: the map sidebar stays class-driven (no inline
`display`), overlay z-index 1200 preserved, the `wideMode`/`max-content` tables
were not refactored, focus traps untouched, and all sizing stays rem-based
(no rem→px), so the text-scale itself keeps working.

# QA Report — milestone-badge-dark-contrast

**Date:** 2026-06-18
**Test Runner:** vitest
**Result:** PASSED

## Test Suite Results
1006 tests passing across 81 files, 0 failing. This includes 28 new assertions in
`frontend/src/lib/milestoneContrast.test.ts` (4 tiers × 7 contrast checks) that parse the real
`[data-theme="dark"]` `--sr-milestone-*` tokens out of `globals.css` and assert WCAG 2.1 AA
against both gradient stops.

## Bug Repro Verification (from bug-brief.md)
| Repro / acceptance | Result | Notes |
|---|---|---|
| Dark mode, Statistics → Firsts & Milestones badges legible | ✓ Pass | Dark tiles; number, name, date, and ✓ all AA-legible (contrast test + a screenshot rendered from the built CSS) |
| Species name no longer near-white-on-near-white | ✓ Pass | Name (`--sr-text`) ≥10:1 on every tier's tile |
| Frivolous Lists "Complete!" badge legible | ✓ Pass | Shares tier-1 tokens; fixed in the same change |
| Light mode unchanged | ✓ Pass | `:root` tokens untouched; light screenshot matches prior look |

## Regression Check
- Full frontend suite green (1006/1006); the pre-existing 978 all still pass alongside the 28 new.
- Change surface (git diff) is CSS tokens + one new test file only — no component or logic code
  touched, so there is no behavioral regression path.
- Backend untouched (no `.py` changed); its 110 pytest cases are unaffected by a CSS-token change.
- Production build green; entry chunk ~218 KB unchanged; `vendor-maplibre` stays isolated off first paint.

## Edge Cases Tested
- All four tiers (50/100/500/1000 thresholds → tiers 1–4), not just one.
- Both gradient stops checked per tile (worst-case for light text).
- Linked vs plain name, plus the link hover/focus accent state, all ≥4.5:1.
- The white ✓ glyph on its check fill, and the check fill vs both the tile and the card surface.

## Known Limitations
None. The new contrast test guards against a future re-copy of the near-white light tiles into
the dark theme (the original failure mode).

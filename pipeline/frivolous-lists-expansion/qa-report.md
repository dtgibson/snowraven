# QA Report — frivolous-lists-expansion

**Date:** 2026-06-16
**Test Runner:** vitest
**Result:** PASSED

## Test Suite Results
947 tests passing, 0 failing (75 files). Full CI mirror green: `eslint .`, `tsc --noEmit`,
and the production build (`tsc -b && vite build`). Six new unit tests cover the new compute:
the three flat lists (recorded/total/complete), the grouped aggregation (whole-list count
across sub-groups, group order preserved), the corrected names matching within their
sub-group, the Best-of-the-Crest total/group count, and a species shared by two lists.

## Acceptance Criteria Verification (from change-brief "What done looks like")

| Criterion | Result | Notes |
|---|---|---|
| Five new lists render (3 flat + 2 grouped with sub-headers + one whole-list badge) | ✓ Pass | Rendered via NameList / new GroupedNameList; user-confirmed live over Tailscale |
| Recorded counts match the user's data | ✓ Pass | Compute reuses the recorded set + normalizeSpeciesName (unit-tested) |
| Unseen rows get favicons | ✓ Pass | BirdingStats taxonomy batch extended (flat + grouped flattened) |
| Names are current canonical eBird (3 corrections applied) | ✓ Pass | **Data-fidelity audit: every name matches the verified list; Western Cattle-Egret / Black-crowned Night Heron / Yellow-crowned Night Heron present, old forms absent; counts 3/4/6/12/38** |
| New flat + grouped compute unit-tested; existing tests stay green | ✓ Pass | 6 new tests; full suite green |
| Lint, typecheck, build green | ✓ Pass | All green |

## Adversarial verification (review → independent refute)
- **Data fidelity — clean.** A name-by-name diff of the implemented arrays against the
  canonical list found no discrepancies (the highest-leverage risk for this change, since
  a typo silently never ticks and tests don't cover all ~50 names).
- **A11y / refactor regression — one minor, fixed.** The NameList→NameItems/ListHead
  refactor preserved the flat-list rendering (check circle, sr-only recorded cue, BirdName
  props, list semantics); colors are tokens-only. One confirmed finding: a stale module
  header comment ("three … collections") — **fixed** (now "eight"). One finding dismissed
  on verification: the `#fff` check-icon color is pre-existing and intentional (white on the
  milestone-green fill, AA, theme-invariant by design).

## Known Limitations
- The grouped lists' sub-category labels are styled `<p>` headers over each `<ul>` grid
  (matching the section's existing label style); the review judged the visual `<p>`+`<ul>`
  acceptable. Not a defect — noted for future a11y passes if richer grouping semantics are
  ever wanted.

## Convention Flags
None.

# QA Report — media-sex-age-filters

**Date:** 2026-06-13
**Test Runner:** vitest (frontend) + pytest (backend)
**Result:** PASSED

## Test Suite Results
- **Frontend:** 877 passing, 0 failing (70 files; +8 from the new `assetMatchesFacet` / `buildCatalogAgeSex` / facet-link tests).
- **Backend:** 110 passing, 0 failing (unaffected — frontend-only feature).
- `npm run lint`, `npm run typecheck`, and the production build all clean.

## Acceptance Criteria Verification (PRD QA table)
| ID | Result | Notes |
|---|---|---|
| QA-01 Sex filter present | ✓ Pass | `LifeList.tsx` Sex select (Any sex / Male / Female), aria-label "Sex" |
| QA-02 Age filter present | ✓ Pass | Age select (Any age / Juvenile / Immature / Adult), aria-label "Age" |
| QA-03 Single-sex broad | ✓ Pass | `assetMatchesFacet` test — adult-only female still matches Female |
| QA-04 Single-age broad | ✓ Pass | test — "Juvenile Male" matches Juvenile |
| QA-05 Exact-combo | ✓ Pass | test — "Adult Female; Juvenile Male" fails Juvenile+Female; "Juvenile Female" passes |
| QA-06 Composes w/ media filter | ✓ Pass | facet projection feeds the existing media-pill filter; verified live |
| QA-07 Counts reflect filter | ✓ Pass | projected catalogIds drive the per-type counts; verified live |
| QA-08 Species list reflects filter | ✓ Pass | `facetEntries` drops zero-match species; "X of N" updates; verified live |
| QA-09 Untagged excluded | ✓ Pass | `assetMatchesFacet` test — empty / Unknown never matches a facet |
| QA-10 Links carry filter | ✓ Pass | `LifeListTable` test — href includes `age=`/`sex=`; live click confirms ML scoping |
| QA-11 Graceful link | ✓ Pass | test — params omitted when no facet; plain species/media-type catalog link |
| QA-12 Accessible controls | ✓ Pass | aria-labels + keyboard operable; a11y review confirmed |

## Adversarial Review
Three reviewers (correctness / accessibility / completeness), each finding refute-by-default verified. **8 raw → 1 confirmed.**
- **Correctness:** clean. The `facetEntries` projection makes every count/filter/sort facet-aware through the existing code; the no-facet path returns `displayEntries` unchanged (regression-safe); the "X of N species" denominator stays the full universe; exact-combo matches the spec.
- **Accessibility:** clean. Both selects have accessible names, keyboard operation, accent active state, and match the County pattern.
- **Completeness:** one finding (below). `mediaMap` and `catalogAgeSex` align by catalog id across all entry-build paths; untagged handled correctly.

**Confirmed (deferred to The Chronicler, Step 9 — docs/records, by design):**
- `docs/HELP.md` doesn't yet list the Sex/Age filters in the Multimedia toolbar options; `README.md` (if it enumerates them) and the `website/` version pill/footer (stale at v0.5.31) need updating. These are the records-sync the Chronicler owns; not a code defect (the controls are self-describing and fully functional).

## Known Limitations
- None of note. The Macaulay link and the in-app filter agree: a combined "juvenile female" link shows only media depicting a juvenile female (exact-combo, confirmed live by the user), the same set the in-app count reflects; single facets are broad in both.

## Convention Flags
- Record (Chronicler): the Multimedia tab's ML links now use the `media.ebird.org/catalog` base (was `search.macaulaylibrary.org/catalog`); both are the same Cornell Lab/eBird media search and already within the privacy disclosure. `BirdingStats` still uses the old base — a future consolidation candidate, not this feature.

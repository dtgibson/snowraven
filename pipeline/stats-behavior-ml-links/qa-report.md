# QA Report — stats-behavior-ml-links

**Date:** 2026-06-16
**Test Runner:** vitest
**Result:** PASSED

## Test Suite Results
941 tests passing, 0 failing (75 files). Full CI mirror also green: `eslint .` clean,
`tsc --noEmit` clean, and the production build (`tsc -b && vite build`) clean. The 5
new tests added this lane: `behaviorTagSlug` map (mediaStats), `isNonCountableSpecies`
(speciesUtils), coverage excludes spuh/slash/hybrid (mediaStats), each behavior count
links / plain-text without userId (MediaStatsSections), each breeding behavior links +
dedup from the top list (MediaStatsSections).

## Acceptance Criteria Verification (from change-brief "What done looks like")

| Criterion | Result | Notes |
|---|---|---|
| Each behavior count links to `media.ebird.org/catalog?userId=<id>&tag=<slug>` | ✓ Pass | Component test asserts the exact href (`tag=flying_flight`) + `target`/`rel`; verified live by Dave |
| Unmapped behaviors render as plain text (no broken link) | ✓ Pass | `behaviorTagSlug` → null → no href; unit-tested |
| New-tab via `OutboundLink`; accessible name leads with the visible count | ✓ Pass | aria-label `"<count> — Open your <behavior> media…"` + "(opens in a new tab)"; fixed after adversarial review (WCAG 2.5.3) |
| Existing photo/audio/video links also on `media.ebird.org` | ✓ Pass | `mlCatalogUrl` base changed; only-Statistics scope confirmed by audit |
| Each breeding behavior listed + linked individually; tiles unchanged | ✓ Pass | Component test: Carrying Food + Song each one link; tier tiles intact |
| Breeding behaviors deduped from the top "Behaviors documented" list when shown | ✓ Pass | Component test asserts exactly one link per breeding behavior |
| Coverage denominator excludes spuh/slash/hybrid | ✓ Pass | mediaStats test: `lifeListTotal` drops the 3 non-countable forms; numerator unchanged |
| `backboneNames` / Species-Detail linking untouched; no other stat affected | ✓ Pass | Audit (parallel read of birdingStats/speciesStats) confirmed; `backboneNames` unchanged |
| Lint, typecheck, tests, build green | ✓ Pass | All green |

## Edge Cases Tested
- No userId → behavior + breeding counts render plain text; no links; no breeding group.
- `isNonCountableSpecies`: spuh / slash / hybrid excluded; "Xantus's Hummingbird" not falsely excluded (the "x" must be a separated word).
- All-breeding behavior set: top list can be empty; `max` guarded with a fallback so no crash.

## Known Limitations
- A behavior that is both common and a breeding behavior (e.g. Song) appears only in the breeding group (deduped from the top list) when a userId is present — by design (Dave's call).
- "Mechanical Sound" → `non_vocal` is the one slug that comes from an eBird display rename (Non-vocal → Mechanical sound); verified live against the catalog, but it's the slug most worth re-checking if ML relabels its facets.

## Convention Flags
- New shared helper `isNonCountableSpecies` (speciesUtils.ts) is the canonical "countable life-list" predicate (spuh + slash + hybrid); prefer it over bare `isSpuhOrSlash` wherever a true life-list count is needed. (For The Chronicler to weigh.)

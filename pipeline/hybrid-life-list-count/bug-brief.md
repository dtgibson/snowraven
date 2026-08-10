# Bug Brief — hybrid-life-list-count

## What is broken

`filterObservations` (`frontend/src/lib/birdingStats.ts:63`) filters on `isSpuhOrSlash`, which omits hybrids, so `" x "` hybrids survive as countable species. Its own doc comment claims it drops `"'sp.' and 'x' hybrid"` entries, so the code contradicts its stated contract. This violates the canonical rule in CLAUDE.md: a life-list COUNT uses `isNonCountableSpecies`, not bare `isSpuhOrSlash`. Two call sites consume it (Statistics, Map Explorer), and both feed counts rather than display lists.

## Steps to reproduce

1. Parse an eBird export containing a hybrid row (e.g. `Mallard x American Black Duck (hybrid)`) via `parseEbirdObservations` — it applies no taxonomic exclusion, so the row reaches the stats pipeline.
2. Call `filterObservations(obs, false)` (what Statistics does with its toggle off, the default).
3. Feed the result to `computeLifeList` + `computeTotals`.
4. Observed: with 1 real species, 1 spuh, 1 slash, 2 hybrids, `speciesCount` reports **3**; spuh and slash are dropped, both hybrids are counted. Verified by running this against the real functions.

## Expected behavior

`speciesCount` reports **1**. Hybrids are excluded from countable-species totals exactly as spuh and slash are, matching `isNonCountableSpecies` and the Calendar/county-completeness/media-coverage surfaces that already use it. The `includeSpuh` toggle keeps its escape hatch: when on, all forms are counted as they are today.

## Blast radius

**Change:** `filterObservations` (one predicate swap) — fixes both consumers at once. `BirdingStats.tsx:257` propagates to every derived stat (headline species, per-checklist species counts, accumulation curve and milestones — a hybrid can currently *be* a milestone — top species, temporal, geo, quality, breeding, fun stats). `MapExplorer.tsx:815` feeds `buildCountyAggregates`, whose "distinct species per county" comment already claims hybrids are excluded; today county **Species** and county **Completeness** count by different rules in the same dropdown.
**Leave alone:** `SpeciesDetail.tsx:112,215` and `LifeList.tsx:329,363` are display filters behind "Show sp./slash" toggles, where `isSpuhOrSlash` is correct per CLAUDE.md. Already correct: `mediaStats.ts:324`, `calendar.ts:191`, `countyCompleteness.ts:185` — no denominator moves.
**Needs a decision:** `LifeList.tsx:506` derives its "N species" / "X of N species" labels from the display-filtered list, so those counts include hybrids. Correcting them also removes hybrid rows from the visible list — the only user-visible change in scope, so it is called out rather than assumed.

## What done looks like

`filterObservations` uses `isNonCountableSpecies`, its doc comment matches its behavior, and a regression test asserts a hybrid is excluded from `computeLifeList`/`computeTotals` at `includeSpuh: false` and included at `true`. Statistics' toggle label ("Include spuh / slash species") reads accurately for hybrids — Calendar's "Count spuh, slash & hybrids" is the house precedent — with `docs/HELP.md`/README/website synced if the copy changes. Effect on the user's own data: invisible if their export has no hybrid rows, a genuine downward correction to the species total if it has any. This is latent-correctness hygiene, not a reported visible defect.

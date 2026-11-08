# Bug Brief — Escapee check under the new taxonomy

## What is broken
The Statistics escapee check (the line under the Species figure, the only place it renders) cannot match eBird's current answer to a species named under an older taxonomy. A backup from before eBird's 2026 update names a split bird by its old name. `/taxonomy/codes` matches the scientific name first, so the old name lands on one daughter species ("Willet" becomes `willet2`, Saltmarsh Willet). eBird now answers for that observation under a sibling code or the slash code (`willet1`, now "Saltmarsh/Prairie Willet"). The merge drops that row as outside the cover, the species never gets a record, and the line reads "eBird's answers did not include N of your species" for good.
Two related gaps. Seven 2026 lumped-away names resolve to no code at all, so their escapee status is never checked and nothing says so. A second cause gives the same sentence and has nothing to do with taxonomy: an answer that really lacks the species (Eurasian Skylark, checklist `S186299363`, absent under both taxonomies). The sentence never names the species, so the user cannot tell which cause they are seeing.

## Steps to reproduce
1. Load a backup with the row `S1, Willet, Tringa semipalmata` (any download from before 2026-10-29), plus one control species on S1.
2. Resolve codes the way both transports do (`bySci`, then `byCom`, species only, bundled 2026 snapshot). The result: Willet maps to `willet2`.
3. Merge eBird's current answer for S1, `[{speciesCode: 'willet1'}, {speciesCode: <control>}]` (the answer measured at v1.0.64).
4. `willet2` classifies as `unknown`, `remainingSpecies` holds 1 species, and `statusSentence` returns exactly "eBird's answers did not include 1 of your species, so it still counts." (probe: `/private/tmp/claude-502/-Users-developer-devwork-snowraven/7c035e40-a187-4e12-b532-174b189eea45/scratchpad/probe/repro.mjs`).
5. On the August data copy (`data/`), the same model leaves 3 species open: Willet and Marsh Wren (taxonomy) and Eurasian Skylark (not taxonomy).

## Expected behavior
When the backup's name shows it predates a split or lump, an answer row under a sibling code from the same event (another daughter, or a slash) counts as the answer for the user's species. That species then resolves like any other: counting, escapee or exotic. Each lumped-away name joins its surviving species and is checked.
`unmatched` stamps written under the old join must not keep the sentence up for up to 30 days. Statistics' controller and Life Lists' completion test read the same single join rule, so every list surface agrees.
A species still open for a reason other than taxonomy is named on the line, so the user can see which bird it is.

## Blast radius
- The join itself: `buildCoverIndex`, the merge's `admissible` set and `carried` stamping (`mergeChecklist`), `carriersNeedingRefetch` and `remainingSpecies`. Statistics (`BirdingStats.tsx:457`) and Life Lists (`lifeListsProvenance.ts:61`) each build their own cover index, and both must take the join (the v1.0.63 completion rule).
- The stored `exotic-provenance-v1` document on users' devices: stamps and records are keyed by code, and the ledger holds those checklists as fresh. Re-open affected species with an optional field on the same key, or by dropping their stamps. A version bump would empty every device's store.
- The passive readers (Calendar, Multimedia coverage, Frivolous Lists, county Completeness, Species Detail's Show escapees, Life Lists' exotic list) inherit the fix through the published names. A species that moves from `unknown` to `escapee-only` or exotic changes their counts.
- The history asset (226 KB) is loaded only on demand and is kept off the entry chunk (`entryChunk.test.ts:232`). Statistics and Life Lists must load it the same way. `exoticProvenanceConvergence.test.tsx` pins today's open state and the [29, 8, 0, 0] request counts; those rows change on purpose.
- Out of scope: re-counting the life lists under the new taxonomy. All 39 old 2026 names still count; a lumped pair still counts as two and a pre-split bird as one, until the user downloads a fresh backup (v1.0.61 decision). The two transports and `/taxonomy/codes` need no change if the join lives in the frontend model.

## What done looks like
Every 2026 shape resolves from an answer under a sibling code: a retired split name, a split whose daughter kept the old name, an old code reused for the slash, and a lumped-away name. This is shown in model rows and in a convergence row through the real `storage.ts` on both the desktop and web storage paths, with Statistics and Life Lists reporting the same completion. A current backup that holds a daughter and its slash on one checklist is not cross-joined. On the `data/` copy the open set drops from 3 to 1, and the line names Eurasian Skylark.

## Evidence
- The sentence is `exoticCopy.ts:175`, set at `useExoticProvenance.ts:499` (after a pass) and `:558` (auto-start skip).
- Codes resolve by scientific name first, species only: `tauri/taxonomyService.ts:262` and `backend/routers/taxonomy.py:358`. Answer codes fold through `reportAs`, and a slash has no `reportAs` (`tauri/checklistService.ts:225`).
- `exoticProvenanceCache.ts:539` drops a row outside `admissible`; `:562` stamps the cover code as unmatched.
- `ebird-taxonomy-history.json`, 2026: 32 events. 28 split names land on a daughter; 7 lumped names resolve to nothing; 10 slashes reuse the old code; all 39 old names still count.
- The deferred root fix: `pipeline/exotic-provenance-reuse/decisions.md` D-02 and D-06 item 2, and ROADMAP row D (v1.0.66 item 2).
- The user's iPhone showed "1" at the v1.0.64 and v1.0.66 checks. Both local backups carry retired Willet and Marsh Wren, which make 3 open, so "1" most likely means Eurasian Skylark, which is not a taxonomy cause.
- Baseline: `exoticProvenance`, `useExoticProvenance` and `exoticProvenanceConvergence` suites, 102 of 102 pass.

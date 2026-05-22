# Pipeline Handoff — media-list-comprehensive

**Status:** Complete — both sessions finished, feature shipped at v0.0.38

---

## What was built

The Media Life List tab gained a **Comprehensive mode** — when the user has an eBird backup stored
in Settings, it auto-loads alongside the ML export and becomes the species backbone. Every eBird
life-listed species appears in the table whether or not it has ML media. ML-only entries that don't
match the eBird backbone are classified as non-bird (soundscapes, taxonomic mismatches) and can be
shown or hidden with a toggle.

Three new toolbar toggles were added (Merge subspecies, Show sp./slash, Show non-bird), plus a
"Has media" filter pill that hides all zero-media entries in one click. The non-bird toggle and
non-bird table section are hidden in ML-only mode. Species count denominator was corrected to use
the comprehensive entry count, not the ML-only count.

A `speciesUtils.ts` shared module was extracted so `normalizeSpeciesName` and `isSpuhOrSlash` are
no longer duplicated between `LifeList.tsx` and `SpeciesDetail.tsx`.

---

## Artifacts produced

**Session 1 (planning):**
- `pipeline/media-list-comprehensive/strategic-brief.md`
- `pipeline/media-list-comprehensive/prd.md`
- `pipeline/media-list-comprehensive/schema.md`
- `pipeline/media-list-comprehensive/design-spec.md`
- `pipeline/media-list-comprehensive/design.html`

**Session 2 (implementation):**
- `frontend/src/lib/speciesUtils.ts` — NEW shared module
- `frontend/src/lib/speciesUtils.test.ts` — NEW, 11 tests
- `frontend/src/lib/parseLifeList.ts` — `isNonBird?: boolean` added to `LifeListEntry`
- `frontend/src/components/SpeciesDetail.tsx` — switched to `speciesUtils` imports
- `frontend/src/components/LifeList.tsx` — comprehensive mode, three toggles, filterHasMedia, buildComprehensiveEntries, parallel auto-load
- `frontend/src/components/LifeListTable.tsx` — non-bird sort partition, Total column zero fix
- `frontend/package.json` — bumped to v0.0.38
- `CHANGELOG.md` — [0.0.38] entry added
- `PRODUCT_CONTEXT.md` — Media Life List section rewritten; 5 new Key Decisions added

**Deployed:** v0.0.38 — GitHub release at https://github.com/dtgibson/snowraven/releases/tag/v0.0.38

---

## Key decisions made this session

- Non-bird detection uses a set built from the always-normalized eBird backbone (independent of the mergeSubspecies toggle) to avoid false positives on subspecies entries
- `filterHasMedia` is a separate boolean state, not added to `MediaFilterState`, so "All" can reset both in one place
- `totalSpecies` denominator uses `displayEntries.length` (comprehensive count) not `phaseEntries.length` (ML-only count)
- Non-bird sort partition fires only in Taxonomic nameSortMode per FR-13; A-Z leaves non-birds in alphabetical position
- `speciesUtils.ts` is a component-layer shared module; parser-layer utilities remain separate per the earlier decision

---

## Starting the next feature

Run `/new-feature` to begin a new pipeline session. The Orchestrator will check the roadmap for the
next suggested item.

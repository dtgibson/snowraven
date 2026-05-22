# Handoff — Session 1 Complete: Media List: Comprehensive Species View

**Date:** 2026-05-21
**Feature:** media-list-comprehensive
**Session:** 1 of 2

---

## What Was Decided

The Media Life List tab is being upgraded from an ML-export-only view into a comprehensive life list driven by the eBird backup. Every species from the eBird backup will appear in the list — species with ML media show their counts, species without show dashes. Four new controls are added: a "Has media" filter pill, and three toggle switches ("Show subspecies", "Show sp./slash", "Show non-bird"). All changes gracefully degrade to current behavior when no eBird backup is stored.

## Key Technical Decisions

- **Species backbone:** eBird backup drives which species appear; ML export provides catalog IDs and media counts
- **Non-bird classification:** ML species whose normalized name does not appear in the eBird backup normalized species set; shown at end of taxonomic sort under a "Non-Bird Media" separator
- **Shared utilities:** `normalizeSpeciesName` and `isSpuhOrSlash` extracted to `frontend/src/lib/speciesUtils.ts`; imported by both `LifeList.tsx` and `SpeciesDetail.tsx`
- **County/date filter in comprehensive mode:** Both `rawEbirdObs` and `rawRows` filtered independently in `displayEntries` useMemo; `buildComprehensiveEntries` called with filtered sets
- **`resolveMLCounties` optimization:** Accepts optional pre-loaded `ObservationEntry[]` to skip the redundant Settings fetch when eBird obs are already in state
- **Hooks rule compliance:** All new `useState` and `useMemo` hooks declared before any early return

## Design Decisions (Stage 4)

- Three `ToggleSwitch` buttons match the identical component in `SpeciesDetail.tsx` — not extracted, each component keeps its own copy
- New "Has media" filter pill sits between "All" and the "No photo/audio/video" group — positive filter, shows only species with at least one catalog item
- Non-bird section separator label: "Non-Bird Media"
- No visual badge or indicator distinguishing non-bird from bird entries in table rows
- Non-bird toggle hidden entirely in ML-only mode

## Artifacts

| File | Purpose |
|---|---|
| `pipeline/media-list-comprehensive/strategic-brief.md` | Feature scope and data model definition |
| `pipeline/media-list-comprehensive/prd.md` | Functional requirements, user stories, QA criteria |
| `pipeline/media-list-comprehensive/schema.md` | Architecture: all types, functions, state changes, and data flow |
| `pipeline/media-list-comprehensive/design-spec.md` | Visual spec: tokens, interaction notes, component usage |
| `pipeline/media-list-comprehensive/design.html` | Interactive mockup with all three scenarios and all controls |

## Files the Engineer Will Touch

| File | Change |
|---|---|
| `frontend/src/lib/speciesUtils.ts` | **New** — `normalizeSpeciesName`, `isSpuhOrSlash` |
| `frontend/src/lib/parseLifeList.ts` | Add `isNonBird?: boolean` to `LifeListEntry` |
| `frontend/src/components/LifeList.tsx` | New state, `buildComprehensiveEntries`, revised `displayEntries`, updated `resolveMLCounties`, "Has media" pill, toggle UI |
| `frontend/src/components/LifeListTable.tsx` | Non-bird partition in sort comparator |
| `frontend/src/components/SpeciesDetail.tsx` | Import `normalizeSpeciesName`, `isSpuhOrSlash` from `speciesUtils`; remove inline definitions |

No backend changes. New test file: `frontend/src/lib/speciesUtils.test.ts`.

---

## Resume with `/build-feature`

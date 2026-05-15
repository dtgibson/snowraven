# Pipeline Handoff — Multi-Select Filter Pills (v0.0.23)

**Date:** 2026-05-14
**Status:** Complete — both sessions done

---

## What was built

Filter pills on the Media List and Breeding Codes tabs now support multi-select with AND logic.

On the Media List, each media dimension (photo, audio, video) is tracked independently. You can select "No photo" and "No audio" simultaneously to find species missing coverage on both fronts. Selecting the opposite pill for the same dimension (e.g. "Has photo" while "No photo" is active) auto-replaces the conflicting selection in a single click. Clicking an active pill deselects it. "All" resets everything.

On the Breeding Codes tab, multiple code pills can be active at once. The table shows only species with recorded observations for every selected code — selecting NY + CF filters to species where both codes appear. Clicking an active pill removes it from the filter.

Entirely frontend — no backend changes.

---

## Artifacts

**Session 1 — Planning:**
- `pipeline/multi-select-filter-pills/strategic-brief.md`
- `pipeline/multi-select-filter-pills/prd.md`
- `pipeline/multi-select-filter-pills/schema.md`
- `pipeline/multi-select-filter-pills/design-spec.md`
- `pipeline/multi-select-filter-pills/design.html`

**Session 2 — Implementation:**
- `frontend/src/types.ts` (modified — MediaFilterState, BreedingFilterSet)
- `frontend/src/components/LifeList.tsx` (modified — multi-select state and pills)
- `frontend/src/components/LifeListTable.tsx` (modified — AND filter logic)
- `frontend/src/components/BreedingCodeList.tsx` (modified — Set-based multi-select)
- `frontend/src/components/BreedingCodeTable.tsx` (modified — AND filter logic)
- `CHANGELOG.md` (modified)
- `PRODUCT_CONTEXT.md` (modified)
- `DECISIONS.md` (modified)
- `ROADMAP.md` (modified)

---

## Next feature

Run `/new-feature` to start the next feature.

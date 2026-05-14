# Pipeline Handoff — Breeding Code List (v0.0.18)

**Date:** 2026-05-14
**Status:** Complete — both sessions done

---

## What was built

A fourth tab in SnowRaven that accepts an eBird backup CSV (`MyEBirdData.csv`) and renders a species-by-breeding-code matrix. Each cell shows a count of how many times a species was observed with that code, displayed as a tier-colored circle (darkest purple = confirmed, lightest = possible). Columns are sortable by clicking headers and filter pills let the user focus on any single breeding code.

Entirely client-side — no backend changes.

---

## Artifacts

**Session 1 — Planning:**
- `pipeline/breeding-codes/strategic-brief.md`
- `pipeline/breeding-codes/prd.md`
- `pipeline/breeding-codes/schema.md`
- `pipeline/breeding-codes/design-spec.md`
- `pipeline/breeding-codes/design.html`

**Session 2 — Implementation:**
- `frontend/src/lib/breedingCodes.ts`
- `frontend/src/lib/parseBreedingCodes.ts`
- `frontend/src/lib/parseBreedingCodes.test.ts`
- `frontend/src/components/BreedingCodeTable.tsx`
- `frontend/src/components/BreedingCodeList.tsx`
- `frontend/src/App.tsx` (modified)
- `frontend/src/types.ts` (modified)
- `CHANGELOG.md` (modified)
- `PRODUCT_CONTEXT.md` (modified)

---

## Next feature

Run `/new-feature` to start the next feature.

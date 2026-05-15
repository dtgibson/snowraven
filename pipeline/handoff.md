# Pipeline Handoff — Taxonomic Sort (v0.0.24)

**Date:** 2026-05-15
**Status:** Complete — both sessions done

---

## What was built

An A–Z / Taxonomic sort toggle was added to the **Media List** and **Breeding Codes** tabs, matching the toggle already present on the Life List Comparer. Users can switch between alphabetical and eBird taxonomic ordering on any tab that shows a species list.

Key details:
- Works for **both ML export and eBird CSV** on the Media List (prior to this feature the toggle was absent for ML export)
- Taxonomic order for ML export entries comes from the `/taxonomy/codes` fetch response — no new endpoint or extra network call
- Column-header sorts (Photo/Audio/Video counts; breeding code columns) preserve the A–Z vs Taxonomic preference as a tiebreaker
- Species not found in the eBird taxonomy sort last on both input paths
- ML export drop zone copy fixed: "Instant results — species links and taxonomic sort load in the background" (was inaccurate "no network lookups")

---

## Artifacts

**Session 1 — Planning:**
- `pipeline/taxonomic-sort/strategic-brief.md`
- `pipeline/taxonomic-sort/prd.md`
- `pipeline/taxonomic-sort/schema.md`
- `pipeline/taxonomic-sort/design-spec.md`
- `pipeline/taxonomic-sort/design.html`

**Session 2 — Implementation:**
- `backend/routers/taxonomy.py` (modified — `_by_order` dict; `orders` in response)
- `backend/tests/test_taxonomy_router.py` (new — 5 tests)
- `frontend/src/types.ts` (modified — `NameSortMode`; `nameSortMode` on both sort state types)
- `frontend/src/components/LifeList.tsx` (modified — `taxonOrders` state; sort toggle; drop zone copy)
- `frontend/src/components/LifeListTable.tsx` (modified — `getOrder()`, `nameCompare()`, tiebreaker)
- `frontend/src/components/BreedingCodeList.tsx` (modified — `taxonOrders` state; sort toggle)
- `frontend/src/components/BreedingCodeTable.tsx` (modified — `nameCompare()`, tiebreaker)
- `CHANGELOG.md` (modified)
- `frontend/package.json` (version → 0.0.24)
- `PRODUCT_CONTEXT.md` (modified)
- `DECISIONS.md` (modified)
- `ROADMAP.md` (modified)

---

## Next feature

Run `/new-feature` to start the next feature. The roadmap suggests **Print / export view** as the next item.

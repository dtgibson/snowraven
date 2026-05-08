# Pipeline Handoff — ebird-list-comparer

**Status:** Complete  
**Date:** 2026-05-07  
**Both sessions approved through Stage 9.**

---

## What was built

A List Comparer tab integrated into SnowRaven. Users drag and drop two eBird
backup CSV files to see a three-panel breakdown of which species they share and
which are unique to each list. A summary bar shows five counts at a glance.
A "Show all / Collapse" toggle expands all panels to full height for printing.

All logic is client-side — no backend changes, no API calls.

---

## Artifacts produced

**Session 1 — Planning:**
- `pipeline/ebird-list-comparer/strategic-brief.md`
- `pipeline/ebird-list-comparer/prd.md`
- `pipeline/ebird-list-comparer/schema.md`
- `pipeline/ebird-list-comparer/design-spec.md`
- `pipeline/ebird-list-comparer/design.html`

**Session 2 — Implementation:**
- `frontend/src/types.ts`
- `frontend/src/lib/parseEbird.ts`
- `frontend/src/lib/parseEbird.test.ts`
- `frontend/src/lib/compare.ts`
- `frontend/src/lib/compare.test.ts`
- `frontend/src/components/DropZone.tsx`
- `frontend/src/components/SpeciesPanel.tsx`
- `frontend/src/components/ResultsView.tsx`
- `frontend/src/components/ListComparer.tsx`
- `frontend/src/App.tsx` (tab bar, comparer tab panel)
- `CHANGELOG.md` (0.0.3 entry)
- `frontend/package.json` (bumped to 0.0.3)
- `PRODUCT_CONTEXT.md` (updated)

---

## This feature is complete.

To start the next feature, run `/new-feature`.

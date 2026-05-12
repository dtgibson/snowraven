# Pipeline Handoff — Life List (v0.0.7)
**Date:** 2026-05-12
**Status:** Complete — both sessions done

---

## What was built

The Life List tab is a new tool in SnowRaven that accepts an eBird backup CSV
(`MyEBirdData.csv`) and generates a complete life list with per-species media
coverage from the Macaulay Library. Birders can see at a glance which species
they've photographed, audio-recorded, and video-recorded — and filter to find
target species for their next outing.

### How it works

1. User drops or selects `MyEBirdData.csv`
2. The parser extracts one entry per species with all ML catalog numbers unioned across every observation row
3. Catalog IDs are sent in batches of 25 to `POST /ml/media-types` on the backend
4. The backend queries the Macaulay Library search API for each ID to determine its media type
5. The table renders with ✓ / — per species for Photo, Audio, and Video
6. Filter pills, sort toggle, expand toggle, and a "Load new file" reset are available

---

## Artifacts produced

### Session 1 (planning)
- `pipeline/life-list/strategic-brief.md`
- `pipeline/life-list/prd.md`
- `pipeline/life-list/schema.md`
- `pipeline/life-list/design-spec.md`
- `pipeline/life-list/design.html`

### Session 2 (implementation)
- `backend/routers/ml.py` — POST /ml/media-types proxy endpoint
- `backend/tests/test_ml_router.py` — 5 backend tests
- `backend/main.py` — ML router registered
- `frontend/src/lib/parseLifeList.ts` — CSV parser
- `frontend/src/lib/parseLifeList.test.ts` — 13 frontend parser tests
- `frontend/src/components/LifeList.tsx` — top-level Life List component
- `frontend/src/components/LifeListTable.tsx` — species table
- `frontend/src/types.ts` — MediaType, MediaFilter, SortOrder added
- `frontend/src/App.tsx` — Life List tab added
- `frontend/vite.config.ts` — /ml proxy added
- `CHANGELOG.md` — v0.0.7 entry added
- `PRODUCT_CONTEXT.md` — Life List feature and decisions documented

---

## Test results
- Backend: 47/47 tests passing (5 new ML router tests)
- Frontend: 32/32 tests passing (13 new parser tests)
- TypeScript: 0 errors

## Release
- Version: 0.0.7
- GitHub release: https://github.com/dtgibson/snowraven/releases/tag/v0.0.7
- Commits: d6c550a (feature), 0830195 (context)

---

## Starting the next feature

Run `/new-feature` to begin. The pipeline will check ROADMAP.md for the next
suggested item and guide you through Session 1.

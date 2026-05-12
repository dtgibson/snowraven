# Schema — Life List
**Feature:** life-list
**Classification:** Incremental — Full Stack
**Date:** 2026-05-12
**Stage:** 3 — The Architect
**Source:** prd.md (approved)

---

## Classification Rationale

Incremental on both sides. The frontend reuses the existing `DropZone` component, the `parseCSVLine` / `isExcluded` logic in `parseEbird.ts`, and the tab-bar pattern in `App.tsx`. The backend adds one new router following the exact pattern of `version.py` and `weather.py`. No existing files are broken; new files are additive.

---

## Backend

### New file: `backend/routers/ml.py`

```python
POST /ml/media-types
Body:  {"catalog_ids": ["123456", ...]}
Returns: {"media_types": {"123456": "Photo", ...}}
```

- Uses `httpx.AsyncClient` (already a dependency)
- Queries `https://search.macaulaylibrary.org/api/v1/search?q={id}&mediaType=all&count=5` per batch
- Extracts `mediaType` from first result whose `catalogId` matches
- Batches of 25 IDs, sequential
- 10s timeout per batch, 503 on failure

### Modified: `backend/main.py`

Add import and `app.include_router(ml_router)` — identical pattern to version router.

### New file: `backend/tests/test_ml_router.py`

Tests: valid lookup returns correct media types, missing ID omitted from response, ML API unreachable returns 503, empty catalog_ids list returns empty media_types.

---

## Frontend

### New file: `frontend/src/lib/parseLifeList.ts`

Parses `MyEBirdData.csv` into a life list structure. Reuses `parseCSVLine` and `isExcluded` logic.

```typescript
export interface LifeListEntry {
  commonName: string
  scientificName: string
  taxonomicOrder: number        // Infinity if absent/non-numeric
  catalogIds: string[]          // deduplicated across all observations
}

export function parseLifeList(text: string): LifeListEntry[]
// Returns one entry per species, sorted by taxonomicOrder ascending
// Throws if 'Common Name' column is absent
```

### New file: `frontend/src/lib/parseLifeList.test.ts`

Tests: deduplication, exclusion rules, catalog number parsing, taxonomic sort, missing-column error.

### Modified: `frontend/src/types.ts`

Add:
```typescript
export type MediaType = 'Photo' | 'Audio' | 'Video'
export type MediaFilter = 'all' | 'no-photo' | 'no-audio' | 'no-video'
export type SortOrder = 'taxonomic' | 'alpha'
```

### New file: `frontend/src/components/LifeList.tsx`

Top-level component managing state:
- `idle → parsing → loading (ML batches) → ready | error`
- Owns: `entries`, `mediaMap`, `filter`, `sort`, `loadingProgress`, `mlError`
- Renders: `DropZone` (idle) → progress indicator (loading) → table + filters (ready)

### New file: `frontend/src/components/LifeListTable.tsx`

Filtered/sorted species table. Props: `entries`, `mediaMap`, `filter`, `sort`.
Each row: species name | ✓ Seen | ✓/— Photo | ✓/— Audio | ✓/— Video.

### Modified: `frontend/src/App.tsx`

Add `'life-list'` to `Tab` type, add third tab button and panel using display-toggle pattern.

### Modified: `frontend/vite.config.ts`

Add `/ml` proxy to `http://localhost:1620`.

---

## File Change Summary

| File | Change |
|---|---|
| `backend/routers/ml.py` | New — ML media-types proxy endpoint |
| `backend/tests/test_ml_router.py` | New — tests for ML router |
| `backend/main.py` | Modified — register ML router |
| `frontend/src/lib/parseLifeList.ts` | New — CSV → life list parser |
| `frontend/src/lib/parseLifeList.test.ts` | New — parser tests |
| `frontend/src/components/LifeList.tsx` | New — top-level life list component |
| `frontend/src/components/LifeListTable.tsx` | New — filtered/sorted species table |
| `frontend/src/types.ts` | Modified — add MediaType, MediaFilter, SortOrder |
| `frontend/src/App.tsx` | Modified — add Life List tab |
| `frontend/vite.config.ts` | Modified — add /ml proxy |

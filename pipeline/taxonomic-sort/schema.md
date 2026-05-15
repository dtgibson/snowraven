# Schema — Taxonomic Sort

## Path
Incremental (Extending existing schema)

---

## Current Schema State

This project has no relational database. The "schema" is the API contract between
the FastAPI backend and the React frontend, plus the TypeScript type system.

### Backend API

#### `POST /taxonomy/codes`
**Request:** `[{ commonName: string, scientificName: string }]`

**Response (after this feature):**
```json
{
  "codes": { "American Robin": "amerob", ... },
  "orders": { "American Robin": 27616, ... }
}
```

- `codes` — maps `commonName → speciesCode`; used for eBird/BOW links and ML catalog links
- `orders` — maps `commonName → taxonOrder` (positive integer); used for taxonomic sort; **new in this feature**

Both maps are derived from the same in-memory cached eBird taxonomy. On first call the
backend fetches `api.ebird.org/v2/ref/taxonomy/ebird?fmt=json&cat=species` and builds
three dicts: `_by_sci`, `_by_com`, and now `_by_order` (or inline from `_by_com`).
Subsequent calls are instant.

**Graceful degradation:** Any error returns `{ codes: {}, orders: {} }`.

#### All other endpoints — unchanged
- `GET /weather/{checklist_id}` — checklist weather lookup
- `POST /ml/media-types` — ML catalog CDN probe
- `GET /version/check` — GitHub release comparison

---

### Frontend Type System

Current state after this feature (cumulative):

```typescript
// --- Media types ---
export type MediaType = 'Photo' | 'Audio' | 'Video'

// --- Filter state ---
export type MediaDimensionState = 'has' | 'no' | null
export interface MediaFilterState {
  photo: MediaDimensionState
  audio: MediaDimensionState
  video: MediaDimensionState
}
export const MEDIA_FILTER_CLEAR: MediaFilterState = { photo: null, audio: null, video: null }
export type BreedingFilterSet = Set<string>

// --- Sort state ---
export type NameSortMode = 'az' | 'taxonomic'   // NEW — toggle mode + tiebreaker
export type SortColumn = 'name' | 'photo' | 'audio' | 'video'
export type SortDir = 'asc' | 'desc'
export interface SortState {
  column: SortColumn
  dir: SortDir
  nameSortMode: NameSortMode   // NEW field
}

export type BreedingSortColumn = string
export interface BreedingSortState {
  column: BreedingSortColumn
  dir: SortDir
  nameSortMode: NameSortMode   // NEW field
}

// --- Life list ---
export interface LifeListEntry {
  commonName: string
  scientificName: string
  taxonomicOrder: number    // Infinity for ML export entries; real value for eBird CSV
  catalogIds: string[]
}

// --- List comparer ---
export interface FileData {
  name: string
  species: Set<string>
}
export interface ComparisonResult {
  both: string[]
  aOnly: string[]
  bOnly: string[]
}

// --- Breeding codes ---
export interface BreedingEntry {
  commonName: string
  codes: Record<string, number>
}
export type BreedingSortColumn = string
export interface BreedingSortState {
  column: BreedingSortColumn
  dir: SortDir
  nameSortMode: NameSortMode
}
```

---

### Frontend Component State

#### `LifeList.tsx` (after this feature)

| State field | Type | Notes |
|---|---|---|
| `phase` | `'idle' \| 'loading' \| 'error' \| 'ready'` | Unchanged |
| `entries` | `LifeListEntry[]` | Unchanged |
| `mediaMap` | `Record<string, string>` | Unchanged |
| `taxonMap` | `Record<string, string>` | Unchanged — `commonName → speciesCode`; existing |
| `taxonOrders` | `Record<string, number>` | **New** — `commonName → taxonOrder`; populated from `orders` in taxonomy fetch response |
| `filter` | `MediaFilterState` | Unchanged |
| `sort` | `SortState` | Extended — now includes `nameSortMode`; default: `{ column: 'name', dir: 'asc', nameSortMode: 'az' }` |
| `expanded` | `boolean` | Unchanged |

#### `BreedingCodeList.tsx` (after this feature)

| State field | Type | Notes |
|---|---|---|
| `phase` | `'idle' \| 'error' \| 'ready'` | Unchanged |
| `entries` | `BreedingEntry[]` | Unchanged |
| `codesPresent` | `string[]` | Unchanged |
| `taxonMap` | `Record<string, string>` | **New** — `commonName → speciesCode`; populated from `codes` in taxonomy fetch |
| `taxonOrders` | `Record<string, number>` | **New** — `commonName → taxonOrder`; populated from `orders` in taxonomy fetch |
| `filter` | `BreedingFilterSet` | Unchanged |
| `sort` | `BreedingSortState` | Extended — now includes `nameSortMode`; default: `{ column: 'name', dir: 'asc', nameSortMode: 'az' }` |

---

## Changes in This Feature

### Added

**Backend — `backend/routers/taxonomy.py`**

Add `orders` to the response payload. The `taxon_order` field is already present on every
entry in the raw eBird taxonomy response — this change reads it and includes it in the
return dict:

```python
# Before
return {"codes": {entry["comName"]: entry["speciesCode"] for entry in taxonomy}}

# After
return {
    "codes": {entry["comName"]: entry["speciesCode"] for entry in taxonomy},
    "orders": {entry["comName"]: entry["taxonOrder"] for entry in taxonomy},
}
```

**Frontend types — `frontend/src/types.ts`**

- Add `NameSortMode = 'az' | 'taxonomic'`
- Add `nameSortMode: NameSortMode` field to `SortState`
- Add `nameSortMode: NameSortMode` field to `BreedingSortState`

**Frontend component state — `LifeList.tsx`**

- Add `taxonOrders: Record<string, number>` state (default `{}`)
- Populate `taxonOrders` from `response.orders` in the existing `fetchTaxonCodes` call
- Include `nameSortMode: 'az'` in the initial and reset `SortState`
- Render A–Z / Taxonomic toggle buttons in the controls row
- Pass `taxonOrders` and `sort.nameSortMode` to `LifeListTable`

**Frontend component state — `BreedingCodeList.tsx`**

- Add `taxonMap: Record<string, string>` state (default `{}`)
- Add `taxonOrders: Record<string, number>` state (default `{}`)
- Call `fetchTaxonCodes` after file parse completes (new call — does not exist today)
- Populate `taxonMap` from `response.codes` and `taxonOrders` from `response.orders`
- Include `nameSortMode: 'az'` in the initial and reset `BreedingSortState`
- Render A–Z / Taxonomic toggle buttons in the controls row
- Pass `taxonOrders` and `sort.nameSortMode` to `BreedingCodeTable`

**Frontend component — `LifeListTable.tsx`**

- Accept `taxonOrders: Record<string, number>` and use `sort.nameSortMode` for:
  - Name-primary sort: A–Z (`localeCompare`) vs Taxonomic (`taxonOrders[name] ?? Infinity`)
  - Tiebreaker when column sort (Photo/Audio/Video/Entries) is primary
- Unranked species (order not in map) sort last, then A–Z among themselves

**Frontend component — `BreedingCodeTable.tsx`**

- Accept `taxonOrders: Record<string, number>` and use `sort.nameSortMode` for:
  - Name-primary sort when `column === 'name'`
  - Tiebreaker when a code column is the primary sort

**Frontend — `LifeList.tsx` drop zone copy**

- Remove "no network lookups" or "entirely offline" language from the ML export drop zone copy

### Modified

None — no existing types, API contracts, or component interfaces were changed in a
breaking way. `SortState` and `BreedingSortState` gain a required field; all construction
sites are updated by the Engineer to include `nameSortMode`.

### Unchanged

- All other endpoints and their response shapes
- `LifeListEntry` type (including `taxonomicOrder: number`)
- `MediaFilterState`, `BreedingFilterSet`, `MEDIA_FILTER_CLEAR`
- `SortColumn`, `SortDir`
- `BreedingSortColumn`
- `BreedingEntry`
- `taxonMap` data flow in `LifeList.tsx` (extended to also carry `taxonOrders`)

---

## Migration Plan

No database migrations required. Steps for the Engineer in Stage 5:

1. **Backend:** Update `backend/routers/taxonomy.py` — add `orders` to the return dict.
   Update the corresponding test in `backend/tests/` to assert `orders` is present and
   maps `commonName → int`.

2. **Frontend types:** Update `frontend/src/types.ts` — add `NameSortMode`; add
   `nameSortMode` field to `SortState` and `BreedingSortState`.

3. **`LifeList.tsx`:** Add `taxonOrders` state; update `fetchTaxonCodes` to read
   `response.orders`; update default/reset `SortState` to include `nameSortMode: 'az'`;
   add toggle buttons; pass new props to `LifeListTable`; fix drop zone copy.

4. **`LifeListTable.tsx`:** Accept `taxonOrders` and `nameSortMode`; update sort logic for
   name-primary and tiebreaker cases.

5. **`BreedingCodeList.tsx`:** Add `taxonMap` and `taxonOrders` state; add
   `fetchTaxonCodes` call post-parse; update default/reset `BreedingSortState`; add
   toggle buttons; pass new props to `BreedingCodeTable`.

6. **`BreedingCodeTable.tsx`:** Accept `taxonOrders` and `nameSortMode`; update sort
   logic.

7. **Tests:** Update any existing tests that construct `SortState` or `BreedingSortState`
   to include `nameSortMode`. Add new tests for the `orders` field in the taxonomy
   endpoint. Add frontend tests for taxonomic sort behaviour.

---

## Design Decisions

**`nameSortMode` lives on the sort state object, not as a separate state field.**
Keeping the toggle mode inside `SortState` / `BreedingSortState` means there is one
object to pass between parent and table components, and the sort is fully described by
that object. A separate `nameSortMode` state field alongside `sort` would require
coordinating two pieces of state on every sort change.

**`taxonOrders` is separate from `taxonMap`.**
They come from the same fetch response but serve different purposes: `taxonMap` drives
eBird/BOW species links (existing); `taxonOrders` drives sort order (new). Keeping them
separate avoids conflating two concerns and matches the naming in the API response
(`codes` vs `orders`).

**Breeding Codes calls `POST /taxonomy/codes` for the first time.**
This adds one network call to the Breeding Codes tab that did not previously exist.
It fires fire-and-forget after parse — the table renders immediately in A–Z order; icons
and taxonomic sort become available when the fetch resolves. This is the same pattern
already used on the Media List and List Comparer tabs.

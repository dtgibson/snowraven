# Schema — Tab Filters

## Path
Frontend Only — No data layer changes required

## Confirmation
Reviewed all 32 functional requirements. No new database tables, columns, relationships, or migrations are involved. This project has no database — all state is in-memory. The new backend endpoint (`POST /nominatim/counties`) is a stateless proxy to Nominatim with an in-process cache, identical in pattern to the existing `POST /ml/media-types` endpoint. All TypeScript type changes are additive (new fields, new interfaces) with no breaking changes to existing return shapes.

---

## Layer 1 — `types.ts` Changes

### `ObservationEntry` — add `county`
```typescript
export interface ObservationEntry {
  submissionId: string
  commonName: string
  scientificName: string
  date: string
  location: string
  locationId: string
  latitude: number | null
  longitude: number | null
  county: string | null     // ← add: eBird "County" column; null when absent
  count: number | null
  breedingCode: string | null
  speciesComments: string
  catalogIds: string[]
}
```

### New type — `DateRangeState`
Shared across all three tabs for the from/to date inputs.
```typescript
export interface DateRangeState {
  from: string    // YYYY-MM-DD or '' (empty = no lower bound)
  to: string      // YYYY-MM-DD or '' (empty = no upper bound)
}
export const DATE_RANGE_CLEAR: DateRangeState = { from: '', to: '' }
```

### `SortColumn` — extend with `'total'`
```typescript
export type SortColumn = 'name' | 'photo' | 'audio' | 'video' | 'total'
```

---

## Layer 2 — Parser Changes

### `parseEbirdObservations.ts`

Add one column read alongside the existing ones:
```typescript
const countyIdx = headers.findIndex(h => h === 'county')
// in the row loop:
county: countyIdx >= 0 ? (cols[countyIdx]?.trim() || null) : null
```

---

### `parseBreedingCodes.ts`

New export type:
```typescript
export interface BreedingCodeRow {
  commonName: string
  scientificName: string
  date: string           // YYYY-MM-DD
  county: string | null
  code: string           // breeding code abbreviation (e.g. "CN")
}
```

`BreedingData` gets a new additive field:
```typescript
export interface BreedingData {
  entries: BreedingEntry[]
  codesPresent: string[]
  hasBreedingCodeColumn: boolean
  rows: BreedingCodeRow[]   // new: raw per-observation rows for filter re-aggregation
}
```

Column reads to add: `dateIdx` (header: `'date'`), `countyIdx` (header: `'county'`). Each valid row (with a known code) appends a `BreedingCodeRow`. The existing `entries` and `codesPresent` computation is unchanged — they reflect the full unfiltered dataset.

New export helper (used by component when filter changes):
```typescript
export function aggregateBreedingRows(
  rows: BreedingCodeRow[]
): Pick<BreedingData, 'entries' | 'codesPresent'>
```
Mirrors the existing aggregation logic but accepts a pre-filtered row set. Returns `{ entries: BreedingEntry[], codesPresent: string[] }`.

---

### `parseMLExport.ts`

New export type:
```typescript
export interface MLExportRow {
  catalogId: string
  commonName: string      // subspecies-normalized (parens stripped)
  scientificName: string
  format: 'Photo' | 'Audio' | 'Video'
  date: string            // raw date from ML export
  location: string
  county: string | null   // from ML export County column; null if column absent
  latitude: number | null
  longitude: number | null
}
```

`MLExportResult` gets a new additive field:
```typescript
export interface MLExportResult {
  entries: LifeListEntry[]
  mediaMap: Record<string, string>
  rows: MLExportRow[]     // new: raw per-item rows for filter re-aggregation
}
```

Column reads to add (all soft — no error if absent): `locationIdx`, `countyIdx`, `latitudeIdx`, `longitudeIdx`, `dateIdx`.

New export helper:
```typescript
export function aggregateMLRows(rows: MLExportRow[]): LifeListEntry[]
```
Takes filtered rows, re-aggregates into species-level `LifeListEntry[]` with updated `catalogIds`. Used by `LifeList.tsx` when county/date filter is active.

---

## Layer 3 — eBird Backup Path on Media List (Architecture Change)

`LifeList.tsx` currently uses `parseLifeList` for the eBird backup path. That parser returns species-level data with no date or location — county/date filtering is impossible.

**Required change:** Switch the eBird backup path in `LifeList.tsx` to `parseEbirdObservations`. `ObservationEntry[]` carries `catalogIds`, `date`, `location`, `lat`, `lng`, and (with the Layer 2 change) `county`. The component filters at the row level then re-aggregates into `LifeListEntry[]` for display.

The `Phase` union in `LifeList.tsx` needs to carry raw rows alongside the display entries:
```typescript
| {
    tag: 'ready'
    entries: LifeListEntry[]
    mediaMap: Record<string, string>
    mlError: boolean
    source: Source
    rows: MLExportRow[] | ObservationEntry[]   // for filter re-aggregation
  }
```

---

## Layer 4 — County Resolution (ML Export Path, `LifeList.tsx`)

Runs async after `parseMLExport` completes, in three sequential passes:

```
Pass 1 — Direct column:
  rows where county !== null are already resolved. No work needed.

Pass 2 — eBird backup cross-reference:
  For each row where county === null and location !== '':
    search loaded ObservationEntry[] (from Settings eBird backup) for entry.location === row.location
    if found and entry.county !== null: assign entry.county

Pass 3 — Nominatim:
  Collect rows still missing county where latitude !== null and longitude !== null.
  Deduplicate coordinates (round to 4 decimal places to merge nearby coords).
  POST /nominatim/counties with deduplicated lat/lng array.
  Assign resolved county back to all rows sharing that coordinate.
```

State addition in `LifeList.tsx`:
```typescript
const [countyResolution, setCountyResolution] = useState<'idle' | 'resolving' | 'done'>('idle')
```

County dropdown shows a spinner when `countyResolution === 'resolving'`; becomes interactive when `'done'`.

---

## Layer 5 — New Backend Endpoint

**New file:** `backend/routers/nominatim.py`

```python
from pydantic import BaseModel
from typing import Optional
import asyncio, httpx

class LocationPoint(BaseModel):
    lat: float
    lng: float

class NominatimRequest(BaseModel):
    locations: list[LocationPoint]

class LocationResult(BaseModel):
    lat: float
    lng: float
    county: Optional[str]

class NominatimResponse(BaseModel):
    results: list[LocationResult]

# In-process cache: (rounded_lat, rounded_lng) → county | None
_cache: dict[tuple[float, float], str | None] = {}
_rate_lock = asyncio.Lock()

# POST /nominatim/counties
```

Implementation notes:
- Deduplicate input coordinates by rounding to 4 decimal places
- Consult `_cache` before any network call; cache misses trigger one Nominatim request
- Between each Nominatim call: `await asyncio.sleep(1.0)` inside `_rate_lock`
- Nominatim URL: `https://nominatim.openstreetmap.org/reverse?format=json&lat={lat}&lon={lng}`
- `User-Agent: SnowRaven/1.0` header required by OSM usage policy
- County extracted from `response["address"]["county"]`; `None` if key absent or request fails
- All results (hit or miss) stored in `_cache`

**`backend/main.py`:** import and include `nominatim_router`.

---

## Layer 6 — Component Filter State (All Three Tabs)

The same pattern is added to `BreedingCodeList.tsx`, `LifeList.tsx`, and `SpeciesDetail.tsx`:

```typescript
const [countyFilter, setCountyFilter] = useState<string | null>(null)  // null = All Counties
const [dateRange, setDateRange] = useState<DateRangeState>(DATE_RANGE_CLEAR)
```

**Derived data pattern (useMemo):**

```typescript
// 1. Filter raw rows
const filteredRows = useMemo(() => {
  return rows.filter(row => {
    if (countyFilter !== null && row.county !== countyFilter) return false
    if (dateRange.from && row.date < dateRange.from) return false
    if (dateRange.to   && row.date > dateRange.to)   return false
    return true
  })
}, [rows, countyFilter, dateRange])

// 2. Re-aggregate
const displayEntries = useMemo(() => aggregateRows(filteredRows), [filteredRows])

// 3. Available counties for dropdown
const counties = useMemo(() => {
  const set = new Set(rows.map(r => r.county).filter(Boolean) as string[])
  return [...set].sort()
}, [rows])
```

Reset on file load: `countyFilter → null`, `dateRange → DATE_RANGE_CLEAR`.

---

## Layer 7 — Total Column (Media List)

After re-aggregation, each species entry carries `photo`, `audio`, `video` counts. Total = photo + audio + video. Computed in `LifeListTable.tsx` per row.

`SortColumn` extends to include `'total'`. Sort logic for `'total'` matches the existing pattern for `'photo'`, `'audio'`, `'video'`.

---

## Summary of Changes

| Artifact | Change |
|----------|--------|
| `frontend/src/types.ts` | Add `county` to `ObservationEntry`; add `DateRangeState` + `DATE_RANGE_CLEAR`; extend `SortColumn` with `'total'` |
| `frontend/src/lib/parseEbirdObservations.ts` | Add `countyIdx` column read |
| `frontend/src/lib/parseBreedingCodes.ts` | Add `BreedingCodeRow` type; add `rows` to `BreedingData`; add `aggregateBreedingRows` helper |
| `frontend/src/lib/parseMLExport.ts` | Add `MLExportRow` type; add `rows` to `MLExportResult`; add `aggregateMLRows` helper |
| `frontend/src/components/BreedingCodeList.tsx` | Add county/date filter state and controls; derive filtered entries from `rows` |
| `frontend/src/components/LifeList.tsx` | Switch eBird path to `parseEbirdObservations`; add county/date filter state; add county resolution async flow |
| `frontend/src/components/LifeListTable.tsx` | Add Total column; handle `'total'` sort |
| `frontend/src/components/SpeciesDetail.tsx` | Add county/date filter state; filter `speciesObs` before all downstream derivations |
| `backend/routers/nominatim.py` | New file — `POST /nominatim/counties` with rate limiter and in-process cache |
| `backend/main.py` | Import and include `nominatim_router` |

No database. No migrations. No server-side file writes. All type changes are additive.

## No Data Layer Work Required
The Engineer can proceed directly to implementation after extending the types and parsers as specified above.

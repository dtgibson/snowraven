# Schema — Birding Statistics Tab

## Path
Incremental (Extending existing schema)

---

## Changes in This Feature

### Added

#### `ObservationEntry` — 8 new optional fields (`types.ts` + `parseEbirdObservations.ts`)

The eBird backup CSV contains these columns that are currently read and discarded by the parser. All are added as optional fields so existing callers (BreedingCodeList, LifeList, SpeciesDetail, ListComparer) ignore them without modification.

| Field | CSV Column | Type | Parse rule |
|---|---|---|---|
| `time` | `Time` | `string \| null` | Raw value if non-blank; null otherwise |
| `duration` | `Duration Min` | `number \| null` | `parseInt()`; null if blank or NaN |
| `distance` | `Distance Traveled (km)` | `number \| null` | `parseFloat()`; null if blank or NaN |
| `protocol` | `Protocol` | `string \| null` | Raw value if non-blank; null otherwise |
| `numObservers` | `Number of Observers` | `number \| null` | `parseInt()`; null if blank or NaN |
| `allObsReported` | `All Obs Reported` | `boolean \| null` | `"1"` → true, `"0"` → false, blank → null |
| `checklistComments` | `Checklist Comments` | `string` | Raw value; empty string if blank |
| `stateProvince` | `State/Province Code` | `string \| null` | Raw value if non-blank; null otherwise |

Country is derived client-side from `stateProvince` as `stateProvince.split('-')[0]` (e.g. `"US-CA"` → `"US"`). No separate `country` field is stored.

All 8 fields repeat identically on every observation row within the same checklist — this is an eBird CSV characteristic. The Stats component deduplicates per `submissionId` when computing totals.

#### `ChecklistEntry` — new derived type (`types.ts`)

Computed client-side in a `useMemo` from `ObservationEntry[]`. One entry per unique `submissionId`. Not parsed from the CSV.

```typescript
type ChecklistEntry = {
  submissionId: string
  date: string               // YYYY-MM-DD
  location: string
  locationId: string
  latitude: number | null
  longitude: number | null
  county: string | null
  stateProvince: string | null
  time: string | null        // "HH:MM AM/PM"
  duration: number | null    // minutes
  distance: number | null    // km
  protocol: string | null
  numObservers: number | null
  allObsReported: boolean | null
  checklistComments: string
  speciesCount: number       // count of distinct normalized species on this checklist
}
```

**Derivation algorithm:**
1. Iterate `ObservationEntry[]` in date order
2. For each unique `submissionId`, take the first row's checklist-level fields (time, duration, distance, protocol, numObservers, allObsReported, checklistComments, stateProvince — identical across all rows in a checklist)
3. Count distinct `normalizeSpeciesName(commonName)` values per checklist as `speciesCount`

#### `GET /stats/nemesis` — new backend endpoint (`backend/routers/stats.py`)

```
GET /stats/nemesis?lat={float}&lng={float}&dist={int}
```

**Request parameters:**
- `lat`: float, required, −90 to 90
- `lng`: float, required, −180 to 180
- `dist`: int, required, 1 to 200 (kilometers)

**Server-side validation:** Returns HTTP 400 if any parameter is missing, not a valid number, or out of range.

**eBird API call:** `GET https://api.ebird.org/v2/data/obs/geo/recent?lat={lat}&lng={lng}&dist={dist}&back=30` with `X-eBirdApiToken` header using `EBIRD_API_KEY` from environment. 10-second httpx timeout (matching existing eBird calls).

**Response deduplication:** Groups eBird response by `comName`, keeping the most recent `obsDt` per species.

**Response shape:**
```json
{
  "species": [
    { "commonName": "Black-capped Chickadee", "recentDate": "2026-05-20" },
    { "commonName": "American Robin", "recentDate": "2026-05-21" }
  ]
}
```

**Frontend responsibility:** Filter `species` against the user's normalized life list to identify nemesis candidates. The endpoint returns all recently observed species — it has no access to the user's data.

**Error handling:** If `EBIRD_API_KEY` is not set, returns HTTP 503. If the eBird API call fails, returns HTTP 502 with a human-readable message.

#### `backend/main.py` — register stats router

```python
from routers import stats
app.include_router(stats.router, prefix="/stats")
```

Follows the same pattern as all existing routers.

#### `vite.config.ts` — add `/stats` proxy

```typescript
'/stats': { target: 'http://localhost:1620', changeOrigin: true }
```

Added alongside existing `/weather`, `/taxonomy`, `/settings`, `/map`, `/nominatim`, and `/version` proxies.

---

### Modified

None. All changes are purely additive.

---

### Unchanged

These existing structures are used by the Stats tab without modification:

- `ObservationEntry` existing 14 fields — all consumed by stats computations; no existing fields changed
- `MLExportRow` / `MLExportResult` — consumed as-is for media counts and most-photographed species
- `parseMLExport.ts` — no changes; Stats reads `mlRows` from the already-parsed result
- `parseEbirdObservations.ts` — extended (new columns read), not rewritten; existing column parsing unchanged
- `breedingCodes.ts` (`BREEDING_CODES`, `TIER_COLORS`, `CATEGORY_CODES`) — used directly for breeding stats sections
- `speciesUtils.ts` (`normalizeSpeciesName`, `isSpuhOrSlash`) — used throughout stats computations
- `data/ebird-backup.csv`, `data/ml-export.csv`, `data/metadata.json` — no changes to file storage; Stats auto-loads using the same `GET /settings/files/ebird` and `GET /settings/files/ml` endpoints as all other tabs
- `GET /settings/map-defaults` — read from Settings state in App.tsx; Stats component receives the saved location as a prop or reads it via the same fetch pattern; no changes to the endpoint
- Leaflet / leaflet.heat — observation map reuses the existing Pins/Heatmap pattern; no new Leaflet dependencies

---

## Migration Plan

No database migrations. Apply in this order:

1. **`frontend/src/types.ts`** — add 8 fields to `ObservationEntry`; add `ChecklistEntry` type
2. **`frontend/src/lib/parseEbirdObservations.ts`** — parse the 8 new columns; existing column indices unaffected (new columns read by name, not by index, matching the existing pattern)
3. **`frontend/src/lib/parseEbirdObservations.test.ts`** — add test cases for each new field: present, blank, and malformed values
4. **`backend/routers/stats.py`** — new file; `GET /stats/nemesis` endpoint
5. **`backend/tests/test_stats_router.py`** — new file; tests for validation (400 cases), success shape, missing API key (503)
6. **`backend/main.py`** — register stats router
7. **`frontend/vite.config.ts`** — add `/stats` proxy
8. **`frontend/src/components/BirdingStats.tsx`** — new tab component (full implementation)
9. **`frontend/src/App.tsx`** — add `'birding-stats'` tab

---

## Design Decisions

**`ChecklistEntry` is derived, not parsed.** The eBird CSV stores checklist-level fields (Duration, Protocol, etc.) redundantly on every observation row in that checklist. Parsing to `ChecklistEntry[]` in the parser would require buffering all rows before emitting — complicating the streaming parse. Deriving in a `useMemo` is simpler and keeps the parser single-pass. The cost is a one-time O(n) pass on first render, which is acceptable given NFR-01's 3-second budget.

**Nemesis endpoint returns all recent species; frontend filters.** The backend has no access to the user's life list (stored client-side). Filtering in the frontend avoids sending potentially sensitive life list data to the backend and keeps the endpoint general-purpose. The endpoint's job is purely to proxy the eBird regional API with validation.

**`stateProvince` stored as the raw eBird code; country derived.** `"US-CA"` encodes both state and country. Storing the raw code and splitting client-side avoids redundancy and keeps the parse simple. A future feature could use a lookup table to expand codes to full names if needed.

**`allObsReported` is `boolean | null`, not `boolean`.** Older eBird exports may omit this column entirely, or leave it blank for some checklists. `null` distinguishes "not recorded" from "explicitly false." The Stats component checks `allObsReported === true` for the complete-checklist ratio and omits null rows from the denominator.

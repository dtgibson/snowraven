# Schema — Map Explorer Enhancements

## Path
Frontend Only — No data layer changes required

## Confirmation

Every PRD requirement was checked against the data layer criteria. All requirements resolve to one of:
- Ephemeral UI state (`hiddenCategories`, `targetMode`, nearest-10 ranking)
- A query parameter change on an existing pass-through proxy (`back=14→30`)
- A field pass-through from the eBird API response that already contains `subId`
- A new pass-through proxy endpoint with no storage (`GET /nominatim/search`)
- CSS tokens (build-time, no runtime data)

No records are created, updated, or deleted. No new relationships. No computed data needs to be stored. Classification holds.

## Existing Data Used by This Feature

### `GET /map/hotspots` — eBird hotspot proxy
**File:** `backend/routers/map.py`
- Returns eBird hotspot JSON directly; no transformation
- Fields used by this feature: `locId`, `locName`, `lat`, `lng`
- The Engineer classifies each hotspot as `visited`, `unvisited`, or `personal` client-side using `visitedLocIds` from the stored eBird backup
- New in this feature: `hiddenCategories` state (Set of `'visited' | 'unvisited' | 'personal'`) filters which pins render; the legend rows toggle this state

### `GET /map/recent-obs` — eBird recent observations proxy
**File:** `backend/routers/map.py`
- Currently groups by `(speciesCode, locId)` and returns one entry per group
- Current response shape per group:
  ```
  speciesCode, comName, locId, locName, lat, lng, recentDate, checklistCount
  ```
- **Two backend changes needed for this feature:**
  1. Change `back` parameter from `14` to `30`
  2. Add `subId` to each group — the `subId` from the observation with the most recent `obsDt` in the group
- New response shape per group (additions in bold):
  ```
  speciesCode, comName, locId, locName, lat, lng, recentDate, checklistCount, **subId**
  ```
- Client-side, the Engineer adds:
  - Recency tier calculation from `recentDate` (days since today → `fresh | mid | old`)
  - Exclusion of groups where `recentDate` is older than 30 days
  - "Most Recent" deduplication (one group per `speciesCode`, keeping the one with the newest `recentDate`)
  - Nearest-10 ranking using `distanceMiles()` (already in `MapExplorer.tsx`)

### `GET /nominatim/search` — new forward geocoding proxy
**File:** `backend/routers/nominatim.py` (new endpoint, same file as `POST /nominatim/counties`)
- Accepts `q` query parameter (place name or address string)
- Forwards to `https://nominatim.openstreetmap.org/search?q={q}&format=json&limit=5`
- Must use `User-Agent: SnowRaven/1.0` and the existing `_rate_lock` (≤1 req/sec)
- Returns an array of result objects; the Engineer uses only the first result's `lat` and `lon`
- `display_name` from results must pass through `escHtml()` if rendered in the UI

### CSS tokens — `frontend/src/globals.css`
- Existing tokens the feature reads: `--sr-map-visited`, `--sr-map-unvisited`, `--sr-map-personal`, `--sr-map-target`
- Three new tokens to add (both `:root` and `[data-theme="dark"]`):
  - `--sr-map-target-fresh` — ≤7 days (bright purple variant)
  - `--sr-map-target-mid` — 8–15 days (medium purple variant)
  - `--sr-map-target-old` — 16–30 days (faded purple variant)

### Key utility already in `MapExplorer.tsx`
- `distanceMiles(lat1, lng1, lat2, lng2)` — haversine function; already used for personal location radius filtering; powers the nearest-10 distance ranking directly

## No Data Layer Work Required
The Engineer can proceed directly to UI implementation. No migrations need to be written or run for this feature.

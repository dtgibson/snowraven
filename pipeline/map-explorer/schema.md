# Schema — Map Explorer
**Feature:** map-explorer
**Session:** 001
**Date:** 2026-05-22
**Stage:** 3 — The Architect
**Path:** Incremental

---

## Detection Summary

- 24 prior `schema.md` files exist across pipeline feature folders
- No persistent data storage changes (no new DB tables, no new file storage)
- Leaflet (`leaflet`, `react-leaflet`, `leaflet.heat`) already installed and in active use in `SpeciesDetail.tsx`
- `ObservationEntry` type already carries all fields the map modes need
- Two new stateless FastAPI proxy endpoints; one new frontend tab component

---

## Existing Structures — Used Unchanged

### Backend

**`backend/routers/taxonomy.py`**
- `_by_com: dict[str, str]` — module-level cache: `comName.lower() → speciesCode`
- `_ensure_loaded()` — populates cache from eBird taxonomy API on first call
- The `/map/recent-obs` endpoint imports and calls `_ensure_loaded()`, then reads `_by_com` directly to resolve species names to codes

**`backend/routers/apikeys.py`**
- `GET /settings/keys` — returns `{ ebird: str | null, openweather: str | null }`
- Used by the frontend to determine whether the eBird API key is configured; controls whether Hotspot and Media Targets fetch buttons are enabled

**Pattern: `httpx.AsyncClient` with 10-second timeout**
- Used in `weather.py` and `services/ebird.py`; adopted verbatim in the new `map.py` router

**Pattern: 401 on missing key**
- `map.py` returns HTTP 401 when `EBIRD_API_KEY` is absent from `os.environ`
- Matches the explicit requirement in NFR-03 (key must never leave the server)

### Frontend

**`ObservationEntry` (from `frontend/src/types.ts`)**
```ts
interface ObservationEntry {
  submissionId: string
  commonName: string
  scientificName: string
  date: string          // YYYY-MM-DD
  location: string
  locationId: string
  latitude: number | null
  longitude: number | null
  county: string | null
  count: number | null
  breedingCode: string | null
  speciesComments: string
  catalogIds: string[]
}
```
All fields used by My Sightings mode are already present.

**`DateRangeState` (from `frontend/src/types.ts`)**
```ts
interface DateRangeState { from: string; to: string }
```
Reused verbatim for the date range filter in My Sightings mode.

**`SetupRequired` component (`frontend/src/components/SetupRequired.tsx`)**
- Props: `title`, `body`, `steps`, `onGoToSettings`
- Used in My Sightings mode when no eBird backup is stored

**`HeatmapLayer` (inline in `SpeciesDetail.tsx`)**
- Accepts `points: [number, number, number][]` (lat, lng, weight)
- Called via `useMap()` hook; adds/removes `leaflet.heat` layer on the existing Leaflet instance
- Copied into `MapExplorer.tsx` as a local sub-component (no shared module — consistent with existing pattern)

**Leaflet icon patch (Vite workaround)**
```ts
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({ iconUrl: '...', iconRetinaUrl: '...', shadowUrl: '...' })
```
Copied into `MapExplorer.tsx` (same workaround needed for any new Leaflet component file).

---

## New Backend — `backend/routers/map.py`

### Endpoint 1: `GET /map/hotspots`

**Query parameters:**
| Param | Type  | Description              |
|-------|-------|--------------------------|
| `lat` | float | Center latitude          |
| `lng` | float | Center longitude         |
| `dist`| int   | Search radius in miles   |

**Calls eBird API:**
```
GET https://api.ebird.org/v2/ref/hotspot/geo
  ?lat={lat}&lng={lng}&dist={dist}&back=30&fmt=json
```

**Response (200):** JSON array of hotspot objects from eBird, passed through as-is:
```json
[
  {
    "locId": "L123456",
    "locName": "Central Park",
    "lat": 40.7812,
    "lng": -73.9665,
    "numSpeciesAllTime": 312
  }
]
```

**Error responses:**
- `401` — `EBIRD_API_KEY` absent from `os.environ`
- `502` — eBird API returned an error; `detail` field contains description

---

### Endpoint 2: `GET /map/recent-obs`

**Query parameters:**
| Param   | Type   | Description                                    |
|---------|--------|------------------------------------------------|
| `lat`   | float  | Center latitude                                |
| `lng`   | float  | Center longitude                               |
| `dist`  | int    | Search radius in miles                         |
| `codes` | str    | Comma-separated eBird species codes            |

**Calls eBird API:**
```
GET https://api.ebird.org/v2/data/obs/geo/recent
  ?lat={lat}&lng={lng}&dist={dist}&back=14&fmt=json
```

**Server-side processing:**
1. Parse `codes` query param into a set of species code strings
2. Call `_ensure_loaded()` from `taxonomy.py` to ensure `_by_com` is populated
3. Filter eBird response to observations whose `speciesCode` is in the requested set
4. Group by `(speciesCode, locId)` — one result entry per unique pair
5. For each group: keep `speciesCode`, `comName`, `locName`, `locId`, `lat`, `lng`, most recent `obsDt`, and `howManyStr` count

**Response (200):**
```json
[
  {
    "speciesCode": "norcar",
    "comName": "Northern Cardinal",
    "locId": "L123456",
    "locName": "Central Park",
    "lat": 40.7812,
    "lng": -73.9665,
    "recentDate": "2026-05-18 08:30",
    "checklistCount": 3
  }
]
```

**Error responses:**
- `401` — `EBIRD_API_KEY` absent
- `502` — eBird API error

---

### Registration in `backend/main.py`

Add after existing router imports:
```python
from routers.map import router as map_router
```
Add after existing `app.include_router(...)` calls:
```python
app.include_router(map_router)
```

---

## New Frontend — `frontend/src/components/MapExplorer.tsx`

### Props
```ts
interface MapExplorerProps {
  onGoToSettings: () => void
}
```

### Internal state shape
```ts
type ViewMode = 'sightings' | 'hotspots' | 'targets'

type MapPhase =
  | { tag: 'loading-saved' }
  | { tag: 'setup-required' }
  | { tag: 'ready'; observations: ObservationEntry[]; mlRows: MLExportRow[]; hasML: boolean }

type DisplayMode = 'pins' | 'heatmap'  // My Sightings only

// Shared across Hotspots + Media Targets
interface CenterPoint {
  lat: number | null
  lng: number | null
}

type HotspotPin =
  | { kind: 'visited';   locId: string; locName: string; lat: number; lng: number; speciesCount: number; lastVisit: string }
  | { kind: 'unvisited'; locId: string; locName: string; lat: number; lng: number }
  | { kind: 'personal';  locId: string; locName: string; lat: number; lng: number; obsCount: number; lastVisit: string }

interface TargetPin {
  speciesCode: string
  comName: string
  locId: string
  locName: string
  lat: number
  lng: number
  recentDate: string
  checklistCount: number
}
```

### Sub-components (all inline in `MapExplorer.tsx`)
- `HeatmapLayer` — copied from SpeciesDetail; renders `leaflet.heat` layer
- `SightingMarkers` — renders location-grouped pins for My Sightings mode; handles popup
- `HotspotMarkers` — renders DivIcon pins for visited/unvisited/personal categories
- `TargetMarkers` — renders labeled DivIcon pins for media target species
- `CenterPointControl` — lat/lng inputs + "Use my location" button (shared by Hotspots and Targets)
- `HotspotLegend` — color + icon legend displayed below map in Hotspot mode

### Key implementation notes

**Leaflet map instance reuse (FR-02, NFR-07)**
The `<MapContainer>` is rendered once and never unmounted. Mode-specific marker layers are added and removed via React state; the map viewport is preserved across mode switches.

**DivIcon pin shapes (FR-13, NFR-01)**
All hotspot pins use `L.divIcon` with inline SVG to provide both color and icon-shape distinction:
- Visited: green background + ✓ glyph (`var(--sr-map-visited)`)
- Unvisited: muted blue background + binoculars glyph (two filled circles) (`var(--sr-map-unvisited)`)
- Personal: amber background + ★ glyph (`var(--sr-map-personal)`)
- Media target: distinct color + species-initial label or pin glyph (`var(--sr-map-target)`)

**Geolocation consent (FR-09, FR-19, NFR-08)**
`navigator.geolocation.getCurrentPosition()` is called only inside the `onClick` handler of the "Use my location" button. It is never called on mount, on mode switch, or in any effect. Manual lat/lng inputs are always rendered and operable regardless of geolocation state.

---

## New CSS Tokens

Add to **both** `:root` and `[data-theme="dark"]` blocks in `frontend/src/globals.css`:

```css
/* Map Explorer pin colors */
--sr-map-visited:   #2d9b5f;   /* green  — visited hotspot  */
--sr-map-unvisited: #5b7fa6;   /* blue   — unvisited hotspot */
--sr-map-personal:  #c9842a;   /* amber  — personal location */
--sr-map-target:    #8b5cf6;   /* purple — media target pin  */
```

Dark-mode variants should be slightly lighter/more saturated to maintain contrast against dark backgrounds.

---

## Vite Proxy Addition

Add to `server.proxy` in `frontend/vite.config.ts`:
```ts
'/map': 'http://localhost:1620',
```

---

## Wire-up in `frontend/src/App.tsx`

- Add `MapExplorer` import
- Add a "Map" tab entry alongside the existing tabs
- Pass `onGoToSettings={() => setActiveTab('settings')}` to `<MapExplorer>`
- Tab label: "Map Explorer" (or "Map" for brevity in the tab bar — match existing tab label length)

---

## What Does NOT Change

| Area | Reason |
|------|--------|
| `ObservationEntry` type | All needed fields already present |
| `parseEbirdObservations.ts` | Parses the backup file; no changes needed |
| `parseMLExport.ts` | ML row structure unchanged |
| Any existing router | No modifications to existing endpoints |
| `leaflet`, `react-leaflet`, `leaflet.heat` | Already in `package.json`; no new packages |
| `globals.css` existing tokens | Only additions; no changes to existing tokens |

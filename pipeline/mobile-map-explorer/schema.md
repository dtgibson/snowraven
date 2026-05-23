# Schema — Mobile Map Explorer

## Path
Incremental (Extending existing schema)

---

## Current Schema State

This project uses file-based storage, not a relational database. The data layer consists of fixed-filename files in `data/` and a `.env` file for secrets.

### `data/ebird-backup.csv`
Stored eBird backup CSV. Fixed filename. Original filename tracked in `metadata.json`. Unchanged by this feature.

### `data/ml-export.csv`
Stored Macaulay Library export CSV. Fixed filename. Original filename tracked in `metadata.json`. Unchanged by this feature.

### `data/metadata.json`
Sidecar tracking display metadata for stored files.
```json
{
  "ebird": { "filename": "MyEBirdData.csv", "uploadedAt": "2026-05-01T12:00:00Z" },
  "ml": { "filename": "ML__20260501_USER123.csv", "uploadedAt": "2026-05-01T12:00:00Z" }
}
```
Unchanged by this feature.

### `backend/.env`
API keys: `EBIRD_API_KEY`, `OPENWEATHER_API_KEY`. Managed by `python-dotenv`. Unchanged by this feature.

### `data/map-defaults.json` — NEW in this feature
Fixed-filename JSON storing the user's saved default map location.
```json
{
  "lat": 37.8716,
  "lng": -122.2727,
  "dist": 25
}
```
Absent when no defaults have been saved. Written and deleted by the new `/settings/map-defaults` endpoints. Follows the established `data/` fixed-filename pattern.

---

## Changes in This Feature

### Added

**`data/map-defaults.json`**
New fixed-filename file in `data/`. Stores `{lat: float, lng: float, dist: int}`. Present only after the user saves defaults for the first time. Absent file = no defaults saved = 404 from GET endpoint.

**`backend/routers/mapdefaults.py`** — new file
Three endpoints:

```python
from pathlib import Path
import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, field_validator

router = APIRouter()

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
MAP_DEFAULTS_FILE = DATA_DIR / "map-defaults.json"


class MapDefaults(BaseModel):
    lat: float
    lng: float
    dist: int

    @field_validator('lat')
    @classmethod
    def validate_lat(cls, v: float) -> float:
        if not -90 <= v <= 90:
            raise ValueError('lat must be in [-90, 90]')
        return v

    @field_validator('lng')
    @classmethod
    def validate_lng(cls, v: float) -> float:
        if not -180 <= v <= 180:
            raise ValueError('lng must be in [-180, 180]')
        return v

    @field_validator('dist')
    @classmethod
    def validate_dist(cls, v: int) -> int:
        if v <= 0:
            raise ValueError('dist must be a positive integer')
        return v


@router.get("/settings/map-defaults")
def get_map_defaults() -> dict:
    if not MAP_DEFAULTS_FILE.exists():
        raise HTTPException(status_code=404, detail="No map defaults stored.")
    try:
        return json.loads(MAP_DEFAULTS_FILE.read_text(encoding="utf-8"))
    except Exception:
        raise HTTPException(status_code=500, detail="Could not read map defaults.")


@router.post("/settings/map-defaults")
def save_map_defaults(body: MapDefaults) -> dict:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    MAP_DEFAULTS_FILE.write_text(
        json.dumps({"lat": body.lat, "lng": body.lng, "dist": body.dist}),
        encoding="utf-8",
    )
    return {"ok": True}


@router.delete("/settings/map-defaults")
def delete_map_defaults() -> dict:
    if not MAP_DEFAULTS_FILE.exists():
        raise HTTPException(status_code=404, detail="No map defaults stored.")
    MAP_DEFAULTS_FILE.unlink()
    return {"ok": True}
```

### Modified

**`backend/main.py`**
Add two lines:
```python
from routers.mapdefaults import router as mapdefaults_router
app.include_router(mapdefaults_router)
```

**`frontend/src/components/Settings.tsx`**
New `MapDefaultsRow` sub-component. Positioned above the Default Files section.
- Three text inputs: Latitude, Longitude, Radius (miles)
- On mount: `GET /settings/map-defaults` — on 200, pre-fill inputs; on 404, leave blank
- Save button: validates inputs (numeric, in-range) then `POST /settings/map-defaults {lat, lng, dist}`; shows inline "Saved" confirmation on success; shows inline error on failure
- Clear button: `DELETE /settings/map-defaults`; resets inputs to blank; disabled when no defaults are stored
- State shape (local to Settings component):
  ```typescript
  const [mapLat, setMapLat] = useState('')
  const [mapLng, setMapLng] = useState('')
  const [mapDist, setMapDist] = useState('')
  const [mapDefaultsStatus, setMapDefaultsStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [mapDefaultsHasSaved, setMapDefaultsHasSaved] = useState(false)
  ```

**`frontend/src/components/MapExplorer.tsx`**
Two additions:

1. On mount: `GET /settings/map-defaults` — on 200, set `lat`, `lng`, and `radius` state (all three modes share these initial values). On 404 or error, no-op (existing defaults apply).

2. Mobile layout:
   - New state: `const [sidebarOpen, setSidebarOpen] = useState(false)`
   - Sidebar element: on desktop (>640px) always visible in the flex row; on mobile (≤640px) hidden from flow, shown as `position: absolute` overlay when `sidebarOpen` is true
   - Floating Filters button: `position: absolute; bottom: 16px; right: 16px; z-index: 1000` — visible only at ≤640px via CSS class; opens sidebar on click
   - Backdrop: a semi-transparent div (`position: absolute; inset: 0; background: rgba(0,0,0,0.4); z-index: 999`) rendered behind the sidebar when `sidebarOpen` is true on mobile; clicking it sets `sidebarOpen = false`
   - Close button added to sidebar header (visible only on mobile via CSS class); sets `sidebarOpen = false`
   - Breakpoint detection: CSS classes with `@media (max-width: 640px)` in `globals.css` — no JavaScript window width checks

**`frontend/src/globals.css`**
New CSS classes for mobile map layout:
```css
.sr-map-sidebar-overlay {
  /* default (desktop): normal flow, always visible */
}

@media (max-width: 640px) {
  .sr-map-sidebar-overlay {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    width: min(300px, 90vw);
    z-index: 1000;
    overflow-y: auto;
  }

  .sr-map-sidebar-overlay.sr-map-sidebar-hidden {
    display: none;
  }

  .sr-map-filters-btn {
    display: flex; /* shown on mobile */
  }

  .sr-map-sidebar-close {
    display: flex; /* shown on mobile */
  }

  .sr-map-backdrop {
    display: block; /* shown on mobile when sidebar open */
  }
}

.sr-map-filters-btn {
  display: none; /* hidden on desktop */
  position: absolute;
  bottom: 16px;
  right: 16px;
  z-index: 1000;
  /* styling: pill button using var(--sr-accent) */
}

.sr-map-sidebar-close {
  display: none; /* hidden on desktop */
}

.sr-map-backdrop {
  display: none;
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 999;
}
```

### Unchanged

- `data/metadata.json` — file metadata sidecar; not touched
- `data/ebird-backup.csv`, `data/ml-export.csv` — stored files; not touched
- `backend/.env` — API keys; not touched
- All existing settings endpoints (`/settings/files/*`, `/settings/keys/*`) — not touched
- `frontend/vite.config.ts` — `/settings` proxy already covers `/settings/map-defaults`; no change needed
- All other component files — not touched

---

## Migration Plan

No database migrations needed (file-based storage). Engineer steps in order:

1. Create `backend/routers/mapdefaults.py` with the three endpoints above
2. Add two lines to `backend/main.py` to register the router
3. Add CSS classes to `frontend/src/globals.css`
4. Add `MapDefaultsRow` to `frontend/src/components/Settings.tsx`
5. Add default-location fetch on mount + mobile layout to `frontend/src/components/MapExplorer.tsx`

---

## Design Decisions

- **Fixed-filename `data/map-defaults.json`** follows the established pattern for all stored data in this project. No path traversal risk; the destination is a constant.
- **404 = no defaults saved** — the GET endpoint returns 404 when the file is absent rather than returning null in a 200 body. This is consistent with the existing file endpoints and lets the frontend distinguish "no defaults" from "fetch error" cleanly.
- **CSS class breakpoints, not JS window checks** — mobile layout is controlled via `@media (max-width: 640px)` in globals.css, consistent with `.sr-two-col` and other responsive patterns in the project.
- **Sidebar overlay uses `position: absolute`** within the map panel (which has `overflow: hidden`), not `position: fixed`. This keeps the overlay scoped to the map panel and avoids z-index conflicts with the app header and tab bar.
- **No vite.config changes** — `/settings` is already proxied to port 1620; `/settings/map-defaults` is covered automatically.

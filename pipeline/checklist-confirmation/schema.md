# Schema — Checklist Confirmation Header

## Path
Frontend Only — No data layer changes required

## Confirmation
This feature has been assessed against the PRD and confirmed to require no database changes. No new tables, columns, relationships, or migrations are needed. The only change is surfacing data that is already fetched during the existing eBird API call.

## Existing Data Used by This Feature

### eBird Checklist View API (`/v2/product/checklist/view/{checklist_id}`)
The response object (`data` in `backend/services/ebird.py`) already contains:
- `data["locName"]` — the human-readable location name. Currently unused after being fetched; needs to be returned from `fetch_checklist()` and included in the endpoint response.
- `data["obsDt"]` — the observation datetime string (format: `"YYYY-MM-DD HH:MM"` or `"YYYY-MM-DD"`). Already used to parse `obs_dt` in `backend/routers/weather.py`; needs to be passed through to the response as-is (already trimmed to minute precision by eBird).

### `/weather/{checklist_id}` endpoint response (`backend/routers/weather.py`)
Currently returns: `{"formatted": str}`

After this feature: `{"formatted": str, "checklist_id": str, "loc_name": str, "obs_dt": str}`

### Frontend app state (`frontend/src/App.tsx`)
The `success` branch of `AppState` currently holds `formatted: string`. It needs two additional fields: `checklistId: string`, `locName: string`, `obsDt: string`.

## No Data Layer Work Required
The Engineer can proceed directly to implementation. No migrations need to be written or run.

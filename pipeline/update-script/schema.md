# Schema — Update Script + In-App Update Check

## Path
Frontend Only — No data layer changes required

## Confirmation
No database changes. No new tables, columns, relationships, or migrations. The feature adds a shell script, a new backend route that reads a local file and calls an external API, and a footer UI addition.

## Existing Data Used by This Feature

### `frontend/package.json`
- Field used: `version` (string, e.g. `"0.0.4"`)
- How used: read server-side by the new `/version/check` endpoint to determine the currently running version. The backend reads this file directly from the filesystem using a relative path — no new dependency needed.

### GitHub Releases API
- Endpoint: `https://api.github.com/repos/dtgibson/snowraven/releases/latest`
- Field used: `tag_name` (string, e.g. `"v0.0.5"` or `"0.0.5"`)
- How used: fetched server-side by `/version/check` only when the endpoint is called. The `tag_name` may have a `v` prefix — the Engineer should strip it before comparing against the semver in `package.json`.

### `/version/check` endpoint (new)
- Router file: `backend/routers/version.py` (new file, following the pattern of `backend/routers/weather.py`)
- Must be registered in `backend/main.py` alongside the existing weather router
- Response shape: `{ "current": str, "latest": str, "up_to_date": bool }`
- Error shape: standard FastAPI `{ "detail": str }` with status 503

### Vite dev proxy (`frontend/vite.config.ts`)
- Currently proxies `/weather` and `/health` to `http://localhost:1620`
- Must add `/version` to the proxy config so `/version/check` calls reach the backend during development

## No Data Layer Work Required
The Engineer can proceed directly to implementation. No migrations need to be written or run.

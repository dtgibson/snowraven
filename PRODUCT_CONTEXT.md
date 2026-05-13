# Product Context

This file is maintained by The Chronicler.
It records what has been built and key decisions made during development.

## Features Built

### Checklist Weather Lookup (complete — May 2026)

The core feature of SnowRaven. A single-page web app that accepts an eBird
checklist ID or URL, fetches historical weather for the checklist's time and
location, and returns a copy-and-pasteable formatted text block matching the
raincrow.app output format.

**What it does:**
- Accepts a bare checklist ID (`S12345678`) or full eBird URL — URL parsing strips path/query automatically
- Validates the ID format client-side and server-side before making any API call
- Calls the eBird One Call API to fetch checklist metadata (date, time, location, duration)
- Resolves coordinates using a three-tier fallback: hotspot/info → product/lists → recent obs
- Calls the OpenWeather One Call API 3.0 timemachine endpoint once per hour of checklist duration (concurrent via asyncio.gather)
- Formats output with emoji, Beaufort wind description, cardinal direction, temp/humidity/dew point ranges, sunrise/sunset, and HTML attribution
- Displays output in a monospace pre block with a one-click copy button
- Shows inline errors for invalid IDs, not-found checklists, and API failures

**Key files:**
- `backend/services/ebird.py` — eBird API client with coordinate fallback logic
- `backend/services/openweather.py` — OpenWeather timemachine API client
- `backend/formatters/weather.py` — pure formatting functions (Beaufort, cardinal, emoji, ranges)
- `backend/routers/weather.py` — GET /weather/{checklist_id} endpoint
- `backend/main.py` — FastAPI app, CORS, static file serving for production
- `frontend/src/App.tsx` — full single-page UI
- `start.sh` — production startup script (builds frontend, starts uvicorn on port 1620)
- `deploy/snowraven.service` — systemd unit for Raspberry Pi auto-start

**Running in development:**
```
# Terminal 1 — backend
cd backend && uvicorn main:app --reload --port 1620

# Terminal 2 — frontend
cd frontend && npm run dev
```
Frontend dev server runs on port 5173 and proxies `/weather` and `/health` to port 1620.

**Running in production:**
```
./start.sh
```
Builds the frontend into `frontend/dist/`, then starts uvicorn on port 1620.
FastAPI serves the built frontend as static files — no separate web server needed.

### Checklist Confirmation Header (complete — May 2026)

A one-line confirmation displayed after a successful weather lookup, showing the resolved checklist ID, location name, and observation time — matching the raincrow.app format (e.g. `S334315671 / Berkeley Community Garden / 2026-05-07 17:26`).

**What it does:**
- Appears between the `<hr>` divider and the "Weather output" label on successful lookup
- Displays `{checklist_id} / {loc_name} / {obs_dt}` in monospace, muted type
- Location name sourced from `ref/region/info` response (`result` field), falling back to `product/lists` loc object `name`, then to `locId`
- Not part of the copyable weather text block — display only

**Key files changed:**
- `backend/services/ebird.py` — added `loc_name` extraction with three-tier fallback
- `backend/routers/weather.py` — added `checklist_id`, `loc_name`, `obs_dt` to response
- `frontend/src/App.tsx` — extended `AppState` success type, added confirmation line to results UI
- `backend/tests/test_weather_router.py` — updated mock, added assertions, added date-only test case

### List Comparer (complete — May 2026)

A second tool added as a tab alongside the Weather lookup. Accepts two eBird
backup CSV files and computes which species appear in both lists and which are
unique to each. All logic is client-side — no network requests are made after
the initial page load.

**What it does:**
- Persistent tab bar switches between "Weather" and "List Comparer" without page reload or state loss
- Two drop zones accept eBird backup CSV files via drag-and-drop or click-to-browse
- Parses the "Common Name" column; rejects files missing that column with a clear error
- Excludes spuh entries (ending in " sp."), slash species (containing "/"), and hybrids (containing " x ")
- Strips subspecies parentheticals so "Yellow-rumped Warbler (Myrtle)" and "Yellow-rumped Warbler (Audubon's)" count as the same species
- Produces three alphabetically-sorted lists: in both, File A only, File B only
- Summary bar shows five counts: total A, total B, both, A only, B only
- "Show all / Collapse" toggle expands all three species panels to their full height for printing
- "Compare new files" button resets to the upload state

**Key files:**
- `frontend/src/components/ListComparer.tsx` — top-level state manager (files, result, expanded)
- `frontend/src/components/DropZone.tsx` — drag-and-drop + file picker with hover/error/loaded states
- `frontend/src/components/ResultsView.tsx` — stats bar, three panels, toggle and reset buttons
- `frontend/src/components/SpeciesPanel.tsx` — scrollable species list panel (collapses/expands via prop)
- `frontend/src/lib/parseEbird.ts` — CSV parser (quoted fields, CRLF, exclusions, normalization)
- `frontend/src/lib/compare.ts` — `compareSpecies(a, b)` pure function
- `frontend/src/types.ts` — `FileData` and `ComparisonResult` types

### eBird Edit Link (complete — May 2026)

After a successful weather lookup, an "Edit on eBird" link appears flush-right on the confirmation row (`S… / location / date`). Clicking it opens `https://ebird.org/edit/effort?subID={checklistId}` in a new tab, landing the user directly on the eBird edit page where they can paste the copied weather into the comment field.

**What it does:**
- Renders only in the success state — not visible during idle, loading, or error
- Link is constructed from `state.checklistId`, which is server-validated as `/^S\d+$/` before the success state is ever reached
- Opens in a new tab (`target="_blank"` + `rel="noreferrer"`) so the SnowRaven session is preserved
- Uses `ExternalLink` icon from lucide-react (11px) to signal outbound navigation
- Confirmation text truncates with ellipsis on narrow widths; link stays pinned right with `flexShrink: 0`

**Key files changed:**
- `frontend/src/App.tsx` — `ExternalLink` added to lucide import; confirmation `<div>` converted to flex row with link

### Life List (complete — May 2026)

A third tab that accepts an eBird backup CSV (`MyEBirdData.csv`) and generates
a full life list showing per-species media coverage — which species have been
photographed, audio-recorded, and video-recorded via the Macaulay Library.

**What it does:**
- Drop zone accepts `MyEBirdData.csv` via drag-and-drop or click-to-browse
- Parses one entry per unique species: Common Name, Scientific Name, Taxonomic Order, and the union of all ML Catalog Numbers across every observation row
- Excludes spuh (` sp.`), slash species (`/`), and hybrids (` x `) — same rules as List Comparer
- Strips the `ML` prefix from catalog numbers (e.g. `ML204818731` → `204818731`) and deduplicates
- POSTs catalog IDs in batches of 25 to `POST /ml/media-types` on the backend, which probes the Cornell CDN via HEAD requests to determine each asset's media type (Photo / Audio / Video)
- Shows a batch progress indicator while the lookup runs ("Looking up media… batch 3 of 12")
- Renders a species table with four status columns: Seen (always ✓), Photo, Audio, Video
- If the ML API is unreachable, shows an error banner above the list; the list still renders with "—" for unknown media
- Filter pills: All · No photo · No audio · No video (one active at a time)
- Sort toggle: Taxonomic order (default, uses lowest `Taxonomic Order` value per species) · A–Z
- Species count label: "312 species" or "47 of 312 species" when filtered
- "Show all / Collapse" toggle expands the full list for printing
- "Load new file" button resets to the upload state

**Key files:**
- `backend/routers/ml.py` — `POST /ml/media-types` proxy endpoint; queries ML search API per ID, returns `{catalog_id: mediaType}` map; 503 on failure
- `backend/tests/test_ml_router.py` — 5 tests: valid lookup, missing ID omitted, unreachable API → 503, empty input, string catalogId in response
- `backend/main.py` — ML router registered
- `frontend/src/lib/parseLifeList.ts` — CSV parser producing `LifeListEntry[]`; reuses parseCSVLine and isExcluded patterns from parseEbird.ts
- `frontend/src/lib/parseLifeList.test.ts` — 13 parser tests
- `frontend/src/components/LifeList.tsx` — top-level component with idle/error/loading/ready state machine, inline drop zone, batch progress bar, controls row
- `frontend/src/components/LifeListTable.tsx` — filtered/sorted species table with sticky header
- `frontend/src/types.ts` — `MediaType`, `MediaFilter`, `SortOrder` types added
- `frontend/src/App.tsx` — Life List tab added (display-toggle pattern)
- `frontend/vite.config.ts` — `/ml` proxy added for dev server

### Update Script + In-App Update Check (complete — May 2026)

Two small additions that make keeping SnowRaven current easy: a shell script for one-command updates, and a footer link that checks GitHub for a newer release on explicit user request only.

**What it does:**
- `update.sh` at the repo root: runs `git pull`, rebuilds the frontend, reinstalls backend deps, and restarts the systemd service if present — all in one command
- If no systemd service exists (local Mac/Linux install), the script skips the restart step and prints a manual note instead; exits 0
- `GET /version/check` backend endpoint: reads the current version from `frontend/package.json`, calls the GitHub releases API, and returns `{current, latest, up_to_date}`
- Footer displays "SnowRaven · Self-hosted Birding Tools · Check For Updates" — clicking the link triggers one `/version/check` call and shows inline state (checking → up-to-date/available/error), which reverts automatically after a timeout
- No passive network requests — the check fires only on explicit click; no `useEffect`, no polling

**Key files:**
- `update.sh` — one-command update script (chmod +x, fail-fast with `set -e` + `trap ERR`)
- `backend/routers/version.py` — `/version/check` endpoint with 5s GitHub API timeout
- `backend/tests/test_version_router.py` — 5 tests covering up-to-date, update-available, v-prefix stripping, missing file, unreachable GitHub
- `frontend/src/App.tsx` — `UpdateStatus` discriminated union, `handleUpdateCheck` callback, footer JSX with five states
- `frontend/vite.config.ts` — `/version` proxy added for dev server

## Key Decisions

**eBird coordinate fallback strategy**
The eBird checklist view API does not return lat/lng. Coordinates are fetched
separately. Public hotspots use `/ref/hotspot/info/{locId}`. Personal/private
locations require `/product/lists/{locId}`, whose response is an array with a
nested `loc` object using `latitude`/`longitude` keys (not `lat`/`lng`).
A third fallback to `/data/obs/{locId}/recent` handles edge cases.

**OpenWeather One Call API 3.0 requires explicit subscription**
The timemachine endpoint is not included in the free API key by default.
Users must subscribe to "One Call by Call" in their OpenWeather account
(first 1,000 calls/day free) before the API key will work on this endpoint.

**Port 1620**
Default port is 1620 (not 8000) because port 8000 was already in use.
Update `frontend/vite.config.ts`, `start.sh`, and `deploy/snowraven.service`
if you need a different port.

**Timezone resolution is offline**
`timezonefinder` resolves lat/lng → IANA timezone name without any API call.
`zoneinfo` (Python 3.9+ built-in) handles the timezone-aware datetime math.

**Production architecture is single-process**
FastAPI serves both the API and the built frontend static files. No nginx or
separate static file server is needed for local/Pi deployment. For
internet-facing installs, add a reverse proxy for HTTPS.

**Location name is not in the eBird checklist view response**
The `/v2/product/checklist/view/{id}` endpoint does not return `locName` as a top-level field. Location name is sourced from the `result` field of the `ref/region/info` response (primary coordinate path), or from `loc.name` in the `product/lists` response (fallback path), or falls back to `locId`. Use `.get()` with fallbacks — never `data["locName"]` directly.

**Tab switching uses display toggling, not conditional rendering**
The Weather and List Comparer tabs are both always mounted. Switching tabs
sets `display: none / flex` on each panel rather than unmounting the inactive
component. This preserves state (loaded files, comparison result, weather
output) when the user switches tabs and back.

**List Comparer is entirely client-side**
No backend changes were made for this feature. All CSV parsing, species
normalization, and comparison logic runs in the browser. This keeps the
backend simple and means the feature works even if the backend is unreachable.

**Version check is server-side by design**
The `/version/check` endpoint calls GitHub from the backend, not the browser.
This keeps the user's IP off GitHub's logs. The frontend just calls its own
backend — no cross-origin requests. This also means the check works on
local network installs where CORS would otherwise block a direct GitHub call.

**Media type lookup uses Cornell CDN HEAD requests, not the ML search API**
The Macaulay Library search API (`search.macaulaylibrary.org/api/v1/search`) does
not support catalog ID lookup — the `q` parameter performs general text search and
returns unrelated results. Media type is instead determined by probing the Cornell
CDN directly with HEAD requests:
- Photo:  `cdn.download.ams.birds.cornell.edu/api/v2/asset/{id}/1200`     → 200
- Audio:  `cdn.download.ams.birds.cornell.edu/api/v2/asset/{id}/mp3`      → 200
- Video:  `cdn.download.ams.birds.cornell.edu/api/v2/asset/{id}/mp4/1280` → 200

All IDs in a batch are processed concurrently via `asyncio.gather`. No API key
required. No response body is parsed — only HTTP status codes are checked.

**Frontend controls batching; backend processes all IDs in a batch concurrently**
The frontend sends catalog IDs in batches of 25 per POST request. This gives the
progress indicator accurate "batch X of Y" feedback after each response. Within
each batch, the backend fans out all IDs in parallel via `asyncio.gather`.

**ML catalog numbers in CSV may carry an "ML" prefix**
eBird's backup CSV stores catalog numbers as e.g. `ML204818731`. The parser strips
the `ML` prefix with `replace(/^ML/i, '')` before storing or sending IDs. The backend
normalizes IDs in API responses with `_normalize_id()` (strips non-digits) before
comparing, so string/numeric/prefixed catalogId values all match correctly.

**Life List drop zone is implemented inline, not via the DropZone component**
The existing `DropZone` component is coupled to the `FileData` type (which contains
a `species: Set<string>` field). Rather than retrofitting DropZone with generics,
`LifeList.tsx` implements its own minimal drop zone inline. The patterns are similar
but kept separate to avoid coupling unrelated features.

**Update script uses .venv/bin/pip explicitly**
`update.sh` calls `.venv/bin/pip` rather than relying on a `pip` in PATH.
This ensures the correct virtualenv is used regardless of the shell environment,
which matters on Raspberry Pi where system Python is separate from the venv.

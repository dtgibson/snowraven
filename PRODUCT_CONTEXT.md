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
- Excludes spuh entries (ending in " sp."), slash species (containing "/"), and hybrids (containing " x "); soundscape entries are included
- Strips subspecies parentheticals so "Yellow-rumped Warbler (Myrtle)" and "Yellow-rumped Warbler (Audubon's)" count as the same species
- Produces three alphabetically-sorted lists: in both, File A only, File B only
- Summary bar shows five counts: total A, total B, both, A only, B only
- "Show all / Collapse" toggle expands all three species panels to their full height for printing; in expanded mode the page switches to a normal scrollable layout so the header and tabs scroll away rather than staying pinned
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

### Media Life List (complete — May 2026)

A third tab that generates a full life list showing per-species media coverage
— which species have been photographed, audio-recorded, and video-recorded.
Accepts two input formats, auto-detected from the CSV header.

**Input formats (auto-detected — no user selection required):**
- **Macaulay Library export (preferred):** Sign in to Macaulay Library → My Media → Save Spreadsheet. Columns: `Catalog Number` (or `ML Catalog Number`), `Common Name`, `Scientific Name`, `Format`. Media types are read directly from the CSV — no backend CDN lookup required. Results appear instantly.
- **eBird backup CSV (secondary):** `MyEBirdData.csv` from the eBird account data download. Requires a backend batch lookup to determine media types per species via Cornell CDN HEAD requests.

**What it does:**
- Upload screen shows two drop zones: a prominent primary zone for ML export (with download instructions) and a compact secondary zone for eBird backup CSV
- Auto-detects file type by inspecting the CSV header: ML export if `catalog number`/`ml catalog number` + `format` columns present; eBird if `submission id` present; otherwise shows an error
- Parses one entry per unique species; normalizes subspecies parentheticals (e.g. "Yellow-rumped Warbler (Myrtle)" → "Yellow-rumped Warbler")
- Excludes spuh (` sp.`), slash species (`/`), and hybrids (` x `); soundscape entries are included as first-class rows
- Strips the `ML` prefix from catalog numbers and deduplicates
- **ML export path:** media types come from the `Format` column (Photo/Audio/Video) — client-side only, no network request
- **eBird path:** POSTs catalog IDs in batches of 10 to `POST /ml/media-types` (500ms inter-batch delay); shows batch progress ("Looking up media… batch 3 of 12")
- Renders a table with four columns: Entries, Photo, Audio, Video (no always-✓ "Media" column)
- Photo, Audio, and Video columns show a count of individual media items (integer in green); zero shows a dash
- Non-zero counts are clickable links — open Macaulay Library catalog filtered by species (taxon code), media type, and personal userId in a new tab
- `SpeciesLinks` favicon icons appear after each common name linking to eBird and Birds of the World species pages
- User ID parsed from ML export filename (`ML__DATE_USERID.csv`) and appended to all catalog links; warning shown if filename was renamed
- Taxon codes fetched via `POST /taxonomy/codes` after file load; ML links use `taxonCode=acowoo` parameter for accurate personal filtering
- All four column headers are clickable sort controls; clicking sorts by that column, clicking again reverses; count columns default to descending (highest first)
- **Filter pills (7 total):** All · No photo · No audio · No video · Has photo · Has audio · Has video (one active at a time; negative filters are red, positive filters are green)
- Sort toggle: Taxonomic (eBird input only, uses lowest Taxonomic Order value per species) · A–Z. Taxonomic button is hidden for ML export results (all entries have `taxonomicOrder: Infinity`).
- Species count label: "312 species" or "47 of 312 species" when filtered
- "Show all / Collapse" toggle expands the full list for printing
- "Load new file" button resets to the upload state

**Key files:**
- `backend/routers/ml.py` — `POST /ml/media-types` proxy endpoint; probes Cornell CDN via HEAD requests; `asyncio.Semaphore(8)` caps concurrency; 503 on failure
- `backend/tests/test_ml_router.py` — 5 tests: valid lookup, missing ID omitted, unreachable API → 503, empty input, string catalogId in response
- `backend/main.py` — ML router registered
- `frontend/src/lib/parseMLExport.ts` — ML export CSV parser: returns `{ entries, mediaMap }` from Macaulay Library export; client-side only; throws `INVALID_ML_EXPORT` on bad input
- `frontend/src/lib/parseMLExport.test.ts` — 15 parser tests
- `frontend/src/lib/parseLifeList.ts` — eBird backup CSV parser producing `LifeListEntry[]`
- `frontend/src/lib/parseLifeList.test.ts` — 13 parser tests
- `frontend/src/components/LifeList.tsx` — top-level component: dual drop zones, file type auto-detection, idle/error/loading/ready state machine, controls row
- `frontend/src/components/LifeListTable.tsx` — filtered/sorted species table; handles all 6 non-"all" filter cases including 3 positive filters
- `frontend/src/types.ts` — `MediaType`, `MediaFilter` (includes positive filters), `SortOrder` types
- `frontend/src/App.tsx` — Life List tab added (display-toggle pattern)
- `frontend/vite.config.ts` — `/ml` proxy added for dev server

### Species Links (complete — May 2026)

Inline eBird and Birds of the World favicon icons appear after every species common name in the
Media Life List and all three Life List Comparer panels. Clicking either icon opens that species'
page on the respective site in a new tab. Icons appear once taxon codes are resolved; rows with
no code (soundscapes, pre-fetch) show nothing.

**What it does:**
- `SpeciesLinks` component renders two 14×14 favicon `<img>` elements inside `<a target="_blank" rel="noreferrer">` tags
- eBird link: `https://ebird.org/species/{speciesCode}` — opens species account page with maps, photos, recent sightings
- BOW link: `https://birdsoftheworld.org/bow/species/{speciesCode}/cur/introduction` — opens full ornithological account
- Favicons loaded from `ebird.org/favicon.ico` and `birdsoftheworld.org/favicon.ico`; `onError` hides failed loads
- Icons at 75% opacity at rest, full opacity on hover
- In `LifeListTable`: `taxonMap` already available — codes passed directly to `SpeciesLinks` per row
- In `SpeciesPanel` (used by List Comparer): `taxonMap?: Record<string, string>` prop added; `ResultsView` threads it to all three panels
- In `ListComparer`: `taxonMap` state added; `fetchTaxonCodes` called fire-and-forget after `compareSpecies()` completes

**Key files:**
- `frontend/src/components/SpeciesLinks.tsx` — new shared inline component
- `frontend/src/components/LifeListTable.tsx` — `SpeciesLinks` added after common name
- `frontend/src/components/SpeciesPanel.tsx` — `taxonMap` prop added; `SpeciesLinks` per row
- `frontend/src/components/ResultsView.tsx` — `taxonMap` prop threaded to all three `SpeciesPanel` instances
- `frontend/src/components/ListComparer.tsx` — `taxonMap` state, `fetchTaxonCodes`, cleared on reset
- `backend/routers/taxonomy.py` — `POST /taxonomy/codes`; eBird taxonomy fetch + in-memory cache
- `frontend/vite.config.ts` — `/taxonomy` proxy added for dev server

### Breeding Code List (complete — May 2026)

A fourth tab that parses an eBird backup CSV and renders a species-by-breeding-code
matrix. Each cell shows a count of how many times that species was observed with that
code, rendered as a tier-colored circle. Entirely client-side — no backend changes.

**What it does:**
- Drop zone accepts `MyEBirdData.csv` (eBird backup); drag-and-drop or click-to-browse
- Parser extracts the `Breeding Code` column; specific error if the column is absent from the CSV
- Empty state (column present but no rows with valid codes) shows a non-error message
- 23 eBird breeding codes across four tiers: Confirmed highest (NY NE FS FY CF FL ON UN DD), Confirmed also (NB CN), Probable (PE B A N C T P M S9 S7), Possible (S H F)
- Only codes present in the loaded data appear as columns and filter pills (canonical order: confirmed → possible, left to right)
- Per-cell count circle: 28px, tier background color (4=`#3B0764` → 1=`#C084FC`), white 11px bold text; empty cells are truly blank — no dash or placeholder
- Species name column: sticky-left (`position: sticky; left: 0`), 190px, with a right-edge shadow separator
- Table wrapper `overflow-x: auto` allows horizontal scroll when many codes are present
- All columns sortable: species name defaults asc (A–Z); code columns default desc (highest count first); ties broken alphabetically
- Active sort column shows ↑/↓ indicator in `#2D8653`; inactive columns muted
- Filter pills row: "All" pill + one pill per code present, each with a 14px tier-colored dot; clicking a pill shows only species with ≥1 entry for that code; clicking the active pill resets to All
- Species count label: "8 species" (all) or "3 of 8 species" (filtered)
- Legend at the bottom of the table card maps tier colors to categories and codes
- "Show all / Collapse" and "Load new file" controls match the Media Life List pattern
- Spuh (` sp.`), slash species, and hybrids (` x `) excluded; subspecies parentheticals normalized to parent species name

**Key files:**
- `frontend/src/lib/breedingCodes.ts` — 23 code definitions (`code`, `label`, `tier`), `BREEDING_CODE_MAP`, `TIER_COLORS`
- `frontend/src/lib/parseBreedingCodes.ts` — CSV parser returning `{ entries, codesPresent, hasBreedingCodeColumn }`
- `frontend/src/lib/parseBreedingCodes.test.ts` — 15 tests covering parsing, exclusions, normalization, and error cases
- `frontend/src/components/BreedingCodeList.tsx` — top-level component: drop zone, phase state machine (idle/error/ready), filter pills, controls row
- `frontend/src/components/BreedingCodeTable.tsx` — species-by-code matrix with sticky column, sortable headers, circles, legend
- `frontend/src/types.ts` — `BreedingSortColumn`, `BreedingSortState`, `BreedingFilter` added

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

Probing is Photo-first and sequential per ID (avoids 3× fan-out). All IDs in a batch
are gathered via `asyncio.gather` but capped to 8 concurrent connections by a module-level
`asyncio.Semaphore`. No API key required. No response body is parsed — only HTTP status
codes are checked.

**Frontend controls batching; backend caps CDN concurrency with a semaphore**
The frontend sends catalog IDs in batches of 10 per POST request (with a 500ms delay
between batches). This gives the progress indicator accurate "batch X of Y" feedback
after each response and keeps cumulative CDN request rate below rate-limit thresholds.
Within each batch, the backend gathers all IDs concurrently but caps to 8 simultaneous
CDN connections via `asyncio.Semaphore(8)`.

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

**Expanded view switches the outer layout, not internal scroll**
When "Show all" is active, `App.tsx` switches from `height: 100vh; overflow: hidden`
to `minHeight: 100vh` (no clip), and the active tab panel drops its `overflowY: auto`
constraint. This lets the whole page scroll naturally so the header scrolls away.
Any future tab with an expand toggle should follow the `onExpandedChange` callback
pattern: the child notifies the parent, the parent controls the layout mode.

**Update script uses .venv/bin/pip explicitly**
`update.sh` calls `.venv/bin/pip` rather than relying on a `pip` in PATH.
This ensures the correct virtualenv is used regardless of the shell environment,
which matters on Raspberry Pi where system Python is separate from the venv.

**ML export is the preferred input; file type is auto-detected from header**
Rather than asking the user to choose input format, `LifeList.tsx` inspects the
CSV header row: if `catalog number` (or `ml catalog number`) + `format` columns
are present, it's an ML export; if `submission id` is present, it's an eBird
backup. Unknown headers get a clear error. The ML export path requires no backend
call — all media types come directly from the `Format` column.

**Column-header sorting replaced the standalone sort button**
The table is sorted by clicking column headers (Entries, Photo, Audio, Video).
Clicking a new column sorts by that column with its natural default direction
(name: A–Z ascending; counts: highest-first descending). Clicking the active
column toggles direction. The standalone A–Z button and taxonomic sort are gone.
`SortOrder` in `types.ts` is replaced by `SortState { column, dir }`.

**Soundscape entries are included in ML export parsing**
Macaulay Library exports include non-species entries like "Soundscape" with no
scientific name. These pass through `parseMLExport.ts` as first-class entries — the
`isExcluded()` function only excludes spuh (` sp.`), slash species (`/`), and hybrids (` x `).
Soundscape entries appear in the table with an empty scientific name cell and respond
to the standard filter pills (e.g. "Has audio") like any other entry.

**ML media links use taxon code + userId parameters for personal filtering**
ML catalog links are formed as `search.macaulaylibrary.org/catalog?mediaType=photo&taxonCode=acowoo&userId=USER1234567`.
The `taxonCode` parameter (not `taxaName`) is required for accurate per-species filtering.
The `userId` is parsed from the ML export filename via regex `^ML__.*_([A-Za-z0-9]+)\.csv$` — the default
ML filename format encodes the user's ID. If the filename was renamed, userId cannot be parsed and a
warning banner is shown; links fall back to `taxaName` without userId. When a taxon code is not yet
available (fetch pending), links also fall back to `taxaName`.

**Taxon codes are fetched from eBird taxonomy API and cached in process memory**
`POST /taxonomy/codes` accepts `[{commonName, scientificName}]` and returns `{codes: {commonName: speciesCode}}`.
On first call, the backend fetches the full eBird taxonomy (`api.ebird.org/v2/ref/taxonomy/ebird?fmt=json&cat=species`)
and builds two in-memory dicts: `_by_sci` (sciName → code) and `_by_com` (comName → code). Subsequent calls are
instant. Scientific name is tried first; common name is the fallback. Pass `scientificName: ''` to force common-name
lookup (used by `ListComparer` which has names but no sci names). Graceful degradation: any error returns `{codes: {}}`.

**`SpeciesLinks` is a shared inline component; renders null for soundscapes**
`SpeciesLinks` accepts `speciesCode: string | undefined` and renders two favicon links (eBird + BOW) when the code
is truthy, or `null` when falsy. This means soundscape entries, pre-fetch rows, and species not found in taxonomy
all silently show no icons — no broken state. Favicons are loaded from the live sites; `onError` hides any that
fail to load. Both `<a>` elements carry `rel="noreferrer"` to prevent tab-napping.

**Breeding code sort column is typed as `string`, not a discriminated union**
`BreedingSortColumn` is `string` rather than `'name' | BreedingCodeDef['code']` because the set of
active code columns is dynamic — determined at parse time from the CSV. Using `string` is correct here;
the valid values are enforced at the call sites where headers are rendered.

**`hasBreedingCodeColumn` flag distinguishes two empty states**
`parseBreedingCodes` returns `{ hasBreedingCodeColumn: boolean }` to distinguish "file has no Breeding Code
column at all" (user probably uploaded the wrong file) from "file has the column but no rows with valid codes"
(user hasn't entered breeding codes yet). These produce different UI messages: the former is an error banner;
the latter is a neutral empty state. Without this flag both cases would look like generic parse failures.

**Breeding code parser utilities are not shared with other parsers**
`parseCSVLine`, `isExcluded`, and `normalizeSpeciesName` exist in both `parseLifeList.ts` / `parseMLExport.ts`
and `parseBreedingCodes.ts`. Extracting them to a shared module was considered and rejected — it would create
a dependency between unrelated features on a utility whose behavior may need to diverge. Each parser owns its
own copy, matching the pattern established by the Life List drop zone being implemented inline rather than via
the shared DropZone component.

**ListComparer taxonomy fetch is fire-and-forget after comparison**
After `compareSpecies()` runs, `ListComparer` calls `fetchTaxonCodes` with the union of all species names from
`both`, `aOnly`, and `bOnly`. The comparison result is shown immediately; icons appear a moment later. On reset,
`taxonMap` is cleared to `{}` so stale codes do not bleed into the next comparison.

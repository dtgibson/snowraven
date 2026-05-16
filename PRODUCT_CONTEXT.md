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
Frontend dev server runs on port 5173 and proxies `/weather`, `/health`, `/version`, `/ml`, `/taxonomy`, and `/settings` to port 1620.

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
- Taxon codes and taxon order numbers fetched via `POST /taxonomy/codes` after file load; ML links use `taxonCode=acowoo` parameter for accurate personal filtering; taxon orders power the Taxonomic sort for ML export results
- All four column headers are clickable sort controls; clicking sorts by that column, clicking again reverses; count columns default to descending (highest first)
- **Filter pills (7 total):** All · No photo · No audio · No video · Has photo · Has audio · Has video — multi-select with AND logic; each media dimension (photo/audio/video) is tracked independently; selecting "Has photo" while "No photo" is active auto-replaces it; clicking an active pill deselects it; "All" resets all dimensions; negative active pills are red, positive are green; multiple pills can be active simultaneously
- Sort toggle: A–Z / Taxonomic — available for both ML export and eBird CSV inputs. For eBird CSV, uses the Taxonomic Order field parsed from the CSV directly; for ML export, uses taxon order numbers from the `POST /taxonomy/codes` response (same fetch that supplies taxon codes). Species not found in taxonomy sort last. The toggle persists as a tiebreaker when sorting by Photo/Audio/Video count columns.
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
- Favicons loaded from `ebird.org/favicon.ico` and `birdsoftheworld.org/favicon.ico`; `onError` hides failed loads; carry `className="sr-favicon"` for dark-mode CSS filter treatment
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
- All columns sortable: species name defaults asc (A–Z); code columns default desc (highest count first); ties broken by the active name sort mode (A–Z or Taxonomic)
- Active sort column shows ↑/↓ indicator in `#2D8653`; inactive columns muted
- A–Z / Taxonomic toggle: defaults to A–Z; Taxonomic orders species by eBird taxon number (fetched from `POST /taxonomy/codes`); unranked species sort last; toggle preserved as tiebreaker when sorting by any code column
- Filter pills row: "All" pill + one pill per code present, each with a 14px tier-colored dot — multi-select with AND logic; multiple code pills can be active simultaneously; the table shows only species that have ≥1 recorded observation for every active code; clicking an active pill removes it from the filter; "All" resets to unfiltered
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

### Settings Tab (complete — May 2026)

A Settings tab (rightmost in the tab bar) where users upload and persistently store their eBird backup CSV and ML export on the server filesystem. Stored files auto-load in the Breeding Codes and Media List tabs on every page visit, eliminating repeated uploads between sessions.

**What it does:**
- Two file management sections: eBird Backup (for Breeding Codes) and ML Export (for Media List) — each shows stored filename + upload date, or an empty "No file saved" state
- Upload sends `multipart/form-data` POST; validated server-side (`.csv` extension only, 50 MB limit)
- Clear button removes the stored file from disk and clears metadata; disabled when no file is stored
- On app mount, Breeding Codes and Media List tabs start in `loading-saved` phase (spinner, no upload zone flash), auto-fetch their stored file, parse it, and enter the ready state automatically
- A green chip in the data tab toolbar shows the stored filename when auto-load succeeded; "Load different file" returns to idle without touching the server file
- Uploading directly through a tab's own upload UI is session-only — the server default is untouched and restores on next page load

**Key files:**
- `backend/routers/settings.py` — 7 endpoints: `GET /settings/files`, `POST/GET/DELETE /settings/files/ebird`, `POST/GET/DELETE /settings/files/ml`; writes to fixed paths in `data/`
- `backend/tests/test_settings_router.py` — 9 tests using `monkeypatch` + `tmp_path` to isolate filesystem
- `frontend/src/components/Settings.tsx` — new Settings tab component with `FileRow` sub-component
- `frontend/src/components/BreedingCodeList.tsx` — `loading-saved` phase added, auto-load `useEffect`, `savedFileInfo` state and indicator chip
- `frontend/src/components/LifeList.tsx` — same pattern; `userId` parsed from stored metadata filename field

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

### API Key Settings (complete — May 2026)

An "API Keys" section added above "Default Files" on the Settings tab. Users can enter, save, and manage their eBird and OpenWeather API keys directly in the UI, without editing `.env` files by hand.

**What it does:**
- Two rows — eBird API Key and OpenWeather API Key — each with "Add key" / "Update", "Clear", and Show/Hide controls
- Keys are written to `backend/.env` via `python-dotenv` and applied to `os.environ` immediately — no server restart required
- Saved keys display as `••••••••••••••••` by default; "Show" reveals the value, "Hide" re-masks it
- "Add key" / "Update" expands an inline edit area with a monospace text input; Save is disabled until the field has content; Enter key submits
- "Clear" removes the key from `.env`, `os.environ`, and the UI
- Keys load on Settings tab mount alongside file status via a parallel fetch to `/settings/keys`
- Error messages shown inline below the row on save or delete failure

**Key files:**
- `backend/routers/apikeys.py` — `GET/POST/DELETE /settings/keys/{ebird|openweather}`; `KEY_MAP` allowlist; `python-dotenv` `get_key`/`set_key`/`unset_key`; writes to `backend/.env`
- `backend/tests/test_apikeys_router.py` — 11 tests using `monkeypatch` + `tmp_path` to isolate `.env`
- `backend/main.py` — apikeys router registered
- `frontend/src/components/Settings.tsx` — `KeyRow` component, `ApiKeyStatus` interface, per-slot state (visible/editing/input/saving/error), handlers

### Dark Mode (complete — May 2026)

Full dark theme with automatic OS preference detection, no flash of the wrong theme on load, and a consent-gated localStorage preference stored only after explicit user approval.

**What it does:**
- Settings → Appearance section (above API Keys) has a three-option toggle: System / Light / Dark. Default is System — follows OS preference, writes nothing to the browser.
- Anti-flash inline `<script>` in `index.html` reads `sr-theme` from localStorage (or falls back to `prefers-color-scheme`) and sets `data-theme` on `<html>` synchronously before first paint — no white flash for dark-mode users.
- Consent flow: selecting Light or Dark applies the theme immediately, then shows an inline prompt ("Save preference" writes to localStorage; "This session only" dismisses without writing). Once consent has been given for this browser, future Light/Dark changes are silent. Selecting System removes `sr-theme` from localStorage and shows no prompt.
- All component colors use `var(--sr-*)` CSS custom properties — no hardcoded hex in any component file. `:root` defines the light palette; `[data-theme="dark"]` overrides all tokens for dark.
- Dark palette: zinc-based backgrounds (`#09090B` page, `#18181B` surface), `#34D399` emerald accent (better contrast than the light-mode green on dark surfaces), lightened purple tier colors for breeding code badges.
- `--sr-tier-N-rgb` variables hold RGB triplets for use in `rgba(var(--sr-tier-N-rgb), alpha)` inline styles where dynamic alpha is needed.
- External favicons in `SpeciesLinks` carry `className="sr-favicon"`; `globals.css` applies `filter: brightness(0) invert(1); opacity: 0.65` in dark mode to keep them visible.

**Key files:**
- `frontend/index.html` — anti-flash inline script
- `frontend/src/globals.css` — complete `--sr-*` token system for both themes, plus `.sr-favicon` dark mode rule
- `frontend/src/lib/theme.ts` — `applyTheme(pref)` and `readStoredPreference()` with private-browsing-safe localStorage access
- `frontend/src/components/Settings.tsx` — `AppearanceRow` component with consent flow
- All other component files — colors migrated to `var(--sr-*)` tokens

### Species Detail (complete — May 2026)

A fifth data tab that shows a complete per-species view from the user's eBird backup. Select any species from a taxonomically-sorted dropdown to see sighting history, media coverage, breeding code breakdown, field notes, top locations, a sighting map, and embedded media. Entirely frontend — no new backend endpoints.

**What it does:**
- Auto-loads from the stored eBird backup in Settings on mount; shows an upload drop zone as fallback when no file is stored (`loading-saved` pattern)
- If an ML export is also stored, loads it in parallel for media data
- Searchable species selector: type to filter by common or scientific name; list sorts taxonomically after a fire-and-forget `POST /taxonomy/codes` fetch (immediately usable A–Z while fetch is pending)
- **Subspecies toggle** — toolbar `ToggleSwitch` ("Show subspecies") defaults to OFF (merged). In merge mode all subspecies variants (e.g. "Yellow-rumped Warbler (Myrtle)" + "(Audubon's)") are collapsed to the parent name; all statistics, codes, locations, comments, and map pins aggregate across every matching subspecies. Toggling ON switches to exact-name mode; selection resets when switching from merge→show since the normalized name may not exist as an exact entry.
- **Spuh/slash toggle** — second `ToggleSwitch` ("Show sp./slash") defaults to OFF (hidden). Hides entries where `name.endsWith(' sp.')` or `name.includes('/')`.
- **Summary card:** species common name (large heading), scientific name (italic) with inline eBird + Birds of the World favicon links (via `SpeciesLinks`), three media indicator buttons (Photo/Audio/Video — filled when ML export is loaded and that type has catalog items, grey when absent, "unavailable" when no ML loaded), and a breeding category pill (Confirmed/Probable/Possible based on highest-tier code recorded — absent when no codes)
- **Sightings section:** two totals — Checklists (count of eBird entries) and Individuals (sum of numeric counts; "—" when all counts are X/presence-only); first seen (link to checklist), last seen (link), personal best count (link); Sightings and Media cards sit in a `.sr-two-col` responsive grid (2-column on desktop, 1-column at ≤640px)
- **Media statistics:** Photo/Audio/Video counts as links to Macaulay Library catalog filtered by species + media type + userId; "Load ML export in Settings" message when no ML loaded
- **Breeding codes:** each unique code recorded for the species, with tier-colored dot, abbreviation, full label, and count; sorted tier 4→1 then canonical order; "No breeding codes recorded" empty state
- **Top locations:** ranked list (by observation count) of every unique location; top 10 shown by default with "Show all N locations" / "Show top 10" expand-collapse; locations with a valid `/^L\d+$/` ID link to `ebird.org/loc/{id}` (works for both public hotspots and personal locations); invalid or missing IDs render as plain text
- **Sighting locations map:** interactive Leaflet/OpenStreetMap map; one marker per unique lat/lng pair among the selected species' observations; bounds auto-fit on species change (single coordinate → `setView` zoom 12, multiple → `fitBounds` with 30px padding); each marker opens a Popup listing up to 6 dated checklist links ("+N more" overflow label); map hidden when no coordinates are available; 380px tall on desktop, 300px on ≤640px
- **Comments archive:** all non-empty per-species field notes from the eBird backup; sortable (newest/oldest); filterable by keyword (case-insensitive); first 10 shown with "Show all N comments" expand button; each date is a link to the corresponding checklist
- **Embedded recent media:** when ML export is loaded and the species has catalog items, the most recently uploaded Photo, Audio, and/or Video (numerically highest catalog ID = most recently uploaded) is embedded via `macaulaylibrary.org/asset/{id}/embed` iframe; responsive 3-column CSS grid (`repeat(3, minmax(0, 1fr))`), 280px tall on desktop, full-width 360px on mobile; `scrolling="no"` + `overflow: hidden` suppress iframe scrollbars; section appears at the very bottom of the detail view
- **Show all / Collapse** toolbar button follows the `onExpandedChange` pattern: toggles full-height layout for mobile viewing and printing
- Switching species instantly replaces all sections (all data already parsed client-side)
- `submissionId` values validated against `/^S\d+$/` before use in any `href` attribute; catalog IDs validated against `/^\d+$/`; location IDs validated against `/^L\d+$/`

**Key files:**
- `frontend/src/lib/parseEbirdObservations.ts` — character-level CSV parser; one `ObservationEntry` per CSV row; reads Location ID, Latitude, Longitude columns in addition to all prior fields; throws `INVALID_EBIRD` if required columns missing
- `frontend/src/lib/parseEbirdObservations.test.ts` — 24 tests
- `frontend/src/components/SpeciesDetail.tsx` — full tab component; `Phase` discriminated union (`loading-saved | idle | error | ready`); inline sub-components `SectionCard`, `SectionHead`, `StatLabel`, `StatValueLink`, `ToggleSwitch`, `MapBoundsFitter`; `CoordMarker` type for grouped marker sightings; Leaflet icon CDN patch at module level
- `frontend/src/types.ts` — `ObservationEntry` now includes `locationId`, `latitude`, `longitude`
- `frontend/src/globals.css` — `.sr-map-container`, `.sr-media-grid` (CSS grid 3-col), `.sr-media-item`, `.sr-media-iframe` with responsive overrides
- `frontend/src/App.tsx` — `'species-detail'` tab (unchanged structure)

### Breeding Code Category Filters (complete — May 2026)

Three category filter pills — Confirmed, Probable, and Possible — added to the Breeding Codes tab filter row. Each pill selects all codes in that eBird evidence category with one click. Individual code pills remain fully functional alongside them.

**What it does:**
- "Confirmed" pill selects all tier 3 + 4 codes (NY NE FS FY CF FL ON UN DD NB CN) — any species with at least one of these qualifies
- "Probable" pill selects all tier 2 codes (PE B A N C T P M S7)
- "Possible" pill selects all tier 1 codes (S H F)
- Filter logic: OR within each active category, AND across active categories and individual code pills
- Multiple categories can be active simultaneously
- "All" clears both category filters and individual code filters
- A category pill is hidden when none of its member codes appear in the loaded data
- Category pills are text-only (no tier dot) and appear between "All" and the individual code pills

**Key files:**
- `frontend/src/lib/breedingCodes.ts` — `BreedingCategory` type and `CATEGORY_CODES` constant added (derived programmatically from `BREEDING_CODES` tier field)
- `frontend/src/lib/breedingCodes.test.ts` — 8 tests covering category membership, disjointness, and full coverage
- `frontend/src/components/BreedingCodeList.tsx` — `categoryFilter` state, `categoryPillStyle`, `CATEGORY_META`, updated filter predicate, `categoryFilteredEntries` passed to `BreedingCodeTable`

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

**Sort architecture: column-header sort + A–Z / Taxonomic name toggle**
Column headers (Entries, Photo, Audio, Video; breeding code columns) are clickable sort controls. An A–Z / Taxonomic toggle button on each tab controls how the name column sorts. The two are independent: clicking a count column header preserves the active nameSortMode as a tiebreaker via `{ ...sort, column, dir }` spread in `handleHeaderClick`. `SortState` has three fields: `column`, `dir`, and `nameSortMode: 'az' | 'taxonomic'`. Always spread `{ ...sort }` when changing column or dir — never replace the whole object, or the nameSortMode preference is lost.

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

**`/taxonomy/codes` returns taxon orders alongside species codes — no new endpoint**
The `POST /taxonomy/codes` response was extended to include `orders: {commonName: taxonOrder}` alongside `codes`. The backend builds a third in-memory dict `_by_order` (comName.lower() → int taxonOrder) from the eBird taxonomy fetch. No new endpoint or additional network call is needed. Codes and sort orders arrive in a single response, keeping the fetch atomic. Graceful degradation: any fetch error returns `{codes: {}, orders: {}}`.

**Subspecies merge defaults to ON; toggling to show-subspecies resets the species selection**
In the Species Detail tab, merged view is the default (`mergeSubspecies: true`). This is consistent with how all other tabs (Life List, List Comparer, Breeding Codes) normalize parentheticals. When switching from merge→show, the selection is cleared because the merged parent name (e.g. "Yellow-rumped Warbler") may not exist as an exact entry in show-subspecies mode. When switching from show→merge, the current selected name is normalized and kept selected. Both toggles reset to their defaults when a new file is loaded or "Load different file" is clicked.

**Location links use `/loc/` not `/hotspot/` on eBird**
`ebird.org/loc/{locationId}` works for all eBird location IDs (both public hotspots and personal locations). `ebird.org/hotspot/{locationId}` returns an error for personal/private locations. Always use `/loc/` for location ID links.

**Leaflet map marker icons require a CDN patch in Vite builds**
Vite's asset hashing breaks Leaflet's default mechanism for resolving marker icon URLs (it walks `_getIconUrl` which relies on a `data-url` import trick that Vite doesn't replicate). Fix: delete `_getIconUrl` from `L.Icon.Default.prototype` (requires `// eslint-disable-next-line @typescript-eslint/no-explicit-any`) then call `L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl })` pointing to the unpkg CDN for the matching Leaflet version. This must run at module level, not inside a component or effect.

**Leaflet popup inline styles use hardcoded hex for link colors**
CSS variables (`var(--sr-*)`) are not reliably inherited inside Leaflet popup DOM, which is rendered outside the React tree by Leaflet itself. Popup link colors use `#2D8653` (the light-mode accent) directly. This is a known limitation — acceptable given the popup is a small secondary UI element and the app's threat model doesn't require dark-mode support inside popups.

**Media grid uses CSS grid `repeat(3, minmax(0, 1fr))` instead of flex**
Flexbox `flex: 1` on media items causes a single item to stretch to full width, making a lone photo embed look awkward (wide + constrained height). CSS grid with three equal fixed columns means one item takes 1/3 width, two items take 2/3, three items fill all columns — proportional regardless of item count. Mobile overrides to `grid-template-columns: 1fr` (single column, taller iframes). `scrolling="no"` + `overflow: hidden` on the iframe suppress any scrollbars the embedded content would otherwise produce.

**Server-side file storage uses fixed on-disk filenames; client filename in metadata only**
`data/ebird-backup.csv` and `data/ml-export.csv` are the fixed on-disk paths regardless of what the user uploads. The original filename is stored in `data/metadata.json` (`{"ebird": {"filename": "...", "uploadedAt": "..."}, "ml": ...}`) for display only — never used to construct a file path. This eliminates path traversal risk entirely. `data/` is gitignored. `DATA_DIR` is resolved from `__file__` in `settings.py` (three `.parent` hops) so the path is correct regardless of CWD when uvicorn starts. Any future stored file type should follow the same fixed-filename + metadata sidecar pattern.

**`loading-saved` is the initial phase for tabs that auto-load from stored files**
`BreedingCodeList` and `LifeList` initialize to `{ tag: 'loading-saved' }` rather than `{ tag: 'idle' }`. Without this, the upload zone flashes on screen before the auto-load check completes. The phase shows a spinner and transitions to `ready` on success or `idle` on failure / no stored file. Any future tab that checks for a stored default on mount must follow this same initial-state pattern.

**Taxonomic sort for ML export uses the taxonomy fetch fallback**
ML export entries have `taxonomicOrder: Infinity` (no order field in the CSV). `getOrder()` in `LifeListTable` returns `entry.taxonomicOrder` if finite (eBird CSV path), otherwise falls back to `taxonOrders[commonName] ?? Infinity` from the taxonomy fetch. This makes taxonomic sort available for both input formats without source-specific branching in the sort logic itself. Species absent from the taxonomy sort last on both paths.

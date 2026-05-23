# Changelog

All notable changes to SnowRaven are documented here.

## [0.1.2] - 2026-05-23

### Improved
- **Map Explorer — tab centering** — clicking Hotspots or Media Targets now immediately re-centers the map to the user's saved default location at the appropriate zoom level, replacing the previous behavior where the map stayed frozen at the My Sightings scale.
- **Map Explorer — tab auto-fetch** — switching to Hotspots or Media Targets automatically triggers the fetch if a default location is saved, so results appear without requiring an extra button click.
- **Map Explorer — target label legibility** — media target species-name pills now use `display: inline-block` so the colored background spans the full width of the species name (previously it was clipped to 12px, Leaflet's default icon size). Added a white border and stronger box-shadow so pins stand out clearly from OSM map tiles.

## [0.1.1] - 2026-05-22

### Fixed
- **Map Explorer — mobile overlay not working** — the sidebar's inline `display: flex` style overrode the CSS class's `display: none`, so the sidebar was permanently visible on mobile and pushed the map aside instead of overlaying it. Moved `display`, `flex-direction`, and `overflow` out of the inline style and into the CSS base class so the media query can correctly toggle them.
- **Map Explorer — Filters button hidden under map** — the floating Filters button, sidebar overlay, and backdrop had z-indices of 30, 40, and 50, all below Leaflet's internal layers (tiles at 200, markers at 600, controls at 1000). Raised to 1050, 1100, and 1200 respectively.
- **Map Explorer — map not centering on saved default location** — loading map defaults pre-filled the lat/lng/radius fields but left the map centered on North America. Added `DefaultCenterSetter`, a null-rendering child inside `MapContainer` (same pattern as `MapPanner`), that calls `map.setView()` once when defaults load, using a zoom level derived from the saved radius.

## [0.1.0] - 2026-05-22

### Added
- **Map Explorer — mobile layout** — on viewports ≤640px the map now fills the full screen with no sidebar visible by default. A green "Filters" pill button floats in the bottom-right corner of the map. Tapping it opens the filter sidebar as a full-height overlay with a dark backdrop; tapping the backdrop or the close button in the sidebar header dismisses it. Desktop layout (>640px) is pixel-identical to before.
- **Settings — Default Location** — new section at the bottom of the Settings page with Latitude, Longitude, and Radius (mi) inputs. Saving persists the values server-side (`data/map-defaults.json`). The Map Explorer reads these defaults on mount and pre-fills the coordinate fields for all three map modes (My Sightings, Hotspots, Media Targets). Clear removes the saved defaults and resets the fields.
- **`GET /settings/map-defaults`** — returns saved default location or 404 if none saved.
- **`POST /settings/map-defaults`** — saves `{lat, lng, dist}` with server-side validation (lat ∈ [−90, 90], lng ∈ [−180, 180], dist > 0).
- **`DELETE /settings/map-defaults`** — removes saved default location.

## [0.0.45] - 2026-05-22

### Fixed
- **Map Explorer — build failure** — `handleFindHotspots` and `handleFindSightings` were passed directly as `onClick` handlers after being changed to accept optional parameters. `tsc -b` (used by the build and update script) correctly rejected the `MouseEvent`-to-`number` type mismatch that `tsc --noEmit` missed. Wrapped both handlers in arrow functions so the mouse event is absorbed and not forwarded.

## [0.0.44] - 2026-05-22

### Added
- **Map Explorer — Address geocoding** — both Hotspots and Media Targets sidebars now have a "Search by place name" field above the lat/lng inputs. Typing a place name and pressing Enter (or clicking the search icon) resolves the address via Nominatim, populates the coordinates, and immediately triggers a fetch. Inline errors shown for no-result and network-failure cases.
- **Map Explorer — Hotspot legend toggles** — each legend row (Visited, Unvisited, Personal) is now a clickable button that hides or shows that pin category on the map. Hidden rows render at 40% opacity. All categories restore to visible on each new fetch.
- **Map Explorer — Media Targets recency tiers** — target pins are now color-coded by three green shades: fresh (≤7 days, vivid), mid (8–15 days, medium), old (16–30 days, faded). Sightings window extended from 14 to 30 days. Pins older than 30 days excluded by the eBird API.
- **Map Explorer — Last 30 Days / Last Week toggle** — segmented toggle in the Media Targets sidebar filters displayed pins client-side. "Last 30 Days" shows all pins within the window; "Last Week" shows only pins with a sighting in the past 7 days. No network request on toggle.
- **Map Explorer — Checklist link in popup** — each target pin popup now includes a "View checklist {subId}" link that opens the eBird checklist in a new tab. Only shown when a valid subId (matching `/^S\d+$/`) is present.
- **Map Explorer — Nearest-10 sidebar list** — Media Targets sidebar shows a ranked list of the ten closest pins sorted by haversine distance from the center point. Each row shows species name, location, distance in miles, and a tier dot. Clicking a row pans the map to that pin.
- **`GET /nominatim/search`** — new backend endpoint that forward-geocodes a place name via Nominatim OSM, sharing the existing rate-lock (≤1 req/sec) and User-Agent header.
- **CSS tokens** — `--sr-map-target-fresh`, `--sr-map-target-mid`, `--sr-map-target-old`, `--sr-map-target-old-text` added to both light and dark theme blocks in `globals.css`.

## [0.0.43] - 2026-05-22

### Fixed
- **Map Explorer — grey map tiles** — `MapContainer` initialises inside a hidden tab panel when data loads while the user is on another tab, giving Leaflet a 0×0 container. Added `AutoSizeMap` (a `ResizeObserver`-backed child component) that calls `map.invalidateSize()` whenever the container changes size, and updated `SightingMarkers` to defer `fitBounds` until the container reports a non-zero size — falling back to Leaflet's `resize` event if the container is still hidden at mount time.
- **Map Explorer — "Use my location" silent failure** — browsers block `navigator.geolocation` on non-secure HTTP origins (except `localhost`). The button now checks `window.isSecureContext` before calling the API and immediately shows a clear message ("Location detection requires HTTPS") instead of a generic fallback. Permission-denied errors are also reported distinctly from general unavailability.

## [0.0.42] - 2026-05-22

### Added
- **Map Explorer** — new tab with three view modes: My Sightings plots all personal eBird observations as weighted circle pins on an interactive map with real-time filters (species, date range, county, breeding code tier, media coverage) and a pins/heatmap toggle; Hotspots fetches nearby eBird hotspots and classifies them as visited (green ✓), unvisited (blue ⬤⬤), or personal (amber ★) using stored backup data; Media Targets identifies species with no ML media and finds where they've been recently reported near a chosen location, showing label pins per (species, location) pair.
- **`GET /map/hotspots`** — new FastAPI endpoint proxying the eBird hotspot geo API; returns 401 when no key is configured.
- **`GET /map/recent-obs`** — new FastAPI endpoint proxying eBird recent geo observations, filtered and grouped by (speciesCode, locId) server-side.
- **Map pin CSS tokens** — `--sr-map-visited`, `--sr-map-unvisited`, `--sr-map-personal`, `--sr-map-target` added to both light and dark theme blocks in `globals.css`.

## [0.0.41] - 2026-05-22

### Changed
- **Settings-first file model** — Breeding Codes, Media List, and Species Detail tabs no longer offer per-tab file upload. They load automatically from files stored in Settings, and show a guided "Go to Settings" screen when no file is configured. This completes the model started with the Settings file storage feature.
- **Life List Comparer — My List mode** — when an eBird backup is stored in Settings, the comparer offers "My List" as List A. Select it, upload any other eBird backup as List B, and compare without hunting for your own file. Results use "My List" / "Other List" as labels instead of filenames.
- **Weather tab key notices** — amber warning cards appear above the checklist input when the eBird or OpenWeather API key is not configured, with a "Go to Settings →" link.

## [0.0.40] - 2026-05-22

### Fixed
- **Species Detail graph TypeScript error** — removed an incorrect `as React.SVGProps<SVGTextElement>` type cast on shared axis props introduced in v0.0.39; `tsc -b` (used by the build and update script) rejected it with 4 errors while `tsc --noEmit` silently accepted it, causing the Pi update to fail mid-build
- **Update script working directory bug** — `cd frontend && npm ci && npm run build && cd ..` left the shell stranded in `frontend/` when the build failed, making the subsequent `cd backend` fail with "No such file or directory"; changed both directory-sensitive blocks to use subshells `(cd dir && ...)` so failures can't corrupt the working directory
- **Missing `package-lock.json`** — lockfile was present locally but never committed; `npm ci` on the Pi fell back to a stale lockfile with mismatched package versions, and `npm audit` failed entirely with ENOLOCK; lockfile now committed and kept current
- **`brace-expansion` vulnerability** — moderate severity DoS advisory patched via `npm audit fix` (updated from affected range 5.0.2–5.0.5)

## [0.0.39] - 2026-05-21

### Improved
- **Species Detail — split sightings and media graphs** — "Sightings Over Time" now shows only the individuals line with its own y-axis scale. When ML media is loaded and the species has at least one media item, a second "Media Over Time" graph appears below with photo, audio, and video on their own independent y-axis. Previously all four lines shared one axis, making media counts hard to read for species with large individual counts.

## [0.0.38] - 2026-05-21

### Added
- **Comprehensive Media Life List** — when an eBird backup is stored in Settings alongside the ML export, the Media List tab now shows every species from the eBird backup with ML media counts overlaid. Species with no media show dashes in all count columns. Previously, only species that appeared in the ML export were listed.
- **"Show subspecies" toggle** — new toggle switch in the Media List controls row (matches the equivalent toggle on Species Detail). Default OFF: subspecies parentheticals stripped, entries merged. Toggle ON to see each subspecies variant as its own row.
- **"Show sp./slash" toggle** — new toggle switch to reveal or hide spuh and slash entries (entries ending ` sp.` or containing `/`). Default OFF (hidden).
- **"Show non-bird" toggle** — new toggle switch visible only in comprehensive mode. Non-bird entries are ML catalog items whose normalized name does not appear in the eBird backup species list (soundscapes, insects, habitats, etc.). Default OFF (hidden). When shown, non-bird entries appear below all bird entries in taxonomic sort under a "Non-Bird Media" section separator.
- **"Has media" filter pill** — new pill between "All" and the "No photo/audio/video" group. When active, shows only species that have at least one media item (photo, audio, or video), hiding all zero-count rows in one click.
- **Shared species utilities** — `normalizeSpeciesName` and `isSpuhOrSlash` extracted to `frontend/src/lib/speciesUtils.ts` and imported by both `LifeList` and `SpeciesDetail`.

## [0.0.37] - 2026-05-21

### Added
- **Sightings Over Time graph** — new line chart on Species Detail showing total individuals reported per year (or per month for single-year species), with a Per Year / Cumulative segmented toggle. When an ML export is loaded, optional overlay lines show photo, audio, and video item counts per period. Graph is filter-reactive (county + date range) and hidden when fewer than 2 time periods exist.
- **Map heatmap toggle** — new Pins / Heatmap button in the Sighting Locations map header. Heatmap mode renders a weighted `leaflet.heat` overlay showing observation density; individual markers are hidden. Resets to Pins on species change. Hidden when the species has no coordinate data.

## [0.0.36] - 2026-05-21

### Improved
- **Expand/collapse removed** — all four tabs (Life List, Breeding Codes, Media List, Species Detail) now use natural page flow; the toggle button that showed/hid content is gone
- **Media List — ML export only** — removed the secondary eBird backup drop zone; ML export is now the sole input, simplifying the upload flow and removing dead code paths
- **Unbounded mode — Life List and Breeding Codes** — new "↔ Unbounded" toggle in the filter bar lets the table expand to its full natural width so the whole page can be panned horizontally on mobile, rather than scrolling inside a small bounded box; "↔ Normal" collapses it back
- **Unbounded mode — species column unfreezes** — in Unbounded mode on the Breeding Codes tab, the frozen species name column is released so the entire table scrolls as one unit

## [0.0.35] - 2026-05-20

### Fixed
- **White page crash** — `BreedingCodeList` called three `useMemo` hooks after conditional early returns, violating React's hooks rules. When the component transitioned from `loading-saved` to `ready` (e.g. on auto-load from Settings), React detected a different hook count and unmounted the entire app. All three memos are now declared before any early return with null-safe guards.
- **ESLint lint failure in CI** — same hooks violation in `BreedingCodeList` also caused ESLint `react-hooks/rules-of-hooks` errors, blocking CI since v0.0.34. Additionally corrected a `react-hooks/exhaustive-deps` warning in `LifeList` by wrapping `phaseEntries` in its own `useMemo`.

## [0.0.34] - 2026-05-20

### Added
- **County filter** — compact dropdown on Breeding Codes, Media List, and Species Detail tabs; populated from data only; highlights green when active; composes with all existing filter pills and sort controls (AND logic)
- **Date range filter** — From/To date inputs on all three tabs; supports open-ended ranges (From only, To only, or both); inputs highlight green when a value is entered; composes with county filter and code pills
- **Filter strip** — appears between toolbar and table when any location/date filter is active; shows active constraints and species/checklist count; "Clear filter" resets both county and date to default
- **Total column — Media List** — rightmost column showing Photo + Audio + Video count per species; green header and bold values; sortable (descending first); reflects active county and date filters
- **County resolution for ML export** — three-tier chain: (1) reads County column directly from ML export if present; (2) cross-references loaded eBird backup by location name; (3) calls `POST /nominatim/counties` for reverse geocoding via OpenStreetMap; county dropdown shows loading indicator during Nominatim resolution
- **Nominatim backend endpoint** — `POST /nominatim/counties` proxies reverse geocoding requests to Nominatim with in-process caching, ≤1 req/sec rate limiting, and OSM-compliant User-Agent header

### Improved
- **eBird path — Media List** — switched from `parseLifeList` (species-level, no date/county) to `parseEbirdObservations` (row-level with county, date, location, lat/lng); enables county and date filtering on the eBird backup path

## [0.0.33] - 2026-05-20

### Fixed
- **Species Detail — Top Locations links removed** — location names now render as plain text; the previous links to `ebird.org/loc/{id}` worked for public hotspots but failed for personal/private locations, which have no public-facing page on eBird

## [0.0.32] - 2026-05-15

### Added
- **Species Detail — subspecies toggle** — toolbar toggle switch collapses all subspecies variants (e.g. "Yellow-rumped Warbler (Myrtle)" + "(Audubon's)") into a single parent species entry; all statistics, media counts, breeding codes, locations, comments, and map pins aggregate across every matching subspecies; defaults to merged
- **Species Detail — spuh/slash toggle** — second toolbar toggle shows or hides uncertain identifications (sp. entries and slash species); defaults to hidden
- **Species Detail — embedded recent media** — when an ML export is loaded, the most recently uploaded Photo, Audio, and Video for the selected species are embedded inline via Macaulay Library iframes in a responsive 3-column grid; scrollbars suppressed; section appears at bottom of the detail view
- **Species Detail — top locations** — ranked list of locations where the species has been recorded most often; shows top 10 by default with expand/collapse; eBird location IDs link to ebird.org/loc/{id} (works for both public hotspots and personal locations)
- **Species Detail — sighting locations map** — interactive Leaflet/OpenStreetMap map showing one marker per unique lat/lng coordinate; map auto-fits bounds to the selected species' observations; each marker opens a popup listing dated checklist links (up to 6 + overflow count)
- **eBird CSV parser** — now reads Location ID, Latitude, and Longitude columns; latitude/longitude parsed as numbers (null when absent or non-numeric)

## [0.0.31] - 2026-05-15

### Improved
- **Species Detail — mobile layout** — Sightings and Media cards now stack vertically on portrait phone screens (≤640px) via shared `.sr-two-col` responsive CSS class; long species names no longer overflow narrow columns
- **Species Detail — sightings totals** — Sightings card now shows two distinct counts: Checklists (number of eBird entries) and Individuals (sum of numeric counts; shown as — when all counts are recorded as X)
- **Species Detail — Show all / Collapse** — toolbar button toggles the page between clipped scroll mode and full-height layout, matching the same `onExpandedChange` pattern used by the Media Life List and Life List Comparer tabs; works correctly for mobile viewing and printing
- **Species Detail — species links** — eBird and Birds of the World favicon links now appear inline with the scientific name in the summary card, matching the treatment in the Breeding Codes and Life List tabs

## [0.0.30] - 2026-05-15

### Added
- **Species Detail tab** — per-species drill-down from your eBird backup; select any species to see your full history with it
- Summary card: common name, scientific name, Photo/Audio/Video media indicators (filled when media exists in ML export), and a highest-tier breeding evidence pill (Confirmed/Probable/Possible)
- Sightings section: total observation count, first seen date, last seen date, and personal best count — all linked to their eBird checklists
- Media statistics: Photo, Audio, and Video counts linked to the Macaulay Library catalog filtered by species and media type; requires ML export loaded in Settings
- Breeding codes breakdown: every unique code recorded for the species with tier-colored dot, abbreviation, label, and count; sorted by tier then canonical order
- Comments archive: all species-level field notes from your eBird backup, sortable (newest/oldest) and filterable by keyword; first 10 shown with "Show all N" button; each date links to its checklist
- Auto-loads from stored eBird backup in Settings; shows upload drop zone as fallback when no file is stored
- Species selector is taxonomically sorted (fire-and-forget fetch); immediately usable in A–Z order while taxonomy resolves
- `parseEbirdObservations` parser: character-level CSV parser handling quoted fields with embedded newlines and commas; reads both "Species Comments" and "Observation Details" column names

## [0.0.29] - 2026-05-15

### Added
- **Dark mode** — full dark theme with automatic OS preference detection; no flash of the wrong theme on load
- Theme preference toggle in Settings → Appearance: System / Light / Dark
- Consent-gated `localStorage` persistence — theme is applied immediately when selected; a prompt asks whether to save the preference or keep it for this session only; once consent is given, future changes are silent
- Complete `--sr-*` CSS custom property token system in `globals.css` covering structural, text, border, accent, error, warning, tier, and shadow values for both themes
- Anti-flash inline script in `index.html` applies `data-theme` before first paint using stored preference or OS media query
- `src/lib/theme.ts` — `applyTheme()` and `readStoredPreference()` utilities with private-browsing-safe localStorage access
- Dark palette: zinc-based backgrounds (`#09090B` page, `#18181B` surface), `#34D399` emerald accent for better contrast on dark surfaces, lightened purple tier colours for breeding code badges

## [0.0.28] - 2026-05-15

### Fixed
- **Mobile tab bar** — tabs no longer clip off the right edge of the screen on iPhone; the tab bar now scrolls horizontally so all tabs are reachable without rotating the device
- Reduced top padding on the header and tab content panels on small screens (≤640px) to make better use of vertical space
- Reduced weather card inner padding on small screens

## [0.0.27] - 2026-05-15

### Added
- **API key settings** — new "API Keys" section on the Settings tab lets you enter, save, and manage your eBird and OpenWeather API keys directly in the UI
- Keys are written to `backend/.env` and take effect immediately — no server restart required
- Saved keys display masked by default (`••••••••••••••••`) with a Show/Hide toggle
- Inline "Add key" / "Update" edit mode with Enter-to-save and Cancel; Save button disabled until input has content
- "Clear" removes a key from `.env`, `os.environ`, and the UI
- `GET/POST/DELETE /settings/keys/{ebird|openweather}` backend endpoints backed by `python-dotenv`; unknown slots return 404, blank values return 400
- 11 new backend tests covering all key endpoints

## [0.0.26] - 2026-05-15

### Added
- **Breeding code category filters** — three new filter pills on the Breeding Codes tab: Confirmed, Probable, and Possible; each selects all codes in that eBird evidence category with one click
- Category filter logic: OR within category (any matching code qualifies the species), AND across active categories and individual code filters
- Multiple categories can be active simultaneously; "All" clears both category and individual code filters
- Category pills hidden when no codes from that category appear in the loaded data
- `BreedingCategory` type and `CATEGORY_CODES` constant added to `breedingCodes.ts`, derived programmatically from tier assignments

## [0.0.25] - 2026-05-15

### Added
- **Settings tab** — new rightmost tab for managing persistent default files; upload your eBird backup and ML export once and they load automatically every session
- eBird backup stored server-side; Breeding Codes tab auto-loads it on every page visit — no more re-uploading
- ML export stored server-side; Media List tab auto-loads it on every page visit with full taxonomic sort and species links
- Each stored file shows its original filename and upload date; a green chip in the data tab toolbar confirms when a saved default is active
- "Upload new" replaces the stored default in Settings; uploading directly within a tab is session-only and leaves the saved default untouched
- "Clear" removes a stored file from the server; the corresponding tab returns to its manual upload state on next page load
- `GET/POST/DELETE /settings/files/{ebird|ml}` backend endpoints with `.csv` validation, 50 MB size limit, and fixed server-side filenames (path traversal safe)
- `data/` directory at project root created on first upload; added to `.gitignore`
- `python-multipart` dependency added to support multipart file uploads

## [0.0.24] - 2026-05-14

### Added
- **Taxonomic sort** — A–Z / Taxonomic toggle added to the Media List and Breeding Codes tabs, matching the Life List Comparer
- Media List: both ML export and eBird CSV sources support taxonomic sort; species missing from the taxonomy fetch sort last
- Breeding Codes: A–Z is the default; switching to Taxonomic orders species by eBird taxon number, with A–Z fallback for ties
- Column-header sorts (count columns in Breeding Codes; Photo/Audio/Video in Media List) use the name sort mode as a tiebreaker, so the A–Z vs Taxonomic preference is preserved when sorting by any column
- `/taxonomy/codes` backend endpoint extended to return `orders: {commonName: taxonOrder}` alongside existing `codes` — no additional network call

### Fixed
- ML export drop zone copy updated from "Instant results — no network lookups" to "Instant results — species links and taxonomic sort load in the background" (the previous copy was inaccurate since taxonomy lookups do fire after upload)

## [0.0.23] - 2026-05-14

### Changed
- Filter pills on the Media List and Breeding Codes tabs now support multi-select with AND logic
- Media List: selecting "No photo" and "No audio" simultaneously shows only species missing both; selecting the opposite pill for the same dimension (e.g. "Has photo" while "No photo" is active) auto-replaces the conflicting selection; clicking an active pill deselects it
- Breeding Codes: multiple code pills can be active at once; the table shows only species with recorded observations for every selected code; clicking an active pill removes it from the filter
- "All" pill resets to unfiltered on both tabs; species count label reflects the AND result of all active filters

## [0.0.22] - 2026-05-14

### Changed
- Breeding Codes tab now shows species names in the same format as the Media List — common name with clickable eBird and Birds of the World favicon links, scientific name in italics below

## [0.0.21] - 2026-05-14

### Changed
- Tab order is now Weather, Breeding Codes, Media List, Life List Comparer
- "Media Life List" tab renamed to "Media List"
- README updated to match current tab order and names, and to include the Breeding Codes tool

## [0.0.20] - 2026-05-14

### Fixed
- Breeding Codes tab now correctly reads breeding codes from eBird backup files — eBird stores the full label alongside the code (e.g. "CN Carrying Nesting Material") and the parser now extracts only the code abbreviation before the map lookup

## [0.0.19] - 2026-05-14

### Fixed
- Breeding Codes tab now correctly reads breeding codes from eBird backup files that contain quoted fields with embedded newlines (e.g. multi-line observation notes entered before the breeding code column)
- Drop zone upload icon is now green, matching the rest of the app

## [0.0.18] - 2026-05-14

### Added
- **Breeding Codes tab** — upload your eBird backup (`MyEBirdData.csv`) to see a matrix of all species you've recorded breeding codes for, with columns for each of the 23 eBird breeding codes (Confirmed → Possible, left to right)
- Each cell shows a colored circle with the count of times that code was recorded for that species; colors follow eBird's four-tier system (darkest purple = confirmed, lightest = possible)
- All 23 columns are sortable by clicking the header; clicking a code column sorts by count descending, ties broken alphabetically
- Filter pills above the table let you focus on any single breeding code, hiding all other species
- A legend at the bottom of the table maps tier colors to their categories and codes
- Species with slashes, hybrids, and `sp.` categories are excluded; subspecies parentheticals are merged into the parent species entry

## [0.0.17] - 2026-05-13

### Added
- eBird and Birds of the World favicon links appear inline next to every species name in the Media Life List and all three Life List Comparer panels — clicking either icon opens that species' page on the respective site in a new tab
- Links appear automatically once taxon codes are resolved; species with no code (soundscapes, pending fetch) show no icons

### Fixed
- Macaulay Library media links now filter to your personal media — the user ID is parsed from the default ML export filename (`ML__DATE_USERID.csv`) and appended to all catalog links
- Media links now use the taxon code parameter (`taxonCode=acowoo`) instead of the species name parameter for accurate personal media filtering; requires the eBird taxonomy lookup introduced in this release
- A warning banner is shown when the ML export filename has been renamed and the user ID cannot be parsed

## [0.0.16] - 2026-05-13

### Changed
- Photo, Audio, and Video counts in the Media Life List are now clickable links — clicking a count opens the Macaulay Library catalog filtered by that species and media type in a new tab
- Column headers (Entries, Photo, Audio, Video) are now clickable sort controls; clicking a header sorts by that column, clicking again reverses direction
- Removed the "Media" (always-✓) column — redundant since every entry in the list has media
- Removed the standalone A–Z sort button — replaced by column-header sorting

## [0.0.15] - 2026-05-13

### Changed
- Photo, Audio, and Video columns in the Media Life List now show a count of individual media items per species instead of a checkmark (dash for zero)
- "Seen" column header renamed to "Media" — accurate for audio-only entries
- "Species" column header renamed to "Entries" — accurate for non-species items such as soundscapes
- Soundscape entries from Macaulay Library exports are no longer excluded — they appear in the list like any other entry

## [0.0.14] - 2026-05-12

### Added
- Media Life List now accepts a Macaulay Library export CSV as a preferred offline input — instant results, no CDN lookups (sign in to Macaulay Library → My Media → Save Spreadsheet)
- eBird backup CSV remains available as a secondary input; file type is auto-detected from the CSV header
- Three new positive filter pills: Has photo, Has audio, Has video — alongside the existing No photo / No audio / No video filters
- Soundscape entries from Macaulay Library exports are automatically excluded

## [0.0.13] - 2026-05-12

### Fixed
- Media Life List batch lookup no longer stalls or shows "Couldn't reach the Macaulay Library" mid-batch — reduced batch size (25 → 10 IDs), added a 500 ms inter-batch delay to stay under the Cornell CDN rate limit, and changed individual batch errors to be non-fatal so partial results are always shown

## [0.0.12] - 2026-05-12

### Added
- Taxonomic / A–Z sort control on the Life List Comparer tab, matching the sort control already present on the Media Life List tab

## [0.0.11] - 2026-05-12

### Fixed
- In "Show all" mode, the SnowRaven header and tab bar now scroll away naturally instead of remaining pinned at the top of the screen — improves mobile viewing and print output for the Media Life List and Life List Comparer tabs

## [0.0.10] - 2026-05-12

### Changed
- Tab order is now Weather, Media Life List, Life List Comparer
- "Life List" tab renamed to "Media Life List"
- "List Comparer" tab renamed to "Life List Comparer"

## [0.0.9] - 2026-05-12

### Fixed
- Life List species count now matches the List Comparer — subspecies parentheticals (e.g. "Yellow-rumped Warbler (Myrtle)" and "Yellow-rumped Warbler (Audubon's)") are merged into a single species entry, consistent with how the List Comparer has always worked

## [0.0.8] - 2026-05-12

### Fixed
- Life List media lookup now works correctly — the original implementation queried the Macaulay Library search API by catalog ID, which does not support that lookup. The backend now probes the Cornell CDN directly via HEAD requests to determine each asset's media type (Photo / Audio / Video), which is reliable and fast.

## [0.0.7] - 2026-05-12

### Added
- Life List tab: upload your eBird backup CSV to generate a full life list with per-species media coverage (Photo, Audio, Video)
- Filter buttons to show only species missing a photo, audio recording, or video recording
- Taxonomic order and A–Z sort options
- "Show all / Collapse" toggle for full-page expansion (useful for printing)
- Backend proxy at `POST /ml/media-types` querying the Macaulay Library search API to determine media types for submitted catalog IDs, with batch progress indicator during lookup

## [0.0.6] - 2026-05-08

### Added
- "Edit on eBird" link appears in the results area after a successful weather lookup, linking directly to the eBird edit page for that checklist (`https://ebird.org/edit/effort?subID=…`)

## [0.0.5] - 2026-05-08

### Added
- `update.sh` script: one command to pull, rebuild, and restart the app (`./update.sh` from the repo root)
- "Check For Updates" link in the app footer: checks GitHub for a newer release on demand, showing version status inline (no passive network requests)
- `/version/check` backend endpoint: server-side GitHub API check that keeps the client IP off GitHub

## [0.0.4] - 2026-05-08

### Added
- Checklist confirmation line displayed after a successful weather lookup, showing the resolved checklist ID, location name, and observation time (e.g. `S334315671 / Berkeley Community Garden / 2026-05-07 17:26`)

## [0.0.3] - 2026-05-07

### Added
- List Comparer tab: drag-and-drop two eBird backup CSV files to see which species appear in both lists and which are unique to each
- "Show all / Collapse" toggle on comparison results to expand all three species panels to full length (useful for printing)

## [0.0.2] - 2026-05-07

### Added
- Weather output is now automatically copied to the clipboard on a successful lookup (with legacy fallback for non-HTTPS contexts)
- Footer "SnowRaven" text links to the GitHub repository
- This changelog

## [0.0.1] - 2026-05-07

### Added
- Initial release: paste an eBird checklist ID or URL to retrieve formatted weather conditions for that checklist
- Manual copy-to-clipboard button on the weather output panel

# Changelog

All notable changes to SnowRaven are documented here.

## [0.3.7] - 2026-05-25

### Changed
- **Local release script** (`release.sh`) replaces the removed `tauri-release.yml` CI workflow. Run `./release.sh` after pushing a version bump to build, Apple-notarize, minisign, and publish the macOS desktop app. Apple credentials stay local -- nothing is stored in GitHub. The script generates `latest.json` and uploads it along with the DMG and updater bundle to the GitHub release.
- **Removed `tauri-release.yml`** -- the CI workflow that built unsigned macOS binaries in GitHub Actions is replaced by the local release script.

## [0.3.6] - 2026-05-25

### Fixed
- `transport.ts` used TypeScript parameter properties (`public readonly` in constructor args), disallowed by `erasableSyntaxOnly` in `tsc -b` (TypeScript 6.x project references mode). Replaced with explicit property declarations.
- `MapExplorer.tsx` had `transport.get<unknown[]>('/map/recent-obs')` causing a type mismatch with `setTargetPins` (expected `TargetPin[] | null`). Changed to `transport.get<TargetPin[]>`.
- `tauri-release.yml` used the wrong npm script name (`tauri` instead of `desktop:build`).

## [0.3.5] - 2026-05-25

### Changed
- **Desktop app fully standalone** (Desktop App Phase 6) -- The desktop app no longer requires the Python backend for any operation. Verified: no direct `fetch()` calls, no `/settings/*` backend calls, and no `TauriTransport` paths that fall through to `WebTransport` in Tauri mode. All transport routes (`/weather/*`, `/version/check`, `/stats/nemesis`, `/nominatim/search`, `/map/hotspots`, `/map/recent-obs`) are handled by TypeScript service files. All storage operations (API keys, files, settings) use `TauriStorage`. The Python backend remains the runtime for Raspberry Pi / web server mode -- only the desktop app is standalone.
- **README.md** -- Added "Desktop App Installation (Mac)" section with download, install, and update instructions. Updated desktop app description to reflect that it is fully self-contained.
- **docs/HELP.md** -- Updated Settings > API Keys and Default Files descriptions to distinguish desktop (system keychain / local app data) from web/Pi (server `.env` / server disk) behavior.
- **DECISIONS.md** -- Desktop app migration decision updated to record Phase 6 completion, full phase summary, and private key management guidance.

## [0.3.4] - 2026-05-25

### Added
- **In-app updater** (Desktop App Phase 5) -- In Tauri mode, "Check For Updates" now uses `tauri-plugin-updater` to detect, download, and install updates directly within the app. Progress is shown as a percentage while downloading. After install, the app prompts to relaunch to apply the update. Fallback to the existing GitHub API version check on error.
- **Tauri release CI** (`.github/workflows/tauri-release.yml`) -- New workflow triggered on GitHub release publication. Builds and signs the macOS desktop app binary, generates `latest.json` (the Tauri updater manifest), and uploads both as release assets. Uses `TAURI_SIGNING_PRIVATE_KEY` secret for minisign binary signing; Apple notarization secrets are optional slots.
- **Ed25519 minisign keypair** -- Generated for binary update signing. Public key stored in `tauri.conf.json`. Private key (base64) must be set as the `TAURI_SIGNING_PRIVATE_KEY` GitHub Actions secret; local copy at `~/.tauri/snowraven-signing.key`.
- **`updateManager.ts`** (`frontend/src/lib/tauri/updateManager.ts`) -- Wraps `@tauri-apps/plugin-updater`: `checkForUpdate()` returns structured result (up-to-date / available / error); `downloadAndInstall()` streams download progress.
- **`@tauri-apps/plugin-updater`** -- Added to frontend dependencies. Registered in `lib.rs` as `tauri_plugin_updater::Builder::new().build()`. Permission `updater:default` added to `capabilities/default.json`.

### Changed
- **Update available UI** -- Desktop app now shows "Install update" button (triggers in-app download + install) instead of "run ./update.sh". Web/Pi mode still shows the shell script instruction. New footer states: `downloading` (with % progress) and `ready-to-restart`.

## [0.3.3] - 2026-05-25

### Added
- **App data directory storage** (Desktop App Phase 4) -- In Tauri mode, all data files (eBird backup, ML export) and settings (map defaults) are stored in the OS app data directory via `tauri-plugin-fs`. The Python backend is no longer required for any data persistence in desktop mode.
- **`getFilesStatus()` on `StorageAdapter`** -- Returns `FilesStatus` (ebird/ml metadata) and exported `FileMetadata` type. Replaces `GET /settings/files` backend calls throughout all components.
- **`tauri-plugin-fs = "2"`** -- Added to Cargo.toml. Registered in `lib.rs`. File and settings storage uses `BaseDirectory.AppLocalData` (macOS: `~/Library/Application Support/com.snowraven.app/`).
- **`@tauri-apps/plugin-fs`** -- Added to frontend dependencies for typed fs access in TauriStorage.

### Changed
- **`TauriStorage`** (`frontend/src/lib/storage.ts`) -- All methods now fully implemented without backend dependency: `readFile`/`writeFile`/`deleteFile` use `$APPLOCALDATA/data/`; `getSetting`/`setSetting`/`deleteSetting` use `$APPLOCALDATA/settings/{key}.json`; `getFilesStatus()` reads `$APPLOCALDATA/data/metadata.json`. Dynamic imports keep fs plugin code out of the web bundle.
- **Settings.tsx** -- All backend fetch calls replaced with `storage.*` methods. File upload reads content in-browser then calls `storage.writeFile()`. Key save/delete use `storage.setApiKey()`/`storage.deleteApiKey()`. Map defaults use `storage.setSetting()`/`storage.deleteSetting()`.
- **All data-loading components** (`BirdingStats`, `BreedingCodeList`, `LifeList`, `ListComparer`, `MapExplorer`, `SpeciesDetail`) -- Settings fetch calls replaced with `storage.getFilesStatus()`, `storage.readFile()`, `storage.getSetting()`, `storage.getApiKey()`.
- **`capabilities/default.json`** -- Added scoped `fs:allow-*` permissions for `$APPLOCALDATA/**`.

## [0.3.2] - 2026-05-25

### Added
- **Direct external API calls in Tauri mode** (Desktop App Phase 3) -- In Tauri mode, all external API requests (eBird, OpenWeather, Nominatim, GitHub) are made directly from the desktop app without routing through the Python backend. Uses `tauri-plugin-http` to bypass browser CORS from `tauri://localhost`.
- **Offline timezone lookup** (`get_timezone` Tauri command) -- Uses the `tzf-rs` Rust crate with an embedded timezone database to resolve IANA timezone names from lat/lng coordinates. Replaces the Python `timezonefinder` dependency for the weather workflow.
- **TypeScript service layer** (`frontend/src/lib/tauri/`) -- Six service files call external APIs directly in Tauri mode: `weatherService.ts` (eBird checklist + OpenWeather historical + formatting), `taxonomyService.ts` (eBird taxonomy with 7-day IndexedDB cache), `mapService.ts` (eBird hotspots and recent observations), `statsService.ts` (nemesis/nearby species), `nominatimService.ts` (forward and reverse geocoding with rate limiting), `versionService.ts` (GitHub releases check using native app version via `@tauri-apps/api/app`).
- **`TransportError` class** -- Exported from `transport.ts`; carries `status` and `detail` fields so component error handlers get structured error information from both Tauri service calls and HTTP error responses.
- **`@tauri-apps/plugin-http`** -- Added to frontend dependencies for CORS-bypassed HTTP in Tauri mode.

### Changed
- **`TauriTransport`** (`frontend/src/lib/transport.ts`) -- Routes intercepted paths to the new TypeScript service layer; all other paths still fall through to `WebTransport` (backend). Dynamic imports keep Tauri service code out of the web bundle.
- **`WebTransport`** -- Now extracts the JSON `detail` field from error responses and includes it in thrown `TransportError`.
- **`lib.rs`** -- Added `get_timezone` command; registered `tauri_plugin_http`.
- **15 `fetch()` calls** across `App.tsx`, `BirdingStats.tsx`, `BreedingCodeList.tsx`, `LifeList.tsx`, `ListComparer.tsx`, `MapExplorer.tsx`, `SpeciesDetail.tsx` migrated to `transport.get()` / `transport.post()`. Settings-related fetch calls unchanged (Phase 4).
- **`Cargo.toml`** -- Added `tauri-plugin-http = "2"` and `tzf-rs = "0.4"`.
- **`capabilities/default.json`** -- Added `"http:default"` permission.

## [0.3.1] - 2026-05-25

### Added
- **OS keychain for API keys** (Desktop App Phase 2) -- In Tauri mode, eBird and OpenWeather API keys are stored in the OS native keychain (macOS Keychain, Windows Credential Manager) via the `keyring` Rust crate. Three Tauri commands exposed: `get_api_key`, `set_api_key`, `delete_api_key`. `TauriStorage` updated to use these commands. Keys persist across app restarts. Bridge write to the Python backend `.env` kept for Phase 3 transition compatibility.
- **`@tauri-apps/api`** -- Added to `frontend/package.json` dependencies for typed `invoke()` access to Tauri commands from TypeScript.

## [0.3.0] - 2026-05-25

### Added
- **TypeScript weather formatter** (`frontend/src/lib/weatherFormatter.ts`) -- Pure TypeScript port of `backend/formatters/weather.py`. Exports `formatWeather()`, `windDescription()`, `cardinal()`, `conditionEmoji()`, `formatRange()`, `formatLocalTime()`, and `bankersRound()`. Produces byte-for-byte identical output to the Python reference for all test fixtures. No new npm dependencies; no Node.js-only imports (browser-safe for Phase 3).
- **Golden test suite** (`frontend/src/lib/weatherFormatter.test.ts`) -- 61 vitest tests covering all Beaufort boundaries, all 8 cardinal directions, banker's rounding at .5 boundaries, multi-hour aggregation, wind description sort order, wind direction insertion order, capitalize semantics, equal-value ranges, noon/midnight formatting, and a byte-for-byte match against the production fixture from `backend/tests/test_weather_router.py`.
- **Golden reference script** (`frontend/src/lib/weatherFormatter.golden.py`) -- Python oracle script that runs the Python formatter logic against each test fixture and prints expected output. Documents how the TypeScript golden values were generated; re-run if the Python formatter changes.

## [0.2.0] - 2026-05-25

### Added
- **Transport seam** (`frontend/src/lib/transport.ts`) -- `TransportAdapter` interface wrapping all outbound HTTP. `WebTransport` routes through the existing Vite proxy to the FastAPI backend (no behavior change for web/Pi users). `TauriTransport` delegates to `WebTransport` in Phase 0; will call external APIs directly in Phase 3 as each proxy migrates.
- **Storage seam** (`frontend/src/lib/storage.ts`) -- `StorageAdapter` interface wrapping all persistent data access: API keys, settings, and stored files. `WebStorage` routes through the existing `/settings` API endpoints. `TauriStorage` delegates to `WebStorage` in Phase 0; will use OS keychain (Phase 2) and app data directory (Phase 4) as migration progresses.
- **Platform detection** (`frontend/src/lib/platform.ts`) -- `isTauri()` utility checking `window.__TAURI_INTERNALS__`. Single source of truth for platform detection across all seam implementations.
- **Tauri v2 project** (`src-tauri/`) -- Tauri project initialized: `Cargo.toml`, `build.rs`, `tauri.conf.json`, `src/main.rs`, `src/lib.rs`, and `capabilities/default.json`. Wraps the existing Vite frontend build. App identifier: `com.snowraven.app`.
- **Root `package.json`** -- `desktop:dev` and `desktop:build` scripts for running the Tauri app via `@tauri-apps/cli`.

### Changed
- **`frontend/vite.config.ts`** -- Added `clearScreen: false` for Tauri compatibility (keeps Tauri terminal output visible).

## [0.1.19] - 2026-05-25

### Added
- **In-app help documentation** -- New "Help & Documentation" section at the top of the Settings tab with an "Open documentation" button. Clicking it opens a full-screen overlay showing the complete `docs/HELP.md` documentation: Getting Started, API Keys (eBird and OpenWeather with setup instructions), Default Files (eBird backup and ML export), and a section for every tab. Rendered from a bundled markdown string with no network call at runtime -- works fully offline.
- **`docs/HELP.md`** -- Single source of truth for all documentation. Available in-app (via the `?raw` import bundled at build time) and rendered on GitHub at a permanent URL. No em dashes or emojis.
- **`HelpDocs.tsx`** -- Full-viewport overlay component with sticky header, two-column layout (sidebar TOC + content), Escape-key close, focus trap, and a custom lightweight markdown renderer with no new dependencies.
- **README.md** -- Added "Documentation" section with a "Full documentation" link to `docs/HELP.md`. Updated all tab descriptions to reflect the Settings-first model (no per-tab file upload). Added Statistics and Map Explorer tab entries. Removed all em dashes from README prose.

## [0.1.18] - 2026-05-25

### Changed
- **Build — chunk splitting** — Vendor libraries now split into three separate cacheable chunks: `vendor-recharts` (~397 kB), `vendor-react` (~179 kB), `vendor-leaflet` (~170 kB). App code chunk reduced from ~1,013 kB to ~272 kB. Resolves the large-chunk build warning. Configured via `manualChunks` in `vite.config.ts`.

## [0.1.17] - 2026-05-25

### Changed
- **Statistics — Mobile layout** — Statistics tab now adapts to narrow screens. SectionCard padding scales down with `clamp()`. Two-column grids (Geographic counties/states, Temporal day-of-week/start-hour) collapse to a single column below ~400px. The four-cell Effort metrics grid wraps to 2×2. Breeding filter buttons and Media interval controls wrap instead of overflowing.
- **Statistics — Nemesis Birds description** — Corrected and expanded. Now accurately states species are sorted by most recently seen (not frequency, which was the previous incorrect description). Adds the 30-day observation window, the source (eBird observations for the configured location and radius from Settings), and an inline dot color legend (red = past 7 days, amber = 8–14 days, grey = 15–30 days).

## [0.1.16] - 2026-05-25

### Added
- **Statistics — Media card** — New card between Breeding Stats and Other Statistics, visible when an ML export is loaded. Includes a four-series line chart (Photo, Audio, Video, Total) with Weekly / Monthly / Yearly / Total interval controls and a Per Period / Cumulative toggle. In Total mode the chart shows a cumulative step-line at daily granularity and the toggle is hidden. Chart is suppressed when data spans fewer than two periods.

### Changed
- **Statistics — Media rankings moved** — Most Photographed, Most Recorded (Audio), and Most Filmed (Video) top-10 rankings have moved from Other Statistics into the new Media card.
- **Statistics — Other Statistics** — Now contains only Nemesis Birds.

## [0.1.15] - 2026-05-24

### Added
- **Settings — Tab order & visibility** — New section at the bottom of Settings lets users drag tabs into any order and hide tabs they don't use. Settings tab is always fixed last. Changes take effect immediately with no save button. Preferences are stored per-browser in `localStorage` and survive page reloads. At least one tab must remain visible at all times. Hiding the currently active tab auto-switches to the first visible tab.

## [0.1.14] - 2026-05-24

### Changed
- **Statistics — Single-checklist and one-and-done birds** — moved from Other Statistics to Data Quality, below the Biggest Single Counts table.

## [0.1.13] - 2026-05-24

### Fixed
- **Media List — Taxonomic sort for non-bird animals** — entries with a single-word scientific name (no space) now sort in the middle tier alongside other non-bird animals, rather than at the very end with entries that have no scientific name at all.

## [0.1.12] - 2026-05-24

### Added
- **Statistics — Denser milestone schedule** — 43 milestone thresholds replacing the old 20, with every 10 species below 100, every 25 from 100–475, every 50 from 500–950, and sparse milestones from 1,000 to 3,000. Milestones are now in the Firsts & Milestones card instead of Life List Totals.
- **Statistics — Per-year species & best day** — Checklists by Year now shows distinct species count and best single-day species count alongside checklist count. Best-day count links to the eBird checklist when the submission ID is valid.
- **Statistics — Top Locations map** — Leaflet map in Geographic Stats showing numbered markers for top locations by checklists (green circles) and top locations by species (blue squares). Map appears at the top of the card. Markers auto-fit to bounds on load.
- **Statistics — One-and-done birds as links** — One-and-done bird pills now link to the eBird checklist where the single individual was recorded, matching single-checklist bird behavior.
- **Statistics — Nemesis bird links** — Each nemesis bird name links to its eBird species page. Taxon codes are resolved from ML export data or a secondary taxonomy lookup; unresolvable names fall back to plain text.

### Changed
- **Statistics — Accumulation pill order** — Life list accumulation toggle now reads Weekly · Monthly · Yearly · Total.
- **Statistics — Day-of-week chart layout** — Pie chart and legend now appear below the bar chart instead of beside it.
- **Statistics — "Fun Stats" renamed** — Section is now called "Other Statistics."

## [0.1.11] - 2026-05-24

### Added
- **Species Detail — Weekly graph interval** — new "Weekly" option in Graph Options groups sightings, checklists, and media by ISO week. Toggle order is now Weekly · Monthly · Yearly. Monthly is the new default on load and on every species change.
- **Species Detail — Checklists Over Time graph** — new chart card below "Sightings Over Time" showing how many of your checklists recorded the species per period (per week/month/year, or cumulative). Uses the same interval and view-mode controls as the other graphs.
- **Species Detail — Frequency statistic** — new "Frequency" cell in the Sightings section shows what percentage of your checklists include the selected species, with a slim fill bar. Updates reactively when county or date-range filters are active.

## [0.1.10] - 2026-05-24

### Fixed
- **Media List — Taxonomic sort for non-animals** — entries with no genus+species in their scientific name (Habitat, Soundscape, Experience, etc.) now sort alphabetically at the very end of the list when taxonomic sort is active, after all non-bird animal entries. Previously they were grouped with other non-birds and sorted by taxon order.

## [0.1.9] - 2026-05-24

### Added
- **Statistics — Life List Accumulation** — new "Total" granularity mode plots one data point per new life species in chronological order using a step-line chart. Tooltip shows the species name at each milestone. Toggle order is now Total · Yearly · Monthly · Weekly with Total as default.
- **Statistics — Milestone pills** — each reached milestone now displays the species name that hit that threshold and links to the corresponding eBird checklist.
- **Statistics — First/last observation cards** — location name appears on a second line; date is a clickable eBird checklist link when a valid submission ID is present.
- **Statistics — Biggest single day** — species count links to the eBird checklist.
- **Statistics — Temporal pie charts** — donut pie charts alongside the checklists-by-month and checklists-by-day-of-week bar charts, with percentage labels in legends.
- **Statistics — Percentage display** — checklists-by-month, by-day-of-week, and by-start-hour bars now show the percentage of total checklists alongside the raw count.
- **Statistics — Geographic charts split** — counties and states/provinces are now shown as two separate side-by-side charts each: one ranked by checklists, one ranked by species. Top locations also split into by-checklists and by-species lists, each showing both metrics.
- **Statistics — Observer count pie chart** — donut pie chart added alongside the observer count bar chart in Effort & Methodology.
- **Statistics — Breeding activity by month** — stacked color-coded bars showing confirmed (dark purple), probable (medium purple), and possible (light purple) species counts per month. Filter buttons (All / Confirmed / Probable / Possible) let users isolate one tier.
- **Statistics — One-and-done pills** — each pill links to the single checklist the species appeared on.
- **Statistics — County/state region links** — county entries link to the state/province eBird region page; state/province entries link to their eBird region page directly.
- **Statistics — ML media links** — most-photographed/recorded/filmed lists now link to Macaulay Library catalog filtered to the user's own media of that type and species (using `taxonCode` + `userId`), matching the behavior of the Media Count tab.

### Fixed
- **Statistics — Average duration and spp/hour blank** — eBird CSV column is `Duration (Min)` with parentheses; the parser was searching for `duration min` without parentheses. Fixed column header matching in `parseEbirdObservations.ts`.

## [0.1.8] - 2026-05-23

### Added
- **Media Targets — Filter by Type** — new filter pills (All / Photo / Audio / Video) in the Map Explorer Media Targets sidebar. Selecting one or more type pills narrows the map pins and nearest-10 list to species missing those specific media types (AND logic). The species count updates as the filter changes. Filter resets when "Find Recent Sightings" is clicked.

### Fixed
- **Hotspots — personal location radius** — personal location pins were appearing outside the user-selected radius because the eBird API expects distance in km but both fetch calls (`/map/hotspots` and `/map/recent-obs`) were passing the radius in miles. Both calls now convert before the request (`Math.round(radius * 1.60934)`). The personal-pin haversine comparison was already in miles and is unchanged.

## [0.1.7] - 2026-05-23

### Fixed
- **Statistics tab build error** — `Tooltip` formatter parameter typed as `number` failed `tsc -b` (the stricter build-time type checker) because Recharts passes `ValueType | undefined`. Broadened to a runtime guard: `typeof v === 'number' ? fmt(v) : String(v ?? '')`.

## [0.1.6] - 2026-05-23

### Added
- **Statistics tab** — new dedicated tab with 8 sections of comprehensive birding analytics computed client-side from the stored eBird backup and ML export:
  - **Life List Totals** — species count, checklist count, locations, years active, states/provinces, countries, and a life list accumulation curve (area chart) with milestone badges at 100, 200, 300, 400, 500+ species.
  - **Firsts & Milestones** — biggest single day, longest consecutive-day streak, longest dry spell, and Shannon diversity index (H′).
  - **Temporal Stats** — bar histograms for checklists by year, month, day of week, and hour of day.
  - **Geographic Stats** — top 10 locations with checklist and species counts; county breakdown with expand/collapse; observation map with Pins and Heatmap toggle.
  - **Effort & Methodology** — total and average duration/distance, complete-checklist ratio, average observers, and protocol breakdown.
  - **Data Quality** — numeric count vs. presence-only (X) ratio, checklists with notes percentage, and biggest single counts by species.
  - **Breeding Stats** — confirmed/probable/possible species counts and breeding activity by month histogram.
  - **Fun Stats** — Big Year selector (all years in the data); most photographed species from ML export; one-and-done birds (seen on exactly one checklist); Nemesis Birds (recently reported nearby but not on the life list, via new `GET /stats/nemesis` endpoint).
- **Spuh/slash toggle** — header-level control that recomputes all species-count stats globally.
- **`ObservationEntry` — 8 new optional fields** parsed from eBird backup CSV columns that were previously discarded: `time`, `duration`, `distance`, `protocol`, `numObservers`, `allObsReported`, `checklistComments`, `stateProvince`. All optional; no existing callers affected.
- **`ChecklistEntry` type** — new derived type (computed in `useMemo`, not parsed) representing one deduped entry per eBird checklist submission.
- **`GET /stats/nemesis`** — new backend endpoint proxying the eBird regional recent-observations API. Validates lat/lng/dist parameters, returns deduplicated species with most-recent observation date.

## [0.1.5] - 2026-05-23

### Added
- **Species Detail — Graph Options card** — a new dedicated card above the Sightings Over Time and Media Over Time graphs. Replaces the auto-detect interval logic and the embedded Per Year/Cumulative toggle. Users can now explicitly choose Yearly or Monthly interval and Per Period or Cumulative view mode. Both graphs respond to the same controls simultaneously.
- **Species Detail — Reported With section** — a new section between Breeding Codes and Top Locations listing the species most frequently appearing on the same eBird checklists as the selected species. Results are ranked by co-occurrence coefficient (shared checklists ÷ target checklists), expressed as a percentage. Top 10 are shown by default with expand/collapse for the full list. Respects active county and date-range filters, excludes the target species itself, and requires a minimum of 2 shared checklists.

### Improved
- **Species Detail — `buildGraphData` signature** — replaced auto-detection of yearly vs. monthly interval with an explicit `interval` parameter, giving the Graph Options card direct control over graph granularity.

## [0.1.4] - 2026-05-23

### Fixed
- **Media List — taxonomic sort with Show Subspecies** — toggling "Show subspecies" caused domestics and subspecies to sort to the bottom instead of their correct taxon position. The taxon-order lookup now falls back to the normalized species name (stripping trailing parentheticals) so entries like "Mallard (Domestic type)" resolve correctly.

### Removed
- **Filename pill** — the pill showing the stored ML export or eBird backup filename has been removed from the Media List, Breeding Codes, and Species Detail tabs. Settings is now the sole file source, making the pill redundant.
- **Stale Settings copy** — removed the sentence "Uploading a different file within a tab is session-only and won't replace your saved default." Per-tab upload no longer exists.

## [0.1.3] - 2026-05-23

### Added
- **Media List — "Is Target" filter pill** — new pill immediately after "Has media" in the filter bar. Shows every species missing at least one of Photo, Audio, or Video. Combines with all other pills using AND logic. "All" resets it along with all other filters.
- **Map Explorer — per-species missing-type icons on target pins** — each pin label now shows small 10px SVG icons (camera, mic, video camera) for the media types that species is still missing. Icons use `currentColor` and appear to the right of the species name. Multi-species location groups show "N species" with a popup listing each species and its missing types.
- **Map Explorer — expanded targeting model** — a species is now a target if it is missing at least one of Photo, Audio, or Video (previously: zero ML entries only). Partial-coverage species (e.g., has photos, no audio) now appear as targets on the map and in the "Is Target" pill.
- **Map Explorer → Media List cross-tab navigation** — "N target species" in the Media Targets sidebar is now a clickable link. Clicking it switches to the Media List tab with "Is Target" pre-applied. Filter resets when navigating away so returning to the tab does not re-apply it.
- **Map Explorer — updated sidebar label** — sub-label beneath the target count now reads "from ML export · missing ≥1 media type" (was "no media recorded").
- **Design tokens** — added `--sr-is-target-bg`, `--sr-is-target-text`, `--sr-is-target-border` in both light and dark themes for the amber "Is Target" pill styling.

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

# Schema — Map Location Access

## Path
Frontend Only — No data layer changes required

## Confirmation
This feature has been assessed against the PRD and confirmed to require no database changes. No new tables, columns, relationships, or migrations are needed. The Tauri dependency additions (`tauri-plugin-geolocation` in `Cargo.toml`, capability entry, `Info.plist` key) are build-time configuration — not data layer work.

## Existing Data Used by This Feature

### MapExplorer — Shared Lat/Lng State
- State variables used: `lat: string`, `lng: string`, `radius: string` (already in `MapExplorer.tsx`)
- How used: The location button writes resolved coordinates into these state variables. All three map modes already read from this state to populate their fetch requests.
- The `handleFindHotspots` and `handleFindSightings` handlers already consume `lat`/`lng` to build API requests — the auto-fetch behavior (FR-11) calls these existing handlers.

### platform.ts — Platform Detection
- Function used: `isTauri()` from `frontend/src/lib/platform.ts`
- How used: Determines which location path to execute — `tauri-plugin-geolocation` or `navigator.geolocation`

### tauri-plugin-geolocation (new Tauri dependency, no schema impact)
- The plugin adds Rust-side CoreLocation access and TypeScript bindings
- Plugin API used: `requestPermissions()`, `getCurrentPosition({ timeout: 10000 })`
- Requires one new capabilities entry and one `Info.plist` key in the Tauri bundle config
- No persistent data stored

### navigator.geolocation (web path, already available)
- API used: `navigator.geolocation.getCurrentPosition(success, error, { timeout: 10000 })`
- No new imports or dependencies required for the web path

## No Data Layer Work Required
The Engineer can proceed directly to UI implementation. No migrations need to be written or run for this feature.

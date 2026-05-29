## Windows Geolocation

### What this does
Implements native "Use my location" on Windows, bringing it to parity with macOS and web/Pi. A Windows-gated Rust command returns the same `Coords { lat, lng }` contract as the macOS command, so the frontend treats both desktop platforms identically. Removes the v0.4.0 "coming later" degrade.

### What was built
- `src-tauri/src/location_windows.rs` (new) — `#[cfg(target_os = "windows")]` `get_location` command using the `windows` crate's `Geolocator`. Runs the WinRT calls via `spawn_blocking`; `RequestAccessAsync` not-Allowed → `"permission-denied"`, otherwise `GetGeopositionAsync` → lat/lng. Returns the same `Coords` shape as macOS.
- `src-tauri/Cargo.toml` — `windows` crate under `[target.'cfg(target_os = "windows")'.dependencies]` (features `Devices_Geolocation`, `Foundation`). macOS/Linux don't pull it.
- `src-tauri/src/lib.rs` — declares the Windows module and registers `get_location` for Windows alongside the macOS registration.
- `frontend/src/lib/location.ts` — removed the `unsupported-platform` Windows guard and the code from the `LocationError` union; Windows now uses the same `invoke('get_location')` path as macOS.
- `frontend/src/components/MapExplorer.tsx` — removed the v0.4.0 "coming later" note; the "Use my location" button always renders. Added a Windows-specific `permission-denied` message: "Turn on location in Windows Settings → Privacy & security → Location, then try again." (`isWindows()` retained solely for this message.)

### How to test
- **Now (no regression):** `cd frontend && npm run dev` → macOS/web "Use my location" still works; button present.
- **At deploy:** the Windows Build CI compiles `location_windows.rs` + the `windows` crate.
- **Real hardware (QA-01, QA-03):** on Windows 11 —
  - Location ON: click "Use my location" → map recenters on real coordinates.
  - Location OFF (Settings → Privacy & security → Location): click → the Windows guidance message appears; no crash, no infinite "Locating…".

### Notes for reviewer
- macOS `cargo check` clean; the Windows module is cfg-gated out on macOS and the `windows` crate isn't fetched there.
- The `windows` crate version (0.58) and the exact `Geolocator` API/feature flags are confirmed by the Windows CI compile; adjust the version/features there if the installed crate differs.
- For an unpackaged `.exe`, Windows has no per-app permission prompt — `RequestAccessAsync` reflects the global location settings, so "denied" = settings off (hence the Settings guidance).

## Convention Flags
- None new. (Cross-platform-dep and Windows-release conventions are already in CLAUDE.md from v0.4.0.)

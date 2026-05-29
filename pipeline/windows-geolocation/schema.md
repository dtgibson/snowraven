# Schema — Windows Geolocation

## Path
Frontend Only — No data layer changes. The substance is a native Windows Rust command + frontend wiring, documented here.

## Existing contract to mirror (macOS)
`src-tauri/src/location.rs`: `Coords { lat: f64, lng: f64 }` (serde Serialize), `get_location(app) -> Result<Coords, String>` (async tauri command). On denial the error string contains `"permission-denied"`; `frontend/src/lib/location.ts` maps that to `{ code: 'permission-denied' }`, anything else to `unavailable`.

---

## Rust — new Windows module

**`src-tauri/src/location_windows.rs`** (new), gated `#[cfg(target_os = "windows")]`:
- Reuse the existing `Coords` struct shape (define it here, or move a shared `Coords` to a small common spot; simplest is to define the same `#[derive(serde::Serialize)] struct Coords { lat, lng }` in this module — the frontend only cares about the JSON shape).
- `#[tauri::command] pub async fn get_location() -> Result<Coords, String>`:
  1. Do the WinRT work off the async executor via `tauri::async_runtime::spawn_blocking` (the `windows` `IAsyncOperation::get()` calls block).
  2. `Geolocator::RequestAccessAsync()?.get()?` → `GeolocationAccessStatus`. If not `Allowed` → `Err("permission-denied")`.
  3. `Geolocator::new()?` → `GetGeopositionAsync()?.get()?` → `Geoposition.Coordinate()?.Point()?.Position()?` → `BasicGeoposition { Latitude, Longitude }`.
  4. Map any WinRT error / no-fix → `Err("unavailable: <detail>")`.
  5. Return `Ok(Coords { lat: Latitude, lng: Longitude })`.

**`src-tauri/Cargo.toml`** — add under a Windows target table:
```toml
[target.'cfg(target_os = "windows")'.dependencies]
windows = { version = "0.x", features = [
  "Devices_Geolocation",
  "Foundation",
] }
```
(Engineer pins the current `windows` crate version. macOS-only crates stay in the macOS table.)

**`src-tauri/src/lib.rs`**:
- `#[cfg(target_os = "windows")] mod location_windows;` (parallel to the existing `#[cfg(target_os = "macos")] mod location;`).
- In `invoke_handler!`, register the Windows command:
  ```rust
  #[cfg(target_os = "macos")]
  location::get_location,
  #[cfg(target_os = "windows")]
  location_windows::get_location,
  ```
- Net: `get_location` exists on both desktop OSes; the frontend calls it uniformly.

---

## Frontend changes

**`frontend/src/lib/location.ts`**:
- Remove the `if (isWindows()) throw { code: 'unsupported-platform' }` guard. The Tauri branch calls `invoke('get_location')` on both macOS and Windows.
- Keep the dev-mode guard? It exists for macOS (CLLocationManager needs a signed build). Windows testing is via the built app, not `tauri dev`, so the dev-mode early-return is acceptable to keep as-is (it only triggers under `import.meta.env.DEV`). Engineer may leave it.
- Remove the `'unsupported-platform'` code from the `LocationError` union if unused elsewhere.

**`frontend/src/components/MapExplorer.tsx`**:
- Remove the `isTauri() && isWindows()` branch and the "coming later" note; always render the "Use my location" button in `CenterPointControl` (as before v0.4.0).
- Windows-specific denied message: in `handleUseMyLocation`'s error mapping, when `code === 'permission-denied'` and the platform is Windows, show "Turn on location in Windows Settings → Privacy & security → Location, then try again." Detect Windows here via a minimal check (or keep `isWindows()` solely for this message). Keep macOS/web messages unchanged.

**`frontend/src/lib/platform.ts`**:
- If `isWindows()` is still used for the denied message (above), keep it (and its tests). If the Engineer routes the Windows message another way and `isWindows()` becomes unused, remove it + its tests. Decide during implementation — no dead code either way (FR-08).

---

## Docs
- README: change the "Use my location is not available on Windows yet" note to state it works (remove the deferral note in the Windows install section).
- `docs/HELP.md`: update the location line so it no longer says Windows is unsupported.

## Verification dependency
QA-01 (coords when allowed) and QA-03 (guidance when off) require the Windows 11 machine — the WinRT permission/position path cannot be exercised on macOS/CI. Everything else (compile, mac/web no-regression, dead-code removal, docs) is verifiable on macOS/CI.

## No Data Layer Work Required
No migrations or storage changes.

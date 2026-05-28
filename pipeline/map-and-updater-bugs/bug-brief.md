# Bug Brief — map-and-updater-bugs

## What is broken

**Bug A — "Could not resolve species codes":** Map Explorer's "Find Target Sightings" always fails
with this error even when the eBird API key is saved. The eBird taxonomy (16,000+ species)
is fetched via `tauriFetch` and cached in IndexedDB (`taxonomy-v2024`). If the cache was
written during a previous version when the key was missing (storage was broken in 0.3.11),
it contains empty maps. The 7-day TTL keeps the bad cache alive; all species code lookups
return undefined; both the pre-fetch and on-demand fetch paths fail silently; the misleading
"Check your eBird API key" message appears.

**Bug B — "Use my location" fails (deferred to /new-feature):** Geolocation via
`navigator.geolocation` is blocked in Tauri v2's WKWebView. Deferred; the current error
message is acceptable for now.

**Bug C — Updater not applying:** After accepting an update, the app shows "Update installed —
relaunch to apply." After the user relaunches (often via Dock click, which may refocus the
running process rather than quitting), the same update reappears. Tauri v2 on macOS requires
a clean quit-then-relaunch cycle for bundle replacement to take effect. The current UI waits
for a manual relaunch that may never cleanly terminate the running process.

## In scope (added)

**Cache-clear button in Settings:** A "Rebuild caches & refresh" button that clears the
IndexedDB taxonomy cache and localStorage, then relaunches the app. Gives users a recovery
path for any stale-cache issue without requiring a reinstall. Uses `tauri-plugin-process`
`relaunch()` to restart cleanly, which is the same plugin needed for Bug C.

## Steps to reproduce

Bug A: 1. Open Map Explorer. 2. Load an eBird backup. 3. Click "Find Target Sightings." Error appears.
Bug C: 1. Open Settings. 2. Click "Check for updates." Accept. 3. Click Dock icon to reopen. Same update shown.

## Expected behavior

Bug A: Target sightings search succeeds after species codes resolve from eBird taxonomy.
Bug C: After update installation the app restarts automatically running the new version.
Cache button: Clicking it clears all app caches and restarts the app cleanly.

## Blast radius

- Bug A fix (bump cache key, validate taxonomy, fix error message): `taxonomyService.ts`, `MapExplorer.tsx`.
- Bug C fix + cache button (auto-relaunch): adds `tauri-plugin-process` Rust crate, npm package,
  capability, changes `updateManager.ts`, `App.tsx`, and adds button to `Settings.tsx`.

## What done looks like

- Map Explorer "Find Target Sightings" returns results (not an error) after a file is loaded.
- After accepting an update, the app relaunches automatically and shows "Up to date" on the next launch.
- Settings has a "Rebuild caches & refresh" button that restarts the app cleanly.

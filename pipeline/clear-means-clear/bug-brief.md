# Bug Brief — clear-means-clear

## What is broken
Clearing the eBird backup does not clear what was derived from it, and does not tell the app it happened. `handleDeleteFile` (`Settings.tsx:1950-1961`) deletes the CSV and drops two in-memory caches; it leaves `exotic-provenance-v1` (submission ids, species codes, escapee common names) and `checklist-projects-v1` (submission ids) in `settings.json`, and `/weather/S…` + `/tide/S…` entries in `replay.json`. None of the three stores exports a purge; `Settings.tsx` imports none of them. It also never calls `onFilesSaved?.()` (fired at `:1921` on the save path only), so the seven still-mounted tabs (`display:none`, `App.tsx:1162-1354`) keep rendering the cleared backup until relaunch.

## Steps to reproduce
1. Load an eBird backup; open Statistics and let the escapee + Projects sections answer, then open a checklist's weather on the Weather tab.
2. Open Calendar (or any observations tab) so it loads, then switch to Settings and press Clear on the eBird row.
3. Switch back to Calendar: it still shows the cleared backup's data, with no reload and no setup panel.
4. Quit, reopen, inspect `AppLocalData/data/settings.json` and `data/replay.json`.
5. `exotic-provenance-v1`, `checklist-projects-v1` and the `/weather/S…` entries are still there, holding the user's own checklist ids and species names.

## Expected behavior
Clear removes the backup **and** everything derived from it, on all three clear paths, and every mounted tab notices at once. Purge on **clear only, never on replace**: `PRIVACY_POLICY.md:34` publishes that loading a newer export re-asks only unanswered checklists, and purging on upload would falsify it and destroy the projects store's 365-day incremental premise. Coordinate-keyed replay entries (`/weather/at`, `/tide/at`, from the Weather Forecast panel) and everything derived from `ml-export.csv` are untouched.

## Blast radius
Three clear paths, not one (the security report names only the first): `Settings.tsx handleDeleteFile`; `icloudSync.ts:1283` `clearWithSync`; `icloudSync.ts:583` `delete-local`. The controller's shared `deps.invalidate(slot)` also serves the synced **arrival** at `:472` — a replace — so a purge hung on that callback would fire on the wrong path; the three clear sites need one shared purge they cannot drift apart on. `replayStore.scheduleWrite` is a 250 ms debounced whole-document write, so a purge must supersede a pending flush or it re-lands. The `settings.json` purge is a read-modify-write and owes `TauriStorage`'s `docChains` (`storage.ts:463`) — `deleteSetting` already chains. Epoch-bump side effects are inert: the controller's subscriber (`:1134`) calls `requestCheck`, which returns early when `!pref.enabled` (`:1089`), and with sync on this path is not taken. Deliberately **out of scope**: `county-completeness-v1` and `hotspot-activity-v1` (network payloads keyed by region/hotspot, not the user's observations — though the completeness key *set* is a weak inference channel, `useCountyCompleteness.ts:173`); the Nominatim county cache (in-memory only, `nominatimService.ts:76`); the taxonomy IndexedDB (`RebuildCachesButton`).

## What done looks like
1. All three clear paths purge `exotic-provenance-v1`, `checklist-projects-v1`, and every checklist-keyed replay entry, through one shared function; a test drives each path and asserts the documents are empty on disk afterwards.
2. A test asserts an upload/replace (`Settings.tsx:1916` and `icloudSync.ts:472`) purges **nothing** — the projects and provenance answers survive a newer export, and `/weather/at` survives a clear.
3. `handleDeleteFile` bumps the files epoch; a mounted tab flips to its setup-required panel after a local clear with no relaunch.
4. A purge lands even with a replay write in flight (put, purge inside the 250 ms debounce, assert the flushed document has no `S…` keys), and `npm run build` + the full frontend suite pass.
5. `docs/HELP.md:601`/`:615`, `PRIVACY_POLICY.md:16` and `website/privacy.html:124` state what Clear now removes, in the same change; `PRIVACY_POLICY.md:34` still reads true.

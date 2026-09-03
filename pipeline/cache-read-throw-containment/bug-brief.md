# Bug Brief — cache-read-throw-containment

## What is broken
In both shared parse caches the stored-file read sits OUTSIDE `loadFresh`'s own `try`, so a read rejection escapes to the caller: `observationsCache.ts:193` (`await storage.readFile('ebird')`, `try` opens at 196) and `mlExportCache.ts:23` (`await storage.readFile('ml')`, `try` opens at 26). Both docstrings promise a falsy answer on failure and neither delivers it for the read.
A thrown load lands in each tab loader's outer `catch`, which sets `{ tag: 'setup-required' }` — the SetupRequired panel telling the user to upload a backup that is plainly stored. That is the exact lie the 1.0.14 honest-load-failures build removed everywhere else (DECISIONS.md line 13; the `setup-required` vs `error` split, 2026-05-22).
Reachable on web/Pi, where `WebStorage.readFile` (storage.ts:239) is a bare `fetch` + `res.text()`: the fetch rejects when the backend is unreachable and `res.text()` rejects on a body truncated mid-download, which is an ordinary Wi-Fi event for a ~6 MB CSV served off a Pi. `TauriStorage.readFile` (storage.ts:645) wraps its IO in its own try/catch and returns null, so desktop is defended — except for the `await this.fs()` dynamic import on the line above that try, which can still throw.
This was deferred by name, not by oversight: DECISIONS.md line 29 records the deferral, names BOTH modules and states the reason was timing (a shared seam, on the last build before release prep), not permission.

## Steps to reproduce
1. `cd backend && uvicorn main:app --reload --port 1620`, `cd frontend && npm run dev`; in Settings save both an eBird backup and an ML export so `getFilesStatus` reports them.
2. Open DevTools → Network → Block request URL, and add exactly `*/settings/files/ebird`. This is a different URL from `/settings/files` (the `getFilesStatus` route), so file status still resolves "a backup is stored" while only the CSV read fails.
3. Reload and open Statistics, Calendar, Checklists, Breeding Codes, Named Birds, Species Detail, or Map Explorer.
4. Observed: the SetupRequired panel ("eBird Backup Required" plus the upload step list). Expected: the terse `EBIRD_BACKUP_LOAD_ERROR` panel naming `MyEBirdData.csv` and the Settings path.
5. For the ML half, block `*/settings/files/ml` instead and call `loadMLExport()` from a caller without a guard; today all five production callers guard it, so reproduce at the module level (a `storage.readFile` mock that throws) rather than through a tab.

## Expected behavior
`loadEbirdObservations()` and `loadMLExport()` resolve `null` for a read failure exactly as they already do for a parse failure, so the promise these two modules hand back structurally cannot reject.
The eight tab loaders then take the falsy branch they already have and land on `error` with `EBIRD_BACKUP_LOAD_ERROR`, never `setup-required`; nothing is cached, so the next mount or file change retries.
`loadMLExport` returning null continues to mean "no media", which is what all five of its callers already coerce a throw into today.

## Blast radius
Shared seam: 10 production `loadEbirdObservations` call sites (App.tsx:568, NamedBirds:64, BirdingStats:176, Calendar:784, MapExplorer:677, Checklists:428, BreedingCodeList:165, LifeList:263 and :438, SpeciesDetail:203, plus `lib/hotspotSet.ts:101`) and 5 `loadMLExport` sites (BirdingStats:182, MapExplorer:683, Checklists:429, SpeciesDetail:209, NamedBirds:76).
**No caller relies on the throw to separate "no file" from "unreadable file", and the architecture is why:** every tab calls `storage.getFilesStatus()` FIRST and branches on `status.ebird` / `status.ml` before the cache is ever called, so "no file at all" is already decided upstream and a falsy return from the cache already means "stored but unloadable". Collapsing the throw to null loses no distinction any caller uses; it makes an existing branch fire where a throw currently jumps over it.
The two callers that skip `getFilesStatus` already collapse both cases identically: `hotspotSet.ts:101` returns an empty Set on falsy while `useHotspotSet.ts:24` catches the throw to the same empty Set, and `App.tsx:568` sets `backlogRows` null on both. Zero behavior change there.
Behavior CHANGES on exactly the 8 unguarded eBird paths (setup-required → error). The 4 `.catch(() => null)` ML guards and NamedBirds' inner try/catch become defense-in-depth; leave them in place and retarget their comments rather than removing them in the same change.
Two standing decisions must survive untouched: LifeList deliberately reads the ML file itself instead of via `loadMLExport` (DECISIONS.md line 1421 / v0.5.52) because swallow-to-null would be a different lie there, and `error` must stay distinct from `setup-required` (2026-05-22). Do not let this fix become an argument for routing LifeList through the cache.

## What done looks like
The read is inside the existing `try` in both modules, the docstrings say so, and the seam is asserted at the MODULE level (alongside `observationsCacheSettle.test.ts`): a `storage.readFile` that rejects resolves `null`, nothing is cached, `inflight` clears, and the next call retries.
At least one tab test proves a throwing eBird read now renders `EBIRD_BACKUP_LOAD_ERROR` with the SetupRequired step list ABSENT, matching the row shape `honestLoadFailures.test.tsx` already uses.
`honestLoadFailures.test.tsx` still passes unchanged (it mocks the cache modules, so it keeps proving the caller guards), and `npm run build` is green before push.

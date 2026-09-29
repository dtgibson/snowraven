## iCloud bar-chart sync (icloud-bar-chart-sync)

### What this does

On a Mac, iPhone or iPad with iCloud Sync on, each county's eBird bar-chart file now syncs through the user's own iCloud container as its own item (`barcharts/US-XX-NNN.txt` plus a record), reconciled per county with the same rules as the two data files, and a removal on one device reaches the others through a cleared marker. The Targets tab's day-by-day eBird answers sync as one snapshot per device (`day-obs/<deviceId>.json`), merged on read, so a device does not repeat requests another device already made. Settings gains a Bar-chart files section on every platform (web/Pi and Windows included) with a Remove all bar-chart files control that always confirms.

### How to test

1. `cd frontend && npm run typecheck && npm run lint && npm run build`, then `npx vitest run` (408 files / 8,653 tests at hand-back).
2. `cd src-tauri && cargo test` (90 lib tests; 25 in `icloud`).
3. `cd backend && .venv/bin/python -m pytest tests/ -q` (1,980).
4. Web/Pi preview (see `how-to-see.md`): Settings, Bar-chart files. With no files the button is focusable but cannot act and says why; add a county file on the Targets tab, come back, confirm the count, press Remove all, confirm, and check the status line and the Targets card both empty out.
5. Held published copy: `git apply --check pipeline/icloud-bar-chart-sync/held-published-copy.patch`, apply, `npx vitest run`, then `git apply -R`.
6. Real sync (two Apple devices, user-performed after TestFlight; this Mac is not signed into iCloud): add a file for a county on device A, check it arrives on B; remove it on B with the confirmation, check it leaves A at A's next check.

### Notes for reviewer

- **Native layer.** Seven new item commands in `src-tauri/src/icloud.rs` over a closed `SyncItem { County, DayObs }`, with `County::parse` a byte check twinned with `REGION_CODE_RE` through one shared fixture (`frontend/src/lib/regionCode.fixture.json`, 24 rows, each side with its own enforcement test). A day-obs snapshot can be written only by the device whose id it carries. `icloud_remove_all` now clears both item kinds. The existing slot commands were deliberately NOT refactored onto `SyncItem` (lower risk; the item layer sits beside them).
- **Controller.** `lib/icloud/countySync.ts` runs `reconcileSlot` unchanged per county (one listing, one shared download wait, cleared markers batched at 64). `lib/icloud/dayObsSync.ts` pushes this device's snapshot (skipped only while iCloud still holds exactly what was last pushed) and merges each peer once per digest. `barChartsCleared` registers its pending markers synchronously before any await, which closes a race where the epoch-triggered check pulled a just-removed file back (`countySync.test.ts`, RACE row).
- **Day cache.** `mergeSharedSnapshot` validates every peer entry through the load path's own validator and writes through the same mirror and ordered writer, so the no-`docChains` argument still holds (header updated; `cacheInventory.test.ts` pins it). The eviction pass is now O(n log n) (D9), held to the previous implementation as a differential oracle on the load and put paths, plus a same-run quotient (3.4x per 4x input, where the old pass measured 15.6x).
- **Targets card.** With sync on, Remove confirms first. The confirm gate is `syncEnabled`, not "this county has a view", so a file cannot come back from iCloud because it was removed before the first check. The sync line is one stable region across every state.
- **Backend.** `DELETE /settings/barcharts` (web/Pi bulk removal); the region pattern uses `fullmatch`.
- **Copy.** Items 1 to 33 are written as approved. One string is composed from approved parts: the sync-on, one-county body of the Remove all confirmation joins "The bar-chart file for 1 county" (item 20's singular subject) to item 20's sync-on remainder. Items 34 to 44 are in `held-published-copy.patch` and are NOT applied; until they land, the privacy policy's "not part of iCloud Sync" sentence is false for Apple builds with sync on.
- **Not covered by automated tests:** real iCloud transfer, placeholder downloads and multi-device convergence on hardware (V1 to V3); the main-thread cost of merging a 10 MB peer snapshot on a phone (V4).

## Convention Flags
- A per-item synced KIND (bar-chart files, day snapshots) sits beside the two slots and never becomes a third `Slot`; it reuses `reconcileSlot` per item and names its container subdirectory in one table (`ITEM_SUBDIRS`) with a Rust twin.
- A shared state that several devices write is synced as one snapshot per device, merged on read, and each device writes only its own; the native write refuses a snapshot whose name is another device's id.
- A controller action that records a pending marker registers it synchronously, before its first await, whenever an epoch bump on the same path can start a check.
- A section rendering a stored file's sync state draws the one shared `components/ui/SyncLine.tsx` region at a fixed position in every state, so it is never remounted.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

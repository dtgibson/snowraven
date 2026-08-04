# Retire Offline Maps (v0.5.74)

### What this does

Removes the downloadable offline-maps feature (offline-support "Tier B") end to end
and adds nothing in its place. The feature never worked for a single user: the
`regions-2026.06` bake was deferred at the v0.5.45 release and never happened, so
`regions-catalog.json` shipped with `"regions": []`, every download URL 404s, and
`RegionBaseSource` self-gated to inert on an empty region list. A second latent
proof that no region was ever downloadable: `renameRegionPartial` calls `rename`,
but `fs:allow-rename` was never granted, so even a successful fetch would have been
denied at the commit step. This is dead-code removal, not a capability withdrawal.

Out go the Settings "Offline maps" section and its `offline-maps-enabled` toggle,
the bundled region catalog, the download and orchestration layer, the `srpm://`
PMTiles protocol and its range-read path through the storage seam, the seven region
methods and two region types on both storage implementations, the map-side region
swap, the `pmtiles` dependency, the four `fs:` capability grants that existed only
for region range reads, and the region-baking tooling.

**Offline support Tier A is untouched** — the persisted map-style blob and the
bundled glyph and sprite assets, which are what actually make the map mount and
label itself offline. So is everything else sharing the word "offline" but not the
feature: `offlineDetect`, `OfflineMessage`, `useOnline`, the replay store, and the
bundled taxonomy floor. `lib/regionNames.ts` is eBird region codes for the
Statistics tab and is unrelated despite the name.

**Deleted**
- `frontend/src/lib/mapPmtiles.ts` (+ its test)
- `frontend/src/lib/regionDownload.ts` (+ its test)
- `frontend/src/components/OfflineMapsSection.tsx` (+ its test)
- `frontend/src/components/map/RegionBaseSource.tsx`
- `frontend/src/assets/regions-catalog.json`
- `tools/build-regions/` (the whole `tools/` tree, which held nothing else)

**Edited**
- `Settings.tsx` — the gated section block and its two imports
- `platformGates.ts` — `showOfflineMapsSection()` (and its test cases)
- `storage.ts` — the seven region methods on `StorageAdapter` and both
  implementations, `RegionEntry` / `RegionsManifest`, the four region path
  constants, `REGION_ID_RE` / `assertRegionId`, and the
  `regionDownloadsUnavailable` web-side thrower
- `MapExplorer.tsx` — the one `<RegionBaseSource />` render site and its import
- `frontend/package.json` — `pmtiles` dropped (`npm uninstall`, lockfile updated)
- `src-tauri/capabilities/default.json` — `fs:allow-open`, `fs:allow-read`,
  `fs:allow-seek`, `fs:allow-write-file` dropped. **Only those four.** The other
  `fs:` grants (`read-text-file`, `write-text-file`, `mkdir`, `exists`, `remove`)
  are shared by API keys, settings, metadata, CSVs, the style blob, and the replay
  store, and all stay.
- Docs sweep: `docs/HELP.md`, `README.md`, `website/index.html`,
  `ACCESSIBILITY.md`, `ROADMAP.md`, `PRODUCT_CONTEXT.md`, `PRIVACY_POLICY.md`,
  and CLAUDE.md's county-line convention
- Version bumped to 0.5.74 in **both** `frontend/package.json` and
  `src-tauri/tauri.conf.json`, plus a `CHANGELOG.md` entry

**Deliberately not done** (all from the approved brief)
- No home-location tile caching and no "clear map caches" control. The user
  re-scoped this to removal only after being told the facts.
- No migration to delete the orphaned `offline-maps-enabled` key from
  `data/settings.json`. It is an unread key in a JSON blob nothing will read
  again; deleting it on load would add a startup write path and a new failure
  mode for no user-visible benefit. `data/regions/` and
  `data/regions-manifest.json` can never exist on any user's disk (both are
  written only after a successful fetch, which never happened), so there is
  nothing else to clean up.
- No history rewriting: the 0.5.45 CHANGELOG entry, existing `DECISIONS.md`
  entries, and the `pipeline/offline-support/` and `pipeline/offline-maps/`
  record sets are untouched. The Chronicler logs the retirement as a new decision.

### How to test

1. `cd frontend && npm run build` — the real gate (`tsc -b && vite build`), which is
   what Windows CI and `release.sh` run.
2. `cd frontend && npm run lint`
3. `cd frontend && npm run test`
4. `cd backend && ./.venv/bin/python -m pytest tests/ -q` (nothing backend was
   touched; run for confidence)
5. Desktop dev app (`npm run desktop:dev`): open **Settings** and confirm there is
   no "Offline maps" section — the map-defaults card is followed directly by Tab
   Layout, spaced like every other section pair.
6. Open **Map Explorer** while online so the style is persisted, then disconnect
   the network and reopen it. The map must still mount, draw your sightings /
   heatmap / atlas / county lines, and show the base map's place labels. That is
   Tier A, and it must be unchanged.

### Notes for reviewer

- **The `fs:` grant removal is the one line worth a second look.** `fs:allow-open`,
  `-read`, `-seek`, and `-write-file` backed exactly two now-deleted storage
  methods: `readRegionBytes` (`open` + `seek` + `read`) and `writeRegionPartial`
  (`writeFile`). Every surviving `plugin-fs` call in `storage.ts` and
  `iosImport.ts` uses `readTextFile` / `writeTextFile` / `mkdir` / `exists` /
  `remove`, all of which keep their grants. `mobile.json` and `desktop.json`
  carry no `fs:` grants at all.
- **`entryChunk.test.ts` still passes**, and a fresh `dist/index.html` has no
  `vendor-maplibre` or `us-counties` modulepreload entry, so the standing
  entry-chunk guard is intact.
- **One discrepancy between the brief and the codebase**, in the codebase's favor:
  the brief lists the storage edits as the region API plus `RegionEntry` /
  `RegionsManifest` plus the four path constants. The file also carried two
  region-only helpers the brief did not name — `REGION_ID_RE` / `assertRegionId`
  (the id shape guard) and `regionDownloadsUnavailable()` (the web-side thrower).
  Both became unreferenced once the methods went, and `tsc -b` would have failed on
  them, so both were removed too. Nothing else in either file used them.
- The privacy policy changes in the shrinking direction only: GitHub leaves the
  tile-provider list and the "Offline maps" subsection goes. Its effective date
  advances to August 4, 2026 per its own "Changes to This Policy" clause.
- The website's downloaded-regions mock figure was replaced (not deleted) with a
  figure showing what actually works offline, so the offline-support feature card
  keeps its two-column layout. Its icon was swapped to a wifi-off glyph to match
  the new label. The version pill and footer version are in lockstep at v0.5.74.
- No Rust source changes. No backend changes. No new dependencies.

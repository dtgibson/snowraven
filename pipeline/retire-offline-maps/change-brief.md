# Change Brief — Retire Offline Maps

## What is changing

Remove the downloadable offline-maps feature (offline-support "Tier B") end to end, and add nothing in its place. Out go the Settings "Offline maps" section and its `offline-maps-enabled` toggle, the bundled region catalog, the download and orchestration layer, the `srpm://` PMTiles protocol with its range-read path through the storage seam, the seven region methods and two region types on both storage implementations, the map-side region swap, the `pmtiles` dependency, the four `fs:` capability grants that exist only for region range reads, and the region-baking tooling.

Deletions: `frontend/src/lib/mapPmtiles.ts`, `frontend/src/lib/regionDownload.ts`, `frontend/src/components/OfflineMapsSection.tsx`, `frontend/src/components/map/RegionBaseSource.tsx`, `frontend/src/assets/regions-catalog.json`, `tools/build-regions/`, and four test files (`mapPmtiles.test.ts`, `regionDownload.test.ts`, `OfflineMapsSection.test.tsx`, and the region cases in the Settings suite). Edits: `Settings.tsx` (drop the gated section block and its import), `platformGates.ts` (drop `showOfflineMapsSection`), `storage.ts` (drop the region API from the interface and both implementations, plus `RegionEntry` / `RegionsManifest` and the four region path constants), `MapExplorer.tsx` (drop the one `<RegionBaseSource />` render site), `package.json` (drop `pmtiles`), and `src-tauri/capabilities/default.json` (drop `fs:allow-open`, `fs:allow-read`, `fs:allow-seek`, `fs:allow-write-file`).

Offline-support **Tier A is untouched**: the persisted map-style blob and the bundled glyph and sprite assets, which are what actually make the map mount and label itself offline. So is everything else that shares the word "offline" but not the feature: `offlineDetect`, `OfflineMessage`, `useOnline`, the replay store, and the bundled taxonomy floor. `lib/regionNames.ts` is eBird region codes for the Statistics tab and is unrelated. No Rust source changes; no backend changes.

## Why now

The premise is correct, and the record already agreed with it before the attempt. The blocker was always hosting, not rendering: the 2026-06-05 exploration named it and shelved the feature, and the v0.5.45 design tried to route around it by self-hosting pre-baked county and state `.pmtiles` on a `regions-<ver>` GitHub Releases tag. That bake was deferred at release and never happened. `regions-catalog.json` is 140 bytes with `"regions": []`, and the `regions-2026.06` tag does not exist.

So the feature has never worked for a single user. Every download URL 404s, "Counties you bird" always resolves to zero available regions, the manager always renders its empty state, and `RegionBaseSource` self-gates to inert on `regions.length === 0`. A second latent proof: `renameRegionPartial` calls `rename`, but `fs:allow-rename` was never granted, so even a successful download would have been denied at the commit step. This is dead-code removal, not a capability withdrawal.

## User-facing impact

Modest, and worth stating honestly rather than claiming none. Desktop and web/Pi users lose the visible "Offline maps" Settings section and its toggle; iOS never showed it. Nobody loses working behavior, because no region was ever downloadable on any platform.

Offline map behavior itself is unchanged. The map still mounts offline with its labels and the user's own layers drawn on it (Tier A), and areas already viewed still come back from the WebView's own cache. There is no new caching and no new control, so nothing else in Settings moves.

## Design pass

**Not needed. No visual change beyond a clean deletion.** The section is a self-contained sibling in the Settings column: a `marginTop: 24` wrapper holding a `SectionHeader`, then `OfflineMapsSection`, which carries its own trailing copy and bottom margin. Every neighbouring section carries its own `marginTop: 24`, so removing the block leaves no orphaned separator, no dangling header, and no gap for anything to reflow into. The map-defaults card is simply followed by the tab-layout section, spaced exactly as every other pair already is.

Nothing is being added, re-laid-out, or restyled, and no new state or copy needs designing, so there is no hierarchy, spacing, type, color, or motion judgment for The Designer to make. The Engineer builds directly. (This reverses the earlier "needed" call, which rested entirely on the Troubleshooting card gaining a second action; that control is no longer in scope.)

## Leftover state on a user's disk

Nothing needs cleaning up, and The Engineer should not write a migration. `data/regions/` is created only by `writeRegionPartial`, which runs only after a successful fetch, so the directory and any `.pmtiles` or `.partial` file can never exist. `data/regions-manifest.json` is written only on a completed download or a removal of a listed region, so it is never created either.

The single possible orphan is the `offline-maps-enabled` boolean inside `data/settings.json`, present only if a user flipped the toggle on. Leave it. It is an unread key in a JSON blob that nothing will ever read again; deleting it on load would add a startup write path and a new failure mode for no user-visible benefit.

## Decisions touched

- **`## Offline support — 2026-06-21 (v0.5.45)`** — REVERSES its Tier-B half: the `srpm://` and self-hosted-PMTiles basemap mechanism, FR-20 (desktop-only region downloads), and FR-11a (the opt-in toggle, default OFF). Its Tier-A half, the replay store, the taxonomy floor, and the offline messaging all stand. FR-11a's standing promise that the app performs no automatic or background tile downloading survives and is now unconditionally true.
- **`## Offline maps — explored, shelved (roadmap) — 2026-06-05`** — NOT reversed; vindicated. Its finding that tile hosting rather than rendering is the blocker is exactly what this change concedes, and the v0.5.45 attempt to route around it is what ends here.
- **`## iOS app icon fix (+ offline-maps deferral) — 2026-07-06`** — MOOTED, along with the `pipeline/mobile-app/prd.md` FR-15 / FR-23 desktop-only scope it rested on and the `showOfflineMapsSection()` gate that implemented it.
- **ROADMAP "Offline maps on iOS"** comes off On the Horizon, and its matching idea-inbox entry should be dismissed rather than left to resurface.

## What done looks like

The "Offline maps" section is gone from Settings on every platform, `pmtiles` is out of `package.json`, the four region-only `fs:` grants are out of `default.json`, and `npm run build` plus lint plus vitest are green with the region tests removed and the `platformGates` and `Settings` suites updated. The map still mounts and labels itself offline with the user's data drawn on it, proving Tier A is intact, and `entryChunk.test.ts` still passes.

No stale offline-maps claims survive in `docs/HELP.md` (its "Offline maps (desktop app)" section and the cross-reference in the offline-usage section), `README.md` (the feature bullet and the privacy paragraph's region-download sentence), `website/index.html` (the two copy passages and the downloaded-regions figure, with the version pill kept in lockstep), `ACCESSIBILITY.md` (its "Offline Maps and Offline States" section, whose region-manager paragraph describes controls that will no longer exist), `ROADMAP.md`, `PRODUCT_CONTEXT.md`, and CLAUDE.md's county-line convention, which asserts a tradeoff about having "no region downloaded at z10+".

`PRIVACY_POLICY.md` does change, in the shrinking direction: the GitHub bullet leaves the tile-provider list and the whole "Offline maps" subsection goes, because the app can no longer contact that endpoint at all. Advance its effective date from July 5, 2026, per its own "Changes to This Policy" clause. This is a user-facing change, so it takes a patch version bump in both `frontend/package.json` and `src-tauri/tauri.conf.json`, a `CHANGELOG.md` entry, and a release. History is not rewritten: the 0.5.45 changelog entry, the existing `DECISIONS.md` entries, and the `pipeline/offline-support/` and `pipeline/offline-maps/` record sets stay as they are, and The Chronicler logs the retirement as a new decision.

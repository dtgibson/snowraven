# QA Report — Offline Support

**Date:** 2026-06-21
**Test Runner:** vitest (frontend) · pytest (backend)
**Result:** PASSED

## Test Suite Results

**1,251 tests passing, 0 failing.**

- Frontend (vitest): **1,094 passing** across 91 files.
- Backend (pytest): **157 passing.**
- `npm run lint`, `npm run typecheck`, and `npm run build` all clean.
- Build inspection (NFR-15 / QA-37): a fresh `npm run build` shows `vendor-maplibre` and `pmtiles` **absent** from `dist/index.html`'s modulepreload; the region/protocol code lands only in the lazy `MapExplorer` chunk; the bundled taxonomy snapshot loads on demand (not the entry chunk).

## Acceptance Criteria Verification

Verified independently and skeptically against the actual code and tests (a seven-way parallel pass whose job was to catch optimistic passes). **No criterion was found unmet or overclaimed.**

| Criterion | Result | Basis |
|---|---|---|
| QA-01 (style seed-before-fetch ordering) | ✓ Pass | test — `persistedStyle.test.ts` coalescing/ordering; SnowMap awaits read before fetch |
| QA-02 (mount offline + draw local layers + labels) | ◐ Code verified | Map mount + sighting/heat/atlas layers met; offline **labels** release-deferred (glyphs not bundled yet) |
| QA-03 (cold-cache placeholder + Retry) | ✓ Pass | `SnowMap.tsx` placeholder `role=alert` + working Retry |
| QA-04 (refresh-on-reconnect, unbounded) | ✓ Pass | test — `revalidateStyleOnce` swallows failure, replaces on success |
| QA-05 (raster base disabled offline, vector stays) | ✓ Pass | `SnowMap.tsx` raster-disable + aria; positron stays mounted |
| QA-06 (theme: GL sprites re-bake, base tints don't) | ✓ Pass | base tints are theme-independent literals by design (FR-08 scope) |
| QA-07 / NFR-01 (no auto-network on boot) | ✓ Pass | map-mount-triggered, never app-load; FCP budget is a release benchmark |
| QA-08 (region pan ≥30 fps, zero tile requests) | ⧖ Release-time | needs a real baked region + desktop runtime + fps profiling |
| QA-09 (region survives relaunch) | ⧖ Release-time | needs a real Tauri process lifecycle |
| QA-10 (manager list + size + total) | ✓ Pass | test — `OfflineMapsSection.test.tsx` |
| QA-11 (download progress + cancel) | ◐ Code verified | progress/cancel code + UI met; real network-stream cancel at release |
| QA-12 (clean-discard partials) | ◐ Code verified | discard logic met (temp `.partial` → atomic rename); real fs observation at release |
| QA-13 (insufficient-storage graceful) | ◐ Code verified | error path + budget isolation met; forcing a real quota error at release |
| QA-14 (stale badge, never auto-delete) | ✓ Pass | test — `regionDownload.test.ts` `isRegionStale` (injected now/version) |
| QA-15 (desktop-only / web limitation) | ✓ Pass | test + inspection — web shows the limitation note, no download control |
| QA-16 (first-ever cold-start taxonomy, both runtimes, `rocpig1`→parent) | ✓ Pass | test — `taxonomyService.floor.test.ts` + `test_taxonomy_router.py` |
| QA-17 (desktop IndexedDB + single coalesced load) | ✓ Pass | IndexedDB floor path + coalesced load |
| QA-18 (web/Pi disk-persist across restart, no eBird call) | ✓ Pass | test — `test_taxonomy_router.py` offline-floor |
| QA-19 (versioned snapshot key, on-demand chunk) | ✓ Pass | `taxonomy-v2027` key; snapshot is a dynamic chunk |
| QA-20 (degrade gracefully when unavailable) | ✓ Pass | test — empty-maps fallback, no throw |
| QA-21 (weather replay + cue + networkCache untouched) | ✓ Pass | test — `replayStore.test.ts` + `transport.test.ts`; StalenessCue in App |
| QA-22 (tide replay; classification still offline) | ✓ Pass | test — replay keying for all four shapes |
| QA-23 (checklist-detail replay mechanism) | ✓ Pass | by design — `getReplayable` is path-agnostic; Comparer opts out (FR-38) |
| QA-24 (CAP+1 eviction, oldest-out, MRU survives) | ✓ Pass | test — `replayStore.test.ts` eviction (OQ-07/QA-24) |
| QA-25 (failed fetch never overwrites a good entry) | ✓ Pass | test — never-put-on-failure |
| QA-26 (three distinct messaging treatments) | ✓ Pass | test — `offlineMessage.test.ts` + `OfflineMessage.test.tsx` |
| QA-27 (prefer replay over offline error) | ✓ Pass | test — replay-on-offline path |
| QA-28 (update check: 404/offline ≠ up-to-date; 5xx=error) | ✓ Pass | test — `test_version_router.py` + `versionService` |
| QA-29 (navigator.onLine advisory only, never hard-gates) | ✓ Pass | inspection — onLine only chooses copy, never gates a request |
| QA-30 (web/Pi backend-down ≠ device-offline) | ✓ Pass | test — FR-39a suite (4 tests) |
| QA-31 (generic `/settings/{key}` round-trips both runtimes) | ✓ Pass | test — `test_settingskv_router.py` + live round-trip |
| QA-32 (privacy: every tile/style/glyph/sprite host enumerated) | ✓ Pass | **fixed this stage** — host-diff against `mapStyle.ts` now empty |
| QA-33 (docs + version bump both files + CHANGELOG) | ✓ Pass | inspection — both at 0.5.45; README/HELP/website/accessibility/changelog updated |
| QA-34 (route parity + no new localStorage + isTauri-only) | ✓ Pass | inspection — route registered last, `/settings` proxied |
| QA-35 (NFR-08 map-image/source contract) | ✓ Pass | test — `mapPmtiles.test.ts` (9) + `SightingMarkers` source-id test |
| QA-36 (new UI WCAG AA + responsive + >color) | ✓ Pass | inspection — `var(--sr-*)` tokens, role=switch/progressbar, sr-action-row |
| QA-37 (fresh build: maplibre/pmtiles off entry) | ✓ Pass | build inspection — absent from entry modulepreload |
| QA-38 (NFR-02: one read per session — style + replay) | ✓ Pass | test — style + replay coalesced (manifest fresh-reads are deliberate; see Known Limitations) |
| QA-39 (region id/extent/URL shape-validated + encoded) | ✓ Pass | inspection — `REGION_ID_RE` guard + `encodeURIComponent` |
| QA-40 (FR-11a toggle-off: no tile bytes by default) | ✓ Pass | test + inspection — default OFF, hard-gated download |

**Tally:** 32 verified here (17 by automated test, 11 by mechanical/build inspection, 4 by construction) · 6 code-verified-here with E2E confirmed at release · 2 release-time only. **0 failures, 0 overclaims.**

## Release-time Verification (cannot run on the build VM)

These are code-complete and flag-gated; they require a real desktop runtime, a real baked region, bundled glyph/sprite assets, or a network/HAR harness, and are verified at release on the Mac:

- **QA-02 (offline labels)** — needs the release-time glyph/sprite capture (`BUNDLED_MAP_ASSETS` flip). Map mount + local-data layers are verified here.
- **QA-08 (≥30 fps offline pan)** — needs a real baked county + desktop profiling.
- **QA-09 (region survives relaunch)** — needs a Tauri process lifecycle.
- **QA-11 / QA-12 / QA-13** — the download stream-cancel, partial-file discard, and insufficient-storage paths are implemented and unit-checked; their real-fs/real-network behavior is confirmed at release.

## Edge Cases Tested

- `rocpig1` (a sub-form / `reportAs`) resolves to its parent species offline in both runtimes (QA-16).
- A forced GitHub 404 (no release) and a connection-level failure both avoid the "up to date" false positive (QA-28).
- The `rewriteStyleAssetUrls` glyph template keeps `{fontstack}`/`{range}` literal (a percent-encoding bug was found and fixed this build, locked with a test).
- Replay CAP+1 evicts the oldest-loaded entry while the most-recently-loaded one survives (QA-24).

## Known Limitations

- **Region-manifest reads are intentionally not coalesced.** NFR-02/QA-38 require one-read-per-session for the *style* and *replay* stores (both coalesced + tested). The region manifest is a small file that is *mutated* during a session (download/remove), so fresh reads are the correct, safe choice — coalescing it would risk a stale manifest after a write for negligible gain. This is a deliberate design decision, not a gap.
- **Tier-B offline region rendering is verified at release**, not on this VM (no real region tiles, no desktop runtime). The decision logic, protocol handoff, storage seam, and manager UI are all unit-tested here.

## Convention Flags

- (None beyond the CLAUDE.md note The Engineer already added: the bundled taxonomy snapshot version key and the desktop IndexedDB `CACHE_KEY` must advance in lockstep when regenerating for a new Clements revision.)

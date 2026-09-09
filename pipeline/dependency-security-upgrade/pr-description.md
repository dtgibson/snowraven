# Dependency Security Upgrade

## What this does

Upgrades the shipped map engine from `maplibre-gl` 5.24.0 to 6.8.0, upgrades its React binding to the v6-compatible `react-map-gl` 8.1.3, and upgrades the Vitest family from 4.1.5 to 4.1.11. The targeted lockfile regeneration changes only the MapLibre/react-map-gl and Vitest dependency families. Both the production-only and full networked npm audits now report zero vulnerabilities.

The MapLibre v6 migration is explicit at each compatibility seam:

- `SnowMap` imports the ESM module worker through Vite's `?worker&url` loader and calls `setWorkerUrl` before any map can be constructed.
- Every map opts out of v6's new four-level overscale default with an explicit `zoomLevelsToOverscale={undefined}`, retaining the v5 rendering and `queryRenderedFeatures` posture.
- Atlas, county, and hotspot sprites retain their unconditional registration and exact owned-ID lookups, but now register behind one per-map `setMissingStyleImageResolver` dispatcher. Multiple sprite owners can coexist without overwriting one another; removing one owner preserves the rest, and the last cleanup clears the resolver.
- MapLibre, its CSS, and its new worker remain on the lazy map path and off the first-paint modulepreload/static-import path.

The production version is stamped as 1.0.26 in `frontend/package.json`, `src-tauri/tauri.conf.json`, `CHANGELOG.md`, and all three version locations in `website/index.html`.

## How to test

From `frontend/`:

1. `npm ci`
2. `npm audit --omit=dev`
3. `npm audit`
4. `npm run typecheck`
5. `npm run lint`
6. `npm run build`
7. `npm run test -- --maxWorkers=1`

The Engineer run completed all seven successfully. The full suite passed 5,548 tests in 317 files. The focused compatibility run passed 61 tests, and the post-build entry-chunk suite passed 44 tests. The production build emitted exactly one separate `maplibre-gl-worker-*.js` asset and did not modulepreload MapLibre, county geometry, or the worker.

## Notes for reviewer

- There is no intended visual, interaction, provider, request, storage, schema, backend, or Rust change.
- The shared missing-image dispatcher is a `WeakMap` keyed by the map and never indexes a plain object with the incoming image id. Each sprite owner still checks its hardcoded reverse lookup and `hasImage` before adding.
- The hotspot resolver remains dependent on `tierRings`; a toggle cleans up and re-registers only that handler, then refreshes all mode sprites in place as before.
- `styleimagemissing` remains a notification in MapLibre v6, so it is no longer used for synchronous recovery.
- The build-time worker assertion is positive as well as negative: it requires one worker asset to exist, while the static graph requires `SnowMap` to reach the worker import and the entry graph not to reach it.
- Real Chromium, macOS/iOS WebKit, and Windows WebView2 map smoke checks remain for the Tester. Those checks should cover vector tile loading, pan/zoom, hit-testing, sprites and texture toggles, popups, the context-menu/long-press path, and console/worker errors.
- The repository's local/release pin is Node 24, while both GitHub workflows currently request Node 20. MapLibre 6.8.0 supports Node 16+, but its `@mapbox/jsonlint-lines-primitives@2.0.3` transitive declares Node 22+ and therefore produces an `EBADENGINE` warning during a Node 20 install. This was exercised directly with Node 20.20.2: `npm ci` completed, the audit was clean, and the full production build passed with the same emitted assets. It is a warning rather than a CI blocker under the repository's current npm settings.
- Deployment is intentionally not performed here. The release stage owns `release.sh`, the Windows artifact, TestFlight, and App Store submission.

# Change Brief — Dependency Security Upgrade

## What is changing
Upgrade `maplibre-gl` from 5.24.0 to the fixed 6.8.x line, `react-map-gl` to 8.1.3 (8.1.2+ is required for MapLibre v6), and the Vitest 4.1.5 family to 4.1.11+; regenerate `frontend/package-lock.json` without a broad dependency refresh. Complete only the v6 compatibility work the app needs: bundle and set the Vite worker URL, replace the three synchronous `styleimagemissing` recovery handlers with the resolver API while retaining owned-ID filtering and unconditional sprite registration, and preserve v5 map/query behavior where v6 defaults differ. Add or adjust focused regression coverage. Because the production bundle changes, apply the normal patch stamp across `frontend/package.json`, `src-tauri/tauri.conf.json`, `CHANGELOG.md`, and `website/index.html`. No new UI, behavior, provider, data/schema, backend/Rust work, or unrelated refactor is in scope.

## Why now
A networked `npm audit` confirms GHSA-jrc7-96c5-q579 (CVSS 10 Critical XSS) in the direct production dependency `maplibre-gl@5.24.0`; `npm audit --omit=dev` is red and npm identifies 6.8.0 as the remediation. The full-tree audit also confirms GHSA-82fw-gwwq-j7x9 (CVSS 5.9 Moderate path traversal/file read) in `vitest@4.1.5` and its `@vitest/mocker@4.1.5`, fixed in 4.1.11+. The Critical shipped finding blocks deployment and therefore blocks the requested Spool run until this prerequisite ships.

## User-facing impact
No intentional UI or workflow change: every existing map must retain its appearance, interactions, overlays, popups, sprites, and lazy-loading posture. The migration is still user-facing risk because MapLibre v6 is ESM/WebGL2-only, changes worker loading and `styleimagemissing`, and defaults `zoomLevelsToOverscale` to 4, which can alter rendering and `queryRenderedFeatures`; `react-map-gl@8.1.1` is not v6-compatible because it reads the removed `map.transform`. Validate the supported web, macOS/iOS WebKit, and Windows WebView2 paths rather than treating a green unit suite as browser proof.

## Design pass
Not needed — no visual change.

## Decisions touched
- **Vector basemap: Leaflet → MapLibre GL + OpenFreeMap (v0.5.9):** extended to the secure major; architecture is unchanged.
- **Map fixes / sprite registration (v0.5.30):** partially superseded only at the recovery API; unconditional registration and owned-ID restriction remain.
- **Initial-load optimization (v0.5.42):** preserve MapLibre and its new worker off the entry chunk.
- **Map context-menu suppression (v0.5.80) and app-owned popup close buttons (v1.0.19):** implementation-sensitive behavior must be revalidated, not redesigned.
- **Dev Dependency Cleanup (2026-06-29):** governs the Vitest-only portion, but its no-version-bump carve-out does not apply to the production MapLibre upgrade.
- ROADMAP's existing map-popup residuals remain out of scope; do not fold them into this security prerequisite.

## What done looks like
`frontend/package.json`/lock resolve MapLibre 6.8.x, a v6-capable React wrapper, and Vitest/@vitest 4.1.11+; both networked `npm audit --omit=dev` and full `npm audit` report zero vulnerabilities. Lint, typecheck, the serialized full Vitest suite, production build, entry-chunk and CSS-cascade guards pass; focused tests pin worker emission/setup and owned sprite resolution. Real Chromium and WebKit smoke checks show vector tiles load and Map Explorer plus shared map surfaces retain camera/zoom, hit-testing, markers, textures, popups, context-menu/long-press gestures, and no console/worker errors; native target compatibility is confirmed before release.

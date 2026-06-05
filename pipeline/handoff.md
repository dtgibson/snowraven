# Handoff — vector-basemap-maplibre — SHIPPED (v0.5.9)

## Status
**COMPLETE.** Shipped as patch **v0.5.9** — GitHub release published with a
notarized macOS universal DMG, a signed Windows installer, and `latest.json`
(all three updater targets). All 9 Weft stages done. `session-state.json` has
`activeFeature: null`, so the next `/weft` starts a fresh session.

Release: https://github.com/dtgibson/snowraven/releases/tag/v0.5.9

## What shipped
- All three maps (Map Explorer, Species Detail, Statistics) migrated from Leaflet
  + raster tiles to **MapLibre GL + OpenFreeMap vector tiles** via a shared
  `<SnowMap>` wrapper; styles/providers in `lib/mapStyle.ts`.
- Atlas overlay at full parity: GeoJSON grid + breeding-tier shading, block click
  popup (eBird atlas link), hatch textures (`lib/atlasTextures.ts`), and
  shading-priority dimming of the heatmap/pins.
- Heat model centralized in `lib/heat.ts` (native MapLibre heatmap, shared 1–10
  slider). Leaflet removed entirely (deps + old components/CSS).
- Tests: `lib/heat.test.ts` + `lib/mapStyle.test.ts` (299 frontend / 90 backend).
- Two fixes batched into the same release: Breeding Codes species-name left-align;
  Life List Total media count now links to all media.
- Docs: PRIVACY_POLICY (OpenFreeMap), HELP, CLAUDE.md (MapLibre conventions +
  bump-both-version-files rule), DECISIONS.md.

## Follow-ups (not blocking)
- **Offline:** maps are online-only; if the OpenFreeMap *style* fetch fails,
  `SnowMap` sits on "Loading map…". Offline vector tiles were always a future
  goal — a graceful "map unavailable" state would be a nice robustness add.
- **Atlas textures** were restored before release for parity; if revisited, the
  legend preview (`TierHatchSwatch`) and the map sprites (`lib/atlasTextures.ts`)
  are two representations of the same hatch design — keep them visually in sync.
- Verify the Windows installer + in-app updater end-to-end on a Windows machine
  (Dave) — carried from prior releases.

## Key learnings (recorded in DECISIONS.md / CLAUDE.md)
- Import react-map-gl's `Map` as `MapGL` (it shadows the JS `Map` constructor).
- Single persistent style + `visibility` toggling, never `setStyle`-swap.
- Bump BOTH `frontend/package.json` AND `src-tauri/tauri.conf.json` on a release;
  the tag must point at a commit where both are bumped (CI builds Windows from
  `tauri.conf.json`).
- MapLibre paint can't read CSS vars — hardcode colors or read them at sprite
  generation time.

---
Project: snowraven. Feature: vector-basemap-maplibre. All stages complete; v0.5.9 live.

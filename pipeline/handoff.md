# Handoff — vector-basemap-maplibre (New Feature lane) — PAUSED mid-Engineer

## Status
Stage 5 (The Engineer), **paused** mid-build. Work is in the working tree,
**uncommitted** (per our flow — commit happens at the Deployer stage). The app
runs end-to-end right now: Statistics map is on MapLibre; Map Explorer +
Species Detail still run on the old Leaflet path (both libraries installed).

## Engineer build checkpoints
- ✅ **1 — Base map.** MapLibre + react-map-gl installed. `lib/mapStyle.ts`
  (tuned OpenFreeMap **Positron** vector style) + `components/SnowMap.tsx`
  (wrapper: one persistent style, zoom control, auto-resize). Base dialed in
  with Dave: native label size; brand-clover land tints (distinct, light
  forest/park/meadow greens — values in mapStyle.ts TINT_*); country borders
  darkened; **state borders** thin/dashed from ~z4; developed = warm-neutral.
- ✅ **2 — Base switcher.** Map / Satellite (Esri) / Topo-US (USGS) + **Trails**
  (Waymarked) overlay, persisted via storage seam (keys map-base-layer /
  map-trails-overlay). Implemented as ONE persistent style with raster bases +
  trails as visibility-toggled layers (NOT style-swapping — that broke on the
  satellite round-trip and lost pan/zoom). Satellite/Topo sit under labels.
- ✅ **Statistics map migrated** to `<SnowMap>` (vector base, numbered markers
  via react-map-gl `<Marker>`, click `<Popup>` via `geoPopup` state,
  `fitToPins` onLoad). It currently has the switcher enabled (temporary — decide
  whether Statistics keeps it or goes base-only).

## What remains (resume here — checkpoint 3)
**Checkpoint 3 is atomic: it pulls in 4 (heat) and 5 (atlas) too**, because the
Map Explorer map is a single `MapContainer` whose Leaflet children can't coexist
with MapLibre. Migrate the whole Map Explorer map at once:
- Container → `<SnowMap switcher>`; drop `AutoSizeMap`; `MapPanner` +
  `DefaultCenterSetter` → a react-map-gl `useMap` effect (flyTo / initial view).
- `DetectedLocationPin` → `<Marker>` (blue dot).
- Pins: `SightingMarkers` (CircleMarker), `HotspotMarkers`
  (VISITED/UNVISITED/PERSONAL divIcons), `TargetMarkers` (divIcon groups) →
  react-map-gl `<Marker>`s. **Rearchitect popups** to ONE state-driven
  `<Popup>` (Leaflet binds popups to markers; MapLibre needs a selected-feature
  state). Target popups keep `<BirdName>`.
- Heatmap: `leaflet.heat` `HeatmapLayer` → MapLibre native `heatmap` layer
  (slider → heatmap-radius/intensity/weight; re-tune to match v0.5.1 feel).
- Atlas: `AtlasBlockLayer` (+ `AtlasTierPatterns`) → GeoJSON `fill`/`line`
  layers; flat shade via data-driven `fill-color` by tier; **Use Textures** via
  `fill-pattern` sprite images (build `lib/atlasTextures.ts`, register with
  `map.addImage`). Atlas data/join (`atlasBlocks.ts`, `atlasBreeding.ts`)
  unchanged. Interior-click popup.
Then: **Species Detail map** → SnowMap (base only; its heatmap → MapLibre
heatmap). Remove Leaflet deps (`leaflet`, `react-leaflet`, `leaflet.heat`,
`@types/leaflet`) + old `MapBaseLayers.tsx`/`AtlasBlockLayer.tsx`/
`AtlasTierPatterns.tsx` (Leaflet) + `lib/basemaps.ts`. Update
`PRIVACY_POLICY.md` (add OpenFreeMap), HELP/README. Then Tester→Auditor→
Deployer (patch release)→Chronicler.

## Key learnings / gotchas (carry forward)
- **Import collision:** react-map-gl's `Map` shadows JS `Map` → import as
  `MapGL`. (Caused a blank-screen crash earlier.)
- **Single persistent style + visibility**, never `setStyle`-swap for base
  changes (keeps sources alive, preserves pan/zoom).
- **No water-mask for trails** — it covered bridges; Dave prefers trails-over-
  water to missing bridges. Reverted.
- Dave is on **Orion browser** → Claude-in-Chrome console reading doesn't
  connect; debug by reasoning + build/typecheck + his live verification.
- maplibre-gl is a ~273KB-gz chunk (chunk-size warning is informational).

## Resume
Run `/weft` → resumes Stage 5 at checkpoint 3 (Map Explorer map rewrite).
Start dev servers, build incrementally, verify live with Dave each sub-step.

---
Project: snowraven. Feature: vector-basemap-maplibre. Stage 5 (Engineer) PAUSED at checkpoint 3 of 6. Released version still 0.5.8 (nothing shipped).

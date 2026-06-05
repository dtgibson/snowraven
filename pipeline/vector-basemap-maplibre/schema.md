# Architecture / Technical Design — Vector Basemap (MapLibre)

**Lane:** New Feature · **Date:** 2026-06-04 · Builds on prd.md

## Dependencies
- Add: `maplibre-gl`, `react-map-gl` (use its `maplibre-gl` entry), `maplibre-gl/dist/maplibre-gl.css`.
- Remove: `leaflet`, `react-leaflet`, `leaflet.heat`, `@types/leaflet`.

## File plan
**New**
- `frontend/src/lib/mapStyle.ts` — base styles + raster source defs + label-size
  tuning; one source of truth (replaces `lib/basemaps.ts`, which is removed).
- `frontend/src/lib/atlasTextures.ts` — generates per-tier pattern images
  (canvas) registered via `map.addImage()` for `fill-pattern`.
- `frontend/src/components/SnowMap.tsx` — thin shared wrapper around react-map-gl
  `<Map>`: applies style, ResizeObserver→`map.resize()`, exposes children.

**Rewritten**
- `MapBaseLayers.tsx` → MapLibre sources/layers + the brand switcher control
  (same UI, persisted via storage seam).
- `AtlasBlockLayer.tsx` → GeoJSON `<Source>` + `fill`/`line` `<Layer>`s; click
  handler via map `queryRenderedFeatures`.
- `AtlasTierPatterns.tsx` → removed (replaced by `atlasTextures.ts` sprite images).
- `MapExplorer.tsx`, `SpeciesDetail.tsx`, `BirdingStats.tsx` → react-map-gl.
- `lib/heat.ts` → intensity→paint-property mapping (no more leaflet.heat).

**Unchanged (library-agnostic — do NOT touch):**
- `lib/atlasBlocks.ts`, `lib/atlasBreeding.ts` (geometry + breeding join),
  `lib/location.ts`, `lib/storage.ts`, `BirdName.tsx`, `SpeciesLinks.tsx`.

## mapStyle.ts (shape)
```ts
type BaseKey = 'positron' | 'satellite' | 'topo'
// Vector base: OpenFreeMap positron style URL (or inlined style JSON we can
// tweak for label size/tint). Raster bases: style objects with a single raster
// source+layer. Returns a complete MapLibre StyleSpecification per base.
export function baseStyle(key: BaseKey): StyleSpecification
export const TRAILS_SOURCE / TRAILS_LAYER            // raster overlay, toggled
export const VOID_COLOR: Record<BaseKey, string>     // background layer paint
export const LABEL_TEXT_SIZE                          // tuned live (the headline)
```
- Switching base = `map.setStyle(baseStyle(key))` then re-add app
  sources/layers (atlas, heat, pins) on `style.load`; OR keep one style and
  toggle base-layer visibility. **Chosen:** single style containing all bases as
  layers; toggle `visibility` (avoids re-adding app layers on every switch).
- Label size/tint: post-process the OpenFreeMap style's symbol layers (bump
  `text-size`, set font) when building the style — central, tunable.

## Heatmap (MapLibre native)
- `geojson` source of sighting points (weight = obs count).
- `heatmap` layer; map the 1–10 slider to:
  `heatmap-radius` (≈ current px curve), `heatmap-intensity`, and
  `heatmap-weight` (from per-point count, like the old divisor). Re-tune live to
  match the v0.5.1 feel. Replace `lib/heat.ts` formulas with paint expressions.

## Atlas blocks + shade-by-breeding
- One `geojson` source from `generateBlocks`/`blocksInBounds` (unchanged).
- `line` layer = the grid (always, when atlas on).
- `fill` layer with data-driven `fill-color` keyed by each feature's `tier`
  property (set during the breeding join) for **flat shade**.
- **Textures:** `atlasTextures.ts` draws 4 small pattern canvases (dots →
  cross-hatch) at the tier colors, `map.addImage('atlas-tier-N', img)`; a second
  `fill` layer uses `fill-pattern: ['get','patternId']` when **Use Textures** on.
- Interior click: `map.on('click', fillLayerId, e => …)` → `<Popup>` with the
  block name/code/count (escaped; `BirdName` not needed here).

## Pins / markers / popups
- **Hotspots + sightings (potentially many):** `geojson` source + `circle`
  layers (color by kind/recency via data-driven paint) — performant; a single
  `<Popup>` opened from a click handler (`queryRenderedFeatures`).
- **Target pins:** symbol/markers grouped by location; popup is a react-map-gl
  `<Popup>` containing the existing JSX (incl. `<BirdName>`).
- **Detected-location pin / recenter:** a `<Marker>` + `map.flyTo`.
- Legend, nearest lists, filters: unchanged React (just feed the same data).

## Resize / fullscreen
- `SnowMap` runs a `ResizeObserver` on its container → `map.resize()` (replaces
  `AutoSizeMap`). Mobile fullscreen stays the App-level CSS overlay; toggling it
  triggers a resize via the observer.

## Testing
- Unit: `mapStyle.ts` (correct sources/layers per base; label-size applied;
  trails toggle), `atlasTextures.ts` (returns 4 distinct images), heat
  intensity→paint mapping. (jsdom not needed — these are pure functions; canvas
  in `atlasTextures` may need a guard/misc test or a node-canvas shim — keep
  that test light or skip rendering, assert config.)
- Regression: full suite green. Live verification per layer (the build order).

## Build order (incremental, verify live each step)
1. SnowMap + mapStyle base (vector) on Map Explorer — get labels right with Dave.
2. Base switcher + Satellite/Topo/Trails + persistence + void backdrop.
3. Pins/popups (hotspots, sightings, targets) + nearest lists + location/fullscreen.
4. Heatmap + intensity slider (re-tune).
5. Atlas blocks (grid + flat shade) → then textures (sprite patterns).
6. Apply to Species Detail + Statistics maps. Remove Leaflet deps. Docs + privacy.

## Risks / mitigations
- **Sprite patterns** (novel): prototype early (step 5); fall back to flat-shade-
  only if textures prove impractical (flag to Dave).
- **Heatmap feel** differs from leaflet.heat: budget live tuning.
- **Style re-add timing:** use single-style + visibility toggle to avoid
  re-adding app layers on base switch.
- **Bundle/WebGL:** acceptable; lazy-load map components if needed.

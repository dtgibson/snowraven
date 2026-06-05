# Strategic Brief — Vector Basemap (MapLibre + OpenFreeMap)

**Lane:** New Feature · **Date:** 2026-06-04

## The idea
Replace the Leaflet + raster-tile map stack with **MapLibre GL JS** rendering
a **vector** base map from **OpenFreeMap** (keyless). This unlocks the things
raster can't:
- **Custom label sizing** — set bird-map labels to exactly the size Dave wanted
  (raster only gave "too small" native or "too big" 2×; there's no in-between).
- **Brand tinting** — recolor land/water/parks and switch label fonts toward the
  SnowRaven palette (`#2D8653`, Inter).
- **Offline / zero-dependency path** — pairs with self-hosted Protomaps
  `.pmtiles` later (single static file, no external dependency).

Satellite, Topo (US), and the Trails overlay are **retained** — they're raster
layers, which MapLibre renders natively (even over a vector base).

## Why now
We just shipped the keyless raster basemap (v0.5.7) and hit its one hard limit
live: raster label size is binary, so we couldn't give Dave the "in-between"
size he wanted. Vector is the only way to fix that, and it also makes the map
genuinely on-brand. Dave has explicitly chosen to invest in it.

## Scope — what changes

**Replace (Leaflet → MapLibre):** the entire map rendering layer across all
three map tabs and their shared pieces:
- `MapExplorer.tsx`, `SpeciesDetail.tsx`, `BirdingStats.tsx` (map sections)
- `MapBaseLayers.tsx` (base/overlay switcher → MapLibre sources/layers)
- `AtlasBlockLayer.tsx` + `AtlasTierPatterns.tsx` (atlas grid + shade textures)
- `lib/heat.ts` + heatmap usage (→ MapLibre's native heatmap layer)
- Remove deps: `leaflet`, `react-leaflet`, `leaflet.heat`, `@types/leaflet`;
  add `maplibre-gl` (+ a React binding, Architect's choice).

**Retained capabilities (re-implemented on MapLibre, not lost):**
- All 4 tile layers: vector base (OpenFreeMap) + Satellite (Esri) + Topo (USGS)
  + Trails (Waymarked); the brand-styled switcher; persisted choice.
- My Sightings heatmap + intensity slider (→ MapLibre `heatmap` layer).
- Atlas blocks overlay + shade-by-breeding (→ GeoJSON fill/line; textures via
  MapLibre sprite/pattern images instead of SVG `<defs>`).
- All pins/markers/popups (visited/unvisited/personal, target popups, sighting
  pins), "Use my location", recenter, mobile fullscreen, the ocean backdrop.

## What's genuinely at risk (the real cost)
This is a **full map-layer rewrite**, not a tile swap. The hardest re-implements:
1. **Shade-by-breeding textures** — SVG pattern fills don't exist in MapLibre;
   must become sprite/pattern raster images per tier. Most novel piece.
2. **Heatmap** — `leaflet.heat` → MapLibre's native `heatmap` layer; the v0.5.1
   intensity model maps onto different paint properties (likely an upgrade, but
   needs re-tuning).
3. **Atlas block interactivity** — interior-clickable polygons + popups in
   MapLibre's event model.
4. **Marker/popup parity** across all three tabs; clustering of overlapping
   labels; the `AutoSizeMap`/`invalidateSize` equivalent.
5. **Bundle size** — maplibre-gl is heavier (~200KB+ gz) than Leaflet; WebGL
   required (fine in WKWebView/WebView2/modern browsers).

## Key decisions (RESOLVED at Stage 1 gate)
- **D1 → All three maps in one feature** (Map Explorer + Species Detail +
  Statistics). No Leaflet/MapLibre coexistence; one consistent look.
- **D2 → Clean first, fix labels.** Start from OpenFreeMap's Positron-like
  quiet style (the look Dave preferred); priority is dialing label size +
  crispness to the "in-between" he wanted, with only a light/tasteful tint.
  Tune live (like the heatmap/textures iterations).
- **D3 → OpenFreeMap public instance now**; self-hosting / Protomaps `.pmtiles`
  is the documented future fallback + offline endgame. Add OpenFreeMap to
  `PRIVACY_POLICY.md`.

---

### D1 — Migrate all three maps at once, or Map Explorer first?
- **(Recommended) All three in one feature.** The cost is the shared layers
  (heatmap, atlas, switcher, markers) — doing it once avoids running Leaflet and
  MapLibre side by side and keeps the look consistent. Bigger single feature.
- (Alt) **Map Explorer first**, Species Detail + Statistics in a follow-up.
  Smaller first step, but two map stacks coexist for a while and the shared
  pieces get touched twice.

### D2 — How much brand tinting?
- **(Recommended) Clean first, brand-tuned labels.** Start from OpenFreeMap's
  Positron-like style (keep the quiet look Dave preferred) and primarily fix the
  label size + crispness; light, tasteful tint only. Tune live.
- (Alt) **Full brand restyle** — actively recolor parks/water/roads to the green
  palette and Inter labels. More distinctive, more design iteration, easier to
  overdo under data pins.

### D3 — Tile source (recommendation, not blocking)
Use the **OpenFreeMap public instance** now (keyless, no limits, MIT). Note it's
a single volunteer-run service; **self-hosting OpenFreeMap or Protomaps
`.pmtiles`** is the future fallback / offline endgame. `PRIVACY_POLICY.md` adds
OpenFreeMap as a tile provider.

## Non-goals
- No backend changes. No change to which data the maps show.
- Not self-hosting tiles in this feature (public instance now; self-host later).
- Not redesigning map UX beyond the basemap/labels/tint.

## Definition of done
All three maps render on MapLibre with an OpenFreeMap vector base at a label
size Dave's happy with; Satellite/Topo/Trails switcher, heatmap+slider, atlas
blocks + shade-by-breeding textures, all pins/popups, location, fullscreen, and
persistence all work as before; Leaflet deps removed; suite green; privacy
policy updated.

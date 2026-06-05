# PRD — Vector Basemap (MapLibre + OpenFreeMap)

**Lane:** New Feature · **Date:** 2026-06-04 · Builds on strategic-brief.md

## 1. Library & architecture
- **`maplibre-gl`** for rendering. **React binding: `react-map-gl`** (its
  `maplibre` entry) for declarative `<Map>`, `<Source>`, `<Layer>`, `<Marker>`,
  `<Popup>` — closest 1:1 to the react-leaflet model we're replacing, lowest
  rewrite friction. (Architect confirms vs. raw maplibre-gl + a thin wrapper.)
- Remove `leaflet`, `react-leaflet`, `leaflet.heat`, `@types/leaflet`.
- A shared `frontend/src/lib/mapStyle.ts` builds the MapLibre **style JSON**
  (OpenFreeMap vector base + the raster sources), so all three maps share one
  source of truth (like `lib/basemaps.ts` did).

## 2. Base style & labels (D2: clean first)
- Base: **OpenFreeMap** vector tiles, starting from its **Positron-like** style
  (`https://tiles.openfreemap.org/styles/positron` or self-described style JSON).
- **Label size** is the headline goal: expose a tuned text-size (and font →
  Inter where available) so labels land at the "in-between" Dave wanted. Tune
  live. Light/tasteful tint only; keep the quiet look.
- Keep an **ocean/void backdrop** equivalent (MapLibre `background` layer or
  map container bg) per active base.

## 3. Layer migration plan (parity)
| Capability | Today (Leaflet) | MapLibre approach |
|---|---|---|
| Base map | CARTO Positron raster | OpenFreeMap vector style |
| Satellite | Esri raster TileLayer | `raster` source + layer (swap style/source) |
| Topo (US) | USGS raster TileLayer | `raster` source + layer |
| Trails overlay | Waymarked raster TileLayer | `raster` layer on top, toggle visibility |
| Switcher | `MapBaseLayers` + LayersControl | rebuilt control; same UI; persists via storage seam |
| Heatmap + intensity | `leaflet.heat` | MapLibre native `heatmap` layer; intensity → paint props (radius/intensity/weight); re-tune to match v0.5.1 feel |
| Sighting/hotspot/personal pins | CircleMarker/Marker + divIcon | `<Marker>` (DOM) or circle/symbol layers; keep colors/legend |
| Target pins + popups | divIcon labels + React Popup | symbol layer or markers + `<Popup>`; BirdName inside popups preserved |
| Atlas blocks grid | GeoJSON polygons (Leaflet) | `fill` + `line` layers from the generated GeoJSON; interior click via `queryRenderedFeatures` |
| Atlas shade-by-breeding | per-tier SVG `<defs>` patterns + flat fills | flat fills via data-driven `fill-color`; **textures via `fill-pattern` sprite images** (one per tier) |
| Atlas popup | bindPopup HTML string | `<Popup>` (escaped) on click |
| Use my location / recenter | setView/panTo | `flyTo`/`easeTo`; existing geolocation seam unchanged |
| Mobile fullscreen | CSS overlay (unchanged) | unchanged (App-level), call `map.resize()` on toggle |
| Auto-resize | `AutoSizeMap` invalidateSize | `ResizeObserver` → `map.resize()` |

## 4. Acceptance criteria
- **AC-1 Parity:** all three map tabs render on MapLibre with the OpenFreeMap
  vector base; no Leaflet/`react-leaflet`/`leaflet.heat` remains in the bundle.
- **AC-2 Switcher:** Map / Satellite / Topo (US) bases + Trails overlay all work
  and the choice persists (storage seam), on Map Explorer + Species Detail;
  Statistics base-only.
- **AC-3 Labels:** base-map labels at the size Dave approves (the headline goal);
  crisp on retina.
- **AC-4 Heatmap:** My Sightings heatmap + 1–10 intensity slider behave
  comparably to v0.5.1 (coverage/intensity); Species Detail heatmap matches.
- **AC-5 Atlas:** blocks draw for the viewport, interiors clickable → popup;
  shade-by-breeding tints by tier; **Use Textures** shows a distinct per-tier
  pattern; all three sidebars expose the controls.
- **AC-6 Pins/popups:** visited/unvisited/personal hotspot pins, target pins +
  popups (with `<BirdName>`), sighting pins, recency colors, nearest lists — all
  intact; clicking a popup bird name still opens Species Detail.
- **AC-7 Location/fullscreen:** Use my location, recenter, and mobile fullscreen
  work; map resizes correctly on fullscreen toggle and container changes.
- **AC-8 Quality:** tsc/eslint/build clean; existing suite green; new unit tests
  for `mapStyle.ts` (style/source construction) where logic is non-trivial.
- **AC-9 Privacy:** `PRIVACY_POLICY.md` lists OpenFreeMap as a tile provider.

## 5. Non-functional
- Bundle: maplibre-gl is larger (~200KB+ gz) — acceptable; lazy-load the map
  components if needed (they already gate behind tab visibility).
- WebGL required (OK in WKWebView/WebView2/modern browsers).
- Tokens for any app-chrome colors; map style colors live in `mapStyle.ts`.
- A11y: keep keyboard focus on controls; markers/popups labelled.

## 6. Risks (carried from brief)
Shade-by-breeding sprite patterns (most novel), heatmap re-tune, atlas
interactivity/popups, marker parity & overlapping-label handling, bundle/WebGL.
Mitigation: build incrementally per layer, verify live, keep the generated
atlas GeoJSON + breeding-join logic (those are map-library-agnostic) unchanged.

## 7. Out of scope
Backend; self-hosting tiles (public instance now); changing displayed data;
non-map UX.

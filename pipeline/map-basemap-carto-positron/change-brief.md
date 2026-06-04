# Change Brief — Keyless Basemap Upgrade + Layer Switcher

**Lane:** Improve
**Date:** 2026-06-03

## Goal
Replace the fragile default OSM tiles (`tile.openstreetmap.org`, against
OSMF policy for self-hosted apps) with **CARTO Positron** across all maps,
and add a **layer switcher** with satellite, US topo, and a trails overlay.
All keyless — no accounts, no API keys, no billing — consistent with the
app's free/local-first/privacy stance.

## Layers (all keyless)

**Base layers (mutually exclusive):**
1. **Map — CARTO Positron** *(default)*
   `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png`
   subdomains `abcd`, maxZoom ~20.
   Attr: `© OpenStreetMap contributors © CARTO`.
2. **Satellite — Esri World Imagery**
   `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}`
   (note `{z}/{y}/{x}` order, no subdomain), maxZoom ~19.
   Attr: `Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community`.
3. **Topo (US) — USGS National Map**
   `https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}`
   (`{z}/{y}/{x}`), maxZoom ~16. US coverage only (blank elsewhere — label it "(US)").
   Attr: `© USGS The National Map`.

**Overlay (additive toggle):**
4. **Trails — Waymarked Trails (Hiking)**
   `https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png`, transparent, maxZoom ~18.
   Attr: `Trails © Waymarked Trails (CC-BY-SA)`.

## Approach
- **Shared module** `frontend/src/lib/basemaps.ts` (layer configs: name, url,
  attribution, options) + a small `<MapBaseLayers switcher?>` component, so
  tile definitions live in ONE place (DRY; like `lib/heat.ts`).
  - `switcher={false}` → renders just the Positron `<TileLayer>`.
  - `switcher={true}` → renders react-leaflet `<LayersControl position="topright">`
    with the three base layers + the trails overlay (collapsed by default,
    so it's a small layers icon — good on mobile).
- **Where:**
  - **MapExplorer** + **Species Detail** map → full switcher (observation maps
    benefit from satellite/topo/trails).
  - **Statistics** geographic map → Positron base only (overview map; no switcher
    to avoid clutter). *(open to including it — flag at gate)*
- **Backdrop retune:** the `--sr-map-void` token (currently `#AAD3DF`, tuned to
  OSM's blue water) must change to a **light neutral** matching Positron's
  near-white background, or the empty area reads as a blue band again. (If it
  looks off under the dark satellite layer, make it base-layer-aware later —
  keep it simple first, tune live.)
- **Attribution:** per-layer `attribution` so the control shows the right credit
  for the active layer. Remove the hard-coded OSM attribution.
- **Coordinate schemes:** CARTO + Waymarked use `{z}/{x}/{y}`; Esri + USGS use
  `{z}/{y}/{x}` — must be exact or tiles misalign.
- **maxZoom / maxNativeZoom** per layer so high zoom doesn't show grey.

## Privacy
Map tiles are inherently fetched from third-party servers (the app already does
this with OSM). This swaps/adds tile providers (CARTO, Esri, USGS, Waymarked).
**Review `PRIVACY_POLICY.md`** — if it enumerates the third parties that receive
requests, add these tile hosts (they see the user's IP + map viewport, nothing
more; no SnowRaven server involved). No new data *collection* by SnowRaven.

## Acceptance
- No map loads `tile.openstreetmap.org` anymore; Positron is the default base
  on all maps.
- MapExplorer + Species Detail show a working layer switcher: Map / Satellite /
  Topo (US) bases + a Trails overlay toggle; correct attribution per layer.
- Tiles align correctly (coordinate order right) and fill at all zooms; the
  void backdrop matches Positron.
- Heatmap, atlas blocks, pins, popups, fullscreen all still work unchanged.
- Light/dark themes OK; keyboard-accessible control; mobile (collapsed control).
- PRIVACY_POLICY.md updated if it lists third parties.

## Decisions (locked at Stage 1 gate)
- **Statistics map:** Positron-only (no switcher) — overview map; satellite/
  trails would hurt the numbered-marker legibility.
- **Persistence:** YES — persist the selected base layer + trails-overlay state
  globally via the `storage` seam (`getSetting`/`setSetting`), so the choice
  sticks across sessions (per the CLAUDE.md persist-UI-settings convention).
  Falls back to Positron when unset.
- **Switcher look:** brand-aligned, NOT Leaflet's stock control — styled with
  `--sr-*` tokens, theme-aware, compact/collapsed on mobile. Exact form
  (restyled `LayersControl` vs. a small custom React control) chosen in build
  for the cleanest result; tuned live with Dave.
- **Lane:** stays Improve (scope is well-defined; no PRD needed), but held to a
  high polish bar with a live design-iteration loop.

## Out of scope (candidate follow-ups)
- Vector basemap (MapLibre + OpenFreeMap) — a separate, larger rewrite.
- Non-hiking Waymarked variants (cycling, etc.).

## Honest flags
- "Keyless" ≠ "contractually unlimited": CARTO and Esri are keyless in practice
  but nominally prefer an account at high volume. Acceptable per the no-key rule;
  self-hosting is the only way to remove that caveat entirely (future bet).
- USGS Topo is US-only by design.

## Feature Check
A map-tiles/UX improvement to existing maps — no new product capability beyond
a basemap choice that re-skins existing content. **Stays in the Improve lane.**

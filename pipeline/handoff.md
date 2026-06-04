# Handoff — map-basemap-carto-positron (Improve lane)

## What We Accomplished
Shipped **v0.5.7** — keyless basemap upgrade + layer switcher:
- CARTO Positron is the default base on all maps (off the OSMF-policy-fragile
  `tile.openstreetmap.org`).
- Brand-styled, persisted layer switcher on Map Explorer + Species Detail:
  Map / Satellite (Esri) / Topo-US (USGS) bases + a Waymarked Trails overlay.
- Statistics map: Positron only. Backdrop tone follows the active base.
- All keyless. Privacy policy updated to disclose tile providers.

## Where We Are
**Improvement complete — all 6 stages done.** v0.5.7 live on all platforms
(universal Mac + Windows); updater carries it.

## Release facts
- Version `0.5.7` (patch). Tag `v0.5.7`; release: https://github.com/dtgibson/snowraven/releases/tag/v0.5.7
- Assets verified: latest.json, macOS updater bundle + .sig, universal.dmg, x64-setup.exe + .sig.
- `latest.json` 0.5.7 with darwin-aarch64, darwin-x86_64, windows-x86_64.

## Live-iteration log (with Dave)
Positron native ("touch small") → 2× ("too big") → CARTO Voyager (medium, more color)
→ reverted to Positron native (Dave preferred the minimal look). Finding: raster label
size is binary; fractional needs vector (deferred).

## Chronicle updates made
- ROADMAP.md → Shipped v0.5.7 (47 versions).
- PRODUCT_CONTEXT.md → new "Keyless Basemap Upgrade + Layer Switcher" entry.
- DECISIONS.md → keyless-raster-basemaps decision + raster-label-size finding.
- CLAUDE.md → convention: tile providers in lib/basemaps.ts via <MapBaseLayers>; never hard-code TileLayer / reintroduce OSM default; tile-provider changes must update PRIVACY_POLICY.md.
- CHANGELOG, PRIVACY_POLICY, HELP, README updated in the feature commit.

## Outstanding / future
- Carried: verify Windows install + in-app updater end-to-end on a Windows machine.
- Deferred bet: vector basemap (MapLibre + OpenFreeMap) for brand-tinted, custom-label-size maps / offline.

## Resume Prompt
No active feature. Run `/weft` to start the next lane.

---
Project: snowraven. Feature: map-basemap-carto-positron — COMPLETE (v0.5.7 shipped). No active session.

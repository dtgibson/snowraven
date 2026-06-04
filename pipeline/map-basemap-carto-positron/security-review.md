# Security Review — Keyless Basemap Upgrade + Layer Switcher

**Date:** 2026-06-03
**Lane:** Improve
**Stack:** react-vite-tailwind frontend (no backend changes)
**Outcome:** PASSED (no Critical/High; privacy disclosure handled)

## Summary
Swaps the map base tiles from `tile.openstreetmap.org` to CARTO Positron and
adds a keyless layer switcher (Esri satellite, USGS topo, Waymarked trails).
No new npm/Rust dependencies, no backend, no secrets, no API keys. The only
new external surface is tile requests to additional third-party CDNs.

## Findings

### F-1 — New third-party tile providers receive IP + viewport (Informational, disclosed)
**Where:** `lib/basemaps.ts`, `MapBaseLayers.tsx`
**Description:** As with any web map, the user's browser requests tiles directly
from the provider, exposing IP address + viewed map area. This swaps OSM for
CARTO and adds Esri/USGS/Waymarked. No SnowRaven server is involved, no key,
nothing added or retained by the developer.
**Resolution:** `PRIVACY_POLICY.md` gains a "Map Tiles" section enumerating the
providers (this also closed a pre-existing gap — the old OSM tiles were never
disclosed). Effective date bumped. **Consistent with the privacy stance.**

### F-2 — Tile URLs are static, no user input (verified)
**Description:** All tile URLs are hard-coded constants in `lib/basemaps.ts`;
the only dynamic parts are Leaflet's `{z}/{x}/{y}` substitutions. No user-
controlled value is interpolated into a URL. No injection surface.

## Checks Performed
| Check | Result |
|---|---|
| No secrets / keys in source | Pass — all providers keyless |
| New dependencies | Pass — none (uses existing leaflet/react-leaflet/react-dom) |
| Backend / network surface | Pass — client-side tile fetches only; no SnowRaven server |
| Data collection by SnowRaven | Pass — none added; no tracking, no retention |
| Privacy disclosure | Pass — PRIVACY_POLICY.md updated to list tile providers |
| Injection (tile URLs) | Pass — static constants; no user input |
| Persistence | Pass — base/overlay choice via storage seam (booleans/enum strings); no sensitive data |
| Attribution / license | Pass — per-layer attribution present (OSM/CARTO, Esri, USGS, Waymarked CC-BY-SA) |
| Portal control DOM | Pass — `MapControl` renders trusted React UI; click/scroll propagation disabled; removed on unmount |

## Convention Flags (for The Chronicler)
- New keyless-basemap convention: tile providers defined once in `lib/basemaps.ts`;
  adding/changing a provider must be reflected in PRIVACY_POLICY.md.
- "Keyless ≠ unlimited" (CARTO/Esri) and USGS-US-only are documented limitations.

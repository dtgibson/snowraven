# Strategic Brief — Offline Support

## What We're Building
Make SnowRaven genuinely usable without internet — both as everyday resilience when the network drops, and as a real field tool, including offline maps with true basemap detail in regions the user downloads ahead of time.

## Why Now
Field birding happens where there's no signal, and that's exactly when a birder reaches for their map and their data. The analytical core already runs fully offline, so the remaining gaps are what stand between SnowRaven and being trustworthy in the field: maps that won't mount offline, a blank basemap where nothing was pre-viewed, favicons and sort that break on a cold start, and previously-loaded weather/tide blocks that vanish. The architectural seams to close these — the storage layer, the transport seam, the single map-style path — already exist.

## The User Problem
A birder standing somewhere with no signal opens SnowRaven and the maps show a "couldn't load" placeholder instead of their sightings; even when a map does mount, the basemap is blank anywhere they haven't previously viewed online; bird-name favicons and taxonomic sort fall back on first run; and a weather or tide block they looked at earlier is simply gone. More broadly, the app should never *feel* broken just because the network is down.

## Success Criteria
- On a cold start with no network, the app opens and every analytical tab works — locked in, not incidental.
- The maps mount offline and draw the user's sightings, heatmap, and atlas — no dead-end placeholder.
- A user can download a region ahead of time and then, fully offline, pan and zoom that region with real street, terrain, and label detail.
- Favicons and Taxonomic sort work offline, including the very first run (no cold-cache dependency on eBird) and on web/Pi after a backend restart.
- A weather, tide, or checklist result already viewed re-shows offline instead of re-failing.
- Offline states read honestly — "you're offline" is clearly distinct from "no API key," and nothing presents as broken.

## Scope
- **Tier A foundation:** persist the vector map style so the maps mount on a cold offline start and the local data layers draw.
- **Tier B offline basemap:** an offline vector base the user gets by downloading a region, plus a way to see and manage what's been downloaded. Recommended approach: a self-hosted PMTiles vector base on GitHub Releases, with glyphs and sprites bundled in-app.
- **Persisted taxonomy:** favicons / Taxonomic sort / sub-form resolution work offline including first run — extend the desktop IndexedDB cache, give web/Pi an on-disk equivalent, and consider a bundled snapshot to remove the cold-cache dependency entirely.
- **Replay caches:** previously-loaded weather/tide/checklist results persist so they re-show offline.
- **Honest offline messaging** across weather, tide, search, comparer, and the updater.
- **Privacy-policy update** for the basemap change and any ahead-of-time tile fetching.

## Out of Scope
- Offline **satellite / topo / trails** — provider terms forbid bulk pre-download and raster imagery is far too heavy; these stay online-only and degrade to whatever's already cached, as today.
- Making **fundamentally-live features** work offline: live weather (OpenWeather), live tide readings (NOAA), geocoding (Nominatim), the Checklist Comparer and live nearby-bird eBird overlays, and the in-app updater. These query live remote state; the most offline does for them is replay a prior result and message honestly.
- **Automatic/background tile downloading** — region downloads are always user-initiated.

## Key Decisions
- Field-first, with general offline resilience as the baseline. Both the desktop app and web/self-hosted (Pi) are in scope.
- **Recommended basemap path:** self-hosted PMTiles vector base on GitHub Releases — offline region download is the primary use; online range-streaming is a possible bonus. Recommended, not locked: the Architect may choose a better option if one is clearly superior. **The constraint behind it stands regardless** — bulk offline tiles must come from a source we're licensed to bulk-download (our own), never a third-party provider whose terms forbid it.
- Region granularity (per-state / per-metro / zoom-capped) is an Architect decision, bounded by GitHub's ~2 GB per-asset limit.
- Tier A (style persistence) is a prerequisite for Tier B and ships regardless of the basemap mechanism chosen.

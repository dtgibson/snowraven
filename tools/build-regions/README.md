# Offline region-tiles build pipeline (release-time)

This directory holds the **release-time** tooling that bakes the per-region
`.pmtiles` vector basemaps for SnowRaven's offline maps (offline-support feature,
Slice 2e). It is **NOT** part of `npm run build` or `release.sh` — it runs by hand,
infrequently (when a new taxonomy/imagery season warrants a fresh bake), and the only
artifact it commits into the app repo is the catalog
(`frontend/src/assets/regions-catalog.json`). The large `.pmtiles` archives are
uploaded to a **dedicated GitHub Releases tag**, not committed and not shipped in the
app bundle.

> Nothing in here runs in CI. The actual bake needs the multi-hundred-GB planet
> source and the `go-pmtiles` CLI, neither of which lives in this repo — see
> "Prerequisites". `gen-catalog.mjs` (catalog emitter) is the only script that runs
> without the planet source, and even it is a release-time step.

## What gets produced

1. **Per-region archives** `<regionId>.pmtiles` — PMTiles v3, openmaptiles schema,
   **clustered** (required — `pmtiles extract` fails on an unclustered source;
   re-cluster with `pmtiles cluster` if needed), max zoom **z14**.
2. **`frontend/src/assets/regions-catalog.json`** — the bundled, no-runtime-fetch
   discovery manifest the in-app region manager reads (committed with each app
   release; imported like the other bundled data assets, e.g. the taxonomy snapshot).

## Source data (the hard licensing constraint)

Source = the **Protomaps planet PMTiles** (`build.protomaps.com`, **ODbL**,
openmaptiles schema — its `source-layer` names like `landcover`, `transportation`,
`place` match the Positron base style, native max zoom 15). Licensed for **bulk
download**, which is the binding constraint — do NOT bulk-pull tiles from
`tiles.openfreemap.org` / OSMF tile servers (policy forbids it). A self-run
`planetiler` build is the alternative source if you'd rather generate the planet
yourself.

## Granularity (OQ-02, committed)

- **County primary** — one archive per US county (and Canadian census division).
  County maps onto eBird county lists and the `county` field carried per sighting, so
  the in-app "Counties you bird" surface can match catalog regions to the user's data.
- **Whole-state coarser** — one archive per state/province for users who want a wider
  area in a single download.

Region ids/extents/names are derived from county/state boundary GeoJSON
(US Census TIGER counties + Canadian census divisions). `regionId` MUST match the
loader's shape guard `^[a-z]{2}(-[a-z0-9-]{1,40})?$` (e.g. `us-ca-001` county,
`us-ca` whole-state).

## Max zoom (OQ-04, committed)

**z14.** The dominant size lever. Source native max is z15, so z14 keeps one level of
margin; in-app, MapLibre **over-zooms** the deepest baked z14 tiles above z14 rather
than blanking (FR-17 over-zoom fallback). Set at extract time with `--maxzoom=14`.

## The extract — POLYGON clip, NEVER raw --bbox

```
pmtiles extract <planet.pmtiles> <regionId>.pmtiles \
  --region=<county-or-state-boundary>.geojson \
  --maxzoom=14
```

- **`--region` (POLYGON clip), NOT `--bbox`.** A naive bounding box around an
  antimeridian-spanning state EXPLODES: full-bbox Alaska = **~20 GB** (over GitHub's
  2 GiB/asset limit); polygon-clipped Alaska land-only = **~660 MB**. Always clip to
  the actual boundary polygon.
- **Antimeridian states (AK, and the Aleutians)** use a **dateline-split
  MultiPolygon** boundary so the clip doesn't wrap the globe.
- `pmtiles extract` is the **`go-pmtiles`** CLI (a build tool) — it is NOT the npm
  `pmtiles` runtime dependency the app uses for in-webview range reads. Do not confuse
  them; `go-pmtiles` is never shipped in the app.

### Measured size ceilings (z14, polygon-clipped)

| Region | Size |
|---|---|
| Densest US metro county (LA County) | **~75 MB** |
| Largest single state (Alaska, land-only) | **~660 MB** |

Both are comfortably under GitHub Releases' **2 GiB / asset** limit (>3x headroom on
the largest state). **Re-measure any new densest target before adding it to the county
defaults**, and validate the antimeridian polygon clip for AK (the bbox = 20 GB trap).

## Hosting (OQ-08)

GitHub **Releases**, on a **dedicated, non-app tag** `regions-<ver>` (e.g.
`regions-2026.06`) — each `<regionId>.pmtiles` is a release asset.

- **NOT GitHub Pages** (≤100 MB/file forbids per-state assets).
- **Separate from the app `vX.Y.Z` releases** so the region bake never entangles
  `release.sh`.
- The Releases CDN is **Range-capable**, which also enables the optional `pmtiles://`
  online range-streaming bonus (OQ-03).
- A region download exposes the user's IP + the county extent to GitHub at download
  time — this host MUST be listed in `PRIVACY_POLICY.md` (the "Map Tiles" section).

## The catalog

`gen-catalog.mjs` emits `frontend/src/assets/regions-catalog.json`:

```json
{
  "currentVersion": "2026.06",
  "baseUrl": "https://github.com/dtgibson/snowraven/releases/download/regions-2026.06/",
  "regions": [
    { "regionId": "us-ca-001", "name": "Alameda County, CA", "kind": "county",
      "stateCode": "US-CA", "countyName": "Alameda",
      "extent": [-122.37, 37.45, -121.46, 37.91],
      "minZoom": 0, "maxZoom": 14, "bytes": 41268221 }
  ]
}
```

- The in-app download URL is built as `baseUrl + encodeURIComponent(regionId) + '.pmtiles'`.
- `currentVersion` / per-region `sourceVersion` drive the FR-19 staleness + supersede
  logic in the region manager.
- This file is **committed with each app release**; the app reads it from the bundle
  (no runtime fetch just to LIST regions — offline-discoverable and privacy-first).

## Release-time pipeline (end to end)

1. Obtain / refresh the Protomaps planet PMTiles (or run planetiler).
2. For each region: build (or fetch) its boundary GeoJSON (dateline-split for AK),
   then `pmtiles extract … --region=… --maxzoom=14`. Re-cluster the source first if
   `pmtiles extract` reports it isn't clustered.
3. `stat` each output for its byte size; collect `{regionId, name, kind, stateCode,
   countyName, extent, minZoom, maxZoom, bytes}` per region into a metadata list.
4. Create the GitHub Release tag `regions-<ver>` and upload every `<regionId>.pmtiles`
   as an asset (`gh release create regions-<ver> *.pmtiles` — a release operation,
   independent of `release.sh`).
5. `node gen-catalog.mjs <metadata.json> --version <ver> --base-url <releases-url>` to
   regenerate `frontend/src/assets/regions-catalog.json`.
6. Commit the regenerated catalog with the app release. Add/confirm the GitHub Releases
   host in `PRIVACY_POLICY.md`.

## Files here

- `README.md` — this document.
- `gen-catalog.mjs` — release-time catalog emitter (STUB; takes a baked-region
  metadata list, emits `regions-catalog.json`). It does NOT run the bake.

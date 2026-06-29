#!/usr/bin/env node
// Builds the bundled US county boundary geometry used by the County Lines &
// Shading overlay (frontend/src/assets/us-counties.json). Mirrors the
// fetch → transform → guard → write shape of build-tide-stations.mjs /
// build-ebird-taxonomy.mjs, and hard-fails on a degraded result.
//
// Source: US Census Cartographic Boundary Files, county level, most-simplified
// resolution (cb_<VINTAGE>_us_county_500k, 1:500,000). PUBLIC DOMAIN (US federal
// work). The cartographic-boundary variant — not raw TIGER/Line — is already
// generalized for small-scale mapping (clipped to shoreline, far smaller) and is
// the right fidelity for the zoom levels this overlay shows.
//   Attribution: "Boundaries: US Census Bureau Cartographic Boundary Files
//   (public domain)" — recorded here and in the data-source notes; no runtime
//   attribution UI is required.
//
// This script is NOT part of `npm run build`; the asset is a committed artifact
// (like the eBird-taxonomy snapshot). Re-run it at release time to refresh the
// Census vintage:
//   node scripts/build-county-boundaries.mjs
//
// Tooling: mapshaper (via `npx --yes mapshaper@<pin>`) does the shapefile→GeoJSON
// read, Visvalingam simplify, field rename, state-filter, and 4-dp coordinate
// rounding. A Node post-pass then cuts dateline-crossing counties into
// one-hemisphere features, attaches a precomputed per-feature bbox, sorts by
// geoid for byte-stable diffs, and runs the hard guards.
//
// The exact mapshaper invocation is documented in MAPSHAPER_ARGS below.

import { writeFile, mkdir, rm, readFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { tmpdir } from 'node:os'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = join(HERE, '..')

// ── Tunables ──────────────────────────────────────────────────────────────────
const VINTAGE = '2023' // pinned for reproducible re-runs
const SOURCE_URL = `https://www2.census.gov/geo/tiger/GENZ${VINTAGE}/shp/cb_${VINTAGE}_us_county_500k.zip`
const MAPSHAPER = 'mapshaper@0.6.102' // pinned via npx; not a project dependency (release-time only)
// Visvalingam keep-shapes simplification %. History: 2.5% (blocky, ~12 verts/county)
// → 10% (v0.5.48/49) → 15% (v0.5.50). v0.5.50 raised it a notch to sharpen the county
// FILL edge so the hair-thin shaded sliver under the crisp basemap-tile county line
// (CountyLayer's z9+ `boundary` line) shrinks below visibility at high zoom when county
// shading is on — the bundled file drives both the fill and the below-z9/offline line
// fallback, so one bump sharpens both (the deferred "option D" in a single move). At
// 15% the asset is ~3.7 MB raw / ~0.95 MB gzipped (~54 verts/county, up from ~39):
// still an on-demand chunk, off first paint, fetched only when the county overlay is
// first enabled, and within the 1.3 MB gz guard with comfortable margin.
const SIMPLIFY_PCT = '15%'
const COORD_DP = 4 // ~11 m — ample at these zooms; a big size win
const BBOX_DP = 4 // bbox carried per feature for O(1) viewport windowing

const OUT = join(REPO, 'frontend/src/assets/us-counties.json')

// ── Guards (hard-fail, mirrors the taxonomy build) ────────────────────────────
const MIN_FEATURES = 3000 // catches a truncated fetch / over-filter (50 states + DC ≈ 3,144)
const RAW_CEILING = 5.5 * 1024 * 1024 // stretch ceiling for the raw asset (raised for the 10% geometry)
const GZ_BUDGET = 1.3 * 1024 * 1024 // hard on-demand-chunk budget (NFR-02, raised to ~1.3 MB for sharp county lines)

// State allow-list: 50 states + DC. STATEFP 01–56 (with the usual gaps) are the
// states + DC; 60/66/69/72/78 are territories (PR/VI/GU/AS/MP) whose TIGER county
// equivalents are inconsistent — out of scope for v1 (FR-26: a territory county in
// the user's data simply renders no boundary/shade). The numeric `<= 56` filter
// captures exactly the states + DC.
const MAPSHAPER_ARGS = (inZip, outJson) => [
  '--yes',
  MAPSHAPER,
  inZip,
  '-filter', '+this.properties.STATEFP <= 56',
  '-simplify', 'visvalingam', 'keep-shapes', `percentage=${SIMPLIFY_PCT}`,
  // Keep only the four fields the app needs (rename from TIGER's UPPERCASE).
  '-each', 'geoid=this.properties.GEOID, name=this.properties.NAME, stusps=this.properties.STUSPS, statefp=this.properties.STATEFP',
  '-filter-fields', 'geoid,name,stusps,statefp',
  '-o', 'format=geojson', `precision=${1 / 10 ** COORD_DP}`, outJson,
]

const r = (v, dp) => Number(v.toFixed(dp))

/** Longitude min/max across a single polygon (array of rings). */
function polyLngRange(rings) {
  let mn = Infinity, mx = -Infinity
  for (const ring of rings) for (const [lng] of ring) { if (lng < mn) mn = lng; if (lng > mx) mx = lng }
  return [mn, mx]
}

/** [minLng,minLat,maxLng,maxLat] across an array of polygons. */
function bboxOfPolys(polys) {
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity
  for (const rings of polys) for (const ring of rings) for (const [lng, lat] of ring) {
    if (lng < a) a = lng; if (lat < b) b = lat; if (lng > c) c = lng; if (lat > d) d = lat
  }
  return [r(a, BBOX_DP), r(b, BBOX_DP), r(c, BBOX_DP), r(d, BBOX_DP)]
}

// The Census CB data stores Aleutian boroughs (which cross ±180°) as a
// MultiPolygon whose island parts are ALREADY split across the seam — each part
// lies wholly in one hemisphere, but the FEATURE's naive bbox spans nearly the
// whole globe (minLng ≈ −180, maxLng ≈ +180) and would falsely intersect every
// viewport at that latitude. We split such a county into one feature per
// hemisphere so each emitted feature has a correct one-sided bbox and draws in
// its right place (no smear). A borough split this way becomes 2 features sharing
// the same geoid/name/stusps — fine: the join keys on (state, name) and the
// keyboard list/popup dedupe by geoid.
function emitFeatures(feature, out) {
  const g = feature.geometry
  if (!g) return
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates
  const [mn, mx] = polyLngRange(polys.flat())
  const straddles = mx > 170 && mn < -170
  const push = (sub) => {
    if (!sub.length) return
    const geometry = sub.length === 1
      ? { type: 'Polygon', coordinates: sub[0] }
      : { type: 'MultiPolygon', coordinates: sub }
    out.push({ type: 'Feature', bbox: bboxOfPolys(sub), properties: feature.properties, geometry })
  }
  if (!straddles) { push(polys); return }
  // Partition island parts by hemisphere; a part wholly negative → east of the
  // seam (the −180 side), wholly positive → west of the seam (the +180 side).
  const west = polys.filter(p => polyLngRange(p)[0] > 0)
  const east = polys.filter(p => polyLngRange(p)[1] < 0)
  const other = polys.filter(p => { const [a, b] = polyLngRange(p); return !(a > 0) && !(b < 0) })
  if (other.length) throw new Error(`feature ${feature.properties.geoid} has a ring crossing the dateline — manual cut needed`)
  push(west)
  push(east)
}

async function run() {
  const work = join(tmpdir(), `sr-counties-${process.pid}`)
  await mkdir(work, { recursive: true })
  const zip = join(work, 'cb.zip')
  const raw = join(work, 'raw.json')
  try {
    console.log(`Fetching ${SOURCE_URL} …`)
    const res = await fetch(SOURCE_URL)
    if (!res.ok) throw new Error(`Census HTTP ${res.status}`)
    const buf = Buffer.from(await res.arrayBuffer())
    await writeFile(zip, buf)
    console.log(`  downloaded ${(buf.length / 1024 / 1024).toFixed(1)} MB`)

    console.log(`Running mapshaper (${MAPSHAPER}, simplify ${SIMPLIFY_PCT}) …`)
    execFileSync('npx', MAPSHAPER_ARGS(zip, raw), { stdio: ['ignore', 'inherit', 'inherit'] })

    const fc = JSON.parse(await readFile(raw, 'utf8'))
    const features = []
    let splits = 0
    const before = fc.features.length
    for (const f of fc.features) {
      const n = features.length
      emitFeatures(f, features)
      if (features.length - n > 1) splits += features.length - n - 1
    }

    // Stable sort: by geoid, then by the feature's west-most longitude so a
    // dateline-split county's two halves keep a deterministic order.
    features.sort((a, b) =>
      a.properties.geoid.localeCompare(b.properties.geoid) || a.bbox[0] - b.bbox[0])

    // ── Hard guards ─────────────────────────────────────────────────────────
    if (features.length < MIN_FEATURES) throw new Error(`only ${features.length} features (< ${MIN_FEATURES}) — truncated fetch or over-filter`)
    for (const f of features) {
      const p = f.properties
      if (!p.geoid || !p.name || !p.stusps || p.statefp === undefined) throw new Error(`feature missing a required property: ${JSON.stringify(p)}`)
      if (!/^\d{5}$/.test(p.geoid)) throw new Error(`bad geoid ${p.geoid} (not 5 digits)`)
      const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates
      for (const rings of polys) for (const ring of rings) for (const [lng, lat] of ring) {
        if (Math.abs(lng) > 180.0001 || Math.abs(lat) > 90.0001) throw new Error(`coordinate out of range: ${lng},${lat} (geoid ${p.geoid})`)
      }
    }

    const out = { type: 'FeatureCollection', vintage: VINTAGE, source: 'US Census Bureau Cartographic Boundary Files (public domain)', features }
    const json = JSON.stringify(out)
    const rawBytes = Buffer.byteLength(json)
    const gzBytes = gzipSync(json, { level: 9 }).length

    if (rawBytes > RAW_CEILING) throw new Error(`raw asset ${(rawBytes / 1024 / 1024).toFixed(2)} MB exceeds the ${(RAW_CEILING / 1024 / 1024).toFixed(1)} MB ceiling — raise SIMPLIFY_PCT aggressiveness`)
    if (gzBytes > GZ_BUDGET) throw new Error(`gzipped asset ${(gzBytes / 1024).toFixed(0)} KB exceeds the ${(GZ_BUDGET / 1024).toFixed(0)} KB budget (NFR-02) — raise SIMPLIFY_PCT aggressiveness`)

    await mkdir(dirname(OUT), { recursive: true })
    await writeFile(OUT, json)

    const states = new Set(features.map(f => f.properties.stusps)).size
    console.log(`wrote ${features.length} features (${before} counties, ${splits} dateline split) across ${states} states+DC -> ${OUT}`)
    console.log(`  raw ${(rawBytes / 1024).toFixed(0)} KB  /  gzipped ${(gzBytes / 1024).toFixed(0)} KB (budget ${(GZ_BUDGET / 1024).toFixed(0)} KB)`)
  } finally {
    await rm(work, { recursive: true, force: true })
  }
}

run().catch(e => { console.error(e); process.exit(1) })

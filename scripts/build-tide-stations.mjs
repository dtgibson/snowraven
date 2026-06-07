#!/usr/bin/env node
// Builds the bundled NOAA CO-OPS tide-station list used by the weather-tides
// feature. Fetches NOAA's two keyless station lists, trims each station to the
// fields the app needs, filters to US (states + territories) — dropping the few
// foreign prediction stations and the 2 Bermuda gauges so "nearest station" is
// always a US station and distance stays meaningful — and writes ONE canonical
// JSON consumed by BOTH runtimes:
//   - frontend/src/assets/noaa-tide-stations.json   (bundled into the Tauri/web build)
//   - backend/staticdata/noaa_tide_stations.json    (read by the FastAPI tide route;
//       NOT backend/data/, which is gitignored user-upload storage)
//
// NOAA updates stations quarterly; re-run this at release time to refresh.
// Run: node scripts/build-tide-stations.mjs

import { writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = join(HERE, '..')

const MDAPI = 'https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations.json'

// US states + DC + territories whose 2-letter codes appear in NOAA's `state`.
const US_STATES = new Set([
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS',
  'KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY',
  'NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV',
  'WI','WY','DC',
  // Territories / freely-associated (NOAA CO-OPS coverage)
  'PR','VI','GU','AS','MP','UM','FM','MH','PW',
])

// Coarse US bounding boxes (lng/lat) — the geometry fallback for stations whose
// `state` is blank/foreign-formatted but are genuinely US (offshore/territory).
// Used ONLY to RESCUE a US station the state-code test would drop, never to admit
// a clearly foreign one.
const US_BOXES = [
  [-125.1, 24.2, -66.7, 49.5],   // CONUS
  [-179.5, 51.0, -129.0, 71.5],  // Alaska (incl. Aleutians west span handled below)
  [172.0, 51.0, 180.0, 53.5],    // Aleutians across the antimeridian
  [-160.5, 18.5, -154.5, 22.6],  // Hawaii
  [-67.5, 17.6, -64.5, 18.6],    // PR + USVI
  [144.5, 13.0, 145.9, 15.3],    // Guam + CNMI
  [-171.2, -14.5, -169.3, -13.2],// American Samoa
]
function inUSBox(lat, lng) {
  return US_BOXES.some(([w, s, e, n]) => lng >= w && lng <= e && lat >= s && lat <= n)
}

async function fetchList(type) {
  const res = await fetch(`${MDAPI}?type=${type}`)
  if (!res.ok) throw new Error(`NOAA ${type} HTTP ${res.status}`)
  const data = await res.json()
  return data.stations || []
}

function isUS(s) {
  const st = (s.state || '').trim().toUpperCase()
  if (US_STATES.has(st)) return true
  if (st === 'BERMUDA' || st.length > 2) return false // explicit foreign label
  // Blank/odd state: keep only if it falls inside a US box (rescues US offshore).
  return inUSBox(s.lat, s.lng)
}

function run() {
  return Promise.all([fetchList('waterlevels'), fetchList('tidepredictions')]).then(async ([wl, tp]) => {
    const obsIds = new Set(wl.map(s => String(s.id)))
    const byId = new Map()
    // tidepredictions first (dense coverage), then waterlevels marks obs:true.
    for (const s of tp) {
      if (s.greatlakes) continue // not tidal
      if (!isUS(s)) continue
      byId.set(String(s.id), {
        id: String(s.id), name: s.name, lat: s.lat, lng: s.lng,
        state: (s.state || '').trim(), obs: obsIds.has(String(s.id)),
      })
    }
    for (const s of wl) {
      if (s.greatlakes) continue
      if (!isUS(s)) continue
      const id = String(s.id)
      if (byId.has(id)) { byId.get(id).obs = true; continue }
      byId.set(id, {
        id, name: s.name, lat: s.lat, lng: s.lng,
        state: (s.state || '').trim(), obs: true,
      })
    }
    const stations = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id))
    const payload = { generated: new Date().toISOString().slice(0, 10), count: stations.length, stations }
    const json = JSON.stringify(payload)

    const targets = [
      join(REPO, 'frontend/src/assets/noaa-tide-stations.json'),
      join(REPO, 'backend/staticdata/noaa_tide_stations.json'),
    ]
    for (const t of targets) {
      await mkdir(dirname(t), { recursive: true })
      await writeFile(t, json)
      console.log(`wrote ${stations.length} stations -> ${t}`)
    }
    const obsCount = stations.filter(s => s.obs).length
    console.log(`  (${obsCount} observed-capable, ${stations.length - obsCount} prediction-only)`)
  })
}

run().catch(e => { console.error(e); process.exit(1) })

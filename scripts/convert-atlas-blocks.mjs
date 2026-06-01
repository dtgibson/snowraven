#!/usr/bin/env node
// convert-atlas-blocks.mjs
//
// One-off converter: official California Breeding Bird Atlas blocks (KML) →
// the compact gazetteer asset SnowRaven bundles
// (frontend/src/assets/ca-atlas-blocks.json).
//
// The blocks are a perfectly regular grid: each USGS 7.5' quad (0.125° x 0.125°)
// is split 2 cols x 3 rows into 6 named blocks (SW SE / CW CE / NW NE), and every
// block in the official data is a clean axis-aligned rectangle (verified: all
// 16,527 polygons have 5 vertices; none are coastline-clipped). So instead of
// bundling 16,527 polygons we emit only the irreducible data — one record per quad
// { sw:[lat,lng], name, pos? } — and the app regenerates the rectangles + names at
// runtime (see frontend/src/lib/atlasBlocks.ts). `pos` is included only for edge
// quads that are missing some of their 6 blocks.
//
// Dependency-free (regex stream parse). Usage:
//   node scripts/convert-atlas-blocks.mjs ~/Downloads/ca_bba_blocks_v3.kml [out.json]

import { readFileSync, writeFileSync } from 'node:fs'

const QUAD = 0.125
const COLS = 2, ROWS = 3
const DLNG = QUAD / COLS          // 0.0625
const DLAT = QUAD / ROWS          // 0.0416667
// position code -> [col, row] (col 0 = west, row 0 = south)
const POS = { SW: [0, 0], SE: [1, 0], CW: [0, 1], CE: [1, 1], NW: [0, 2], NE: [1, 2] }
const ALL_POS = Object.keys(POS)

const [, , inPath, outPath = 'frontend/src/assets/ca-atlas-blocks.json'] = process.argv
if (!inPath) {
  console.error('Usage: node scripts/convert-atlas-blocks.mjs <statewide.kml> [out.json]')
  process.exit(1)
}

const home = process.env.HOME ?? ''
const resolved = inPath.startsWith('~') ? home + inPath.slice(1) : inPath
const xml = readFileSync(resolved, 'utf8')

const snap = v => Math.round(v / QUAD) * QUAD
const r4 = v => Number(v.toFixed(4))

const quads = new Map() // key "swLat,swLng" -> { sw, name, present:Set }
let blockCount = 0, skipped = 0

const placemarkRe = /<Placemark>([\s\S]*?)<\/Placemark>/g
let m
while ((m = placemarkRe.exec(xml)) !== null) {
  const pm = m[1]
  const nameM = /<name>([^<]+)<\/name>/.exec(pm)
  const coordM = /<coordinates>([^<]+)<\/coordinates>/.exec(pm)
  const descM = /<description>([^<]+)<\/description>/.exec(pm)
  if (!nameM || !coordM) { skipped++; continue }
  const fullName = nameM[1].trim()
  const lastSpace = fullName.lastIndexOf(' ')
  const pos = lastSpace < 0 ? '' : fullName.slice(lastSpace + 1)
  if (!(pos in POS)) { skipped++; continue }
  const quadName = fullName.slice(0, lastSpace)
  // Block code (e.g. "32117F2CE") = USGS quad id + position; lives in <description>.
  // The quad id is the code minus the 2-char position suffix; eBird block URL is
  // https://ebird.org/atlascalifornia/block/<quadId><pos>.
  const blockCode = descM ? descM[1].trim() : ''
  const quadId = blockCode.endsWith(pos) ? blockCode.slice(0, -pos.length) : ''

  // Block SW corner = min lng, min lat across the rectangle's coords.
  let minLng = Infinity, minLat = Infinity
  for (const pair of coordM[1].trim().split(/\s+/)) {
    const [lng, lat] = pair.split(',').map(Number)
    if (lng < minLng) minLng = lng
    if (lat < minLat) minLat = lat
  }
  const [col, row] = POS[pos]
  const quadSwLng = snap(minLng - col * DLNG)
  const quadSwLat = snap(minLat - row * DLAT)
  const key = `${r4(quadSwLat)},${r4(quadSwLng)}`
  let q = quads.get(key)
  if (!q) { q = { sw: [r4(quadSwLat), r4(quadSwLng)], name: quadName, id: quadId, present: new Set() }; quads.set(key, q) }
  if (!q.id && quadId) q.id = quadId
  q.present.add(pos)
  blockCount++
}

const scheme = {
  cols: COLS, rows: ROWS, quadLat: QUAD, quadLng: QUAD,
  positions: [['SW', 'SE'], ['CW', 'CE'], ['NW', 'NE']],
}

let partial = 0, missingId = 0
const outQuads = [...quads.values()].map(q => {
  if (!q.id) missingId++
  const base = { sw: q.sw, name: q.name, id: q.id }
  if (q.present.size < ALL_POS.length) { partial++; return { ...base, pos: [...q.present].sort() } }
  return base
})

const out = { scheme, quads: outQuads, irregular: [] }
writeFileSync(outPath, JSON.stringify(out))

const bytes = Buffer.byteLength(JSON.stringify(out))
console.error(`Parsed ${blockCount} blocks (skipped ${skipped} non-block placemarks).`)
console.error(`Wrote ${outPath}: ${outQuads.length} quads (${partial} partial, ${missingId} missing id), 0 irregular.`)
console.error(`Asset size: ${(bytes / 1024).toFixed(0)} KB raw.`)

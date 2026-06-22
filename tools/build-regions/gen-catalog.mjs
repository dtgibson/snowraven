#!/usr/bin/env node
// RELEASE-TIME catalog emitter for the offline region-tiles pipeline (Slice 2e).
//
// This is a STUB / scaffold: it does NOT run the actual tile bake (that needs the
// multi-hundred-GB Protomaps planet source + the go-pmtiles `pmtiles extract` CLI,
// neither present in this repo — see ./README.md). It takes a list of metadata for
// regions you have ALREADY baked and uploaded, and emits the bundled discovery
// catalog the in-app region manager reads:
//
//   frontend/src/assets/regions-catalog.json
//
// Run (release-time):
//   node tools/build-regions/gen-catalog.mjs <baked-regions.json> \
//        --version 2026.06 \
//        --base-url https://github.com/dtgibson/snowraven/releases/download/regions-2026.06/
//
// <baked-regions.json> is an array of per-region metadata objects, each shaped like
// the catalog `regions[]` entry below (typically assembled by the bake step after it
// `stat`s each emitted .pmtiles for its byte size). Passing no input file emits an
// EMPTY catalog (the starting state — valid, the app degrades to "no regions
// available yet" rather than crashing).

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = join(HERE, '..', '..')
const OUT = join(REPO, 'frontend/src/assets/regions-catalog.json')

// Must match the loader's id shape guard (NFR-12): two-letter country, optional
// hyphen-delimited subregion. e.g. us-ca-001 (county), us-ca (whole state).
const REGION_ID_RE = /^[a-z]{2}(-[a-z0-9-]{1,40})?$/

function parseArgs(argv) {
  const args = { input: null, version: null, baseUrl: null }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--version') args.version = argv[++i]
    else if (a === '--base-url') args.baseUrl = argv[++i]
    else if (!a.startsWith('--') && args.input === null) args.input = a
    else { console.error(`unknown argument: ${a}`); process.exit(1) }
  }
  return args
}

// Keep only the catalog-relevant fields, in a stable key order, validating each.
function normalizeRegion(r, idx) {
  const fail = (msg) => { console.error(`region[${idx}] (${r && r.regionId}): ${msg}`); process.exit(1) }
  if (!r || typeof r !== 'object') fail('not an object')
  if (typeof r.regionId !== 'string' || !REGION_ID_RE.test(r.regionId)) {
    fail(`regionId ${JSON.stringify(r.regionId)} fails ${REGION_ID_RE}`)
  }
  if (!Array.isArray(r.extent) || r.extent.length !== 4 || !r.extent.every((n) => typeof n === 'number')) {
    fail('extent must be [w,s,e,n] of 4 numbers')
  }
  if (typeof r.bytes !== 'number' || r.bytes <= 0) fail('bytes must be a positive number')
  return {
    regionId: r.regionId,
    name: String(r.name ?? r.regionId),
    kind: r.kind === 'state' ? 'state' : 'county',
    stateCode: String(r.stateCode ?? ''),
    countyName: r.countyName != null ? String(r.countyName) : undefined,
    extent: r.extent,
    minZoom: Number.isInteger(r.minZoom) ? r.minZoom : 0,
    maxZoom: Number.isInteger(r.maxZoom) ? r.maxZoom : 14,
    bytes: r.bytes,
    sourceVersion: r.sourceVersion != null ? String(r.sourceVersion) : undefined,
  }
}

async function run() {
  const { input, version, baseUrl } = parseArgs(process.argv.slice(2))

  let regions = []
  if (input) {
    let raw
    try {
      raw = JSON.parse(await readFile(input, 'utf-8'))
    } catch (e) {
      console.error(`could not read/parse ${input}: ${e.message}`)
      process.exit(1)
    }
    if (!Array.isArray(raw)) { console.error(`${input} must contain a JSON array of region metadata`); process.exit(1) }
    regions = raw.map((r, i) => normalizeRegion(r, i))
    regions.sort((a, b) => a.regionId.localeCompare(b.regionId))
  } else {
    console.log('no input file given — emitting an EMPTY catalog (no bakes yet).')
  }

  // Read the existing catalog to inherit currentVersion/baseUrl when not overridden,
  // so re-running without flags doesn't blow away the prior values.
  let prev = {}
  try { prev = JSON.parse(await readFile(OUT, 'utf-8')) } catch { /* first run / absent */ }

  const catalog = {
    currentVersion: version ?? prev.currentVersion ?? '2026.06',
    baseUrl: baseUrl ?? prev.baseUrl ?? 'https://github.com/dtgibson/snowraven/releases/download/regions-2026.06/',
    regions,
  }

  await mkdir(dirname(OUT), { recursive: true })
  await writeFile(OUT, JSON.stringify(catalog, null, 2) + '\n')
  console.log(
    `wrote ${regions.length} region(s) -> ${OUT}\n` +
    `  currentVersion=${catalog.currentVersion} baseUrl=${catalog.baseUrl}`
  )
}

run().catch((e) => { console.error(e); process.exit(1) })

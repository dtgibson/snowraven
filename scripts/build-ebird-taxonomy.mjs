#!/usr/bin/env node
// Builds the bundled eBird taxonomy snapshot used as the OFFLINE FLOOR under the
// live taxonomy caches (offline-support feature, Slice 3a). Fetches the full eBird
// taxonomy and derives the SAME 5-map bundle the runtime caches build, so the
// shipped snapshot is byte-shape-identical to what the live loaders produce.
//
// It writes ONE canonical JSON consumed by BOTH runtimes:
//   - frontend/src/assets/ebird-taxonomy.json   (desktop/web bundled floor, dynamic-imported)
//   - backend/staticdata/ebird_taxonomy.json     (read by the FastAPI taxonomy route;
//       NOT backend/data/, which is gitignored user-upload storage)
//
// The derivation is the SINGLE SOURCE OF TRUTH shared with:
//   - frontend/src/lib/tauri/taxonomyService.ts  (loadTaxonomy, ~lines 113-133)
//   - backend/routers/taxonomy.py                (_derive_from_taxonomy)
// Keep all three in lockstep:
//   bySci    = sciName.lower() -> speciesCode   (species category only)
//   byCom    = comName.lower() -> speciesCode   (species category only)
//   byOrder  = comName.lower() -> taxonOrder    (species only, INTEGER)
//   byCode   = speciesCode -> comName           (ALL categories, original case)
//   reportAs = speciesCode -> reportAs parent   (ALL categories)
//
// `byCode`/`reportAs` MUST be built from ALL categories — every reportAs source
// code is a non-species sub-form (issf/form/domestic/intergrade); a species-only
// byCode/reportAs would drop 100% of sub-form normalization (e.g. "rocpig1" would
// resolve to itself instead of "Rock Pigeon").
//
// eBird revises the taxonomy ~once a year (Clements update). Re-run this at RELEASE
// time to refresh; it is NOT part of `npm run build` (a missing key must never break
// CI, and the snapshot is a committed artifact). The frontend/backend loaders both
// degrade gracefully when this asset is absent.
//
// Requires EBIRD_API_KEY in the environment (e.g. loaded from backend/.env).
// Run:
//   node --env-file=backend/.env scripts/build-ebird-taxonomy.mjs
//   # or, if your node is <20.6 (no --env-file): export EBIRD_API_KEY=... first.
//
// VERSION: hand-bumped to the Clements/eBird year, aligned with the desktop
// CACHE_KEY suffix in taxonomyService.ts (taxonomy-v2027 => "2027"). Bump this AND
// CACHE_KEY together on the annual revision (see CLAUDE.md / DECISIONS.md).

import { writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { deriveCountability, guard as guardCountability } from './build-countability.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = join(HERE, '..')

// Hand-bumped Clements/eBird year; MUST match the CACHE_KEY suffix in
// taxonomyService.ts (currently "taxonomy-v2027").
const VERSION = '2027'

// `generated` provenance stamp. This is a build SCRIPT (node), not app render code,
// so a plain new Date() is fine here (the eslint react-hooks/purity rule is for the
// app — it does not apply to build tooling).
const GENERATED = new Date().toISOString().slice(0, 10)

const EBIRD_TAXONOMY_URL = 'https://api.ebird.org/v2/ref/taxonomy/ebird?fmt=json'

// Plausibility floors — a truncated/partial fetch must HARD-FAIL the build, never
// silently ship a degraded snapshot (a truncated floor blanks favicons for ALL
// users until the next release). Real 2026 numbers: ~17.9k byCode, ~11.2k each
// bySci/byCom/byOrder, ~4.1k reportAs. These floors sit well below the real values.
const MIN_BY_CODE = 10_000
const MIN_REPORT_AS = 1_000
const MIN_NAME_MAPS = 5_000

async function fetchTaxonomy() {
  const key = process.env.EBIRD_API_KEY
  if (!key) {
    console.error(
      'EBIRD_API_KEY is not set. Load it from backend/.env, e.g.:\n' +
      '  node --env-file=backend/.env scripts/build-ebird-taxonomy.mjs'
    )
    process.exit(1)
  }
  const res = await fetch(EBIRD_TAXONOMY_URL, {
    headers: { 'x-ebirdapitoken': key },
  })
  if (!res.ok) {
    console.error(`eBird taxonomy HTTP ${res.status} — check EBIRD_API_KEY.`)
    process.exit(1)
  }
  const taxonomy = await res.json()
  if (!Array.isArray(taxonomy)) {
    console.error('eBird returned a non-array response; aborting.')
    process.exit(1)
  }
  return taxonomy
}

// Mirror of taxonomyService.ts loadTaxonomy() / taxonomy.py _derive_from_taxonomy().
function deriveBundle(taxonomy) {
  const bySci = {}
  const byCom = {}
  const byOrder = {}
  const byCode = {}
  const reportAs = {}

  for (const taxon of taxonomy) {
    const code = taxon.speciesCode ?? ''
    if (!code) continue
    byCode[code] = taxon.comName ?? ''
    if (taxon.reportAs) reportAs[code] = taxon.reportAs
    // Name -> code maps stay species-level (preserves /taxonomy/codes behavior).
    if (taxon.category !== 'species') continue
    const sci = (taxon.sciName ?? '').toLowerCase()
    const com = (taxon.comName ?? '').toLowerCase()
    if (sci) bySci[sci] = code
    if (com) {
      byCom[com] = code
      // INTEGER (matches backend int(order)); a straight copy is then value-identical.
      if (taxon.taxonOrder != null) byOrder[com] = Math.trunc(Number(taxon.taxonOrder))
    }
  }

  return { version: VERSION, generated: GENERATED, bySci, byCom, byOrder, byCode, reportAs }
}

function guard(bundle, rawLen) {
  const counts = {
    raw: rawLen,
    byCode: Object.keys(bundle.byCode).length,
    bySci: Object.keys(bundle.bySci).length,
    byCom: Object.keys(bundle.byCom).length,
    byOrder: Object.keys(bundle.byOrder).length,
    reportAs: Object.keys(bundle.reportAs).length,
  }
  const fail = (msg) => {
    console.error(`GUARD FAILED — ${msg}. Counts: ${JSON.stringify(counts)}`)
    process.exit(1)
  }
  if (counts.byCode < MIN_BY_CODE) fail(`byCode ${counts.byCode} < ${MIN_BY_CODE} (truncated fetch?)`)
  if (counts.reportAs < MIN_REPORT_AS) fail(`reportAs ${counts.reportAs} < ${MIN_REPORT_AS}`)
  if (counts.bySci < MIN_NAME_MAPS) fail(`bySci ${counts.bySci} < ${MIN_NAME_MAPS}`)
  if (counts.byCom < MIN_NAME_MAPS) fail(`byCom ${counts.byCom} < ${MIN_NAME_MAPS}`)
  if (counts.byOrder < MIN_NAME_MAPS) fail(`byOrder ${counts.byOrder} < ${MIN_NAME_MAPS}`)

  // Self-consistency: every reportAs PARENT must be a known byCode key (no dangling
  // normalization target). A dangling parent would resolve a sub-form to a code with
  // no common name.
  let dangling = 0
  for (const parent of Object.values(bundle.reportAs)) {
    if (!(parent in bundle.byCode)) dangling++
  }
  if (dangling > 0) fail(`${dangling} reportAs parents are not byCode keys (dangling normalization)`)

  return counts
}

async function run() {
  const taxonomy = await fetchTaxonomy()
  const bundle = deriveBundle(taxonomy)
  const counts = guard(bundle, taxonomy.length)

  const json = JSON.stringify(bundle)
  const bytes = Buffer.byteLength(json)
  const mb = (bytes / (1024 * 1024)).toFixed(2)

  const targets = [
    join(REPO, 'frontend/src/assets/ebird-taxonomy.json'),
    join(REPO, 'backend/staticdata/ebird_taxonomy.json'),
  ]
  for (const t of targets) {
    await mkdir(dirname(t), { recursive: true })
    await writeFile(t, json)
    console.log(`wrote ${mb} MB -> ${t}`)
  }
  console.log(
    `  version=${bundle.version} generated=${bundle.generated} | ` +
    `raw=${counts.raw} byCode=${counts.byCode} bySci=${counts.bySci} ` +
    `byCom=${counts.byCom} byOrder=${counts.byOrder} reportAs=${counts.reportAs}`
  )

  // The countability artifact is derived from the bundle we just built, in the
  // SAME run, so the two can never drift across an annual Clements revision. It
  // is what `lib/speciesUtils.ts` reads to decide what counts toward a species
  // list; see `build-countability.mjs` for what it contains and why it is only
  // the 169 corrections rather than all 17,891 verdicts.
  const countability = deriveCountability(bundle)
  guardCountability(countability)
  const countabilityTarget = join(REPO, 'frontend/src/assets/ebird-countability.json')
  await writeFile(countabilityTarget, JSON.stringify(countability))
  console.log(
    `wrote ${countabilityTarget}\n  countable=${countability.countable.length} ` +
    `nonCountable=${countability.nonCountable.length} (over ${countability.names} published names)`
  )
}

run().catch((e) => { console.error(e); process.exit(1) })

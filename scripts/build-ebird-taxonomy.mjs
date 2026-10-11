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
// plus, from the same fetch, two frontend-only derived assets:
//   - frontend/src/assets/ebird-countability.json (see build-countability.mjs)
//   - frontend/src/assets/ebird-alpha-codes.json  (species-code-search: every
//       published common name, lowercased, to the four-letter codes Search and
//       the species pickers match; its rule, the American-name filter, is in
//       scripts/lib/ebirdTaxonomyDerive.mjs, the pure core of this script)
//
// THE REVISION CHECK. With VERSION unchanged, this script refuses a live
// taxonomy whose five maps differ from the committed snapshot (codes are never
// generated from a newer revision than the snapshot), and when they are equal it
// writes ONLY the alpha-code asset, so every other asset stays byte-identical.
// So at the annual revision, bump VERSION and CACHE_KEY FIRST; the run then
// writes every asset together. Nothing is written until every check has passed.
//
// The derivation is the SINGLE SOURCE OF TRUTH shared with:
//   - frontend/src/lib/tauri/taxonomyService.ts  (loadTaxonomy, ~lines 113-133)
//   - backend/routers/taxonomy.py                (_derive_from_taxonomy)
// (the five maps are derived in scripts/lib/ebirdTaxonomyDerive.mjs, deriveSnapshotMaps)
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
//
// THE ANNUAL REVISION ALSO RE-RUNS THE SPLITS-AND-LUMPS HISTORY
// (taxonomic-splits-lumps): after this writes the new snapshot, add the new
// year's two Cornell files to scripts/taxonomy-history-input/ (its README says
// which), add the year's published date and eBird's announced tally to
// UPDATE_PUBLISHED in scripts/lib/taxonomyHistoryDerive.mjs, and run
//   node scripts/build-taxonomy-history.mjs
// The history records the snapshot version it was built against, and
// taxonomyHistoryAsset.test.ts fails while the two disagree.

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { deriveCountability, guard as guardCountability } from './build-countability.mjs'
import { planTaxonomyRun } from './lib/ebirdTaxonomyDerive.mjs'

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

const SNAPSHOT_TARGET = join(REPO, 'frontend/src/assets/ebird-taxonomy.json')
const SNAPSHOT_TWIN_TARGET = join(REPO, 'backend/staticdata/ebird_taxonomy.json')
const COUNTABILITY_TARGET = join(REPO, 'frontend/src/assets/ebird-countability.json')
const ALPHA_CODES_TARGET = join(REPO, 'frontend/src/assets/ebird-alpha-codes.json')

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

/** The committed snapshot's file text, or null when it does not exist yet. */
async function readCommittedSnapshot() {
  try {
    return await readFile(SNAPSHOT_TARGET, 'utf8')
  } catch (e) {
    if (e && e.code === 'ENOENT') return null
    throw e
  }
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
  // 1-3. Fetch, read the committed snapshot, and plan. The plan runs the
  // revision check and every alpha-code invariant; a refusal is part of it.
  const taxonomy = await fetchTaxonomy()
  const committed = await readCommittedSnapshot()
  const plan = planTaxonomyRun({ live: taxonomy, committed, version: VERSION, generated: GENERATED })
  if (plan.mode === 'stop') {
    for (const m of plan.messages) console.error(m)
    console.error('Nothing was written.')
    process.exit(1)
  }

  // 4. The snapshot floors, in both modes (the alpha-code asset is derived from
  // the same fetch, so a truncated fetch must stop it too).
  const counts = guard(plan.bundle, taxonomy.length)

  // 5-6. Everything to write, decided before the first write. The countability
  // artifact is derived from the bundle in the SAME run, so the two can never
  // drift across an annual Clements revision. It is what `lib/speciesUtils.ts`
  // reads to decide what counts toward a species list; see
  // `build-countability.mjs` for what it contains and why it is only the 169
  // corrections rather than all 17,891 verdicts.
  const writes = []
  if (plan.mode === 'all') {
    const json = JSON.stringify(plan.bundle)
    const countability = deriveCountability(plan.bundle)
    guardCountability(countability)
    writes.push({ target: SNAPSHOT_TARGET, json })
    writes.push({ target: SNAPSHOT_TWIN_TARGET, json })
    writes.push({ target: COUNTABILITY_TARGET, json: JSON.stringify(countability) })
    console.log(
      `  version=${plan.bundle.version} generated=${plan.bundle.generated} | ` +
      `raw=${counts.raw} byCode=${counts.byCode} bySci=${counts.bySci} ` +
      `byCom=${counts.byCom} byOrder=${counts.byOrder} reportAs=${counts.reportAs}\n` +
      `  countable=${countability.countable.length} ` +
      `nonCountable=${countability.nonCountable.length} (over ${countability.names} published names)`
    )
  } else {
    console.log(
      `codes-only: the live taxonomy equals the committed snapshot (version ${VERSION}), ` +
      'so only the alpha-code asset is written and every other asset stays byte-identical.'
    )
  }
  writes.push({ target: ALPHA_CODES_TARGET, json: plan.alphaCodesJson })
  const codeValues = Object.values(plan.alphaCodes.codes)
  console.log(
    `  alpha codes: ${codeValues.filter((v) => v !== '').length} of ${codeValues.length} ` +
    'published names carry a code'
  )

  // 7. The only write in this file. No guard runs after the first write.
  for (const { target, json } of writes) {
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, json)
    console.log(`wrote ${(Buffer.byteLength(json) / (1024 * 1024)).toFixed(2)} MB -> ${target}`)
  }
}

run().catch((e) => { console.error(e); process.exit(1) })

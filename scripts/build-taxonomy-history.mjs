#!/usr/bin/env node
// Builds `frontend/src/assets/ebird-taxonomy-history.json`, the bundled record of
// species-level splits and lumps in eBird's annual taxonomy updates that the
// Species Detail "Splits and lumps" view reads (taxonomic-splits-lumps,
// schema.md section 4).
//
// A DEVELOPER STEP, never a CI or runtime step: it reads Cornell's published
// files from the GITIGNORED `scripts/taxonomy-history-input/` (its README lists
// them and where to download them, in a browser), plus the committed taxonomy
// snapshot. It never fetches and never reads an API key.
//
// FAIL CLOSED. The pure core (`scripts/lib/taxonomyHistoryDerive.mjs`) throws on
// anything it cannot resolve to a complete, dated event, and re-checks its own
// output with the SAME invariant checker the CI guard runs. On any error this
// script prints it, exits non-zero and writes NOTHING.
//
// COVERAGE is whatever the inputs cover, derived, never typed: every year Y whose
// integrated checklist and taxonomy are present along with the previous update's
// two files, provided the covered years are consecutive eBird updates. An input
// that no covered year needs is refused, so the directory states the coverage.
//
// ANNUAL REFRESH. After `build-ebird-taxonomy.mjs` writes a new snapshot, add the
// new year's two files and re-run:
//
//   node scripts/build-taxonomy-history.mjs
//
// The asset records the snapshot version it was built against, and
// `taxonomyHistoryAsset.test.ts` fails when the two disagree, so a fresh snapshot
// with a stale history cannot ship.

import { readFile, readdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { deriveHistory, HistoryInputError } from './lib/taxonomyHistoryDerive.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = join(HERE, '..')
const INPUT_DIR = join(HERE, 'taxonomy-history-input')
const SNAPSHOT = join(REPO, 'frontend/src/assets/ebird-taxonomy.json')
const ASSET = join(REPO, 'frontend/src/assets/ebird-taxonomy-history.json')

// `generated` provenance stamp: a build script, not app render code.
const GENERATED = new Date().toISOString().slice(0, 10)

/** Serialize with every object's keys sorted, so a no-op regeneration on the
 *  same day is byte-identical (the countability precedent). */
function stableStringify(value) {
  return JSON.stringify(value, (_k, v) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      return Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]]))
    }
    return v
  })
}

async function main() {
  const entries = await readdir(INPUT_DIR, { withFileTypes: true })
  const files = []
  for (const d of entries) {
    // Only regular .csv files at the top level are inputs; the README and any
    // subdirectory (for example a developer's scratch downloads) are not.
    if (!d.isFile() || !d.name.endsWith('.csv')) continue
    files.push({ name: d.name, text: await readFile(join(INPUT_DIR, d.name), 'utf8') })
  }
  if (files.length === 0) {
    throw new HistoryInputError(`no input files in ${INPUT_DIR} (see its README.md)`)
  }
  const snapshot = JSON.parse(await readFile(SNAPSHOT, 'utf8'))
  const { history } = deriveHistory({ files, snapshot, generated: GENERATED })

  const json = stableStringify(history)
  await writeFile(ASSET, json)
  const splits = history.events.filter(e => e.kind === 'split').length
  const lumps = history.events.length - splits
  const range = history.coverage
    ? `${history.coverage.earliest.year} to ${history.coverage.latest.year}`
    : 'nothing'
  console.log(`wrote ${ASSET}: ${splits} splits and ${lumps} lumps covering ${range}, ${Buffer.byteLength(json)} bytes`)
}

main().catch((err) => {
  if (err instanceof HistoryInputError) {
    console.error(`FAILED CLOSED, nothing written: ${err.message}`)
  } else {
    console.error(err)
  }
  process.exit(1)
})

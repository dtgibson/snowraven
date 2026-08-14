#!/usr/bin/env node
// Derives `frontend/src/assets/ebird-countability.json` from the COMMITTED eBird
// taxonomy snapshot. No network: it reads the snapshot that
// `build-ebird-taxonomy.mjs` already wrote, so it can be re-run at any time.
//
// WHAT THIS ARTIFACT IS
//
// eBird decides countability with the `reportAs` field, which is already in the
// snapshot. A published name counts toward a species list when its code is itself
// a species, or when `reportAs` resolves it to one. That is eBird's own
// distinction: ambiguity about WHICH SPECIES does not count, ambiguity about WHICH
// SUBSPECIES counts as the parent.
//
// Shipping that verdict for all 17,891 published names would cost ~105 KB gzipped
// on the entry chunk (`lib/speciesUtils.ts` is statically reachable from App.tsx,
// so this rides first paint). It does not have to. eBird's own NAMING CONVENTION
// already encodes the verdict: a form whose name leaves the species in doubt
// carries " sp.", a "/", or an " x ". Measured against the snapshot, that
// convention reproduces eBird's verdict on 17,722 of the 17,891 published names.
//
// So we ship the convention (`isNonCountableNameShape`, in speciesUtils.ts) plus
// the 169 names where eBird disagrees with it. The pair is EXACTLY eBird's verdict
// over every name eBird publishes, and `countableForms.test.ts` asserts that
// equivalence name by name rather than leaving it as reasoning.
//
//   countable    88 names eBird counts that the convention would reject
//                (subspecies-group slashes inside a trailing parenthetical:
//                "Canada Goose (moffitti/maxima)", "Redpoll (Common/Hoary)")
//   nonCountable 81 names eBird rejects that the convention would count
//                (3 named hybrids carrying no " x " such as "Brewster's Warbler
//                (hybrid)", 25 spuhs with a parenthetical after the " sp.", and
//                53 undescribed or unrecognized forms, which are not two tidy
//                suffixes but 48 "(undescribed form)", 4 "(unrecognized
//                species)" and one "(undescribed Panay form)")
//
// The 2,523 remaining non-countable names are NOT shipped: the convention already
// rejects every one of them, so listing them would add ~19 KB gzipped to first
// paint and change no answer. That is a size choice, not a semantic one, and the
// equivalence test is what makes it safe.
//
// REGENERATION. `build-ebird-taxonomy.mjs` calls `deriveCountability` itself, so
// the annual Clements refresh writes both files in one run and they cannot drift.
// Run this standalone only to rebuild the artifact from a snapshot already on
// disk:
//
//   node scripts/build-countability.mjs
//
// `countableForms.test.ts` re-derives all of this INDEPENDENTLY from the shipped
// snapshot and fails if the artifact disagrees, so a stale artifact cannot ship.

import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = join(HERE, '..')

const SNAPSHOT = join(REPO, 'frontend/src/assets/ebird-taxonomy.json')
const ARTIFACT = join(REPO, 'frontend/src/assets/ebird-countability.json')

/**
 * The naming convention, byte-identical to `isNonCountableNameShape` in
 * `frontend/src/lib/speciesUtils.ts`. Duplicated here because a build script
 * cannot import app TypeScript; the two are locked together by
 * `countableForms.test.ts`, which runs the SHIPPED predicate over the snapshot
 * and compares against this artifact.
 */
function stripTrailingParenthetical(name) {
  const trimmed = name.trim()
  if (!trimmed.endsWith(')')) return trimmed
  const closeIdx = trimmed.length - 1
  const prevClose = trimmed.lastIndexOf(')', closeIdx - 1)
  const openIdx = trimmed.indexOf('(', prevClose + 1)
  if (openIdx === -1) return trimmed
  return trimmed.slice(0, openIdx).trim()
}

function nameShapeSaysNonCountable(name) {
  return (
    name.endsWith(' sp.') ||
    name.includes('/') ||
    stripTrailingParenthetical(name).includes(' x ')
  )
}

/**
 * Derive the two correction lists from a taxonomy bundle.
 *
 * `byCode` is code -> comName over ALL categories, so inverting it gives every
 * name eBird publishes. `byCom` is species-only, so its VALUES are exactly the
 * species codes. A code counts when it is a species or has a `reportAs` parent.
 */
export function deriveCountability(bundle) {
  const nameToCode = new Map()
  for (const [code, name] of Object.entries(bundle.byCode)) {
    if (!name) continue
    if (nameToCode.has(name)) {
      throw new Error(
        `name collision: "${name}" maps to both ${nameToCode.get(name)} and ${code}. ` +
        'The inversion is only lossless while every published name is unique.',
      )
    }
    nameToCode.set(name, code)
  }

  const speciesCodes = new Set(Object.values(bundle.byCom))
  const counts = (code) =>
    speciesCodes.has(code) || Object.prototype.hasOwnProperty.call(bundle.reportAs, code)

  const countable = []
  const nonCountable = []
  for (const [name, code] of nameToCode) {
    const ebirdCounts = counts(code)
    const shapeCounts = !nameShapeSaysNonCountable(name)
    if (ebirdCounts && !shapeCounts) countable.push(name)
    if (!ebirdCounts && shapeCounts) nonCountable.push(name)
  }

  // Sorted so a regeneration that changes nothing produces a byte-identical file.
  countable.sort()
  nonCountable.sort()

  return {
    version: bundle.version,
    generated: bundle.generated,
    names: nameToCode.size,
    countable,
    nonCountable,
  }
}

// Plausibility floors. A snapshot that lost its `reportAs` map would derive an
// empty `countable` list and silently ship today's behaviour under a new name, so
// an empty or near-empty derivation must HARD-FAIL rather than write the file.
// Sized well below the real 88 / 81 so an ordinary annual revision never trips
// them.
const MIN_COUNTABLE = 20
const MIN_NON_COUNTABLE = 20

export function guard(artifact) {
  const fail = (msg) => {
    console.error(
      `GUARD FAILED — ${msg}. countable=${artifact.countable.length} ` +
      `nonCountable=${artifact.nonCountable.length} names=${artifact.names}`,
    )
    process.exit(1)
  }
  if (artifact.countable.length < MIN_COUNTABLE) fail('countable list is implausibly short')
  if (artifact.nonCountable.length < MIN_NON_COUNTABLE) fail('nonCountable list is implausibly short')
  const overlap = artifact.countable.filter((n) => artifact.nonCountable.includes(n))
  if (overlap.length > 0) fail(`${overlap.length} names appear in BOTH lists`)
}

export async function buildFromSnapshot() {
  const bundle = JSON.parse(await readFile(SNAPSHOT, 'utf8'))
  const artifact = deriveCountability(bundle)
  guard(artifact)
  await writeFile(ARTIFACT, JSON.stringify(artifact))
  return artifact
}

// Only run when invoked directly, so `build-ebird-taxonomy.mjs` can import
// `deriveCountability` without triggering a second read of the snapshot.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const artifact = await buildFromSnapshot()
  console.log(
    `wrote ${ARTIFACT}\n  version=${artifact.version} names=${artifact.names} ` +
    `countable=${artifact.countable.length} nonCountable=${artifact.nonCountable.length}`,
  )
}

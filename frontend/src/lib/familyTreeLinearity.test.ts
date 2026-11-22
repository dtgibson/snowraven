/// <reference types="node" />
// The Family Tree derivation's linearity and control cost (family-rollups-and-
// tree NFR-01, NFR-03; QA-74, QA-75's call-graph half, QA-76).
//
// GitHub gates on WORK COUNTS, which no machine can move (testing.md v1.0.75):
// row visits per derivation against rows present, at N and 10N rows, with a
// leg where every row is its own species and its own year (security.md
// v1.0.41: a per-key path runs at volume only when every row is its own key).
// The one CPU-time quotient here runs only in the local full suite, behind
// SR_SKIP_LOCAL_ONLY_TIMING, as Life Lists' quotient rows do; its file-level
// work rows still gate on GitHub. The Life Lists passes this tab calls are
// held by lifeListsLinearity.test.ts, which is not repeated here.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { deriveFirstSightings } from './lifeLists'
import { deriveRegionIndex, type RegionRef } from './lifeListsRegion'
import { deriveScope, deriveYearColumns, newYearCache, scopeWork, type ScopeBase } from './familyTreeScope'
import { NO_MEDIA_CONSTRAINTS, buildFamilyModel, worldCounts } from './familyTreeModel'
import { generateCorpus, obsRow, mlRow, readFamilyIndex, speciesNames } from '../test/familyTreeCorpus'
import { bestPerCallCpuMs } from '../test/cpuTiming'
import { LOCAL_ONLY, SKIP_LOCAL_ONLY_TIMING } from '../test/localOnlyTiming'
import type { ObservationEntry } from '../types'
import type { MLExportRow } from './parseMLExport'

const INDEX = readFamilyIndex()
const SPECIES = speciesNames(INDEX)

function baseOf(obs: readonly ObservationEntry[], ml: readonly MLExportRow[] | null): ScopeBase {
  return { observations: obs, mlRows: ml, firsts: deriveFirstSightings(obs), index: deriveRegionIndex(obs), columns: deriveYearColumns(obs, ml) }
}
function reset() { scopeWork.obs = 0; scopeWork.col = 0; scopeWork.ml = 0; scopeWork.ns = 0; scopeWork.lifeListsRows = 0 }
const snap = () => ({ ...scopeWork })

/** Every row its own species and its own year (and its own checklist). */
function distinctCorpus(n: number): { obs: ObservationEntry[]; ml: MLExportRow[] } {
  const obs: ObservationEntry[] = []
  const ml: MLExportRow[] = []
  for (let i = 0; i < n; i++) {
    const year = 1000 + (i % 9000)
    obs.push(obsRow(i % 7 === 0 ? `hawk sp. ${i}` : `${SPECIES[i % SPECIES.length]}${i >= SPECIES.length ? ` ${i}` : ''}`, `${year}-05-05`, `S${i}`, { stateProvince: i % 2 ? 'US-CA' : 'US-NY', county: `C${i % 13}` }))
    ml.push(mlRow(SPECIES[i % SPECIES.length], i % 3 === 0 ? 'Photo' : 'Audio', `${year}-05-05`, `S${i}`, `M${i}`))
  }
  return { obs, ml }
}

describe('the load pass Y1 is one visit per row (QA-74)', () => {
  for (const [label, make] of [
    ['an ordinary corpus', (n: number) => generateCorpus(3, SPECIES, n / 8, 8)],
    ['every row its own species and year', (n: number) => distinctCorpus(n)],
  ] as const) {
    it(`${label}: visits per row are 1 at N and at 10N`, () => {
      for (const n of [800, 8_000]) {
        const { obs, ml } = make(n)
        reset()
        deriveYearColumns(obs, ml)
        expect(scopeWork.obs).toBe(obs.length)
        expect(scopeWork.ml).toBe(ml.length)
      }
    })
  }
})

describe('control cost (QA-76)', () => {
  const { obs, ml } = generateCorpus(5, SPECIES, 1_000, 8)
  const base = baseOf(obs, ml)
  const region: RegionRef = base.index.choices.states[0].region
  const year = base.columns.years[0]
  const rowsInYear = base.columns.obsYear.reduce((a, y) => a + (y === year ? 1 : 0), 0)

  it('a Region change at all years visits each ML row and each not-single-species row once, and no observation row', () => {
    reset()
    deriveScope(base, region, null, null)
    const w = snap()
    expect(w.obs).toBe(0)
    expect(w.col).toBe(0)
    expect(w.lifeListsRows).toBe(0)
    expect(w.ml).toBe(ml.length)
    expect(w.ns).toBe(base.columns.nsRow.length)
  })

  it('a Year change visits each observation row at most 3 times, and a second region in that year walks none', () => {
    const cache = newYearCache(year)
    reset()
    deriveScope(base, null, year, cache)
    const first = snap()
    expect(first.col).toBe(obs.length)
    expect(first.lifeListsRows).toBe(rowsInYear)
    deriveScope(base, region, year, cache)
    const second = snap()
    expect(second.col).toBe(2 * obs.length)
    expect(second.lifeListsRows).toBe(2 * rowsInYear)
    // The column scan plus at most two Life Lists passes over a year's rows.
    expect(second.col / obs.length + second.lifeListsRows / Math.max(1, rowsInYear)).toBeLessThanOrEqual(4)
    reset()
    deriveScope(base, base.index.choices.counties[0].region, year, cache)
    expect(snap().col).toBe(0)
    expect(snap().lifeListsRows).toBe(0)
  })

  it('Media, Include Escapees and a provenance change visit no row: the model builds from the scope alone', () => {
    const scope = deriveScope(base, null, null, null)
    const world = worldCounts(INDEX, base.firsts)
    reset()
    for (const media of [NO_MEDIA_CONSTRAINTS, { photo: 'has', audio: 'lacks', video: 'any' } as const]) {
      for (const includeEscapees of [false, true]) {
        buildFamilyModel({ index: INDEX, world, scope, firsts: base.firsts, escapees: new Set([SPECIES[2]]), includeEscapees, media, mediaReadable: true, scopeFiltered: false })
      }
    }
    expect(snap()).toEqual({ obs: 0, col: 0, ml: 0, ns: 0, lifeListsRows: 0 })
  })

  it('at 10N the per-change visits per row are the same as at N', () => {
    const small = generateCorpus(9, SPECIES, 100, 8)
    const large = generateCorpus(9, SPECIES, 1_000, 8)
    const perRow = (c: typeof small) => {
      const b = baseOf(c.obs, c.ml)
      reset()
      deriveScope(b, b.index.choices.countries[0].region, null, null)
      return (scopeWork.ml + scopeWork.ns + scopeWork.obs) / (c.obs.length + c.ml.length)
    }
    expect(Math.abs(perRow(small) - perRow(large))).toBeLessThan(0.05)
  })
})

describe('the derivation never runs in a render body (QA-75, the call graph)', () => {
  it('familyTreeScope and familyTreeModel import no React', () => {
    for (const f of ['./familyTreeScope.ts', './familyTreeModel.ts']) {
      const src = readFileSync(fileURLToPath(new URL(f, import.meta.url)), 'utf8')
      expect(src, f).not.toMatch(/from 'react'/)
    }
  })
})

describe.skipIf(SKIP_LOCAL_ONLY_TIMING)(`CPU-time quotients ${LOCAL_ONLY}`, () => {
  it('Y1 and a Region change at 10N cost about ten times N, not a hundred', () => {
    const small = generateCorpus(31, SPECIES, 1_000, 8)
    const large = generateCorpus(31, SPECIES, 10_000, 8)
    const bs = baseOf(small.obs, small.ml)
    const bl = baseOf(large.obs, large.ml)
    const rs = bs.index.choices.states[0].region
    const rl = bl.index.choices.states[0].region
    const { perCall } = bestPerCallCpuMs([
      () => { deriveYearColumns(small.obs, small.ml); deriveScope(bs, rs, null, null) },
      () => { deriveYearColumns(large.obs, large.ml); deriveScope(bl, rl, null, null) },
    ], { rounds: 7 })
    const quotient = perCall[1] / Math.max(perCall[0], 0.05)
    // Linear reads about 10; a quadratic would read about 100.
    expect(quotient).toBeLessThan(25)
  }, 60_000)
})

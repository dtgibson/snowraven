// The join between a list of names and their codes (species-code-search,
// schema.md sections 7 and 10; FR-10, NFR-04, NFR-05, NFR-08, NFR-10; QA-10 to
// QA-12, QA-36, QA-45, QA-46, QA-48). Runs over the REAL committed asset, read
// from disk, so every row states what the shipped data does.

/// <reference types="node" />
import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  _alphaCodeJoinLookups, _resetAlphaCodeJoinLookups, alphaCodeHits, alphaCodeIndexFor, alphaCodesForName,
  buildAlphaCodeIndex, type AlphaCodeTable,
} from './alphaCodes'
import { compareSpeciesName } from './speciesIndex'
import { matchesSpeciesQuery, rankSpeciesMatches } from './speciesMatch'
import { __resetNormCacheForTests } from './speciesUtils'
import { bestPerCallCpuMs } from '../test/cpuTiming'

const TABLE = JSON.parse(readFileSync(new URL('../assets/ebird-alpha-codes.json', import.meta.url), 'utf8')) as AlphaCodeTable
const rows = (...names: string[]) => names.map(name => ({ name }))

beforeEach(() => _resetAlphaCodeJoinLookups())

describe('alphaCodesForName (FR-10)', () => {
  it('a published name takes its own entry, case-insensitively', () => {
    expect(alphaCodesForName(TABLE, 'Canada Goose')).toEqual(['CANG', 'CAGO'])
    expect(alphaCodesForName(TABLE, 'CANADA GOOSE')).toEqual(['CANG', 'CAGO'])
    expect(alphaCodesForName(TABLE, "Yellow-rumped Warbler (Audubon's)")).toEqual(['AUWA', 'YRWA'])
  })

  it('a published name with no code takes none, never its parent\'s (schema.md 2.3)', () => {
    // Its normalized parent `vireo sp.` carries UNVI; the published entry wins.
    expect(alphaCodesForName(TABLE, 'vireo sp.')).toEqual(['UNVI'])
    expect(alphaCodesForName(TABLE, 'vireo sp. (Red-eyed Vireo complex)')).toEqual([])
    expect(alphaCodesForName(TABLE, 'Cape May x Yellow-rumped Warbler (hybrid)')).toEqual([])
  })

  it('an unpublished form falls back to its normalized parent (QA-12)', () => {
    expect(alphaCodesForName(TABLE, 'Yellow-rumped Warbler (Old Form)')).toEqual(['YRWA'])
    // A stray surrounding space resolves the same way.
    expect(alphaCodesForName(TABLE, ' American Robin ')).toEqual(['AMRO'])
  })

  it('a name that resolves neither way has no codes', () => {
    expect(alphaCodesForName(TABLE, 'Unknown Bird (Form)')).toEqual([])
    expect(alphaCodesForName(TABLE, '')).toEqual([])
  })

  it('hostile names take no codes and change no prototype (QA-36, NFR-08)', () => {
    const before = Object.getOwnPropertyNames(Object.prototype).length
    for (const name of ['__proto__', 'constructor', 'toString', 'valueOf', 'hasOwnProperty', '__proto__ (form)', 'constructor (x)']) {
      expect(alphaCodesForName(TABLE, name), name).toEqual([])
    }
    expect(Object.getOwnPropertyNames(Object.prototype).length).toBe(before)
  })
})

describe('the index for one list', () => {
  const LIST = rows(
    'Yellow-rumped Warbler', 'Yellow-rumped Warbler (Myrtle)', "Yellow-rumped Warbler (Audubon's)",
    'Yellow-rumped Warbler (West Mexico)', 'Canada Goose', 'Cackling Goose', 'Cackling/Canada Goose',
    '__proto__', 'constructor',
  )
  const index = buildAlphaCodeIndex(TABLE, LIST)
  const hit = (q: string) => [...(index.get(q) ?? [])].sort()

  it('a form\'s own code finds that form alone (QA-10)', () => {
    expect(hit('auwa')).toEqual(["Yellow-rumped Warbler (Audubon's)"])
    expect(hit('mywa')).toEqual(['Yellow-rumped Warbler (Myrtle)'])
  })

  it('the parent\'s code finds the species and every form (QA-11)', () => {
    expect(hit('yrwa')).toHaveLength(4)
  })

  it('a shared code names every listed carrier; the slash keeps only its own (QA-04)', () => {
    expect(hit('cago')).toEqual(['Cackling Goose', 'Canada Goose'])
    expect(hit('ccgo')).toEqual(['Cackling/Canada Goose'])
  })

  it('keys are lowercased codes; a hostile query is an ordinary miss (QA-37)', () => {
    expect([...index.keys()].every(k => k === k.toLowerCase())).toBe(true)
    for (const q of ['__proto__', 'constructor', 'toString', 'valueOf', 'hasOwnProperty']) {
      expect(alphaCodeHits(TABLE, LIST, q), q).toBeUndefined()
    }
  })
})

describe('alphaCodeHits: lazy, exact, memoized per list (QA-45, QA-48)', () => {
  it('no table, or no query, means no hits and no join', () => {
    const list = rows('American Robin')
    expect(alphaCodeHits(null, list, 'amro')).toBeUndefined()
    expect(alphaCodeHits(TABLE, list, '')).toBeUndefined()
    expect(_alphaCodeJoinLookups()).toBe(0)
  })

  it('exact equality of the whole code only (FR-09)', () => {
    const list = rows('Yellow-rumped Warbler')
    for (const q of ['yr', 'yrw', 'yrwar', 'rwa', 'yr wa']) expect(alphaCodeHits(TABLE, list, q), q).toBeUndefined()
    expect(alphaCodeHits(TABLE, list, 'yrwa')?.has('Yellow-rumped Warbler')).toBe(true)
  })

  it('fifty keystrokes against one list join it once (QA-45)', () => {
    const list = rows('American Robin', 'Mallard', 'Canada Goose')
    for (let i = 0; i < 50; i++) alphaCodeHits(TABLE, list, ['a', 'am', 'amr', 'amro', 'mall'][i % 5])
    expect(_alphaCodeJoinLookups()).toBe(list.length)
  })

  it('the same list and table return the same index object; a new list or table rebuilds (QA-48)', () => {
    const list = rows('American Robin')
    const first = alphaCodeIndexFor(TABLE, list)
    expect(alphaCodeIndexFor(TABLE, list)).toBe(first)
    // A replaced backup is a new list identity, joined afresh with no relaunch.
    const replaced = rows('American Robin')
    expect(alphaCodeIndexFor(TABLE, replaced)).not.toBe(first)
    const otherTable: AlphaCodeTable = { ...TABLE }
    expect(alphaCodeIndexFor(otherTable, list)).not.toBe(first)
  })
})

// ── Linearity (security.md's method, QA-46, schema.md section 10) ────────────
//
// Through the real exported entry points: a fresh list identity per call (so
// the memo cannot serve a hit), the join through `alphaCodeHits`, then one
// ranking pass, at 1k, 2k, 4k and 8k distinct names. Asserted two ways: exact
// work done (each call looks every row up exactly once, which is exactly 2x per
// doubling and the leg no machine can move), and CPU time through
// `test/cpuTiming.ts`: over the three doublings 1k to 8k, at most 2.5x per
// doubling on average (8k over 1k at most 2.5 cubed, about 15.6, where linear
// reads 8 and a quadratic 64), and no single doubling past 3.2 (a quadratic
// reads 4). Measured on the dev Mac, the average ran 2.0 to 2.1 on a quiet
// machine and 2.23 at a load average of 229 from other sessions, the timed
// call allocating a Map of Sets whose collection cost the CPU clock still
// counts (cpuTiming.ts names that residual). The schema's 2.2 sat inside that
// spread, so the bound sits between it and the quadratic instead; the
// quadratic-join mutation still reads far past it. Every leg here has a
// distinct key per row (security.md v1.0.41), so the per-key path runs at
// volume. The hostile leg holds every name at about 4,000 characters, none
// published, so every row takes the fallback through `normalizeSpeciesName`.

const PUBLISHED = Object.keys(TABLE.codes)
const SIZES = [1_000, 2_000, 4_000, 8_000]
const PER_DOUBLING = 2.5
const ONE_DOUBLING_MAX = 3.2

function joinAndRank(list: readonly { name: string; sciName: string }[], q: string): number {
  __resetNormCacheForTests()
  const fresh = list.slice()
  const hits = alphaCodeHits(TABLE, fresh, q)
  return rankSpeciesMatches(fresh, q, hits, matchesSpeciesQuery, compareSpeciesName).length
}

function assertLinear(lists: { name: string; sciName: string }[][], q: string) {
  _resetAlphaCodeJoinLookups()
  joinAndRank(lists[lists.length - 1], q)
  expect(_alphaCodeJoinLookups(), 'work done: one lookup per row').toBe(lists[lists.length - 1].length)
  const { perCall } = bestPerCallCpuMs(lists.map(list => () => joinAndRank(list, q)), { rounds: 7, minSampleMs: 20 })
  const quotients = perCall.slice(1).map((ms, i) => ms / perCall[i])
  const label = `per-doubling quotients ${quotients.map(x => x.toFixed(2)).join(', ')} (CPU ms ${perCall.map(x => x.toFixed(3)).join(', ')})`
  const doublings = perCall.length - 1
  expect(perCall[doublings] / perCall[0], label).toBeLessThanOrEqual(PER_DOUBLING ** doublings)
  for (const quotient of quotients) expect(quotient, label).toBeLessThanOrEqual(ONE_DOUBLING_MAX)
}

describe('linearity of the join plus one ranking pass (NFR-05, QA-46)', () => {
  it('published names, a code query', { timeout: 60_000 }, () => {
    // Spread evenly over the taxonomy, so every leg has the same mix of species,
    // forms and code-less entries; a prefix would time the taxonomy's order.
    const lists = SIZES.map(n => Array.from({ length: n }, (_, i) =>
      ({ name: PUBLISHED[Math.floor((i * PUBLISHED.length) / n)], sciName: 'Genus species' })))
    expect(new Set(lists[3].map(r => r.name)).size).toBe(8_000)   // distinct keys, non-vacuity
    assertLinear(lists, 'amro')
  })

  it('hostile: every name about 4,000 characters, none published, each its own key', { timeout: 60_000 }, () => {
    const pad = 'q'.repeat(3_980)
    const lists = SIZES.map(n => Array.from({ length: n }, (_, i) => ({ name: `${pad} ${i} (form)`, sciName: '' })))
    expect(alphaCodesForName(TABLE, lists[0][0].name)).toEqual([])   // the fallback path, and a miss
    assertLinear(lists, 'qqqq')
  })
})

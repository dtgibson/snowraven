// The location index cannot outlive its parse (visited-hotspots-in-search gate
// R4, NFR-04, QA-44; schema 2.4 and 10.4).
//
// THROUGH THE REAL OBSERVATIONS CACHE, with only `storage` mocked, so the parse's
// lifetime is the one production gives it: `clearEbirdObservationsCache()` is
// what every save, replace and clear runs.
//
// The collection is FORCED inside the test: `--expose-gc` set at run time and a
// `gc` taken from a new context, which needs no process flag. The suite asserts
// it has that function before anything else, so it fails, never skips, where it
// cannot collect. The step that creates each WeakRef is a plain function whose
// only return is the WeakRef: a suspended async function keeps its locals alive
// (CLAUDE.md, v1.0.57), so an index held by a local of the test would read as
// retained and the suite would measure itself.
//
// CONTROL LEG: the same steps over a test-local copy of the species memo's shape
// (a strong slot) must find the index STILL alive. Without it, a probe that
// could never see a retained index would pass.

/// <reference types="node" />
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import v8 from 'node:v8'
import vm from 'node:vm'

const H = vi.hoisted(() => ({ readFile: vi.fn() }))
vi.mock('./storage', () => ({ storage: { readFile: H.readFile, getFilesStatus: vi.fn() } }))

import { clearEbirdObservationsCache, loadEbirdObservations } from './observationsCache'
import {
  buildLocationSearchIndex, locationSearchIndexFor, peekLocationSearchIndex, _locationSearchBuilds,
  LOCATION_INDEX_FAILED, type LocationSearchIndex,
} from './paletteLocations'
import type { ObservationEntry } from '../types'

v8.setFlagsFromString('--expose-gc')
const gc = vm.runInNewContext('gc') as (() => void) | undefined

const HEADER = 'Submission ID,Common Name,Scientific Name,Taxonomic Order,Count,State/Province,County,Location ID,Location,Date'
function csv(prefix: string, n: number): string {
  const lines = [HEADER]
  for (let i = 0; i < n; i++) lines.push(`S${prefix}${i},Song Sparrow,Melospiza melodia,1,1,US-NY,Kings,L${prefix}${i},${prefix} place ${i},2024-05-01`)
  return lines.join('\n')
}

/** Load through the real cache and hand back ONLY a WeakRef to this parse's index. */
function weakIndexOf(obs: readonly ObservationEntry[]): WeakRef<LocationSearchIndex> {
  const ix = locationSearchIndexFor(obs)
  if (ix === LOCATION_INDEX_FAILED) throw new Error('the derivation failed')
  return new WeakRef(ix)
}

/** The species memo's shape, copied for the control leg: a strong slot. */
let strongSlot: LocationSearchIndex | null = null
function strongIndexOf(obs: readonly ObservationEntry[]): WeakRef<LocationSearchIndex> {
  const ix = buildLocationSearchIndex(obs)
  strongSlot = ix
  return new WeakRef(ix)
}

const macrotask = () => new Promise<void>(r => setTimeout(r, 0))
async function collect(): Promise<void> {
  for (let i = 0; i < 3; i++) {
    await macrotask()
    gc!()
  }
}

beforeEach(() => {
  H.readFile.mockReset()
  clearEbirdObservationsCache()
  strongSlot = null
})

describe('the index is released with its parse (R4, QA-44)', () => {
  it('this process can force a collection (the suite fails rather than skips without it)', () => {
    expect(typeof gc).toBe('function')
  })

  it('is alive while its parse is cached, and collected once the cache is CLEARED', async () => {
    H.readFile.mockImplementation(async () => csv('a', 200))
    const ref = await loadEbirdObservations().then(l => weakIndexOf(l!.observations))
    await collect()
    expect(ref.deref(), 'alive while the parse is cached').toBeDefined()

    clearEbirdObservationsCache()
    await collect()
    expect(ref.deref(), 'collected after the parse was cleared').toBeUndefined()
  })

  it('is collected when the file is REPLACED, and the new file\'s index is alive and is the memo\'s value', async () => {
    H.readFile.mockImplementation(async () => csv('a', 200))
    const oldRef = await loadEbirdObservations().then(l => weakIndexOf(l!.observations))

    H.readFile.mockImplementation(async () => csv('b', 150))
    clearEbirdObservationsCache()
    const newRef = await loadEbirdObservations().then(l => weakIndexOf(l!.observations))
    await collect()

    expect(oldRef.deref(), 'the replaced file\'s index').toBeUndefined()
    expect(newRef.deref(), 'the new file\'s index').toBeDefined()
    const isMemo = await loadEbirdObservations().then(l => peekLocationSearchIndex(l!.observations) === newRef.deref())
    expect(isMemo).toBe(true)
  })

  it('CONTROL: the species memo\'s strong-slot shape is still alive after the same clear', async () => {
    H.readFile.mockImplementation(async () => csv('c', 200))
    const ref = await loadEbirdObservations().then(l => strongIndexOf(l!.observations))
    clearEbirdObservationsCache()
    await collect()
    expect(ref.deref(), 'a strong slot retains the index past its parse').toBeDefined()
    expect(strongSlot).not.toBeNull()
  })
})

describe('one derivation per parse (R2, QA-07)', () => {
  it('sixty calls on one parse run one build; a replace runs one more', async () => {
    H.readFile.mockImplementation(async () => csv('d', 100))
    const before = _locationSearchBuilds()
    const same = await loadEbirdObservations().then(l => {
      const first = locationSearchIndexFor(l!.observations)
      let allSame = true
      for (let i = 0; i < 59; i++) if (locationSearchIndexFor(l!.observations) !== first) allSame = false
      return allSame
    })
    expect(same).toBe(true)
    expect(_locationSearchBuilds() - before).toBe(1)

    H.readFile.mockImplementation(async () => csv('e', 100))
    clearEbirdObservationsCache()
    await loadEbirdObservations().then(l => { locationSearchIndexFor(l!.observations); locationSearchIndexFor(l!.observations) })
    expect(_locationSearchBuilds() - before).toBe(2)
  })
})

describe('the module holds nothing that could keep file text alive (schema 10.4)', () => {
  const SRC = readFileSync(new URL('./paletteLocations.ts', import.meta.url), 'utf8')
  const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map(l => l.replace(/(^|\s)\/\/.*$/, '$1')).join('\n')
  /** Declarations at column 0: the module's top level. */
  const topLevel = CODE.split('\n').filter(l => /^(?:export\s+)?(?:const|let|var)\s/.test(l))

  it('the strip and the top-level scan see real declarations (non-vacuity)', () => {
    expect(SRC).toContain('// ── The memo')
    expect(CODE).not.toContain('── The memo')
    expect(topLevel.length).toBeGreaterThan(5)
  })

  it('declares exactly one WeakMap and no Map, Set, array or object at module scope', () => {
    const collections = topLevel.filter(l => /=\s*(?:new\s+\w+|\[|\{)/.test(l))
    expect(collections).toEqual(['const memo = new WeakMap<object, LocationSearchIndex | typeof LOCATION_INDEX_FAILED>()'])
  })

  it('its top-level `let` bindings are numeric counters', () => {
    const lets = topLevel.filter(l => /^(?:export\s+)?let\s/.test(l))
    expect(lets.length).toBeGreaterThan(0)
    for (const l of lets) expect(l).toMatch(/^let \w+ = 0$/)
  })
})

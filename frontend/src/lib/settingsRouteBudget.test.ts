/// <reference types="node" />
// Twin guard for big-old-life-lists security review L1: on web/Pi each of the
// settings-document stores below (the two checklist-keyed stores, and since
// hotspot-share-stat the per-region hotspot store) is saved WHOLE through the backend's generic
// `/settings/{key}` route (`WebStorage.setSetting` posts `JSON.stringify(doc)`),
// and that route refuses a body over `_MAX_BYTES` in
// `backend/routers/settingskv.py` with 413. Both stores write best-effort and
// swallow the refusal, so a document that outgrows the route stops being saved
// with nothing going red, and every later session re-asks eBird for each
// checklist past the point it stopped. The route's limit is therefore the
// unwritten twin of each store's cap.
//
// What this file compares is the two DECLARATIONS: the Python constant, read
// from the file that enforces it, against the WORST-CASE document each store can
// hold at its shipped cap. The worst case is not typed here. Each dimension's
// largest admitted value is shown to be admitted by the store's own load
// validator (`sanitizeStore`) and the next value up refused, the document is
// built at the cap and run through `sanitizeStore`, and its UTF-8 size is what
// is measured. So raising a cap, widening an entry bound in a validator, or
// lowering the route's limit turns this file red.
//
// Scope: the bounds are the LOAD validators'. Each store's write path writes
// values inside them: keys are refused before any request by the controllers
// (`fetchProjects`, `fetchProvenance`), times are `Date.now()`, project answers
// pass `isValidEntry` at the write chokepoint, provenance tokens come from the
// seam's bounded normalizer, and published names are names that resolved to a
// species code through the taxonomy. The provenance load path does not clamp
// its ledger or species COUNTS (its merge path does, FIFO and admission), so its
// document is built at exactly the caps the merge path enforces. Its unmatched
// stamps (exotic-provenance-reuse) it does clamp, so that count is asked of
// the load path like every other bound.
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'

vi.mock('./storage', () => ({ storage: {} }))

import {
  sanitizeStore as sanitizeProjects, PROJECTS_MAX_CHECKLISTS, PROJECTS_MAX_CHECKLISTS_DEFAULT,
} from './checklistProjectsCache'
import {
  sanitizeStore as sanitizeProvenance, PROVENANCE_MAX_CHECKLISTS, PROVENANCE_MAX_CHECKLISTS_DEFAULT,
  PROVENANCE_MAX_SPECIES, PROVENANCE_MAX_SPECIES_DEFAULT, MAX_SEEN_PER_SPECIES,
  PROVENANCE_MAX_UNMATCHED, PROVENANCE_MAX_UNMATCHED_DEFAULT, UNMATCHED_JOIN_VERSION,
} from './exoticProvenanceCache'
import {
  sanitizeStore as sanitizeHotspots, storePayloadLength as hotspotPayload, idsPayloadLength,
  HOTSPOT_REGIONS_MAX_ENTRIES, HOTSPOT_REGIONS_MAX_ENTRIES_DEFAULT,
  HOTSPOT_REGIONS_MAX_BYTES, HOTSPOT_REGIONS_MAX_BYTES_DEFAULT,
  HOTSPOT_IDS_PER_REGION_MAX, HOTSPOT_REGION_KEY_MAX_CHARS, HOTSPOT_ID_MAX_CHARS,
} from './hotspotRegionCache'

const utf8Bytes = (s: string): number => new TextEncoder().encode(s).length

// -- The route's limit, read from the Python ---------------------------------

const PY = readFileSync(new URL('../../../backend/routers/settingskv.py', import.meta.url), 'utf8')

function routeLimitBytes(): number {
  const assignments = PY.match(/^_MAX_BYTES\s*=.*$/gm) ?? []
  expect(assignments, 'exactly one _MAX_BYTES assignment').toHaveLength(1)
  const line = assignments[0] ?? ''
  const m = line.match(/^_MAX_BYTES\s*=\s*([0-9_\s*]+?)\s*(?:#.*)?$/)
  expect(m, `a product of integer literals: ${line}`).not.toBeNull()
  const factors = m![1].split('*').map(f => f.trim().replace(/_/g, ''))
  for (const f of factors) expect(f, line).toMatch(/^[0-9]+$/)
  return factors.reduce((n, f) => n * Number(f), 1)
}

describe('the settings route\'s limit', () => {
  it('is the constant the route enforces, and a body of exactly that size is accepted', () => {
    // Ties the constant read above to its enforcement line, so a renamed or
    // second limit cannot leave this file comparing against a dead constant.
    // `>` is why "fits" below is `<=`.
    expect(PY).toContain('if len(raw) > _MAX_BYTES:')
    expect(routeLimitBytes()).toBeGreaterThan(0)
  })
})

// -- Facts about JSON the worst cases rest on ---------------------------------

// The longest JSON a finite double serializes to. Number::toString writes at
// most 17 significant digits, and writes a value from 1e-6 up to 1e21 without
// an exponent, so the longest form is a negative value just above 1e-6: a sign,
// `0.`, five zeros and 17 digits, 25 characters (an exponent form is at most
// 24). A first draft of this file said 24, and the sample below caught it.
const LONGEST_FINITE = -0.0000012345678901234567

describe('the JSON facts the worst cases rest on', () => {
  it('no finite number serializes longer than LONGEST_FINITE, over a random sample of bit patterns', () => {
    const longest = JSON.stringify(LONGEST_FINITE).length
    expect(longest).toBe(25)
    const view = new DataView(new ArrayBuffer(8))
    let seed = 0x9e3779b9
    const next = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed >>> 0 }
    let max = 0
    let finite = 0
    for (let i = 0; i < 200_000; i += 1) {
      view.setUint32(0, next()); view.setUint32(4, next())
      const v = view.getFloat64(0)
      if (!Number.isFinite(v)) continue
      finite += 1
      max = Math.max(max, JSON.stringify(v).length)
    }
    expect(finite).toBeGreaterThan(190_000)
    // Equal, not only at most: the sample reaches the longest form, so it is
    // able to see one longer.
    expect(max).toBe(longest)
  })

  it('no UTF-16 code unit costs more than 6 bytes inside a JSON string', () => {
    // A control character or a lone surrogate is written as a six-character
    // escape; every other code unit costs at most 3 bytes of UTF-8.
    let max = 0
    for (let u = 0; u <= 0xffff; u += 1) max = Math.max(max, utf8Bytes(JSON.stringify(String.fromCharCode(u))) - 2)
    expect(max).toBe(6)
    expect(utf8Bytes(JSON.stringify('\u0001'))).toBe(8)
  })
})

// -- The projects store -------------------------------------------------------

describe('the projects store\'s worst-case document fits under the route\'s limit', () => {
  const admits = (key: string, entry: unknown) =>
    sanitizeProjects({ version: 1, entries: { [key]: entry }, order: [key] }).order.length === 1

  const KEY_DIGITS = 15
  const PROJ = 'A'.repeat(32)
  const ID = 999_999_999
  const IDS = Array.from({ length: 8 }, () => ID)
  const worst = { proj: PROJ, ids: IDS, at: LONGEST_FINITE }
  const key = (i: number) => `S${String(10 ** (KEY_DIGITS - 1) + i)}`

  it('each dimension of the worst entry is the validator\'s largest admitted value', () => {
    expect(admits(key(0), worst)).toBe(true)
    expect(key(0)).toHaveLength(1 + KEY_DIGITS)
    // One past each bound is refused, so the entry above is the validator's
    // maximum and not a guess: a widened bound turns one of these red.
    expect(admits(`S${'9'.repeat(KEY_DIGITS + 1)}`, worst)).toBe(false)
    expect(admits(key(0), { ...worst, proj: PROJ + 'A' })).toBe(false)
    expect(admits(key(0), { ...worst, ids: [...IDS, ID] })).toBe(false)
    expect(admits(key(0), { ...worst, ids: [ID + 1] })).toBe(false)
    expect(admits(key(0), { ...worst, ids: [-1] })).toBe(false)
    expect(admits(key(0), { ...worst, ids: [0.5] })).toBe(false)
  })

  it('at the shipped cap, built through sanitizeStore', () => {
    expect(PROJECTS_MAX_CHECKLISTS).toBe(PROJECTS_MAX_CHECKLISTS_DEFAULT)
    const N = PROJECTS_MAX_CHECKLISTS_DEFAULT
    const entries: Record<string, unknown> = {}
    const order: string[] = []
    // One past the cap: the load path stops admitting at the cap, which is part
    // of what bounds the document.
    for (let i = 0; i <= N; i += 1) { const k = key(i); entries[k] = worst; order.push(k) }
    const store = sanitizeProjects({ version: 1, entries, order })
    expect(store.order).toHaveLength(N)

    const bytes = utf8Bytes(JSON.stringify(store))
    const limit = routeLimitBytes()
    expect(bytes, `worst-case projects document ${bytes} B against the route's ${limit} B`).toBeLessThanOrEqual(limit)
  }, 60_000)
})

// -- The provenance store -----------------------------------------------------

describe('the provenance store\'s worst-case document fits under the route\'s limit', () => {
  // Under the current taxonomy join, so the load path keeps its stamps
  // (escapee-check-new-taxonomy); the marker is part of the measured document.
  const doc = (over: Partial<Record<string, unknown>>) => ({
    version: 1, checklists: {}, order: [], species: {}, speciesOrder: [], excludedNames: [],
    unmatchedJoin: UNMATCHED_JOIN_VERSION, ...over,
  })
  const admitsChecklist = (k: string, at: unknown) =>
    sanitizeProvenance(doc({ checklists: { [k]: at }, order: [k] })).order.length === 1
  const admitsSpecies = (code: string, rec: unknown) =>
    sanitizeProvenance(doc({ species: { [code]: rec }, speciesOrder: [code] })).speciesOrder.length === 1
  const admittedNames = (names: string[]) => sanitizeProvenance(doc({ excludedNames: names })).excludedNames.length
  // The exotic list (life-lists-tab) is a second published list on the same
  // document, read through its own field so its bounds are asked, not assumed.
  const admittedExoticNames = (names: string[]) => sanitizeProvenance(doc({ exoticNames: names })).exoticNames?.length ?? 0
  // The unmatched stamps (exotic-provenance-reuse). Unlike the ledger and the
  // species index, the load path clamps their COUNT, so it is asked as well.
  const admitsStamp = (code: string, at: unknown) =>
    sanitizeProvenance(doc({ unmatched: { [code]: at }, unmatchedOrder: [code] })).unmatchedOrder.length === 1
  const admittedStamps = (n: number) => {
    const order = Array.from({ length: n }, (_, i) => stampCode(i))
    return sanitizeProvenance(doc({ unmatched: Object.fromEntries(order.map(k => [k, 1])), unmatchedOrder: order })).unmatchedOrder.length
  }

  const KEY_DIGITS = 15
  const checklistKey = (i: number) => `S${String(10 ** (KEY_DIGITS - 1) + i)}`
  const CODE_LENGTH = 16
  const speciesCode = (i: number) => `s${i.toString(36).padStart(CODE_LENGTH - 1, '0')}`
  // Disjoint from the species codes: a stamp beside a record is dropped on load.
  const stampCode = (i: number) => `u${i.toString(36).padStart(CODE_LENGTH - 1, '0')}`
  const TOKEN = 'AAAA|AAAAAAAA'
  const tokens = Array.from({ length: MAX_SEEN_PER_SPECIES }, (_, t) => TOKEN.slice(0, -1) + String.fromCharCode(65 + t))
  const worstRecord = { seen: tokens, n: LONGEST_FINITE, at: LONGEST_FINITE }
  // The costliest code unit inside a JSON string (above).
  const NAME_UNIT = '\u0001'

  // The longest published name the load path keeps, found by asking it rather
  // than restated.
  function longestName(): number {
    let longest = 0
    for (let len = 1; len <= 1024; len += 1) if (admittedNames([NAME_UNIT.repeat(len)]) === 1) longest = len
    expect(longest, 'a name length bound exists').toBeLessThan(1024)
    return longest
  }
  // The most published names the load path keeps (the write path slices to the
  // same constant).
  function mostNames(): number {
    const kept = admittedNames(Array.from({ length: 20_000 }, () => 'X'))
    expect(kept, 'a name count bound exists').toBeLessThan(20_000)
    return kept
  }
  function mostExoticNames(): number {
    const kept = admittedExoticNames(Array.from({ length: 20_000 }, () => 'X'))
    expect(kept, 'an exotic name count bound exists').toBeLessThan(20_000)
    return kept
  }
  function longestExoticName(): number {
    let longest = 0
    for (let len = 1; len <= 1024; len += 1) if (admittedExoticNames([NAME_UNIT.repeat(len)]) === 1) longest = len
    expect(longest, 'an exotic name length bound exists').toBeLessThan(1024)
    return longest
  }

  it('each dimension of the worst ledger entry, record and name is the validator\'s largest admitted value', () => {
    expect(admitsChecklist(checklistKey(0), LONGEST_FINITE)).toBe(true)
    expect(admitsChecklist(`S${'9'.repeat(KEY_DIGITS + 1)}`, 1)).toBe(false)

    expect(speciesCode(0)).toHaveLength(CODE_LENGTH)
    expect(admitsSpecies(speciesCode(0), worstRecord)).toBe(true)
    expect(admitsSpecies(speciesCode(0) + 'a', worstRecord)).toBe(false)
    expect(admitsSpecies(speciesCode(0), { ...worstRecord, seen: [...tokens, TOKEN] })).toBe(false)
    expect(tokens.every(t => t.length === TOKEN.length)).toBe(true)
    expect(admitsSpecies(speciesCode(0), { ...worstRecord, seen: ['A' + TOKEN] })).toBe(false)
    expect(admitsSpecies(speciesCode(0), { ...worstRecord, seen: [TOKEN + 'A'] })).toBe(false)

    expect(admittedNames([NAME_UNIT.repeat(longestName())])).toBe(1)
    expect(admittedNames([NAME_UNIT.repeat(longestName() + 1)])).toBe(0)
    expect(admittedExoticNames([NAME_UNIT.repeat(longestExoticName())])).toBe(1)
    expect(admittedExoticNames([NAME_UNIT.repeat(longestExoticName() + 1)])).toBe(0)

    expect(stampCode(0)).toHaveLength(CODE_LENGTH)
    expect(admitsStamp(stampCode(0), LONGEST_FINITE)).toBe(true)
    expect(admitsStamp(stampCode(0) + 'a', LONGEST_FINITE)).toBe(false)
  })

  it('the stamp count the load path keeps is the shipped cap, and the next one up is refused', () => {
    expect(PROVENANCE_MAX_UNMATCHED).toBe(PROVENANCE_MAX_UNMATCHED_DEFAULT)
    expect(admittedStamps(PROVENANCE_MAX_UNMATCHED_DEFAULT)).toBe(PROVENANCE_MAX_UNMATCHED_DEFAULT)
    expect(admittedStamps(PROVENANCE_MAX_UNMATCHED_DEFAULT + 1)).toBe(PROVENANCE_MAX_UNMATCHED_DEFAULT)
  })

  it('the two published lists share one bound, compared to each other rather than restated', () => {
    expect(mostExoticNames()).toBe(mostNames())
    expect(longestExoticName()).toBe(longestName())
  })

  it('at the shipped caps, built through sanitizeStore', () => {
    expect(PROVENANCE_MAX_CHECKLISTS).toBe(PROVENANCE_MAX_CHECKLISTS_DEFAULT)
    expect(PROVENANCE_MAX_SPECIES).toBe(PROVENANCE_MAX_SPECIES_DEFAULT)
    const checklists: Record<string, number> = {}
    const order: string[] = []
    for (let i = 0; i < PROVENANCE_MAX_CHECKLISTS_DEFAULT; i += 1) {
      const k = checklistKey(i); checklists[k] = LONGEST_FINITE; order.push(k)
    }
    const species: Record<string, unknown> = {}
    const speciesOrder: string[] = []
    for (let i = 0; i < PROVENANCE_MAX_SPECIES_DEFAULT; i += 1) {
      const c = speciesCode(i); species[c] = worstRecord; speciesOrder.push(c)
    }
    const name = NAME_UNIT.repeat(longestName())
    const excludedNames = Array.from({ length: mostNames() + 1 }, () => name)
    const exoticName = NAME_UNIT.repeat(longestExoticName())
    const exoticNames = Array.from({ length: mostExoticNames() + 1 }, () => exoticName)
    const unmatched: Record<string, number> = {}
    const unmatchedOrder: string[] = []
    for (let i = 0; i <= PROVENANCE_MAX_UNMATCHED_DEFAULT; i += 1) {
      const c = stampCode(i); unmatched[c] = LONGEST_FINITE; unmatchedOrder.push(c)
    }

    const store = sanitizeProvenance({ version: 1, checklists, order, species, speciesOrder, excludedNames, exoticNames, unmatched, unmatchedOrder, unmatchedJoin: UNMATCHED_JOIN_VERSION })
    expect(store.order).toHaveLength(PROVENANCE_MAX_CHECKLISTS_DEFAULT)
    expect(store.speciesOrder).toHaveLength(PROVENANCE_MAX_SPECIES_DEFAULT)
    expect(store.excludedNames).toHaveLength(mostNames())
    expect(store.exoticNames).toHaveLength(mostExoticNames())
    expect(store.unmatchedOrder).toHaveLength(PROVENANCE_MAX_UNMATCHED_DEFAULT)

    const bytes = utf8Bytes(JSON.stringify(store))
    const limit = routeLimitBytes()
    expect(bytes, `worst-case provenance document ${bytes} B against the route's ${limit} B`).toBeLessThanOrEqual(limit)
  }, 60_000)
})

// -- The hotspot-regions store (hotspot-share-stat, schema.md 9.3, 9.12) --------

describe('the hotspot-regions store\'s worst-case document fits under the route\'s limit', () => {
  const admits = (key: string, entry: unknown) =>
    sanitizeHotspots({ version: 1, entries: { [key]: entry }, order: [key] }).order.length === 1

  // The validator's largest admitted value in each dimension, shown admitted here
  // and the next value up refused below, never typed in as a figure.
  const key = (i: number) => `ZZ-ZZZZ-${String(i).padStart(4, '0')}`
  const MAX_ID = `L${'9'.repeat(HOTSPOT_ID_MAX_CHARS - 1)}`
  const maxIds = (n: number) => Array.from({ length: n }, (_, i) => `L${String(10 ** (HOTSPOT_ID_MAX_CHARS - 2) + i)}`)
  const MAX_ENTRY = { ids: maxIds(HOTSPOT_IDS_PER_REGION_MAX), fetchedAt: LONGEST_FINITE }

  it('each dimension of the worst entry is the validator\'s largest admitted value', () => {
    expect(key(0)).toHaveLength(HOTSPOT_REGION_KEY_MAX_CHARS)
    expect(admits(key(0), { ids: ['L1'], fetchedAt: 1 })).toBe(true)
    expect(admits(`${key(0)}0`, { ids: ['L1'], fetchedAt: 1 })).toBe(false)

    expect(MAX_ID).toHaveLength(HOTSPOT_ID_MAX_CHARS)
    expect(admits(key(0), { ids: [MAX_ID], fetchedAt: 1 })).toBe(true)
    for (const bad of [`${MAX_ID}9`, 'L', 'S1', 'L1a', 'L\u0661']) {
      expect(admits(key(0), { ids: [bad], fetchedAt: 1 }), bad).toBe(false)
    }

    expect(MAX_ENTRY.ids.every(id => id.length === HOTSPOT_ID_MAX_CHARS)).toBe(true)
    expect(new Set(MAX_ENTRY.ids).size).toBe(HOTSPOT_IDS_PER_REGION_MAX)
    expect(admits(key(0), MAX_ENTRY)).toBe(true)
    expect(admits(key(0), { ...MAX_ENTRY, ids: [...MAX_ENTRY.ids, 'L1'] })).toBe(false)

    expect(admits(key(0), { ids: ['L1'], fetchedAt: LONGEST_FINITE })).toBe(true)
    expect(admits(key(0), { ids: ['L1'], fetchedAt: Number.NaN })).toBe(false)
    expect(admits(key(0), { ids: ['L1'], fetchedAt: '1' })).toBe(false)
  }, 60_000)

  it('at the shipped caps, built through sanitizeStore', () => {
    expect(HOTSPOT_REGIONS_MAX_ENTRIES).toBe(HOTSPOT_REGIONS_MAX_ENTRIES_DEFAULT)
    expect(HOTSPOT_REGIONS_MAX_BYTES).toBe(HOTSPOT_REGIONS_MAX_BYTES_DEFAULT)
    const maxEntryBytes = idsPayloadLength(MAX_ENTRY.ids)
    const big = Math.floor(HOTSPOT_REGIONS_MAX_BYTES_DEFAULT / maxEntryBytes) // as many maximum entries as fit
    const small = HOTSPOT_REGIONS_MAX_ENTRIES_DEFAULT - big
    const entries: Record<string, unknown> = {}
    const order: string[] = []
    let i = 0
    // Oldest first: one entry past the cap (the one the load walk drops), then the
    // maximum entries, then one-id entries filling the cap with the newest.
    const put = (entry: unknown) => { const k = key(i); i += 1; entries[k] = entry; order.push(k) }
    put({ ids: [MAX_ID], fetchedAt: LONGEST_FINITE })
    for (let b = 0; b < big; b += 1) put(MAX_ENTRY)
    for (let s1 = 0; s1 < small; s1 += 1) put({ ids: [MAX_ID], fetchedAt: LONGEST_FINITE })
    const store = sanitizeHotspots({ version: 1, entries, order })
    expect(store.order).toHaveLength(HOTSPOT_REGIONS_MAX_ENTRIES_DEFAULT)
    expect(store.order[0]).toBe(key(1)) // the entry past the cap was the one shed
    expect(hotspotPayload(store)).toBeLessThanOrEqual(HOTSPOT_REGIONS_MAX_BYTES_DEFAULT)

    const bytes = utf8Bytes(JSON.stringify(store))
    const limit = routeLimitBytes()
    expect(bytes, `worst-case hotspot-regions document ${bytes} B against the route's ${limit} B`).toBeLessThanOrEqual(limit)
  }, 60_000)

  it('a document at exactly the payload budget is admitted whole, and one id more sheds its oldest entry', () => {
    const maxEntryBytes = idsPayloadLength(MAX_ENTRY.ids)
    const big = Math.floor(HOTSPOT_REGIONS_MAX_BYTES_DEFAULT / maxEntryBytes)
    // A filler entry whose payload brings the total to exactly the budget.
    let rem = HOTSPOT_REGIONS_MAX_BYTES_DEFAULT - big * maxEntryBytes - 1 // its opening bracket
    const filler: string[] = []
    let next = 10 ** (HOTSPOT_ID_MAX_CHARS - 2)
    while (rem > 0) {
      const room = rem - 3 // its two quotes and its comma or closing bracket
      const len = room - (HOTSPOT_ID_MAX_CHARS + 3) >= 2 ? HOTSPOT_ID_MAX_CHARS : room
      expect(len, 'a filler id length the validator admits').toBeGreaterThanOrEqual(2)
      filler.push(len === HOTSPOT_ID_MAX_CHARS ? `L${next++}` : `L${'1'.repeat(len - 1)}`)
      rem -= len + 3
    }
    expect(rem).toBe(0)
    const build = (fill: string[]) => {
      const entries: Record<string, unknown> = {}
      const order: string[] = []
      for (let b = 0; b < big; b += 1) { entries[key(b)] = MAX_ENTRY; order.push(key(b)) }
      entries[key(big)] = { ids: fill, fetchedAt: 1 }
      order.push(key(big))
      return sanitizeHotspots({ version: 1, entries, order })
    }
    const whole = build(filler)
    expect(whole.order).toHaveLength(big + 1)
    expect(hotspotPayload(whole)).toBe(HOTSPOT_REGIONS_MAX_BYTES_DEFAULT)
    const over = build([...filler, 'L1'])
    expect(over.order).toEqual(whole.order.slice(1)) // the OLDEST maximum entry went
  }, 60_000)
})

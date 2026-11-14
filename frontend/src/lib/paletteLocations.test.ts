// Search's location derivation and match (visited-hotspots-in-search, schema
// 10.1): the rule's rows, the match table against the PRD's rule read
// literally, hostile names, the native search's absence and separator legs, the
// per-keystroke search COUNT (the committed form of gate R1), the cap, the
// column ceiling, order independence, and source scans with comments stripped.
//
// Every non-ASCII probe below is written as an escape, and a source row asserts
// that this module's own code holds no literal non-ASCII character
// (.claude/rules/testing.md, v1.0.22 and v1.0.52).

/// <reference types="node" />
import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import type { ObservationEntry } from '../types'
import { row } from '../test/hotspotReportsRows'
import {
  buildLocationSearchIndex, locationSearchIndexFor, peekLocationSearchIndex, matchLocations,
  _columnSearches, _resetColumnSearches, _locationSearchBuilds,
  LOCATION_CAP, LOCATION_QUERY_MAX_CHARS, LOCATION_INDEX_FAILED, COLUMN_SEP,
  type LocationSearchIndex, type SearchLocation,
} from './paletteLocations'
import { LOCATION_NAME_MAX_CHARS } from './hotspotReports'
import { UNNAMED_LOCATION, displayName, ELLIPSIS } from './hotspotReportsCopy'
import { normalizeSpeciesQuery } from './speciesMatch'

/** One checklist's first row at a location. */
const at = (sub: string, locationId: string, location: string, over: Partial<ObservationEntry> = {}) =>
  row({ submissionId: sub, locationId, location, ...over })

const ids = (ix: LocationSearchIndex) => ix.rows.map(r => r.locationId)

/** The PRD's FR-10 rule read literally, one location at a time: the oracle. */
function literal(ix: LocationSearchIndex, raw: string, cap = LOCATION_CAP): { ids: string[]; truncated: boolean } {
  const q = normalizeSpeciesQuery(raw)
  const out: string[] = []
  if (q === '' || q.length > LOCATION_QUERY_MAX_CHARS || q.includes('\n')) return { ids: out, truncated: false }
  for (const r of ix.rows) {
    const shown = r.name === '' ? UNNAMED_LOCATION : r.name
    if (!shown.toLowerCase().includes(q)) continue
    if (out.length === cap) return { ids: out, truncated: true }
    out.push(r.locationId)
  }
  return { ids: out, truncated: false }
}

function match(ix: LocationSearchIndex, raw: string, cap?: number) {
  const m = matchLocations(ix, normalizeSpeciesQuery(raw), cap)
  return { ids: m.rows.map(r => r.locationId), truncated: m.truncated }
}

beforeEach(() => _resetColumnSearches())

describe('which locations exist (FR-05, FR-06)', () => {
  it('a blank or over-bound Location ID on a checklist\'s FIRST row is offered nowhere, and a later row cannot rescue it', () => {
    const ix = buildLocationSearchIndex([
      at('S1', '', 'Blank'),
      at('S1', 'L2', 'Later row of S1'),
      at('S2', 'L'.padEnd(17, '9'), 'Over bound'),
      at('S3', 'L'.padEnd(16, '9'), 'At bound'),
    ])
    expect(ids(ix)).toEqual(['L'.padEnd(16, '9')])
  })

  it('a later row with another ID counts at the checklist\'s first row\'s location', () => {
    const ix = buildLocationSearchIndex([at('S1', 'L1', 'Pond'), at('S1', 'L2', 'Elsewhere')])
    expect(ids(ix)).toEqual(['L1'])
  })

  it('a row with an empty Submission ID changes nothing', () => {
    const ix = buildLocationSearchIndex([at('', 'L9', 'Nowhere'), at('S1', 'L1', 'Pond')])
    expect(ids(ix)).toEqual(['L1'])
  })

  it('two checklists at one location are one row, named and placed by the FIRST checklist', () => {
    const ix = buildLocationSearchIndex([
      at('S1', 'L1', 'Old Name', { county: 'Kings', stateProvince: 'US-NY' }),
      at('S2', 'L1', 'New Name', { county: 'Queens', stateProvince: 'US-NY' }),
    ])
    expect(ix.rows).toEqual([{ locationId: 'L1', name: 'Old Name', truncated: false, place: 'Kings, NY', showId: false }])
  })

  it('reads County and State/Province through the tab\'s bounds', () => {
    const ix = buildLocationSearchIndex([
      at('S1', 'L1', 'A', { county: 'x'.repeat(97), stateProvince: 'US-NY' }),
      at('S2', 'L2', 'B', { county: 'Kings', stateProvince: 'X'.repeat(17) }),
      at('S3', 'L3', 'C', { county: '', stateProvince: '' }),
    ])
    expect(ix.rows.map(r => r.place)).toEqual(['NY', 'Kings', ''])
  })

  it('an empty backup yields an index with no rows and an empty column', () => {
    const ix = buildLocationSearchIndex([])
    expect(ix.rows).toEqual([])
    expect(ix.column).toBe('')
    expect(Array.from(ix.starts)).toEqual([0])
    expect(match(ix, 'a').ids).toEqual([])
  })
})

describe('the match is the PRD\'s rule (FR-10, QA-10)', () => {
  const ix = buildLocationSearchIndex([
    at('S1', 'L1', 'Jamaica Bay Wildlife Refuge', { county: 'Queens', stateProvince: 'US-NY' }),
    at('S2', 'L2', 'Prospect Park', { county: 'Kings', stateProvince: 'US-NY' }),
    at('S3', 'L3', '', { county: 'Marin', stateProvince: 'US-CA' }),
    at('S4', 'L4', 'x'.repeat(250), { county: 'Kings', stateProvince: 'US-NY' }),
    at('S5', 'L5', 'Backyard', { county: 'Santa Clara', stateProvince: 'US-CA' }),
  ])
  const QUERIES: [string, string, string[]][] = [
    ['a mid-name hit', 'wildlife', ['L1']],
    ['a mixed-case query', 'PrOsPeCt', ['L2']],
    ['leading and trailing spaces', '  park  ', ['L2']],
    ['a county that appears in no name', 'queens', []],
    ['a state code that appears in no name', 'ny', []],
    ['a Location ID', 'l5', []],
    ['part of the unnamed placeholder', 'unnamed', ['L3']],
    ['the ellipsis character', ELLIPSIS, []],
    ['text inside the bounded name', 'x'.repeat(200), ['L4']],
    ['a query one past the bound', 'x'.repeat(201), []],
    ['a whitespace-only query', '   ', []],
  ]
  it.each(QUERIES)('%s', (_label, q, expected) => {
    expect(match(ix, q).ids).toEqual(expected)
    expect(match(ix, q)).toEqual(literal(ix, q))
  })
})

describe('hostile names and IDs (FR-15, FR-40 d, QA-15)', () => {
  it('__proto__ and constructor are ordinary names and ordinary Location IDs', () => {
    const ix = buildLocationSearchIndex([
      at('S1', '__proto__', 'constructor'),
      at('S2', 'constructor', '__proto__'),
      at('S3', 'toString', 'hasOwnProperty'),
    ])
    expect(ids(ix).sort()).toEqual(['__proto__', 'constructor', 'toString'])
    expect(match(ix, '__proto__').ids).toEqual(['constructor'])
    expect(match(ix, 'constructor').ids).toEqual(['__proto__'])
    expect(Object.getPrototypeOf({})).toBe(Object.prototype)
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })

  it('an empty name is the placeholder, shown and matched', () => {
    const ix = buildLocationSearchIndex([at('S1', 'L1', '')])
    expect(displayName(ix.rows[0].name, ix.rows[0].truncated)).toBe(UNNAMED_LOCATION)
    expect(match(ix, 'location').ids).toEqual(['L1'])
  })

  it('a whitespace-only name handed in directly is listed and matched by no query (FR-15 c)', () => {
    const ix = buildLocationSearchIndex([at('S1', 'L1', '   ')])
    expect(ids(ix)).toEqual(['L1'])
    for (const q of [' ', '   ', ' a', 'a']) expect(match(ix, q).ids).toEqual([])
  })

  it('a name at the bound is whole; one past it is cut, ellipsized on display, matched on the bounded text only', () => {
    const atBound = 'a'.repeat(LOCATION_NAME_MAX_CHARS)
    const over = 'b'.repeat(LOCATION_NAME_MAX_CHARS) + 'TAIL'
    const ix = buildLocationSearchIndex([at('S1', 'L1', atBound), at('S2', 'L2', over)])
    const [a, b] = ix.rows
    expect([a.name.length, a.truncated]).toEqual([LOCATION_NAME_MAX_CHARS, false])
    expect([b.name.length, b.truncated]).toEqual([LOCATION_NAME_MAX_CHARS, true])
    expect(displayName(b.name, b.truncated).endsWith(ELLIPSIS)).toBe(true)
    expect(match(ix, 'tail').ids).toEqual([])
    expect(match(ix, 'b'.repeat(200)).ids).toEqual(['L2'])
  })

  it('a name cut at a surrogate pair loses the whole pair, never leaving a lone surrogate', () => {
    const pair = '\uD83D\uDC26'
    const name = 'a'.repeat(LOCATION_NAME_MAX_CHARS - 1) + pair + 'zz'
    const ix = buildLocationSearchIndex([at('S1', 'L1', name)])
    const n = ix.rows[0].name
    expect(n.length).toBe(LOCATION_NAME_MAX_CHARS - 1)
    expect(/[\uD800-\uDBFF]$/.test(n)).toBe(false)
  })

  it('a name of dotted capital I lengthens when lowercased and is still found by a short query (stated limit, 2.5)', () => {
    const ix = buildLocationSearchIndex([at('S1', 'L1', '\u0130stanbul')])
    expect(ix.column.length).toBeGreaterThan('\u0130stanbul'.length + 1)
    expect(match(ix, 'stanbul').ids).toEqual(['L1'])
  })

  it('a multi-line name is found by a word on either line and by no query holding a line feed', () => {
    const ix = buildLocationSearchIndex([at('S1', 'L1', 'North Dike\nEast Pool')])
    expect(match(ix, 'dike').ids).toEqual(['L1'])
    expect(match(ix, 'east').ids).toEqual(['L1'])
    expect(matchLocations(ix, 'dike\neast').rows).toEqual([])
  })
})

describe('the native search: its absence and separator legs (security.md v1.0.39)', () => {
  const ix = buildLocationSearchIndex(
    Array.from({ length: 300 }, (_, i) => at(`S${i}`, `L${i}`, `Place ${String(i).padStart(3, '0')}`)),
  )

  it('a query absent from the column makes exactly ONE search and returns nothing', () => {
    _resetColumnSearches()
    expect(matchLocations(ix, 'zzqxv').rows).toEqual([])
    expect(_columnSearches()).toBe(1)
  })

  it('a query holding the separator makes NO search', () => {
    _resetColumnSearches()
    expect(matchLocations(ix, `place${COLUMN_SEP}place`).rows).toEqual([])
    expect(_columnSearches()).toBe(0)
  })

  it('an empty query and an over-bound query make no search', () => {
    _resetColumnSearches()
    matchLocations(ix, '')
    matchLocations(ix, 'p'.repeat(LOCATION_QUERY_MAX_CHARS + 1))
    expect(_columnSearches()).toBe(0)
  })
})

describe('the per-keystroke work is bounded by the cap, not the file (R1, QA-41)', () => {
  /** n locations of which exactly `hits` contain "needle". */
  const file = (n: number, hits: number) => buildLocationSearchIndex(
    Array.from({ length: n }, (_, i) => at(`S${i}`, `L${i}`, i < hits ? `Needle Marsh ${i}` : `Place ${i}`)),
  )

  it.each([0, 1, 7, LOCATION_CAP - 1, LOCATION_CAP, LOCATION_CAP + 1, 400])('%i matches: min(matches, cap) + 1 searches, the same at 500 and 5,000 locations', hits => {
    const counts = [500, 5_000].map(n => {
      const ix = file(n, hits)
      _resetColumnSearches()
      const m = matchLocations(ix, 'needle')
      expect(m.rows).toHaveLength(Math.min(hits, LOCATION_CAP))
      expect(m.truncated).toBe(hits > LOCATION_CAP)
      return _columnSearches()
    })
    expect(counts[0]).toBe(Math.min(hits, LOCATION_CAP) + 1)
    expect(counts[1]).toBe(counts[0])
    expect(counts[0]).toBeLessThanOrEqual(LOCATION_CAP + 1)
  })

  it('GUARD THE GUARD: a search per location makes the count grow with the file', () => {
    // The restart mutant of schema 10.3, run here as a count: one search per
    // location, each from its own start, reads L searches whatever matches.
    const mutant = (ix: LocationSearchIndex, q: string) => {
      let n = 0
      for (let k = 0; k < ix.rows.length; k++) { n += 1; ix.column.indexOf(q, ix.starts[k]) }
      return n
    }
    expect(mutant(file(500, 0), 'needle')).toBe(500)
    expect(mutant(file(5_000, 0), 'needle')).toBe(5_000)
  })
})

describe('the cap (FR-12, QA-12)', () => {
  const ix = buildLocationSearchIndex(
    Array.from({ length: 12 }, (_, i) => at(`S${i}`, `L${String(i).padStart(2, '0')}`, `Marsh ${String(i).padStart(2, '0')}`)),
  )

  it('changing the cap changes the slice and the flag, and the rows are the first matches in order', () => {
    expect(match(ix, 'marsh', 5)).toEqual({ ids: ['L00', 'L01', 'L02', 'L03', 'L04'], truncated: true })
    expect(match(ix, 'marsh', 12)).toEqual({ ids: ids(ix), truncated: false })
    expect(match(ix, 'marsh', 11).truncated).toBe(true)
    expect(match(ix, 'marsh', 5)).toEqual(literal(ix, 'marsh', 5))
  })

  it('a namesake keeps its Location ID when the cap leaves its twin out', () => {
    const twins = buildLocationSearchIndex([
      at('S1', 'L1', 'Backyard', { county: 'Kings', stateProvince: 'US-NY' }),
      at('S2', 'L2', 'Backyard', { county: 'Kings', stateProvince: 'US-NY' }),
      at('S3', 'L3', 'Backyard', { county: 'Queens', stateProvince: 'US-NY' }),
    ])
    const one = matchLocations(twins, 'backyard', 1)
    expect(one.rows.map(r => [r.locationId, r.showId])).toEqual([['L1', true]])
    expect(twins.rows.map(r => r.showId)).toEqual([true, true, false])
  })
})

describe('the column ceiling (schema 2.6, FR-25)', () => {
  it('a column past the ceiling refuses the whole derivation', () => {
    const obs = [at('S1', 'L1', 'Pond'), at('S2', 'L2', 'Lake')]
    expect(() => buildLocationSearchIndex(obs, 9)).toThrow('LOCATION_COLUMN_TOO_LONG')
    expect(() => buildLocationSearchIndex(obs, 10)).not.toThrow()
  })

  it('a failing build is memoized as the failed state: attempted once per parse, never again', () => {
    // An array whose length cannot be read: the build throws on its first line.
    const hostile = new Proxy([] as ObservationEntry[], {
      get(target, prop, recv) {
        if (prop === 'length') throw new Error('unreadable')
        return Reflect.get(target, prop, recv)
      },
    })
    const before = _locationSearchBuilds()
    expect(locationSearchIndexFor(hostile)).toBe(LOCATION_INDEX_FAILED)
    expect(locationSearchIndexFor(hostile)).toBe(LOCATION_INDEX_FAILED)
    expect(peekLocationSearchIndex(hostile)).toBe(LOCATION_INDEX_FAILED)
    expect(_locationSearchBuilds() - before).toBe(1)
  })
})

describe('the order is total and independent of file order (FR-11, QA-11)', () => {
  const rows = [
    at('S1', 'L7', 'beta Pond', { county: 'Kings', stateProvince: 'US-NY' }),
    at('S2', 'L3', 'Alpha Marsh', { county: 'Queens', stateProvince: 'US-NY' }),
    at('S3', 'L9', '', { county: 'Kings', stateProvince: 'US-NY' }),
    at('S4', 'L1', 'Alpha Marsh', { county: 'Kings', stateProvince: 'US-NY' }),
    at('S5', 'L2', 'Alpha Marsh', { county: 'Kings', stateProvince: 'US-NY' }),
    at('S6', 'L8', '', { county: 'Albany', stateProvince: 'US-NY' }),
    at('S7', 'L4', 'ALPHA marsh', { county: 'Bronx', stateProvince: 'US-NY' }),
  ]

  it('orders by name, then place, then Location ID, with unnamed locations last', () => {
    const ix = buildLocationSearchIndex(rows)
    const order = ix.rows.map((r: SearchLocation) => r.locationId)
    expect(order.slice(-2)).toEqual(['L8', 'L9'])
    expect(order.indexOf('L1')).toBeLessThan(order.indexOf('L2'))
    expect(order.indexOf('L2')).toBeLessThan(order.indexOf('L3'))
    expect(order.indexOf('L3')).toBeLessThan(order.indexOf('L7'))
  })

  it('two runs and a shuffled run give the same rows in the same order', () => {
    const a = buildLocationSearchIndex(rows)
    const b = buildLocationSearchIndex(rows)
    const shuffled = [...rows].reverse()
    shuffled.push(shuffled.shift()!)
    const c = buildLocationSearchIndex(shuffled)
    expect(b.rows).toEqual(a.rows)
    expect(c.rows).toEqual(a.rows)
    expect(c.column).toBe(a.column)
  })
})

describe('the module\'s source (comments stripped)', () => {
  const SRC = readFileSync(new URL('./paletteLocations.ts', import.meta.url), 'utf8')
  /** Line comments and block comments removed, string contents kept. */
  const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map(l => l.replace(/(^|\s)\/\/.*$/, '$1')).join('\n')
  const CODE = strip(SRC)

  it('the strip removes comments and keeps code (non-vacuity)', () => {
    expect(SRC).toContain('WHY A `WeakMap`')
    expect(CODE).not.toContain('WHY A `WeakMap`')
    expect(CODE).toContain('new WeakMap')
  })

  it('builds no RegExp: no constructor and no regex literal', () => {
    expect(CODE).not.toContain('RegExp')
    // A regex literal starts with `/` after `(`, `,`, `=`, `:`, `[`, `!`, `&`,
    // `|`, `?` or `return`; division and comments are the only other slashes.
    expect(CODE).not.toMatch(/(?:[(,=:[!&|?]|return)\s*\/[^/*]/)
  })

  it('makes exactly two indexOf calls (the separator check and the search) and no other search primitive', () => {
    const calls = CODE.match(/\.indexOf\(/g) ?? []
    expect(calls).toHaveLength(2)
    expect(CODE).toContain('q.indexOf(COLUMN_SEP)')
    expect(CODE).toContain('column.indexOf(q, from)')
    for (const p of ['.includes(', '.search(', '.match(', '.lastIndexOf(', '.find(', '.filter(']) {
      expect(CODE.includes(p), p).toBe(false)
    }
  })

  it('its code holds no literal non-ASCII character', () => {
    const offenders = [...CODE].filter(ch => ch.charCodeAt(0) > 0x7e)
    expect(offenders).toEqual([])
  })

  it('nor do the suites whose hostile probes are written as escapes, or the load module', () => {
    // An editing tool can turn a written escape into its literal character
    // (testing.md, v1.0.52); this row is what notices.
    for (const rel of ['./paletteLocations.test.ts', './paletteLocationsParity.test.ts', './paletteLocationsLoad.ts']) {
      const code = strip(readFileSync(new URL(rel, import.meta.url), 'utf8'))
      expect([...code].filter(ch => ch.charCodeAt(0) > 0x7e), rel).toEqual([])
    }
  })
})

// Species code search end to end through the real row builder and the real
// picker ranking, over the REAL committed asset (species-code-search; PRD
// QA-01 to QA-22, QA-26, QA-37). The roster lives in `test/alphaCodeRoster.ts`
// and also runs under jsdom (`alphaCodeSearch.jsdom.test.ts`, QA-49).
//
// QA-17 and QA-18 are the non-code invariant (FR-18): for every query that is
// not a code of a listed row, Search and the pickers answer exactly as they did
// before this feature. QA-17 holds named queries against an INLINE copy of the
// pre-change algorithm (an independent oracle); QA-18 holds a generated corpus
// of about 40,000 queries, output with the table against output without it,
// and asserts how many queries were codes and how many were not, so it cannot
// pass vacuously.

/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { alphaCodesForName, type AlphaCodeTable } from './alphaCodes'
import { buildPaletteRows } from './paletteRows'
import { compareSpeciesName, type SpeciesIndexEntry } from './speciesIndex'
import {
  DEFAULT_ITEMS, ROSTER, pickerExpectation, pickerRows, searchRows, speciesIndexOf, speciesOf,
} from '../test/alphaCodeRoster'

const TABLE = JSON.parse(readFileSync(new URL('../assets/ebird-alpha-codes.json', import.meta.url), 'utf8')) as AlphaCodeTable

describe('the roster (QA-01 to QA-16, QA-19, QA-26)', () => {
  it.each(ROSTER.map(r => [r.id, r] as const))('%s', (_id, row) => {
    expect(speciesOf(searchRows(TABLE, row.fixture, row.query)), 'Search').toEqual([...row.code, ...row.name])
    const picker = pickerRows(TABLE, speciesIndexOf(row.fixture), row.query)
    expect(picker, 'picker').toEqual(pickerExpectation(row))
    // One matcher everywhere (FR-19, QA-26): the same set on both surfaces.
    expect([...picker].sort(), 'same set').toEqual([...row.code, ...row.name].sort())
  })

  it('Enter with nothing highlighted opens the first code match (QA-01, FR-17)', () => {
    const r = searchRows(TABLE, ROSTER[0].fixture, 'yrwa')
    expect(r.destinationCount).toBe(0)
    expect(r.rows[0]).toMatchObject({ kind: 'species', name: 'Yellow-rumped Warbler' })
  })
})

describe('the cap applies after ranking (FR-14)', () => {
  const SNOWS = Array.from({ length: 60 }, (_, i) => `Snow ${String(i).padStart(2, '0')}`)

  it('a code match is never pushed past the cap by name matches (QA-20)', () => {
    const r = searchRows(TABLE, [...SNOWS, 'Snowy Owl'], 'snow')
    const species = speciesOf(r)
    expect(species[0]).toBe('Snowy Owl')
    expect(species).toHaveLength(50)
    expect(r.speciesTruncated).toBe(true)
  })

  it('without the code bird, the first 50 are today\'s first 50', () => {
    const r = searchRows(TABLE, SNOWS, 'snow')
    expect(speciesOf(r)).toEqual(SNOWS.slice(0, 50))
    expect(r.speciesTruncated).toBe(true)
  })

  it('code matches are cut only when they alone exceed the cap (QA-21)', () => {
    const names = [
      'Canada Goose', 'Cackling Goose (Aleutian)', 'Cackling Goose',
      'Chicago Bird 1', 'Chicago Bird 2', 'Chicago Bird 3', 'Chicago Bird 4', 'Chicago Bird 5',
    ]
    const r = searchRows(TABLE, names, 'cago', 2)
    expect(speciesOf(r)).toEqual(['Cackling Goose', 'Cackling Goose (Aleutian)'])
    expect(r.speciesTruncated).toBe(true)
  })
})

describe('destinations still lead (FR-15, QA-22)', () => {
  it('`list` lists Checklists and List Comparer first, in the saved order, then Little Stint', () => {
    const r = searchRows(TABLE, ['Least Sandpiper', 'Little Stint'], 'list')
    expect(r.rows.slice(0, r.destinationCount).map(row => (row.kind === 'tab' ? row.label : ''))).toEqual(['Checklists', 'List Comparer'])
    expect(speciesOf(r)).toEqual(['Little Stint'])
    // Enter with nothing highlighted takes rows[0], the first destination.
    expect(r.rows[0]).toMatchObject({ kind: 'tab', id: 'checklists' })
  })

  it('`weat` opens Weather on Enter', () => {
    expect(searchRows(TABLE, ['American Robin'], 'weat').rows[0]).toMatchObject({ kind: 'tab', id: 'weather' })
  })
})

// ── The non-code invariant (FR-18) ───────────────────────────────────────────

interface Snapshot { byCode: Record<string, string>; byCom: Record<string, string>; bySci: Record<string, string> }
const SNAPSHOT = JSON.parse(readFileSync(new URL('../assets/ebird-taxonomy.json', import.meta.url), 'utf8')) as Snapshot

/** About 240 real names: species with their real scientific names, plus forms
 *  with none, spread evenly over the taxonomy; Anna's Hummingbird included. */
const REAL_INDEX: SpeciesIndexEntry[] = (() => {
  const sciByCode = new Map(Object.entries(SNAPSHOT.bySci).map(([sci, code]) => [code, sci]))
  const all = Object.entries(SNAPSHOT.byCode)
  const species = all.filter(([code]) => sciByCode.has(code))
  const forms = all.filter(([code]) => !sciByCode.has(code))
  const spread = <T,>(xs: T[], n: number) => Array.from({ length: n }, (_, i) => xs[Math.floor((i * xs.length) / n)])
  const out = new Map<string, SpeciesIndexEntry>()
  for (const [code, name] of spread(species, 200)) out.set(name, { name, sciName: sciByCode.get(code)! })
  for (const [, name] of spread(forms, 40)) out.set(name, { name, sciName: '' })
  out.set("Anna's Hummingbird", { name: "Anna's Hummingbird", sciName: 'calypte anna' })
  return [...out.values()]
})()

/** The pre-change algorithm, written out here as an independent oracle. */
function todaySearch(index: readonly SpeciesIndexEntry[], query: string, cap = 50) {
  const q = query.trim().toLowerCase()
  const destinations = q ? DEFAULT_ITEMS.filter(it => it.label.toLowerCase().includes(q)) : DEFAULT_ITEMS
  let species: string[] = []
  let truncated = false
  if (q) {
    const matched = index.filter(s => s.name.toLowerCase().includes(q) || s.sciName.toLowerCase().includes(q))
    matched.sort(compareSpeciesName)
    truncated = matched.length > cap
    species = matched.slice(0, cap).map(s => s.name)
  }
  return { destinations: destinations.map(d => d.label), species, truncated }
}
function todayPicker(options: readonly SpeciesIndexEntry[], query: string): string[] {
  const q = query.trim().toLowerCase()
  if (!q) return options.map(o => o.name)
  return options.filter(o => o.name.toLowerCase().includes(q) || o.sciName.toLowerCase().includes(q)).map(o => o.name)
}

/** Every lowercased code any REAL_INDEX row carries. */
const FIXTURE_CODES = new Set(REAL_INDEX.flatMap(r => alphaCodesForName(TABLE, r.name).map(c => c.toLowerCase())))
/** The picker sees the list in taxonomic order (the order it is handed). */
const PICKER_OPTIONS = [...REAL_INDEX]

describe('named non-code queries are unchanged (QA-17)', () => {
  const QUERIES = ['teal', 'duck', 'gull', 'hawk', 'tern', 'rail', 'loon', 'owl', 'jay', 'calypte', 'warbler', 'a', '', '   ']

  it('the fixture is real and large enough', () => {
    expect(REAL_INDEX.length).toBeGreaterThanOrEqual(200)
    for (const q of QUERIES) expect(FIXTURE_CODES.has(q.trim().toLowerCase()), q).toBe(false)
  })

  it.each(QUERIES.map(q => [JSON.stringify(q), q] as const))('%s', (_label, q) => {
    const today = todaySearch(REAL_INDEX, q)
    const now = buildPaletteRows({ items: DEFAULT_ITEMS, index: REAL_INDEX, query: q, alphaCodes: TABLE })
    expect(now.rows.slice(0, now.destinationCount).map(r => (r.kind === 'tab' ? r.label : ''))).toEqual(today.destinations)
    expect(speciesOf(now)).toEqual(today.species)
    expect(now.speciesTruncated).toBe(today.truncated)
    // Enter's target: Search takes rows[0]; a picker its first species row.
    const enter = now.rows[0]
    expect(enter && (enter.kind === 'species' ? enter.name : enter.kind === 'tab' ? enter.label : '')).toBe(today.destinations[0] ?? today.species[0])
    expect(pickerRows(TABLE, PICKER_OPTIONS, q)).toEqual(todayPicker(PICKER_OPTIONS, q))
  })

  it('`calypte` still finds Anna\'s Hummingbird by scientific name', () => {
    expect(speciesOf(buildPaletteRows({ items: DEFAULT_ITEMS, index: REAL_INDEX, query: 'calypte', alphaCodes: TABLE }))).toContain("Anna's Hummingbird")
  })
})

describe('the non-code invariant over a generated corpus (QA-18)', () => {
  it('with no listed row carrying the query as a code, output with the table equals output without it', { timeout: 120_000 }, () => {
    const corpus = new Set<string>()
    const letters = 'abcdefghijklmnopqrstuvwxyz '
    for (const a of letters) {
      corpus.add(a)
      for (const b of letters) {
        corpus.add(a + b)
        for (const c of letters) corpus.add(a + b + c)
      }
    }
    for (const value of Object.values(TABLE.codes)) {
      if (value) for (const code of value.split(' ')) corpus.add(code.toLowerCase())
    }
    // Single-position edits of 20 real names over a wide alphabet: the
    // characters names are built from plus the whitespace and letters that
    // break naive implementations, each written as an escape.
    const wide = ['a', 'e', 'z', ' ', '-', "'", '(', ')', '/', '\u00A0', '\u3000', '\u00DC', '\u00FC', '\u2019', '\t']
    for (const { name } of REAL_INDEX.slice(0, 20)) {
      for (let i = 0; i < name.length; i++) {
        corpus.add(name.slice(0, i) + name.slice(i + 1))
        for (const ch of wide) corpus.add(name.slice(0, i) + ch + name.slice(i + 1))
      }
    }

    let codes = 0
    let nonCodes = 0
    for (const query of corpus) {
      const q = query.trim().toLowerCase()
      if (FIXTURE_CODES.has(q)) { codes += 1; continue }
      nonCodes += 1
      const withTable = buildPaletteRows({ items: DEFAULT_ITEMS, index: REAL_INDEX, query, alphaCodes: TABLE })
      const without = buildPaletteRows({ items: DEFAULT_ITEMS, index: REAL_INDEX, query, alphaCodes: null })
      if (JSON.stringify(withTable) !== JSON.stringify(without)) expect(withTable, `Search, ${JSON.stringify(query)}`).toEqual(without)
      const pickWith = pickerRows(TABLE, PICKER_OPTIONS, query)
      const pickWithout = pickerRows(null, PICKER_OPTIONS, query)
      if (pickWith.join('\n') !== pickWithout.join('\n')) expect(pickWith, `picker, ${JSON.stringify(query)}`).toEqual(pickWithout)
    }
    // Non-vacuity: both kinds really occurred, at scale.
    expect(corpus.size).toBeGreaterThan(30_000)
    expect(codes).toBeGreaterThan(100)
    expect(nonCodes).toBeGreaterThan(30_000)
  })

  it('and a code query DOES change the output (guards the row above)', () => {
    // Without this, a table that never reached the ranking would pass the
    // corpus row trivially. Some fixture code must re-rank or add a row.
    const changed = [...FIXTURE_CODES].filter(c =>
      JSON.stringify(buildPaletteRows({ items: DEFAULT_ITEMS, index: REAL_INDEX, query: c, alphaCodes: TABLE }))
        !== JSON.stringify(buildPaletteRows({ items: DEFAULT_ITEMS, index: REAL_INDEX, query: c, alphaCodes: null })))
    expect(changed.length).toBeGreaterThan(100)
  })
})

describe('hostile queries (QA-37, NFR-08)', () => {
  const HOSTILE = ['__proto__', 'constructor', 'toString', 'valueOf', 'hasOwnProperty']

  it.each([
    ['a fixture that contains those names', [...HOSTILE, 'Yellow-rumped Warbler']],
    ['a fixture that lacks them', ['Yellow-rumped Warbler', 'American Robin']],
  ])('%s: no code group, and exactly today\'s rows', (_label, names) => {
    const index = speciesIndexOf(names)
    for (const q of HOSTILE) {
      const now = buildPaletteRows({ items: DEFAULT_ITEMS, index, query: q, alphaCodes: TABLE })
      expect(speciesOf(now), q).toEqual(todaySearch(index, q).species)
      expect(pickerRows(TABLE, index, q), q).toEqual(todayPicker(index, q))
    }
    // And a real code still works beside them (QA-36's other half).
    expect(speciesOf(searchRows(TABLE, names, 'yrwa'))).toEqual(['Yellow-rumped Warbler'])
  })
})

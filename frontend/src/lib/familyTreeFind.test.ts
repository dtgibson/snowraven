/// <reference types="node" />
// Find on the Family Tree tab (family-rollups-and-tree schema 12; QA-61 to
// QA-63, and its row of the linearity declaration, T7). The roster is every
// species in the committed asset, read when the test runs.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { fullRosterModel, readFamilyIndex } from '../test/familyTreeCorpus'
import { FIND_OPTIONS_MAX, FIND_QUERY_MAX, buildFindIndex, findMatches, findWork, leadIsScientific, type FindRow } from './familyTreeFind'
import { matchesSpeciesQuery, normalizeSpeciesQuery } from './speciesMatch'
import type { AlphaCodeTable } from './alphaCodes'
import type { NamesState } from './familyTreeNames'

const INDEX = readFamilyIndex()
const MODEL = fullRosterModel(INDEX)
const IDX = buildFindIndex(MODEL, INDEX)
const TABLE = JSON.parse(readFileSync(new URL('../assets/ebird-alpha-codes.json', import.meta.url), 'utf8')) as AlphaCodeTable
const STATES: NamesState[] = ['common', 'scientific', 'both']

/** The bucket a row lands in, re-derived independently of the module. */
function bucketOf(r: FindRow, q: string, names: NamesState, codeHit: boolean): number {
  if (codeHit) return 0
  const sci = leadIsScientific(r, names)
  const lead = sci ? r.scientificLc : r.commonLc
  const other = sci ? r.commonLc : r.scientificLc
  if (lead.includes(q)) {
    const words = [0]
    for (let i = 0; i < lead.length; i++) if (lead[i] === ' ' || lead[i] === '-') words.push(i + 1)
    return words.some(w => lead.startsWith(q, w)) ? 1 : 2
  }
  return other.includes(q) ? 3 : -1
}

describe('the index (schema 12)', () => {
  it('holds every level, species first, each in taxonomic sequence', () => {
    const levels = IDX.rows.map(r => r.level)
    const counts = { species: 0, family: 0, genus: 0, order: 0 }
    for (const l of levels) counts[l]++
    expect(counts.species).toBe(MODEL.seen.species)
    expect(counts.order).toBe(MODEL.orders.length)
    expect(levels.indexOf('family')).toBe(counts.species)
    expect(levels.lastIndexOf('species')).toBe(counts.species - 1)
    const seqs = IDX.rows.filter(r => r.level === 'species').map(r => r.ref)
    for (let i = 1; i < seqs.length; i++) expect(seqs[i]).toBeGreaterThan(seqs[i - 1])
  })
})

describe('the match (FR-65, QA-61)', () => {
  it('species: the same set as the shipped predicate, in both directions, wherever the cap does not bind', () => {
    const queries = ['snowcock', 'xantus', 'wren-babbler', 'grebe', 'antpitta', 'loon', 'ptarmigan', 'kiwi', 'falcated', 'zz-none']
    let compared = 0
    for (const raw of queries) {
      const q = normalizeSpeciesQuery(raw)
      const want = IDX.rows.filter(r => r.level === 'species' && matchesSpeciesQuery({ name: r.common ?? '', sciName: r.scientific ?? '' }, q))
      const any = IDX.rows.filter(r => r.commonLc.includes(q) || r.scientificLc.includes(q))
      if (any.length >= FIND_OPTIONS_MAX) continue
      compared++
      for (const names of STATES) {
        const got = findMatches(IDX, raw, names, null).filter(r => r.level === 'species')
        expect(new Set(got)).toEqual(new Set(want))
      }
    }
    expect(compared).toBeGreaterThanOrEqual(6)
  })
  it('both names match in every Names state, at every level', () => {
    const fam = IDX.rows.find(r => r.level === 'family')!
    const ord = IDX.rows.find(r => r.level === 'order')!
    for (const names of STATES) {
      expect(findMatches(IDX, fam.scientific!, names, null)).toContain(fam)
      expect(findMatches(IDX, fam.common!, names, null)).toContain(fam)
      expect(findMatches(IDX, ord.scientific!, names, null)).toContain(ord)
    }
  })
  it('reaches the last species in sequence', () => {
    const last = IDX.rows.filter(r => r.level === 'species' && !r.unplaced).at(-1)!
    expect(findMatches(IDX, last.common!, 'both', null)).toContain(last)
  })
  it('a four-letter code finds its species first', () => {
    const r = IDX.rows.find(x => x.common === 'Mallard')!
    const got = findMatches(IDX, 'mall', 'both', TABLE)
    expect(got[0]).toBe(r)
  })
  it('the query is cut to FIND_QUERY_MAX inside the function', () => {
    const long = `${'a'.repeat(FIND_QUERY_MAX)}${'b'.repeat(500)}`
    expect(findMatches(IDX, long, 'both', null)).toEqual(findMatches(IDX, 'a'.repeat(FIND_QUERY_MAX), 'both', null))
    expect(findMatches(IDX, '   ', 'both', null)).toEqual([])
  })
})

describe('the rank (QA-62)', () => {
  it('buckets never go backwards: code hits, a word start, elsewhere in the leading name, the other name only', () => {
    let rows = 0
    for (const raw of ['war', 'an', 'ida', 'grebe', 'pass', 'mall', 'orn']) {
      for (const names of STATES) {
        const q = normalizeSpeciesQuery(raw)
        const got = findMatches(IDX, raw, names, null)
        expect(got.length).toBeLessThanOrEqual(FIND_OPTIONS_MAX)
        let prev = 0
        for (const r of got) {
          const b = bucketOf(r, q, names, false)
          expect(b).toBeGreaterThanOrEqual(prev)
          prev = b
          rows++
        }
      }
    }
    expect(rows).toBeGreaterThan(200)
  })
  it('a match on the leading name ranks ahead of a match on the other name only', () => {
    // "anas" leads in Scientific for the dabbling ducks and is the other name in Common.
    const sci = findMatches(IDX, 'anas', 'scientific', null)
    const com = findMatches(IDX, 'anas', 'common', null)
    expect(sci.length).toBeGreaterThan(0)
    expect(bucketOf(sci[0], 'anas', 'scientific', false)).toBeLessThan(3)
    expect(com.every((r, i) => i === 0 || bucketOf(r, 'anas', 'common', false) >= bucketOf(com[i - 1], 'anas', 'common', false))).toBe(true)
  })
})

describe('the work (schema 12, T7)', () => {
  it('at most two haystack reads per row per keystroke, and no sort or RegExp in the module', () => {
    for (const raw of ['a', 'wa', 'warbler', 'zzzz', 'x'.repeat(64)]) {
      findWork.reads = 0
      findMatches(IDX, raw, 'both', TABLE)
      expect(findWork.reads).toBeGreaterThan(0)
      expect(findWork.reads).toBeLessThanOrEqual(2 * IDX.rows.length)
    }
    const src = readFileSync(fileURLToPath(new URL('./familyTreeFind.ts', import.meta.url)), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !l.trimStart().startsWith('//')).join('\n')
    expect(src).not.toMatch(/new RegExp|\.sort\(/)
    expect(src).toMatch(/export function findMatches/)
  })
})

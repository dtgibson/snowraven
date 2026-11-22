/// <reference types="node" />
// The Family Tree scope passes (family-rollups-and-tree schema section 5;
// QA-18, QA-19, QA-22, QA-26, QA-29), held by OUTPUT EQUALITY against Life
// Lists' own functions over a generated corpus, never by typed-in totals
// (NFR-14). The two places the module restates a Life Lists rule (the year
// list's four gates and a checklist's region membership) each owe their
// symmetric difference in both directions (testing.md v1.0.32), and each is
// asserted here both ways. The file-scoped absence guard keeps the module's
// reads hand loops and Map operations.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { deriveFirstAssets, deriveFirstSightings } from './lifeLists'
import { deriveRegionAssets, deriveRegionIndex, lookupTier, regionAssets, type RegionRef } from './lifeListsRegion'
import {
  YEAR_OPTIONS_MAX, cellsInRegion, deriveScope, deriveYearColumns, newYearCache, scopeNames,
  type ScopeBase,
} from './familyTreeScope'
import { generateCorpus, obsRow, readFamilyIndex, speciesNames } from '../test/familyTreeCorpus'
import type { ObservationEntry } from '../types'
import type { MLExportRow } from './parseMLExport'

const INDEX = readFamilyIndex()
const SPECIES = speciesNames(INDEX)
const { obs: OBS, ml: ML } = generateCorpus(7, SPECIES)

function baseOf(obs: readonly ObservationEntry[], ml: readonly MLExportRow[] | null): ScopeBase {
  return { observations: obs, mlRows: ml, firsts: deriveFirstSightings(obs), index: deriveRegionIndex(obs), columns: deriveYearColumns(obs, ml) }
}
const BASE = baseOf(OBS, ML)

function allRegions(base: ScopeBase): RegionRef[] {
  const c = base.index.choices
  return [...c.countries, ...c.states, ...c.counties].map(x => x.region)
}
const REGIONS = allRegions(BASE)
const sorted = (s: Iterable<string>) => [...s].sort()

describe('the corpus can discriminate', () => {
  it('spans regions at all three levels, several years, and every row shape', () => {
    expect(BASE.index.choices.countries.length).toBeGreaterThan(2)
    expect(BASE.index.choices.states.length).toBeGreaterThan(2)
    expect(BASE.index.choices.counties.length).toBeGreaterThan(2)
    expect(BASE.columns.years.length).toBeGreaterThan(3)
    expect(BASE.columns.nsRow.length).toBeGreaterThan(10)
  })
})

describe('the roster is Life Lists\' own derivation (QA-18)', () => {
  it('at Everywhere and all years it is the keys of pass 1', () => {
    expect(sorted(scopeNames(BASE, null, null, null))).toEqual(sorted(deriveFirstSightings(OBS).keys()))
  })
  it('under every region at all years it is the keys of that region\'s pass 1R tier', () => {
    const index = deriveRegionIndex(OBS)
    for (const r of REGIONS) expect(sorted(scopeNames(BASE, r, null, null)), JSON.stringify(r)).toEqual(sorted(lookupTier(index.firsts, r)?.keys() ?? []))
  })
  it('a form and its parent are one species; a spuh, slash or hybrid is none; an undated species is absent', () => {
    const obs = [
      obsRow('Dark-eyed Junco (Oregon)', '2020-01-01', 'S1'), obsRow('Dark-eyed Junco', '2020-01-02', 'S2'),
      obsRow('gull sp.', '2020-01-03', 'S3'), obsRow('Cackling/Canada Goose', '2020-01-03', 'S3'),
      obsRow('Mallard x American Black Duck (hybrid)', '2020-01-03', 'S3'), obsRow('Snow Goose', 'undated', 'S4'),
    ]
    expect(sorted(scopeNames(baseOf(obs, null), null, null, null))).toEqual(['Dark-eyed Junco'])
  })
})

describe('the year roster (QA-19)', () => {
  it('under a year is the species with a countable, validly dated row in that year, at every region tier', () => {
    for (const y of BASE.columns.years) {
      const rows = OBS.filter(o => o.date.startsWith(String(y)) && o.date.length === 10)
      expect(sorted(scopeNames(BASE, null, y, null)), String(y)).toEqual(sorted(deriveFirstSightings(rows).keys()))
      const idx = deriveRegionIndex(rows)
      for (const r of REGIONS) {
        expect(sorted(scopeNames(BASE, r, y, newYearCache(y))), `${y} ${JSON.stringify(r)}`).toEqual(sorted(lookupTier(idx.firsts, r)?.keys() ?? []))
      }
    }
  })
  it('the union over every year equals the all-years roster, for every region tier', () => {
    const union = (r: RegionRef | null) => {
      const out = new Set<string>()
      for (const y of BASE.columns.years) for (const n of scopeNames(BASE, r, y, null)) out.add(n)
      return sorted(out)
    }
    // The corpus's one year-0000 row is the stated exception below: its
    // species is dated in a real year at the same place too, so the union holds.
    expect(union(null)).toEqual(sorted(scopeNames(BASE, null, null, null)))
    for (const r of REGIONS) expect(union(r), JSON.stringify(r)).toEqual(sorted(scopeNames(BASE, r, null, null)))
  })
  it('the stated limit: a species dated only 0000-01-01 is on the all-years roster and on no year\'s (schema 5.2)', () => {
    const b = baseOf([obsRow('Snow Goose', '0000-01-01', 'S1')], null)
    expect(sorted(scopeNames(b, null, null, null))).toEqual(['Snow Goose'])
    expect(b.columns.years).toEqual([])
  })
})

describe('the year list (QA-29), both directions', () => {
  it('every offered year has a non-empty Everywhere roster, and every year with one is offered', () => {
    for (const y of BASE.columns.years) expect(scopeNames(BASE, null, y, null).size, String(y)).toBeGreaterThan(0)
    const withRoster = new Set<number>()
    for (const o of OBS) {
      const y = Number(o.date.slice(0, 4))
      if (!Number.isInteger(y) || y === 0) continue
      if (deriveFirstSightings([o]).size > 0) withRoster.add(y)
    }
    expect(new Set(BASE.columns.years)).toEqual(withRoster)
  })
  it('the seam\'s own failure return first: no rows, no years', () => {
    expect(deriveYearColumns([], null).years).toEqual([])
  })
  it('newest first, capped at YEAR_OPTIONS_MAX', () => {
    const many: ObservationEntry[] = []
    for (let y = 1700; y < 1700 + YEAR_OPTIONS_MAX + 20; y++) many.push(obsRow('Snow Goose', `${y}-05-05`, `S${y}`))
    const years = deriveYearColumns(many, null).years
    expect(years).toHaveLength(YEAR_OPTIONS_MAX)
    expect(years[0]).toBe(1700 + YEAR_OPTIONS_MAX + 19)
    for (let i = 1; i < years.length; i++) expect(years[i]).toBeLessThan(years[i - 1])
  })
})

describe('media in scope (QA-22)', () => {
  const kinds = ['Photo', 'Audio', 'Video'] as const
  const hasKind = (t: ReadonlyMap<string, Uint32Array> | null, k: number) => sorted([...(t ?? new Map()).entries()].filter(([, v]) => v[k] > 0).map(([n]) => n))

  it('at Everywhere and all years, has-a-kind equals Life Lists\' first-asset key set, by kind', () => {
    const t = deriveScope(BASE, null, null, null).tallies
    const assets = deriveFirstAssets(ML)
    kinds.forEach((f, k) => expect(hasKind(t, k), f).toEqual(sorted([...assets].filter(([, a]) => a[f] !== undefined).map(([n]) => n))))
  })
  it('under every region, has-a-kind equals Life Lists\' regional asset key set, by kind (cellsInRegion, one direction and the other)', () => {
    const idx = deriveRegionAssets(ML, BASE.index.join)
    for (const r of REGIONS) {
      const t = deriveScope(BASE, r, null, null).tallies
      const assets = regionAssets(idx, r, ML)
      kinds.forEach((f, k) => expect(hasKind(t, k), `${f} ${JSON.stringify(r)}`).toEqual(sorted([...assets].filter(([, a]) => a[f] !== undefined).map(([n]) => n))))
    }
  })
  it('an item with no checklist, or one the backup does not hold, counts only under Everywhere', () => {
    const obs = [obsRow('Snow Goose', '2021-04-04', 'S1', { stateProvince: 'US-CA', county: 'Marin' })]
    const ml = [
      { ...mlOf('Snow Goose', 'Photo', '2021-04-04', 'S1') },
      { ...mlOf('Snow Goose', 'Audio', '2021-04-04', '') },
      { ...mlOf('Snow Goose', 'Video', '2021-04-04', 'S999') },
    ]
    const b = baseOf(obs, ml)
    expect([...deriveScope(b, null, null, null).tallies!.get('Snow Goose')!]).toEqual([1, 1, 1])
    expect([...deriveScope(b, { level: 'state', code: 'US-CA' }, null, null).tallies!.get('Snow Goose')!]).toEqual([1, 0, 0])
  })
  it('a photo inside a county and audio outside it: under the county, photo and no audio', () => {
    const obs = [
      obsRow('Snow Goose', '2021-04-04', 'S1', { stateProvince: 'US-CA', county: 'Marin' }),
      obsRow('Snow Goose', '2021-04-05', 'S2', { stateProvince: 'US-CA', county: 'Sonoma' }),
    ]
    const ml = [mlOf('Snow Goose', 'Photo', '2021-04-04', 'S1'), mlOf('Snow Goose', 'Audio', '2021-04-05', 'S2')]
    const t = deriveScope(baseOf(obs, ml), { level: 'county', code: 'US-CA', county: 'Marin' }, null, null).tallies!
    expect([...t.get('Snow Goose')!]).toEqual([1, 0, 0])
  })
  it('under a year only items dated in it count; an undated ML row counts nowhere', () => {
    const obs = [obsRow('Snow Goose', '2021-04-04', 'S1')]
    const ml = [mlOf('Snow Goose', 'Photo', '2020-04-04', 'S1'), mlOf('Snow Goose', 'Audio', '2021-04-04', 'S1'), mlOf('Snow Goose', 'Video', '', 'S1')]
    const b = baseOf(obs, ml)
    expect([...deriveScope(b, null, 2021, null).tallies!.get('Snow Goose')!]).toEqual([0, 1, 0])
    expect([...deriveScope(b, null, null, null).tallies!.get('Snow Goose')!]).toEqual([1, 1, 0])
  })
  it('without a readable export there are no tallies', () => {
    expect(deriveScope(baseOf(OBS, null), null, null, null).tallies).toBeNull()
  })
})

describe('cellsInRegion against Life Lists\' tier insertion, both directions', () => {
  it('a checklist is inside a region exactly when pass 2R would place its asset there', () => {
    let inside = 0
    let outside = 0
    for (const [sub, cells] of BASE.index.join) {
      const one = [mlOf('Snow Goose', 'Photo', '2021-01-01', sub)]
      const tiers = deriveRegionAssets(one, BASE.index.join)
      for (const r of REGIONS) {
        const placed = (lookupTier(tiers, r)?.size ?? 0) > 0
        expect(cellsInRegion(cells, r), `${sub} ${JSON.stringify(r)}`).toBe(placed)
        if (placed) inside += 1
        else outside += 1
      }
    }
    expect(inside).toBeGreaterThan(20)
    expect(outside).toBeGreaterThan(20)
  })
})

describe('not single species (QA-26)', () => {
  it('counts distinct non-countable names in scope, following Region and Year', () => {
    const obs = [
      obsRow('gull sp.', '2020-01-01', 'S1', { stateProvince: 'US-CA', county: 'Marin' }),
      obsRow('gull sp.', '2021-01-01', 'S2', { stateProvince: 'US-NY', county: 'Kings' }),
      obsRow('hawk sp.', '2021-01-01', 'S2', { stateProvince: 'US-NY', county: 'Kings' }),
      obsRow('Snow Goose', '2021-01-01', 'S2', { stateProvince: 'US-NY', county: 'Kings' }),
      obsRow('Cackling/Canada Goose', 'undated', 'S3'),
    ]
    const b = baseOf(obs, null)
    expect(deriveScope(b, null, null, null).notSingleSpecies).toBe(2)
    expect(deriveScope(b, null, 2020, null).notSingleSpecies).toBe(1)
    expect(deriveScope(b, { level: 'state', code: 'US-NY' }, null, null).notSingleSpecies).toBe(2)
    expect(deriveScope(b, { level: 'state', code: 'US-CA' }, 2021, null).notSingleSpecies).toBe(0)
  })
  it('a name past the placement key bound is never counted', () => {
    const obs = [obsRow('x sp.' + ' '.repeat(200) + 'sp.', '2020-01-01', 'S1'), obsRow('gull sp.', '2020-01-01', 'S1')]
    expect(deriveScope(baseOf(obs, null), null, null, null).notSingleSpecies).toBe(1)
  })
})

function mlOf(name: string, format: MLExportRow['format'], date: string, checklistId: string): MLExportRow {
  return {
    catalogId: `ML${Math.random()}`, commonName: name, scientificName: '', format, date, location: '', county: '',
    latitude: null, longitude: null, caption: '', mediaNotes: '', observationDetails: '', ageSex: '',
    behaviors: '', time: '', year: null, month: null, avgRating: null, numRatings: 0, checklistId,
  }
}

// -- The file-scoped absence guard (testing.md v1.0.23) ------------------------

function stripComments(src: string): string {
  const BLOCK_OPEN = '/' + '*'
  const BLOCK_CLOSE = '*' + '/'
  const out: string[] = []
  let inBlock = false
  for (const line of src.split('\n')) {
    let l = line
    if (inBlock) {
      const close = l.indexOf(BLOCK_CLOSE)
      if (close === -1) continue
      inBlock = false
      l = l.slice(close + 2)
    }
    const open = l.indexOf(BLOCK_OPEN)
    if (open !== -1) {
      const close = l.indexOf(BLOCK_CLOSE, open + 2)
      if (close === -1) { inBlock = true; l = l.slice(0, open) }
      else l = l.slice(0, open) + l.slice(close + 2)
    }
    const lineComment = l.indexOf('//')
    if (lineComment !== -1) l = l.slice(0, lineComment)
    out.push(l)
  }
  return out.join('\n')
}

describe('familyTreeScope.ts reads parsed fields through hand loops and Maps only', () => {
  const raw = readFileSync(fileURLToPath(new URL('./familyTreeScope.ts', import.meta.url)), 'utf8')
  const code = stripComments(raw)
  it('holds no regex and none of the search primitives, comments stripped', () => {
    const FORBIDDEN = ['.includes(', '.indexOf(', '.find(', '.filter(', '.match(', '.search(', '.split(', '.replace(', '.test(', '.exec(', 'RegExp']
    for (const f of FORBIDDEN) expect(code, f).not.toContain(f)
  })
  it('the strip is proven: the comments name what the code does not do', () => {
    expect(raw).toContain('no regex and none of the search')
    expect(code).not.toContain('no regex and none of the search')
    expect(code.length).toBeGreaterThan(3000)
  })
  it('reaches no I/O, transport or React (imports)', () => {
    const imports = [...new Set([...code.matchAll(/\bfrom '([^']+)'/g)].map(m => m[1]))].sort()
    expect(imports).toEqual(['../types', './familyTreeAsset', './lifeLists', './lifeListsRegion', './parseMLExport', './speciesUtils'])
  })
  it('holds no literal control or non-ASCII character outside comments', () => {
    const bad: number[] = []
    for (let i = 0; i < code.length; i++) {
      const c = code.charCodeAt(i)
      if ((c < 0x20 && c !== 0x0a && c !== 0x0d) || c > 0x7e) bad.push(c)
    }
    expect(bad).toEqual([])
  })
})

/// <reference types="node" />
// The Life Lists region filter (life-list-region-filter schema sections 2 and
// 7; QA-01 to QA-04, QA-10 to QA-16, QA-25), plus the file-scoped absence guard
// that keeps the module's reads hand loops and Map operations. The tab's own
// rows (QA-05 to QA-09, QA-17 to QA-28) are in LifeListsTab.test.tsx; the
// linearity and bounds rows (QA-31, QA-32) in lifeListsLinearity.test.ts.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { ObservationEntry } from '../types'
import type { MLExportRow } from './parseMLExport'
import {
  STATE_CODE_SCAN_CHARS, deriveFirstAssets, deriveFirstSightings, selectRows,
  type LifeListClassification, type LifeListControls, type LifeListRow, type MediaFormat,
} from './lifeLists'
import {
  COUNTY_CELL_MAX_CHARS, LIFE_LISTS_REGION_SETTING, countryDisplayName, deriveRegionAssets, deriveRegionIndex,
  findChoice, lookupTier, parseStoredRegion, regionAssets, regionFirsts, regionLabel, sameRegion,
  type RegionChoices, type RegionRef,
} from './lifeListsRegion'

// ── Fixture helpers ───────────────────────────────────────────────────────────

function obs(commonName: string, date: string, time: string | null, submissionId: string, extra: Partial<ObservationEntry> = {}): ObservationEntry {
  return {
    submissionId, commonName, scientificName: '', date, location: 'Lake Park', locationId: 'L1',
    latitude: null, longitude: null, county: 'Marin', count: 1, breedingCode: null,
    speciesComments: '', catalogIds: [], time, stateProvince: 'US-CA', ...extra,
  }
}
function ml(commonName: string, format: MediaFormat, date: string, time: string, catalogId: string, checklistId: string, extra: Partial<MLExportRow> = {}): MLExportRow {
  return {
    catalogId, commonName, scientificName: '', format, date, location: 'River Trail', county: 'Dakota',
    latitude: null, longitude: null, caption: '', mediaNotes: '', observationDetails: '', ageSex: '',
    behaviors: '', time, year: null, month: null, avgRating: null, numRatings: 0, checklistId, ...extra,
  }
}
const at = (sp: string | null, county: string | null) => ({ stateProvince: sp, county })

const COUNTRY = (code: string): RegionRef => ({ level: 'country', code })
const STATE = (code: string): RegionRef => ({ level: 'state', code })
const COUNTY = (code: string, county: string): RegionRef => ({ level: 'county', code, county })

const NONE: LifeListClassification = { escapees: new Set(), exotics: new Set() }
const controls = (formats: MediaFormat[] = []): LifeListControls => ({ includeEscapees: false, includeExotics: false, formats: new Set(formats) })

/** The tab's own composition (schema 4.3): regional firsts and assets, the
 *  WORLD asset map as presence. */
function regionalRows(o: ObservationEntry[], m: MLExportRow[], region: RegionRef, formats: MediaFormat[] = [], cls = NONE): LifeListRow[] {
  const index = deriveRegionIndex(o)
  const firsts = regionFirsts(index, region, o) ?? new Map()
  const assets = regionAssets(deriveRegionAssets(m, index.join), region, m)
  return selectRows(firsts, assets, cls, controls(formats), deriveFirstAssets(m))
}
const names = (rows: readonly LifeListRow[]) => rows.map(r => r.name)
const choiceRefs = (c: RegionChoices) => ({
  countries: c.countries.map(x => x.region), states: c.states.map(x => x.region), counties: c.counties.map(x => x.region),
})

// ── Choices (FR-01 to FR-04) ──────────────────────────────────────────────────

describe('region choices come from eligible observations only (FR-01, QA-01)', () => {
  it('offers US, US-CA and Marin, and nothing for a spuh-only state or an undated-only state', () => {
    const c = deriveRegionIndex([
      obs('Spotted Towhee', '2021-03-02', '7:05 AM', 'S1', at('US-CA', 'Marin')),
      obs('gull sp.', '2021-03-02', '7:05 AM', 'S2', at('US-NV', 'Clark')),
      obs('Spotted Towhee', '', null, 'S3', at('US-OR', 'Lane')),
    ]).choices
    expect(choiceRefs(c)).toEqual({ countries: [COUNTRY('US')], states: [STATE('US-CA')], counties: [COUNTY('US-CA', 'Marin')] })
    expect(c.total).toBe(3)
  })

  it('a row with no checklist id offers nothing, as it establishes no first sighting', () => {
    expect(deriveRegionIndex([obs('Spotted Towhee', '2021-03-02', null, '', at('US-CA', 'Marin'))]).choices.total).toBe(0)
  })
})

describe('levels and county identity (FR-02, QA-02)', () => {
  it('a hyphenated cell with a county yields all three levels', () => {
    const c = deriveRegionIndex([obs('Wrentit', '2020-01-01', null, 'S1', at('US-CA', 'Marin'))]).choices
    expect(choiceRefs(c)).toEqual({ countries: [COUNTRY('US')], states: [STATE('US-CA')], counties: [COUNTY('US-CA', 'Marin')] })
  })

  it('a cell with no hyphen is a country only, and its county is never offered under it', () => {
    const c = deriveRegionIndex([obs('Barbary Partridge', '2020-01-01', null, 'S1', at('GI', 'Marin'))]).choices
    expect(choiceRefs(c)).toEqual({ countries: [COUNTRY('GI')], states: [], counties: [] })
  })

  it('two counties with one name in two states are two choices', () => {
    const c = deriveRegionIndex([
      obs('Wrentit', '2020-01-01', null, 'S1', at('US-CA', 'Orange')),
      obs('Wrentit', '2020-01-02', null, 'S2', at('US-FL', 'Orange')),
    ]).choices
    expect(c.counties.map(x => x.region)).toEqual([COUNTY('US-CA', 'Orange'), COUNTY('US-FL', 'Orange')])
    expect(c.counties.map(x => x.label)).toEqual(['Orange, CA', 'Orange, FL'])
  })

  it('a cell whose country part is empty is no region at all', () => {
    expect(deriveRegionIndex([obs('Wrentit', '2020-01-01', null, 'S1', at('-CA', 'Marin'))]).choices.total).toBe(0)
  })
})

describe('an empty State/Province contributes nothing (FR-03, QA-03)', () => {
  it('no choice at any level, no region, and the species is still on the world list', () => {
    const o = [obs('Wrentit', '2020-01-01', null, 'S1', at('', 'Marin')), obs('Bushtit', '2020-01-01', null, 'S2', at(null, 'Marin'))]
    const index = deriveRegionIndex(o)
    expect(index.choices.total).toBe(0)
    expect(index.join.size).toBe(0)
    expect([...deriveFirstSightings(o).keys()].sort()).toEqual(['Bushtit', 'Wrentit'])
  })
})

describe('grouping, order, labels, de-duplication (FR-04, QA-04)', () => {
  const o = [
    obs('Wrentit', '2020-01-01', null, 'S1', at('US-CA', 'Marin')),
    obs('Bushtit', '2020-01-02', null, 'S2', at('US-CA', 'Marin')),
    obs('Wrentit', '2020-01-03', null, 'S3', at('MX-BCN', '')),
    obs('Wrentit', '2020-01-04', null, 'S4', at('CA-ON', 'Ottawa')),
    obs('Wrentit', '2020-01-05', null, 'S5', at('XZ', null)),
  ]
  const c = deriveRegionIndex(o).choices

  it('labels a country by its English name, and a code the engine cannot name as itself', () => {
    expect(c.countries.map(x => [x.region.code, x.label])).toEqual([
      ['CA', 'Canada'], ['MX', 'Mexico'], ['US', 'United States'], ['XZ', 'XZ'],
    ])
  })

  it('orders the country group by the displayed names, not the codes', () => {
    // By code, US would precede XZ and CA would lead either way; MX before US
    // holds both ways. What only the label order does: "Canada" < "Mexico" <
    // "United States" < "XZ", which a code sort gives as CA, MX, US, XZ too, so
    // pin a pair the two orders disagree on.
    const d = deriveRegionIndex([
      obs('Wrentit', '2020-01-01', null, 'S1', at('DE', null)),     // Germany
      obs('Wrentit', '2020-01-01', null, 'S2', at('AT', null)),     // Austria
      obs('Wrentit', '2020-01-01', null, 'S3', at('ES', null)),     // Spain
    ]).choices
    expect(d.countries.map(x => x.label)).toEqual(['Austria', 'Germany', 'Spain'])
    const e = deriveRegionIndex([obs('Wrentit', '2020-01-01', null, 'S1', at('CH', null)), obs('Wrentit', '2020-01-01', null, 'S2', at('DE', null))]).choices
    expect(e.countries.map(x => x.region.code)).toEqual(['DE', 'CH'])   // Germany before Switzerland
  })

  it('labels a state by the offline name where known and the code otherwise, a county "County, ST"', () => {
    expect(c.states.map(x => x.label)).toEqual(['California', 'MX-BCN', 'Ontario'])
    expect(c.counties.map(x => x.label)).toEqual(['Marin, CA', 'Ottawa, ON'])
  })

  it('two observations in one county give one choice', () => {
    expect(c.counties.filter(x => x.region.level === 'county' && x.region.county === 'Marin')).toHaveLength(1)
    expect(c.total).toBe(c.countries.length + c.states.length + c.counties.length)
  })

  it('a state cell spelled like a prototype member labels as its code, never an inherited value', () => {
    for (const sp of ['US-constructor', 'US-__proto__', 'CA-toString', 'US-hasOwnProperty']) {
      expect(regionLabel(STATE(sp)), sp).toBe(sp)
    }
  })
})

// ── Country names (schema 2.7) ────────────────────────────────────────────────

describe('country names through Intl.DisplayNames, display only (D-03, schema 2.7)', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.resetModules() })

  it('names US and CA, and keeps a well-formed but unnamed code as itself', () => {
    expect(countryDisplayName('US')).toBe('United States')
    expect(countryDisplayName('CA')).toBe('Canada')
    expect(countryDisplayName('XZ')).toBe('XZ')
  })

  it('a malformed code labels as itself with no throw, and a lowercase code never takes a name', () => {
    for (const code of ['U', 'USA1', 'ABCDEFGHIJKLMNOP', 'us', '001', 'U$']) {
      expect(() => countryDisplayName(code), code).not.toThrow()
      expect(countryDisplayName(code), code).toBe(code)
    }
  })

  it('a throwing .of keeps the code', async () => {
    vi.resetModules()
    vi.spyOn(Intl.DisplayNames.prototype, 'of').mockImplementation(() => { throw new RangeError('nope') })
    const m = await import('./lifeListsRegion')
    expect(m.countryDisplayName('US')).toBe('US')
  })

  it('with no usable Intl.DisplayNames every country labels as its code, and the index still builds', async () => {
    vi.resetModules()
    vi.stubGlobal('Intl', { ...Intl, DisplayNames: function Broken() { throw new TypeError('no DisplayNames') } })
    const m = await import('./lifeListsRegion')
    const c = m.deriveRegionIndex([obs('Wrentit', '2020-01-01', null, 'S1', at('US-CA', 'Marin'))]).choices
    expect(c.countries.map(x => x.label)).toEqual(['US'])
    expect(c.states.map(x => x.label)).toEqual(['California'])
  })

  it('the memo answers a repeated code without a second lookup, and states and counties never look one up', async () => {
    vi.resetModules()
    const of = vi.spyOn(Intl.DisplayNames.prototype, 'of')
    const m = await import('./lifeListsRegion')
    expect(m.regionLabel(STATE('US-CA'))).toBe('California')
    expect(m.regionLabel(COUNTY('US-CA', 'Marin'))).toBe('Marin, CA')
    expect(of).not.toHaveBeenCalled()
    const o = [obs('Wrentit', '2020-01-01', null, 'S1', at('US-CA', 'Marin')), obs('Bushtit', '2020-01-01', null, 'S2', at('US-NV', 'Clark'))]
    m.deriveRegionIndex(o)
    expect(of).toHaveBeenCalledTimes(1)
    m.deriveRegionIndex(o)
    expect(m.countryDisplayName('US')).toBe('United States')
    expect(of).toHaveBeenCalledTimes(1)
  })

  it('the name never reaches identity: the choice and the stored shape carry the code', () => {
    const c = deriveRegionIndex([obs('Wrentit', '2020-01-01', null, 'S1', at('US-CA', 'Marin'))]).choices
    expect(JSON.stringify(c.countries[0].region)).toBe('{"level":"country","code":"US"}')
    expect(findChoice(c, COUNTRY('US'))!.label).toBe('United States')
    expect(findChoice(c, COUNTRY('United States'))).toBeNull()
  })
})

// ── The regional first sighting (FR-10 to FR-12) ──────────────────────────────

describe('regional first sightings (FR-10, QA-10)', () => {
  const o = [
    obs('Wrentit', '2019-05-01', '6:00 AM', 'S10', at('US-NV', 'Clark')),
    obs('Wrentit', '2021-03-02', '7:05 AM', 'S20', { ...at('US-CA', 'Marin'), location: 'Point Reyes' }),
    obs('Wrentit', '2022-08-08', '8:00 AM', 'S30', at('US-CA', 'Marin')),
    obs('Bushtit', '2018-01-01', null, 'S40', at('US-CA', 'Sonoma')),
  ]
  const row = (region: RegionRef, n: string) => regionalRows(o, [], region).find(r => r.name === n)

  it('dates the species to its earliest in-region observation, with that time, checklist and place, at every level', () => {
    for (const region of [COUNTY('US-CA', 'Marin'), STATE('US-CA'), COUNTRY('US')]) {
      const r = row(region, 'Wrentit')
      if (region.level === 'country') { expect(r!.day).toBe(20190501); continue }
      expect(r, JSON.stringify(region)).toMatchObject({ day: 20210302, time: '7:05 AM', checklistId: 'S20', location: 'Point Reyes', place: 'Marin, CA' })
    }
  })

  it('never shows the global date in a region where the first was elsewhere; absent where there is none', () => {
    expect(row(STATE('US-NV'), 'Wrentit')!.day).toBe(20190501)
    expect(row(COUNTY('US-CA', 'Sonoma'), 'Wrentit')).toBeUndefined()
    expect(names(regionalRows(o, [], COUNTY('US-CA', 'Marin')))).toEqual(['Wrentit'])
  })

  it('a regional record equals the world record whenever the world first lies in the region', () => {
    // The same constructor and the same order on a subset holding the minimum.
    const world = deriveFirstSightings(o)
    const index = deriveRegionIndex(o)
    expect(regionFirsts(index, STATE('US-NV'), o)!.get('Wrentit')).toEqual(world.get('Wrentit'))
    expect(regionFirsts(index, COUNTY('US-CA', 'Sonoma'), o)!.get('Bushtit')).toEqual(world.get('Bushtit'))
  })

  it('breaks a full tie by the smaller submission id, and an equal id keeps the first row, as pass 1 does', () => {
    const t = [
      obs('Wrentit', '2020-01-01', '7:00 AM', 'S9', { scientificName: 'Chamaea fasciata a' }),
      obs('Wrentit', '2020-01-01', '7:00 AM', 'S10', { scientificName: 'Chamaea fasciata b' }),
      obs('Wrentit', '2020-01-01', '7:00 AM', 'S10', { scientificName: 'Chamaea fasciata c' }),
    ]
    const world = deriveFirstSightings(t).get('Wrentit')!
    expect(world.submissionId).toBe('S10')   // code units: "S10" < "S9"
    expect(regionFirsts(deriveRegionIndex(t), COUNTY('US-CA', 'Marin'), t)!.get('Wrentit')).toEqual(world)
  })

  it('a region the backup does not hold has no slots', () => {
    expect(regionFirsts(deriveRegionIndex(o), STATE('US-CO'), o)).toBeNull()
  })
})

describe('membership is exact on the parsed text (FR-11, QA-11)', () => {
  const o = [obs('Wrentit', '2020-01-01', null, 'S1', at('US-CA', 'Marin')), obs('Bushtit', '2020-01-01', null, 'S2', at('us-ca', 'Marin'))]
  const index = deriveRegionIndex(o)

  it('US-CA is inside US and US-CA and not inside US-CO; "us-ca" is its own region', () => {
    expect([...lookupTier(index.firsts, COUNTRY('US'))!.keys()]).toEqual(['Wrentit'])
    expect([...lookupTier(index.firsts, STATE('US-CA'))!.keys()]).toEqual(['Wrentit'])
    expect(lookupTier(index.firsts, STATE('US-CO'))).toBeUndefined()
    expect([...lookupTier(index.firsts, STATE('us-ca'))!.keys()]).toEqual(['Bushtit'])
  })

  it('a county matches only when both cells equal the pair', () => {
    expect([...lookupTier(index.firsts, COUNTY('US-CA', 'Marin'))!.keys()]).toEqual(['Wrentit'])
    expect(lookupTier(index.firsts, COUNTY('US-NV', 'Marin'))).toBeUndefined()
    expect(lookupTier(index.firsts, COUNTY('US-CA', 'marin'))).toBeUndefined()
  })
})

describe('the binomial and the media marks under a region (FR-12, QA-12)', () => {
  it('the binomial comes from the in-region dating row; the presence cell stays global', () => {
    const o = [
      obs('Wrentit', '2019-01-01', null, 'S1', { ...at('US-OR', 'Lane'), scientificName: 'Chamaea fasciata phaea' }),
      obs('Wrentit', '2021-01-01', null, 'S2', { ...at('US-CA', 'Marin'), scientificName: 'Chamaea fasciata henshawi' }),
    ]
    const m = [ml('Wrentit', 'Photo', '2019-01-01', '0900', '100', 'S1')]
    const [r] = regionalRows(o, m, COUNTY('US-CA', 'Marin'))
    expect(r.scientificName).toBe('Chamaea fasciata')
    expect(r.day).toBe(20210101)
    expect(r.media).toEqual({ photo: true, audio: false, video: false })
    // And the photo, taken in Oregon, admits no Marin photo row.
    expect(regionalRows(o, m, COUNTY('US-CA', 'Marin'), ['Photo'])).toEqual([])
  })
})

// ── The regional media lists (FR-13 to FR-16) ─────────────────────────────────

describe('asset membership by the checklist join (FR-13, QA-13)', () => {
  const o = [obs('Wrentit', '2020-01-01', null, 'S100', at('US-CA', 'Marin')), obs('Wrentit', '2020-01-01', null, 'S200', at('US-NV', 'Clark'))]
  const m = [ml('Wrentit', 'Photo', '2020-01-01', '0900', '1', 'S100', { county: 'Sonoma' })]

  it('is inside Marin, US-CA and US, and outside Sonoma and US-NV, whatever its own County cell says', () => {
    for (const region of [COUNTY('US-CA', 'Marin'), STATE('US-CA'), COUNTRY('US')]) {
      expect(names(regionalRows(o, m, region, ['Photo'])), JSON.stringify(region)).toEqual(['Wrentit'])
    }
    expect(regionalRows(o, m, COUNTY('US-CA', 'Sonoma'), ['Photo'])).toEqual([])
    expect(regionalRows(o, m, STATE('US-NV'), ['Photo'])).toEqual([])
  })

  it("a checklist's cells come from its first eligible row in file order, a spuh-only checklist included", () => {
    const j = deriveRegionIndex([
      obs('gull sp.', '2020-01-01', null, 'S7', at('US-CA', 'Marin')),
      obs('Wrentit', '2020-01-01', null, 'S7', at('US-OR', 'Lane')),
    ]).join
    expect(j.get('S7')).toEqual({ country: 'US', state: 'US-CA', county: 'Marin', hyphenated: true })
  })
})

describe('an unlinked asset counts only unfiltered (FR-14, QA-14)', () => {
  const o = [obs('Wrentit', '2020-01-01', null, 'S100', at('US-CA', 'Marin'))]
  const m = [
    ml('Wrentit', 'Photo', '2018-01-01', '0900', '1', ''),
    ml('Wrentit', 'Photo', '2019-01-01', '0900', '2', 'S999'),
    ml('Wrentit', 'Photo', '2021-01-01', '0900', '3', 'S100'),
  ]

  it('dates the world Photo row and is ignored under every region', () => {
    const world = selectRows(deriveFirstSightings(o), deriveFirstAssets(m), NONE, controls(['Photo']))
    expect(world[0].day).toBe(20180101)
    for (const region of [COUNTY('US-CA', 'Marin'), STATE('US-CA'), COUNTRY('US')]) {
      const [r] = regionalRows(o, m, region, ['Photo'])
      expect(r.day, JSON.stringify(region)).toBe(20210101)
      expect(r.checklistId).toBe('S100')
    }
    expect(regionalRows(o, m.slice(0, 2), COUNTRY('US'), ['Photo'])).toEqual([])
  })
})

describe('regional per-format firsts and their combination (FR-15, QA-15)', () => {
  const o = [
    obs('Wrentit', '2020-01-01', null, 'S1', at('US-CA', 'Marin')),
    obs('Wrentit', '2020-01-01', null, 'S2', at('US-OR', 'Lane')),
    obs('Bushtit', '2020-01-01', null, 'S3', at('US-OR', 'Lane')),
  ]
  const m = [
    ml('Wrentit', 'Photo', '2019-01-01', '0900', '1', 'S2'),
    ml('Wrentit', 'Photo', '2021-05-01', '0900', '2', 'S1'),
    ml('Wrentit', 'Audio', '2022-06-01', '0600', '3', 'S1'),
    ml('Bushtit', 'Photo', '2021-01-01', '0900', '4', 'S1'),
  ]

  it('Photo dates to the earliest in-region photo even when an earlier one exists outside', () => {
    expect(regionalRows(o, m, STATE('US-CA'), ['Photo']).map(r => [r.name, r.day])).toEqual([['Wrentit', 20210501]])
  })

  it('Photo plus Audio lists only species with both in-region, dated to the later first', () => {
    expect(regionalRows(o, m, STATE('US-CA'), ['Photo', 'Audio']).map(r => [r.name, r.day, r.time])).toEqual([['Wrentit', 20220601, '6:00 AM']])
  })

  it('an in-region photo of a species with no in-region sighting admits no row', () => {
    // Bushtit's photo is on S1 (Marin), but Bushtit was only seen in Lane.
    expect(names(regionalRows(o, m, STATE('US-CA'), ['Photo']))).not.toContain('Bushtit')
  })
})

describe('ML geography never decides (FR-16, QA-16)', () => {
  const o = [obs('Wrentit', '2020-01-01', null, 'S1', at('US-CA', 'Marin')), obs('Wrentit', '2020-01-01', null, 'S2', at('US-OR', 'Lane'))]
  const base = ml('Wrentit', 'Photo', '2021-01-01', '0900', '1', 'S1')

  it("changing the row's County, Locality and coordinates changes nothing; changing its checklist does", () => {
    const before = regionalRows(o, [base], COUNTY('US-CA', 'Marin'), ['Photo'])
    const moved = { ...base, county: 'Lane', location: 'Eugene', latitude: 44.05, longitude: -123.09 }
    expect(regionalRows(o, [moved], COUNTY('US-CA', 'Marin'), ['Photo'])).toEqual([{ ...before[0], location: 'Eugene', place: 'Lane' }])
    expect(regionalRows(o, [{ ...base, checklistId: 'S2' }], COUNTY('US-CA', 'Marin'), ['Photo'])).toEqual([])
  })

  it('pass 2R reads no ML geography field (structural)', () => {
    const src = stripComments(readFileSync(fileURLToPath(new URL('./lifeListsRegion.ts', import.meta.url)), 'utf8'))
    const body = src.slice(src.indexOf('export function deriveRegionAssets('), src.indexOf('\n}\n', src.indexOf('export function deriveRegionAssets(')))
    expect(body.length).toBeGreaterThan(500)
    for (const field of ['row.county', 'row.location', 'row.latitude', 'row.longitude']) expect(body, field).not.toContain(field)
  })
})

// ── Bounds and the stored value (schema 2.2, 2.8; FR-25, NFR-04; QA-25) ───────

describe('the cell bounds (schema 2.2, decisions.md D-01)', () => {
  it('a State/Province cell past 16 characters belongs to no region, a 40,000-character one included', () => {
    for (const sp of ['US-' + 'A'.repeat(STATE_CODE_SCAN_CHARS - 2), '-'.repeat(40_000), 'U'.repeat(40_000)]) {
      const index = deriveRegionIndex([obs('Wrentit', '2020-01-01', null, 'S1', at(sp, 'Marin'))])
      expect(index.choices.total, `${sp.length}`).toBe(0)
      expect(index.join.size).toBe(0)
    }
    const ok = 'US-' + 'A'.repeat(STATE_CODE_SCAN_CHARS - 3)
    expect(deriveRegionIndex([obs('Wrentit', '2020-01-01', null, 'S1', at(ok, 'Marin'))]).choices.total).toBe(3)
  })

  it('a County cell past 96 characters reads as no county, a 40,000-character one included', () => {
    for (const county of ['M'.repeat(COUNTY_CELL_MAX_CHARS + 1), 'M'.repeat(40_000)]) {
      const c = deriveRegionIndex([obs('Wrentit', '2020-01-01', null, 'S1', at('US-CA', county))]).choices
      expect(choiceRefs(c), `${county.length}`).toEqual({ countries: [COUNTRY('US')], states: [STATE('US-CA')], counties: [] })
    }
    expect(deriveRegionIndex([obs('Wrentit', '2020-01-01', null, 'S1', at('US-CA', 'M'.repeat(COUNTY_CELL_MAX_CHARS)))]).choices.counties).toHaveLength(1)
  })

  it('every offered region survives the write and read-back round trip, over a generated corpus', () => {
    const cells = ['US', 'US-CA', 'GI', 'CA-ON', 'MX-BCS', 'US-', 'X-Y-Z', 'A'.repeat(16), 'A-' + 'B'.repeat(14), '__proto__', 'US-__proto__']
    const counties = ['', 'Marin', 'Saint Lucie', '__proto__', 'constructor', 'M'.repeat(96), "Prince George's", 'O\u2019Brien']
    const o: ObservationEntry[] = []
    let k = 0
    for (const sp of cells) for (const county of counties) o.push(obs(`Bird ${k}`, '2020-01-01', null, `S${k++}`, at(sp, county)))
    const c = deriveRegionIndex(o).choices
    expect(c.total).toBeGreaterThan(60)
    for (const choice of [...c.countries, ...c.states, ...c.counties]) {
      const back = parseStoredRegion(JSON.parse(JSON.stringify(choice.region)))
      expect(back, JSON.stringify(choice.region)).toEqual(choice.region)
      expect(findChoice(c, back!)).toBe(choice)
    }
  })

  it('a species name and a state cell spelled __proto__ are ordinary keys', () => {
    const o = [obs('__proto__', '2020-01-01', null, 'S1', at('__proto__', 'constructor'))]
    const index = deriveRegionIndex(o)
    expect(index.choices.countries.map(x => x.label)).toEqual(['__proto__'])
    expect([...regionFirsts(index, COUNTRY('__proto__'), o)!.keys()]).toEqual(['__proto__'])
    expect(Object.getPrototypeOf(index.firsts.countries)).toBe(Map.prototype)
  })
})

describe('parseStoredRegion accepts exactly the shape the app writes (FR-25, NFR-04, QA-25)', () => {
  it('reads the three written shapes back', () => {
    expect(parseStoredRegion({ level: 'country', code: 'US' })).toEqual(COUNTRY('US'))
    expect(parseStoredRegion({ level: 'state', code: 'US-CA', county: 'ignored' })).toEqual(STATE('US-CA'))
    expect(parseStoredRegion({ level: 'county', code: 'US-CA', county: 'Marin' })).toEqual(COUNTY('US-CA', 'Marin'))
    expect(parseStoredRegion({ level: 'state', code: 'A'.repeat(16) })).toEqual(STATE('A'.repeat(16)))
    expect(parseStoredRegion({ level: 'county', code: 'US-CA', county: 'M'.repeat(96) })).not.toBeNull()
  })

  it('reads anything else as Everywhere, never throwing', () => {
    const bad: unknown[] = [
      null, undefined, 'US-CA', 7, true, [], ['county', 'US-CA', 'Marin'],
      {}, { level: 'country' }, { code: 'US' }, { level: 'city', code: 'US' }, { level: 'County', code: 'US' },
      { level: 'country', code: '' }, { level: 'country', code: 5 }, { level: 'state', code: 'A'.repeat(17) },
      { level: 'county', code: 'US-CA' }, { level: 'county', code: 'US-CA', county: '' },
      { level: 'county', code: 'US-CA', county: 'M'.repeat(97) }, { level: 'county', code: 'US-CA', county: null },
      JSON.parse('{"__proto__": {"level": "country", "code": "US"}}'),
      JSON.parse('{"level": "constructor", "code": "US"}'),
      JSON.parse('{"level": "__proto__", "code": "US"}'),
      JSON.parse('{"level": "county", "code": "US-CA", "__proto__": {"county": "Marin"}}'),
      Object.create({ level: 'country', code: 'US' }),
    ]
    for (const v of bad) {
      expect(() => parseStoredRegion(v)).not.toThrow()
      expect(parseStoredRegion(v), JSON.stringify(v) ?? String(v)).toBeNull()
    }
  })

  it('a valid stored region absent from the choices matches nothing, so its text never supplies a label', () => {
    const c = deriveRegionIndex([obs('Wrentit', '2020-01-01', null, 'S1', at('US-CA', 'Marin'))]).choices
    expect(findChoice(c, COUNTY('US-CA', 'Sonoma'))).toBeNull()
    expect(findChoice(c, STATE('US-NV'))).toBeNull()
    expect(findChoice(c, COUNTY('US-CA', 'Marin'))!.label).toBe('Marin, CA')
  })

  it('sameRegion compares level and parts', () => {
    expect(sameRegion(null, null)).toBe(true)
    expect(sameRegion(COUNTRY('US'), null)).toBe(false)
    expect(sameRegion(COUNTRY('US'), STATE('US'))).toBe(false)
    expect(sameRegion(COUNTY('US-CA', 'Marin'), COUNTY('US-CA', 'Marin'))).toBe(true)
    expect(sameRegion(COUNTY('US-CA', 'Marin'), COUNTY('US-CA', 'Sonoma'))).toBe(false)
    expect(LIFE_LISTS_REGION_SETTING).toBe('lifeListsRegion')
  })
})

// ── The file-scoped absence guard (schema section 2; testing.md v1.0.23) ─────

/** Drop line and block comments, line-wise (the lifeLists.test.ts shape). */
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

describe('lifeListsRegion.ts reads parsed cells through hand loops and Maps only', () => {
  const raw = readFileSync(fileURLToPath(new URL('./lifeListsRegion.ts', import.meta.url)), 'utf8')
  const code = stripComments(raw)

  it('holds no regex and none of the search primitives, comments stripped', () => {
    const FORBIDDEN = ['.includes(', '.indexOf(', '.find(', '.filter(', '.match(', '.search(', '.split(', '.replace(', '.test(', '.exec(', 'RegExp']
    for (const f of FORBIDDEN) expect(code, f).not.toContain(f)
  })

  it('the strip is proven: the comments name what the code does not do', () => {
    expect(raw).toContain('no regex and none of the search')
    expect(code).not.toContain('no regex and none of the search')
    expect(code.length).toBeGreaterThan(4000)
  })

  it('each file pass is one loop over its rows, with no loop nested inside it', () => {
    for (const fn of ['deriveRegionIndex', 'deriveRegionAssets']) {
      const start = code.indexOf(`export function ${fn}(`)
      const body = code.slice(start, code.indexOf('\n}\n', start))
      expect(body.split('for (').length - 1, fn).toBe(1)
      expect(body, fn).not.toContain('while')
    }
  })

  it('reaches no I/O, transport or React (imports)', () => {
    const imports = [...new Set([...code.matchAll(/\bfrom '([^']+)'/g)].map(m => m[1]))].sort()
    expect(imports).toEqual(['../types', './lifeLists', './parseMLExport', './regionNames', './speciesUtils'])
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

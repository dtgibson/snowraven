/// <reference types="node" />
// The per-day county observations reducer and the route's two parameter
// validators (targets-tab, schema.md sections 4.1 and 4.3; QA-43, QA-72).
//
// Two kinds of evidence, kept apart:
//   1. DELIVERY: the tracked countyDayObs.fixture.json equals what the shipped
//      builders produce from the fixture's own inputs today. The Python twin
//      asserts every row of the same file (backend/tests/test_county_day_obs.py),
//      which is the cross-runtime claim; this keeps the file from drifting from
//      the TypeScript half between regenerations.
//   2. DIRECT ROWS for the properties a fixture row states only implicitly:
//      the dedupe, the wrong-date drop, the record cap, the 502, the boolean
//      coordinate, and a body with two records for one code (schema.md 14.5:
//      eBird's one-per-taxon default is documented, not trusted).
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { REGION_CODE_RE } from './regionCode'
import {
  DAY_OBS_MAX_RECORDS, isRealCalendarDay, isValidDayObsDate, isValidDayRecord, reduceCountyDayObs,
} from './countyDayObsReduce'

const fixture = JSON.parse(readFileSync(new URL('./countyDayObs.fixture.json', import.meta.url), 'utf8')) as {
  regionCode: string
  date: string
  regionRows: { input: string; valid: boolean }[]
  dateRows: { input: string; valid: boolean }[]
  families: { name: string; body: unknown; expected: unknown }[]
  textFamilies: { name: string; bodyText: string; controlText: string; expected: unknown }[]
}

const R = fixture.regionCode
const D = fixture.date

function run(body: unknown): unknown {
  try {
    return reduceCountyDayObs(body, R, D)
  } catch (err) {
    return { error: (err as { status?: number }).status ?? 'throw' }
  }
}

describe('the tracked fixture equals the shipped builders', () => {
  it('is non-vacuous: both verdicts and both outcomes are represented', () => {
    expect(fixture.regionRows.some(r => r.valid)).toBe(true)
    expect(fixture.regionRows.some(r => !r.valid)).toBe(true)
    expect(fixture.dateRows.some(r => r.valid)).toBe(true)
    expect(fixture.dateRows.some(r => !r.valid)).toBe(true)
    expect(fixture.families.some(f => (f.expected as { error?: unknown }).error !== undefined)).toBe(true)
    expect(fixture.families.filter(f => Array.isArray((f.expected as { species?: unknown }).species)).length).toBeGreaterThan(15)
    // The rows the twin rules name, present by value rather than by count.
    const regions = fixture.regionRows.map(r => r.input)
    expect(regions).toContain('US-CA-001\n')
    expect(regions).toContain('US-CA-٠١٢')
    expect(regions).toContain('us-ca-001')
    const dates = fixture.dateRows.map(r => r.input)
    for (const d of ['2026-09-01\n', '2026-02-30', '2026-13-01', '1899-12-31', '2101-01-01', '2024-02-29', '2026-02-29']) {
      expect(dates).toContain(d)
    }
  })

  it.each(fixture.regionRows.map(r => [JSON.stringify(r.input), r] as const))('region %s', (_l, row) => {
    expect(REGION_CODE_RE.test(row.input)).toBe(row.valid)
  })

  it.each(fixture.dateRows.map(r => [JSON.stringify(r.input), r] as const))('date %s', (_l, row) => {
    expect(isValidDayObsDate(row.input)).toBe(row.valid)
  })

  it.each(fixture.families.map(f => [f.name, f] as const))('%s', (_n, fam) => {
    expect(run(fam.body)).toEqual(fam.expected)
  })

  // The TEXT families: eBird's response text, parsed here by JSON.parse as the
  // desktop transport parses it. Structural (CLAUDE.md, "an agreeing wrong
  // number"): the body with the bad element must reduce to exactly what the
  // same body with that element REMOVED reduces to, derived from this
  // runtime's own reducer, and to the fixture's expected. The Python twin
  // asserts the same two equalities from json.loads.
  it('the text families are non-vacuous: each carries an integer literal past the float range', () => {
    expect(fixture.textFamilies.length).toBeGreaterThan(0)
    for (const fam of fixture.textFamilies) {
      expect(fam.bodyText, fam.name).toMatch(/[0-9]{310,}/)
      expect(fam.bodyText).not.toBe(fam.controlText)
      // What the desktop parser makes of it: not a finite number.
      expect(JSON.parse(fam.bodyText)[0].lat, fam.name).toBe(Infinity)
    }
  })

  it.each(fixture.textFamilies.map(f => [f.name, f] as const))('text: %s', (_n, fam) => {
    const got = run(JSON.parse(fam.bodyText))
    expect(got).toEqual(run(JSON.parse(fam.controlText)))
    expect(got).toEqual(fam.expected)
  })

  it('every record the reducer emits passes the cache validator (one shape, one judge)', () => {
    for (const fam of fixture.families) {
      const out = run(fam.body) as { species?: unknown[] }
      for (const r of out.species ?? []) expect(isValidDayRecord(r, D), fam.name).toBe(true)
    }
  })
})

function rec(over: Record<string, unknown> = {}): Record<string, unknown> {
  return { speciesCode: 'linspa', obsDt: `${D} 08:00`, locId: 'L1', locName: 'Marsh', lat: 37.7, lng: -122.2, ...over }
}

describe('direct rows', () => {
  it('keeps the greatest obsDt per species and that record\'s place', () => {
    const out = reduceCountyDayObs([
      rec({ obsDt: `${D} 07:00`, locName: 'A' }),
      rec({ obsDt: `${D} 12:00`, locName: 'B', locId: 'L2', lat: 1, lng: 2 }),
      rec({ obsDt: `${D} 09:00`, locName: 'C' }),
    ], R, D)
    expect(out.species).toEqual([{ speciesCode: 'linspa', obsDt: `${D} 12:00`, locId: 'L2', locName: 'B', lat: 1, lng: 2 }])
  })

  it('a body with two records for one code yields one row (eBird\'s per-taxon default is not trusted)', () => {
    const out = reduceCountyDayObs([rec(), rec({ obsDt: `${D} 08:00`, locName: 'Tie' })], R, D)
    expect(out.species).toHaveLength(1)
    // A tie keeps the first-seen record: only a STRICTLY greater obsDt replaces.
    expect(out.species[0].locName).toBe('Marsh')
  })

  it('drops a record eBird files under another day', () => {
    expect(reduceCountyDayObs([rec({ obsDt: '2026-09-02 01:00' })], R, D).species).toEqual([])
  })

  it('reads at most DAY_OBS_MAX_RECORDS records and ignores the rest', () => {
    const body = Array.from({ length: DAY_OBS_MAX_RECORDS }, (_, i) => rec({ speciesCode: `sp${i}` }))
    body.push(rec({ speciesCode: 'lastone' }))
    const out = reduceCountyDayObs(body, R, D)
    expect(out.species).toHaveLength(DAY_OBS_MAX_RECORDS)
    expect(out.species.some(s => s.speciesCode === 'lastone')).toBe(false)
  })

  it('a body that is not a list is the 502 shape, never an offline-looking throw', () => {
    for (const body of [{}, null, 'x', 1, undefined]) {
      let thrown: unknown = null
      try { reduceCountyDayObs(body, R, D) } catch (err) { thrown = err }
      expect((thrown as { status?: number }).status).toBe(502)
      expect((thrown as { detail?: string }).detail).toBe('Unexpected eBird response.')
    }
  })

  it('a boolean latitude is not a number: the record stays, its coordinates go', () => {
    const out = reduceCountyDayObs([rec({ lat: true })], R, D)
    expect(out.species).toEqual([{ speciesCode: 'linspa', obsDt: `${D} 08:00`, locId: 'L1', locName: 'Marsh', lat: null, lng: null }])
  })

  it('output records carry exactly the six fields', () => {
    const out = reduceCountyDayObs([rec({ comName: 'x', howMany: 3, subId: 'S1' })], R, D)
    expect(Object.keys(out.species[0]).sort()).toEqual(['lat', 'lng', 'locId', 'locName', 'obsDt', 'speciesCode'])
    expect(out.regionCode).toBe(R)
    expect(out.date).toBe(D)
  })

  it('isRealCalendarDay is calendar arithmetic, never Date rollover', () => {
    expect(isRealCalendarDay(2026, 2, 28)).toBe(true)
    expect(isRealCalendarDay(2026, 2, 29)).toBe(false)
    expect(isRealCalendarDay(2024, 2, 29)).toBe(true)
    expect(isRealCalendarDay(1900, 2, 29)).toBe(false)
    expect(isRealCalendarDay(2000, 2, 29)).toBe(true)
    expect(isRealCalendarDay(2026, 4, 31)).toBe(false)
    expect(isRealCalendarDay(2026, 12, 31)).toBe(true)
    expect(isRealCalendarDay(2026, 0, 1)).toBe(false)
    expect(isRealCalendarDay(2026, 1, 0)).toBe(false)
  })

  it('the cache validator refuses what the reducer would never emit', () => {
    expect(isValidDayRecord(rec(), D)).toBe(true)
    expect(isValidDayRecord({ ...rec(), lat: 1, lng: null }, D)).toBe(false)
    expect(isValidDayRecord({ ...rec(), locId: 'X1' }, D)).toBe(false)
    expect(isValidDayRecord({ ...rec(), obsDt: '2026-09-02' }, D)).toBe(false)
    expect(isValidDayRecord({ ...rec(), speciesCode: '__proto__' }, D)).toBe(false)
    expect(isValidDayRecord(JSON.parse('{"__proto__": {"speciesCode": "x"}}'), D)).toBe(false)
    expect(isValidDayRecord(null, D)).toBe(false)
    expect(isValidDayRecord([rec()], D)).toBe(false)
  })
})

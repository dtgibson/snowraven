// County Completeness pure core — FR-07/09/10/11/12/21/22 boundary semantics.

import { describe, it, expect } from 'vitest'
import {
  buildCountyCompletenessLocal, cacheLineText, completenessBand, completenessPercent,
  completenessTargets, computeCompleteness, COMPLETENESS_BANDS, RECENT_NEW_COUNT,
  type CountyEbirdData, type EbirdSpecies,
} from './countyCompleteness'
import { countyKey } from './countyBoundaries'
import type { ObservationEntry } from '../types'

function obs(over: Partial<ObservationEntry>): ObservationEntry {
  return {
    submissionId: 'S1', commonName: 'Canada Goose', scientificName: 'Branta canadensis',
    date: '2026-01-01', location: 'Park', locationId: 'L1', latitude: null, longitude: null,
    county: 'Santa Clara', count: 1, breedingCode: null, speciesComments: '', catalogIds: [],
    stateProvince: 'US-CA',
    ...over,
  }
}

describe('completenessBand — fixed equal-width bands (FR-11)', () => {
  it('is 0 only at ratio ≤ 0 (unshaded)', () => {
    expect(completenessBand(0)).toBe(0)
    expect(completenessBand(-1)).toBe(0)
  })

  it('puts any non-zero ratio in band ≥ 1 (a 1-of-300 county is visibly shaded)', () => {
    expect(completenessBand(1 / 300)).toBe(1)
    expect(completenessBand(0.05)).toBe(1)
  })

  it('band boundaries are (lo, hi]: exactly 10% stays band 1, just above is band 2', () => {
    expect(completenessBand(0.1)).toBe(1)
    expect(completenessBand(0.1000001)).toBe(2)
    expect(completenessBand(0.2)).toBe(2)
    expect(completenessBand(0.3)).toBe(3)   // 0.3 * 10 FP noise must not promote
    expect(completenessBand(0.7)).toBe(7)
    expect(completenessBand(0.9)).toBe(9)
    expect(completenessBand(0.9000001)).toBe(10)
  })

  it('a ~5% county is band 1 and a ~95% county band 10 (QA-10)', () => {
    expect(completenessBand(0.05)).toBe(1)
    expect(completenessBand(0.95)).toBe(10)
  })

  it('full and over-full clamp to band 10', () => {
    expect(completenessBand(1)).toBe(10)
    expect(completenessBand(1.5)).toBe(10)
  })

  it('integer count boundaries land exactly (x/y arithmetic)', () => {
    expect(completenessBand(31 / 310)).toBe(1)   // exactly 10%
    expect(completenessBand(32 / 310)).toBe(2)
    expect(completenessBand(310 / 310)).toBe(10)
  })
})

describe('completenessPercent — FR-10 display rules', () => {
  it('0% only when x = 0', () => {
    expect(completenessPercent(0, 300)).toBe(0)
  })

  it('100% only when truly complete (x ≥ y), including the >100% clamp (QA-09)', () => {
    expect(completenessPercent(300, 300)).toBe(100)
    expect(completenessPercent(305, 300)).toBe(100)
  })

  it('an incomplete county that would round to 100 shows 99', () => {
    expect(completenessPercent(999, 1000)).toBe(99)
    expect(completenessPercent(299, 300)).toBe(99) // 99.67 → rounds 100 → clamp 99
  })

  it('a non-zero county that would round to 0 shows 1', () => {
    expect(completenessPercent(1, 1000)).toBe(1)   // 0.1% → rounds 0 → clamp 1
  })

  it('mid-range values round to the nearest integer', () => {
    expect(completenessPercent(128, 312)).toBe(41)
    expect(completenessPercent(150, 400)).toBe(38) // 37.5 rounds up
  })
})

describe('COMPLETENESS_BANDS legend table (FR-27 / OQ-06)', () => {
  it('is ten fixed equal ranges, 1–10% through 91–100%', () => {
    expect(COMPLETENESS_BANDS).toHaveLength(10)
    expect(COMPLETENESS_BANDS[0]).toEqual({ band: 1, label: '1–10%' })
    expect(COMPLETENESS_BANDS[4]).toEqual({ band: 5, label: '41–50%' })
    expect(COMPLETENESS_BANDS[9]).toEqual({ band: 10, label: '91–100%' })
  })
})

describe('buildCountyCompletenessLocal — X + recent-new from the backup', () => {
  it('counts DISTINCT countable species: spuh/slash/hybrid excluded, subspecies collapsed (FR-07)', () => {
    const local = buildCountyCompletenessLocal([
      obs({ commonName: 'Canada Goose' }),
      obs({ commonName: 'Canada Goose' }),                                // duplicate → 1
      obs({ commonName: 'Song Sparrow (heermanni)', scientificName: 'Melospiza melodia' }),
      obs({ commonName: 'Song Sparrow', scientificName: 'Melospiza melodia' }), // subspecies collapse → 1
      obs({ commonName: 'gull sp.' }),                                    // spuh — never counts
      obs({ commonName: 'Greater/Lesser Scaup' }),                        // slash — never counts
      obs({ commonName: 'Mallard x American Black Duck' }),               // hybrid — never counts
    ])
    const entry = local.get(countyKey('CA', 'Santa Clara'))!
    expect(entry.countableCount).toBe(2)
    expect(new Set(entry.countableNames)).toEqual(new Set(['Canada Goose', 'Song Sparrow']))
  })

  it('keys by the (state, county) composite — same-named counties never merge (FR-12)', () => {
    const local = buildCountyCompletenessLocal([
      obs({ county: 'Washington', stateProvince: 'US-MN', commonName: 'Canada Goose' }),
      obs({ county: 'Washington', stateProvince: 'US-OR', commonName: 'Canada Goose' }),
      obs({ county: 'Washington', stateProvince: 'US-OR', commonName: 'Mallard', scientificName: 'Anas platyrhynchos' }),
    ])
    expect(local.get(countyKey('MN', 'Washington'))!.countableCount).toBe(1)
    expect(local.get(countyKey('OR', 'Washington'))!.countableCount).toBe(2)
  })

  it('skips non-US rows and rows without a county', () => {
    const local = buildCountyCompletenessLocal([
      obs({ stateProvince: 'CA-BC' }),
      obs({ county: null }),
    ])
    expect(local.size).toBe(0)
  })

  it('recentNew ranks by FIRST-in-county date, newest first, capped at 5 (FR-21)', () => {
    const rows: ObservationEntry[] = [
      // Kestrel seen twice — its FIRST county record (March) is its rank date.
      obs({ commonName: 'American Kestrel', scientificName: 'Falco sparverius', date: '2026-03-01' }),
      obs({ commonName: 'American Kestrel', scientificName: 'Falco sparverius', date: '2026-06-20' }),
      obs({ commonName: 'Canada Goose', date: '2026-06-14' }),
      obs({ commonName: 'Mallard', scientificName: 'Anas platyrhynchos', date: '2026-05-31' }),
      obs({ commonName: 'Killdeer', scientificName: 'Charadrius vociferus', date: '2026-05-09' }),
      obs({ commonName: 'Osprey', scientificName: 'Pandion haliaetus', date: '2026-04-25' }),
      obs({ commonName: 'Merlin', scientificName: 'Falco columbarius', date: '2026-04-18' }),
    ]
    const entry = buildCountyCompletenessLocal(rows).get(countyKey('CA', 'Santa Clara'))!
    expect(entry.recentNew).toHaveLength(RECENT_NEW_COUNT)
    expect(entry.recentNew.map(r => r.commonName)).toEqual(
      ['Canada Goose', 'Mallard', 'Killdeer', 'Osprey', 'Merlin'],
    )
    expect(entry.recentNew[0].firstDate).toBe('2026-06-14')
    // Kestrel's June re-sighting must NOT rank it — its first record is March.
    expect(entry.recentNew.some(r => r.commonName === 'American Kestrel')).toBe(false)
  })
})

describe('completenessTargets (FR-22 / QA-18)', () => {
  const pool: EbirdSpecies[] = [
    { speciesCode: 'gwfgoo', commonName: 'Greater White-fronted Goose' },
    { speciesCode: 'snogoo', commonName: 'Snow Goose' },
    { speciesCode: 'cangoo', commonName: 'Canada Goose' },
    { speciesCode: 'tunswa', commonName: 'Tundra Swan' },
    { speciesCode: 'mallar3', commonName: 'Mallard' },
    { speciesCode: 'norsho', commonName: 'Northern Shoveler' },
    { speciesCode: 'gadwal', commonName: 'Gadwall' },
  ]

  it('excludes recorded species by code, keeps taxonomic order, caps at 5', () => {
    const targets = completenessTargets(pool, new Set(['cangoo']), new Set())
    expect(targets.map(t => t.speciesCode)).toEqual(['gwfgoo', 'snogoo', 'tunswa', 'mallar3', 'norsho'])
  })

  it('also excludes by normalized name when a code did not resolve (belt-and-braces)', () => {
    const targets = completenessTargets(pool, new Set(), new Set(['Canada Goose', 'Mallard']))
    expect(targets.some(t => t.commonName === 'Canada Goose')).toBe(false)
    expect(targets.some(t => t.commonName === 'Mallard')).toBe(false)
  })
})

describe('computeCompleteness — combined result (FR-09 clamp, FR-24/FR-25 shapes)', () => {
  const local = buildCountyCompletenessLocal([
    obs({ commonName: 'Canada Goose' }),
    obs({ commonName: 'Mallard', scientificName: 'Anas platyrhynchos' }),
  ]).get(countyKey('CA', 'Santa Clara'))!

  const opts = { status: 'ready' as const, fromCache: false, regionResolvable: true, fetchedAt: 1000 }

  it('combines x, y, ratio, percent, band, and targets', () => {
    const ebird: CountyEbirdData = {
      regionCode: 'US-CA-085', speciesCount: 20,
      species: [
        { speciesCode: 'cangoo', commonName: 'Canada Goose' },
        { speciesCode: 'tunswa', commonName: 'Tundra Swan' },
      ],
    }
    const r = computeCompleteness(local, ebird, new Set(['cangoo']), opts)
    expect(r.x).toBe(2)
    expect(r.y).toBe(20)
    expect(r.ratio).toBeCloseTo(0.1)
    expect(r.percent).toBe(10)
    expect(r.band).toBe(1)
    expect(r.targets).toEqual([{ speciesCode: 'tunswa', commonName: 'Tundra Swan' }])
    expect(r.recentNew.length).toBe(2)
  })

  it('clamps a data anomaly: x > y still shows 100%, band 10, ratio 1 (QA-09)', () => {
    const ebird: CountyEbirdData = { regionCode: 'US-CA-085', speciesCount: 1, species: [{ speciesCode: 'cangoo', commonName: 'Canada Goose' }] }
    const r = computeCompleteness(local, ebird, new Set(), opts)
    expect(r.ratio).toBe(1)
    expect(r.percent).toBe(100)
    expect(r.band).toBe(10)
  })

  it('an empty eBird list yields y = 0, no percent, band 0, empty targets (FR-25)', () => {
    const ebird: CountyEbirdData = { regionCode: 'US-CA-085', speciesCount: 0, species: [] }
    const r = computeCompleteness(local, ebird, new Set(), { ...opts, status: 'empty' })
    expect(r.y).toBe(0)
    expect(r.percent).toBeUndefined()
    expect(r.band).toBe(0)
    expect(r.targets).toEqual([])
  })

  it('no eBird data keeps the local half only (FR-24) — X and recentNew, band 0', () => {
    const r = computeCompleteness(local, null, new Set(), { status: 'offline', fromCache: false, regionResolvable: true, message: 'offline' })
    expect(r.x).toBe(2)
    expect(r.recentNew.length).toBe(2)
    expect(r.y).toBeUndefined()
    expect(r.band).toBe(0)
    expect(r.status).toBe('offline')
  })

  it('a 0-of-Y county stays band 0 — plain outline preserved (FR-14)', () => {
    const ebird: CountyEbirdData = { regionCode: 'US-CA-069', speciesCount: 287, species: [] }
    const r = computeCompleteness(null, ebird, new Set(), opts)
    expect(r.x).toBe(0)
    expect(r.percent).toBe(0)
    expect(r.band).toBe(0)
  })
})

describe('cacheLineText', () => {
  const DAY = 86_400_000
  it('reads "just now" same-day and "N days ago" after that', () => {
    expect(cacheLineText(1000, 1000)).toBe('eBird data fetched just now, cached for 30 days')
    expect(cacheLineText(1000, 1000 + DAY)).toBe('eBird data from 1 day ago, cached for 30 days')
    expect(cacheLineText(1000, 1000 + 3 * DAY)).toBe('eBird data from 3 days ago, cached for 30 days')
  })
})

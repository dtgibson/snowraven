import { describe, it, expect } from 'vitest'
import type { ObservationEntry } from '../types'
import {
  filterObservations, computeChecklists, computeLifeList, computeTopSpecies,
  computeTotals, computeEffort, computeBreedingStats, computeTemporal, computeFunStats,
  computeQuality, computeGeo, computeDurationBins, KM_TO_MI, HA_TO_ACRE,
} from './birdingStats'

// Concise fixture builder — fills required ObservationEntry fields with sensible
// defaults; checklist-level fields are set on the first row of each submission.
function obs(p: Partial<ObservationEntry> & { submissionId: string; commonName: string; date: string }): ObservationEntry {
  return {
    scientificName: '',
    location: 'Loc', locationId: 'L1',
    latitude: null, longitude: null, county: null,
    count: 1, breedingCode: null, speciesComments: '', catalogIds: [],
    ...p,
  }
}

describe('filterObservations', () => {
  const rows = [
    obs({ submissionId: 'S1', commonName: 'American Robin', date: '2024-01-01' }),
    obs({ submissionId: 'S1', commonName: 'gull sp.', date: '2024-01-01' }),
    obs({ submissionId: 'S1', commonName: 'Mallard/Gadwall', date: '2024-01-01' }),
    obs({ submissionId: 'S1', commonName: 'Mallard x American Black Duck', date: '2024-01-01' }),
  ]
  it('drops spuh, slash, and hybrid entries by default', () => {
    expect(filterObservations(rows, false).map(o => o.commonName)).toEqual(['American Robin'])
  })
  it('keeps everything when includeSpuh is true', () => {
    expect(filterObservations(rows, true)).toHaveLength(4)
  })
  // The discriminating over-exclusion case. `commonName` is the RAW exported name, so
  // a trailing parenthetical carrying its own " x " must NOT be read as a hybrid: an
  // intergrade is a countable bird. A raw-name predicate drops these, erasing the
  // species entirely when the intergrade is a birder's only record of it.
  it('keeps intraspecific intergrades while still dropping true hybrids', () => {
    const rows = [
      obs({ submissionId: 'S1', commonName: "Yellow-rumped Warbler (Myrtle x Audubon's)", date: '2024-01-01' }),
      obs({ submissionId: 'S1', commonName: 'Northern Flicker (Yellow-shafted x Red-shafted)', date: '2024-01-01' }),
      obs({ submissionId: 'S1', commonName: 'Mallard x American Black Duck (hybrid)', date: '2024-01-01' }),
    ]
    expect(filterObservations(rows, false).map(o => o.commonName)).toEqual([
      "Yellow-rumped Warbler (Myrtle x Audubon's)",
      'Northern Flicker (Yellow-shafted x Red-shafted)',
    ])
    // And they reach the life list as their countable parent species.
    expect(computeLifeList(filterObservations(rows, false)))
      .toEqual(['Northern Flicker', 'Yellow-rumped Warbler'])
  })

  // The " x " hybrid marker is a separated word, so a species whose name merely
  // contains an "x" must survive the filter. (Guard, not a regression test: this
  // passes under the raw-name predicate too.)
  it('does not over-exclude a real species with an x in its name', () => {
    const kept = filterObservations([
      obs({ submissionId: 'S1', commonName: "Xantus's Hummingbird", date: '2024-01-01' }),
    ], false)
    expect(kept.map(o => o.commonName)).toEqual(["Xantus's Hummingbird"])
  })
})

// A life-list COUNT excludes spuh, slash AND hybrids (`isNonCountableForm`),
// not just spuh/slash. Hybrids used to survive this filter and inflate every
// derived species total on Statistics and the Map Explorer's county aggregates.
describe('filterObservations — hybrids never inflate a species count', () => {
  const rows = [
    obs({ submissionId: 'S1', commonName: 'American Robin', date: '2024-01-01' }),
    obs({ submissionId: 'S1', commonName: 'gull sp.', date: '2024-01-01' }),
    obs({ submissionId: 'S1', commonName: 'Mallard/Gadwall', date: '2024-01-01' }),
    obs({ submissionId: 'S1', commonName: 'Mallard x American Black Duck', date: '2024-01-01' }),
    obs({ submissionId: 'S1', commonName: 'Mallard x Northern Pintail', date: '2024-01-01' }),
  ]

  it('excludes hybrids from computeLifeList / computeTotals at includeSpuh false', () => {
    const filtered = filterObservations(rows, false)
    const lifeList = computeLifeList(filtered)
    expect(lifeList).toEqual(['American Robin'])
    expect(computeTotals(computeChecklists(filtered), lifeList).speciesCount).toBe(1)
  })

  it('includes hybrids alongside spuh and slash at includeSpuh true', () => {
    const filtered = filterObservations(rows, true)
    const lifeList = computeLifeList(filtered)
    expect(lifeList).toHaveLength(5)
    expect(lifeList).toContain('Mallard x American Black Duck')
    expect(computeTotals(computeChecklists(filtered), lifeList).speciesCount).toBe(5)
  })

  it('keeps the per-checklist species count off hybrids', () => {
    const cks = computeChecklists(filterObservations(rows, false))
    expect(cks[0].speciesCount).toBe(1)
  })
})

describe('computeChecklists', () => {
  it('rolls up species + individual counts per submission, X counts as 0', () => {
    const rows = [
      obs({ submissionId: 'S2', commonName: 'American Robin', date: '2024-01-02', count: 3, duration: 60 }),
      obs({ submissionId: 'S2', commonName: 'Blue Jay', date: '2024-01-02', count: 2 }),
      obs({ submissionId: 'S1', commonName: 'Mallard', date: '2024-01-01', count: null }),
    ]
    const cks = computeChecklists(rows)
    expect(cks.map(c => c.submissionId)).toEqual(['S1', 'S2']) // sorted by date
    const s2 = cks.find(c => c.submissionId === 'S2')!
    expect(s2.speciesCount).toBe(2)
    expect(s2.individualCount).toBe(5)
    expect(s2.duration).toBe(60) // from the first row of the submission
    const s1 = cks.find(c => c.submissionId === 'S1')!
    expect(s1.individualCount).toBe(0) // X / null
  })
})

describe('computeGeo — (state, county) keying', () => {
  // Two "Washington" counties in different states must stay distinct rows, not
  // merge into one (the latent name-only-keying collision the County overlay
  // requires fixed). Doubles as QA-10 coverage.
  const rows = [
    obs({ submissionId: 'S1', commonName: 'American Robin', date: '2024-01-01', locationId: 'L1', county: 'Washington', stateProvince: 'US-CA' }),
    obs({ submissionId: 'S1', commonName: 'Mallard', date: '2024-01-01', locationId: 'L1', county: 'Washington', stateProvince: 'US-CA' }),
    obs({ submissionId: 'S2', commonName: 'American Robin', date: '2024-02-01', locationId: 'L2', county: 'Washington', stateProvince: 'US-CA' }),
    obs({ submissionId: 'S3', commonName: 'Blue Jay', date: '2024-03-01', locationId: 'L3', county: 'Washington', stateProvince: 'US-UT' }),
  ]

  it('emits two distinct rows for same-named counties in different states', () => {
    const geo = computeGeo(computeChecklists(rows), rows)
    const washingtons = geo.topCounties.filter(c => c.name === 'Washington')
    expect(washingtons).toHaveLength(2)
    const ca = washingtons.find(c => c.stateProvince === 'US-CA')!
    const ut = washingtons.find(c => c.stateProvince === 'US-UT')!
    expect(ca.count).toBe(2)   // 2 checklists (S1, S2), NOT merged with UT
    expect(ca.species).toBe(2) // American Robin + Mallard
    expect(ut.count).toBe(1)   // 1 checklist (S3)
    expect(ut.species).toBe(1) // Blue Jay
  })

  it('preserves the { name, count, stateProvince, species } row shape', () => {
    const geo = computeGeo(computeChecklists(rows), rows)
    const row = geo.topCounties[0]
    expect(Object.keys(row).sort()).toEqual(['count', 'name', 'species', 'stateProvince'])
  })
})

describe('computeLifeList', () => {
  it('merges subspecies into the parent and de-duplicates', () => {
    const rows = [
      obs({ submissionId: 'S1', commonName: "Yellow-rumped Warbler (Myrtle)", date: '2024-01-01' }),
      obs({ submissionId: 'S1', commonName: "Yellow-rumped Warbler (Audubon's)", date: '2024-01-01' }),
      obs({ submissionId: 'S1', commonName: 'American Robin', date: '2024-01-01' }),
    ]
    expect(computeLifeList(rows)).toEqual(['American Robin', 'Yellow-rumped Warbler'])
  })
})

describe('computeTopSpecies', () => {
  it('ranks by individuals (excluding X) and by distinct checklists', () => {
    const rows = [
      obs({ submissionId: 'S1', commonName: 'American Robin', date: '2024-01-01', count: 3 }),
      obs({ submissionId: 'S2', commonName: 'American Robin', date: '2024-01-02', count: 10 }),
      obs({ submissionId: 'S1', commonName: 'Blue Jay', date: '2024-01-01', count: 2 }),
      obs({ submissionId: 'S3', commonName: 'Mallard', date: '2024-01-03', count: null }),
    ]
    const top = computeTopSpecies(rows)
    expect(top.byIndividuals[0]).toEqual({ name: 'American Robin', total: 13 })
    expect(top.byIndividuals.find(s => s.name === 'Mallard')).toBeUndefined() // X excluded
    expect(top.byChecklists[0]).toEqual({ name: 'American Robin', count: 2 })
    expect(top.hasCounts).toBe(true)
  })
})

describe('computeTotals', () => {
  it('counts species/checklists/locations/years/states/countries + date span', () => {
    const rows = [
      obs({ submissionId: 'S1', commonName: 'American Robin', date: '2024-01-01', locationId: 'A', stateProvince: 'US-MN' }),
      obs({ submissionId: 'S2', commonName: 'Blue Jay', date: '2025-06-01', locationId: 'B', stateProvince: 'CA-ON' }),
    ]
    const cks = computeChecklists(rows)
    const t = computeTotals(cks, computeLifeList(rows))
    expect(t.speciesCount).toBe(2)
    expect(t.checklistCount).toBe(2)
    expect(t.locationCount).toBe(2)
    expect(t.yearCount).toBe(2)
    expect(t.stateCount).toBe(2)
    expect(t.countryCount).toBe(2) // US + CA
    expect(t.firstDate).toBe('2024-01-01')
    expect(t.lastDate).toBe('2025-06-01')
  })
})

describe('computeEffort', () => {
  const rows = [
    obs({ submissionId: 'S1', commonName: 'American Robin', date: '2024-01-01', count: 3, duration: 60, distance: 2, numObservers: 1, protocol: 'Traveling', allObsReported: true }),
    obs({ submissionId: 'S1', commonName: 'Blue Jay', date: '2024-01-01', count: 2 }),
    obs({ submissionId: 'S2', commonName: 'American Robin', date: '2024-01-02', count: 10, duration: 120, numObservers: 3, protocol: 'Stationary', allObsReported: false, area: 5 }),
    obs({ submissionId: 'S3', commonName: 'Mallard', date: '2024-01-05', count: null }),
  ]
  const e = computeEffort(computeChecklists(rows))

  it('totals durations/distances/area with unit conversions', () => {
    expect(e.totalHours).toBe(3)             // (60 + 120) / 60
    expect(e.avgDurationMin).toBe(90)
    expect(e.totalDistanceMi).toBeCloseTo(2 * KM_TO_MI, 5)
    expect(e.totalAreaAcres).toBeCloseTo(5 * HA_TO_ACRE, 5)
  })
  it('identifies the notable outings', () => {
    expect(e.longest?.submissionId).toBe('S2')        // 120 min
    expect(e.farthest?.submissionId).toBe('S1')       // only one with distance
    expect(e.largestArea?.submissionId).toBe('S2')
    expect(e.biggest?.submissionId).toBe('S1')        // 2 species
    expect(e.mostIndividuals?.submissionId).toBe('S2') // 10 individuals
  })
  it('summarizes observers and completeness', () => {
    expect(e.soloCount).toBe(1)
    expect(e.groupCount).toBe(1)
    expect(e.avgObservers).toBe(2)        // (1 + 3) / 2
    expect(e.largestGroup?.n).toBe(3)
    expect(e.completeRatio).toBe(0.5)     // 1 of 2 complete
  })
  it('keys observerRows by the actual count — no 5+ rollup', () => {
    // Regression: the old model clamped `numObservers >= 5` into one key of 5,
    // which would merge these into a single { n: 5, count: 3 } row.
    const highRows = [
      obs({ submissionId: 'S10', commonName: 'American Robin', date: '2024-02-01', numObservers: 6 }),
      obs({ submissionId: 'S11', commonName: 'American Robin', date: '2024-02-02', numObservers: 8 }),
      obs({ submissionId: 'S12', commonName: 'Blue Jay', date: '2024-02-03', numObservers: 8 }),
      obs({ submissionId: 'S13', commonName: 'Blue Jay', date: '2024-02-04', numObservers: 2 }),
    ]
    const eh = computeEffort(computeChecklists(highRows))
    expect(eh.observerRows).toEqual([
      { n: 2, count: 1 },
      { n: 6, count: 1 },
      { n: 8, count: 2 },
    ])
    expect(eh.observerRows.find(r => r.n === 5)).toBeUndefined()
  })
})

describe('computeBreedingStats', () => {
  it('classifies highest tier per species into confirmed/probable/possible', () => {
    const rows = [
      obs({ submissionId: 'S1', commonName: 'American Robin', date: '2024-05-01', breedingCode: 'S' }),  // tier 1
      obs({ submissionId: 'S2', commonName: 'American Robin', date: '2024-06-01', breedingCode: 'NY' }), // tier 4 → wins
      obs({ submissionId: 'S1', commonName: 'Blue Jay', date: '2024-05-01', breedingCode: 'P' }),        // tier 2
      obs({ submissionId: 'S1', commonName: 'House Wren', date: '2024-05-01', breedingCode: 'S' }),      // tier 1
    ]
    const b = computeBreedingStats(rows)
    expect(b.confirmed).toBe(1) // Robin (NY beats S)
    expect(b.probable).toBe(1)  // Jay
    expect(b.possible).toBe(1)  // Wren
    expect(b.total).toBe(3)
  })
})

describe('computeTemporal', () => {
  it('produces fixed-length year/month/dow/hour breakdowns', () => {
    const rows = [obs({ submissionId: 'S1', commonName: 'American Robin', date: '2024-01-01', time: '6:30 AM' })]
    const t = computeTemporal(computeChecklists(rows), rows)
    expect(t.monthRows).toHaveLength(12)
    expect(t.dowRows).toHaveLength(7)
    expect(t.hourRows).toHaveLength(24)
    expect(t.yearRows[0].label).toBe('2024')
    expect(t.hourRows[6].value).toBe(1) // 6:30 AM → hour 6
  })
})

describe('computeDurationBins', () => {
  // Bins are lower-inclusive half-open: 15-minute steps [0,15) … [165,180) for
  // the first three hours, hourly [180,240), [240,300), … from there.
  it('lands boundary durations in the lower-inclusive bin', () => {
    const rows = [
      obs({ submissionId: 'S1', commonName: 'American Robin', date: '2024-01-01', duration: 14 }),
      obs({ submissionId: 'S2', commonName: 'American Robin', date: '2024-01-02', duration: 15 }),
      obs({ submissionId: 'S3', commonName: 'American Robin', date: '2024-01-03', duration: 180 }),
    ]
    const d = computeDurationBins(computeChecklists(rows))
    const byLabel = new Map(d.bins.map(b => [b.label, b.value]))
    expect(byLabel.get('0-15m')).toBe(1)   // 14 → [0,15)
    expect(byLabel.get('15-30m')).toBe(1)  // 15 → [15,30), NOT [0,15)
    expect(byLabel.get('3-4h')).toBe(1)    // 180 → [180,240), NOT [165,180)
  })

  it('keeps zero-count bins inside the range and cuts after the longest bin', () => {
    const rows = [
      obs({ submissionId: 'S1', commonName: 'American Robin', date: '2024-01-01', duration: 5 }),
      obs({ submissionId: 'S2', commonName: 'American Robin', date: '2024-01-02', duration: 65 }),
    ]
    const d = computeDurationBins(computeChecklists(rows))
    expect(d.bins.map(b => b.label)).toEqual(['0-15m', '15-30m', '30-45m', '45-60m', '1h-1h 15m'])
    expect(d.bins.map(b => b.value)).toEqual([1, 0, 0, 0, 1])
  })

  it('hands off to hourly bins at 3h with the full label ladder', () => {
    const rows = [obs({ submissionId: 'S1', commonName: 'American Robin', date: '2024-01-01', duration: 250 })]
    const d = computeDurationBins(computeChecklists(rows))
    expect(d.bins.map(b => b.label)).toEqual([
      '0-15m', '15-30m', '30-45m', '45-60m',
      '1h-1h 15m', '1h 15m-1h 30m', '1h 30m-1h 45m', '1h 45m-2h',
      '2h-2h 15m', '2h 15m-2h 30m', '2h 30m-2h 45m', '2h 45m-3h',
      '3-4h', '4-5h',
    ])
    expect(d.bins[13].value).toBe(1) // 250 → [240,300)
    expect(d.bins[13].lo).toBe(240)
    expect(d.bins[13].hi).toBe(300)
  })

  it('excludes null durations from bins and the average, tracking coverage', () => {
    const rows = [
      obs({ submissionId: 'S1', commonName: 'American Robin', date: '2024-01-01', duration: 60 }),
      obs({ submissionId: 'S2', commonName: 'American Robin', date: '2024-01-02', duration: 120 }),
      obs({ submissionId: 'S3', commonName: 'Mallard', date: '2024-01-05' }), // no duration
    ]
    const cks = computeChecklists(rows)
    const d = computeDurationBins(cks)
    expect(d.durationCount).toBe(2)
    expect(d.totalCount).toBe(3)
    expect(d.bins.reduce((s, b) => s + b.value, 0)).toBe(2) // the null row binned nowhere
    expect(d.avgDurationMin).toBe(90)
    // Parity lock on SANE (in-range) data: the block's average is the SAME
    // number Effort reports — the two formulas must agree wherever both count
    // the same durations. (Out-of-range values deliberately diverge; see the
    // range-guard tests below.)
    expect(d.avgDurationMin).toBe(computeEffort(cks).avgDurationMin)
  })

  it('returns no bins and a null average when nothing has a duration', () => {
    const rows = [obs({ submissionId: 'S1', commonName: 'Mallard', date: '2024-01-05' })]
    const d = computeDurationBins(computeChecklists(rows))
    expect(d.bins).toEqual([])
    expect(d.durationCount).toBe(0)
    expect(d.totalCount).toBe(1)
    expect(d.avgDurationMin).toBeNull()
  })

  // ── Range guard (security remediation) ────────────────────────────────────
  // A duration outside [0, 1440] (eBird's own 24 h cap) is a corrupt or
  // hostile cell, not data: it is treated as duration-less — excluded from the
  // bins, from durationCount coverage, and from the average — so the ladder is
  // structurally bounded at 33 bins. computeEffort's shipped behavior is
  // deliberately UNCHANGED and still counts such values.

  it('excludes out-of-range and negative durations from bins, coverage, and the average — while computeEffort still counts them', () => {
    const rows = [
      obs({ submissionId: 'S1', commonName: 'American Robin', date: '2024-01-01', duration: 60 }),
      obs({ submissionId: 'S2', commonName: 'American Robin', date: '2024-01-02', duration: 120 }),
      obs({ submissionId: 'S3', commonName: 'American Robin', date: '2024-01-03', duration: 999999999 }), // corrupt cell (e.g. column-shifted ML catalog number)
      obs({ submissionId: 'S4', commonName: 'American Robin', date: '2024-01-04', duration: -30 }),       // negative — previously binned invisibly at a negative index
    ]
    const cks = computeChecklists(rows)
    const d = computeDurationBins(cks)
    expect(d.bins.length).toBeLessThanOrEqual(33)            // structurally bounded
    expect(d.bins.reduce((s, b) => s + b.value, 0)).toBe(2)  // only the two sane rows binned
    expect(d.durationCount).toBe(2)                          // excluded from coverage
    expect(d.totalCount).toBe(4)
    expect(d.avgDurationMin).toBe(90)                        // (60 + 120) / 2 — excluded from the average
    // computeEffort is untouched: it still sums every non-null duration.
    const e = computeEffort(cks)
    expect(e.durationCount).toBe(4)
    expect(e.avgDurationMin).toBe((60 + 120 + 999999999 - 30) / 4)
  })

  it('keeps an exactly-24h checklist visible in the closed terminal bin and excludes just past it', () => {
    const rows = [
      obs({ submissionId: 'S1', commonName: 'American Robin', date: '2024-01-01', duration: 1440 }), // eBird-legal cap → terminal [1380,1440] bin
      obs({ submissionId: 'S2', commonName: 'American Robin', date: '2024-01-02', duration: 1441 }), // past the cap → excluded
    ]
    const d = computeDurationBins(computeChecklists(rows))
    expect(d.bins.length).toBe(33) // 12 fine + 21 hourly — the structural maximum
    expect(d.bins[32].label).toBe('23-24h')
    expect(d.bins[32].value).toBe(1)
    expect(d.durationCount).toBe(1)
    expect(d.avgDurationMin).toBe(1440)
  })

  it('does not throw and stays bounded on a hostile single-cell duration (crash regression)', () => {
    const rows = [obs({ submissionId: 'S1', commonName: 'American Robin', date: '2024-01-01', duration: 999999999 })]
    let d!: ReturnType<typeof computeDurationBins>
    expect(() => { d = computeDurationBins(computeChecklists(rows)) }).not.toThrow()
    expect(d.bins.length).toBeLessThanOrEqual(33)
    expect(d.durationCount).toBe(0)
    expect(d.totalCount).toBe(1)
    expect(d.avgDurationMin).toBeNull()
  })
})

describe('computeFunStats', () => {
  const rows = [
    obs({ submissionId: 'S1', commonName: 'American Robin', date: '2024-01-01', count: 5 }),
    obs({ submissionId: 'S2', commonName: 'American Robin', date: '2024-01-02', count: 5 }),
    obs({ submissionId: 'S3', commonName: 'Blue Jay', date: '2024-01-03', count: 3 }),
    obs({ submissionId: 'S4', commonName: 'House Wren', date: '2024-01-10', count: 1 }),
  ]
  const f = computeFunStats(rows, computeChecklists(rows), rows)

  it('computes the longest consecutive-day streak and dry spell', () => {
    expect(f.maxStreak).toBe(3)  // Jan 1-2-3
    expect(f.drySpell).toBe(6)   // Jan 3 → Jan 10
  })
  it('separates one-and-done from single-checklist birds', () => {
    expect(f.oneDoneBirds.map(b => b.name)).toEqual(['House Wren'])   // total count 1
    expect(f.singleChecklistBirds.map(b => b.name)).toEqual(['Blue Jay']) // 1 checklist, count > 1
  })
  it('reports Shannon diversity when there are numeric counts', () => {
    expect(f.shannon).not.toBeNull()
    expect(f.shannon!).toBeGreaterThan(0)
  })
})

describe('computeQuality — weather/tide block coverage', () => {
  // Minimal comments that exercise the same detector paths the formatters emit
  // (commentBlocks.test.ts locks the detectors against the real formatter output).
  const SR_WEATHER = 'Few clouds\nTemperature: 64°F\nWind: 6 mph\nWeather generated by SnowRaven'
  const RAINCROW_WEATHER = 'Few clouds\nTemperature: 64°F\nWind: 6 mph\nWeather generated by Raincrow (https://raincrow.app)'
  const SR_TIDE = 'Tide: falling\nWater level: 4.1 ft, Relative to MLLW\nTide data from NOAA CO-OPS · via SnowRaven'
  const SR_COMBINED = `Few clouds\nTemperature: 64°F\nWind: 6 mph\n${SR_TIDE}\nWeather and tide generated by SnowRaven`

  const rows = [
    obs({ submissionId: 'S1', commonName: 'American Robin', date: '2024-01-01', checklistComments: SR_WEATHER }),
    obs({ submissionId: 'S2', commonName: 'Blue Jay', date: '2024-01-02', checklistComments: RAINCROW_WEATHER }),
    obs({ submissionId: 'S3', commonName: 'Mallard', date: '2024-01-03', checklistComments: SR_TIDE }),
    obs({ submissionId: 'S4', commonName: 'House Wren', date: '2024-01-04', checklistComments: SR_COMBINED }),
    obs({ submissionId: 'S5', commonName: 'Song Sparrow', date: '2024-01-05', checklistComments: 'Lovely calm morning.' }),
  ]
  const q = computeQuality(rows, computeChecklists(rows))

  it('counts each block type across checklists', () => {
    expect(q.weatherTideTotal).toBe(5)
    expect(q.anyWeatherCount).toBe(3)        // S1 (SR), S2 (raincrow), S4 (combined)
    expect(q.snowravenWeatherCount).toBe(2)  // S1, S4
    expect(q.raincrowWeatherCount).toBe(1)   // S2
    expect(q.snowravenTideCount).toBe(2)     // S3, S4
    expect(q.snowravenWeatherAndTideCount).toBe(1) // S4 only
  })
  it('partitions any-weather into raincrow + SnowRaven', () => {
    expect(q.raincrowWeatherCount + q.snowravenWeatherCount).toBe(q.anyWeatherCount)
  })
  it('reports ratios over all checklists', () => {
    expect(q.anyWeatherRatio).toBeCloseTo(3 / 5)
    expect(q.snowravenWeatherAndTideRatio).toBeCloseTo(1 / 5)
  })
  it('returns null ratios when there are no checklists', () => {
    const empty = computeQuality([], [])
    expect(empty.anyWeatherRatio).toBeNull()
    expect(empty.anyWeatherCount).toBe(0)
    expect(empty.weatherTideTotal).toBe(0)
  })
  it('does not count hand-written weather prose (no app credit) as a weather block', () => {
    const prose = [
      obs({ submissionId: 'P1', commonName: 'American Crow', date: '2024-02-01', checklistComments: 'Wind: calm. Temperature: 55F all morning.' }),
    ]
    const q2 = computeQuality(prose, computeChecklists(prose))
    expect(q2.anyWeatherCount).toBe(0)      // not attributed to either app
    expect(q2.raincrowWeatherCount).toBe(0) // no raincrow.app credit
    expect(q2.snowravenWeatherCount).toBe(0)
  })
})

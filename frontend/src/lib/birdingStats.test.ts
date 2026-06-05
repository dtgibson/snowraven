import { describe, it, expect } from 'vitest'
import type { ObservationEntry } from '../types'
import {
  filterObservations, computeChecklists, computeLifeList, computeTopSpecies,
  computeTotals, computeEffort, computeBreedingStats, computeTemporal, computeFunStats,
  KM_TO_MI, HA_TO_ACRE,
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
  ]
  it('drops spuh and slash entries by default', () => {
    expect(filterObservations(rows, false).map(o => o.commonName)).toEqual(['American Robin'])
  })
  it('keeps everything when includeSpuh is true', () => {
    expect(filterObservations(rows, true)).toHaveLength(3)
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

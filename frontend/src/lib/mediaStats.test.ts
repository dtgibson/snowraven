import { describe, it, expect } from 'vitest'
import type { MLExportRow } from './parseMLExport'
import { parseAgeSex, parseBehaviors, parseMlHour, computeMediaStats, speciesWithYoung, sortSpeciesAgeCoverage, assetMatchesFacet, buildCatalogAgeSex, type SpeciesAgeCoverage, type AgeClass, type Sex, type AgeSexGroup } from './mediaStats'

function row(p: Partial<MLExportRow> & { catalogId: string }): MLExportRow {
  return {
    commonName: 'American Robin', scientificName: 'Turdus migratorius',
    format: 'Photo', date: '2024-05-01', location: 'Loc', county: null,
    latitude: null, longitude: null, caption: '', mediaNotes: '', observationDetails: '',
    ageSex: '', behaviors: '', time: '', year: null, month: null, avgRating: null, numRatings: 0,
    checklistId: '',
    ...p,
  }
}

describe('parseAgeSex', () => {
  it('parses a single en-dash group with a count', () => {
    expect(parseAgeSex('Adult – 2')).toEqual([{ age: 'Adult', sex: 'Unknown', count: 2 }])
  })
  it('parses combined age + sex', () => {
    expect(parseAgeSex('Adult Female – 1')).toEqual([{ age: 'Adult', sex: 'Female', count: 1 }])
  })
  it('does not misread Female as Male (token equality)', () => {
    expect(parseAgeSex('Adult Female – 1')[0].sex).toBe('Female')
  })
  it('splits multiple groups on "; "', () => {
    expect(parseAgeSex('Adult Female – 1; Adult Male – 1')).toEqual([
      { age: 'Adult', sex: 'Female', count: 1 },
      { age: 'Adult', sex: 'Male', count: 1 },
    ])
  })
  it('treats a bare sex word as age Unknown', () => {
    expect(parseAgeSex('Male – 1')).toEqual([{ age: 'Unknown', sex: 'Male', count: 1 }])
  })
  it('treats "Unknown" as unknown age + sex', () => {
    expect(parseAgeSex('Unknown – 14')).toEqual([{ age: 'Unknown', sex: 'Unknown', count: 14 }])
  })
  it('maps Subadult to Immature and Juvenile correctly', () => {
    expect(parseAgeSex('Juvenile – 2')[0].age).toBe('Juvenile')
    expect(parseAgeSex('Subadult – 1')[0].age).toBe('Immature')
    expect(parseAgeSex('Immature Male – 1')).toEqual([{ age: 'Immature', sex: 'Male', count: 1 }])
  })
  it('defaults count to 1 when absent and returns [] for blank', () => {
    expect(parseAgeSex('Adult')[0].count).toBe(1)
    expect(parseAgeSex('')).toEqual([])
    expect(parseAgeSex('   ')).toEqual([])
  })
})

describe('parseBehaviors', () => {
  it('splits on "; " and keeps comma-containing labels intact', () => {
    expect(parseBehaviors('Preening, Scratching, or Bathing; Flying')).toEqual([
      'Preening, Scratching, or Bathing', 'Flying',
    ])
  })
  it('returns [] for blank', () => {
    expect(parseBehaviors('')).toEqual([])
  })
})

describe('parseMlHour', () => {
  it('reads HMM and HHMM', () => {
    expect(parseMlHour('643')).toBe(6)
    expect(parseMlHour('1343')).toBe(13)
    expect(parseMlHour('1200')).toBe(12)
    expect(parseMlHour('5')).toBe(0)
  })
  it('rejects blanks and out-of-range', () => {
    expect(parseMlHour('')).toBeNull()
    expect(parseMlHour('2599')).toBeNull() // minute 99 invalid
    expect(parseMlHour('abc')).toBeNull()
  })
})

describe('computeMediaStats', () => {
  const rows: MLExportRow[] = [
    row({ catalogId: '1', commonName: 'American Robin', format: 'Photo', date: '2024-05-01', ageSex: 'Adult – 1', behaviors: 'Foraging or Eating', time: '643' }),
    row({ catalogId: '2', commonName: 'American Robin', format: 'Audio', date: '2024-05-01', ageSex: '', behaviors: 'Song', time: '700' }),
    row({ catalogId: '3', commonName: 'Bald Eagle', format: 'Photo', date: '2024-05-02', ageSex: 'Adult – 1; Juvenile – 1', behaviors: 'Flying; Carrying Food', time: '1030' }),
    row({ catalogId: '4', commonName: 'Mallard', format: 'Photo', date: '2024-06-10', ageSex: 'Adult Male – 1', behaviors: '' }),
  ]

  it('counts totals, formats and distinct species', () => {
    const s = computeMediaStats(rows)
    expect(s.total).toBe(4)
    expect(s.photo).toBe(3)
    expect(s.audio).toBe(1)
    expect(s.distinctSpecies).toBe(3)
  })

  it('builds the per-individual age mix and annotation counts', () => {
    const s = computeMediaStats(rows)
    const age = Object.fromEntries(s.ageMix.map(b => [b.label, b.value]))
    expect(age.Adult).toBe(3)   // robin 1 + eagle 1 + mallard 1
    expect(age.Juvenile).toBe(1)
    expect(s.agedAssets).toBe(3) // rows 1, 3, 4 (row 2 has no age)
    const sex = Object.fromEntries(s.sexMix.map(b => [b.label, b.value]))
    expect(sex.Male).toBe(1)
    expect(s.sexedAssets).toBe(1)
  })

  it('flags only-adults gap respecting the min-asset threshold', () => {
    // Robin: 1 aged asset (below threshold 3) → not flagged despite adult-only.
    const s = computeMediaStats(rows)
    expect(s.onlyAdults.find(o => o.name === 'American Robin')).toBeUndefined()
    // Mallard adult-only but only 1 asset → also below threshold.
    expect(s.onlyAdults.find(o => o.name === 'Mallard')).toBeUndefined()
  })

  it('counts behaviors (multi-valued) and classifies breeding tiers', () => {
    const s = computeMediaStats(rows)
    const beh = Object.fromEntries(s.behaviorCounts.map(b => [b.label, b.value]))
    expect(beh['Flying']).toBe(1)
    expect(beh['Carrying Food']).toBe(1)
    expect(s.breeding.confirmed).toContain('Bald Eagle') // Carrying Food
    expect(s.breeding.possible).toContain('American Robin') // Song
  })

  it('computes coverage against the life list', () => {
    const life = new Set(['american robin', 'bald eagle', 'mallard', 'osprey'])
    const s = computeMediaStats(rows, life)
    expect(s.coverage).not.toBeNull()
    expect(s.coverage!.lifeListTotal).toBe(4)
    expect(s.coverage!.documented).toBe(3)
    expect(s.coverage!.withAudio).toBe(1) // robin has audio
  })

  it('finds the busiest media day and the longest streak with its dates', () => {
    const s = computeMediaStats(rows)
    expect(s.busiestDay).toEqual({ date: '2024-05-01', count: 2, checklistId: null, checklistCount: 0 })
    // 2024-05-01 and 2024-05-02 are consecutive; the lone 2024-06-10 doesn't extend it.
    expect(s.longestStreak).toEqual({ days: 2, start: '2024-05-01', end: '2024-05-02' })
    expect(s.spanDays).toBe(41) // 2024-05-01 .. 2024-06-10 inclusive
  })

  it('treats out-of-range dates as undated instead of rolling them onto a neighbor day', () => {
    // "2024-02-00" used to roll over to Jan 31 via Date.UTC and could split a
    // genuine streak (pre-0.5.25 dedup regression); now it simply doesn't count.
    const rows: MLExportRow[] = [
      row({ catalogId: 'd1', date: '2024-01-30' }),
      row({ catalogId: 'd2', date: '2024-01-31' }),
      row({ catalogId: 'd3', date: '2024-02-00' }),
      row({ catalogId: 'd4', date: '2024-02-01' }),
      row({ catalogId: 'd5', date: '2024-13-05' }),
    ]
    const s = computeMediaStats(rows)
    expect(s.longestStreak).toEqual({ days: 3, start: '2024-01-30', end: '2024-02-01' })
    expect(s.spanDays).toBe(3)
    expect(s.busiestDay!.date).toBe('2024-01-30') // ties keep the first; no rollover key wins
  })

  it('dedupes distinct date keys that land on the same day so they cannot reset a streak', () => {
    // 2024-02-30 passes the range check but rolls over to Mar 1 — the same day
    // as the explicit 2024-03-01 key. The run must continue through Mar 2.
    const rows: MLExportRow[] = [
      row({ catalogId: 'r1', date: '2024-02-30' }),
      row({ catalogId: 'r2', date: '2024-03-01' }),
      row({ catalogId: 'r3', date: '2024-03-02' }),
    ]
    const s = computeMediaStats(rows)
    expect(s.longestStreak).toEqual({ days: 2, start: '2024-02-30', end: '2024-03-02' })
  })

  it('ignores checklist ids that do not look like eBird submission ids', () => {
    const rows: MLExportRow[] = [
      row({ catalogId: 'j1', date: '2024-05-01', checklistId: 'N/A' }),
      row({ catalogId: 'j2', date: '2024-05-01', checklistId: 'https://example.com' }),
    ]
    const s = computeMediaStats(rows)
    expect(s.busiestDay).toEqual({ date: '2024-05-01', count: 2, checklistId: null, checklistCount: 0 })
  })

  it('resolves the busiest day to its dominant checklist', () => {
    const withIds: MLExportRow[] = [
      row({ catalogId: 'c1', date: '2024-05-01', checklistId: 'S2' }),
      row({ catalogId: 'c2', date: '2024-05-01', checklistId: 'S1' }),
      row({ catalogId: 'c3', date: '2024-05-01', checklistId: 'S1' }),
      row({ catalogId: 'c4', date: '2024-04-30', checklistId: 'S9' }),
    ]
    const s = computeMediaStats(withIds)
    expect(s.busiestDay).toEqual({ date: '2024-05-01', count: 3, checklistId: 'S1', checklistCount: 2 })
  })

  it('returns a 1-day streak for a single dated asset and null when nothing is dated', () => {
    const single = computeMediaStats([row({ catalogId: 's1', date: '2024-05-01' })])
    expect(single.longestStreak).toEqual({ days: 1, start: '2024-05-01', end: '2024-05-01' })
    expect(single.spanDays).toBe(1)
    const undated = computeMediaStats([row({ catalogId: 's2', date: '' })])
    expect(undated.longestStreak).toBeNull()
    expect(undated.spanDays).toBe(0)
  })

  it('hides ratings below the threshold and shows them above it', () => {
    expect(computeMediaStats(rows).ratings).toBeNull()
    const rated = Array.from({ length: 10 }, (_, i) =>
      row({ catalogId: `r${i}`, avgRating: 4.5, numRatings: 3 }))
    const s = computeMediaStats(rated)
    expect(s.ratings).not.toBeNull()
    expect(s.ratings!.rated).toBe(10)
    expect(s.ratings!.mean).toBeCloseTo(4.5)
  })

  it('buckets time of day by hour and format', () => {
    const s = computeMediaStats(rows)
    expect(s.withTime).toBe(3)
    expect(s.timeOfDay[6]).toEqual({ hour: 6, photo: 1, audio: 0, video: 0 })
    expect(s.timeOfDay[7]).toEqual({ hour: 7, photo: 0, audio: 1, video: 0 })
  })
})

describe('speciesWithYoung', () => {
  const rows: SpeciesAgeCoverage[] = [
    { name: 'Bald Eagle', adult: true, immature: false, juvenile: true, classesCaptured: 2, assets: 5 },
    { name: 'Cedar Waxwing', adult: true, immature: false, juvenile: false, classesCaptured: 1, assets: 9 }, // adult only — excluded
    { name: "Cooper's Hawk", adult: false, immature: true, juvenile: false, classesCaptured: 1, assets: 3 },
  ]
  it('keeps only species with an immature or juvenile', () => {
    expect(speciesWithYoung(rows).map(r => r.name)).toEqual(['Bald Eagle', "Cooper's Hawk"])
  })
})

describe('sortSpeciesAgeCoverage', () => {
  const rows: SpeciesAgeCoverage[] = [
    { name: 'Osprey', adult: true, immature: false, juvenile: true, classesCaptured: 2, assets: 1 },
    { name: 'American Robin', adult: true, immature: true, juvenile: false, classesCaptured: 2, assets: 1 },
    { name: 'Mallard', adult: true, immature: false, juvenile: true, classesCaptured: 2, assets: 1 },
  ]
  const order: Record<string, number> = { 'American Robin': 30, Mallard: 10, Osprey: 20 }
  const orderOf = (n: string) => order[n] ?? Infinity

  it('sorts by name A–Z', () => {
    expect(sortSpeciesAgeCoverage(rows, 'name', orderOf).map(r => r.name)).toEqual(['American Robin', 'Mallard', 'Osprey'])
  })
  it('sorts by taxonomic order, unknowns last', () => {
    expect(sortSpeciesAgeCoverage(rows, 'taxonomic', orderOf).map(r => r.name)).toEqual(['Mallard', 'Osprey', 'American Robin'])
  })
  it('falls back to name order when no taxonomic order is known', () => {
    expect(sortSpeciesAgeCoverage(rows, 'taxonomic', () => Infinity).map(r => r.name)).toEqual(['American Robin', 'Mallard', 'Osprey'])
  })
})

describe('assetMatchesFacet', () => {
  const g = (age: AgeClass, sex: Sex, count = 1): AgeSexGroup => ({ age, sex, count })

  it('matches anything when no facet is set', () => {
    expect(assetMatchesFacet([], null, null)).toBe(true)
    expect(assetMatchesFacet([g('Adult', 'Male')], null, null)).toBe(true)
  })
  it('a single sex facet is broad (any age)', () => {
    expect(assetMatchesFacet([g('Adult', 'Female')], 'Female', null)).toBe(true)
    expect(assetMatchesFacet([g('Adult', 'Male')], 'Female', null)).toBe(false)
  })
  it('a single age facet is broad (any sex)', () => {
    expect(assetMatchesFacet([g('Juvenile', 'Male')], null, 'Juvenile')).toBe(true)
    expect(assetMatchesFacet([g('Adult', 'Male')], null, 'Juvenile')).toBe(false)
  })
  it('exact-combo requires one group to be both that age AND that sex', () => {
    // "Adult Female; Juvenile Male" — has a female and a juvenile, but no juvenile female.
    const mixed = [g('Adult', 'Female'), g('Juvenile', 'Male')]
    expect(assetMatchesFacet(mixed, 'Female', 'Juvenile')).toBe(false)
    expect(assetMatchesFacet([g('Juvenile', 'Female')], 'Female', 'Juvenile')).toBe(true)
    // each single facet still matches the mixed asset
    expect(assetMatchesFacet(mixed, 'Female', null)).toBe(true)
    expect(assetMatchesFacet(mixed, null, 'Juvenile')).toBe(true)
  })
  it('untagged / unknown never matches an active facet', () => {
    expect(assetMatchesFacet([], 'Female', null)).toBe(false)
    expect(assetMatchesFacet([g('Unknown', 'Unknown')], 'Female', null)).toBe(false)
    expect(assetMatchesFacet([g('Unknown', 'Unknown')], null, 'Adult')).toBe(false)
  })
})

describe('buildCatalogAgeSex', () => {
  it('maps each catalog id to its parsed age/sex groups', () => {
    const rows = [
      row({ catalogId: 'c1', ageSex: 'Juvenile Female – 1' }),
      row({ catalogId: 'c2', ageSex: 'Adult Female – 1; Juvenile Male – 1' }),
      row({ catalogId: 'c3', ageSex: '' }),
    ]
    const m = buildCatalogAgeSex(rows)
    expect(m.get('c1')).toEqual([{ age: 'Juvenile', sex: 'Female', count: 1 }])
    expect(m.get('c2')).toHaveLength(2)
    expect(m.get('c3')).toEqual([])
  })
})

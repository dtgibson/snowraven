import { describe, it, expect } from 'vitest'
import type { MLExportRow } from './parseMLExport'
import { parseAgeSex, parseBehaviors, parseMlHour, computeMediaStats } from './mediaStats'

function row(p: Partial<MLExportRow> & { catalogId: string }): MLExportRow {
  return {
    commonName: 'American Robin', scientificName: 'Turdus migratorius',
    format: 'Photo', date: '2024-05-01', location: 'Loc', county: null,
    latitude: null, longitude: null, caption: '', mediaNotes: '', observationDetails: '',
    ageSex: '', behaviors: '', time: '', year: null, month: null, avgRating: null, numRatings: 0,
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

  it('finds the busiest media day and the longest streak', () => {
    const s = computeMediaStats(rows)
    expect(s.busiestDay).toEqual({ date: '2024-05-01', count: 2 })
    expect(s.longestStreakDays).toBe(2) // 2024-05-01 and 2024-05-02 are consecutive
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

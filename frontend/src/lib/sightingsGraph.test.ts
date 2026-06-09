import { describe, it, expect } from 'vitest'
import { buildGraphData, buildMediaGraphData } from './sightingsGraph'
import type { ObservationEntry } from '../types'
import type { MLExportRow } from './parseMLExport'

// Minimal stubs — only the fields buildGraphData actually reads
function obs(date: string, count: number | null = 1): ObservationEntry {
  return {
    submissionId: 'S1', commonName: 'Test Bird', scientificName: 'Testus birdus',
    date, location: '', locationId: '', latitude: null, longitude: null,
    county: null, count, breedingCode: null, speciesComments: '', catalogIds: [],
  }
}

function mlRow(date: string, format: 'Photo' | 'Audio' | 'Video'): MLExportRow {
  return {
    catalogId: '1', commonName: 'Test Bird', scientificName: 'Testus birdus',
    format, date, location: '', county: null, latitude: null, longitude: null,
    caption: '', mediaNotes: '', observationDetails: '',
    ageSex: '', behaviors: '', time: '', year: null, month: null, avgRating: null, numRatings: 0,
  }
}

describe('buildGraphData', () => {
  it('returns empty when no observations', () => {
    const result = buildGraphData([], [], 'yearly')
    expect(result).toEqual({ data: [], interval: 'yearly' })
  })

  it('returns empty when only one time period (< 2 needed for a graph)', () => {
    const result = buildGraphData([obs('2023-06-01'), obs('2023-06-15')], [], 'yearly')
    expect(result.data).toHaveLength(0)
  })

  it('uses yearly keys when interval is yearly', () => {
    const observations = [obs('2021-03-01', 2), obs('2023-07-10', 5)]
    const result = buildGraphData(observations, [], 'yearly')
    expect(result.interval).toBe('yearly')
    const keys = result.data.map(p => p.key)
    expect(keys).toEqual(['2021', '2022', '2023']) // gap filled
  })

  it('sums individual counts correctly within a year', () => {
    const observations = [obs('2021-03-01', 3), obs('2021-09-15', 7), obs('2022-04-01', 2)]
    const result = buildGraphData(observations, [], 'yearly')
    const y2021 = result.data.find(p => p.key === '2021')
    expect(y2021?.individuals).toBe(10)
    const y2022 = result.data.find(p => p.key === '2022')
    expect(y2022?.individuals).toBe(2)
  })

  it('counts checklists per period correctly (yearly)', () => {
    const observations = [obs('2021-03-01', 3), obs('2021-09-15', 7), obs('2022-04-01', 2)]
    const result = buildGraphData(observations, [], 'yearly')
    const y2021 = result.data.find(p => p.key === '2021')
    expect(y2021?.checklists).toBe(2)
    const y2022 = result.data.find(p => p.key === '2022')
    expect(y2022?.checklists).toBe(1)
  })

  it('gap-filled periods have zero checklists', () => {
    const observations = [obs('2019-01-01', 1), obs('2022-01-01', 1)]
    const result = buildGraphData(observations, [], 'yearly')
    const y2020 = result.data.find(p => p.key === '2020')
    expect(y2020?.checklists).toBe(0)
    const y2021 = result.data.find(p => p.key === '2021')
    expect(y2021?.checklists).toBe(0)
  })

  it('uses monthly keys when interval is monthly', () => {
    const observations = [obs('2023-03-01', 1), obs('2023-06-15', 2), obs('2023-09-01', 1)]
    const result = buildGraphData(observations, [], 'monthly')
    expect(result.interval).toBe('monthly')
    const keys = result.data.map(p => p.key)
    expect(keys).toContain('2023-03')
    expect(keys).toContain('2023-04')
    expect(keys).toContain('2023-05')
    expect(keys).toContain('2023-06')
    expect(keys).toContain('2023-09')
  })

  it('treats null count as 0', () => {
    const observations = [obs('2021-01-01', null), obs('2022-01-01', 3)]
    const result = buildGraphData(observations, [], 'yearly')
    const y2021 = result.data.find(p => p.key === '2021')
    expect(y2021?.individuals).toBe(0)
    // checklists still counts the row even when count is null
    expect(y2021?.checklists).toBe(1)
  })

  it('counts ML rows by format and maps them to the correct period', () => {
    const observations = [obs('2021-05-01', 1), obs('2022-05-01', 1)]
    const ml = [
      mlRow('2021-05-01', 'Photo'),
      mlRow('2021-06-01', 'Photo'),
      mlRow('2021-07-01', 'Audio'),
      mlRow('2022-05-01', 'Video'),
    ]
    const result = buildGraphData(observations, ml, 'yearly')
    const y2021 = result.data.find(p => p.key === '2021')
    expect(y2021?.photo).toBe(2)
    expect(y2021?.audio).toBe(1)
    expect(y2021?.video).toBe(0)
    const y2022 = result.data.find(p => p.key === '2022')
    expect(y2022?.video).toBe(1)
  })

  it('fills year gaps with zero values', () => {
    const observations = [obs('2019-01-01', 1), obs('2022-01-01', 1)]
    const result = buildGraphData(observations, [], 'yearly')
    const keys = result.data.map(p => p.key)
    expect(keys).toEqual(['2019', '2020', '2021', '2022'])
    const y2020 = result.data.find(p => p.key === '2020')
    expect(y2020?.individuals).toBe(0)
    expect(y2020?.photo).toBe(0)
  })

  it('fills month gaps in monthly mode', () => {
    const observations = [obs('2023-01-15', 1), obs('2023-04-10', 1)]
    const result = buildGraphData(observations, [], 'monthly')
    expect(result.interval).toBe('monthly')
    const keys = result.data.map(p => p.key)
    expect(keys).toEqual(['2023-01', '2023-02', '2023-03', '2023-04'])
  })

  it('handles ML rows with empty date gracefully', () => {
    const observations = [obs('2021-01-01', 1), obs('2022-01-01', 1)]
    const ml = [{ ...mlRow('2021-06-01', 'Photo'), date: '' }]
    expect(() => buildGraphData(observations, ml, 'yearly')).not.toThrow()
    const result = buildGraphData(observations, ml, 'yearly')
    const y2021 = result.data.find(p => p.key === '2021')
    expect(y2021?.photo).toBe(0) // empty-date row skipped
  })

  // ── Weekly interval ────────────────────────────────────────────────────────

  it('uses weekly keys when interval is weekly', () => {
    // 2024-01-10 is in ISO week 2 of 2024
    const observations = [obs('2024-01-10', 2), obs('2024-01-25', 3)]
    const result = buildGraphData(observations, [], 'weekly')
    expect(result.interval).toBe('weekly')
    const keys = result.data.map(p => p.key)
    expect(keys).toContain('2024-W02')
    expect(keys).toContain('2024-W04') // 2024-01-25 is week 4
  })

  it('buckets a known date into the correct ISO week', () => {
    // 2024-01-10 (Wednesday) → ISO week 2024-W02
    const observations = [obs('2024-01-10', 5), obs('2024-02-07', 2)]
    const result = buildGraphData(observations, [], 'weekly')
    const w2 = result.data.find(p => p.key === '2024-W02')
    expect(w2?.individuals).toBe(5)
  })

  it('fills gap weeks with zero values', () => {
    // 2024-W01 and 2024-W04 — weeks W02 and W03 should be gap-filled
    // 2024-01-03 is in W01, 2024-01-24 is in W04
    const observations = [obs('2024-01-03', 1), obs('2024-01-24', 1)]
    const result = buildGraphData(observations, [], 'weekly')
    const keys = result.data.map(p => p.key)
    expect(keys).toContain('2024-W01')
    expect(keys).toContain('2024-W02')
    expect(keys).toContain('2024-W03')
    expect(keys).toContain('2024-W04')
    const w2 = result.data.find(p => p.key === '2024-W02')
    expect(w2?.individuals).toBe(0)
    expect(w2?.checklists).toBe(0)
  })

  it('counts checklists per week correctly', () => {
    // Two observations in the same week, one in another
    // 2024-01-08 (Mon W02) and 2024-01-10 (Wed W02) both land in W02
    const observations = [obs('2024-01-08', 2), obs('2024-01-10', 3), obs('2024-01-22', 1)]
    const result = buildGraphData(observations, [], 'weekly')
    const w2 = result.data.find(p => p.key === '2024-W02')
    expect(w2?.checklists).toBe(2)
    expect(w2?.individuals).toBe(5)
    // 2024-01-22 is W04
    const w4 = result.data.find(p => p.key === '2024-W04')
    expect(w4?.checklists).toBe(1)
  })

  it('returns empty for weekly when only one distinct week', () => {
    const observations = [obs('2024-01-08', 1), obs('2024-01-10', 2)]
    const result = buildGraphData(observations, [], 'weekly')
    // Both in same week → only 1 key → data is empty (< 2 periods)
    expect(result.data).toHaveLength(0)
  })
})

describe('buildMediaGraphData', () => {
  it('returns empty when no rows', () => {
    const result = buildMediaGraphData([], 'monthly')
    expect(result).toEqual({ data: [], interval: 'monthly' })
  })

  it('returns empty when only one distinct period', () => {
    const rows = [mlRow('2024-03-01', 'Photo'), mlRow('2024-03-15', 'Audio')]
    const result = buildMediaGraphData(rows, 'monthly')
    expect(result.data).toHaveLength(0)
  })

  it('skips rows with empty date', () => {
    const rows = [
      { ...mlRow('2024-01-01', 'Photo'), date: '' },
      mlRow('2024-02-01', 'Audio'),
    ]
    const result = buildMediaGraphData(rows, 'monthly')
    expect(result.data).toHaveLength(0) // only 1 real date → < 2 periods
  })

  it('correctly counts photo/audio/video/total per month', () => {
    const rows = [
      mlRow('2024-01-05', 'Photo'),
      mlRow('2024-01-10', 'Photo'),
      mlRow('2024-01-20', 'Audio'),
      mlRow('2024-02-03', 'Video'),
      mlRow('2024-02-14', 'Photo'),
    ]
    const result = buildMediaGraphData(rows, 'monthly')
    expect(result.interval).toBe('monthly')
    const jan = result.data.find(p => p.key === '2024-01')!
    expect(jan.photo).toBe(2)
    expect(jan.audio).toBe(1)
    expect(jan.video).toBe(0)
    expect(jan.total).toBe(3)
    const feb = result.data.find(p => p.key === '2024-02')!
    expect(feb.photo).toBe(1)
    expect(feb.audio).toBe(0)
    expect(feb.video).toBe(1)
    expect(feb.total).toBe(2)
  })

  it('gap-fills zero-count months between real data', () => {
    const rows = [mlRow('2024-01-01', 'Photo'), mlRow('2024-04-01', 'Audio')]
    const result = buildMediaGraphData(rows, 'monthly')
    const keys = result.data.map(p => p.key)
    expect(keys).toEqual(['2024-01', '2024-02', '2024-03', '2024-04'])
    const feb = result.data.find(p => p.key === '2024-02')!
    expect(feb.photo).toBe(0)
    expect(feb.audio).toBe(0)
    expect(feb.video).toBe(0)
    expect(feb.total).toBe(0)
  })

  it('uses ISO week keys for weekly interval', () => {
    // 2024-01-10 → W02, 2024-01-31 → W05
    const rows = [mlRow('2024-01-10', 'Photo'), mlRow('2024-01-31', 'Audio')]
    const result = buildMediaGraphData(rows, 'weekly')
    expect(result.interval).toBe('weekly')
    const keys = result.data.map(p => p.key)
    expect(keys).toContain('2024-W02')
    expect(keys).toContain('2024-W05')
  })

  it('uses year keys for yearly interval', () => {
    const rows = [mlRow('2021-06-01', 'Photo'), mlRow('2023-09-01', 'Audio')]
    const result = buildMediaGraphData(rows, 'yearly')
    expect(result.interval).toBe('yearly')
    const keys = result.data.map(p => p.key)
    expect(keys).toEqual(['2021', '2022', '2023'])
  })

  it('total interval uses daily YYYY-MM-DD keys with no gap-fill', () => {
    const rows = [
      mlRow('2024-01-05', 'Photo'),
      mlRow('2024-01-05', 'Audio'),
      mlRow('2024-03-10', 'Video'),
    ]
    const result = buildMediaGraphData(rows, 'total')
    expect(result.interval).toBe('total')
    expect(result.data.map(p => p.key)).toEqual(['2024-01-05', '2024-03-10'])
    const jan = result.data.find(p => p.key === '2024-01-05')!
    expect(jan.photo).toBe(1)
    expect(jan.audio).toBe(1)
    expect(jan.video).toBe(0)
    expect(jan.total).toBe(2)
    // No gap-fill: 2024-02 and 2024-03 intermediate dates absent
    expect(result.data).toHaveLength(2)
  })

  it('total interval returns empty when only one distinct date', () => {
    const rows = [mlRow('2024-05-01', 'Photo'), mlRow('2024-05-01', 'Audio')]
    const result = buildMediaGraphData(rows, 'total')
    expect(result.data).toHaveLength(0)
  })
})

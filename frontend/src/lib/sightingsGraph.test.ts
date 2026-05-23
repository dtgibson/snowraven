import { describe, it, expect } from 'vitest'
import { buildGraphData } from './sightingsGraph'
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
  }
}

describe('buildGraphData', () => {
  it('returns empty when no observations', () => {
    const result = buildGraphData([], [], 'yearly')
    expect(result).toEqual({ data: [], useMonthly: false })
  })

  it('returns empty when only one time period (< 2 needed for a graph)', () => {
    const result = buildGraphData([obs('2023-06-01'), obs('2023-06-15')], [], 'yearly')
    expect(result.data).toHaveLength(0)
  })

  it('uses yearly keys when interval is yearly', () => {
    const observations = [obs('2021-03-01', 2), obs('2023-07-10', 5)]
    const result = buildGraphData(observations, [], 'yearly')
    expect(result.useMonthly).toBe(false)
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

  it('uses monthly keys when interval is monthly', () => {
    const observations = [obs('2023-03-01', 1), obs('2023-06-15', 2), obs('2023-09-01', 1)]
    const result = buildGraphData(observations, [], 'monthly')
    expect(result.useMonthly).toBe(true)
    const keys = result.data.map(p => p.key)
    // Gaps between Mar, Jun, Sep should be filled
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
    expect(result.useMonthly).toBe(true)
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
})

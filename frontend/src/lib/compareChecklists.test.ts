import { describe, it, expect } from 'vitest'
import { compareChecklists, parseCount, higherCount, formatObsDate, type ChecklistData } from './compareChecklists'

const NO_MEDIA = { photo: 0, audio: 0, video: 0 }
const cl = (species: [string, string, string][], locName = 'Loc', obsDt = '2024-01-01 06:30'): ChecklistData => ({
  locName, obsDt,
  species: species.map(([speciesCode, commonName, count]) => ({
    speciesCode, commonName, count, breedingCode: '', media: NO_MEDIA,
  })),
})

describe('compareChecklists', () => {
  const a = cl([['amerob', 'American Robin', '5'], ['bkcchi', 'Black-capped Chickadee', '2'], ['daejun', 'Dark-eyed Junco', 'X']])
  const b = cl([['amerob', 'American Robin', '3'], ['bkcchi', 'Black-capped Chickadee', '2'], ['houspa', 'House Sparrow', '8']])
  const r = compareChecklists(a, b)

  it('splits species into both / A-only / B-only by species code', () => {
    expect(r.both.map(x => x.speciesCode)).toEqual(['amerob', 'bkcchi'])
    expect(r.aOnly.map(x => x.speciesCode)).toEqual(['daejun'])
    expect(r.bOnly.map(x => x.speciesCode)).toEqual(['houspa'])
  })
  it('carries both counts on shared species', () => {
    expect(r.both[0]).toMatchObject({ commonName: 'American Robin', countA: '5', countB: '3' })
  })
  it('reports totals', () => {
    expect(r.totalA).toBe(3)
    expect(r.totalB).toBe(3)
  })
  it('preserves source order (A for both/aOnly, B for bOnly)', () => {
    expect(r.both.map(x => x.commonName)).toEqual(['American Robin', 'Black-capped Chickadee'])
    expect(r.bOnly[0].commonName).toBe('House Sparrow')
  })
  it('carries breeding code + media per side for shared and unique species', () => {
    const a: ChecklistData = { locName: 'L', obsDt: '2025-01-01', species: [
      { speciesCode: 'amerob', commonName: 'American Robin', count: '5', breedingCode: 'S1', media: { photo: 2, audio: 0, video: 0 } },
      { speciesCode: 'daejun', commonName: 'Dark-eyed Junco', count: '1', breedingCode: 'NY', media: { photo: 0, audio: 1, video: 0 } },
    ] }
    const b: ChecklistData = { locName: 'L', obsDt: '2025-01-02', species: [
      { speciesCode: 'amerob', commonName: 'American Robin', count: '3', breedingCode: 'CC', media: { photo: 0, audio: 0, video: 1 } },
    ] }
    const rr = compareChecklists(a, b)
    expect(rr.both[0]).toMatchObject({
      breedingA: 'S1', breedingB: 'CC',
      mediaA: { photo: 2, audio: 0, video: 0 }, mediaB: { photo: 0, audio: 0, video: 1 },
    })
    expect(rr.aOnly[0]).toMatchObject({ breedingA: 'NY', breedingB: null, mediaB: null })
  })
  it('carries each checklist location + date for identification', () => {
    const r2 = compareChecklists(
      cl([['amerob', 'American Robin', '1']], 'Central Park', '2025-05-01 07:00'),
      cl([['amerob', 'American Robin', '1']], 'Prospect Park', '2025-05-02 08:15'),
    )
    expect(r2.metaA).toEqual({ locName: 'Central Park', obsDt: '2025-05-01 07:00' })
    expect(r2.metaB).toEqual({ locName: 'Prospect Park', obsDt: '2025-05-02 08:15' })
  })
})

describe('formatObsDate', () => {
  it('formats a date+time', () => {
    // Locale-dependent exact string, so assert on the stable parts.
    const s = formatObsDate('2025-03-02 10:55')
    expect(s).toMatch(/2025/)
    expect(s).toMatch(/Mar/)
    expect(s).toMatch(/10:55/)
  })
  it('formats a date-only value without a time', () => {
    const s = formatObsDate('2025-03-02')
    expect(s).toMatch(/Mar/)
    expect(s).not.toMatch(/:/)
  })
  it('returns empty string for empty input', () => {
    expect(formatObsDate('')).toBe('')
  })
})

describe('parseCount', () => {
  it('parses integers and treats X / null as no count', () => {
    expect(parseCount('5')).toBe(5)
    expect(parseCount('X')).toBeNull()
    expect(parseCount(null)).toBeNull()
  })
})

describe('higherCount', () => {
  it('emphasizes the strictly-higher numeric count', () => {
    expect(higherCount('5', '3')).toBe('a')
    expect(higherCount('3', '5')).toBe('b')
  })
  it('returns null for ties or when either side is presence-only', () => {
    expect(higherCount('2', '2')).toBeNull()
    expect(higherCount('5', 'X')).toBeNull()
    expect(higherCount('X', 'X')).toBeNull()
  })
})

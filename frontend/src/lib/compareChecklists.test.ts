import { describe, it, expect } from 'vitest'
import { compareChecklists, parseCount, higherCount, formatObsDate, type ChecklistData } from './compareChecklists'

const NO_MEDIA = { photo: 0, audio: 0, video: 0 }
const META = {
  protocolId: '', durationHrs: null, distanceKm: null, distanceUnit: '',
  numObservers: null, submissionMethod: '', submissionVersion: '', comments: '',
}
const cl = (species: [string, string, string][], locName = 'Loc', obsDt = '2024-01-01 06:30'): ChecklistData => ({
  locName, obsDt, ...META,
  species: species.map(([speciesCode, commonName, count]) => ({
    speciesCode, commonName, count, breedingCode: '', comments: '', media: NO_MEDIA,
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
    const a: ChecklistData = { locName: 'L', obsDt: '2025-01-01', ...META, species: [
      { speciesCode: 'amerob', commonName: 'American Robin', count: '5', breedingCode: 'S1', comments: '', media: { photo: 2, audio: 0, video: 0 } },
      { speciesCode: 'daejun', commonName: 'Dark-eyed Junco', count: '1', breedingCode: 'NY', comments: '', media: { photo: 0, audio: 1, video: 0 } },
    ] }
    const b: ChecklistData = { locName: 'L', obsDt: '2025-01-02', ...META, species: [
      { speciesCode: 'amerob', commonName: 'American Robin', count: '3', breedingCode: 'CC', comments: '', media: { photo: 0, audio: 0, video: 1 } },
    ] }
    const rr = compareChecklists(a, b)
    expect(rr.both[0]).toMatchObject({
      breedingA: 'S1', breedingB: 'CC',
      mediaA: { photo: 2, audio: 0, video: 0 }, mediaB: { photo: 0, audio: 0, video: 1 },
    })
    expect(rr.aOnly[0]).toMatchObject({ breedingA: 'NY', breedingB: null, mediaB: null })
  })
  it('carries per-species comments per side', () => {
    const a: ChecklistData = { locName: 'L', obsDt: '2025-01-01', ...META, species: [
      { speciesCode: 'amerob', commonName: 'American Robin', count: '5', breedingCode: '', comments: 'A robin note', media: NO_MEDIA },
      { speciesCode: 'daejun', commonName: 'Dark-eyed Junco', count: '1', breedingCode: '', comments: 'junco only on A', media: NO_MEDIA },
    ] }
    const b: ChecklistData = { locName: 'L', obsDt: '2025-01-02', ...META, species: [
      { speciesCode: 'amerob', commonName: 'American Robin', count: '3', breedingCode: '', comments: 'B robin note', media: NO_MEDIA },
    ] }
    const rr = compareChecklists(a, b)
    expect(rr.both[0]).toMatchObject({ commentsA: 'A robin note', commentsB: 'B robin note' })
    expect(rr.aOnly[0]).toMatchObject({ commentsA: 'junco only on A', commentsB: '' })
  })
  it('carries each checklist location + date for identification', () => {
    const r2 = compareChecklists(
      cl([['amerob', 'American Robin', '1']], 'Central Park', '2025-05-01 07:00'),
      cl([['amerob', 'American Robin', '1']], 'Prospect Park', '2025-05-02 08:15'),
    )
    expect(r2.metaA).toMatchObject({ locName: 'Central Park', obsDt: '2025-05-01 07:00' })
    expect(r2.metaB).toMatchObject({ locName: 'Prospect Park', obsDt: '2025-05-02 08:15' })
  })
  it('carries effort metadata into the per-checklist meta', () => {
    const a: ChecklistData = {
      locName: 'L', obsDt: '2025-01-01', protocolId: 'P22', durationHrs: 0.95,
      distanceKm: 1.83, distanceUnit: 'mi', numObservers: 1,
      submissionMethod: 'EBIRD_iOS', submissionVersion: '3.6.5', comments: 'cloudy',
      species: [{ speciesCode: 'amerob', commonName: 'American Robin', count: '1', breedingCode: '', comments: '', media: NO_MEDIA }],
    }
    const rr = compareChecklists(a, cl([['amerob', 'American Robin', '1']]))
    expect(rr.metaA).toMatchObject({
      protocolId: 'P22', durationHrs: 0.95, distanceKm: 1.83, distanceUnit: 'mi',
      numObservers: 1, submissionMethod: 'EBIRD_iOS', comments: 'cloudy',
    })
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

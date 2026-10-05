/// <reference types="node" />
// The First of Year derivation (species-first-of-year): QA-02 to QA-09 and
// QA-30 in prd.md, plus the declared well-formed-date scan (schema.md 7.1).
// The section, the chart and the tab are covered beside their own files; the
// filter parity at the tab level (QA-01's out-of-scope rows, QA-10) is in
// components/SpeciesDetailFirstOfYear.test.tsx.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import type { ObservationEntry } from '../types'
import { computeFirstOfYear, dayOfYear, isWellFormedDate } from './firstOfYear'
import { computeSightingsStats } from './speciesStats'
import { normalizeSpeciesName } from './speciesUtils'
import { bestPerCallCpuMs } from '../test/cpuTiming'

function obs(date: string, submissionId: string, commonName = 'American Robin', county: string | null = 'Alpha'): ObservationEntry {
  return {
    submissionId, commonName, scientificName: 'Turdus migratorius', date,
    location: 'Park', locationId: 'L1', latitude: null, longitude: null, county,
    count: 1, breedingCode: null, speciesComments: '', catalogIds: [],
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('isWellFormedDate (schema.md 7.1, FR-03)', () => {
  it('accepts exactly YYYY-MM-DD calendar dates, leap-aware', () => {
    for (const d of ['2024-01-01', '2024-02-29', '2000-02-29', '2023-12-31', '1999-04-30', '0000-01-01', '9999-12-31']) {
      expect(isWellFormedDate(d), d).toBe(true)
    }
  })

  it('refuses every other shape, including the PRD\'s malformed rows (QA-04)', () => {
    const refused = [
      '', '2024-13-01', '2023-02-29', '24-03-01', '2024-3-1',
      '1900-02-29', '2024-00-10', '2024-04-31', '2024-04-00', '2024/04/10', '2024-04-10 ',
      ' 2024-04-10', '2024-04-1x', '20240410', '2024-04-10T00:00',
      // Ten characters, with U+2010 HYPHEN where the ASCII hyphens belong.
      '2024\u201004\u201010',
      // Digits that are not ASCII: fullwidth and Arabic-Indic.
      '\uff12\uff10\uff12\uff14-04-10', '2024-\u0660\u0664-10',
      // Right length, wrong separators or a sign.
      '2024+04-10', '-024-04-10', '2024-04--1',
    ]
    for (const d of refused) expect(isWellFormedDate(d), JSON.stringify(d)).toBe(false)
    // The non-ASCII probes are the right length, so each is refused by its
    // characters, not by the length check.
    for (const d of ['2024\u201004\u201010', '\uff12\uff10\uff12\uff14-04-10', '2024-\u0660\u0664-10']) expect(d).toHaveLength(10)
  })

  it('reads at most ten characters whatever the cell holds: the length check runs first', () => {
    // The declared bound, held structurally rather than by timing: every
    // character read goes through charCodeAt, counted over the whole call.
    const spy = vi.spyOn(String.prototype, 'charCodeAt')
    for (const d of ['2024-04-10', '2024-02-30', 'x'.repeat(1_000_000), '2024-04-10'.repeat(100_000), '']) {
      spy.mockClear()
      isWellFormedDate(d)
      expect(spy.mock.calls.length, `${d.length} chars`).toBeLessThanOrEqual(10)
    }
    // Non-vacuity: a well-formed date really is read, all ten characters' worth
    // of checks (two hyphens and eight digits).
    spy.mockClear()
    expect(isWellFormedDate('2024-04-10')).toBe(true)
    expect(spy.mock.calls.length).toBe(10)
  })
})

describe('dayOfYear (FR-05, QA-06)', () => {
  it('is leap-aware at the PRD\'s boundary dates', () => {
    const cases: Array<[string, number]> = [
      ['2024-01-01', 1], ['2024-02-29', 60], ['2024-03-01', 61], ['2023-03-01', 60],
      ['2024-12-31', 366], ['2023-12-31', 365], ['2000-03-01', 61], ['1900-03-01', 60],
    ]
    for (const [d, n] of cases) expect(dayOfYear(d), d).toBe(n)
  })

  it('counts every day of a leap and a common year exactly once, in order', () => {
    const daysIn = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    for (const [year, feb] of [['2024', 29], ['2023', 28]] as const) {
      let expected = 0
      for (let m = 1; m <= 12; m++) {
        const len = m === 2 ? feb : daysIn[m - 1]
        for (let d = 1; d <= len; d++) {
          expected += 1
          const date = `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
          expect(dayOfYear(date)).toBe(expected)
        }
      }
      expect(expected).toBe(year === '2024' ? 366 : 365)
    }
  })

  it('is NaN for a date the shape check refuses', () => {
    expect(dayOfYear('2023-02-29')).toBeNaN()
    expect(dayOfYear('')).toBeNaN()
  })
})

describe('computeFirstOfYear', () => {
  it('returns no rows for no observations', () => {
    expect(computeFirstOfYear([])).toEqual([])
  })

  it('keeps the smallest date in a year (QA-02)', () => {
    const rows = computeFirstOfYear([
      obs('2023-04-02', 'S1'), obs('2023-03-30', 'S2'), obs('2023-11-01', 'S3'),
    ])
    expect(rows).toEqual([{ year: 2023, date: '2023-03-30', dayOfYear: 89, submissionId: 'S2' }])
  })

  it('resolves a tie to the first row in file order, exactly as First seen does (QA-03)', () => {
    const a = obs('2022-05-05', 'S100')
    const b = obs('2022-05-05', 'S200')
    expect(computeFirstOfYear([a, b])[0].submissionId).toBe('S100')
    expect(computeFirstOfYear([b, a])[0].submissionId).toBe('S200')
    expect(computeFirstOfYear([a, b])[0].submissionId).toBe(computeSightingsStats([a, b])!.firstObs.submissionId)
    expect(computeFirstOfYear([b, a])[0].submissionId).toBe(computeSightingsStats([b, a])!.firstObs.submissionId)
  })

  it('skips malformed dates: they neither make a year nor become one (QA-04)', () => {
    const malformed = ['', '2024-13-01', '2023-02-29', '24-03-01', '2024-3-1']
    // Alone, they produce nothing.
    expect(computeFirstOfYear(malformed.map((d, i) => obs(d, `S${i}`)))).toEqual([])
    // Beside a sibling in the same year, the sibling is chosen, though every
    // malformed string here sorts before it.
    const rows = computeFirstOfYear([
      ...malformed.map((d, i) => obs(d, `S${i}`)),
      obs('2024-06-15', 'S9'), obs('2023-07-01', 'S8'),
    ])
    expect(rows.map(r => [r.year, r.date, r.submissionId])).toEqual([[2023, '2023-07-01', 'S8'], [2024, '2024-06-15', 'S9']])
  })

  it('returns one row per year present, ascending, with no row for a gap year (QA-07)', () => {
    const rows = computeFirstOfYear([
      obs('2022-04-20', 'S1'), obs('2019-05-01', 'S2'), obs('2021-04-11', 'S3'), obs('2022-04-18', 'S4'),
    ])
    expect(rows.map(r => r.year)).toEqual([2019, 2021, 2022])
    expect(rows[2]).toEqual({ year: 2022, date: '2022-04-18', dayOfYear: 108, submissionId: 'S4' })
  })

  it('treats the current year as an ordinary year (QA-08)', () => {
    // A test may read the clock; the derivation may not (the source scan below).
    const year = new Date().getFullYear()
    const rows = computeFirstOfYear([obs(`${year}-03-04`, 'S1'), obs(`${year}-01-30`, 'S2'), obs('2019-05-01', 'S3')])
    expect(rows.map(r => r.year)).toEqual([2019, year])
    expect(rows[1]).toEqual({ year, date: `${year}-01-30`, dayOfYear: 30, submissionId: 'S2' })
  })

  it('reads only the date and the submission id of each observation', () => {
    const read = new Set<string>()
    const spied = new Proxy(obs('2024-04-10', 'S1'), {
      get(target, key, receiver) { read.add(String(key)); return Reflect.get(target, key, receiver) },
    })
    computeFirstOfYear([spied])
    expect([...read].sort()).toEqual(['date', 'submissionId'])
  })
})

describe('no Date and no clock (FR-04, FR-07, NFR-08: QA-05, QA-08)', () => {
  const fixture = [
    obs('2024-02-29', 'S1'), obs('2024-03-01', 'S2'), obs('2023-12-31', 'S3'), obs('2000-02-29', 'S4'),
  ]
  const expected = [
    { year: 2000, date: '2000-02-29', dayOfYear: 60, submissionId: 'S4' },
    { year: 2023, date: '2023-12-31', dayOfYear: 365, submissionId: 'S3' },
    { year: 2024, date: '2024-02-29', dayOfYear: 60, submissionId: 'S1' },
  ]

  it('gives the right answer with Date replaced by a constructor that throws', () => {
    const Throwing = function () { throw new Error('the derivation constructed a Date') } as unknown as DateConstructor
    Object.assign(Throwing, { now: () => { throw new Error('the derivation read the clock') } })
    vi.stubGlobal('Date', Throwing)
    // Non-vacuity: the stub is really in place.
    expect(() => new Date()).toThrow(/constructed a Date/)
    expect(() => Date.now()).toThrow(/read the clock/)
    expect(computeFirstOfYear(fixture)).toEqual(expected)
    expect(dayOfYear('2024-02-29')).toBe(60)
    expect(isWellFormedDate('2024-02-29')).toBe(true)
  })

  it('is byte-identical under UTC, America/Los_Angeles and Pacific/Kiritimati', () => {
    const before = process.env.TZ
    const out: string[] = []
    const control: string[] = []
    try {
      for (const tz of ['UTC', 'America/Los_Angeles', 'Pacific/Kiritimati']) {
        process.env.TZ = tz
        out.push(JSON.stringify(computeFirstOfYear(fixture)))
        // Non-vacuity: the zone really changed for anything that DID use a Date.
        control.push(new Date(2024, 1, 29).toISOString())
      }
    } finally {
      if (before === undefined) delete process.env.TZ
      else process.env.TZ = before
    }
    expect(new Set(control).size).toBe(3)
    expect(new Set(out).size).toBe(1)
    expect(JSON.parse(out[0])).toEqual(expected)
  })

  it('the source constructs no Date and reads no clock', () => {
    const src = readFileSync(new URL('./firstOfYear.ts', import.meta.url), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n').filter(l => !l.trim().startsWith('//')).join('\n')
    expect(src).toContain('export function computeFirstOfYear(')   // the scan reads the real module
    for (const banned of [/\bnew Date\b/, /\bDate\.now\b/, /\bDate\(/, /performance\.now/, /\bIntl\./, /toLocale/]) {
      expect(src).not.toMatch(banned)
    }
  })
})

// ---- FR-08 / QA-09: the First seen invariant over randomized fixtures ------
//
// The in-scope set is built exactly as SpeciesDetail.tsx builds `speciesObs`
// (merge by normalized name or exact name, then county, then the inclusive
// string date range), and the property is checked under every combination of
// those switches. Show all forms and Show escapees decide which species the
// selector OFFERS, never which rows a selected species has, so they are not
// inputs here; the tab-level test toggles them and finds the rows unchanged.

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const NAMES = [
  'Yellow-rumped Warbler', 'Yellow-rumped Warbler (Myrtle)', "Yellow-rumped Warbler (Audubon's)",
  'Mallard', 'Mallard x American Black Duck (hybrid)', 'Muscovy Duck (Domestic type)', 'Muscovy Duck',
]
const MALFORMED = ['', '2024-13-01', '2023-02-29', '24-03-01', '2024-3-1']

function randomFixture(rand: () => number, size: number): ObservationEntry[] {
  const out: ObservationEntry[] = []
  for (let i = 0; i < size; i++) {
    const name = NAMES[Math.floor(rand() * NAMES.length)]
    const county = rand() < 0.5 ? 'Alpha' : 'Beta'
    let date: string
    if (rand() < 0.06) {
      date = MALFORMED[Math.floor(rand() * MALFORMED.length)]
    } else {
      const y = 2015 + Math.floor(rand() * 12)
      const m = 1 + Math.floor(rand() * 12)
      const d = 1 + Math.floor(rand() * 28)
      date = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    }
    // A small id pool so equal dates on different checklists (ties) are common.
    out.push(obs(date, `S${1 + Math.floor(rand() * size)}`, name, county))
  }
  return out
}

function inScope(all: ObservationEntry[], species: string, merge: boolean, county: string | null, range: { from: string; to: string }): ObservationEntry[] {
  const base = merge
    ? all.filter(o => normalizeSpeciesName(o.commonName) === species)
    : all.filter(o => o.commonName === species)
  return base.filter(o => {
    if (county !== null && o.county !== county) return false
    if (range.from && o.date < range.from) return false
    if (range.to && o.date > range.to) return false
    return true
  })
}

describe('FR-08: the earliest row is First seen whenever First seen is well formed (QA-09)', () => {
  it('holds over randomized fixtures under every switch and filter combination', () => {
    const rand = mulberry32(20261003)
    let checked = 0
    let skippedMalformed = 0
    for (let f = 0; f < 120; f++) {
      const all = randomFixture(rand, 20 + Math.floor(rand() * 60))
      for (const species of ['Yellow-rumped Warbler', 'Mallard', 'Muscovy Duck', "Yellow-rumped Warbler (Audubon's)"]) {
        for (const merge of [true, false]) {
          for (const county of [null, 'Alpha']) {
            for (const range of [{ from: '', to: '' }, { from: '2018-03-01', to: '2024-10-31' }]) {
              const scope = inScope(all, species, merge, county, range)
              const stats = computeSightingsStats(scope)
              const rows = computeFirstOfYear(scope)
              if (!stats) { expect(rows).toEqual([]); continue }
              if (!isWellFormedDate(stats.firstObs.date)) { skippedMalformed += 1; continue }
              expect(rows.length).toBeGreaterThan(0)
              expect(rows[0].date).toBe(stats.firstObs.date)
              expect(rows[0].submissionId).toBe(stats.firstObs.submissionId)
              checked += 1
            }
          }
        }
      }
    }
    // Non-vacuity: the property was exercised many times, and the fixtures did
    // reach the case the PRD excludes (a malformed First seen).
    expect(checked).toBeGreaterThan(1000)
    expect(skippedMalformed).toBeGreaterThan(0)
  })
})

// ---- NFR-03 / QA-30: one pass, and a sort over the per-year results only ---

/** `n` observations spread over `years` years, newest first in file order so
 *  the kept row is replaced as often as possible. */
function generated(n: number, years: number): ObservationEntry[] {
  const out: ObservationEntry[] = []
  for (let i = 0; i < n; i++) {
    const y = 2026 - (i % years)
    const doy = 365 - Math.floor(i / years) % 365
    const m = Math.min(12, 1 + Math.floor((doy - 1) / 31))
    const d = 1 + ((doy - 1) % 28)
    out.push(obs(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, `S${i + 1}`))
  }
  return out
}

describe('linear derivation (NFR-03, QA-30)', () => {
  it('walks the observations once and sorts at most the per-year rows', () => {
    const input = generated(100_000, 30)
    let steps = 0
    const counting = {
      [Symbol.iterator]: function* () { for (const o of input) { steps += 1; yield o } },
    } as unknown as readonly ObservationEntry[]
    const sortSizes: number[] = []
    const sort = Array.prototype.sort
    const spy = vi.spyOn(Array.prototype, 'sort').mockImplementation(function (this: unknown[], cmp?: (a: unknown, b: unknown) => number) {
      sortSizes.push(this.length)
      return sort.call(this, cmp) as unknown[]
    })
    const rows = computeFirstOfYear(counting)
    spy.mockRestore()   // before any assertion, so only the derivation's sorts are counted
    expect(steps).toBe(100_000)
    expect(rows).toHaveLength(30)
    expect(sortSizes).toEqual([30])
  })

  it('ten times the rows costs about ten times the CPU time, not a hundred', () => {
    const small = generated(10_000, 30)
    const large = generated(100_000, 30)
    let complete = true
    const { perCall: [s, l] } = bestPerCallCpuMs([
      () => { complete = computeFirstOfYear(small).length === 30 && complete },
      () => { complete = computeFirstOfYear(large).length === 30 && complete },
    ], { rounds: 7 })
    expect(complete).toBe(true)
    // Linear is 10; a quadratic scan reads 100. 16 sits between, with room for
    // the collector and for an efficiency core.
    expect(l / s, `10k=${s.toFixed(3)}ms 100k=${l.toFixed(3)}ms CPU`).toBeLessThan(16)
  }, 30_000)
})

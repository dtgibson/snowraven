/// <reference types="node" />
// eBird's frequency figures (targets-tab, schema.md sections 2.2 and 2.6;
// FR-31 to FR-33, NFR-11).
//
// THE FIGURES ARE NEVER RE-TYPED. On the synthetic fixture every expected
// number is recomputed HERE from the fixture's own bytes by an independent
// reader (plain `split`, which is fine in a test over a 3 KB file the test
// owns), so the assertion is "the module agrees with the definition applied to
// the same numbers", not "the module agrees with a number someone copied out of
// it". And the fixture carries a row on which the two methods DIFFER, so the
// method switch is actually discriminated rather than passing either way
// (testing.md: a fixture must contain a row that separates the twins).
//
// THE ALAMEDA PIN (FR-33, NFR-11) runs against `alameda.fixture.json`, written
// by `node scripts/barchart-pin.mjs <file> --fixture ...` from the user's real
// Alameda bar-chart file (pinned 2026-09-27: 645 rows, 0 malformed, 0
// zero-sample periods; Lincoln's Sparrow year-round sample-weighted 3.29 against
// period-mean 3.16). Every figure it asserts is read from the fixture, where the
// shipped code printed it; the one literal is `3.29`, which is eBird's Targets
// page, the external ground truth the pin exists to match.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseBarChart, type BarChartFile } from './parseBarChart'
import {
  ALL_PERIODS, FREQUENCY_METHOD, barChartRange, formatPercent, frequencyPercent,
  monthPeriods, monthsPresentFromSamples, thisMonthPercent, yearRoundPercent,
} from './barChartFrequency'

const SYNTHETIC_TEXT = readFileSync(new URL('./barchart-synthetic.fixture.txt', import.meta.url), 'utf8')
const parsed = parseBarChart(SYNTHETIC_TEXT)
if (!parsed.ok) throw new Error('synthetic fixture must parse')
const FILE: BarChartFile = parsed.file

/** The independent reader: the Sample Size row and one named species row, as
 *  numbers, straight off the fixture text. */
function oracleRow(prefix: string): number[] {
  const line = SYNTHETIC_TEXT.split('\n').find(l => l.startsWith(prefix))!
  return line.split('\t').slice(1, 49).map(c => (c.trim() === '' ? 0 : Number(c)))
}
const N = oracleRow('Sample Size:')

function oracleWeighted(freqs: number[], periods: readonly number[]): number | null {
  let num = 0, den = 0
  for (const p of periods) if (N[p] > 0) { num += freqs[p] * N[p]; den += N[p] }
  return den > 0 ? (100 * num) / den : null
}
function oracleMean(freqs: number[], periods: readonly number[]): number | null {
  const used = periods.filter(p => N[p] > 0)
  return used.length ? (100 * used.reduce((s, p) => s + freqs[p], 0)) / used.length : null
}

const row = (name: string) => FILE.rows.find(r => r.name === name)!

describe('the derivation, on the synthetic fixture', () => {
  it('ships sample-weighted as the method (schema.md 2.2)', () => {
    expect(FREQUENCY_METHOD).toBe('sample-weighted')
  })

  it('the parser read the same numbers the oracle reads', () => {
    expect(FILE.sampleSizes).toEqual(N)
    expect(row('Bushtit').freqs).toEqual(oracleRow('Bushtit'))
  })

  it.each(['Lincoln\'s Sparrow', 'Dark-eyed Junco', 'Bushtit', 'Wrentit'])('%s: year-round equals the definition applied to the fixture', (name) => {
    const f = name === 'Lincoln\'s Sparrow' ? oracleRow('Lincoln') : oracleRow(name)
    expect(yearRoundPercent(row(name), FILE.sampleSizes)).toBeCloseTo(oracleWeighted(f, ALL_PERIODS)!, 10)
    expect(yearRoundPercent(row(name), FILE.sampleSizes, 'period-mean')).toBeCloseTo(oracleMean(f, ALL_PERIODS)!, 10)
  })

  it('this month is the month\'s four periods, for every month', () => {
    const f = oracleRow('Bushtit')
    for (let m = 1; m <= 12; m++) {
      const want = oracleWeighted(f, monthPeriods(m))
      const got = thisMonthPercent(row('Bushtit'), FILE.sampleSizes, m)
      if (want === null) expect(got).toBeNull()
      else expect(got).toBeCloseTo(want, 10)
    }
  })

  it('a month with no checklists at all has no figure (the zero denominator is null, not 0)', () => {
    // February: every period's sample size is 0 in the fixture.
    expect(monthPeriods(2).map(p => N[p])).toEqual([0, 0, 0, 0])
    expect(thisMonthPercent(row('Bushtit'), FILE.sampleSizes, 2)).toBeNull()
    expect(thisMonthPercent(row('Bushtit'), FILE.sampleSizes, 2, 'period-mean')).toBeNull()
    expect(frequencyPercent(row('Bushtit').freqs, FILE.sampleSizes, [])).toBeNull()
  })

  it('a zero-sample period contributes nothing even when its frequency is not zero', () => {
    const freqs = new Array(48).fill(0)
    const sizes = new Array(48).fill(0)
    freqs[0] = 1; sizes[0] = 0          // a figure with no checklists behind it
    freqs[1] = 0.5; sizes[1] = 10
    expect(frequencyPercent(freqs, sizes, [0, 1])).toBe(50)
    expect(frequencyPercent(freqs, sizes, [0, 1], 'period-mean')).toBe(50)
  })

  it('the two methods DIFFER to two decimals on the designated row (the pin can discriminate them)', () => {
    const lisp = row('Lincoln\'s Sparrow')
    const w = formatPercent(yearRoundPercent(lisp, FILE.sampleSizes, 'sample-weighted')!)
    const m = formatPercent(yearRoundPercent(lisp, FILE.sampleSizes, 'period-mean')!)
    expect(w).not.toBe(m)
  })

  it('formatPercent is two decimals', () => {
    expect(formatPercent(3.2851)).toBe('3.29')
    expect(formatPercent(0)).toBe('0.00')
  })
})

describe('the range a file covers (FR-30, FR-32)', () => {
  it('months present from sample sizes: February is absent, the rest present', () => {
    const m = monthsPresentFromSamples(FILE.sampleSizes)
    expect(m.filter(Boolean)).toHaveLength(11)
    expect(m[1]).toBe(false)
  })

  it('the filename governs when it carries a range', () => {
    const r = barChartRange(FILE, 'ebird_US-CA-001__1900_2026_1_12_barchart.txt')
    expect(r).toEqual({ years: [1900, 2026], months: new Array(12).fill(true), fullYear: true })
    const narrow = barChartRange(FILE, 'ebird_US-CA-001__2015_2026_3_5_barchart.txt')
    expect(narrow.years).toEqual([2015, 2026])
    expect(narrow.months.filter(Boolean)).toHaveLength(3)
    expect(narrow.fullYear).toBe(false)
  })

  it('without a range in the name, months come from the sample sizes and years are unknown', () => {
    const r = barChartRange(FILE, 'barchart.txt')
    expect(r.years).toBeNull()
    expect(r.months).toEqual(monthsPresentFromSamples(FILE.sampleSizes))
    expect(r.fullYear).toBe(false)
  })

  it('a malformed eBird-shaped name does not supply a range', () => {
    expect(barChartRange(FILE, 'ebird_CA-ON__1900_2026_1_12_barchart.txt').years).toBeNull()
  })
})

// ── The Alameda pin (schema.md section 2.6) ─────────────────────────────────
// Read unconditionally: the fixture is committed, so a missing or renamed file
// is a red suite, never a silently skipped pin.
type Method = 'sample-weighted' | 'period-mean'
interface Figures { yearRound: string; september: string }
/** Written by `node scripts/barchart-pin.mjs <file> --fixture <out>` from the
 *  real file: every figure printed by the shipped code under BOTH methods
 *  (`'none'` where a range has no checklists at all), and the method that
 *  printed 3.29. Public eBird figures; nothing of the user's. */
interface AlamedaFixture {
  filename: string
  method: Method
  zeroSamplePeriods: number
  sampleSizes: number[]
  rows: { name: string; role: 'pin' | 'most-frequent' | 'least-frequent'; freqs: number[]; figures: Record<Method, Figures> }[]
}
const fx = JSON.parse(readFileSync(new URL('./alameda.fixture.json', import.meta.url), 'utf8')) as AlamedaFixture
const METHODS: readonly Method[] = ['sample-weighted', 'period-mean']
const printed = (v: number | null) => (v === null ? 'none' : v.toFixed(2))
const lispFx = fx.rows.find(r => r.role === 'pin')!

describe('the Alameda pin (FR-33, NFR-11)', () => {
  it('the fixture is the user\'s Alameda download: 48 sample sizes, the pin row and a common species', () => {
    expect(fx.filename).toMatch(/^ebird_US-CA-001__/)
    expect(fx.sampleSizes).toHaveLength(48)
    expect(lispFx.name).toBe('Lincoln\'s Sparrow')
    expect(fx.rows.map(r => r.role)).toEqual(expect.arrayContaining(['pin', 'most-frequent', 'least-frequent']))
    for (const r of fx.rows) expect(r.freqs, r.name).toHaveLength(48)
  })

  it('the pinned method is the shipped FREQUENCY_METHOD', () => {
    expect(fx.method).toBe(FREQUENCY_METHOD)
  })

  it('Lincoln\'s Sparrow reads 3.29 year-round under FREQUENCY_METHOD, as eBird\'s Targets page does', () => {
    const shipped = frequencyPercent(lispFx.freqs, fx.sampleSizes, ALL_PERIODS)!
    expect(shipped.toFixed(2)).toBe('3.29')
    expect(shipped.toFixed(2)).toBe(lispFx.figures[fx.method].yearRound)
  })

  it('every fixture row reproduces the figures printed from the real file, under both methods', () => {
    for (const r of fx.rows) {
      for (const k of METHODS) {
        expect(printed(frequencyPercent(r.freqs, fx.sampleSizes, ALL_PERIODS, k)), `${r.name} ${k}`).toBe(r.figures[k].yearRound)
        expect(printed(frequencyPercent(r.freqs, fx.sampleSizes, monthPeriods(9), k)), `${r.name} ${k}`).toBe(r.figures[k].september)
      }
      // The shipped default and the hooks the Targets tab calls print the pinned method's figures.
      expect(printed(yearRoundPercent({ name: r.name, sciName: null, freqs: r.freqs }, fx.sampleSizes)), r.name).toBe(r.figures[fx.method].yearRound)
      expect(printed(thisMonthPercent({ name: r.name, sciName: null, freqs: r.freqs }, fx.sampleSizes, 9)), r.name).toBe(r.figures[fx.method].september)
    }
  })

  it('the pin DISCRIMINATES the methods: Lincoln\'s Sparrow prints differently under each, and the shipped default prints the pinned one', () => {
    const [other] = METHODS.filter(k => k !== fx.method)
    expect(lispFx.figures[fx.method].yearRound).not.toBe(lispFx.figures[other].yearRound)
    // So flipping FREQUENCY_METHOD moves the shipped figure off the pin.
    const shipped = printed(frequencyPercent(lispFx.freqs, fx.sampleSizes, ALL_PERIODS))
    expect(shipped).toBe(lispFx.figures[fx.method].yearRound)
    expect(shipped).not.toBe(lispFx.figures[other].yearRound)
  })

  it('zero-sample periods: the real file has none, so that case is carried by the synthetic fixture', () => {
    // A long-range county file (1900-2026) has checklists in every period, so
    // the Alameda download holds no zero-sample period and none is invented
    // here. The fixture records the count the script measured; it must agree
    // with the sample sizes it carries, and whenever it is zero the synthetic
    // fixture's February (asserted above) is what covers the null denominator.
    expect(fx.zeroSamplePeriods).toBe(fx.sampleSizes.filter(n => n === 0).length)
    expect(fx.zeroSamplePeriods > 0 || N.some(n => n === 0)).toBe(true)
    // The zero TERM (a period with checklists where the species was not
    // reported) is in the real data: the least-frequent row is zero in most periods.
    const rare = fx.rows.find(r => r.role === 'least-frequent')!
    expect(rare.freqs.some(f => f === 0)).toBe(true)
  })
})

// LINEARITY over untrusted export text (weather-stats NFR-03, QA-34).
//
// The weather-block parser scans checklist comments on a thread that may be the
// main thread (the stats worker's fallback path), so a superlinear scan here is
// a frozen window rather than a slow function. This file measures the two
// EXPORTED ENTRY POINTS -- never a regex literal, never an inner helper -- at
// 10k / 20k / 40k and requires roughly 2x growth per doubling.
//
// WHY THE FIXTURES LOOK THE WAY THEY DO, which is the part that has gone wrong
// before in this repo. A hostile input must make the pattern FAIL AFTER
// CONSUMING THE RUN. A greedy quantifier that swallows the run and then matches
// never backtracks, so a fixture where the match SUCCEEDS at the first start
// position is linear under the very pattern that takes seconds on a near-miss,
// and it will certify a broken build. Every shape below ends in a near miss: a
// `°C` the number pattern cannot accept, an emoji run with no member in it, an
// unclosed `<a`.
//
// THE THRESHOLD IS A SAME-RUN QUOTIENT, not a wall clock wearing a ratio's
// clothes. Both legs of every comparison are measured in the same process
// against each other, so the machine cancels: a linear scan gives ~2, the
// quadratic ancestors of these patterns measured 4.00x per doubling. The
// ceiling sits between them with margin on both sides and means the same thing
// on a laptop, under parallel test load, and on a shared CI runner. Both legs
// are read in CPU time, not wall time (`src/test/cpuTiming.ts`): the wall
// clock also counts the time another process held the core, and beside two
// looping full suites it failed this file in 7 of 20 runs with nothing wrong,
// at up to 8.60 against 3.
//
// IT WAS WATCHED GOING RED BEFORE ANY GREEN READING FROM IT WAS TRUSTED. The
// header walk was mutated to re-scan its whole prefix per code point -- a
// plausible wrong implementation of the same function, not a strawman -- and
// measured at 1,250 / 2,500 / 5,000 pictographs: shipped 0.26 / 0.43 / 0.35 ms
// (ratios 1.66, 0.80), mutated 24.43 / 96.22 / 385.43 ms (ratios 3.94, 4.01).
// At the sizes below the mutant did not finish inside a two-minute suite
// timeout at all. The ceiling of 3.0 sits between the two readings, so this is
// a measurement rather than an assertion.
//
// THE OTHER THREE LEGS a bound guard owes are here too: STRUCTURAL (the
// quantifiers really are bounded, asserted against the compiled patterns),
// NON-VACUITY (each hostile input actually reaches the scanned code, asserted
// through the record it produces), and PARITY -- which lives next door in
// `weatherBlockParse.test.ts`, whose formatter round trips prove the bounds
// never changed the answer for real content. Per `.claude/rules/testing.md`,
// judge a timing ratio only from a run with nothing else compiling.
import { describe, it, expect } from 'vitest'
import { parseWeatherBlock, hasAnyWeatherField } from './weatherBlockParse'
import { computeWeatherStats } from './weatherStats'
import { ATTRIBUTION } from './weatherFormatter'
import type { ChecklistEntry } from '../types'
import { bestPerCallCpuMs } from '../test/cpuTiming'

const SIZES = [10_000, 20_000, 40_000]
const RUNS = 7
/** Linear is ~2, the quadratic ancestors of these patterns measured 4.00. */
const MAX_RATIO_PER_DOUBLING = 3.0

function ratios<T>(sizes: readonly number[], make: (n: number, run: number) => T, run: (input: T) => void): number[] {
  // Build every input before timing: RUNS + 1 per size, one for the untimed
  // first call and one per round, so every timed call gets a distinct input.
  // Then the sizes are interleaved with a rotating start, best of RUNS each,
  // in CPU time (bestPerCallCpuMs, src/test/cpuTiming.ts). Grouping all 10k
  // runs before all 20k runs lets a single scheduler interruption inflate one
  // whole numerator while its denominator gets an otherwise quiet batch; CI
  // produced a false 4.54x reading that way. Interleaving keeps the quotient
  // same-run without weakening its 3x ceiling, and the CPU clock stops a wait
  // for a core counting as work.
  const inputs = sizes.map(n => Array.from({ length: RUNS + 1 }, (_, r) => make(n, r)))
  const next = sizes.map(() => 0)
  const { perCall, calls } = bestPerCallCpuMs(inputs.map((own, i) => () => run(own[next[i]++])), { rounds: RUNS, minSampleMs: 0 })
  expect(calls, 'one distinct input per call').toEqual(sizes.map(() => RUNS + 1))
  const out: number[] = []
  for (let i = 1; i < perCall.length; i++) {
    // A floor on the denominator so a sub-millisecond baseline cannot turn
    // timer granularity into a huge ratio.
    out.push(perCall[i] / Math.max(perCall[i - 1], 0.05))
  }
  return out
}

// ── The three hostile shapes ────────────────────────────────────────────────

/**
 * A numeric near miss. The bounded `/^-?\d{1,4}(?:\.\d{1,2})?$/` rejects at
 * length five rather than after consuming N digits, which is the whole point of
 * bounding it -- and the value-length bound refuses the run before the split
 * ever allocates.
 */
const numericNearMiss = (n: number, run: number) =>
  `⛅  Scattered clouds  Temperature: ${'5'.repeat(n + run)}°C  Wind: Calm  ${ATTRIBUTION}`

/**
 * An emoji header of N pictographs, none of them a condition and none a moon.
 * There is no early exit available, so this is the honest worst case for the
 * per-code-point header walk: linear only because every lookup is a `Set` hit.
 */
const emojiRun = (n: number, run: number) =>
  `${'🦅'.repeat(n + run)}  Temperature: 50°F  Wind: Calm  ${ATTRIBUTION}`

/**
 * Attribution spam with no closing tag. The shape whose unbounded ancestor was
 * measured at 4.00x per doubling in the superlinear sweep, re-run here because
 * this feature's span walk goes through that same pattern.
 */
const attributionSpam = (n: number, run: number) =>
  'weather generated by <a '.repeat(Math.max(1, Math.floor((n + run) / 24)))

const SHAPES: Array<[string, (n: number, run: number) => string]> = [
  ['numeric near miss', numericNearMiss],
  ['emoji run with no member', emojiRun],
  ['attribution spam', attributionSpam],
]

// ── Non-vacuity: each shape actually reaches the scanned code ───────────────

describe('the hostile inputs reach the code they are meant to measure', () => {
  it('the numeric near miss is parsed, and refuses the temperature rather than reading Celsius', () => {
    const r = parseWeatherBlock(numericNearMiss(200, 0))
    expect(r.temperature).toBeNull()
    // The block still READ -- so the scan really did run, and the fixture is not
    // being rejected by the detector gate before anything happens.
    expect(hasAnyWeatherField(r)).toBe(true)
    expect(r.wind).toEqual({ minIndex: 0, maxIndex: 0 })
  })

  it('the emoji run is walked, and yields no condition', () => {
    const r = parseWeatherBlock(emojiRun(200, 0))
    expect(r.condition).toBeNull()
    expect(r.dayNight).toBeNull()
    expect(r.temperature).toEqual({ low: 50, high: 50 })
  })

  it('the attribution spam reaches the span walk', () => {
    // It carries no labels, so it yields nothing -- but the detector fires on
    // the attribution phrase, which is what puts it through the span loop.
    const r = parseWeatherBlock(attributionSpam(2_400, 0))
    expect(hasAnyWeatherField(r)).toBe(false)
  })
})

// ── Structural: the quantifiers really are bounded ──────────────────────────

describe('every quantifier on the hostile path is length-bounded', () => {
  it('the pattern sources carry ceilings, and no unbounded whitespace before a colon', () => {
    // Read off the compiled patterns via the module's own behaviour rather than
    // by re-spelling them: an over-long value is refused, which is only true if
    // the bound exists.
    const long = 'Calm - '.repeat(200) + 'Calm'
    expect(parseWeatherBlock(`⛅  x  Wind: ${long}  ${ATTRIBUTION}`).wind).toBeNull()
    // A legitimate nine-label run is not refused, so the bound is a bound and
    // not a blanket.
    expect(parseWeatherBlock(`⛅  x  Wind: Calm - Gale  ${ATTRIBUTION}`).wind)
      .toEqual({ minIndex: 0, maxIndex: 8 })
  })

  it('a value with an enormous run of horizontal whitespace before its colon is not a label', () => {
    // `[^\S\n]{0,8}:` rather than `\s*:` -- the exact backtracking shape the
    // superlinear sweep removed six times. Nine spaces is past the ceiling, so
    // this is not a Temperature label at all and the field stays missing.
    const r = parseWeatherBlock(`⛅  x  Temperature${' '.repeat(9)}: 50°F  Wind: Calm  ${ATTRIBUTION}`)
    expect(r.temperature).toBeNull()
    // Eight is inside it.
    const ok = parseWeatherBlock(`⛅  x  Temperature${' '.repeat(8)}: 50°F  Wind: Calm  ${ATTRIBUTION}`)
    expect(ok.temperature).toEqual({ low: 50, high: 50 })
  })
})

// ── Timing ──────────────────────────────────────────────────────────────────

describe('parseWeatherBlock grows linearly on every hostile shape (NFR-03)', () => {
  for (const [name, make] of SHAPES) {
    it(`${name}: at most ${MAX_RATIO_PER_DOUBLING}x per doubling`, () => {
      const rs = ratios(SIZES, make, s => { parseWeatherBlock(s) })
      for (const r of rs) expect(r, `${name} ratios ${rs.map(x => x.toFixed(2)).join(', ')}`).toBeLessThan(MAX_RATIO_PER_DOUBLING)
    })
  }
})

describe('computeWeatherStats grows linearly on every hostile shape (NFR-03)', () => {
  const checklistWith = (comment: string): ChecklistEntry[] => ([{
    submissionId: 'S1', date: '2024-05-24', location: 'L', locationId: 'L1',
    latitude: null, longitude: null, county: null, stateProvince: null,
    time: null, duration: 60, distance: null, area: null, protocol: null,
    numObservers: null, allObsReported: null, checklistComments: comment,
    speciesCount: 3, individualCount: 3,
  }])

  for (const [name, make] of SHAPES) {
    it(`${name}: at most ${MAX_RATIO_PER_DOUBLING}x per doubling`, () => {
      const rs = ratios(SIZES, make, s => { computeWeatherStats(checklistWith(s), []) })
      for (const r of rs) expect(r, `${name} ratios ${rs.map(x => x.toFixed(2)).join(', ')}`).toBeLessThan(MAX_RATIO_PER_DOUBLING)
    })
  }

  it('scales linearly in the CHECKLIST count as well as the comment length', () => {
    // The other axis: many block-bearing comments rather than one enormous one,
    // which is the shape a real export actually has.
    const block = `⛅  Scattered clouds  Temperature: 55 - 60°F  Wind: Light breeze  ${ATTRIBUTION}`
    const make = (n: number, run: number): ChecklistEntry[] => {
      const out: ChecklistEntry[] = []
      for (let i = 0; i < n; i++) {
        out.push({
          submissionId: `S${run}_${i}`, date: '2024-05-24', location: 'L', locationId: 'L1',
          latitude: null, longitude: null, county: null, stateProvince: null,
          time: null, duration: 60, distance: null, area: null, protocol: null,
          numObservers: null, allObsReported: null, checklistComments: `${block} run ${run}`,
          speciesCount: 3, individualCount: 3,
        })
      }
      return out
    }
    // Through the same interleaved CPU-time ratios as every other row. It
    // timed each size's runs back to back by the wall clock, and read 3.16 to
    // 4.50 against 3 in 3 of 13 full-suite runs beside a second looping suite,
    // and 5.24 in one QA run, with nothing wrong.
    const rs = ratios([500, 1_000, 2_000], make, cls => { computeWeatherStats(cls, []) })
    for (const r of rs) {
      expect(r, `checklist-count ratios ${rs.map(x => x.toFixed(2)).join(', ')}`)
        .toBeLessThan(MAX_RATIO_PER_DOUBLING)
    }
    // An explicit budget: this row does about 0.2 s of real work on the dev
    // Mac, and a loaded machine that gives it a fifteenth of a core would put
    // it near vitest's 5 s default. A testTimeout cannot interrupt this
    // synchronous work anyway (testing.md v1.0.33); the ratios decide the row.
  }, 30_000)
})

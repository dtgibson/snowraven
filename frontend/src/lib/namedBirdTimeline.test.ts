// The pure geometry behind both Named Birds sighting timelines. Everything here
// is tested WITHOUT rendering, which is the point of putting it in a lib module:
// the NFR-04 budget needs a function to time, and the clamps need to be
// properties of this module rather than consequences of two other functions
// being right.

/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  birdAxis, buildLanes, distinctDates, laneSpan, markPositions, masterAxis, rangeEnd,
} from './namedBirdTimeline'
import { optionName } from './namedBirdTimelineCopy'
import type { NamedBird, NamedSighting } from './namedBirds'

const sighting = (date: string, location = 'Pierce and Washington', submissionId = `S${date}`): NamedSighting => ({
  date, submissionId, comment: '', location, locationId: 'L1', latitude: null, longitude: null,
})

/**
 * `computeNamedBirds`' own ordering, applied to a fixture so these tests are fed
 * what production actually hands over: NEWEST DATE FIRST, with the submission id
 * breaking ties DESCENDING (`lib/namedBirds.ts`). Feeding an ascending array
 * instead is what let a reversed place order pass every one of these tests while
 * the shipped tab read a two-checklist morning backwards.
 */
const productionOrder = (sightings: NamedSighting[]): NamedSighting[] =>
  [...sightings].sort((a, b) =>
    a.date !== b.date ? b.date.localeCompare(a.date) : b.submissionId.localeCompare(a.submissionId))

const bird = (over: Partial<NamedBird> & { key: string; sightings: NamedSighting[] }): NamedBird => {
  const dates = over.sightings.map(s => s.date).sort()
  return {
    name: over.key, commonName: 'Common Raven', scientificName: 'Corvus corax',
    firstSeen: dates[0] ?? '', lastSeen: dates[dates.length - 1] ?? '',
    sightingCount: over.sightings.length,
    ...over,
    sightings: productionOrder(over.sightings),
  }
}

const TODAY = '2026-09-06'

describe('rangeEnd — the single site of the future-date clamp', () => {
  it('is the bird\'s last sighting under the default range, whatever today is', () => {
    expect(rangeEnd('2026-07-10', 'last-sighting', TODAY)).toBe('2026-07-10')
    expect(rangeEnd('2026-07-10', 'last-sighting', null)).toBe('2026-07-10')
  })

  it('is today under the `today` range', () => {
    expect(rangeEnd('2026-07-10', 'today', TODAY)).toBe(TODAY)
  })

  it('CLAMPS to lastSeen when a mis-dated export puts it in the future, so the axis never runs backwards', () => {
    expect(rangeEnd('2027-01-01', 'today', TODAY)).toBe('2027-01-01')
  })

  it('a null today forces last-sighting, which is what makes Species Detail correct by construction', () => {
    expect(rangeEnd('2026-07-10', 'today', null)).toBe('2026-07-10')
  })

  it('compares LEXICALLY, so the clamp depends on the caller zero-padding its date', () => {
    // The comparison eBird's own dates and computeNamedBirds already rely on.
    expect(rangeEnd('2026-10-01', 'today', '2026-09-06')).toBe('2026-10-01')
    expect(rangeEnd('2026-09-05', 'today', '2026-09-06')).toBe('2026-09-06')
  })
})

describe('birdAxis', () => {
  const b = bird({ key: 'ravens', sightings: [sighting('2026-05-21'), sighting('2026-07-10')] })

  it('runs firstSeen to lastSeen by default', () => {
    expect(birdAxis(b, 'last-sighting', TODAY)).toEqual({ start: '2026-05-21', end: '2026-07-10', spanDays: 50 })
  })

  it('moves only the right-hand edge when the range flips', () => {
    const a = birdAxis(b, 'last-sighting', TODAY)
    const t = birdAxis(b, 'today', TODAY)
    expect(t.start).toBe(a.start)
    expect(t.end).toBe(TODAY)
    expect(t.spanDays).toBe(108)
  })

  it('is a zero-day axis when every sighting falls on one date', () => {
    const oneDay = bird({ key: 'winky', sightings: [sighting('2026-07-04', 'A'), sighting('2026-07-04', 'B', 'S2')] })
    expect(birdAxis(oneDay, 'last-sighting', TODAY).spanDays).toBe(0)
    // ...and the same bird has a real axis with the range on today.
    expect(birdAxis(oneDay, 'today', TODAY).spanDays).toBeGreaterThan(0)
  })
})

describe('masterAxis', () => {
  const birds = [
    bird({ key: 'a', sightings: [sighting('2025-07-16'), sighting('2026-06-04')] }),
    bird({ key: 'b', sightings: [sighting('2026-05-21'), sighting('2026-07-10')] }),
    bird({ key: 'c', sightings: [sighting('2026-06-08'), sighting('2026-07-03')] }),
  ]

  it('spans the earliest firstSeen to the latest lastSeen', () => {
    expect(masterAxis(birds, 'last-sighting', TODAY)).toEqual({ start: '2025-07-16', end: '2026-07-10', spanDays: 359 })
  })

  it('moves only the right-hand edge when the range flips', () => {
    const a = masterAxis(birds, 'last-sighting', TODAY)
    const t = masterAxis(birds, 'today', TODAY)
    expect(t.start).toBe(a.start)
    expect(t.end).toBe(TODAY)
  })

  it('is ORDER-INDEPENDENT, which is what lets the caller memoize it across a Sort change', () => {
    const reversed = [...birds].reverse()
    expect(masterAxis(reversed, 'last-sighting', TODAY)).toEqual(masterAxis(birds, 'last-sighting', TODAY))
  })

  it('is an empty zero-day axis for no birds at all', () => {
    expect(masterAxis([], 'last-sighting', TODAY)).toEqual({ start: '', end: '', spanDays: 0 })
  })
})

describe('distinctDates', () => {
  // THE REAL RECORDS, in the order production hands them over. Freeway-Turkey-Fam
  // was seen at Buchanan Curl at 07:00 (S356193531) and at Pierce and Washington
  // at 07:50 (S356373753) on one morning, and `computeNamedBirds` sorts ties by
  // submission id DESCENDING, so the LATER checklist arrives first.
  const EARLY = 'S356193531'   // Buchanan Curl, 07:00
  const LATE = 'S356373753'    // Pierce and Washington, 07:50

  it('collapses two sightings on one date into ONE entry carrying both places', () => {
    const out = distinctDates(productionOrder([
      sighting('2026-06-12', 'Buchanan Curl', 'S1'),
      sighting('2026-06-12', 'Pierce and Washington', 'S2'),
      sighting('2026-06-15', 'Pierce and Washington', 'S3'),
    ]))
    expect(out).toEqual([
      { date: '2026-06-12', places: ['Buchanan Curl', 'Pierce and Washington'] },
      { date: '2026-06-15', places: ['Pierce and Washington'] },
    ])
  })

  it('reads a two-checklist day CHRONOLOGICALLY, earliest first, from the order production gives', () => {
    // The input is deliberately the reverse of the answer: this row fails on any
    // implementation that preserves input order, which is what shipped.
    const input = productionOrder([
      sighting('2026-06-12', 'Buchanan Curl', EARLY),
      sighting('2026-06-12', 'Pierce and Washington', LATE),
    ])
    expect(input.map(s => s.location)).toEqual(['Pierce and Washington', 'Buchanan Curl'])
    expect(distinctDates(input)).toEqual([
      { date: '2026-06-12', places: ['Buchanan Curl', 'Pierce and Washington'] },
    ])
  })

  it('orders ids NUMERICALLY, so S99 comes before S100 where a string compare would not', () => {
    const out = distinctDates(productionOrder([
      sighting('2026-06-12', 'First place', 'S99'),
      sighting('2026-06-12', 'Second place', 'S100'),
    ]))
    expect(out[0].places).toEqual(['First place', 'Second place'])
  })

  it('keeps three places on one date in checklist order', () => {
    const out = distinctDates(productionOrder([
      sighting('2026-06-12', 'Third', 'S356193533'),
      sighting('2026-06-12', 'First', 'S356193531'),
      sighting('2026-06-12', 'Second', 'S356193532'),
    ]))
    expect(out[0].places).toEqual(['First', 'Second', 'Third'])
  })

  it('returns dates ASCENDING however the sightings arrive (computeNamedBirds sorts them newest first)', () => {
    const out = distinctDates(productionOrder([sighting('2026-07-10'), sighting('2026-05-21'), sighting('2026-06-08')]))
    expect(out.map(d => d.date)).toEqual(['2026-05-21', '2026-06-08', '2026-07-10'])
  })

  it('de-duplicates a place repeated on one date, and drops an unlocated sighting\'s place', () => {
    const out = distinctDates(productionOrder([
      sighting('2026-06-12', 'Buchanan Curl', 'S1'),
      sighting('2026-06-12', 'Buchanan Curl', 'S2'),
      sighting('2026-06-12', '', 'S3'),
      sighting('2026-06-12', '   ', 'S4'),
    ]))
    expect(out).toEqual([{ date: '2026-06-12', places: ['Buchanan Curl'] }])
  })

  it('de-duplicates AFTER ordering, so a repeat keeps its EARLIEST occurrence\'s position', () => {
    // THE FIXTURE HAS TO STRADDLE, and the first one written here did not.
    // De-duplicating BEFORE the sort keeps whichever occurrence arrives first,
    // which in production order is the LATEST one, so the two implementations
    // differ only when the other place sits BETWEEN a repeat's two visits.
    // With Buchanan at 531 and both Pierce visits after it, every ordering
    // agrees and the mutation survived; with Buchanan BETWEEN them it cannot.
    //   correct  (order, then de-duplicate): Pierce 531, Buchanan 532 -> Pierce, Buchanan
    //   mutant   (de-duplicate, then order): Buchanan 532, Pierce 533 -> Buchanan, Pierce
    const out = distinctDates(productionOrder([
      sighting('2026-06-12', 'Pierce', 'S356193531'),
      sighting('2026-06-12', 'Buchanan', 'S356193532'),
      sighting('2026-06-12', 'Pierce', 'S356193533'),
    ]))
    expect(out[0].places).toEqual(['Pierce', 'Buchanan'])
  })

  it('keeps a date with no located sighting at all, since the DATE is the mark', () => {
    expect(distinctDates([sighting('2026-06-12', '')])).toEqual([{ date: '2026-06-12', places: [] }])
  })

  it('END TO END: a production-ordered bird names its places chronologically in the SPOKEN payload', () => {
    // The formatter is pure and takes an already-ordered list, so it can never
    // catch this on its own. This is the row that joins the two: the real
    // Freeway-Turkey-Fam morning, in production order, through the geometry
    // module and out of the copy module as an option's accessible name.
    const turkeys = bird({
      key: 'turkeys', name: 'Freeway-Turkey-Fam',
      sightings: [
        sighting('2026-06-12', 'Buchanan Curl', EARLY),
        sighting('2026-06-12', 'Pierce and Washington', LATE),
      ],
    })
    const lane = buildLanes([turkeys], birdAxis(turkeys, 'today', TODAY))[0]
    expect(optionName(lane.name, lane.marks[0].date, lane.marks[0].places))
      .toBe('Freeway-Turkey-Fam, Jun 12, 2026, Buchanan Curl and Pierce and Washington')
  })
})

describe('markPositions', () => {
  const axis = { start: '2026-01-01', end: '2026-12-31', spanDays: 364 }

  it('places each date at its share of the axis', () => {
    const [a, b, c] = markPositions(['2026-01-01', '2026-07-02', '2026-12-31'], axis)
    expect(a).toBe(0)
    expect(b).toBeCloseTo(50, 1)
    expect(c).toBe(100)
  })

  it('returns [] rather than dividing by zero on a zero-day axis', () => {
    // A NaN in a `left:` style is a silent visual break with no error anywhere,
    // which is why this is the module's job and not the caller's.
    expect(markPositions(['2026-07-04'], { start: '2026-07-04', end: '2026-07-04', spanDays: 0 })).toEqual([])
  })

  it('CLAMPS to [0, 100] even though the two axis builders make that unreachable', () => {
    // Deliberately redundant: the clamp is what turns "no negative or inverted
    // mark positions" into a property of THIS module rather than a consequence of
    // rangeEnd and masterAxis both being right.
    expect(markPositions(['2025-01-01', '2027-01-01'], axis)).toEqual([0, 100])
  })

  it('never emits a NaN for an unparseable date', () => {
    expect(markPositions(['not-a-date'], axis)).toEqual([0])
  })

  it('clusters marks where the sightings cluster', () => {
    // Three sightings inside three days on a 90-day axis, and one at the far end.
    const dense = { start: '2026-05-21', end: '2026-08-19', spanDays: 90 }
    const p = markPositions(['2026-05-21', '2026-05-22', '2026-05-23', '2026-08-19'], dense)
    expect(p.slice(0, 3).every(x => x < 3)).toBe(true)
    expect(p[3]).toBe(100)
  })
})

describe('buildLanes', () => {
  const birds = [
    bird({ key: 'b', name: 'Bridge-Ravens', sightings: [sighting('2026-05-21'), sighting('2026-07-10')] }),
    bird({ key: 'a', name: 'Grosbeak', sightings: [sighting('2026-06-04')] }),
  ]
  const axis = masterAxis(birds, 'last-sighting', TODAY)

  it('keeps the ORDER GIVEN, which is how lane order equals card order under any Sort', () => {
    expect(buildLanes(birds, axis).map(l => l.key)).toEqual(['b', 'a'])
    expect(buildLanes([...birds].reverse(), axis).map(l => l.key)).toEqual(['a', 'b'])
  })

  it('gives EVERY bird a lane, with no cap and no truncation', () => {
    const many = Array.from({ length: 40 }, (_, i) =>
      bird({ key: `k${i}`, sightings: [sighting('2026-05-21'), sighting('2026-07-10')] }))
    expect(buildLanes(many, masterAxis(many, 'last-sighting', TODAY))).toHaveLength(40)
  })

  it('gives a single-sighting bird a lane with exactly one mark', () => {
    // Deliberately the OPPOSITE of the per-bird card rule: in the strip a
    // one-mark lane sits in a comparison with other lanes and carries real
    // information, where in a card it would be a chart of one fact.
    expect(buildLanes(birds, axis)[1].marks).toHaveLength(1)
  })

  it('positions every lane against the SAME axis', () => {
    const lanes = buildLanes(birds, axis)
    expect(lanes[0].marks[0].pct).toBe(0)                      // earliest firstSeen
    expect(lanes[0].marks[1].pct).toBe(100)                    // latest lastSeen
    expect(lanes[1].marks[0].pct).toBeGreaterThan(0)
    expect(lanes[1].marks[0].pct).toBeLessThan(100)
  })

  it('carries the places through to each mark, which is what the option name needs', () => {
    const withPlaces = [bird({
      key: 'p', sightings: [
        sighting('2026-06-12', 'Buchanan Curl', 'S356193531'),
        sighting('2026-06-12', 'Pierce and Washington', 'S356373753'),
        sighting('2026-06-15', 'Pierce and Washington', 'S356909523'),
      ],
    })]
    const lane = buildLanes(withPlaces, masterAxis(withPlaces, 'last-sighting', TODAY))[0]
    expect(lane.marks.map(m => m.places)).toEqual([
      ['Buchanan Curl', 'Pierce and Washington'],
      ['Pierce and Washington'],
    ])
  })

  it('gives every lane a fixed shape from ONE write path', () => {
    for (const lane of buildLanes(birds, axis)) {
      for (const m of lane.marks) {
        expect(Number.isFinite(m.pct)).toBe(true)
        expect(m.pct).toBeGreaterThanOrEqual(0)
        expect(m.pct).toBeLessThanOrEqual(100)
        expect(Array.isArray(m.places)).toBe(true)
        expect(m.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      }
    }
  })
})

describe('laneSpan — the per-lane extent line', () => {
  it('is the first mark to the last', () => {
    expect(laneSpan([{ date: 'a', pct: 20, places: [] }, { date: 'b', pct: 80, places: [] }]))
      .toEqual({ from: 20, to: 80 })
  })

  it('is null for an empty lane and a point for a single mark', () => {
    expect(laneSpan([])).toBeNull()
    expect(laneSpan([{ date: 'a', pct: 42, places: [] }])).toEqual({ from: 42, to: 42 })
  })

  it('reads from the SAME computed positions as the marks', () => {
    const b = [bird({ key: 'x', sightings: [sighting('2026-05-21'), sighting('2026-06-15'), sighting('2026-07-10')] })]
    const lane = buildLanes(b, masterAxis(b, 'today', TODAY))[0]
    const span = laneSpan(lane.marks)!
    expect(span.from).toBe(Math.min(...lane.marks.map(m => m.pct)))
    expect(span.to).toBe(Math.max(...lane.marks.map(m => m.pct)))
  })
})

describe('performance: the complete master mark set (NFR-04)', () => {
  /**
   * 200 named birds averaging 100 sightings each — 20,000 marks, the fixture the
   * requirement names.
   *
   * The assertion is a SAME-RUN QUOTIENT (`ceiling / best >= 10`), never an
   * absolute headroom measured on the build machine: an absolute margin encodes
   * one Mac's timing and goes red on a loaded shared runner that is comfortably
   * inside the real budget. And each timed run uses a DISTINCT input, so no memo
   * anywhere on the path can be measured instead of the work.
   */
  const makeBirds = (seed: number): NamedBird[] =>
    Array.from({ length: 200 }, (_, b) => {
      const n = 50 + ((b * 7 + seed) % 101)                     // averages ~100
      const sightings = Array.from({ length: n }, (_, i) => {
        const day = 1 + ((i * 13 + b + seed) % 28)
        const month = 1 + ((i * 5 + b) % 12)
        const year = 2019 + ((i + b + seed) % 7)
        return sighting(
          `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
          `Place ${i % 4}`,
          `S${b}-${i}`,
        )
      })
      return bird({ key: `bird-${seed}-${b}`, sightings })
    })

  it('builds well under the 50 ms budget, with enough headroom to survive CI hardware', () => {
    const CEILING_MS = 50
    const RUNS = 7
    // THE FLOOR IS HARDWARE-TOLERANT ON PURPOSE, and the earlier name for this
    // row ("measured as a quotient on the same run") was wrong: CEILING_MS is a
    // CONSTANT, so `CEILING_MS / best` is an absolute wall-clock assertion
    // wearing a ratio's clothes. At a floor of 10 it asserted `best <= 5 ms`,
    // which is ~20% above the shipped time and therefore a bet on the hardware.
    // Measured points: ~11.6-12.8 on an idle dev Mac, 8.27 at load 69-86, and
    // 6.92 on the shared ubuntu CI runner, which is what turned this red on the
    // 1.0.21 release commit. The regression class it exists for is nowhere near
    // that band -- reverting `distinctDates` to `Array.includes` takes the 40k
    // case to 10,717 ms, a ratio of ~0.005 -- so a floor of 3 keeps ~2.3x margin
    // over the slowest hardware seen and still rejects a quadratic by ~600x.
    // The real weight is carried by the STRUCTURAL row and the oracle parity
    // row, not by this wall clock; this row's job is to notice an order-of-
    // magnitude change, and it should not be the reason a green build reads red.
    // EVERY FIXTURE IS BUILT BEFORE ANY OF THEM IS TIMED. The threshold, the run
    // count and the work being timed are all unchanged; what moves out of the
    // measured region is the ALLOCATION. Building a 20,000-sighting fixture
    // between two timed runs leaves that much garbage behind, so a major GC can
    // land inside the next measurement -- which is a property of the harness,
    // not of `buildLanes`, and it was making this row flip either side of the
    // floor on an idle machine. Distinct input per run is preserved, so no memo
    // is measured.
    const fixtures = Array.from({ length: RUNS }, (_, run) => {
      const birds = makeBirds(run)
      return { birds, axis: masterAxis(birds, 'today', TODAY) }
    })
    let best = Infinity
    let marks = 0
    for (const { birds, axis } of fixtures) {
      const t0 = performance.now()
      const lanes = buildLanes(birds, axis)
      const elapsed = performance.now() - t0
      marks = lanes.reduce((n, l) => n + l.marks.length, 0)
      if (elapsed < best) best = elapsed
    }
    // Non-vacuity: the fixture really is the size the requirement names.
    expect(marks).toBeGreaterThan(5_000)
    expect(CEILING_MS / best).toBeGreaterThanOrEqual(3)
  })
})

describe('distinctDates is LINEAR in the places on one date (security review, Medium)', () => {
  // FOUR TESTS, because none covers the space alone (`.claude/rules/security.md`):
  // structural, timing, parity against the form it replaced, and -- since a
  // rewrite to a scan has no constant to bound -- NON-VACUITY in the fourth slot,
  // proving the probe set rejects a named, plausible, wrong implementation.
  //
  // THE SHAPE THAT MATTERS is many DISTINCT places on ONE date, because that is
  // what makes the de-duplication's membership test the hot loop. A crafted
  // export can produce it: every row carrying the same `[name:...]` tag on the
  // same date at a different location is a single `entries` array as long as the
  // file, and the file is bounded only by the 50 MB upload cap.
  // ONE STEP AND ONE BOUND, shared by the shipped form and the oracle, because
  // the discriminator is the RATIO and not the absolute size. Linear predicts
  // ~4x for a 4x input; quadratic predicts ~16x; the bound sits between them
  // with 2x margin on each side.
  const STEP = 4
  const RATIO_BOUND = 8
  // The shipped form is measured at its real operating range. The oracle is
  // measured at a quarter of it, on the SAME generator with the SAME step:
  // proving a quadratic is quadratic costs 22 s at 10k/40k, and a deliberately
  // slow probe sitting in the same file as a timing-RATIO assertion is
  // contention this suite creates for itself. A quarter of the anchor answers
  // the same question in under a second.
  const ANCHOR = 10_000
  const ORACLE_ANCHOR = 4_000

  const onOneDate = (n: number, salt: number): NamedSighting[] =>
    Array.from({ length: n }, (_, i) =>
      // Distinct places, so nothing de-duplicates and the membership test runs
      // its full length on every row -- the worst case, not the average one.
      sighting('2026-06-12', `Place ${salt}-${i}`, `S${String(1_000_000 + i)}`))

  /** The form that shipped to the security review, kept verbatim as the oracle. */
  const quadraticDedup = (entries: Array<{ id: string; place: string }>): string[] => {
    const places: string[] = []
    for (const e of entries) if (!places.includes(e.place)) places.push(e.place)
    return places
  }

  it('STRUCTURAL: the de-duplication is a Set membership test, not Array.includes', () => {
    // Comment-stripped, or the paragraph explaining what was removed matches the
    // thing it removed and fails a correct file (the v1.0.13 rule, in the
    // direction where a comment would invent a regression).
    const src = readFileSync(new URL('./namedBirdTimeline.ts', import.meta.url), 'utf8')
      .split('\n')
      .filter(l => !l.trim().startsWith('*') && !l.trim().startsWith('//') && !l.trim().startsWith('/*'))
      .join('\n')
    expect(src).toContain('new Set<string>()')
    expect(src).not.toMatch(/places\.includes\(/)
  })

  it('TIMING: quadrupling the input does not quadruple the work beyond a linear budget', () => {
    // A SAME-RUN RATIO, never an absolute margin measured on this Mac: both
    // halves meet the same contention, so the assertion means the same thing on
    // a laptop and on a loaded runner. Linear predicts ~4x for a 4x input;
    // quadratic predicts ~16x. The bound sits between them with 2x margin on
    // each side, and each timed run uses a DISTINCT input so no memo is measured.
    const time = (n: number, salt: number) => {
      const input = productionOrder(onOneDate(n, salt))
      const t0 = performance.now()
      const out = distinctDates(input)
      const elapsed = performance.now() - t0
      expect(out[0].places).toHaveLength(n)   // the work really happened
      return elapsed
    }
    const small = Math.min(time(ANCHOR, 1), time(ANCHOR, 2), time(ANCHOR, 3))
    const large = Math.min(time(ANCHOR * STEP, 4), time(ANCHOR * STEP, 5), time(ANCHOR * STEP, 6))
    expect(large / small,
      `${ANCHOR}=${small.toFixed(2)}ms ${ANCHOR * STEP}=${large.toFixed(2)}ms`,
    ).toBeLessThan(RATIO_BOUND)
  })

  it('NON-VACUITY: the same probe REJECTS the quadratic form it replaced', () => {
    // Without this the timing row is a number nobody has seen fail, and a probe
    // that cannot reject the defect certifies any implementation. Run the oracle
    // through the identical sizes and confirm it breaches the same bound.
    const timeOracle = (n: number, salt: number) => {
      const entries = onOneDate(n, salt).map(s => ({ id: s.submissionId, place: s.location }))
      const t0 = performance.now()
      const out = quadraticDedup(entries)
      const elapsed = performance.now() - t0
      expect(out).toHaveLength(n)
      return elapsed
    }
    const small = Math.min(timeOracle(ORACLE_ANCHOR, 7), timeOracle(ORACLE_ANCHOR, 8))
    const large = Math.min(timeOracle(ORACLE_ANCHOR * STEP, 9), timeOracle(ORACLE_ANCHOR * STEP, 10))
    expect(large / small,
      `oracle ${ORACLE_ANCHOR}=${small.toFixed(2)}ms ${ORACLE_ANCHOR * STEP}=${large.toFixed(2)}ms`,
    ).toBeGreaterThan(RATIO_BOUND)
  })

  it('PARITY: the fast form returns exactly what the form it replaced returned', () => {
    // Faster is worth nothing if it answers differently. Swept over the shapes
    // that actually arrive: repeats, unlocated rows, one place, and the
    // two-checklist morning whose ORDER the last round fixed.
    const cases: NamedSighting[][] = [
      [sighting('2026-06-12', 'Buchanan Curl', 'S356193531'), sighting('2026-06-12', 'Pierce', 'S356373753')],
      [sighting('2026-06-12', 'A', 'S1'), sighting('2026-06-12', 'A', 'S2'), sighting('2026-06-12', 'B', 'S3')],
      [sighting('2026-06-12', '', 'S1'), sighting('2026-06-12', 'A', 'S2')],
      [sighting('2026-06-12', 'Only', 'S1')],
      onOneDate(200, 11),
    ]
    for (const c of cases) {
      const ordered = productionOrder(c)
      // The oracle is handed the SAME ordered, located entries the shipped path
      // builds, so this compares the de-duplication and nothing else.
      const entries = ordered
        .filter(s => s.location.trim() !== '')
        .map(s => ({ id: s.submissionId, place: s.location.trim() }))
        .sort((a, b) => (a.id.length !== b.id.length ? a.id.length - b.id.length : a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      expect(distinctDates(ordered)[0].places).toEqual(quadraticDedup(entries))
    }
  })
})

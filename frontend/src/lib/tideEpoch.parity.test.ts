// SHARED-FIXTURE PARITY TEST -- the TS half of the `placeEpochMin` /
// `place_epoch_min` twin pair, on tideEpoch.fixture.json, which
// backend/tests/test_tide_epoch_parity.py also drives. The rows were produced
// by this twin, so this side pins the fixture against regeneration drift and
// the Python side is the cross-check; together they are the claim that the
// desktop and web/Pi transports place every NOAA `lst_ldt` string on the same
// axis, and REFUSE the same set. Regenerate with tideEpoch.fixtureGen.test.ts,
// never by hand.
//
// Note what this pair does NOT assert on this side: a TZ-invariance row here
// would be vacuous by construction, because the date arithmetic cannot read the
// process zone in the first place. The invariance claim is Python's alone (the
// backend is the half that had that defect); what carries weight HERE is
// cross-transport value equality, which is why the fixture is shared rather
// than duplicated.
//
// THE THREE PINNED DIVERGENCES ARE NOW CONVERGENCE ROWS. `2026-13-40 25:61`,
// `2026-02-30 12:00` and `0001-01-01 00:00` were pinned at v1.0.32 as shapes
// the twins genuinely read differently, so that "a change to EITHER side turns
// a row red and sends the next reader to
// pipeline/tide-timezone-parse/decisions.md". Converging them IS that change --
// it was the scope fence between the previous build and this one, and this
// build owns it. They are REWRITTEN rather than deleted, and each side carries
// a literal table of what IT used to return, so the convergence is a measured
// change rather than an assertion about the present: a row that used to
// separate the twins is what makes their agreement elsewhere a measurement
// instead of an assumption, and that is as true after the convergence as
// before it.
import { describe, it, expect } from 'vitest'
import fixture from './tideEpoch.fixture.json'
import { placeEpochMin } from './tideInstant'

interface Row { t: unknown; epochMin: number | null; why: string }
const ROWS = (fixture as { rows: Row[] }).rows
const CONVERGED = (fixture as { converged: Row[] }).converged

/** What THIS twin returned for the three converged strings before this build.
 *  Literals rather than fixture values: the fixture's expected column is the
 *  post-convergence answer by construction, and this table is the other half of
 *  the claim that anything moved at all. The Python half carries its own. */
const TS_BEFORE: Record<string, number> = {
  '2026-13-40 25:61': 30037081,   // Date.UTC rolled month 13 / minute 61 into 2027
  '2026-02-30 12:00': 29540880,   // Date.UTC rolled February 30 to March 2
  '0001-01-01 00:00': -36290880,  // Date.UTC's legacy two-digit-year mapping landed in 1901
}

const label = (t: unknown) =>
  typeof t === 'string' ? (t.replace(/\n/g, '\\n') || '(empty)') : `(${String(t)})`

describe('tideEpoch fixture', () => {
  it('carries the shapes that discriminate, not only conforming strings', () => {
    const inputs = new Set(ROWS.map(r => r.t))
    // A fixture of well-formed strings cannot see a twin divergence, so these
    // shapes are load-bearing rather than decorative.
    expect(inputs.has('٢٠٢٦-09-12 22:41'), 'a non-ASCII digit row').toBe(true)
    expect(inputs.has('2026-11-01 01:00\n'), 'a trailing-newline row').toBe(true)
    expect(inputs.has('\n2026-11-01 01:00'), 'a leading-newline row').toBe(true)
    expect(inputs.has('2026-11\n-01 01:00'), 'an embedded-newline row').toBe(true)
    expect(inputs.has('2026-11-01T03:00'), 'a `T` separator row').toBe(true)
    // The two rows that say why the placement test may not be spelled as a
    // comparison against zero, in either direction.
    expect(inputs.has('1970-01-01 00:00'), 'the epoch itself').toBe(true)
    expect(inputs.has('1900-01-01 00:00'), 'a placeable negative epoch').toBe(true)
    // A non-string `t`, whose two coercions were never twins.
    expect(inputs.has(null), 'a null `t`').toBe(true)
    // All three outcomes represented, so a fixture that degenerated to
    // all-null (or all-placing) fails loudly rather than passing vacuously.
    expect(ROWS.some(r => r.epochMin === null), 'some row is unplaceable').toBe(true)
    expect(ROWS.some(r => typeof r.epochMin === 'number' && r.epochMin > 0), 'some row is positive').toBe(true)
    expect(ROWS.some(r => typeof r.epochMin === 'number' && r.epochMin < 0), 'some row is negative').toBe(true)
    expect(ROWS.some(r => r.epochMin === 0), 'the epoch itself still places at 0').toBe(true)
    expect(ROWS.length).toBeGreaterThanOrEqual(25)
    expect(CONVERGED.length).toBe(3)
  })

  it.each(ROWS.map(r => [label(r.t), r] as const))('%s', (_label, r) => {
    expect(placeEpochMin(r.t)).toBe(r.epochMin)
  })

  it('a difference between two of these values is the CALENDAR difference of the two wall clocks', () => {
    // The span the web/Pi twin got wrong: 01:00 -> 03:00 on the LA fall-back
    // date is two hours on the calendar, whatever the reading machine's zone.
    const by = (t: string) => ROWS.find(r => r.t === t)!.epochMin as number
    expect(by('2026-11-01 03:00') - by('2026-11-01 01:00')).toBe(120)
    expect(by('2026-03-08 03:00') - by('2026-03-08 01:00')).toBe(120)
  })

  it('an unplaceable string is DISTINGUISHABLE from the epoch, which the old sentinel was not', () => {
    // The whole defect in one row. `_epoch_min` / `epochMin` returned 0 for
    // both, so every consumer read an unreadable timestamp as 1970 -- 56 years
    // from any tide window, which collapsed the interpolation fraction to
    // ~0.99999 and turned the reading into the other bracket's level.
    expect(placeEpochMin('1970-01-01 00:00')).toBe(0)
    expect(placeEpochMin('not a date')).toBeNull()
    // And the other spelling the predicate may not take: placeable and negative.
    expect(placeEpochMin('1900-01-01 00:00')).toBeLessThan(0)
  })

  it.each(CONVERGED.map(r => [r.t as string, r] as const))('converged: %s', (_label, r) => {
    // These three were PINNED DIVERGENCES, not omissions, and they are kept as
    // rows for the same reason they were pinned: a row that separates -- or
    // used to separate -- the twins is what makes their agreement elsewhere a
    // measurement. `Date.UTC` rolled an impossible calendar value over and
    // mapped a year below 0100 into the 1900s where the Python twin refused the
    // value; both now refuse the first two and read year 1 for the third, by
    // two different mechanisms (a raise there, a component round trip here).
    expect(placeEpochMin(r.t)).toBe(r.epochMin)
    // Guard the guard: prove this side actually MOVED, so a regeneration that
    // silently restored the old behaviour cannot pass as a convergence.
    expect(placeEpochMin(r.t)).not.toBe(TS_BEFORE[r.t as string])
  })

  it('the converged table covers exactly the rows the fixture converged', () => {
    // A count that names a number is asserting that number, so it is derived
    // from the fixture rather than retyped, and the two tables cannot grow
    // apart.
    expect(Object.keys(TS_BEFORE).sort()).toEqual(CONVERGED.map(r => r.t as string).sort())
  })

  it('the pattern is explicit ASCII, anchored and fixed-width', () => {
    // Structural, so it cannot flake, and it guards the two properties a future
    // edit is most likely to cost. The behavioural half, in both directions.
    expect(placeEpochMin('٢٠٢٦-09-12 22:41')).toBeNull()
    expect(placeEpochMin('2026-09-12 22:41')).not.toBeNull()
    expect(placeEpochMin('\n2026-09-12 22:41')).toBeNull()
    // A PREFIX match, deliberately: `fullmatch` on the Python side would break
    // parity by design, so seconds and a trailing newline must ride along here.
    expect(placeEpochMin('2026-09-12 22:41:30')).toBe(placeEpochMin('2026-09-12 22:41'))
    expect(placeEpochMin('2026-09-12 22:41\n')).toBe(placeEpochMin('2026-09-12 22:41'))
  })
})

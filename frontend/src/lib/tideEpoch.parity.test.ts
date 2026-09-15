// SHARED-FIXTURE PARITY TEST -- the TS half of the `epochMin` / `_epoch_min`
// twin pair, on tideEpoch.fixture.json, which
// backend/tests/test_tide_epoch_parity.py also drives. The rows were produced
// by this twin, so this side pins the fixture against regeneration drift and
// the Python side is the cross-check; together they are the claim that the
// desktop and web/Pi transports place every NOAA `lst_ldt` string on the same
// axis. Regenerate with tideEpoch.fixtureGen.test.ts, never by hand.
//
// Note what this pair does NOT assert on this side: a TZ-invariance row here
// would be vacuous by construction, because `Date.UTC` cannot read the process
// zone in the first place. The invariance claim is Python's alone (the backend
// is the half that had the defect); what carries weight HERE is cross-transport
// value equality, which is why the fixture is shared rather than duplicated.
import { describe, it, expect } from 'vitest'
import fixture from './tideEpoch.fixture.json'
import { epochMin } from './tide'

interface Row { t: string; epochMin: number; why: string }
const ROWS = (fixture as { rows: Row[] }).rows
const DIVERGENT = (fixture as { divergent: Row[] }).divergent

describe('tideEpoch fixture', () => {
  it('carries the shapes that discriminate, not only conforming strings', () => {
    const inputs = new Set(ROWS.map(r => r.t))
    // A fixture of well-formed strings cannot see a twin divergence, so these
    // four shapes are load-bearing rather than decorative.
    expect(inputs.has('٢٠٢٦-09-12 22:41'), 'a non-ASCII digit row').toBe(true)
    expect(inputs.has('2026-11-01 01:00\n'), 'a trailing-newline row').toBe(true)
    expect(inputs.has('\n2026-11-01 01:00'), 'a leading-newline row').toBe(true)
    expect(inputs.has('2026-11-01T03:00'), 'a `T` separator row').toBe(true)
    // Both outcomes represented, so a fixture that degenerated to all-zeroes
    // (or all-matching) fails loudly rather than passing vacuously.
    expect(ROWS.some(r => r.epochMin === 0)).toBe(true)
    expect(ROWS.some(r => r.epochMin !== 0)).toBe(true)
    expect(ROWS.length).toBeGreaterThanOrEqual(16)
    expect(DIVERGENT.length).toBeGreaterThanOrEqual(3)
  })

  it.each(ROWS.map(r => [r.t.replace(/\n/g, '\\n') || '(empty)', r] as const))('%s', (_label, r) => {
    expect(epochMin(r.t)).toBe(r.epochMin)
  })

  it('a difference between two of these values is the CALENDAR difference of the two wall clocks', () => {
    // The span the web/Pi twin got wrong: 01:00 -> 03:00 on the LA fall-back
    // date is two hours on the calendar, whatever the reading machine's zone.
    const by = (t: string) => ROWS.find(r => r.t === t)!.epochMin
    expect(by('2026-11-01 03:00') - by('2026-11-01 01:00')).toBe(120)
    expect(by('2026-03-08 03:00') - by('2026-03-08 01:00')).toBe(120)
  })

  it.each(DIVERGENT.map(r => [r.t, r] as const))('pinned divergence: %s', (_label, r) => {
    // These three are pinned, not excluded. They are shapes NOAA cannot emit,
    // and the twins genuinely disagree on them: Date.UTC rolls an impossible
    // calendar value over and maps a year below 0100 into the 1900s, where the
    // Python twin refuses the value and returns 0.0. Leaving them out would
    // make the agreement elsewhere look total when it is not; pinning them
    // means a change to EITHER side turns a row red and sends the next reader
    // to pipeline/tide-timezone-parse/decisions.md instead of to a surprise.
    expect(epochMin(r.t)).toBe(r.epochMin)
  })
})

// GENERATOR for tideEpoch.fixture.json, the shared cross-transport fixture for
// the `placeEpochMin` / `place_epoch_min` twin pair. It runs ONLY when
// SR_GEN_TIDE_EPOCH_FIXTURE=1 is set:
//
//   SR_GEN_TIDE_EPOCH_FIXTURE=1 npx vitest run src/lib/tideEpoch.fixtureGen.test.ts
//
// and is otherwise skipped, so it is a regeneration path and not a gate; the
// gates are tideEpoch.parity.test.ts here and backend/tests/test_tide_epoch_parity.py.
// Every expected value is produced by the SHIPPED `placeEpochMin` (never a
// retyped rule), and the Python twin then has to reproduce it from the same
// string, which IS the parity claim -- a hand-written expected column would
// encode the author's model of the data, which is the model that wrote the bug
// (v1.0.21).
//
// The inputs are NOAA `lst_ldt` strings shaped exactly as CO-OPS ships them,
// plus the malformed shapes a provider body can carry. A fixture of conforming
// strings alone cannot see one twin raising where the other returns a value
// (.claude/rules/security.md), so the malformed shapes are first-class here.
//
// TWO THINGS CHANGED IN THIS FILE AND THEY ARE ONE CHANGE.
//
// 1. The expected column is now `number | null`, because the predicate is. It
//    used to be `number` with `0` standing for "unreadable" -- and that
//    sentinel WAS the defect: 1970 is 56 years from any tide window, so an
//    unreadable `t` did not drop out, it moved to 1970, the interpolation
//    fraction collapsed to ~0.99999 and the reading degenerated into "return
//    the other bracket". Note what that did to this very fixture: the row for
//    `1970-01-01 00:00` carried the comment "whose 0 is indistinguishable from
//    the no-match sentinel". There is no sentinel now, so it is distinguishable,
//    and the row stays as the reason the predicate may not be spelled `=== 0`.
//
// 2. The `divergent` list is gone and a `converged` list stands in its place.
//    Those three rows were pinned at v1.0.32 as shapes the twins genuinely read
//    differently, "so a change to EITHER side turns a row red and sends the next
//    reader to pipeline/tide-timezone-parse/decisions.md". Converging the twins
//    IS that change, and it was this build's own scope fence: build 4's brief
//    listed them as must-NOT-change precisely because moving them means crossing
//    into this build's territory. **They are rewritten into agreement rows, not
//    deleted** -- the two gates still assert all three, and each side carries a
//    literal table of what IT used to return, so the convergence is a measured
//    change rather than an assertion about the present.
/// <reference types="node" />
import { describe, it } from 'vitest'
import { writeFileSync } from 'node:fs'
import { placeEpochMin } from './tideInstant'

const OUT = new URL('./tideEpoch.fixture.json', import.meta.url)

/** Strings both transports must read identically. */
const AGREEING: Array<[unknown, string]> = [
  ['2026-11-01 01:00', 'the fall-back hour\'s first pass at a US/Pacific station; 2026-11-01 is the LA transition date'],
  ['2026-11-01 03:00', 'two calendar hours after the row above, across that transition'],
  ['2026-03-08 01:00', 'the hour before the spring-forward gap'],
  ['2026-03-08 03:00', 'the hour after it'],
  ['2026-06-01 12:00', 'an ordinary midday with no transition anywhere near it'],
  ['2025-09-15 08:51', 'a real subordinate-station high-water time'],
  ['2026-11-01T03:00', 'the ISO `T` separator, which the character class admits'],
  ['2026-11-01 01:00:30', 'seconds ride along: both sides match a PREFIX, not the whole string'],
  ['2026-11-01 01:00\n', 'a trailing newline rides along for the same reason'],
  ['\n2026-11-01 01:00', 'a LEADING newline does not: both patterns are anchored at the start'],
  ['2026-11\n-01 01:00', 'an embedded newline breaks the fixed-width run'],
  ['', 'the empty string'],
  ['   ', 'present but blank'],
  ['not a date', 'ordinary junk'],
  ['2026/05/01 15:07', 'the wrong separator: unplaceable, and the deleted unanchored clock scan read `3:07pm` off it anyway'],
  ['2026-05-01', 'a date with no clock'],
  ['15:07', 'a clock with no date'],
  ['٢٠٢٦-09-12 22:41', 'Arabic-Indic digits: ASCII-only classes on BOTH sides refuse them'],
  ['1970-01-01 00:00', 'THE EPOCH ITSELF: a placeable instant whose value was the old no-match sentinel, which is why the placement test may not be spelled `=== 0`'],
  ['1900-01-01 00:00', 'a placeable NEGATIVE epoch, which is why it may not be spelled `> 0` either -- the Planner\'s old predicate dropped this'],
  ['0000-01-01 00:00', 'year 0: a proleptic year `Date` can represent and `datetime` refuses, which the round trip alone would let diverge'],
  ['2026-05-00 12:00', 'day 0 rolls back a month under `Date` and raises under `datetime`'],
  ['9999-12-31 23:59', 'the far end of the calendar, which both sides carry'],
  [null, 'a non-string `t`: `String(null)` was `""` and `str(None)` was `"None"`, and those two sort to OPPOSITE ends of the series'],
  [true, 'a non-string `t`: `"true"` against `"True"`'],
]

/** Strings the twins USED to read differently, pinned as agreement rows now
 *  that they have been converged. Not deleted: a row that used to separate the
 *  twins is what makes the convergence a measurement. */
const CONVERGED: Array<[string, string]> = [
  ['2026-13-40 25:61', 'month 13 and minute 61: `Date.UTC` rolled it into 2027 where Python refused the calendar value. Both refuse it now, by two different mechanisms -- a raise there, a component round trip here'],
  ['2026-02-30 12:00', 'February 30: `Date.UTC` rolled it to March 2 where Python refused it. Both refuse it now'],
  ['0001-01-01 00:00', 'years 0000-0099 hit `Date.UTC`\'s legacy two-digit-year mapping and landed in 1901 where Python read year 1. Both read year 1 now, because the date is built through `setUTCFullYear`, which does not carry that mapping'],
]

describe.skipIf(!process.env.SR_GEN_TIDE_EPOCH_FIXTURE)('regenerate the tide epoch parity fixture', () => {
  it('writes tideEpoch.fixture.json from the shipped placeEpochMin', () => {
    const doc = {
      note: 'Generated by tideEpoch.fixtureGen.test.ts from the shipped placeEpochMin in tideInstant.ts. Do not hand-edit.',
      rows: AGREEING.map(([t, why]) => ({ t, epochMin: placeEpochMin(t), why })),
      converged: CONVERGED.map(([t, why]) => ({ t, epochMin: placeEpochMin(t), why })),
    }
    writeFileSync(OUT, JSON.stringify(doc, null, 1) + '\n')
  })
})

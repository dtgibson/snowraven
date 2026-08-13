// SHARED-FIXTURE PARITY TEST - the JS half of the dual-transport checklist-id
// shape guard (backend-guard-anchor-parity, finding 2).
//
// `services.ebird.CHECKLIST_ID_RE` (web/Pi backend, enforced by
// routers/weather.py and routers/tide.py) and the JS guards below are kept in
// lockstep by comment only. This test and its pytest sibling
// (backend/tests/test_checklist_id_parity.py) both load the ONE shared fixture
// (checklistId.fixture.json) and assert the SAME verdict per id, so if either
// side drifts its own test fails.
//
// TWO JS guards are driven here, not one, because the JS side is NOT
// single-sourced and this change does not make it so (the backend went from two
// copies to one; the frontend duplication is recorded as follow-up work):
//
//   isValidChecklistId  lib/checklistId.ts        gates the REQUEST. App.tsx
//                                                 checks it before fetching
//                                                 /weather/{id} and /tide/{id},
//                                                 so it is the guard actually
//                                                 facing the routes fixed here.
//   SUBMISSION_ID_RE    components/speciesDetail/ui.tsx
//                                                 gates the LINK. ChecklistLink
//                                                 uses it to decide whether an
//                                                 id may become an anchor.
//
// Both are byte-identical `/^S\d+$/` today, and the last assertion pins that
// they agree on every row: asserting only one of them would leave the other free
// to drift away from the backend with this file still green. Four more copies of
// the same literal live in lib/mediaStats.ts, lib/speciesStats.ts,
// map/TargetMarkers.tsx and map/NearbyLiferMarkers.tsx; they are off the
// weather/tide path and out of scope here.
//
// THE TRAP THIS EXISTS FOR (v0.5.54). Python's `\d` matches every Unicode
// decimal digit and JavaScript's is ASCII-only, so the backend's
// `re.fullmatch(r"S\d+", ...)` accepted an id written in Arabic-Indic digits
// that this side rejects. The shipped JS constant is the FIXED REFERENCE the
// backend's explicit `[0-9]` had to meet, so these assertions are what its half
// of the pair is measured against.
//
// Both sides are called through their SHIPPED exports rather than a retyped
// copy of the pattern; retyping is how a reproduction quietly stops testing the
// code that ships.

import { describe, it, expect } from 'vitest'
import { SUBMISSION_ID_RE } from '../components/speciesDetail/ui'
import { isValidChecklistId } from './checklistId'
import fixture from './checklistId.fixture.json'

interface Case {
  why: string
  id: string
  valid: boolean
}

const cases = fixture.cases as Case[]

// The probe code points, written as escapes and never as literals: this repo has
// had literal exotic characters silently flattened into ASCII four times across
// two builds, leaving the probe set weaker with every test still green. The
// non-vacuity test below pins these values directly so a flattened escape fails.
const ARABIC_INDIC_012 = 'S\u0660\u0661\u0662'
const FULLWIDTH_012 = 'S\uff10\uff11\uff12'
const DEVANAGARI_012 = 'S\u0966\u0967\u0968'
const CYRILLIC_DZE_123 = '\u0405123'

// The shipped guards, called exactly as their callers call them. Neither regex
// carries a `g` flag, so there is no shared `lastIndex` to reset between calls.
const accepts = (id: string) => SUBMISSION_ID_RE.test(id)
const acceptsOnRequestPath = (id: string) => isValidChecklistId(id)

describe('eBird checklist-id shape guard (JS half of the parity pair)', () => {
  it('gives every shared-fixture case the expected verdict', () => {
    for (const c of cases) {
      expect(accepts(c.id), c.why).toBe(c.valid)
    }
  })

  it('the guard on the REQUEST path agrees with the fixture too', () => {
    // isValidChecklistId is what App.tsx checks before it fetches /weather/{id}
    // and /tide/{id}, so it is the JS guard directly facing the routes this
    // change fixes. Asserting only the link guard would leave this one free to
    // drift away from the backend with this file still green.
    for (const c of cases) {
      expect(acceptsOnRequestPath(c.id), c.why).toBe(c.valid)
    }
  })

  it('the two JS guards agree with each other on every row', () => {
    // They are byte-identical `/^S\d+$/` today and the JS side is not
    // single-sourced, so pin the agreement rather than assuming it.
    for (const c of cases) {
      expect(acceptsOnRequestPath(c.id), c.why).toBe(accepts(c.id))
    }
  })

  // Non-vacuity: a fixture that had quietly lost its hostile rows would still
  // pass the loop above. These assert the probe set actually exercises the
  // branches the guard exists for, and pin the code points so a flattened
  // escape fails rather than silently narrowing the fixture.
  it('the fixture still carries the cases that make the guard discriminating', () => {
    const ids = cases.map(c => c.id)

    // Three separate Unicode Nd blocks. Any one alone would leave a `\d`
    // regression passing on two thirds of the probe set.
    expect(ids).toContain(ARABIC_INDIC_012)
    expect(ids).toContain(FULLWIDTH_012)
    expect(ids).toContain(DEVANAGARI_012)
    expect([...ARABIC_INDIC_012].map(c => c.codePointAt(0))).toEqual([0x53, 0x0660, 0x0661, 0x0662])
    expect([...FULLWIDTH_012].map(c => c.codePointAt(0))).toEqual([0x53, 0xff10, 0xff11, 0xff12])
    expect([...DEVANAGARI_012].map(c => c.codePointAt(0))).toEqual([0x53, 0x0966, 0x0967, 0x0968])

    // The nastiest shape: well-formed right up to its last character.
    expect(ids).toContain('S123\u0660')
    // A look-alike leading letter (Cyrillic capital Dze).
    expect(ids).toContain(CYRILLIC_DZE_123)
    expect(CYRILLIC_DZE_123.codePointAt(0)).toBe(0x0405)

    // The anchor rows the house rule requires of every twinned pattern.
    expect(ids).toContain('S123\n')
    expect(ids).toContain('\nS123')
    expect(ids).toContain('S12\n3')

    // ...and enough valid rows that a guard rejecting EVERYTHING would fail.
    expect(ids).toContain('S12345678')
    expect(cases.filter(c => c.valid).length).toBeGreaterThanOrEqual(3)
    expect(cases.length).toBeGreaterThanOrEqual(20)
  })

  it('mutation guard: an ASCII-only class is what makes the two transports agree', () => {
    // The shipped JS side already rejects these, so this test is the fixed
    // reference the backend's `[0-9]` has to meet. Reverting the backend to
    // `\d` turns ITS half of the parity pair red against the same rows, because
    // Python's `\d` is Unicode-aware and admits all three.
    expect(accepts(ARABIC_INDIC_012)).toBe(false)
    expect(accepts(FULLWIDTH_012)).toBe(false)
    expect(accepts(DEVANAGARI_012)).toBe(false)
    expect(accepts('S123\u0660')).toBe(false)
    expect(accepts(CYRILLIC_DZE_123)).toBe(false)
    // ...and every well-formed id is untouched.
    expect(accepts('S12345678')).toBe(true)
    expect(accepts('S1')).toBe(true)
  })

  it('the ANCHOR half already agreed on this pair, which is why it is a separate bug', () => {
    // JavaScript's `$` matches at end of input only, and the backend twin uses
    // `fullmatch`, so these newline shapes were rejected on BOTH transports
    // before and after the class fix. That is the evidence the character-class
    // finding and the settingskv anchor finding are two defects and not one:
    // swapping the anchor here changes nothing, exactly as swapping the class
    // in settingskv.py changes nothing.
    expect(accepts('S123\n')).toBe(false)
    expect(accepts('\nS123')).toBe(false)
    expect(accepts('S12\n3')).toBe(false)
    expect(accepts('S123\r')).toBe(false)
  })
})

/// <reference types="node" />
// GENERATOR for countyDayObs.fixture.json (targets-tab, schema.md sections 4.1
// and 4.3). Runs ONLY under `SR_GEN_DAY_OBS_FIXTURE=1`:
//
//   cd frontend && SR_GEN_DAY_OBS_FIXTURE=1 npx vitest run src/lib/countyDayObs.fixtureGen.test.ts
//
// The fixture is DRIVEN THROUGH THE SHIPPED TypeScript builders (testing.md,
// v1.0.29): every `valid` verdict is what `REGION_CODE_RE` / `isValidDayObsDate`
// answer today and every `expected` is what `reduceCountyDayObs` returns today.
// Nothing expected is hand-typed, so it cannot encode the author's model of the
// data; the Python twin reproducing every row IS the parity claim
// (`backend/tests/test_county_day_obs.py`), and `countyDayObsReduce.test.ts`
// keeps the tracked file equal to the builder between regenerations.
//
// Invisible characters are written as escapes (testing.md, the NUL rule).

import { describe, it } from 'vitest'
import { writeFileSync } from 'node:fs'
import { REGION_CODE_RE } from './regionCode'
import { isValidDayObsDate, reduceCountyDayObs } from './countyDayObsReduce'

const GEN = process.env.SR_GEN_DAY_OBS_FIXTURE === '1'

const R = 'US-CA-001'
const D = '2026-09-01'

/** One conforming eBird historic record (eBird's own field names). */
function rec(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    speciesCode: 'linspa', comName: "Lincoln's Sparrow", sciName: 'Melospiza lincolnii',
    locId: 'L123456', locName: 'Arrowhead Marsh', obsDt: `${D} 08:15`,
    howMany: 2, lat: 37.745, lng: -122.206, obsValid: true, obsReviewed: false,
    locationPrivate: false, subId: 'S100000001',
    ...over,
  }
}

function without(key: string): Record<string, unknown> {
  const r = rec()
  delete r[key]
  return r
}

/** The PARAMETER rows: the route's two validators, on both transports. */
const REGION_INPUTS: string[] = [
  'US-CA-001',
  'US-NY-061',
  'us-ca-001',              // lowercase state and country
  'US-CA-01',               // two digits
  'US-CA-0011',             // four digits
  'US-CA-001\n',            // trailing newline: Python `$` would admit it under re.match
  '\nUS-CA-001',            // leading newline
  'US-CA-٠١٢', // Arabic-Indic digits: Python's `\d` would admit them
  'US-C4-001',              // digit in the state
  'CA-ON-001',              // non-US country
  'US-CA',                  // a state, not a county
  '',
  'US-CA-001/../x',
]

const DATE_INPUTS: string[] = [
  '2026-09-01',
  '2024-02-29',             // leap day
  '2026-02-29',             // not a leap year
  '2026-02-30',             // Date would roll this into March
  '2026-13-01',
  '2026-00-10',
  '2026-04-31',
  '1899-12-31',             // below the year bound
  '1900-01-01',
  '2100-12-31',
  '2101-01-01',             // above the year bound
  '2026-09-01\n',           // trailing newline
  '2026-9-1',
  '2026-09-01 08:00',       // a datetime, not a date
  '٢٠٢٦-09-01', // Arabic-Indic digits
  '',
]

const LONG = 'x'.repeat(512)
const ASTRAL_512 = '\u{1F426}'.repeat(256)   // 256 astral chars = 512 UTF-16 code units
const ASTRAL_514 = '\u{1F426}'.repeat(257)

/** The REDUCER families: conforming bodies and one malformed row per field. */
const BODY_FAMILIES: { name: string; body: unknown }[] = [
  { name: 'conforming', body: [rec(), rec({ speciesCode: 'sora', comName: 'Sora', obsDt: D, locId: 'L9', lat: 0, lng: 0 })] },
  { name: 'empty list', body: [] },
  { name: 'dedupe keeps the greatest obsDt', body: [
    rec({ obsDt: `${D} 07:00`, locName: 'Early' }),
    rec({ obsDt: `${D} 11:30`, locName: 'Late' }),
    rec({ obsDt: `${D} 09:00`, locName: 'Middle' }),
  ] },
  { name: 'dedupe: a datetime beats the bare date', body: [rec({ obsDt: D, locName: 'Bare' }), rec({ obsDt: `${D} 00:01`, locName: 'Timed' })] },
  { name: 'first-seen order survives a replacement', body: [
    rec({ speciesCode: 'aaa1', obsDt: `${D} 06:00` }),
    rec({ speciesCode: 'bbb1', obsDt: `${D} 06:00` }),
    rec({ speciesCode: 'aaa1', obsDt: `${D} 12:00` }),
  ] },
  { name: 'speciesCode not a string', body: [rec({ speciesCode: 42 }), rec({ speciesCode: 'ok1' })] },
  { name: 'speciesCode missing', body: [without('speciesCode')] },
  { name: 'speciesCode bad shape', body: [rec({ speciesCode: 'Lin Spa' }), rec({ speciesCode: 'x' }), rec({ speciesCode: 'a'.repeat(17) })] },
  { name: 'speciesCode with a trailing newline', body: [rec({ speciesCode: 'linspa\n' })] },
  { name: 'obsDt from another day', body: [rec({ obsDt: '2026-08-31 23:59' })] },
  { name: 'obsDt malformed', body: [rec({ obsDt: `${D}T08:15` }), rec({ obsDt: `${D} 8:15` }), rec({ obsDt: `${D} 08:15:00` })] },
  { name: 'obsDt not a string', body: [rec({ obsDt: 20260901 })] },
  { name: 'obsDt missing', body: [without('obsDt')] },
  { name: 'locId malformed reads as null', body: [rec({ locId: 'X123' }), rec({ speciesCode: 'b2', locId: 'L' }), rec({ speciesCode: 'c3', locId: `L${'1'.repeat(16)}` })] },
  { name: 'locId missing or null reads as null', body: [without('locId'), rec({ speciesCode: 'b2', locId: null })] },
  { name: 'locId not a string drops the record', body: [rec({ locId: 123456 })] },
  { name: 'locName at 512 kept, 513 dropped', body: [rec({ locName: LONG }), rec({ speciesCode: 'b2', locName: `${LONG}x` })] },
  { name: 'locName measured in UTF-16 code units', body: [rec({ locName: ASTRAL_512 }), rec({ speciesCode: 'b2', locName: ASTRAL_514 })] },
  { name: 'locName not a string', body: [rec({ locName: null }), rec({ speciesCode: 'b2', locName: 7 })] },
  { name: 'locName missing', body: [without('locName')] },
  { name: 'a boolean coordinate is not a number', body: [rec({ lat: true }), rec({ speciesCode: 'b2', lng: false })] },
  { name: 'a string coordinate is not a number', body: [rec({ lat: '37.7' })] },
  { name: 'out-of-range coordinates', body: [rec({ lat: 91 }), rec({ speciesCode: 'b2', lng: -180.5 }), rec({ speciesCode: 'c3', lat: -90, lng: 180 })] },
  { name: 'one coordinate missing', body: [without('lat'), rec({ speciesCode: 'b2', lng: null })] },
  { name: 'non-object entries are skipped', body: [null, 'linspa', 7, [rec()], true, rec({ speciesCode: 'ok1' })] },
  { name: 'body is an object', body: { speciesCode: 'linspa' } },
  { name: 'body is null', body: null },
  { name: 'body is a string', body: '[]' },
]

/**
 * The TEXT families: rows whose body cannot be written as a JavaScript value,
 * so the row carries eBird's response TEXT and each runtime parses it with its
 * own JSON parser, exactly as the two transports do (`JSON.parse` on desktop,
 * httpx's `json.loads` on web/Pi). An integer literal past the float range is
 * the case: `JSON.parse` reads `Infinity`, `json.loads` reads an exact `int`,
 * and `math.isfinite` on that `int` RAISED (security review L1).
 *
 * Each row also carries a CONTROL: the same body with the bad element REMOVED.
 * The claim is structural (CLAUDE.md, "an agreeing wrong number"): what the
 * reducer builds from the body equals what it builds from the control, derived
 * by each runtime from its own reducer, so the expectation is never typed by
 * hand and cannot encode a shared wrong model.
 */
const PAST_FLOAT_RANGE = `1${'0'.repeat(400)}`

function textFamily(name: string, body: Record<string, unknown>[], control: Record<string, unknown>[], literals: Record<string, string>) {
  let bodyText = JSON.stringify(body)
  for (const [placeholder, literal] of Object.entries(literals)) bodyText = bodyText.replace(JSON.stringify(placeholder), literal)
  return { name, bodyText, controlText: JSON.stringify(control) }
}

function withoutOn(over: Record<string, unknown>, key: string): Record<string, unknown> {
  const r = rec(over)
  delete r[key]
  return r
}

const TEXT_FAMILIES = [
  textFamily(
    'an integer coordinate past the float range is not a usable figure',
    [rec({ lat: '@HUGE_LAT@' }), rec({ speciesCode: 'b2', lng: '@HUGE_LNG@' })],
    [without('lat'), withoutOn({ speciesCode: 'b2' }, 'lng')],
    { '@HUGE_LAT@': PAST_FLOAT_RANGE, '@HUGE_LNG@': `-${PAST_FLOAT_RANGE}` },
  ),
]

function expectedFor(body: unknown): unknown {
  try {
    return reduceCountyDayObs(body, R, D)
  } catch (err) {
    return { error: (err as { status?: number }).status ?? 'throw' }
  }
}

function buildDayObsFixture() {
  return {
    _comment: 'GENERATED by countyDayObs.fixtureGen.test.ts from the shipped TS validators and reducer. Do not hand-edit. Asserted by countyDayObsReduce.test.ts and backend/tests/test_county_day_obs.py.',
    regionCode: R,
    date: D,
    regionRows: REGION_INPUTS.map(input => ({ input, valid: REGION_CODE_RE.test(input) })),
    dateRows: DATE_INPUTS.map(input => ({ input, valid: isValidDayObsDate(input) })),
    families: BODY_FAMILIES.map(f => ({ name: f.name, body: f.body, expected: expectedFor(f.body) })),
    textFamilies: TEXT_FAMILIES.map(f => ({ ...f, expected: expectedFor(JSON.parse(f.bodyText)) })),
  }
}

describe.skipIf(!GEN)('countyDayObs.fixture.json generator (SR_GEN_DAY_OBS_FIXTURE=1)', () => {
  it('writes the fixture from the shipped builders', () => {
    const out = new URL('./countyDayObs.fixture.json', import.meta.url)
    writeFileSync(out, `${JSON.stringify(buildDayObsFixture(), null, 2)}\n`)
  })
})

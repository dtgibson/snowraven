// The `dt` REQUEST PARAMETER boundary on the two desktop single-moment lookups,
// through the SHIPPED services with only the outermost seams doubled -- the same
// seam set atRouteServices.test.ts uses.
//
// Three defects, one change, all measured on this transport at v1.0.31 before a
// line was written:
//
//   * `getTideAt` never threw and was worse for it. `Date` ROLLS an impossible
//     calendar value into a real instant where Python raises, so
//     `?dt=2024-05-01 99:00` asked NOAA for 2026-05-05 04:00 and rendered
//     `Water level: 0.4 - 5.6 ft · Rising (turned during your checklist)` --
//     a confident, plausible, entirely wrong reading, in the block a user pastes
//     into a public eBird checklist. 18 of the 32 roster shapes did this.
//   * `getWeatherAt` had no guard at all: `parseLocalDateTimeInZone` sat outside
//     the try and threw status-less, which `isOfflineError` reads as TRUE -- so
//     the panel said "you're offline" on an online device whose request had
//     never left the machine. 16 of 32 shapes; the other 10 silently accepted a
//     rolled-over moment. (The brief's table says 17/9; it counts
//     `2024-05-01 12:00\n` as throwing, and it does not -- `Number('00\n')` is
//     0 because JavaScript trims whitespace, so it accepts the CORRECT moment
//     where the backend answers 400. Corrected here and in decisions.md.)
//   * The everyday Current path was broken on desktop and iOS. transport.ts
//     passed `params?.dt ?? ''` where the weather branch passes `undefined`, and
//     `getTideAt` had no "now" fallback, so `toNoaaDate('')` sent NOAA a single
//     space as `begin_date` and the panel got `{ status: "unavailable" }`. In
//     place since 0.5.34.
//
// THIS FILE IS THE DESKTOP HALF OF A TWO-RUNTIME PAIR. Its twin is
// backend/tests/test_tide_at_bad_request.py and both drive the same roster from
// the same fixture. Single-sourcing the refusal SENTENCE stops the copies
// drifting; it does nothing to stop one side's ENFORCEMENT being dropped
// (.claude/rules/security.md, v1.0.20), so the service rows here fail when THIS
// runtime's guard is removed and the route rows there fail when that one's is.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const seams = vi.hoisted(() => ({
  fetch: vi.fn(),
  key: vi.fn(async () => 'owm-key' as string | null),
  // Rest-typed so a row can assert WHICH native command was invoked with which
  // coordinates, not merely that the seam was reached.
  invoke: vi.fn(async (...args: unknown[]) => { void args; return 'America/Los_Angeles' }),
}))
vi.mock('./tauri/http', () => ({ tauriFetch: (...a: unknown[]) => seams.fetch(...a) }))
vi.mock('./storage', () => ({ storage: { getApiKey: () => seams.key() } }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: (...a: unknown[]) => seams.invoke(...a) }))

import { getTideAt } from './tauri/tideService'
import { getWeatherAt } from './tauri/weatherService'
import { isOfflineError } from './offlineDetect'
import {
  BAD_DT_MESSAGE, TIDE_WINDOW_MARGIN_HOURS,
  isBlankWallClock, parseWallClock, wallClockText, nowInZone, zoneOrUtc,
} from './wallClock'
import { ZONE_LOOKUP_FAILED } from './tauri/locationZone'
import fixture from './wallClock.fixture.json'

interface Row {
  name: string
  dt: string | null
  padX?: number
  tide: string
  weather: string
  canonical?: string
}
interface SeparatorRow {
  name: string
  dt: string
  margin0: string
  margin25: string
  canonical?: string
  mechanism: string
}

const FIX = fixture as unknown as {
  badDtMessage: string
  tideWindowMarginHours: number
  roster: Row[]
  separators: SeparatorRow[]
  tighteningsOverTheReplacedWeatherGuard: Array<{
    name: string; dt: string; pythonAccepted: string; category: string; sweepCount: number; mechanism: string
  }>
  fallbackZone: string
  zoneNames: Array<{ name: string; tz: string; resolvesTo: string; closedBy: string }>
  seamRefusalStatus: number
  seamFailures: Array<{ name: string; mode: string; expect: 'refused' | 'fallback' | 'ok' }>
}
const ROSTER = FIX.roster
const SEPARATORS = FIX.separators

/** The row's `dt`, with the fixture's `padX` recipe applied. */
const rowDt = (r: Row | SeparatorRow): string | undefined => {
  const dt = (r as Row).dt
  if (dt == null) return undefined
  const pad = (r as Row).padX
  return pad == null ? dt : dt + 'x'.repeat(pad)
}

const LAT = 32.87, LNG = -117.26
const OBS = { error: { message: 'no data' } }
const PRED = { predictions: [
  { t: '2024-05-01 11:30', v: '3.10' }, { t: '2024-05-01 12:00', v: '3.40' }, { t: '2024-05-01 12:30', v: '3.70' },
] }
const HILO = { predictions: [
  { t: '2024-05-01 09:00', v: '0.50', type: 'L' }, { t: '2024-05-01 15:00', v: '5.20', type: 'H' },
] }
const ONECALL = {
  current: {
    dt: 1714564800, temp: 71, humidity: 60, dew_point: 50, wind_speed: 5, wind_deg: 270, clouds: 10,
    weather: [{ id: 800, description: 'clear sky' }], sunrise: 1714564800 - 20000, sunset: 1714564800 + 20000,
  },
  hourly: [], daily: [],
}

const okJson = (b: unknown) => ({ ok: true, status: 200, json: async () => b })
/** Settle a promise either way so a row can assert on the rejection VALUE. */
const settle = (p: Promise<unknown>) => p.then(v => ({ ok: true as const, v }), (e: unknown) => ({ ok: false as const, e }))

const NOAA_DATE_RE = /^[0-9]{8} [0-9]{2}:[0-9]{2}$/

/** "Now" in `zone`, in NOAA's `begin_date` shape. ONE helper, because the two
 *  ad-hoc transforms this replaces disagreed: NOAA's format KEEPS the space
 *  (`20260916 04:15`), so stripping it as well as the dashes produced a string
 *  that could never match a slice of the real parameter. */
const noaaNowIn = (zone: string) => nowInZone(zone).replace(/-/g, '')

/** Every NOAA window the service asked for, in request order. */
function noaaWindows(): Array<{ begin: string; end: string }> {
  return seams.fetch.mock.calls.map(([url]) => {
    const u = new URL(url as string)
    return { begin: u.searchParams.get('begin_date') ?? '', end: u.searchParams.get('end_date') ?? '' }
  })
}

function mockTide() {
  seams.fetch.mockImplementation(async (u: string) => {
    if (u.includes('water_level')) return okJson(OBS)
    if (u.includes('interval=hilo')) return okJson(HILO)
    return okJson(PRED)
  })
}

beforeEach(() => {
  seams.fetch.mockReset()
  seams.key.mockReset().mockResolvedValue('owm-key')
  seams.invoke.mockReset().mockResolvedValue('America/Los_Angeles')
})

// ── The roster, through the shipped services ─────────────────────────────────

describe('getTideAt over the 32-shape roster', () => {
  it.each(ROSTER.map(r => [r.name, r] as const))('%s', async (_n, row) => {
    mockTide()
    const r = await settle(getTideAt(LAT, LNG, rowDt(row)))

    if (row.tide === 'refused') {
      // The assertCoordinateRange shape: `{ status: 400 }` on a plain Error, so
      // isOfflineError is FALSE and the panel never claims the device is
      // offline. And ZERO NOAA requests -- the guard is the service's first act.
      expect(r.ok).toBe(false)
      expect(r.ok === false && r.e).toMatchObject({ status: 400, message: FIX.badDtMessage })
      expect(isOfflineError(r.ok === false ? r.e : null)).toBe(false)
      expect(seams.fetch).not.toHaveBeenCalled()
      return
    }

    expect(r.ok).toBe(true)
    const windows = noaaWindows()
    expect(windows).toHaveLength(3)
    // An ACCEPTED moment always produces a well-formed NOAA window. The two
    // blank rows are the shipped-but-broken Current path: they sent a single
    // SPACE as begin_date until this build.
    for (const w of windows) {
      expect(w.begin).toMatch(NOAA_DATE_RE)
      expect(w.end).toMatch(NOAA_DATE_RE)
    }
    if (row.tide === 'ok' && row.canonical) {
      const c = row.canonical
      expect(windows[0].begin).toBe(`${c.slice(0, 4)}${c.slice(5, 7)}${c.slice(8, 10)} ${c.slice(11, 16)}`)
    }
  })
})

describe('getWeatherAt over the 32-shape roster', () => {
  it.each(ROSTER.map(r => [r.name, r] as const))('%s', async (_n, row) => {
    seams.fetch.mockImplementation(async () => okJson(JSON.parse(JSON.stringify(ONECALL))))
    const r = await settle(getWeatherAt(LAT, LNG, rowDt(row)))

    if (row.weather === 'refused') {
      expect(r.ok).toBe(false)
      expect(r.ok === false && r.e).toMatchObject({ status: 400, message: FIX.badDtMessage })
      // The defect this row closes: 16 of these read as "you're offline" while
      // the device was online and the request had never left the machine.
      expect(isOfflineError(r.ok === false ? r.e : null)).toBe(false)
      expect(seams.fetch).not.toHaveBeenCalled()
      return
    }

    expect(r.ok).toBe(true)
    expect(seams.fetch).toHaveBeenCalledTimes(1)
  })
})

// ── Spec item 5: no refused moment may reach the copy block ──────────────────

describe('no malformed dt can produce a reading', () => {
  const refused = ROSTER.filter(r => r.tide === 'refused')

  it('is asserted over a non-empty refused set', () => {
    expect(refused.length).toBeGreaterThan(20)
  })

  it.each(refused.map(r => [r.name, r] as const))('%s never yields a "Water level" line', async (_n, row) => {
    mockTide()
    const r = await settle(getTideAt(LAT, LNG, rowDt(row)))
    expect(r.ok).toBe(false)
    expect(JSON.stringify(r.ok === false ? r.e : null)).not.toContain('Water level')
  })

  // The sharpest single row from the brief, kept as its own named case because
  // it is the one a reader will look for: the hour a user actually asked about
  // read `2.3 - 3.0 ft · Falling`, and what rendered was a FOUR-DAY range.
  it('?dt=2024-05-01 99:00 is refused rather than rolled to 2026-05-05 04:00', async () => {
    mockTide()
    const r = await settle(getTideAt(LAT, LNG, '2024-05-01 99:00'))
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.e).toMatchObject({ status: 400 })
    expect(seams.fetch).not.toHaveBeenCalled()
  })
})

// ── Spec item 4: the "now" fallback, the shipped-but-broken Current path ─────

describe('an absent or empty dt resolves "now" in the LOCATION timezone', () => {
  it.each([['absent', undefined], ['empty string', '']] as const)('%s', async (_n, dt) => {
    mockTide()
    seams.invoke.mockResolvedValue('Pacific/Kiritimati')
    const r = await settle(getTideAt(LAT, LNG, dt))
    expect(r.ok).toBe(true)
    const begin = noaaWindows()[0].begin
    expect(begin).toMatch(NOAA_DATE_RE)
    // What it sent before this build. A literal, because the shape assertion
    // above would pass on a route that had merely stopped sending anything.
    expect(begin).not.toBe(' ')
    expect(begin.slice(0, 8)).toBe(noaaNowIn('Pacific/Kiritimati').slice(0, 8))
  })

  it('reads the LOCATION clock and not the device one', async () => {
    // Kiritimati is UTC+14 and Niue UTC-11, 25 hours apart, so their local
    // dates ALWAYS differ -- no dependence on what time the suite runs at.
    const days: string[] = []
    for (const zone of ['Pacific/Kiritimati', 'Pacific/Niue']) {
      seams.fetch.mockReset()
      mockTide()
      seams.invoke.mockResolvedValue(zone)
      await getTideAt(LAT, LNG, undefined)
      days.push(noaaWindows()[0].begin.slice(0, 8))
    }
    expect(days[0]).not.toBe(days[1])
  })

  it('asks the native seam for the LOCATION timezone exactly once, and only when it needs it', async () => {
    mockTide()
    await getTideAt(LAT, LNG, undefined)
    expect(seams.invoke).toHaveBeenCalledTimes(1)
    expect(seams.invoke).toHaveBeenCalledWith('get_timezone', { lat: LAT, lng: LNG })

    seams.invoke.mockClear()
    seams.fetch.mockReset()
    mockTide()
    await getTideAt(LAT, LNG, '2024-05-01 12:00')
    expect(seams.invoke).not.toHaveBeenCalled()
  })

  it('a refused dt reaches neither the timezone seam nor NOAA', async () => {
    mockTide()
    const r = await settle(getTideAt(LAT, LNG, '2024-13-01 12:00'))
    expect(r.ok).toBe(false)
    expect(seams.invoke).not.toHaveBeenCalled()
    expect(seams.fetch).not.toHaveBeenCalled()
  })

  it('force does not bypass the refusal', async () => {
    mockTide()
    const r = await settle(getTideAt(LAT, LNG, '2024-13-01 12:00', true))
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.e).toMatchObject({ status: 400 })
    expect(seams.fetch).not.toHaveBeenCalled()
  })
})

// ── The refusal is a new ERROR PATH ─────────────────────────────────────────

describe('a refusal echoes nothing of the request or the providers', () => {
  it.each([['tide', getTideAt], ['weather', getWeatherAt]] as const)('%s', async (_n, fn) => {
    mockTide()
    const hostile = '2026-01-01 12:00&station=EVIL#../../etc/passwd'
    const r = await settle(fn(LAT, LNG, hostile))
    expect(r.ok).toBe(false)
    const serialized = JSON.stringify({
      m: (r.ok === false ? r.e : null) as Error, s: String(r.ok === false ? (r.e as Error).message : ''),
    })
    for (const leak of ['EVIL', 'passwd', 'owm-key', 'tidesandcurrents', 'openweathermap', String(LAT)]) {
      expect(serialized).not.toContain(leak)
    }
  })
})

// ── The timezone-NAME axis, which the roster is blind to ────────────────────
//
// F1 of the security review, and the defect it names was introduced BY the
// "now" fallback three describes above. The roster varies `dt` and supplies a
// valid zone on every one of its 32 rows, so nothing in it could see that
// `nowInZone('')` throws a status-less RangeError -- which `isOfflineError`
// reads as TRUE, four lines from the refusal that carries `status: 400`
// precisely so it reads as FALSE. The two halves of one `if` had different
// error contracts.

describe('the timezone name the native seam returns', () => {
  it.each(FIX.zoneNames.map(r => [r.name, r] as const))('%s', (_n, row) => {
    // The unit-level claim: whatever the seam hands back, a wall clock comes out
    // and nothing throws.
    const text = nowInZone(row.tz)
    expect(text).toMatch(/^[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}$/)
    expect(parseWallClock(text)).not.toBeNull()
    // ...and it is the zone the fixture names, asserted by comparing against a
    // formatter built on `resolvesTo` rather than by trusting the fallback.
    expect(text).toBe(nowInZone(row.resolvesTo))
  })

  it('the fallback rows and the control rows are both present', () => {
    // Guard the guard: a table of controls only would pass against the
    // unrepaired code, and a table of fallbacks only could pass against a
    // predicate that answered UTC for every zone on earth.
    const fellBack = FIX.zoneNames.filter(r => r.resolvesTo === FIX.fallbackZone && r.tz !== FIX.fallbackZone)
    const passedThrough = FIX.zoneNames.filter(r => r.resolvesTo === r.tz)
    expect(fellBack.length).toBeGreaterThanOrEqual(2)
    expect(passedThrough.length).toBeGreaterThanOrEqual(2)
    expect(passedThrough.some(r => r.tz !== FIX.fallbackZone)).toBe(true)
  })

  it.each(FIX.zoneNames.map(r => [r.name, r] as const))(
    'getTideAt resolves "now" rather than claiming the device is offline: %s', async (_n, row) => {
      mockTide()
      seams.invoke.mockResolvedValue(row.tz)
      const r = await settle(getTideAt(LAT, LNG, undefined))
      expect(r.ok).toBe(true)
      const begin = noaaWindows()[0].begin
      expect(begin).toMatch(NOAA_DATE_RE)
      expect(begin.slice(0, 8)).toBe(noaaNowIn(row.resolvesTo).slice(0, 8))
    })

  it.each(FIX.zoneNames.map(r => [r.name, r] as const))(
    'getWeatherAt resolves a conforming dt rather than claiming the device is offline: %s',
    async (_n, row) => {
      seams.fetch.mockImplementation(async () => okJson(JSON.parse(JSON.stringify(ONECALL))))
      seams.invoke.mockResolvedValue(row.tz)
      const r = await settle(getWeatherAt(LAT, LNG, '2024-05-01 12:00'))
      expect(r.ok).toBe(true)
    })

  // The failure SIGNATURE this closes, asserted directly: before the repair both
  // services rejected with no `status` at all, which `isOfflineError` reads as
  // connection-level.
  //
  // NOTE the shape of the predicate. An earlier draft wrote
  // `isOfflineError(r.ok === false ? r.e : null)` and expected false, which is
  // WRONG on the success path -- `isOfflineError(null)` is `true`, because a
  // primitive throw carrying no status is connection-level by that function's
  // own contract. It failed loudly here; with the polarity reversed it would
  // have passed vacuously on every row. Ask the question about the rejection
  // itself, never about a placeholder standing in for one.
  const statusLess = (r: { ok: true; v: unknown } | { ok: false; e: unknown }) =>
    r.ok === false && (r.e as { status?: unknown })?.status === undefined

  it('no zone name produces a status-less rejection on either service', async () => {
    for (const row of FIX.zoneNames) {
      const label = row.tz || '(empty)'

      seams.fetch.mockReset()
      mockTide()
      seams.invoke.mockReset().mockResolvedValue(row.tz)
      const t = await settle(getTideAt(LAT, LNG, undefined))
      expect(statusLess(t), `tide @ ${label}`).toBe(false)
      expect(t.ok, `tide @ ${label}`).toBe(true)

      seams.fetch.mockReset().mockImplementation(async () => okJson(JSON.parse(JSON.stringify(ONECALL))))
      seams.invoke.mockReset().mockResolvedValue(row.tz)
      const w = await settle(getWeatherAt(LAT, LNG, '2024-05-01 12:00'))
      expect(statusLess(w), `weather @ ${label}`).toBe(false)
      expect(w.ok, `weather @ ${label}`).toBe(true)
    }
  })
})

// ── The seam's OTHER failure mode: not returning at all ─────────────────────
//
// QA round 2. The `zoneNames` block above discharges the seam's RETURN VALUE
// and nothing else -- every one of its rows mocks the command as resolving, and
// no test in this repo drove a rejecting `invoke` on any command. A rejection
// reproduced the F1 signature exactly (status-less, `isOfflineError` true) on
// the axis that fixture holds constant.
//
// The two modes get DIFFERENT answers on purpose; see the fixture's own comment
// and decisions.md section 15.

describe('the native timezone seam failing, rather than answering badly', () => {
  const arm = (mode: string) => {
    switch (mode) {
      case 'rejectError': seams.invoke.mockRejectedValue(new Error('ipc failed')); break
      case 'rejectString': seams.invoke.mockRejectedValue('command get_timezone not found'); break
      case 'resolveUndefined': seams.invoke.mockResolvedValue(undefined as unknown as string); break
      case 'resolveNull': seams.invoke.mockResolvedValue(null as unknown as string); break
      case 'resolveNumber': seams.invoke.mockResolvedValue(42 as unknown as string); break
      case 'resolveOk': seams.invoke.mockResolvedValue('America/Los_Angeles'); break
      default: throw new Error(`unknown mode ${mode}`)
    }
  }

  it.each(FIX.seamFailures.map(r => [r.name, r] as const))('getTideAt: %s', async (_n, row) => {
    mockTide()
    seams.invoke.mockReset(); arm(row.mode)
    const r = await settle(getTideAt(LAT, LNG, undefined))

    if (row.expect === 'refused') {
      expect(r.ok).toBe(false)
      expect(r.ok === false && r.e).toMatchObject({ status: FIX.seamRefusalStatus })
      // THE WHOLE POINT: never status-less, so the panel never says "you're
      // offline" about a local command that makes no network call at all.
      expect(isOfflineError(r.ok === false ? r.e : null)).toBe(false)
      // And no NOAA request for a moment we could not determine.
      expect(seams.fetch).not.toHaveBeenCalled()
      return
    }

    expect(r.ok).toBe(true)
    const begin = noaaWindows()[0].begin
    expect(begin).toMatch(NOAA_DATE_RE)
    const zone = row.expect === 'ok' ? 'America/Los_Angeles' : FIX.fallbackZone
    // Date AND hour, not the date alone: UTC and the process zone share a
    // calendar day for part of every day, so a date-granular comparison would
    // discriminate only some of the time. The minute is excluded because two
    // `nowInZone` calls can straddle a minute boundary.
    //
    // THIS ROW IS NOT THE DISCRIMINATING GUARD for the `undefined` case, and
    // says so rather than implying it: if the process itself runs in UTC the
    // comparison is vacuous here (and the defect is invisible there too). The
    // row that cannot be vacuous is the unit assertion
    // `nowInZone(undefined) formats in UTC, not the device zone`.
    expect(begin.slice(0, 11)).toBe(noaaNowIn(zone).slice(0, 11))
  })

  it.each(FIX.seamFailures.map(r => [r.name, r] as const))('getWeatherAt: %s', async (_n, row) => {
    seams.fetch.mockImplementation(async () => okJson(JSON.parse(JSON.stringify(ONECALL))))
    seams.invoke.mockReset(); arm(row.mode)
    const r = await settle(getWeatherAt(LAT, LNG, '2024-05-01 12:00'))

    if (row.expect === 'refused') {
      expect(r.ok).toBe(false)
      expect(r.ok === false && r.e).toMatchObject({ status: FIX.seamRefusalStatus })
      expect(isOfflineError(r.ok === false ? r.e : null)).toBe(false)
      expect(seams.fetch).not.toHaveBeenCalled()
      return
    }
    expect(r.ok).toBe(true)
  })

  it('a refusal echoes nothing of the underlying seam error', async () => {
    // A rejection's own text is platform-supplied and can carry a path or an
    // internal detail, so the thrown sentence is a fixed literal and the caught
    // value is discarded -- the same posture as every other refusal here.
    mockTide()
    seams.invoke.mockReset().mockRejectedValue(new Error('/Users/someone/secret/path exploded'))
    const r = await settle(getTideAt(LAT, LNG, undefined))
    expect(r.ok).toBe(false)
    // Every surface of the thrown value, which is wider than the roster's leak
    // row (that one serializes `message` and own enumerable properties, so it
    // does not read `stack`).
    const surfaces = JSON.stringify({
      m: (r.ok === false ? (r.e as Error).message : ''),
      s: (r.ok === false ? String(r.e) : ''),
      all: r.ok === false ? JSON.stringify(r.e, Object.getOwnPropertyNames(r.e)) : '',
    })
    // The markers are the CAUGHT error's own content. A build path is
    // deliberately NOT one of them: `stack` is this throw's own call site, which
    // every Error in the app carries, is never serialized to the user, and an
    // earlier draft of this row flagged it as a leak -- an over-broad probe
    // reporting the instrument rather than the code.
    for (const leak of ['secret', 'exploded']) {
      expect(surfaces).not.toContain(leak)
    }
    // The positive half: the sentence is exactly the fixed literal, so the
    // absence above cannot be satisfied by an empty message.
    expect(r.ok === false && (r.e as Error).message).toBe(ZONE_LOOKUP_FAILED)
  })

  it('the seam-failure table carries both verdicts', () => {
    // Guard the guard. A table of only-refusing rows would pass against a
    // caller that refused every zone; only-resolving rows would pass against
    // the unrepaired code.
    const kinds = new Set(FIX.seamFailures.map(r => r.expect))
    expect(kinds).toEqual(new Set(['refused', 'fallback', 'ok']))
  })
})

// ── The separator rows ──────────────────────────────────────────────────────

describe('separator rows: shapes chosen to tell the two implementations apart', () => {
  it.each(SEPARATORS.map(r => [r.name, r] as const))('%s', (_n, row) => {
    for (const [margin, expected] of [[0, row.margin0], [TIDE_WINDOW_MARGIN_HOURS, row.margin25]] as const) {
      const got = parseWallClock(rowDt(row) as string, margin)
      if (expected === 'refused') {
        expect(got, `${row.name} @${margin}h -- ${row.mechanism}`).toBeNull()
      } else {
        expect(got, `${row.name} @${margin}h -- ${row.mechanism}`).not.toBeNull()
        if (row.canonical) expect(wallClockText(got!)).toBe(row.canonical)
      }
    }
  })

  // The three shapes `/weather/at`'s REPLACED guard accepted and this one does
  // not. The desktop half is where they mattered: every one of the 67 the sweep
  // found threw status-less here and was read as "you're offline", so these are
  // divergent rows converging on refusal rather than a new restriction. The
  // Python half asserts the other direction (that the old expression really did
  // accept them); this half asserts the service answers 400 with no request.
  it.each(FIX.tighteningsOverTheReplacedWeatherGuard.map(r => [r.name, r] as const))(
    'newly refused: %s', async (_n, row) => {
      expect(parseWallClock(row.dt)).toBeNull()
      seams.fetch.mockImplementation(async () => okJson(JSON.parse(JSON.stringify(ONECALL))))
      const r = await settle(getWeatherAt(LAT, LNG, row.dt))
      expect(r.ok).toBe(false)
      expect(r.ok === false && r.e).toMatchObject({ status: 400, message: FIX.badDtMessage })
      expect(isOfflineError(r.ok === false ? r.e : null)).toBe(false)
      expect(seams.fetch).not.toHaveBeenCalled()
    })

  it('no shipped caller can emit any of the tightened shapes', () => {
    // The argument for the direction, as a test rather than a sentence: the two
    // producers of a `dt` in this app both zero-pad and both emit ASCII.
    const pad = (n: number) => String(n).padStart(2, '0')
    const d = new Date(Date.UTC(2024, 4, 1, 9, 5))
    const fromInputs = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
    for (const produced of [fromInputs, nowInZone('Asia/Kolkata'), nowInZone('UTC'), nowInZone('America/Los_Angeles')]) {
      expect(produced).toMatch(/^[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}$/)
      expect(parseWallClock(produced)).not.toBeNull()
    }
  })

  it('the separator table is not vacuous', () => {
    expect(new Set(SEPARATORS.map(r => r.margin0))).toEqual(new Set(['ok', 'refused']))
    expect(new Set(SEPARATORS.map(r => r.margin25))).toEqual(new Set(['ok', 'refused']))
    expect(SEPARATORS.some(r => r.margin0 !== r.margin25)).toBe(true)
  })
})

// ── The predicate's own contract ────────────────────────────────────────────

describe('the predicate', () => {
  it('treats only absent and the empty string as blank', () => {
    expect(isBlankWallClock(undefined)).toBe(true)
    expect(isBlankWallClock(null)).toBe(true)
    expect(isBlankWallClock('')).toBe(true)
    for (const present of [' ', '0', 'false', '[]', '{}', 'null', '2024-05-01 12:00']) {
      expect(isBlankWallClock(present), present).toBe(false)
    }
  })

  it('never rolls a component, where bare Date.UTC does', () => {
    // The mechanism, stated as a measurement rather than as a claim: the naive
    // spelling this replaces produces a real, valid, DIFFERENT instant for each
    // of these, and the panel rendered a reading from it.
    expect(Date.UTC(2024, 12, 1, 12, 0)).toBe(Date.UTC(2025, 0, 1, 12, 0))
    expect(Date.UTC(2024, 4, 45, 12, 0)).toBe(Date.UTC(2024, 5, 14, 12, 0))
    expect(Date.UTC(1, 0, 1)).toBe(Date.UTC(1901, 0, 1))
    for (const dt of ['2024-13-01 12:00', '2024-05-45 12:00', '2024-05-01 99:00']) {
      expect(parseWallClock(dt), dt).toBeNull()
    }
    // ...and year 1 is year 1, not 1901.
    expect(parseWallClock('0001-01-01 00:00')).toEqual({ year: 1, month: 1, day: 1, hour: 0, minute: 0 })
  })

  it('treats every NON-STRING zone as unusable, `undefined` included', () => {
    // The one input `zoneOrUtc` did not treat as unusable, found by QA round 2.
    // `new Intl.DateTimeFormat({ timeZone: undefined })` is LEGAL and means "use
    // the runtime default", so `nowInZone(undefined)` silently formatted in the
    // DEVICE's zone -- a confidently wrong hour, which is the precise failure
    // this build exists to prevent, arriving through the one gap in the guard
    // written to prevent it. Measured before the fix: `2026-09-16 04:15` in
    // America/Los_Angeles where UTC read `11:15`.
    for (const bad of [undefined, null, 42, {}, [], true]) {
      expect(zoneOrUtc(bad as unknown as string), String(bad)).toBe(FIX.fallbackZone)
    }
    expect(zoneOrUtc('America/Los_Angeles')).toBe('America/Los_Angeles')
  })

  it('nowInZone(undefined) formats in UTC, not the device zone', () => {
    // The consequence, asserted at the function a caller actually reaches. The
    // two must agree for this to be meaningful, so the control is the explicit
    // UTC call rather than a literal.
    expect(nowInZone(undefined as unknown as string)).toBe(nowInZone(FIX.fallbackZone))
  })

  it('renders a four-digit year for a moment the four-digit pattern must read back', () => {
    // `wall_clock_text`'s reason for existing on the Python side (strftime's
    // %Y is not zero-padded below year 1000) has a twin obligation here: the
    // string it produces is fed straight to shiftLocal's `[0-9]{4}` pattern.
    expect(wallClockText({ year: 500, month: 6, day: 15, hour: 12, minute: 0 })).toBe('0500-06-15 12:00')
    expect(wallClockText({ year: 1, month: 1, day: 1, hour: 0, minute: 0 })).toBe('0001-01-01 00:00')
  })

  it('accepts a date-only clock as midnight', () => {
    expect(parseWallClock('2024-05-01')).toEqual({ year: 2024, month: 5, day: 1, hour: 0, minute: 0 })
  })

  it('is single-sourced with the fixture and the Python twin', () => {
    expect(BAD_DT_MESSAGE).toBe(FIX.badDtMessage)
    expect(TIDE_WINDOW_MARGIN_HOURS).toBe(FIX.tideWindowMarginHours)
  })

  it('has a roster of exactly the brief\'s 32 shapes', () => {
    // The Python half asserts the same length. Neither table can grow alone,
    // which is what keeps every count in decisions.md a measurement over the
    // population it was measured on.
    expect(ROSTER).toHaveLength(32)
    expect(new Set(ROSTER.map(r => r.name)).size).toBe(32)
  })
})

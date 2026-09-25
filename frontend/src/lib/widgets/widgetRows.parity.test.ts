/// <reference types="node" />
// THE WIDGET'S LIST RULES AGAINST MAP EXPLORER'S (ios-lifer-widgets, FR-11,
// FR-13 to FR-16, FR-52; QA-03, QA-11, QA-13 to QA-16, QA-59).
//
// Three kinds of evidence, kept apart on purpose:
//   1. DELIVERY: the tracked widgetRows.fixture.json equals what the shipped
//      TypeScript twin builds from the hand-authored inputs today. The Swift
//      `Logic/` sources reproduce the same file on the release machine
//      (snowraven_widgetsTests), which is the cross-runtime claim; this row is
//      what keeps the file from drifting from the twin between those runs.
//   2. PARITY WITH THE APP: the twin's species set equals what the app's OWN
//      code produces from the same body -- the shared reducer, the app's
//      `isWithinWindow`, `buildNearbyLifers`, and Map Explorer's Media Targets
//      chip filter re-derived from MapExplorer.tsx -- with every difference
//      DECLARED and asserted to be exactly what the declaration says.
//   3. STRUCTURE (CLAUDE.md, "an agreeing wrong number"): a body with a
//      malformed record builds the same rows as the body without it; Any is the
//      union of the three single types and its glyphs are that membership; a
//      duplicate Macaulay row changes nothing; a species holding all three
//      media is invisible. Each runtime derives these from its own builder.
//
// The process zone is pinned to the fixture's zone for the whole file, because
// the app's `isWithinWindow` reads the process's local midnight.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { buildWidgetFixture, fixtureHandover } from './widgetRows.fixtureBuild'
import {
  BODY, ML_ROWS, NOW_ISO, OBSERVATIONS, REFERENCE, TZ, DST_NOW_ISO,
} from './widgetRows.fixtureInputs'
import {
  buildWidgetRows, daysBetween, FAMILY_ROWS, foldName, localCivilDate, parseObsDateStrict,
  reduceWidgetRecords, WIDGET_DIST_KM, WINDOW_DAYS, type WidgetMedia, type WidgetRow, type WidgetWindow,
} from './widgetRows'
import { buildHandover } from './widgetHandover'
import { reduceRecentObs } from '../recentObsReduce'
import { buildNearbyLifers, isWithinWindow } from '../nearbyLifers'
import { normalizeSpeciesName } from '../speciesUtils'
import type { TargetPin } from '../mapExplorerTypes'

const fixture = JSON.parse(readFileSync(new URL('./widgetRows.fixture.json', import.meta.url), 'utf8'))
const WINDOWS: WidgetWindow[] = ['day', 'week', 'all']
const MEDIA: WidgetMedia[] = ['photo', 'audio', 'video', 'any']
const nowMs = Date.parse(NOW_ISO)
const codes = (rows: WidgetRow[]) => new Set(rows.map(r => r.speciesCode))
const sorted = (s: Set<string>) => [...s].sort()

let savedTz: string | undefined
beforeAll(() => { savedTz = process.env.TZ; process.env.TZ = TZ })
afterAll(() => { if (savedTz === undefined) delete process.env.TZ; else process.env.TZ = savedTz })

describe('delivery: the tracked fixture is what the shipped twin builds', () => {
  it('byte-for-byte after a JSON round trip', () => {
    expect(JSON.parse(JSON.stringify(buildWidgetFixture()))).toEqual(fixture)
  })

  it('the request is the app request: dist computed as the handlers compute it, back=30', () => {
    // testing.md: compare two declarations, never restate the literal. The
    // handlers compute `Math.round(radiusMi * 1.60934)`; so does the twin.
    expect(WIDGET_DIST_KM).toBe(Math.round(25 * 1.60934))
    expect(fixture.request.url).toContain(`&dist=${Math.round(25 * 1.60934)}&back=30&fmt=json`)
    expect(fixture.request.url.startsWith('https://api.ebird.org/v2/data/obs/geo/recent?lat=')).toBe(true)
  })

  it('the fixture carries every case FR-16 names (QA-16)', () => {
    const body = fixture.body as Record<string, unknown>[]
    const names = body.map(r => r.comName)
    expect(names).toContain('Mallard (Domestic type)')                         // trailing parenthetical
    expect(names).toContain('NORTHERN SHRIKE')                                  // mixed case
    expect(body.some(r => typeof r.obsDt === 'string' && r.obsDt.startsWith('2026-09-24'))).toBe(true) // same day
    expect(body.some(r => typeof r.obsDt === 'string' && r.obsDt.startsWith('2026-09-17'))).toBe(true) // exactly 7 days
    expect(body.some(r => typeof r.obsDt === 'string' && r.obsDt.startsWith('2026-09-16'))).toBe(true) // 8 days
    expect(body.some(r => !('lat' in r))).toBe(true)                           // no coordinates
    const perCode = new Map<string, Set<string>>()
    for (const r of body) {
      if (typeof r.speciesCode !== 'string') continue
      const s = perCode.get(r.speciesCode) ?? new Set(); s.add(r.locId as string); perCode.set(r.speciesCode, s)
    }
    expect([...perCode.values()].some(s => s.size >= 2)).toBe(true)            // two locations
    const all = fixture.expected.lifers.all as WidgetRow[]
    expect(all.some((r, i) => i > 0 && r.distanceMi === all[i - 1]!.distanceMi)).toBe(true) // equal distance
    // The eight media cases: every subset of {Photo, Audio, Video} held by one recorded species.
    const held = new Map<string, Set<string>>()
    for (const r of ML_ROWS) { const s = held.get(r.commonName) ?? new Set(); s.add(r.format); held.set(r.commonName, s) }
    const subsets = new Set(OBSERVATIONS.map(o => [...(held.get(o.commonName) ?? [])].sort().join('+')))
    for (const want of ['', 'Photo', 'Audio', 'Video', 'Audio+Photo', 'Photo+Video', 'Audio+Video', 'Audio+Photo+Video']) {
      expect(subsets.has(want), `media subset ${want || '(none)'}`).toBe(true)
    }
  })

  it('each family shows the FIRST N rows: 1, 3, 8 of at least 12 (QA-03)', () => {
    expect(FAMILY_ROWS).toEqual({ small: 1, medium: 3, large: 8 })
    const all = fixture.expected.lifers.all as WidgetRow[]
    expect(all.length).toBeGreaterThanOrEqual(12)
    for (const n of [1, 3, 8]) expect(all.slice(0, n).map(r => r.speciesCode)).toEqual(all.map(r => r.speciesCode).slice(0, n))
  })
})

describe('the reduce (FR-13, QA-13)', () => {
  it('one record per (speciesCode, locId) with the latest obsDt and ITS subId', () => {
    const ruff = (fixture.expectedReduced as { speciesCode: string; obsDt: string; subId: string }[]).filter(r => r.speciesCode === 'ruff')
    expect(ruff).toEqual([expect.objectContaining({ obsDt: '2026-09-24 06:10', subId: 'S1002' })])
  })

  it('drops no-coordinate, non-numeric, no-code and impossible-date records', () => {
    const got = new Set((fixture.expectedReduced as { speciesCode: string }[]).map(r => r.speciesCode))
    for (const gone of ['rensti', 'litsti', 'bubsan', '']) expect(got.has(gone), gone).toBe(false)
    expect((fixture.expectedReduced as { comName: string }[]).some(r => r.comName === 'Curlew Sandpiper')).toBe(false)
  })
})

describe('parity with Map Explorer: Nearby Lifers (FR-14, QA-11, QA-14)', () => {
  const appRecords = reduceRecentObs(BODY) as unknown as TargetPin[]
  const recordedNames = new Set(OBSERVATIONS.map(o => normalizeSpeciesName(o.commonName)))
  const appSet = (w: WidgetWindow) => {
    const recs = w === 'all' ? appRecords : appRecords.filter(r => isWithinWindow(r.recentDate, WINDOW_DAYS[w], nowMs))
    return new Set(buildNearbyLifers(recs, recordedNames, REFERENCE.lat, REFERENCE.lng).flatMap(l => l.lifers.map(s => s.speciesCode)))
  }

  it('the fixture zone and the process zone agree on today (the app reads the process zone)', () => {
    expect(localCivilDate(nowMs, Intl.DateTimeFormat().resolvedOptions().timeZone)).toEqual(localCivilDate(nowMs, TZ))
  })

  it.each(WINDOWS)('%s: widget set = app set minus exactly the declared app-only rows', w => {
    const widget = codes(fixture.expected.lifers[w])
    const app = appSet(w)
    // Widget-only: none, ever.
    expect(sorted(new Set([...widget].filter(c => !app.has(c))))).toEqual([])
    // App-only, DECLARED: the record with no species code (the app plots it
    // under '' and the widget drops it), and under 30 days the impossible date
    // `2026-02-30`, which the app never checks there and the strict parse refuses.
    const declared = w === 'all' ? ['', 'bubsan'] : ['']
    expect(sorted(new Set([...app].filter(c => !widget.has(c))))).toEqual(declared)
  })

  it('a recorded parenthetical form and a mixed-case name are subtracted on both sides', () => {
    for (const w of WINDOWS) {
      for (const c of ['mallar2', 'norshr']) {
        expect(codes(fixture.expected.lifers[w]).has(c)).toBe(false)
        expect(appSet(w).has(c)).toBe(false)
      }
    }
  })

  it('the non-countable form and the escapee are listed on both sides (no countability filter)', () => {
    for (const c of ['gull', 'mandar']) {
      expect(codes(fixture.expected.lifers.all).has(c)).toBe(true)
      expect(appSet('all').has(c)).toBe(true)
    }
  })

  it('Week keeps exactly-7-days and drops 8 days; 30 days keeps the 29-day-old report', () => {
    const week = codes(fixture.expected.lifers.week)
    expect(week.has('bkpwar')).toBe(true)
    expect(week.has('prowar')).toBe(false)
    expect(codes(fixture.expected.lifers.all).has('sabgul')).toBe(true)
    expect(codes(fixture.expected.lifers.all).has('prowar')).toBe(true)
  })
})

describe('parity with Map Explorer: Media Targets, every media value (FR-15, FR-52, QA-15, QA-59)', () => {
  // The in-app derivation, re-stated from MapExplorer.tsx: `mediaTypes` keyed by
  // the RAW Macaulay name, `targetSpecies` = backup names missing any type, the
  // pins filtered to the target species (the app does this by taxonomy code;
  // the widget by folded name, OQ-02), each pin's `missingTypes` from the pin's
  // own eBird name, and the chips as an AND over `missingTypes`.
  const mediaTypes = new Map<string, Set<string>>()
  for (const r of ML_ROWS) { const s = mediaTypes.get(r.commonName) ?? new Set(); s.add(r.format); mediaTypes.set(r.commonName, s) }
  const targetNames = new Set<string>()
  for (const o of OBSERVATIONS) {
    const t = mediaTypes.get(o.commonName)
    if (!(t?.has('Photo') && t?.has('Audio') && t?.has('Video'))) targetNames.add(foldName(o.commonName))
  }
  const appRecords = reduceRecentObs(BODY) as unknown as TargetPin[]
  const CHIPS: Record<WidgetMedia, ('Photo' | 'Audio' | 'Video')[]> = { photo: ['Photo'], audio: ['Audio'], video: ['Video'], any: [] }
  const appSet = (m: WidgetMedia, w: WidgetWindow) => {
    let pins = appRecords.filter(p => targetNames.has(foldName(p.comName)))
    if (w !== 'all') pins = pins.filter(p => isWithinWindow(p.recentDate, WINDOW_DAYS[w], nowMs))
    const withMissing = pins.map(p => ({ ...p, missingTypes: (['Photo', 'Audio', 'Video'] as const).filter(t => !mediaTypes.get(p.comName)?.has(t)) }))
    const chips = CHIPS[m]
    return new Set(withMissing.filter(p => chips.every(t => p.missingTypes.includes(t))).map(p => p.speciesCode))
  }

  for (const m of MEDIA) {
    it.each(WINDOWS)(`${m} / %s: the widget set EQUALS the app set with the matching chips`, w => {
      expect(sorted(codes(fixture.expected.targets[m][w]))).toEqual(sorted(appSet(m, w)))
    })
  }

  it('under Any all seven species missing anything are present and the all-media species is absent', () => {
    const any = codes(fixture.expected.targets.any.all)
    expect(sorted(any)).toEqual(['belspa', 'calthr', 'hutvir', 'nutwoo', 'oaktit', 'wrenti', 'yebmag'])
    expect(any.has('acowoo')).toBe(false)
    for (const m of ['photo', 'audio', 'video'] as const) expect(codes(fixture.expected.targets[m].all).size).toBe(4)
  })
})

describe('structure: each derived from the builder itself (CLAUDE.md, agreeing wrong numbers)', () => {
  const handover = fixtureHandover()
  const build = (body: unknown[], kind: 'lifers' | 'targets', window: WidgetWindow, media: WidgetMedia, h = handover) =>
    buildWidgetRows({ records: reduceWidgetRecords(body)!, handover: h, kind, window, media, reference: REFERENCE, nowMs, tz: TZ })

  const MALFORMED: [string, (b: Record<string, unknown>[]) => Record<string, unknown>[]][] = [
    ['no coordinates', b => b.filter(r => r.speciesCode !== 'rensti')],
    ['non-numeric latitude', b => b.filter(r => r.speciesCode !== 'litsti')],
    ['no species code', b => b.filter(r => 'speciesCode' in r)],
    ['impossible date', b => b.filter(r => r.speciesCode !== 'bubsan')],
  ]
  it.each(MALFORMED)('a body with the %s record builds the same rows as the body without it', (_name, without) => {
    for (const w of WINDOWS) {
      expect(build(BODY, 'lifers', w, 'any')).toEqual(build(without(BODY), 'lifers', w, 'any'))
      for (const m of MEDIA) expect(build(BODY, 'targets', w, m)).toEqual(build(without(BODY), 'targets', w, m))
    }
  })

  it('hostile elements a real body never carries are skipped, not thrown on', () => {
    const hostile = [...BODY, null, 7, 'x', [], { speciesCode: 'longo', comName: 'x'.repeat(513), lat: 37.4, lng: -122, obsDt: '2026-09-24 08:00' },
      { speciesCode: 'farlat', comName: 'Far', locId: 'L9', lat: 91, lng: 0, obsDt: '2026-09-24 08:00' }]
    for (const w of WINDOWS) expect(build(hostile, 'lifers', w, 'any')).toEqual(build(BODY, 'lifers', w, 'any'))
    expect(reduceWidgetRecords({ not: 'an array' })).toBeNull()
  })

  it('Any is the union of Photo, Audio and Video, and each row\'s glyphs are exactly that membership', () => {
    for (const w of WINDOWS) {
      const any = build(BODY, 'targets', w, 'any')
      const single = Object.fromEntries((['photo', 'audio', 'video'] as const).map(m => [m, codes(build(BODY, 'targets', w, m))]))
      expect(sorted(codes(any))).toEqual(sorted(new Set([...single.photo!, ...single.audio!, ...single.video!])))
      for (const row of any) {
        expect(row.missingMedia).toEqual((['photo', 'audio', 'video'] as const).filter(m => single[m]!.has(row.speciesCode)))
      }
    }
  })

  it('a duplicate Macaulay row for a type already held changes nothing (the writer counts types, not rows)', () => {
    const base = buildHandover({ nowMs, appVersion: '1', ebirdKey: null, observations: OBSERVATIONS, mlRows: ML_ROWS, mapDefaults: null })
    const dup = buildHandover({ nowMs, appVersion: '1', ebirdKey: null, observations: OBSERVATIONS, mlRows: [...ML_ROWS, ML_ROWS[0]!, ML_ROWS[0]!], mapDefaults: null })
    expect(dup).toEqual(base)
  })

  it('a species in none of the target sets is invisible to targets whether or not it is recorded', () => {
    // Acorn Woodpecker holds all three types. Removing it from `recorded` too
    // must not change a single targets row: its visibility comes from the sets.
    const without = { ...handover, recorded: handover.recorded.filter(n => n !== 'acorn woodpecker') }
    expect(handover.recorded).toContain('acorn woodpecker')
    for (const w of WINDOWS) for (const m of MEDIA) expect(build(BODY, 'targets', w, m, without)).toEqual(build(BODY, 'targets', w, m))
  })

  it('changing the window or the media value never needs a new body (FR-12): one reduce serves all fifteen lists', () => {
    const records = reduceWidgetRecords(BODY)!
    for (const w of WINDOWS) for (const m of MEDIA) {
      const rows = buildWidgetRows({ records, handover, kind: 'targets', window: w, media: m, reference: REFERENCE, nowMs, tz: TZ })
      expect(rows).toEqual(fixture.expected.targets[m][w])
    }
  })

  it('distances are recomputed from the reference, never carried (FR-24)', () => {
    const moved = { lat: REFERENCE.lat + 0.01, lng: REFERENCE.lng }
    const a = buildWidgetRows({ records: reduceWidgetRecords(BODY)!, handover, kind: 'lifers', window: 'all', media: 'any', reference: moved, nowMs, tz: TZ })
    expect(a[0]!.distanceMi).not.toBe((fixture.expected.lifers.all as WidgetRow[]).find(r => r.speciesCode === a[0]!.speciesCode)!.distanceMi)
  })
})

describe('the declared day-count difference (schema.md section 6.2)', () => {
  it('on the day after spring-forward the twin counts calendar days and the app is one short', () => {
    const dstNow = Date.parse(DST_NOW_ISO)
    const today = localCivilDate(dstNow, TZ)
    const rows = fixture.dstFamily.rows as { obsDt: string; days: number; inWeek: boolean }[]
    expect(rows.map(r => r.days)).toEqual([1, 7, 8])
    for (const r of rows) expect(daysBetween(parseObsDateStrict(r.obsDt)!, today)).toBe(r.days)
    // The app, in the same zone, on the same day: 8 days reads as 7 and is
    // admitted by a Week list. Asserted so the difference is a measured,
    // declared one; a future fix to isWithinWindow turns this red on purpose.
    expect(isWithinWindow('2026-03-01 08:00', 7, dstNow)).toBe(true)
    expect(rows[2]!.inWeek).toBe(false)
  })
})

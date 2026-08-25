// The pure classification module (color-coded-hotspots): FR-05/FR-06 personal
// stats, the state-resolution table (every variant reachable, no honest
// non-value ever on the ramp), tiers = computeCountyTiers(…, 5) parity, the
// legend-from-same-tiers parity (NFR-10), the sprite-key mapping, and the
// mode-3 status copy builders.

import { describe, it, expect } from 'vitest'
import {
  HOTSPOT_CLASS_COUNT, ACTIVITY_FETCH_CAP,
  HOTSPOT_MODE_OPTIONS, ACTIVITY_WINDOW_OPTIONS,
  buildHotspotPersonalStats, computeHotspotTiers, hotspotReading, readingSpriteKey,
  hotspotLegendModel, hotspotPopupModeLine, hotspotListValue,
  activityStatusSentence, activityCapLines, activityErrorLines, activityWindowWord,
  ACTIVITY_SLOWDOWN_SENTENCE,
  type ActivityAnswer, type ActivityStatusFields, type HotspotReading,
  type HotspotColorMode, type HotspotPopupModeLine,
} from './hotspotColorModes'
import { computeCountyTiers } from './countyShading'
import { HOTSPOT_MODE_IMAGE_ID, HOTSPOT_MODE_SPRITE_KEYS } from './mapPins'
import type { HotspotPin } from './mapExplorerTypes'
import type { ObservationEntry } from '../types'

const obs = (over: Partial<ObservationEntry>): ObservationEntry => ({
  submissionId: 'S1', commonName: 'Song Sparrow', scientificName: 'Melospiza melodia',
  date: '2026-05-01', location: 'Marsh', locationId: 'L1',
  latitude: 37.9, longitude: -122.24, county: 'Alameda',
  count: 1, breedingCode: null, speciesComments: '', catalogIds: [],
  stateProvince: 'US-CA',
  ...over,
})

const visited = (locId: string): HotspotPin =>
  ({ kind: 'visited', locId, locName: locId, lat: 0, lng: 0, speciesCount: 1, lastVisit: '2026-01-01' })
const unvisited = (locId: string): HotspotPin =>
  ({ kind: 'unvisited', locId, locName: locId, lat: 0, lng: 0 })
const personalPin = (locId: string): HotspotPin =>
  ({ kind: 'personal', locId, locName: locId, lat: 0, lng: 0, obsCount: 2, lastVisit: '2026-01-01' })

describe('buildHotspotPersonalStats (FR-05 / FR-06, QA-04 / QA-05)', () => {
  it('hand-computed fixture: subspecies fold, non-countable forms excluded, escapees INCLUDED', () => {
    const stats = buildHotspotPersonalStats([
      // Two forms of ONE species — folds to one countable species.
      obs({ submissionId: 'S1', commonName: 'Yellow-rumped Warbler (Myrtle)' }),
      obs({ submissionId: 'S1', commonName: 'Yellow-rumped Warbler (Audubon\'s)' }),
      // A spuh and a species-level slash — never countable.
      obs({ submissionId: 'S2', commonName: 'gull sp.' }),
      obs({ submissionId: 'S2', commonName: 'Greater/Lesser Scaup' }),
      // The DISCRIMINATING eBird-corrections row: shape-countable (no " x ",
      // no "/", no " sp.") but eBird rejects it — a raw string-shape rule
      // would wrongly count it (the v0.5.89 direction-B case).
      obs({ submissionId: 'S2', commonName: "Brewster's Warbler (hybrid)" }),
      // The countable intraspecific intergrade — a raw-name " x " rule would
      // wrongly EXCLUDE it (the discriminating direction-A case).
      obs({ submissionId: 'S3', commonName: "Yellow-rumped Warbler (Myrtle x Audubon's)" }),
      // A classic escapee species COUNTS here: the escapee provenance rule is
      // deliberately not applied on this surface (FR-05 / OQ-5) — and there is
      // no provenance input to this function at all, structurally.
      obs({ submissionId: 'S3', commonName: 'Indian Peafowl' }),
      // A second species, second location.
      obs({ submissionId: 'S4', commonName: 'American Crow', locationId: 'L2' }),
    ])
    // L1: Yellow-rumped Warbler (folded, incl. the intergrade) + Indian Peafowl
    // = 2 countable species across 3 distinct checklists.
    expect(stats.get('L1')).toEqual({ species: 2, checklists: 3 })
    // L2: one species, one checklist.
    expect(stats.get('L2')).toEqual({ species: 1, checklists: 1 })
  })

  it('counts distinct checklists even when every row is non-countable (visited, zero species — FR-08)', () => {
    const stats = buildHotspotPersonalStats([
      obs({ submissionId: 'S1', commonName: 'gull sp.' }),
      obs({ submissionId: 'S2', commonName: 'duck sp.' }),
    ])
    expect(stats.get('L1')).toEqual({ species: 0, checklists: 2 })
  })
})

describe('computeHotspotTiers (FR-20, QA-21)', () => {
  it('is computeCountyTiers with maxClasses 5 — parity on breaks, legend, and tierFor', () => {
    const values = [3, 8, 8, 15, 21, 40, 77, 102]
    const ours = computeHotspotTiers(values)
    const county = computeCountyTiers(values, HOTSPOT_CLASS_COUNT)
    expect(ours.breaks).toEqual(county.breaks)
    expect(ours.legend).toEqual(county.legend)
    for (const v of [0, 1, 3, 8, 20, 102, 999]) expect(ours.tierFor(v)).toBe(county.tierFor(v))
  })

  it('two distinct nonzero values render two classes without error (QA-21)', () => {
    const tiers = computeHotspotTiers([4, 4, 9])
    expect(tiers.legend.length).toBe(2)
  })

  it('no nonzero values → empty legend, tierFor always 0', () => {
    const tiers = computeHotspotTiers([])
    expect(tiers.legend).toEqual([])
    expect(tiers.tierFor(5)).toBe(0)
  })
})

describe('hotspotReading — the state resolution table', () => {
  const stats = buildHotspotPersonalStats([
    obs({ submissionId: 'S1', commonName: 'Song Sparrow', locationId: 'LV' }),
    obs({ submissionId: 'S2', commonName: 'gull sp.', locationId: 'LZ' }),
  ])
  const tiers = computeHotspotTiers([1])
  const answers = new Map<string, ActivityAnswer>([
    ['LA', { count7: 3, count30: 9, fetchedAt: 1000, fromCache: false }],
    ['LQ', { count7: 0, count30: 0, fetchedAt: 2000, fromCache: true }],
    ['LW', { count7: 0, count30: 5, fetchedAt: 3000, fromCache: false }],
  ])
  const activityFor = (locId: string) => answers.get(locId) ?? null

  it('personal pins are personal in every mode (FR-21, QA-22)', () => {
    for (const mode of ['default', 'mySpecies', 'myChecklists', 'activity'] as const) {
      expect(hotspotReading(personalPin('LP'), mode, 7, tiers, stats, activityFor).state).toBe('personal')
    }
  })

  it('default mode is default for public pins', () => {
    expect(hotspotReading(visited('LV'), 'default', 7, tiers, stats, activityFor).state).toBe('default')
  })

  it('mode 1/2: no backup rows → noData; zero value → zero; nonzero → ramp (FR-08)', () => {
    expect(hotspotReading(unvisited('LX'), 'mySpecies', 7, tiers, stats, activityFor)).toEqual({ state: 'noData' })
    expect(hotspotReading(visited('LZ'), 'mySpecies', 7, tiers, stats, activityFor)).toEqual({ state: 'zero', value: 0 })
    expect(hotspotReading(visited('LV'), 'mySpecies', 7, tiers, stats, activityFor)).toEqual({ state: 'ramp', tier: 1, value: 1 })
    // Mode 2: the zero-species checklist still counts as effort.
    expect(hotspotReading(visited('LZ'), 'myChecklists', 7, tiers, stats, activityFor)).toEqual({ state: 'ramp', tier: 1, value: 1 })
  })

  it('mode 3: no answer → unanswered; answered 0 → quiet; answered nonzero → ramp (FR-12/FR-13)', () => {
    expect(hotspotReading(visited('LX'), 'activity', 7, tiers, stats, activityFor)).toEqual({ state: 'unanswered' })
    expect(hotspotReading(visited('LQ'), 'activity', 7, tiers, stats, activityFor)).toMatchObject({ state: 'quiet', window: 7, fromCache: true, fetchedAt: 2000 })
    expect(hotspotReading(visited('LA'), 'activity', 7, tiers, stats, activityFor)).toMatchObject({ state: 'ramp', value: 3, window: 7 })
  })

  it('the window picks which count reads — 0-in-week but active-in-30 flips quiet ↔ ramp (FR-16)', () => {
    expect(hotspotReading(visited('LW'), 'activity', 7, tiers, stats, activityFor).state).toBe('quiet')
    expect(hotspotReading(visited('LW'), 'activity', 30, tiers, stats, activityFor)).toMatchObject({ state: 'ramp', value: 5 })
  })

  it('no honest non-value can ever be a ramp state (two independent locks)', () => {
    // The classifier never passes 0 to tierFor…
    for (const r of [
      hotspotReading(visited('LZ'), 'mySpecies', 7, tiers, stats, activityFor),
      hotspotReading(unvisited('LX'), 'mySpecies', 7, tiers, stats, activityFor),
      hotspotReading(visited('LQ'), 'activity', 7, tiers, stats, activityFor),
      hotspotReading(visited('LX'), 'activity', 7, tiers, stats, activityFor),
    ]) expect(r.state).not.toBe('ramp')
    // …and computeCountyTiers maps 0 to tier 0 anyway.
    expect(tiers.tierFor(0)).toBe(0)
  })
})

describe('readingSpriteKey', () => {
  it('every output is a real sprite key (or the shipped personal sprite)', () => {
    const readings: [HotspotReading, HotspotPin['kind']][] = [
      [{ state: 'ramp', tier: 1, value: 2 }, 'visited'],
      [{ state: 'ramp', tier: 5, value: 900 }, 'unvisited'],
      [{ state: 'ramp', tier: 0, value: 1 }, 'visited'],    // defensive clamp
      [{ state: 'zero', value: 0 }, 'visited'],
      [{ state: 'noData' }, 'unvisited'],
      [{ state: 'quiet', window: 7 }, 'visited'],
      [{ state: 'quiet', window: 30 }, 'unvisited'],
      [{ state: 'unanswered' }, 'visited'],
      [{ state: 'unanswered' }, 'unvisited'],
      [{ state: 'personal' }, 'personal'],
    ]
    const valid = new Set<string>([...HOTSPOT_MODE_SPRITE_KEYS, 'personal'])
    for (const [r, kind] of readings) {
      expect(valid.has(readingSpriteKey(r, kind))).toBe(true)
    }
  })

  it('the kind rides the key (FR-22) and the single-kind states need no suffix', () => {
    expect(readingSpriteKey({ state: 'ramp', tier: 3, value: 9 }, 'visited')).toBe('t3-visited')
    expect(readingSpriteKey({ state: 'ramp', tier: 3, value: 9 }, 'unvisited')).toBe('t3-unvisited')
    expect(readingSpriteKey({ state: 'zero', value: 0 }, 'visited')).toBe('zero')
    expect(readingSpriteKey({ state: 'noData' }, 'unvisited')).toBe('nodata')
    expect(readingSpriteKey({ state: 'quiet', window: 7 }, 'unvisited')).toBe('quiet-unvisited')
    expect(readingSpriteKey({ state: 'unanswered' }, 'visited')).toBe('unanswered-visited')
  })

  it('the sprite table is the schema-fixed 16, each with a distinct image id', () => {
    expect(HOTSPOT_MODE_SPRITE_KEYS.length).toBe(16)
    expect(new Set(Object.values(HOTSPOT_MODE_IMAGE_ID)).size).toBe(16)
  })
})

describe('hotspotLegendModel (FR-24, NFR-10 legend-cannot-drift parity)', () => {
  const tiers = computeHotspotTiers([2, 6, 15, 40, 90])

  it('classes ARE the tiers.legend object the layer paints from (same reference, not a copy)', () => {
    const model = hotspotLegendModel('mySpecies', 7, tiers, { noData: true, zero: false, quiet: false, unanswered: false })
    expect(model.classes).toBe(tiers.legend)
  })

  it('mode titles and subtitles match the approved copy', () => {
    expect(hotspotLegendModel('mySpecies', 7, tiers, { noData: false, zero: false, quiet: false, unanswered: false }))
      .toMatchObject({ title: 'My species', subtitle: 'your countable species per hotspot, this search' })
    expect(hotspotLegendModel('myChecklists', 7, tiers, { noData: false, zero: false, quiet: false, unanswered: false }))
      .toMatchObject({ title: 'My checklists', subtitle: 'your checklists per hotspot, this search' })
    expect(hotspotLegendModel('activity', 7, tiers, { noData: false, zero: false, quiet: false, unanswered: false }).subtitle)
      .toBe('species in the last week')
    expect(hotspotLegendModel('activity', 30, tiers, { noData: false, zero: false, quiet: false, unanswered: false }).subtitle)
      .toBe('species in the last 30 days')
  })

  it('personal modes always carry nodata; zero only when in effect; mode 3 carries quiet/unanswered per flags', () => {
    const m1 = hotspotLegendModel('mySpecies', 7, tiers, { noData: false, zero: true, quiet: false, unanswered: false })
    expect(m1.states.map(s => s.key)).toEqual(['noData', 'zero'])
    const m2 = hotspotLegendModel('myChecklists', 7, tiers, { noData: false, zero: false, quiet: false, unanswered: false })
    expect(m2.states.map(s => s.key)).toEqual(['noData'])
    const m3 = hotspotLegendModel('activity', 7, tiers, { noData: false, zero: false, quiet: true, unanswered: true })
    expect(m3.states.map(s => s.key)).toEqual(['quiet', 'unanswered'])
    expect(m3.states.map(s => s.label)).toEqual(['Quiet, no reports in this window', 'Not checked yet'])
  })
})

describe('popup mode line + list value (FR-25 / FR-26)', () => {
  const t = (ms: number) => `T${ms}`

  it('ramp lines per mode, with the cached as-of only when fromCache', () => {
    expect(hotspotPopupModeLine({ state: 'ramp', tier: 2, value: 14 }, 'mySpecies', t, 'visited'))
      .toEqual({ swatch: 'ramp', tier: 2, primary: 'My species: 14' })
    expect(hotspotPopupModeLine({ state: 'ramp', tier: 2, value: 3 }, 'myChecklists', t, 'visited'))
      .toEqual({ swatch: 'ramp', tier: 2, primary: 'My checklists: 3' })
    expect(hotspotPopupModeLine({ state: 'ramp', tier: 4, value: 51, window: 7, fromCache: false, fetchedAt: 5 }, 'activity', t, 'visited'))
      .toEqual({ swatch: 'ramp', tier: 4, primary: '51 species reported in the last week' })
    expect(hotspotPopupModeLine({ state: 'ramp', tier: 4, value: 51, window: 30, fromCache: true, fetchedAt: 5 }, 'activity', t, 'visited'))
      .toEqual({ swatch: 'ramp', tier: 4, primary: '51 species reported in the last 30 days', cachedLine: 'From cache, fetched T5.' })
  })

  it('the four honest non-values carry their exact wording', () => {
    expect(hotspotPopupModeLine({ state: 'zero', value: 0 }, 'mySpecies', t, 'visited'))
      .toEqual({ swatch: 'pale', primary: 'My species: 0', secondary: 'Only spuh and slash entries so far.' })
    expect(hotspotPopupModeLine({ state: 'noData' }, 'mySpecies', t, 'unvisited'))
      .toEqual({ swatch: 'nodata', primary: 'You have not birded this hotspot' })
    expect(hotspotPopupModeLine({ state: 'quiet', window: 7, fromCache: true, fetchedAt: 9 }, 'activity', t, 'visited'))
      .toEqual({ swatch: 'pale', primary: 'No species reported in the last week', secondary: 'Quiet right now. An answer, not a gap.', cachedLine: 'From cache, fetched T9.' })
    expect(hotspotPopupModeLine({ state: 'unanswered' }, 'activity', t, 'visited'))
      .toEqual({ swatch: 'unanswered', primary: 'Activity not checked yet' })
  })

  it('personal and default render no mode line', () => {
    expect(hotspotPopupModeLine({ state: 'personal' }, 'activity', t, 'personal')).toBeNull()
    expect(hotspotPopupModeLine({ state: 'default' }, 'default', t, 'unvisited')).toBeNull()
  })

  it('an unvisited popup states its visited state in EVERY mode and reading (FR-22 / QA-23)', () => {
    // The whole mode × reading matrix, so the gap cannot reopen on one branch.
    // Mode 3's readings carry the dedicated muted line; modes 1/2's unvisited
    // reading is structurally noData, whose primary already states it in
    // words. The mode-1/2 ramp and zero rows cannot occur for an unvisited
    // pin today (personal stats imply visited) — pinned anyway so the
    // property survives any reading a future refactor lets through. Literals
    // throughout, never the exported constant, so a copy drift fails here.
    const statesIt = (line: HotspotPopupModeLine | null): boolean =>
      line !== null && (
        line.visitedLine === 'You have not visited this hotspot' ||
        line.primary === 'You have not birded this hotspot'
      )
    const matrix: [HotspotReading, HotspotColorMode][] = [
      [{ state: 'ramp', tier: 2, value: 5, window: 7, fromCache: false, fetchedAt: 1 }, 'activity'],
      [{ state: 'ramp', tier: 1, value: 3, window: 30, fromCache: true, fetchedAt: 1 }, 'activity'],
      [{ state: 'quiet', window: 7 }, 'activity'],
      [{ state: 'quiet', window: 30, fromCache: true, fetchedAt: 9 }, 'activity'],
      [{ state: 'unanswered' }, 'activity'],
      [{ state: 'noData' }, 'mySpecies'],
      [{ state: 'noData' }, 'myChecklists'],
      [{ state: 'ramp', tier: 1, value: 2 }, 'mySpecies'],
      [{ state: 'ramp', tier: 1, value: 2 }, 'myChecklists'],
      [{ state: 'zero', value: 0 }, 'mySpecies'],
      [{ state: 'zero', value: 0 }, 'myChecklists'],
    ]
    for (const [reading, mode] of matrix) {
      expect(statesIt(hotspotPopupModeLine(reading, mode, t, 'unvisited')), `${mode} / ${reading.state}`).toBe(true)
    }
    // One full-shape pin: the muted line rides WITH the mode line, never
    // replacing it (FR-25's retained-content rule), exact string included.
    expect(hotspotPopupModeLine({ state: 'quiet', window: 7, fromCache: true, fetchedAt: 9 }, 'activity', t, 'unvisited'))
      .toEqual({
        swatch: 'pale',
        primary: 'No species reported in the last week',
        secondary: 'Quiet right now. An answer, not a gap.',
        cachedLine: 'From cache, fetched T9.',
        visitedLine: 'You have not visited this hotspot',
      })
    // Visited pins never carry it in any reading — their side is stated by
    // the shipped "{n} species recorded / Last visit" lines the popup retains.
    for (const [reading, mode] of matrix) {
      expect(hotspotPopupModeLine(reading, mode, t, 'visited')?.visitedLine, `${mode} / ${reading.state}`).toBeUndefined()
    }
  })

  it('list values: number / muted 0 / muted not birded / muted …', () => {
    expect(hotspotListValue({ state: 'ramp', tier: 1, value: 7 })).toEqual({ text: '7', muted: false })
    expect(hotspotListValue({ state: 'zero', value: 0 })).toEqual({ text: '0', muted: true })
    expect(hotspotListValue({ state: 'quiet', window: 7 })).toEqual({ text: '0', muted: true })
    expect(hotspotListValue({ state: 'noData' })).toEqual({ text: 'not birded', muted: true })
    expect(hotspotListValue({ state: 'unanswered' })).toEqual({ text: '…', muted: true })
    expect(hotspotListValue({ state: 'personal' })).toBeNull()
  })
})

describe('mode-3 status copy (design-spec Content Notes)', () => {
  const t = (ms: number) => `T${ms}`
  const base: ActivityStatusFields = {
    phase: 'done', answered: 19, target: 19, cappedCount: 0,
    cacheServed: 0, liveFetched: 19, failedCount: 0,
    latestCachedAt: null, latestAnswerAt: 100, rateLimited: false, error: null,
  }

  it('running → N of M; done live → checked just now; cached pass → from-cache line', () => {
    expect(activityStatusSentence({ ...base, phase: 'running', answered: 14 }, false, t))
      .toBe('Checking activity: 14 of 19 hotspots')
    expect(activityStatusSentence(base, false, t)).toBe('All 19 hotspots checked just now.')
    expect(activityStatusSentence({ ...base, liveFetched: 0, cacheServed: 19, latestCachedAt: 42 }, false, t))
      .toBe('Activity from cache, fetched T42.')
  })

  it('window flip: appended to the cached line, or the zero-request sentence after a live pass', () => {
    expect(activityStatusSentence({ ...base, liveFetched: 0, cacheServed: 19, latestCachedAt: 42 }, true, t))
      .toBe('Activity from cache, fetched T42. Window switches never refetch.')
    expect(activityStatusSentence(base, true, t))
      .toBe('Window switched. Zero new requests, one cached call answers both.')
  })

  it('an error state silences the sentence (the warn box carries it)', () => {
    expect(activityStatusSentence({ ...base, error: { kind: 'error', message: 'x' } }, false, t)).toBe('')
  })

  it('the 429 cooldown appends the slowdown line to the running sentence only (pacing revision)', () => {
    expect(activityStatusSentence({ ...base, phase: 'running', answered: 14, rateLimited: true }, false, t))
      .toBe(`Checking activity: 14 of 19 hotspots. ${ACTIVITY_SLOWDOWN_SENTENCE}`)
    // Pinned exactly: the live region reads this string.
    expect(ACTIVITY_SLOWDOWN_SENTENCE)
      .toBe('eBird asked us to slow down, so this is taking a little longer.')
    expect(ACTIVITY_SLOWDOWN_SENTENCE).not.toContain('—')
    // Terminal sentences ignore the flag (the pass ended; the summary stays
    // the honest answered/unanswered report).
    expect(activityStatusSentence({ ...base, rateLimited: true }, false, t))
      .toBe('All 19 hotspots checked just now.')
  })

  it('cap sentences appear only when the cap bit, in words (FR-19 / QA-20)', () => {
    expect(activityCapLines(base)).toEqual([])
    expect(activityCapLines({ ...base, cappedCount: 14 })).toEqual([
      `Checked ${ACTIVITY_FETCH_CAP} hotspots: on your screen first, then nearest your search center.`,
      `14 more stay in the not-checked gray. Search a smaller area to cover them. Cached hotspots never count against the ${ACTIVITY_FETCH_CAP}.`,
    ])
  })

  it('failure support lines per kind (FR-14)', () => {
    expect(activityErrorLines({ ...base, answered: 11, target: 19, latestAnswerAt: 40, error: { kind: 'offline', message: 'x' } }, t)).toEqual([
      'Showing cached activity for 11 hotspots, fetched T40. 8 more stay in the not-checked gray until you\'re back online.',
      'My species and My checklists still work fully offline.',
    ])
    expect(activityErrorLines({ ...base, answered: 0, target: 19, latestAnswerAt: null, error: { kind: 'offline', message: 'x' } }, t)).toEqual([
      'My species and My checklists still work fully offline.',
    ])
    expect(activityErrorLines({ ...base, error: { kind: 'no-key', message: 'x' } }, t)).toEqual([
      'Recent activity needs your own eBird key. Pins stay in the not-checked gray until one is added.',
    ])
    expect(activityErrorLines({ ...base, answered: 12, target: 19, error: { kind: 'error', message: 'x' } }, t)).toEqual([
      '12 hotspots kept the answers that already arrived. Retry re-asks only the 7 that failed.',
    ])
  })

  it('window words are lowercase week / 30 days', () => {
    expect(activityWindowWord(7)).toBe('week')
    expect(activityWindowWord(30)).toBe('30 days')
  })

  it('selector and window options carry the approved labels over label-agnostic values', () => {
    expect(HOTSPOT_MODE_OPTIONS).toEqual([
      { value: 'default', label: 'Visited status' },
      { value: 'mySpecies', label: 'My species' },
      { value: 'myChecklists', label: 'My checklists' },
      { value: 'activity', label: 'Recent activity' },
    ])
    expect(ACTIVITY_WINDOW_OPTIONS).toEqual([
      { value: 7, label: 'Week' },
      { value: 30, label: '30 days' },
    ])
  })
})

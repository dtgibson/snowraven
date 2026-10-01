/// <reference types="node" />
// THE ALERT CHECK'S RULES AGAINST THE APP'S OWN (ios-alerts, schema.md 8.3;
// QA-22 to QA-28, QA-32 to QA-34, QA-38).
//
// Three kinds of evidence, kept apart on purpose:
//   1. DELIVERY: the tracked alertRules.fixture.json equals what the shipped
//      TypeScript twin builds from the hand-authored inputs today. The Swift
//      `AlertsLogic/` reproduces the same file on the release machine
//      (`AlertRulesParityTests` in snowraven_widgetsTests; ubuntu-latest CI
//      cannot compile Swift), which is the cross-runtime claim; this row keeps
//      the file from drifting from the twin between those runs.
//   2. PARITY WITH THE APP: the candidate species set of a body equals the
//      app's Nearby Lifers species set (`buildNearbyLifers`, the in-app path)
//      minus non-countable forms, which is FR-23 itself; and the parameterized
//      countability twin equals `isNonCountableForm` with the artifact's lists.
//   3. STRUCTURE (CLAUDE.md, "an agreeing wrong number"): a body with a
//      malformed record gives the same candidates as the body without it;
//      eviction is idempotent; a merge is order-independent as a set; an equal
//      start and end is never quiet over the whole domain of minutes.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { buildAlertFixture } from './alertRules.fixtureBuild'
import {
  alertCandidates, evictInbox, isNonCountableWith, isQuiet, mergePending,
} from './alertRules'
import { CANDIDATE_CASES, CHECK_CASES, EVICT_CASES, MALFORMED_RECORDS, MERGE_CASES, QA22 } from './alertRules.fixtureInputs'
import { reduceWidgetRecords } from '../widgets/widgetRows'
import { buildNearbyLifers } from '../nearbyLifers'
import { reduceRecentObs } from '../recentObsReduce'
import {
  EBIRD_COUNTABLE_EXCEPTIONS, EBIRD_NONCOUNTABLE_EXCEPTIONS, isNonCountableForm,
} from '../speciesUtils'
import type { TargetPin } from '../mapExplorerTypes'

const tracked = readFileSync(new URL('./alertRules.fixture.json', import.meta.url), 'utf8')

describe('delivery: the tracked fixture is what the shipped twin builds', () => {
  it('byte-equal to a fresh build', () => {
    expect(tracked).toBe(JSON.stringify(buildAlertFixture(), null, 1) + '\n')
  })

  it('non-vacuous: every family is populated, and QA-22 is exactly {C, D}', () => {
    const f = JSON.parse(tracked)
    for (const k of ['candidates', 'checks', 'evict', 'merge', 'notification', 'links', 'retryAfter', 'outcome', 'resolve']) {
      expect(f[k].length, k).toBeGreaterThan(2)
    }
    expect(f.quiet.isQuiet.length).toBeGreaterThan(10)
    expect(f.quiet.windowEnd.length).toBeGreaterThan(5)
    expect(f.countability.corpus.count).toBe(f.countability.corpus.verdicts.length)
    const qa22 = f.candidates.find((c: { name: string }) => c.name === 'qa22')
    expect(qa22.expected.map((h: { speciesCode: string }) => h.speciesCode).sort()).toEqual(['ruff', 'sabgul'])
  })
})

describe('parity with the app: FR-23 is the Nearby Lifers subtraction plus the shared countability rule', () => {
  // The in-app path: the shared reducer, then buildNearbyLifers against the
  // backup's RAW names (it normalizes them itself), then the species set.
  function appSpecies(body: unknown[], rawRecorded: string[]): Set<string> {
    const pins = reduceRecentObs(body as Record<string, unknown>[]) as unknown as TargetPin[]
    const locs = buildNearbyLifers(pins, new Set(rawRecorded), 0, 0)
    const out = new Set<string>()
    for (const l of locs) for (const x of l.lifers) if (!isNonCountableForm(x.comName)) out.add(x.speciesCode)
    return out
  }

  it.each(CANDIDATE_CASES.map(c => [c.name, c] as const))('%s: the candidate set equals the app\'s', (_n, c) => {
    // The hand-over's recorded names are folded; the backup's raw names fold to
    // the same, so the folded list stands in for the raw one here.
    const ours = new Set(alertCandidates(reduceWidgetRecords(c.body) ?? [], c.recorded, c.point).map(h => h.speciesCode))
    const app = appSpecies(c.body, c.recorded)
    // The widget reducer drops records the app's list also drops, so the sets
    // agree exactly; a species present in one only is the defect.
    expect([...ours].sort()).toEqual([...app].sort())
  })

  it('the parameterized twin IS the app rule with the artifact\'s lists, over every listed name', () => {
    const rejects = new Set(EBIRD_NONCOUNTABLE_EXCEPTIONS)
    const counts = new Set(EBIRD_COUNTABLE_EXCEPTIONS)
    for (const n of [...EBIRD_COUNTABLE_EXCEPTIONS, ...EBIRD_NONCOUNTABLE_EXCEPTIONS]) {
      expect(isNonCountableWith(n, rejects, counts), n).toBe(isNonCountableForm(n))
    }
  })
})

describe('structure: each runtime derives these from its own builder', () => {
  it('a malformed record changes nothing: candidates(body + bad) == candidates(body)', () => {
    const want = alertCandidates(reduceWidgetRecords(QA22.body) ?? [], QA22.recorded, CANDIDATE_CASES[0]!.point)
    for (const m of MALFORMED_RECORDS) {
      const got = alertCandidates(reduceWidgetRecords([...QA22.body, m.record]) ?? [], QA22.recorded, CANDIDATE_CASES[0]!.point)
      expect(got, m.name).toEqual(want)
    }
  })

  it('the reducer KEEPS every unrowable record, so the candidate filter is what drops it (L5)', () => {
    const base = reduceWidgetRecords(QA22.body)!.length
    const unrowable = MALFORMED_RECORDS.filter(m => m.name.startsWith('unrowable-'))
    expect(unrowable.length).toBeGreaterThanOrEqual(12)
    for (const m of unrowable) expect(reduceWidgetRecords([...QA22.body, m.record])!.length, m.name).toBe(base + 1)
    // And the other direction: every record at the row shape's edges is a candidate.
    const edges = CANDIDATE_CASES.find(c => c.name === 'row-shape-edges')!
    expect(alertCandidates(reduceWidgetRecords(edges.body)!, [], edges.point).map(h => h.speciesCode).sort())
      .toEqual(['ab', 'abcdefghijklmnop', 'edge-3'])
  })

  it('eviction is idempotent on every roster, and never grows past its bound', () => {
    const cases = [...EVICT_CASES, ...CHECK_CASES.map(c => ({ name: c.name, nowIso: c.nowIso, rows: c.rows }))]
    for (const e of cases) {
      const now = Date.parse(e.nowIso)
      const once = evictInbox(e.rows, now)
      expect(evictInbox(once, now), e.name).toEqual(once)
      expect(once.length).toBeLessThanOrEqual(200)
    }
  })

  it('a merge is order-independent as a set of species at their nearest sighting', () => {
    for (const m of MERGE_CASES) {
      const ab = mergePending(mergePending(null, m.pending?.hits ?? [], m.first, 'a'), m.hits, m.first, 'b')
      const ba = mergePending(mergePending(null, m.hits, m.first, 'b'), m.pending?.hits ?? [], m.first, 'a')
      const key = (p: typeof ab) => p.hits.map(h => `${h.speciesCode}@${h.distanceMi}`).sort()
      expect(key(ab), m.name).toEqual(key(ba))
    }
  })

  it('equal start and end is no quiet period at every minute of the day (FR-34)', () => {
    for (const s of [0, 420, 719, 1320, 1439]) {
      for (let m = 0; m < 1440; m++) expect(isQuiet(m, s, s)).toBe(false)
    }
  })

  it('a midnight-spanning window is exactly the complement of its daytime twin', () => {
    for (let m = 0; m < 1440; m++) expect(isQuiet(m, 1320, 420)).toBe(!isQuiet(m, 420, 1320))
  })
})

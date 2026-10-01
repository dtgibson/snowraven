// Builds the alert rules parity fixture from the SHIPPED TypeScript twin
// (ios-alerts, schema.md 8.3). The generator writes what this returns; the
// parity test re-derives it on every CI run and asserts the tracked file is
// byte-equal, so the file cannot drift from the twin between the release
// machine's Swift runs (`AlertRulesParityTests`), which reproduce every family
// from the same inputs. Not imported by shipped code.

import {
  EBIRD_COUNTABLE_EXCEPTIONS, EBIRD_NONCOUNTABLE_EXCEPTIONS, isNonCountableForm,
} from '../speciesUtils'
import { reduceWidgetRecords } from '../widgets/widgetRows'
import { ALERT_LINK_PATTERN, LINK_MAX_LENGTH } from '../links/deepLink'
import {
  ALERT_DAILY_SECONDS, ALERT_DEDUPE_DAYS, ALERT_FUTURE_SKEW_HOURS, ALERT_HOURLY_SECONDS, ALERT_INBOX_MAX_ROWS,
  ALERT_POSITION_MAX_AGE_HOURS, ALERT_QUIET_DEFAULT, ALERT_RADIUS_DEFAULT, ALERT_RADIUS_MAX, ALERT_RADIUS_MIN,
  ALERT_RETENTION_DAYS,
} from './alertsState'
import {
  alertCandidates, alertLinkString, applyCandidates, distKmFor, evictInbox, holdUntilFrom, isNonCountableWith,
  isoSeconds, isQuiet, mergePending, notificationBody, notificationTitle, outcomeOf, PENDING_MAX, resolveBlocked,
  resolvePoint, windowEnd,
} from './alertRules'
import {
  CANDIDATE_CASES, CHECK_CASES, CORPUS_ALPHABET, CORPUS_BASE, corpusNames, COUNTABILITY_SHAPES, EVICT_CASES,
  LINK_CASES, MALFORMED_RECORDS, MERGE_CASES, NOTIFICATION_CASES, NOW_ISO, OUTCOME_ROWS, QA22, QUIET_ROWS,
  RESOLVE_CASES, RETRY_AFTER_ROWS, SYNTHETIC_LISTS, WINDOW_END_ROWS,
} from './alertRules.fixtureInputs'

export function buildAlertFixture() {
  const nowMs = Date.parse(NOW_ISO)
  const counts = [...EBIRD_COUNTABLE_EXCEPTIONS].sort()
  const rejects = [...EBIRD_NONCOUNTABLE_EXCEPTIONS].sort()

  const candidates = CANDIDATE_CASES.map(c => ({
    name: c.name, recorded: c.recorded, point: c.point, body: c.body,
    expected: alertCandidates(reduceWidgetRecords(c.body) ?? [], c.recorded, c.point),
  }))

  const malformed = MALFORMED_RECORDS.map(m => ({ name: m.name, record: m.record }))

  const checks = CHECK_CASES.map(c => {
    const records = reduceWidgetRecords(c.body) ?? []
    const cands = alertCandidates(records, c.recorded, c.point)
    const { rows, hits } = applyCandidates(c.rows, cands, {
      nowMs: Date.parse(c.nowIso), checkId: c.checkId, point: c.point, radiusMi: c.radiusMi, place: c.place, ids: c.ids,
    })
    const names = hits.map(h => h.comName)
    return {
      ...c,
      expected: {
        hits: hits.map(h => h.speciesCode),
        rows,
        title: hits.length > 0 ? notificationTitle(hits.length, c.place) : null,
        body: hits.length > 0 ? notificationBody(names) : null,
        link: hits.length > 0 ? alertLinkString(hits[0]!, c.point, c.radiusMi, 'all') : null,
      },
    }
  })

  const evict = EVICT_CASES.map(e => ({ ...e, expected: evictInbox(e.rows, Date.parse(e.nowIso)).map(r => r.id) }))

  const quiet = {
    isQuiet: QUIET_ROWS.map(([m, s, e]) => ({ m, s, e, quiet: isQuiet(m, s, e) })),
    windowEnd: WINDOW_END_ROWS.map(([tz, nowIso, endMin]) => ({
      tz, nowIso, endMin, expected: isoSeconds(windowEnd(Date.parse(nowIso), endMin, tz)),
    })),
  }

  const merge = MERGE_CASES.map(m => ({ ...m, expected: mergePending(m.pending, m.hits, m.first, m.checkId) }))

  const notification = NOTIFICATION_CASES.map(n => ({
    ...n, title: notificationTitle(n.count, n.phrase), body: notificationBody(n.names),
  }))

  const links = LINK_CASES.map(l => ({ ...l, expected: alertLinkString(l.bird, l.point, l.radiusMi, l.show) }))

  const retryAfter = RETRY_AFTER_ROWS.map(header => ({
    header, nowIso: NOW_ISO, expected: isoSeconds(holdUntilFrom(nowMs, header)),
  }))

  const distKm = Array.from({ length: ALERT_RADIUS_MAX }, (_, i) => ({ radiusMi: i + 1, distKm: distKmFor(i + 1) }))

  const outcome = OUTCOME_ROWS.map(o => ({ ...o, expected: outcomeOf(o.fetch) }))

  const resolve = RESOLVE_CASES.map(r => {
    const inputs = { ...r.inputs, nowMs }
    const p = resolvePoint(inputs)
    return { name: r.name, nowIso: NOW_ISO, inputs: r.inputs, expected: { point: p, blocked: resolveBlocked(inputs) } }
  })

  const corpus = corpusNames()
  const countability = {
    countable: counts,
    nonCountable: rejects,
    rows: [...counts, ...rejects, ...COUNTABILITY_SHAPES].map(name => ({ name, nonCountable: isNonCountableForm(name) })),
    synthetic: {
      counts: SYNTHETIC_LISTS.counts,
      rejects: SYNTHETIC_LISTS.rejects,
      rows: SYNTHETIC_LISTS.names.map(name => ({
        name, nonCountable: isNonCountableWith(name, new Set(SYNTHETIC_LISTS.rejects), new Set(SYNTHETIC_LISTS.counts)),
      })),
    },
    corpus: {
      base: CORPUS_BASE,
      alphabet: CORPUS_ALPHABET,
      count: corpus.length,
      verdicts: corpus.map(n => (isNonCountableForm(n) ? '1' : '0')).join(''),
    },
  }

  return {
    // ubuntu-latest CI cannot compile Swift; the Swift half of this parity
    // claim runs on the release machine (snowraven_widgetsTests).
    generatedBy: 'frontend/src/lib/alerts/alertRules.fixtureGen.test.ts',
    tz: 'America/Los_Angeles',
    nowIso: NOW_ISO,
    constants: {
      dedupeDays: ALERT_DEDUPE_DAYS, retentionDays: ALERT_RETENTION_DAYS, maxRows: ALERT_INBOX_MAX_ROWS,
      positionMaxAgeHours: ALERT_POSITION_MAX_AGE_HOURS, futureSkewHours: ALERT_FUTURE_SKEW_HOURS,
      radiusMin: ALERT_RADIUS_MIN, radiusMax: ALERT_RADIUS_MAX,
      radiusDefault: ALERT_RADIUS_DEFAULT, quietDefaultStart: ALERT_QUIET_DEFAULT.startMin,
      quietDefaultEnd: ALERT_QUIET_DEFAULT.endMin, hourlySeconds: ALERT_HOURLY_SECONDS, dailySeconds: ALERT_DAILY_SECONDS,
      pendingMax: PENDING_MAX, linkMaxLength: LINK_MAX_LENGTH, alertLinkPattern: ALERT_LINK_PATTERN,
    },
    qa22Recorded: QA22.recorded,
    countability,
    candidates,
    malformed,
    checks,
    evict,
    quiet,
    merge,
    notification,
    links,
    retryAfter,
    distKm,
    outcome,
    resolve,
  }
}

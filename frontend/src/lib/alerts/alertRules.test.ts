// The alert check's rules, row by acceptance row (ios-alerts PRD QA-10,
// QA-15, QA-16, QA-22 to QA-28, QA-33, QA-34, QA-38). The TypeScript twin is
// what the fixture is generated from, so these rows read the PRD's own words
// against it; the Swift `AlertsLogic/` is held to the same values through the
// fixture (alertRules.parity.test.ts, and AlertRulesParityTests on the release
// machine).
import { describe, it, expect } from 'vitest'
import {
  alertCandidates, alertLinkString, applyCandidates, distKmFor, evictInbox, holdUntilFrom, isoSeconds, isQuiet,
  mergePending, notificationBody, notificationTitle, outcomeOf, parseRadius, placeName, resolveBlocked, resolvePoint,
  windowEnd, type PointInputs,
} from './alertRules'
import { DAVIS, NAMED_PLACE, NOW_ISO, QA22, row } from './alertRules.fixtureInputs'
import { reduceWidgetRecords } from '../widgets/widgetRows'

const NOW = Date.parse(NOW_ISO)
const daysAgo = (n: number) => isoSeconds(NOW - n * 86_400_000)
const ctx = (ids: string[] = ['id-1', 'id-2']) => ({ nowMs: NOW, checkId: 'chk', point: DAVIS, radiusMi: 25, place: NAMED_PLACE, ids })
const qa22 = () => alertCandidates(reduceWidgetRecords(QA22.body) ?? [], QA22.recorded, DAVIS)

describe('candidates and dedupe', () => {
  it('QA-22: recorded {A, B-subspecies}; A, B, C, a spuh, a hybrid, D reported; candidates exactly {C, D}', () => {
    expect(qa22().map(h => h.comName)).toEqual(['Ruff', "Sabine's Gull"])
  })

  it('QA-23: found again at T+6d updates the row and keeps its alerted time; at T+8d a new alert and a new row', () => {
    const six = applyCandidates([row('r1', 'ruff', 'Ruff', daysAgo(6))], qa22(), ctx())
    expect(six.hits.map(h => h.speciesCode)).toEqual(['sabgul'])
    const ruff = six.rows.find(r => r.speciesCode === 'ruff')!
    expect(ruff.id).toBe('r1')
    expect(ruff.alertedAt).toBe(daysAgo(6))
    expect(ruff.obsDt).toBe('2026-09-30 07:45')
    expect(ruff.updatedAt).toBe(NOW_ISO)
    const eight = applyCandidates([row('r1', 'ruff', 'Ruff', daysAgo(8))], qa22(), ctx())
    expect(eight.hits.map(h => h.speciesCode)).toEqual(['ruff', 'sabgul'])
    expect(eight.rows.filter(r => r.speciesCode === 'ruff')).toHaveLength(2)
  })

  it('QA-24: nothing new leaves the inbox unchanged', () => {
    const rows = [row('r1', 'ruff', 'Ruff', daysAgo(1)), row('r2', 'sabgul', "Sabine's Gull", daysAgo(1))]
    const out = applyCandidates(rows, [], ctx())
    expect(out.hits).toEqual([])
    expect(out.rows).toEqual(evictInbox(rows, NOW))
  })

  it('QA-26: an aged-out row and a cleared inbox both re-arm the species', () => {
    expect(applyCandidates([row('r1', 'ruff', 'Ruff', daysAgo(31))], qa22(), ctx()).hits.map(h => h.speciesCode)).toContain('ruff')
    expect(applyCandidates([], qa22(), ctx()).hits.map(h => h.speciesCode)).toEqual(['ruff', 'sabgul'])
  })

  it('QA-27: a backup that now records C removes it from the candidates; its old row stays', () => {
    const c = alertCandidates(reduceWidgetRecords(QA22.body) ?? [], [...QA22.recorded, 'ruff'], DAVIS)
    const out = applyCandidates([row('r1', 'ruff', 'Ruff', daysAgo(2))], c, ctx())
    expect(out.hits.map(h => h.speciesCode)).toEqual(['sabgul'])
    expect(out.rows.find(r => r.id === 'r1')!.updatedAt).toBe(daysAgo(2))
  })
})

describe('the inbox bound (QA-38)', () => {
  it('row 201 evicts the oldest; a 31-day row goes on the next write', () => {
    const rows = Array.from({ length: 201 }, (_, i) => row(`id${i}`, `sp${i}`, `S${i}`, isoSeconds(NOW - (201 - i) * 60_000)))
    const kept = evictInbox(rows, NOW)
    expect(kept).toHaveLength(200)
    expect(kept.map(r => r.id)).not.toContain('id0')
    expect(evictInbox([row('old', 'ruff', 'Ruff', daysAgo(31))], NOW)).toEqual([])
  })
})

describe('the one request and its outcome (QA-21, QA-25)', () => {
  it('distKm is the handlers\' computation: 25 -> 40, 1 -> 2', () => {
    expect(distKmFor(25)).toBe(40)
    expect(distKmFor(1)).toBe(2)
  })

  it('offline and timeout read "unreachable"; an unusable answer "no-answer"; 429 busy; 401/403 key-rejected', () => {
    expect(outcomeOf({ kind: 'offline' })).toBe('unreachable')
    expect(outcomeOf({ kind: 'timeout' })).toBe('unreachable')
    expect(outcomeOf({ kind: 'status', code: 500, retryAfter: null })).toBe('no-answer')
    expect(outcomeOf({ kind: 'tooLarge' })).toBe('no-answer')
    expect(outcomeOf({ kind: 'ok', body: { not: 'an array' } })).toBe('no-answer')
    expect(outcomeOf({ kind: 'status', code: 429, retryAfter: '30' })).toBe('busy')
    expect(outcomeOf({ kind: 'status', code: 401, retryAfter: null })).toBe('key-rejected')
  })

  it('QA-25: after a 429 with Retry-After 30, a check 10 s later is held and one at 31 s is not', () => {
    const hold = holdUntilFrom(NOW, '30')
    expect(NOW + 10_000 < hold).toBe(true)
    expect(NOW + 31_000 < hold).toBe(false)
    expect(holdUntilFrom(NOW, null)).toBe(NOW + 60_000)
    expect(holdUntilFrom(NOW, '999')).toBe(NOW + 60_000)
  })
})

describe('the notification (QA-28)', () => {
  it('1, 3 and 5 hits; the three phrases; the body names three then "and N more"', () => {
    expect(notificationTitle(1, NAMED_PLACE)).toBe('1 lifer reported near Davis')
    expect(notificationTitle(3, NAMED_PLACE)).toBe('3 lifers reported near Davis')
    expect(notificationTitle(2, { kind: 'near-you' })).toBe('2 lifers reported near you')
    expect(notificationTitle(1, { kind: 'nearby' })).toBe('1 lifer reported nearby')
    expect(notificationBody(['Ruff'])).toBe('Ruff')
    expect(notificationBody(["Sabine's Gull", 'Ruff', "Baird's Sandpiper"])).toBe("Sabine's Gull, Ruff, Baird's Sandpiper")
    expect(notificationBody(["Sabine's Gull", 'Ruff', "Baird's Sandpiper", 'Pectoral Sandpiper', 'Broad-winged Hawk']))
      .toBe("Sabine's Gull, Ruff, Baird's Sandpiper and 2 more")
  })

  it('the tap link opens the first-named sighting with every lifer shown; a bad id lands on the Day view', () => {
    expect(alertLinkString({ speciesCode: 'ruff', locId: 'L1000001' }, DAVIS, 25, 'all'))
      .toBe('snowraven://map/lifers?window=day&lat=38.54490&lng=-121.74050&r=25&sp=ruff&loc=L1000001&show=all')
    expect(alertLinkString({ speciesCode: 'ruff', locId: '' }, DAVIS, 25, 'all')).toBe('snowraven://map/lifers?window=day')
  })
})

describe('quiet hours (QA-32 to QA-34)', () => {
  it('QA-33: 10 PM to 7 AM covers 11:30 PM and 6:59 AM, not 7:00 AM or 9:00 PM; equal times never', () => {
    expect(isQuiet(23 * 60 + 30, 1320, 420)).toBe(true)
    expect(isQuiet(6 * 60 + 59, 1320, 420)).toBe(true)
    expect(isQuiet(7 * 60, 1320, 420)).toBe(false)
    expect(isQuiet(21 * 60, 1320, 420)).toBe(false)
    expect(isQuiet(0, 600, 600)).toBe(false)
  })

  it('the window end is the next local 7:00 AM, across a DST transition by the calendar', () => {
    expect(isoSeconds(windowEnd(Date.parse('2026-09-30T06:30:00Z'), 420, 'America/Los_Angeles'))).toBe('2026-09-30T14:00:00Z')
    expect(isoSeconds(windowEnd(Date.parse('2027-03-14T06:00:00Z'), 420, 'America/Los_Angeles'))).toBe('2027-03-14T14:00:00Z')
    expect(isoSeconds(windowEnd(Date.parse('2026-11-01T05:30:00Z'), 420, 'America/Los_Angeles'))).toBe('2026-11-01T15:00:00Z')
  })

  it('QA-34: two checks in one window, 2 and 3 hits, become one summary of 5 at the FIRST window end', () => {
    const h = (c: string, d: number) => ({ speciesCode: c, comName: c, locId: 'L1', distanceMi: d, link: 'x' })
    const first = mergePending(null, [h('a', 3), h('b', 5)], { windowEndAt: '2026-10-01T14:00:00Z', place: NAMED_PLACE }, 'c1')
    const both = mergePending(first, [h('c', 1), h('d', 9), h('e', 4)], { windowEndAt: '2026-10-02T14:00:00Z', place: { kind: 'nearby' } }, 'c2')
    expect(both.hits.map(x => x.speciesCode)).toEqual(['c', 'a', 'e', 'b', 'd'])
    expect(both.windowEndAt).toBe('2026-10-01T14:00:00Z')
    expect(notificationTitle(both.hits.length, both.place)).toBe('5 lifers reported near Davis')
  })
})

describe('the point and the preconditions (QA-09, QA-15 to QA-17)', () => {
  const base: PointInputs = {
    model: 'my-location', fixedPlace: null,
    handover: { hasKey: true, hasBackup: true, defaultLocation: null },
    position: null, widgetCell: null, location: 'granted', nowMs: NOW,
  }
  it('QA-16: a position 23 h old is used, 25 h is unavailable', () => {
    const r23 = resolvePoint({ ...base, position: { lat: 1, lng: 2, atMs: NOW - 23 * 3_600_000 } })
    expect(r23.kind === 'point' && r23.from).toBe('my-location')
    expect(resolvePoint({ ...base, position: { lat: 1, lng: 2, atMs: NOW - 25 * 3_600_000 } })).toEqual({ kind: 'blocked', blocked: 'no-position' })
  })

  it('QA-15: denied with a fixed place measures from it ("From your fixed place"); without one, location-off', () => {
    const fixed = { lat: 3, lng: 4, name: null }
    const r = resolvePoint({ ...base, location: 'denied', fixedPlace: fixed, position: { lat: 1, lng: 2, atMs: NOW } })
    expect(r).toEqual({ kind: 'point', point: { lat: 3, lng: 4 }, phrase: { kind: 'nearby' }, from: 'fixed-fallback' })
    expect(resolveBlocked({ ...base, location: 'denied' })).toBe('location-off')
  })

  it('QA-09 / QA-17: the first missing thing, in FR-18\'s order', () => {
    expect(resolveBlocked({ ...base, handover: null })).toBe('no-key')
    expect(resolveBlocked({ ...base, handover: { hasKey: false, hasBackup: false, defaultLocation: null } })).toBe('no-key')
    expect(resolveBlocked({ ...base, handover: { hasKey: true, hasBackup: false, defaultLocation: null } })).toBe('no-backup')
    expect(resolveBlocked({ ...base, model: 'fixed' })).toBe('no-place')
  })
})

describe('entry rules the section applies', () => {
  it('QA-10: the radius is a whole number 1 to 25; 0, 26, a decimal and a non-number are refused', () => {
    expect([1, 25, 7].map(n => parseRadius(String(n)))).toEqual([1, 25, 7])
    for (const bad of ['0', '26', '2.5', 'ten', '', ' 5', '-1', '100', '٣']) expect(parseRadius(bad), bad).toBeNull()
  })

  it('a place name the settings validator would refuse is saved with no name, never refused', () => {
    expect(placeName('  Davis, CA ')).toBe('Davis, CA')
    expect(placeName('')).toBeNull()
    expect(placeName('x'.repeat(121))).toBeNull()
    expect(placeName('x'.repeat(120))).toBe('x'.repeat(120))
    expect(placeName('Da\u0000vis')).toBeNull()
  })
})

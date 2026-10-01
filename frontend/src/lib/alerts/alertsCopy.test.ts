// The Alerts section's copy (ios-alerts NFR-08, QA-05, QA-52; design-spec.md
// sections 1 to 8). RULES over a GENERATED corpus (ui.md v1.0.5): every
// exported string constant plus every builder CALLED over the states the
// section can render, so a new string joins the sweep by being added to the
// module. Stated limit: a string built inline in the component is invisible to
// this guard, which is why the component builds none (AlertsSection.test.tsx
// renders the real thing as the second half of the pair).
//
// One CONTENT row (the last describe) asserts the spec's literal sentences, so
// the corpus rules are not the only thing standing behind the words.
import { describe, it, expect } from 'vitest'
import * as C from './alertsCopy'
import { ALERT_BLOCKED, ALERT_OUTCOMES, type InboxRow } from './alertsState'

const NOW = Date.UTC(2026, 8, 30, 16, 0, 0)

function corpus(): string[] {
  const out: string[] = []
  for (const v of Object.values(C)) {
    if (typeof v === 'string') out.push(v)
    else if (v && typeof v === 'object') {
      for (const x of Object.values(v as Record<string, unknown>)) {
        if (typeof x === 'string') out.push(x)
        else if (x && typeof x === 'object') for (const y of Object.values(x as Record<string, unknown>)) if (typeof y === 'string') out.push(y)
      }
    }
  }
  for (const o of ALERT_OUTCOMES) for (let n = 0; n <= 5; n++) out.push(C.outcomeWords(o, n))
  for (let n = 0; n <= 4; n++) out.push(C.inboxCount(n))
  for (let n = 0; n <= 4; n++) for (let k = 0; k <= Math.min(n, 3); k++) { out.push(C.inboxRowSub(n, k)); out.push(C.inboxRowName(n, k)) }
  for (const k of [0, 1, 3, 9, 10, 42]) { out.push(C.inboxEntryName(k)); out.push(C.badgeText(k)) }
  for (const s of [0, 60, 420, 719, 720, 1320, 1439]) for (const e of [0, 420, 720, 1320, 1439]) out.push(C.quietNote(s, e))
  for (const o of ALERT_OUTCOMES) {
    for (const hits of [0, 1, 2]) {
      for (const back of [0, 1, 3]) {
        out.push(C.lastCheckedSentence({ completedAt: new Date(NOW - back * 86_400_000).toISOString(), outcome: o, hits, from: 'fixed', checkId: 'c' }, NOW))
      }
    }
  }
  const row: InboxRow = {
    id: 'r', checkId: 'c', speciesCode: 'ruff', comName: 'Ruff', locId: 'L1', locName: 'Yolo Bypass', lat: 1, lng: 2,
    obsDt: '2026-09-30 07:45', distanceMi: 1, point: { lat: 1, lng: 2 }, radiusMi: 5, place: { kind: 'nearby' },
    alertedAt: new Date(NOW).toISOString(), updatedAt: new Date(NOW).toISOString(),
  }
  for (const obsDt of ['2026-09-30', '2026-09-29 08:00', '2026-09-25']) {
    for (const back of [0, 1, 4]) {
      const r = { ...row, obsDt, alertedAt: new Date(NOW - back * 86_400_000).toISOString() }
      out.push(C.rowLabel(r, NOW, 'UTC'))
      out.push(C.rowLabel(r, NOW, 'UTC', undefined, true))
      const w = C.rowWhen(r, NOW, 'UTC')
      out.push(`Reported ${w.day} · Alerted ${w.alerted}`)
    }
  }
  return out.filter(s => s.length > 0)
}

const BRITISH = /\b(colour|favourite|behaviour|centre|metre|organis|recognis|realis|cancelled|travelled|licence|grey|analys(e|ing)|catalogue|programme|whilst|amongst)/i

describe('the copy rules, over the whole generated corpus', () => {
  const all = corpus()

  it('is non-vacuous', () => {
    expect(all.length).toBeGreaterThan(150)
  })

  it('no em dash anywhere (U+2014), and no three-dot ellipsis', () => {
    for (const s of all) {
      expect(s.includes('—'), s).toBe(false)
      expect(s.includes('...'), s).toBe(false)
    }
  })

  it('American spelling', () => {
    for (const s of all) expect(BRITISH.test(s), s).toBe(false)
  })

  it('no count of one takes a plural noun', () => {
    for (const s of all) expect(/(^|[^0-9.])1 (lifers|alerts|miles|days)\b/.test(s), s).toBe(false)
  })

  it('QA-05: the cadence copy says about once an hour and about once a day, that iOS decides, and never an exact time', () => {
    expect(C.CADENCE_DESC).toContain('about once an hour')
    expect(C.CADENCE_DESC).toContain('about once a day')
    expect(C.CADENCE_DESC).toContain('iOS decides')
    for (const s of [C.CADENCE_DESC, C.ON_NOTE, C.OFF_NOTE, C.INTRO]) {
      expect(s.toLowerCase(), s).not.toContain('every hour')
      expect(s.toLowerCase(), s).not.toContain('exactly')
      expect(/\b[0-9]{1,2}(:[0-9]{2})?\s?(AM|PM|am|pm)\b|\b[0-9]{1,2}:[0-9]{2}\b/.test(s), s).toBe(false)
    }
  })

  it('times are 12-hour with a plain space (never U+202F), today alone, then Yesterday, then a date', () => {
    expect(C.clockFromMinutes(1320)).toBe('10:00 PM')
    expect(C.clockFromMinutes(420)).toBe('7:00 AM')
    expect(C.clockFromMinutes(0)).toBe('12:00 AM')
    expect(C.clockFromMinutes(720)).toBe('12:00 PM')
    for (const s of all) expect(s.includes(' '), s).toBe(false)
  })
})

describe('the spec\'s literal sentences (content, not delivery)', () => {
  it('the status line and its six outcomes', () => {
    expect(C.NOT_CHECKED).toBe('Not checked yet')
    expect(ALERT_OUTCOMES.map(o => C.outcomeWords(o, 3))).toEqual([
      'nothing new', '3 lifers', 'offline', 'eBird did not answer', 'eBird busy', 'eBird did not accept your key',
    ])
    expect(C.outcomeWords('hits', 1)).toBe('1 lifer')
    expect(C.FROM_FIXED_CAPTION).toBe('From your fixed place')
  })

  it('the blocked sentences, in FR-18\'s order, in the widgets\' register', () => {
    expect(ALERT_BLOCKED.map(b => C.BLOCKED[b].lead)).toEqual([
      'Add your eBird API key', 'Load your eBird backup', 'Set a place to measure from.',
      'Location is off for SnowRaven.', 'No recent position.',
    ])
    expect(C.BLOCKED['location-off'].rest).toContain('Settings, Privacy & Security, Location Services')
    expect(C.NOTIFICATIONS_DENIED).toContain('Settings, Notifications, SnowRaven')
    expect(C.BACKGROUND_REFRESH_OFF).toContain('Settings, General, Background App Refresh')
  })

  it('the quiet note, the default across midnight, and the equal-times line', () => {
    expect(C.quietNote(1320, 420)).toBe('Quiet from 10:00 PM to 7:00 AM, across midnight. A find inside the window is delivered at 7:00 AM.')
    expect(C.quietNote(720, 840)).toBe('Quiet from 12:00 PM to 2:00 PM. A find inside the window is delivered at 2:00 PM.')
    expect(C.quietNote(600, 600)).toBe('Start and end must differ. Until they do, no quiet period applies.')
  })

  it('the inbox entry points and the sheet (design-spec 7.1 to 7.5, the revision)', () => {
    expect(C.INBOX_ENTRY_LABEL).toBe('Alerts inbox')
    expect(C.inboxEntryName(0)).toBe('Alerts inbox')
    expect(C.inboxEntryName(3)).toBe('Alerts inbox, 3 new')
    expect([C.badgeText(1), C.badgeText(9), C.badgeText(10)]).toEqual(['1', '9', '9+'])
    expect(C.inboxRowSub(6, 3)).toBe('6 alerts, 3 new')
    expect(C.inboxRowSub(1, 0)).toBe('1 alert')
    expect(C.inboxRowSub(0, 0)).toBe('No alerts yet')
    expect(C.inboxRowName(6, 3)).toBe('Inbox, 6 alerts, 3 new')
    expect(C.inboxRowName(0, 0)).toBe('Inbox, no alerts yet')
    expect(C.CLOSE_INBOX).toBe('Close the inbox')
    expect(C.NEW_WORD).toBe('New')
    expect(C.NEW_PREFIX).toBe('New. ')
    expect(C.INBOX_EMPTY).toBe('No alerts yet.')
    expect(C.INBOX_EMPTY_DETAIL).toBe('A species eBird reports near your place that is not in your backup appears here, and as a notification.')
    // Mark read (alerts-inbox-mark-read): the label is also the accessible
    // name; the announcement names the action, never a count (7.5).
    expect(C.MARK_READ).toBe('Mark read')
    expect(C.MARKED_READ_STATUS).toBe('Marked read.')
  })

  it('the network sentence is the durable form (QA-19, QA-48): eBird, your own key, nothing to the developer', () => {
    expect(C.FINE_NETWORK).toBe('A check sends the chosen coordinates to eBird with your own key, the same nearby-sightings request Nearby Lifers makes. Nothing is sent to the developer.')
    expect(C.FINE_NETWORK.toLowerCase()).not.toContain('no network')
  })

  it('a row reads as one sentence with miles in full; relative words are lowercase inside it', () => {
    const r = {
      id: 'r', checkId: 'c', speciesCode: 'ruff', comName: 'Ruff', locId: 'L1', locName: 'Yolo Bypass Wildlife Area', lat: 1, lng: 2,
      obsDt: '2026-09-30 07:45', distanceMi: 6.34, point: { lat: 1, lng: 2 }, radiusMi: 5, place: { kind: 'nearby' as const },
      alertedAt: '2026-09-30T16:00:00Z', updatedAt: '2026-09-30T16:00:00Z',
    }
    expect(C.rowLabel(r, NOW, 'UTC')).toMatch(/^Ruff, Yolo Bypass Wildlife Area, 6\.3 miles, reported today, alerted [0-9]{1,2}:[0-9]{2} (AM|PM)\. Show on the map$/)
    expect(C.reportedDayWord('2026-09-29', NOW, 'UTC')).toBe('yesterday')
    expect(C.reportedDayWord('2026-09-27 08:00', NOW, 'UTC')).toBe('3 days ago')
  })
})

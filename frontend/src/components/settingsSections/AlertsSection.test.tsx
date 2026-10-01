// @vitest-environment jsdom
// Settings -> Alerts, rendered for real over a snapshot table (ios-alerts,
// design-spec.md sections 1 to 8; QA-02, QA-04 to QA-08, QA-10, QA-13,
// QA-17 to QA-19, QA-46; NFR-07; and the card's Inbox row of the revision,
// whose rows, empty state and Clear (QA-36, QA-39) moved with the inbox to
// AlertsInboxSheet.test.tsx). The store is filled directly
// and the actions are fakes, so these rows are about what the section SHOWS
// and what it ASKS FOR; native behavior is the Swift suite's.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, within, act, waitFor } from '@testing-library/react'
import AlertsSection from './AlertsSection'
import {
  installAlertsActions, resetAlertsState, setAlertsState, type AlertsActions, type AlertsSnapshot, type InboxRow,
} from '../../lib/alerts/alertsState'
import * as C from '../../lib/alerts/alertsCopy'
import { installInboxOpener } from '../../lib/alerts/alertsInboxEntry'

const NOW = '2026-09-30T16:00:00Z'

function snap(over: Partial<AlertsSnapshot> = {}, settings: Partial<AlertsSnapshot['settings']> = {}): AlertsSnapshot {
  return {
    settings: {
      version: 1, enabled: true, cadence: 'hourly', quietHours: { on: false, startMin: 1320, endMin: 420 },
      model: 'fixed', fixedPlace: null, radiusMi: 25, updatedAt: NOW, ...settings,
    },
    state: { version: 1, lastCheck: null, holdUntil: null, position: null, pending: null, scheduledEarliest: null, backgroundRefresh: 'available' },
    inbox: [],
    blocked: null,
    permissions: { notifications: 'granted', location: 'not-determined' },
    defaultLocation: { lat: 38.5446, lng: -121.7405 },
    now: NOW,
    ...over,
  }
}

const row = (i: number, over: Partial<InboxRow> = {}): InboxRow => ({
  id: `00000000-0000-4000-8000-00000000000${i}`, checkId: 'c', speciesCode: `sp${i}`, comName: `Species Number ${i}`,
  locId: `L${i}`, locName: `Place Number ${i}`, lat: 38.55, lng: -121.63, obsDt: '2026-09-30 07:45',
  distanceMi: 5.9 + i, point: { lat: 38.5449, lng: -121.7405 }, radiusMi: 25, place: { kind: 'nearby' },
  alertedAt: NOW, updatedAt: NOW, ...over,
})

function fakeActions(): { [K in keyof AlertsActions]: ReturnType<typeof vi.fn> } {
  return {
    setEnabled: vi.fn(async () => {}),
    updateSettings: vi.fn(async () => {}),
    chooseMyLocation: vi.fn(async () => {}),
    useMyLocationForFixedPlace: vi.fn(async () => {}),
    clearInbox: vi.fn(async () => {}),
    openRow: vi.fn(),
  }
}

let actions: ReturnType<typeof fakeActions>
beforeEach(() => {
  resetAlertsState()
  actions = fakeActions()
  installAlertsActions(actions as unknown as AlertsActions)
})
afterEach(() => { cleanup(); installAlertsActions(null) })

function show(s: AlertsSnapshot | null, extra: { busy?: boolean; error?: string | null } = {}) {
  setAlertsState({ loaded: s !== null, snapshot: s, busy: extra.busy ?? false, error: extra.error ?? null })
  return render(<AlertsSection />)
}

const revealInner = (c: HTMLElement) => c.querySelector('.sr-alerts-reveal--rule > .sr-alerts-reveal-inner') as HTMLElement

describe('off (the default) and on', () => {
  it('QA-02: off is two sentences and a switch; the configuration is present, collapsed and INERT', () => {
    const { container } = show(snap({}, { enabled: false }))
    // jsdom does not model `inert`, so the quiet-hours switch inside the inert
    // block is still queryable here; the literal attribute is asserted below.
    const sw = screen.getByRole('switch', { name: 'Alerts' })
    expect(sw.getAttribute('aria-checked')).toBe('false')
    expect(screen.getByText(C.INTRO)).toBeTruthy()
    expect(screen.getByText(C.OFF_NOTE)).toBeTruthy()
    expect(revealInner(container).hasAttribute('inert')).toBe(true)
    expect(container.querySelector('.sr-alerts-reveal--rule')!.className).not.toContain('sr-alerts-reveal--open')
  })

  it('on: the switch is checked, the note changes, and the block is NOT inert (the literal attribute, both ways)', () => {
    const { container } = show(snap())
    expect(screen.getByRole('switch', { name: /alerts/i }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByText(C.ON_NOTE)).toBeTruthy()
    expect(revealInner(container).hasAttribute('inert')).toBe(false)
  })

  it('the switch is named by the header and asks native to turn on (no permission call of its own)', () => {
    show(snap({}, { enabled: false }))
    fireEvent.click(screen.getByRole('switch', { name: 'Alerts' }))
    expect(actions.setEnabled).toHaveBeenCalledWith(true)
  })

  it('before the first snapshot the switch cannot be pressed', () => {
    show(null)
    expect((screen.getByRole('switch', { name: 'Alerts' }) as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('the controls (QA-04 to QA-10)', () => {
  it('QA-04: FR-05\'s order: switch, Cadence, Quiet hours, Measure from, the place, Radius, status, Inbox', () => {
    const { container } = show(snap())
    const text = container.textContent ?? ''
    const at = (s: string) => text.indexOf(s)
    const seq = [C.INTRO, C.CADENCE_LABEL, C.QUIET_LABEL, C.MEASURE_LABEL, C.FIXED_LABEL, C.RADIUS_LABEL, C.NOT_CHECKED, C.INBOX_LABEL]
    for (let i = 1; i < seq.length; i++) expect(at(seq[i]!), seq[i]).toBeGreaterThan(at(seq[i - 1]!))
  })

  it('QA-05: two cadence choices, Hourly by default, state exposed; a press saves', () => {
    show(snap())
    const group = screen.getByRole('radiogroup', { name: 'Cadence' })
    const radios = within(group).getAllByRole('radio')
    expect(radios.map(r => r.textContent)).toEqual(['Hourly', 'Daily'])
    expect(radios.map(r => r.getAttribute('aria-checked'))).toEqual(['true', 'false'])
    fireEvent.click(radios[1]!)
    expect(actions.updateSettings).toHaveBeenCalledWith({ cadence: 'daily' })
  })

  it('QA-06: quiet hours off by default; on, 10:00 PM to 7:00 AM with the across-midnight note', () => {
    const { container, unmount } = show(snap())
    const qs = screen.getByRole('switch', { name: C.QUIET_LABEL })
    expect(qs.getAttribute('aria-checked')).toBe('false')
    const times = container.querySelector('.sr-alerts-reveal--full > .sr-alerts-reveal-inner') as HTMLElement
    expect(times.hasAttribute('inert')).toBe(true)
    fireEvent.click(qs)
    expect(actions.updateSettings).toHaveBeenCalledWith({ quietHours: { on: true, startMin: 1320, endMin: 420 } })
    unmount()
    const on = show(snap({}, { quietHours: { on: true, startMin: 1320, endMin: 420 } }))
    expect((screen.getByLabelText(C.QUIET_FROM) as HTMLInputElement).value).toBe('22:00')
    expect((screen.getByLabelText(C.QUIET_TO) as HTMLInputElement).value).toBe('07:00')
    expect(on.container.textContent).toContain(C.quietNote(1320, 420))
    fireEvent.change(screen.getByLabelText(C.QUIET_TO), { target: { value: '06:30' } })
    expect(actions.updateSettings).toHaveBeenLastCalledWith({ quietHours: { on: true, startMin: 1320, endMin: 390 } })
  })

  it('FR-34: equal start and end shows the must-differ line', () => {
    const { container } = show(snap({}, { quietHours: { on: true, startMin: 600, endMin: 600 } }))
    expect(container.textContent).toContain(C.QUIET_EQUAL)
  })

  it('QA-07 / QA-08: Fixed place by default and following the Default Location; My location is the only reading choice', () => {
    const { container } = show(snap())
    const group = screen.getByRole('radiogroup', { name: C.MEASURE_LABEL })
    expect(within(group).getAllByRole('radio').map(r => r.getAttribute('aria-checked'))).toEqual(['true', 'false'])
    expect(container.textContent).toContain(C.FOLLOWING_DEFAULT)
    expect(container.textContent).toContain('38.54460, -121.74050')
    expect((screen.getByRole('button', { name: C.FOLLOW_DEFAULT }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(within(group).getAllByRole('radio')[1]!)
    expect(actions.chooseMyLocation).toHaveBeenCalledTimes(1)
    expect(actions.useMyLocationForFixedPlace).not.toHaveBeenCalled()
  })

  it('a named fixed place shows its name; under My location the place is the fallback', () => {
    const { container } = show(snap({}, { model: 'my-location', fixedPlace: { lat: 38.5449, lng: -121.7405, name: 'Davis, CA' } }))
    expect(container.textContent).toContain('Davis, CA')
    expect(container.textContent).toContain(C.FIXED_LABEL_FALLBACK)
    expect(container.textContent).toContain(C.MEASURE_DESC_MY)
    fireEvent.click(screen.getByRole('button', { name: C.FOLLOW_DEFAULT }))
    expect(actions.updateSettings).toHaveBeenCalledWith({ fixedPlace: null })
  })

  it('editing a coordinate saves a hand-set place with no name; an invalid one reverts', () => {
    show(snap())
    const lat = screen.getByLabelText(C.LATITUDE) as HTMLInputElement
    fireEvent.change(lat, { target: { value: '38.6' } })
    fireEvent.blur(lat)
    expect(actions.updateSettings).toHaveBeenCalledWith({ fixedPlace: { lat: 38.6, lng: -121.7405, name: null } })
    fireEvent.change(lat, { target: { value: '91' } })
    fireEvent.blur(lat)
    expect(actions.updateSettings).toHaveBeenCalledTimes(1)
    expect(lat.value).toBe('38.54460')
  })

  it('Use my location: a failure shows the app\'s location message in place', async () => {
    actions.useMyLocationForFixedPlace.mockRejectedValueOnce({ code: 'permission-denied' })
    show(snap())
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /use my location/i })) })
    await waitFor(() => expect(screen.getAllByRole('alert').some(a => (a.textContent ?? '').length > 0)).toBe(true))
  })

  it('QA-10: the radius refuses 0, 26, a decimal and a non-number at entry, and saves a whole 1 to 25', () => {
    show(snap())
    const r = screen.getByLabelText(C.RADIUS_LABEL) as HTMLInputElement
    expect(r.value).toBe('25')
    for (const bad of ['0', '26', '2.5', 'ten']) {
      fireEvent.change(r, { target: { value: bad } })
      expect(screen.getByText(C.RADIUS_REFUSED)).toBeTruthy()
    }
    expect(actions.updateSettings).not.toHaveBeenCalled()
    fireEvent.change(r, { target: { value: '10' } })
    expect(screen.queryByText(C.RADIUS_REFUSED)).toBeNull()
    expect(actions.updateSettings).toHaveBeenCalledWith({ radiusMi: 10 })
  })
})

describe('the status line and the notes (QA-13, QA-17 to QA-19)', () => {
  const lastCheck = (outcome: AlertsSnapshot['state']['lastCheck'] extends infer T ? T : never) => outcome

  it('the region is always mounted, polite, and the ONE live region in the section', () => {
    const { container } = show(snap())
    const regions = container.querySelectorAll('[aria-live]')
    expect(regions).toHaveLength(1)
    expect(regions[0]!.getAttribute('role')).toBe('status')
    expect(regions[0]!.getAttribute('aria-live')).toBe('polite')
  })

  it.each([
    ['no-key', 'Add your eBird API key'], ['no-backup', 'Load your eBird backup'],
    ['no-place', 'Set a place to measure from.'], ['location-off', 'Location is off for SnowRaven.'],
    ['no-position', 'No recent position.'],
  ] as const)('blocked %s shows its sentence in place of the last check', (blocked, lead) => {
    show(snap({ blocked, state: { ...snap().state, lastCheck: { completedAt: NOW, outcome: 'hits', hits: 2, from: 'fixed', checkId: 'c' } } }))
    expect(screen.getByRole('status').textContent).toContain(lead)
    expect(screen.getByRole('status').textContent).not.toContain('Last checked')
  })

  it('the last check, and the fixed-place caption', () => {
    show(snap({ state: { ...snap().state, lastCheck: lastCheck({ completedAt: NOW, outcome: 'hits', hits: 2, from: 'fixed-fallback', checkId: 'c' }) } }))
    const t = screen.getByRole('status').textContent ?? ''
    expect(t).toMatch(/^Last checked [0-9]{1,2}:[0-9]{2} (AM|PM), 2 lifers/)
    expect(t).toContain(C.FROM_FIXED_CAPTION)
  })

  it('QA-13: notifications denied and Background App Refresh off each say so, with the path', () => {
    const { container } = show(snap({ permissions: { notifications: 'denied', location: 'granted' }, state: { ...snap().state, backgroundRefresh: 'denied' } }))
    expect(container.textContent).toContain(C.NOTIFICATIONS_DENIED)
    expect(container.textContent).toContain(C.BACKGROUND_REFRESH_OFF)
  })

  it('QA-19: the network sentence and the countability sentence are present', () => {
    const { container } = show(snap())
    expect(container.textContent).toContain(C.FINE_NETWORK)
    expect(container.textContent).toContain(C.FINE_COUNTABILITY)
  })

  it('a failed save says so in an always-mounted alert region', () => {
    show(snap(), { error: 'invalid' })
    expect(screen.getAllByRole('alert').some(a => a.textContent === C.SAVE_FAILED)).toBe(true)
  })
})

describe('the card\'s Inbox row (design-spec 7.1, the revision; the rows moved to AlertsInboxSheet.test.tsx)', () => {
  const row1 = row(1, { alertedAt: '2026-09-30T15:00:00Z' })
  const row2 = row(2, { alertedAt: '2026-09-29T15:00:00Z' })

  it.each([
    [true, false, true], [true, true, true], [false, true, true], [false, false, false],
  ] as const)('enabled %s, rows %s: the row is present %s, and ABSENT markup otherwise', (enabled, rows, present) => {
    const { container } = show(snap({ inbox: rows ? [row1] : [] }, { enabled }))
    expect(container.querySelector('.sr-inbox-link') !== null).toBe(present)
    expect(screen.queryByRole('button', { name: /^Inbox,/ }) !== null).toBe(present)
  })

  it('names the count since last viewed, and says so when the inbox is empty', () => {
    setAlertsState({ inboxViewedAt: '2026-09-30T00:00:00Z' })
    const { unmount } = show(snap({ inbox: [row1, row2] }))
    const btn = screen.getByRole('button', { name: 'Inbox, 2 alerts, 1 new' })
    expect(btn.textContent).toContain('2 alerts, 1 new')
    expect(btn.getAttribute('aria-haspopup')).toBe('dialog')
    unmount()
    setAlertsState({ inboxViewedAt: '2026-09-30T23:00:00Z' })
    const seen = show(snap({ inbox: [row1, row2] }))
    expect(screen.getByRole('button', { name: 'Inbox, 2 alerts' })).toBeTruthy()
    seen.unmount()
    show(snap())
    expect(screen.getByRole('button', { name: 'Inbox, no alerts yet' }).textContent).toContain('No alerts yet')
  })

  it('opens the App-root sheet with itself as the opener; the section renders no rows and no Clear of its own', () => {
    const open = vi.fn()
    installInboxOpener(open)
    try {
      const { container } = show(snap({ inbox: [row1] }))
      const btn = screen.getByRole('button', { name: /^Inbox, 1 alert/ })
      fireEvent.click(btn)
      expect(open).toHaveBeenCalledTimes(1)
      expect(open.mock.calls[0]![0].trigger()).toBe(btn)
      expect(container.querySelector('ul')).toBeNull()
      expect(screen.queryByRole('button', { name: C.CLEAR })).toBeNull()
      // No id anywhere in the section is built from a name or a place.
      for (const el of Array.from(container.querySelectorAll('[id]'))) expect(el.id).not.toMatch(/Species|Place|sp1/)
    } finally {
      installInboxOpener(null)
    }
  })
})

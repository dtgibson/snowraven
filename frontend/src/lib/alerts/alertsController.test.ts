// @vitest-environment jsdom
// The iOS Alerts store and controller (ios-alerts, schema.md 6.1 and 6.4;
// QA-03, QA-07, QA-14, QA-37). Every native call is a fake, so these rows are
// about the WEBVIEW's half: what it reads, what it forwards, and the two (and
// only two) presses that read location.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { startAlertsController, type AlertsDeps } from './alertsController'
import {
  alertsActions, getAlertsState, installAlertsActions, resetAlertsState, setAlertsState, alertsSupported,
  type AlertsSnapshot, type InboxRow,
} from './alertsState'
import { parseWidgetLink } from '../links/deepLink'

vi.mock('../platform', () => ({ isTauri: vi.fn(() => false), isIOS: vi.fn(() => false) }))
import { isIOS, isTauri } from '../platform'

function snap(over: Partial<AlertsSnapshot> = {}): AlertsSnapshot {
  return {
    settings: {
      version: 1, enabled: false, cadence: 'hourly', quietHours: { on: false, startMin: 1320, endMin: 420 },
      model: 'fixed', fixedPlace: null, radiusMi: 25, updatedAt: '2026-09-30T16:00:00Z',
    },
    state: { version: 1, lastCheck: null, holdUntil: null, position: null, pending: null, scheduledEarliest: null, backgroundRefresh: 'available' },
    inbox: [],
    blocked: null,
    permissions: { notifications: 'not-determined', location: 'not-determined' },
    defaultLocation: { lat: 38.5446, lng: -121.7405 },
    now: '2026-09-30T16:00:00Z',
    ...over,
  }
}

const ROW: InboxRow = {
  id: 'r1', checkId: 'c1', speciesCode: 'ruff', comName: 'Ruff', locId: 'L1000001', locName: 'Yolo Bypass',
  lat: 38.55, lng: -121.63, obsDt: '2026-09-30 07:45', distanceMi: 5.9, point: { lat: 38.5449, lng: -121.7405 },
  radiusMi: 10, place: { kind: 'nearby' }, alertedAt: '2026-09-30T15:00:00Z', updatedAt: '2026-09-30T15:00:00Z',
}

function deps(over: Partial<AlertsDeps> = {}) {
  const order: string[] = []
  let poke: (() => void) | null = null
  const base = {
    snapshot: vi.fn(async () => { order.push('snapshot'); return snap() }),
    updateSettings: vi.fn(async () => snap({ settings: { ...snap().settings, cadence: 'daily' } })),
    setEnabled: vi.fn(async (on: boolean) => snap({ settings: { ...snap().settings, enabled: on } })),
    clearInbox: vi.fn(async () => snap()),
    onAlertsChanged: vi.fn(async (cb: () => void) => { order.push('listen'); poke = cb; return () => { poke = null } }),
    getCurrentLocation: vi.fn(async () => ({ lat: 38.6, lng: -121.5 })),
    acceptLink: vi.fn((raw: string) => { void raw }),
  }
  // Overrides keep the fakes' mock types (a spread would widen them).
  const d = Object.assign(base, over) as typeof base
  return { d, order, poke: () => poke?.() }
}

beforeEach(() => { resetAlertsState(); installAlertsActions(null) })
afterEach(() => { vi.mocked(isTauri).mockReturnValue(false); vi.mocked(isIOS).mockReturnValue(false) })

describe('the store and its gate', () => {
  it('the gate is iPhone and iPad only (FR-01)', () => {
    expect(alertsSupported()).toBe(false)
    vi.mocked(isTauri).mockReturnValue(true)
    expect(alertsSupported()).toBe(false)
    vi.mocked(isIOS).mockReturnValue(true)
    expect(alertsSupported()).toBe(true)
  })

  it('before the controller loads, nothing is loaded and every action is a no-op', async () => {
    expect(getAlertsState()).toEqual({ loaded: false, snapshot: null, busy: false, error: null, inboxViewedAt: null })
    await expect(alertsActions.setEnabled(true)).resolves.toBeUndefined()
    expect(getAlertsState().loaded).toBe(false)
  })
})

describe('boot', () => {
  it('arms the listener FIRST, then reads the snapshot, and stores it (no location read, no command)', async () => {
    const { d, order } = deps()
    await startAlertsController(d)
    expect(order).toEqual(['listen', 'snapshot'])
    expect(getAlertsState().loaded).toBe(true)
    expect(getAlertsState().snapshot?.settings.enabled).toBe(false)
    expect(d.getCurrentLocation).not.toHaveBeenCalled()
    expect(d.setEnabled).not.toHaveBeenCalled()
    expect(d.updateSettings).not.toHaveBeenCalled()
  })

  it('re-reads on the native poke and on becoming visible again', async () => {
    const { d, poke } = deps()
    await startAlertsController(d)
    poke()
    await vi.waitFor(() => expect(d.snapshot).toHaveBeenCalledTimes(2))
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.waitFor(() => expect(d.snapshot).toHaveBeenCalledTimes(3))
  })

  it('reads the inbox\'s "last viewed" and, when it answers within the bound, applies it before the first snapshot, validated on read (design-spec 7.5)', async () => {
    const past = new Date(Date.now() - 3_600_000).toISOString().slice(0, 19) + 'Z'
    const ahead = new Date(Date.now() + 25 * 3_600_000).toISOString().slice(0, 19) + 'Z'
    const cases: [unknown, string | null][] = [[past, past], [ahead, null], ['2026-02-30T00:00:00Z', null], [42, null], [null, null]]
    for (const [raw, want] of cases) {
      resetAlertsState()
      const { d, order } = deps({ readInboxViewedAt: vi.fn(async () => { order.push('viewed'); return raw }) })
      await startAlertsController(d)
      expect(order.indexOf('viewed'), String(raw)).toBeLessThan(order.indexOf('snapshot'))
      expect(getAlertsState().inboxViewedAt, String(raw)).toBe(want)
    }
  })

  it('a settings read that is slow never holds back the first snapshot; it lands later if nothing set the value', async () => {
    const past = new Date(Date.now() - 3_600_000).toISOString().slice(0, 19) + 'Z'
    const { d } = deps({ readInboxViewedAt: vi.fn(() => new Promise(r => setTimeout(() => r(past), 1300))) })
    const started = Date.now()
    await startAlertsController(d)
    expect(Date.now() - started).toBeLessThan(1250)
    expect(getAlertsState().loaded).toBe(true)
    expect(getAlertsState().inboxViewedAt).toBeNull()
    await vi.waitFor(() => expect(getAlertsState().inboxViewedAt).toBe(past), { timeout: 2000 })
  })

  it('a late read never overwrites a value set since it started, such as by a sheet close', async () => {
    const fromFile = new Date(Date.now() - 2 * 3_600_000).toISOString().slice(0, 19) + 'Z'
    const fromClose = new Date(Date.now() - 60_000).toISOString().slice(0, 19) + 'Z'
    let land: (v: unknown) => void = () => {}
    const { d } = deps({ readInboxViewedAt: vi.fn(() => new Promise<unknown>(r => { land = r })) })
    await startAlertsController(d)                    // the snapshot is stored after the 1 s bound
    expect(getAlertsState().inboxViewedAt).toBeNull()
    setAlertsState({ inboxViewedAt: fromClose })       // what the inbox host does on a sheet close
    land(fromFile)
    await new Promise(r => setTimeout(r, 0))
    expect(getAlertsState().inboxViewedAt).toBe(fromClose)
  })

  it('dispose uninstalls the actions and stops listening', async () => {
    const { d } = deps()
    const dispose = await startAlertsController(d)
    dispose()
    await alertsActions.setEnabled(true)
    expect(d.setEnabled).not.toHaveBeenCalled()
  })
})

describe('commands', () => {
  it('stores the reply, and is busy only while in flight', async () => {
    let release!: () => void
    const { d } = deps({
      setEnabled: vi.fn(() => new Promise<AlertsSnapshot>(r => { release = () => r(snap({ settings: { ...snap().settings, enabled: true } })) })),
    })
    await startAlertsController(d)
    const p = alertsActions.setEnabled(true)
    expect(getAlertsState().busy).toBe(true)
    release()
    await p
    expect(getAlertsState().busy).toBe(false)
    expect(getAlertsState().snapshot?.settings.enabled).toBe(true)
  })

  it('a rejection keeps the short stable error and leaves the last snapshot', async () => {
    const { d } = deps({ updateSettings: vi.fn(async () => { throw new Error('invalid') }) })
    await startAlertsController(d)
    await alertsActions.updateSettings({ radiusMi: 7 })
    expect(getAlertsState().error).toBe('invalid')
    expect(getAlertsState().snapshot?.settings.radiusMi).toBe(25)
  })

  it('QA-07: cadence, quiet hours, radius, a place, the switch and Clear read no location', async () => {
    const { d } = deps()
    await startAlertsController(d)
    await alertsActions.updateSettings({ cadence: 'daily' })
    await alertsActions.updateSettings({ quietHours: { on: true, startMin: 1320, endMin: 420 } })
    await alertsActions.updateSettings({ radiusMi: 10 })
    await alertsActions.updateSettings({ fixedPlace: { lat: 1, lng: 2, name: 'X' } })
    await alertsActions.updateSettings({ model: 'fixed' })
    await alertsActions.setEnabled(true)
    await alertsActions.clearInbox()
    expect(d.getCurrentLocation).not.toHaveBeenCalled()
  })

  it('QA-14: choosing My location reads location once and seeds the position; a failure still sets the model', async () => {
    const { d } = deps()
    await startAlertsController(d)
    await alertsActions.chooseMyLocation()
    expect(d.getCurrentLocation).toHaveBeenCalledTimes(1)
    expect(d.updateSettings).toHaveBeenLastCalledWith({ model: 'my-location', position: { lat: 38.6, lng: -121.5 } })
    d.getCurrentLocation.mockRejectedValueOnce({ code: 'permission-denied' })
    await alertsActions.chooseMyLocation()
    expect(d.getCurrentLocation).toHaveBeenCalledTimes(2)
    expect(d.updateSettings).toHaveBeenLastCalledWith({ model: 'my-location' })
  })

  it('Use my location sets the fixed place with no name; a failure rejects for the section to say so', async () => {
    const { d } = deps()
    await startAlertsController(d)
    await alertsActions.useMyLocationForFixedPlace()
    expect(d.updateSettings).toHaveBeenLastCalledWith({ fixedPlace: { lat: 38.6, lng: -121.5, name: null } })
    d.getCurrentLocation.mockRejectedValueOnce({ code: 'timeout' })
    const calls = d.updateSettings.mock.calls.length
    await expect(alertsActions.useMyLocationForFixedPlace()).rejects.toEqual({ code: 'timeout' })
    expect(d.updateSettings.mock.calls.length).toBe(calls)
  })

  it('QA-37: a row tap is the row\'s own link, that species alone, through the shipped link path', async () => {
    const { d } = deps()
    await startAlertsController(d)
    alertsActions.openRow(ROW)
    expect(d.acceptLink).toHaveBeenCalledTimes(1)
    const raw = d.acceptLink.mock.calls[0]![0] as string
    expect(raw).toBe('snowraven://map/lifers?window=day&lat=38.54490&lng=-121.74050&r=10&sp=ruff&loc=L1000001&show=one')
    expect(parseWidgetLink(raw)).toEqual({
      view: 'lifers', window: 'day', point: { lat: 38.5449, lng: -121.7405 }, radiusMi: 10,
      bird: { speciesCode: 'ruff', locId: 'L1000001' }, show: 'one',
    })
    expect(d.getCurrentLocation).not.toHaveBeenCalled()
  })
})

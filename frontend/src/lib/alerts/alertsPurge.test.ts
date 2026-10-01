// The clear registry's native-owned row (ios-alerts, schema.md 7; QA-40) and
// the native wrapper's reply check (schema.md 10.1). The purge is a no-op off
// iPhone and iPad, exactly one command on them, and a rejection propagates so
// `purgeDerivedOnClear` reports the row instead of calling it clean. A reply
// that is not a usable snapshot is refused, and a malformed inbox row is
// dropped rather than rendered.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const invoke = vi.hoisted(() => vi.fn())
vi.mock('@tauri-apps/api/core', () => ({ invoke }))
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => {}) }))
vi.mock('../platform', () => ({ isTauri: vi.fn(() => false), isIOS: vi.fn(() => false) }))

import { purgeAlertsInbox } from './alertsPurge'
import { parseSnapshot, snapshot } from './alertsNative'
import { purgeDerivedOnClear } from '../clearDerived'
import { isIOS, isTauri } from '../platform'

beforeEach(() => {
  invoke.mockReset()
  vi.mocked(isTauri).mockReturnValue(false)
  vi.mocked(isIOS).mockReturnValue(false)
})

describe('purgeAlertsInbox', () => {
  it('is a no-op on web/Pi, Windows and the Mac: no command at all', async () => {
    await purgeAlertsInbox()
    vi.mocked(isTauri).mockReturnValue(true)
    await purgeAlertsInbox()
    expect(invoke).not.toHaveBeenCalled()
  })

  it('on iPhone and iPad it is exactly one alerts_purge_inbox', async () => {
    vi.mocked(isTauri).mockReturnValue(true)
    vi.mocked(isIOS).mockReturnValue(true)
    invoke.mockResolvedValue(undefined)
    await purgeAlertsInbox()
    expect(invoke.mock.calls).toEqual([['alerts_purge_inbox']])
  })

  it('a failed purge propagates, and the registry names the row', async () => {
    vi.mocked(isTauri).mockReturnValue(true)
    vi.mocked(isIOS).mockReturnValue(true)
    invoke.mockRejectedValue('unavailable')
    await expect(purgeAlertsInbox()).rejects.toBe('unavailable')
    const failed = await purgeDerivedOnClear('ebird')
    expect(failed).toContain('alerts/inbox.json (App Group, native-owned)')
  })
})

describe('the native reply is shape-checked before it reaches the store', () => {
  const good = {
    settings: {
      version: 1, enabled: true, cadence: 'hourly', quietHours: { on: false, startMin: 1320, endMin: 420 },
      model: 'fixed', fixedPlace: null, radiusMi: 25, updatedAt: '2026-09-30T16:00:00Z',
    },
    state: { version: 1, lastCheck: null, holdUntil: null, position: null, pending: null, scheduledEarliest: null, backgroundRefresh: 'available' },
    inbox: [{
      id: 'r1', checkId: 'c1', speciesCode: 'ruff', comName: 'Ruff', locId: 'L1', locName: 'X', lat: 1, lng: 2,
      obsDt: '2026-09-30 07:45', distanceMi: 1, point: { lat: 1, lng: 2 }, radiusMi: 5, place: { kind: 'nearby' },
      alertedAt: '2026-09-30T15:00:00Z', updatedAt: '2026-09-30T15:00:00Z',
    }],
    blocked: null,
    permissions: { notifications: 'granted', location: 'not-determined' },
    defaultLocation: null,
    now: '2026-09-30T16:00:00Z',
  }

  it('a usable snapshot passes whole', () => {
    expect(parseSnapshot(JSON.stringify(good))?.inbox).toHaveLength(1)
  })

  it('a malformed ROW is dropped and the rest kept (a non-string name would crash React)', () => {
    const bad = { ...good, inbox: [...good.inbox, { ...good.inbox[0], id: 'r2', comName: { html: 'x' } }, null, 'row'] }
    expect(parseSnapshot(JSON.stringify(bad))?.inbox.map(r => r.id)).toEqual(['r1'])
  })

  it('an unusable snapshot is refused, and the wrapper rejects with the stable string', async () => {
    for (const text of [
      'not json', 'null', '[]',
      JSON.stringify({ ...good, settings: { ...good.settings, enabled: 'yes' } }),
      JSON.stringify({ ...good, blocked: 'no-idea' }),
      JSON.stringify({ ...good, permissions: { notifications: 'maybe', location: 'granted' } }),
      JSON.stringify({ ...good, state: { ...good.state, lastCheck: { completedAt: 'x', outcome: 'exploded', hits: 0, from: 'fixed' } } }),
      JSON.stringify({ ...good, inbox: 'none' }),
    ]) {
      expect(parseSnapshot(text), text.slice(0, 40)).toBeNull()
    }
    invoke.mockResolvedValue('null')
    await expect(snapshot()).rejects.toThrow('invalid')
  })
})

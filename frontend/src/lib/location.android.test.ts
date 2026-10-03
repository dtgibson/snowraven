// @vitest-environment jsdom
// Android location, both branches (android-release schema 4.6 and 5.3, FR-17,
// FR-18, FR-55, FR-56). The real platform module runs with the os plugin's
// platform() probe reporting 'android'; only the branch switch is mocked, each
// way, so the two readings are pinned against the same code that ships.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@tauri-apps/plugin-os', () => ({ platform: vi.fn(() => 'android') }))
const invokeMock = vi.hoisted(() => vi.fn())
vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeMock }))
const geoPlugin = vi.hoisted(() => ({ checkPermissions: vi.fn(), requestPermissions: vi.fn(), getCurrentPosition: vi.fn() }))
vi.mock('@tauri-apps/plugin-geolocation', () => geoPlugin)
const branch = vi.hoisted(() => ({ value: 'B' as 'A' | 'B' }))
vi.mock('./androidLocation', () => ({ get ANDROID_LOCATION_BRANCH() { return branch.value } }))

import { getCurrentLocation, describeLocationError, type LocationError } from './location'
import { showLocationControls } from './platformGates'

const win = window as unknown as Record<string, unknown>
type GetPos = (ok: PositionCallback, fail: PositionErrorCallback, opts?: PositionOptions) => void

function stubGeolocation(impl: GetPos) {
  const getCurrentPosition = vi.fn(impl)
  Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition }, configurable: true })
  return getCurrentPosition
}

beforeEach(() => { win['__TAURI_INTERNALS__'] = {} })
afterEach(() => {
  delete win['__TAURI_INTERNALS__']
  invokeMock.mockReset()
  Object.values(geoPlugin).forEach(f => f.mockReset())
  // remove the stub so a later row can define its own
  delete (navigator as unknown as Record<string, unknown>).geolocation
  branch.value = 'B'
})

function expectNoNativeCall() {
  expect(invokeMock).not.toHaveBeenCalled()
  Object.values(geoPlugin).forEach(f => expect(f).not.toHaveBeenCalled())
}

describe('branch B (the default): every location control absent, unavailable to any caller', () => {
  it('showLocationControls() is false', () => {
    expect(showLocationControls()).toBe(false)
  })

  it('getCurrentLocation() rejects unavailable without asking the WebView, the plugin or a command', async () => {
    const pos = stubGeolocation(() => {})
    await expect(getCurrentLocation()).rejects.toEqual({ code: 'unavailable', platform: 'tauri' })
    expect(pos).not.toHaveBeenCalled()
    expectNoNativeCall()
  })
})

describe('branch A: the Android System WebView\'s own geolocation', () => {
  beforeEach(() => { branch.value = 'A' })

  it('showLocationControls() is true', () => {
    expect(showLocationControls()).toBe(true)
  })

  it('asks navigator.geolocation with high accuracy, a ten-second timeout and a one-minute cache', async () => {
    const pos = stubGeolocation(ok => ok({ coords: { latitude: 42.444, longitude: -76.5019 } } as GeolocationPosition))
    await expect(getCurrentLocation()).resolves.toEqual({ lat: 42.444, lng: -76.5019 })
    expect(pos).toHaveBeenCalledTimes(1)
    expect(pos.mock.calls[0]![2]).toEqual({ enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 })
    expectNoNativeCall()
  })

  it.each([
    [1, { code: 'permission-denied', platform: 'tauri' }],
    [2, { code: 'unavailable', platform: 'tauri' }],
    [3, { code: 'timeout' }],
  ])('maps a WebView error code %i to %j', async (code, expected) => {
    stubGeolocation((_ok, fail) => fail({ code } as GeolocationPositionError))
    await expect(getCurrentLocation()).rejects.toEqual(expected)
  })

  it('without navigator.geolocation answers unavailable', async () => {
    await expect(getCurrentLocation()).rejects.toEqual({ code: 'unavailable', platform: 'tauri' })
  })

  it('the denied sentence names the Android route and no other platform\'s (FR-18)', () => {
    const msg = describeLocationError({ code: 'permission-denied', platform: 'tauri' } as LocationError)
    expect(msg).toBe('Allow location for SnowRaven in Settings → Apps → SnowRaven → Permissions → Location, and make sure Location is turned on, then try again.')
    expect(msg).not.toMatch(/Privacy & Security|Windows Settings|System Settings/)
  })
})

import { describe, it, expect, vi, afterEach } from 'vitest'
import { getCurrentLocation, describeLocationError } from './location'
import type { LocationError } from './location'

// isWindows() reads navigator.userAgent and isIOS() the plugin-os probe; mock
// the platform module so every branch is deterministic per test.
vi.mock('./platform', () => ({
  isTauri: vi.fn(() => false),
  isWindows: vi.fn(() => false),
  isIOS: vi.fn(() => false),
}))
// The geolocation plugin is dynamically imported inside getCurrentLocationIOS;
// vitest intercepts the dynamic import too, so these mocks let the tests feed
// the plugin's REAL iOS reject strings through the catch-arm mapping.
vi.mock('@tauri-apps/plugin-geolocation', () => ({
  checkPermissions: vi.fn(),
  requestPermissions: vi.fn(),
  getCurrentPosition: vi.fn(),
}))
import { isTauri, isWindows, isIOS } from './platform'
import * as geo from '@tauri-apps/plugin-geolocation'

afterEach(() => {
  vi.mocked(isTauri).mockReturnValue(false)
  vi.mocked(isWindows).mockReturnValue(false)
  vi.mocked(isIOS).mockReturnValue(false)
  vi.mocked(geo.checkPermissions).mockReset()
  vi.mocked(geo.requestPermissions).mockReset()
  vi.mocked(geo.getCurrentPosition).mockReset()
})

describe('describeLocationError', () => {
  it('web permission-denied points at browser settings', () => {
    const e: LocationError = { code: 'permission-denied', platform: 'web' }
    expect(describeLocationError(e)).toMatch(/browser settings/i)
  })

  it('tauri permission-denied on macOS points at System Settings', () => {
    const e: LocationError = { code: 'permission-denied', platform: 'tauri' }
    expect(describeLocationError(e)).toMatch(/System Settings/i)
  })

  it('tauri permission-denied on Windows points at Windows Settings', () => {
    vi.mocked(isWindows).mockReturnValue(true)
    const e: LocationError = { code: 'permission-denied', platform: 'tauri' }
    expect(describeLocationError(e)).toMatch(/Windows Settings/i)
  })

  it('tauri permission-denied on iOS points at the iOS Settings app (mobile-app FR-16)', () => {
    vi.mocked(isIOS).mockReturnValue(true)
    const e: LocationError = { code: 'permission-denied', platform: 'tauri' }
    expect(describeLocationError(e)).toBe(
      'Allow location for SnowRaven in Settings → Privacy & Security → Location Services, then try again.',
    )
  })

  it('timeout message mentions a timeout', () => {
    expect(describeLocationError({ code: 'timeout' })).toMatch(/timed out/i)
  })

  it('dev-mode message mentions a production build', () => {
    expect(describeLocationError({ code: 'dev-mode' })).toMatch(/production build/i)
  })

  it('insecure-context message mentions HTTPS', () => {
    expect(describeLocationError({ code: 'insecure-context' })).toMatch(/HTTPS/i)
  })

  it('unavailable falls back to the generic message', () => {
    expect(describeLocationError({ code: 'unavailable' })).toMatch(/Unable to determine your location/i)
  })
})

// The iOS plugin path: the reject strings below are the EXACT strings the
// installed tauri-plugin-geolocation 2.3.2 iOS Swift side emits (verified in
// ~/.cargo/registry .../ios/Sources/GeolocationPlugin.swift) — QA finding F5:
// tests written against invented strings would pass while the real ones
// misroute, so these fixtures must track the plugin source, not the mapping.
describe('getCurrentLocation — iOS plugin error mapping (mobile-app FR-16)', () => {
  function onIOS() {
    vi.mocked(isTauri).mockReturnValue(true)
    vi.mocked(isIOS).mockReturnValue(true)
  }
  const granted = { location: 'granted', coarseLocation: 'granted' } as Awaited<
    ReturnType<typeof geo.checkPermissions>
  >
  const denied = { location: 'denied', coarseLocation: 'denied' } as Awaited<
    ReturnType<typeof geo.checkPermissions>
  >

  it('resolves coordinates when permission is granted', async () => {
    onIOS()
    vi.mocked(geo.checkPermissions).mockResolvedValue(granted)
    vi.mocked(geo.getCurrentPosition).mockResolvedValue({
      coords: { latitude: 38.55, longitude: -121.74 },
    } as Awaited<ReturnType<typeof geo.getCurrentPosition>>)
    await expect(getCurrentLocation()).resolves.toEqual({ lat: 38.55, lng: -121.74 })
  })

  it("maps the real master-switch-off reject ('Location services are not enabled.') to permission-denied with the iOS Settings guidance", async () => {
    onIOS()
    // GeolocationPlugin.swift:114/136 — the GLOBAL Location Services switch is
    // off; the plugin rejects checkPermissions with this exact string.
    vi.mocked(geo.checkPermissions).mockRejectedValue('Location services are not enabled.')
    const err = (await getCurrentLocation().catch(e => e)) as LocationError
    expect(err).toEqual({ code: 'permission-denied', platform: 'tauri' })
    // …which routes to the wording that names the exact screen holding the switch.
    expect(describeLocationError(err)).toMatch(/Settings → Privacy & Security → Location Services/)
  })

  it('maps a denied permission status to permission-denied (the primary denial path)', async () => {
    onIOS()
    vi.mocked(geo.checkPermissions).mockResolvedValue({
      location: 'prompt', coarseLocation: 'prompt',
    } as Awaited<ReturnType<typeof geo.checkPermissions>>)
    vi.mocked(geo.requestPermissions).mockResolvedValue(denied)
    await expect(getCurrentLocation()).rejects.toEqual({
      code: 'permission-denied',
      platform: 'tauri',
    })
  })

  it("maps the real empty-array reject ('Location service returned an empty Location array.') to the honest generic unavailable", async () => {
    onIOS()
    vi.mocked(geo.checkPermissions).mockResolvedValue(granted)
    // GeolocationPlugin.swift:175
    vi.mocked(geo.getCurrentPosition).mockRejectedValue(
      'Location service returned an empty Location array.',
    )
    await expect(getCurrentLocation()).rejects.toEqual({
      code: 'unavailable',
      platform: 'tauri',
    })
  })

  it('maps a locale-dependent CLError localizedDescription to the honest generic unavailable', async () => {
    onIOS()
    vi.mocked(geo.checkPermissions).mockResolvedValue(granted)
    // GeolocationPlugin.swift:152 rejects error.localizedDescription — in
    // English a bare CLError reads like this, and it is deliberately NOT parsed.
    vi.mocked(geo.getCurrentPosition).mockRejectedValue(
      "The operation couldn’t be completed. (kCLErrorDomain error 0.)",
    )
    await expect(getCurrentLocation()).rejects.toEqual({
      code: 'unavailable',
      platform: 'tauri',
    })
  })
})

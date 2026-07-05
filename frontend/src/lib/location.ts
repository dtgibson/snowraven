import { invoke } from '@tauri-apps/api/core'
import { isTauri, isWindows, isIOS } from './platform'

export interface Location {
  lat: number
  lng: number
}

export interface LocationError {
  code: 'permission-denied' | 'unavailable' | 'timeout' | 'dev-mode' | 'insecure-context'
  platform?: 'tauri' | 'web'
}

// Turn a LocationError into a user-facing message. Shared by every "use my
// location" caller (Map Explorer, Settings) so the wording stays consistent and
// the platform branches live in one place.
export function describeLocationError(err: LocationError): string {
  switch (err.code) {
    case 'permission-denied':
      return err.platform === 'tauri'
        ? (isIOS()
            ? 'Allow location for SnowRaven in Settings → Privacy & Security → Location Services, then try again.'
            : isWindows()
            ? 'Turn on location in Windows Settings → Privacy & security → Location, then try again.'
            : 'Location access was denied. Grant permission in System Settings → Privacy & Security → Location Services.')
        : 'Location access was denied. Allow location access in your browser settings.'
    case 'timeout':
      return 'Location request timed out. Try again or enter coordinates manually.'
    case 'dev-mode':
      return "Location requires a production build. Run 'npm run desktop:build' to test."
    case 'insecure-context':
      return 'Location requires HTTPS. Enter coordinates manually or access the app via localhost.'
    default:
      return 'Unable to determine your location. Try again or enter coordinates manually.'
  }
}

// Tauri desktop: uses a native CLLocationManager command (src-tauri/src/location.rs).
//   navigator.geolocation cannot work in Tauri because wry's WKWebView UIDelegate does not
//   implement webView:requestGeolocationPermissionFor:, so macOS silently denies it.
//
// Web: uses navigator.geolocation. Requires a secure context (HTTPS or localhost).
//   On plain HTTP (e.g. Raspberry Pi served over LAN), the browser blocks geolocation
//   and returns PERMISSION_DENIED immediately without showing a dialog.
export async function getCurrentLocation(): Promise<Location> {
  if (isTauri()) {
    // iOS/iPadOS: tauri-plugin-geolocation (mobile-only Cargo dep +
    // cfg(mobile) registration — mobile-app schema §2.7, FR-16). Branches
    // BEFORE the dev-mode guard: the guard is desktop-only (the macOS native
    // command needs a production bundle); iOS dev uses the real plugin.
    if (isIOS()) {
      return getCurrentLocationIOS()
    }
    // Native get_location command: CLLocationManager on macOS, the Windows
    // Geolocation API on Windows (both return { lat, lng }).
    if (import.meta.env.DEV) {
      const err: LocationError = { code: 'dev-mode' }
      throw err
    }
    try {
      const coords = await invoke<{ lat: number; lng: number }>('get_location')
      return { lat: coords.lat, lng: coords.lng }
    } catch (raw) {
      const msg = typeof raw === 'string' ? raw : String(raw)
      const err: LocationError = msg.includes('permission-denied')
        ? { code: 'permission-denied', platform: 'tauri' }
        : { code: 'unavailable', platform: 'tauri' }
      throw err
    }
  }

  // Web path
  if (!window.isSecureContext) {
    const err: LocationError = { code: 'insecure-context' }
    throw err
  }

  if (!navigator.geolocation) {
    const err: LocationError = { code: 'unavailable' }
    throw err
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      err => {
        const locErr: LocationError =
          err.code === 1 ? { code: 'permission-denied', platform: 'web' }
          : err.code === 3 ? { code: 'timeout' }
          : { code: 'unavailable' }
        reject(locErr)
      },
      { timeout: 10000 },
    )
  })
}

// iOS path: check → request (first use raises the system prompt, FR-16) →
// getCurrentPosition, mapped onto the existing LocationError codes so
// describeLocationError and every caller (Map Explorer, Settings default
// location) work unchanged. The dynamic import keeps the plugin JS off the
// entry chunk and out of desktop/web bundles' execution path (NFR-06).
async function getCurrentLocationIOS(): Promise<Location> {
  let geo: typeof import('@tauri-apps/plugin-geolocation')
  try {
    geo = await import('@tauri-apps/plugin-geolocation')
  } catch {
    const err: LocationError = { code: 'unavailable', platform: 'tauri' }
    throw err
  }
  try {
    let status = await geo.checkPermissions()
    if (status.location === 'prompt' || status.location === 'prompt-with-rationale') {
      status = await geo.requestPermissions(['location'])
    }
    if (status.location !== 'granted') {
      const err: LocationError = { code: 'permission-denied', platform: 'tauri' }
      throw err
    }
    const pos = await geo.getCurrentPosition({
      enableHighAccuracy: false,
      timeout: 10000, // ignored on iOS per the plugin docs; harmless
      maximumAge: 60000,
    })
    return { lat: pos.coords.latitude, lng: pos.coords.longitude }
  } catch (raw) {
    // Already one of ours (the denied throw above)? Re-throw as-is.
    if (raw && typeof raw === 'object' && 'code' in raw) throw raw
    // Plugin failures surface as strings. The installed plugin (2.3.2) iOS
    // Swift side rejects with exactly these (verified in its source):
    //   "Location services are not enabled."  — the GLOBAL Location Services
    //     switch is off; route to permission-denied so the iOS wording fires
    //     (it points at Settings → Privacy & Security → Location Services,
    //     the exact screen holding that master switch);
    //   CLError localizedDescription — locale-dependent, unparseable;
    //   "Location service returned an empty Location array."
    // The latter two honestly map to the generic 'unavailable'. Keep /denied/
    // for future plugin versions; there is no reachable timeout string on iOS
    // (the plugin ignores the timeout option there), so no timeout arm.
    const msg = typeof raw === 'string' ? raw : String(raw)
    const err: LocationError = /denied|not enabled/i.test(msg)
      ? { code: 'permission-denied', platform: 'tauri' }
      : { code: 'unavailable', platform: 'tauri' }
    throw err
  }
}

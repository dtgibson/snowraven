import { invoke } from '@tauri-apps/api/core'
import { isTauri, isWindows } from './platform'

export interface Location {
  lat: number
  lng: number
}

export interface LocationError {
  code: 'permission-denied' | 'unavailable' | 'timeout' | 'dev-mode' | 'insecure-context' | 'unsupported-platform'
  platform?: 'tauri' | 'web'
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
    // The native get_location command is macOS-only (CLLocationManager). Windows
    // has no native implementation yet, so degrade gracefully. The UI hides the
    // "Use my location" button on Windows; this is a safety net if it's ever shown.
    if (isWindows()) {
      const err: LocationError = { code: 'unsupported-platform', platform: 'tauri' }
      throw err
    }
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

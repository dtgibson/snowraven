import { isTauri } from './platform'

export interface Location {
  lat: number
  lng: number
}

export interface LocationError {
  code: 'permission-denied' | 'unavailable' | 'timeout' | 'dev-mode'
  platform?: 'tauri' | 'web'
}

// In Tauri production builds, the frontend is served from the snowraven:// custom protocol,
// which WKWebView treats as a secure context — navigator.geolocation works there.
// In Tauri dev mode (http://localhost:5173), the non-HTTPS origin blocks geolocation.
// tauri-plugin-geolocation is reserved for iOS/Android — its macOS impl is a no-op stub.
export async function getCurrentLocation(): Promise<Location> {
  const platform: 'tauri' | 'web' = isTauri() ? 'tauri' : 'web'

  if (!navigator.geolocation) {
    const err: LocationError = isTauri() && import.meta.env.DEV
      ? { code: 'dev-mode' }
      : { code: 'unavailable' }
    throw err
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      err => {
        const locErr: LocationError =
          err.code === 1 ? { code: 'permission-denied', platform }
          : err.code === 3 ? { code: 'timeout' }
          : { code: 'unavailable' }
        reject(locErr)
      },
      { timeout: 10000 },
    )
  })
}

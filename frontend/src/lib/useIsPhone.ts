// Render-safe phone-width detector — the React-sanctioned external-store media
// pattern (useSyncExternalStore over a MediaQueryList), NOT a window.innerWidth /
// resize handler (which CLAUDE.md forbids and react-hooks/purity rejects as an
// impure render read). Subscribes to the `(max-width:640px)` MQL `change` event; the
// snapshot is `mql.matches`; the server snapshot is `false` (SSR-safe, and the
// pre-hydration / no-matchMedia fallback). 640px is the established phone boundary.

import { useSyncExternalStore } from 'react'

const QUERY = '(max-width:640px)'

function getMql(): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null
  return window.matchMedia(QUERY)
}

function subscribe(onChange: () => void): () => void {
  const mql = getMql()
  if (!mql) return () => {}
  // Older Safari exposes addListener/removeListener; modern is addEventListener.
  if (typeof mql.addEventListener === 'function') {
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }
  mql.addListener(onChange)
  return () => mql.removeListener(onChange)
}

function getSnapshot(): boolean {
  return getMql()?.matches ?? false
}

function getServerSnapshot(): boolean {
  return false
}

export function useIsPhone(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

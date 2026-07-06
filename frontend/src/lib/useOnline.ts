// Shared connectivity signal, extracted from the SnowMap.tsx pattern. Returns a
// boolean that flips with the browser's `online`/`offline` events. `navigator.onLine`
// is read only in the state INITIALIZER and never in the render body or a memo
// (react-hooks/purity), so it is render-safe.
//
// It is a UI hint (default embed vs. offline placeholder), never a hard gate on a
// real request. This file imports no map/maplibre code, so it is safe to pull into
// the entry-chunk static graph.

import { useEffect, useState } from 'react'

/** True when the browser reports a connection (or can't tell). Updates live on the
 *  window `online`/`offline` events. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(
    () => typeof navigator === 'undefined' || navigator.onLine !== false,
  )
  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])
  return online
}

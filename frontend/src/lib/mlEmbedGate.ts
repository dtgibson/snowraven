// Is the Macaulay Library embed endpoint currently behind Cornell's bot check?
//
// Cornell put a proof-of-work gate in front of macaulaylibrary.org. Its
// interstitial needs a cookie that a cross-site iframe cannot hold, so an
// embedded player renders Cornell's "Missing feature Cookies" card instead of
// the media. The frame cannot detect this itself: the interstitial is a
// same-status HTTP 200 in a cross-origin frame, so `onError` never fires and
// `onLoad` reports success. The probe therefore runs out-of-band through the
// transport seam (FastAPI on web/Pi, the Tauri HTTP plugin on desktop).
//
// TWO deliberate properties:
//
// 1. It fails toward showing the real embed. Any probe failure — offline, a
//    server error, a malformed id — resolves to `open`, so a probe that cannot
//    run never hides media that would have played.
// 2. The signal is GLOBAL ("the gate is up"), not per-viewer ("this browser is
//    blocked"), because nothing in the page can observe the frame's own outcome.
//    A browser that could pass the challenge (Chrome on an HTTPS origin, where
//    the challenge's partitioned cookies are allowed) therefore sees our card
//    rather than a working player. That cost is accepted deliberately: Safari
//    blocks third-party cookies outright and is also the engine behind the macOS
//    and iOS apps, so the blocked case is the common one here. It self-heals —
//    when Cornell lifts the gate the probe reports `open` and embeds return with
//    no code change.
//
// Session-scoped and single-flight: the first tile to mount probes once, every
// other tile shares the result. This is why /media/embed-status is NOT in
// transport's CACHED_GET_PATHS (one caching layer per call).

import { useEffect, useSyncExternalStore } from 'react'
import { transport } from './transport'

export type EmbedGateState = 'unknown' | 'open' | 'gated'

const CATALOG_ID_RE = /^[0-9]+$/

let state: EmbedGateState = 'unknown'
let inflight: Promise<void> | null = null
const listeners = new Set<() => void>()

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange)
  return () => { listeners.delete(onChange) }
}

/** The resolved gate state. `unknown` until the session's one probe settles. */
export function getEmbedGateState(): EmbedGateState {
  return state
}

function getSnapshot(): EmbedGateState {
  return state
}

function getServerSnapshot(): EmbedGateState {
  return 'unknown'
}

/** Probe once per session. Later calls reuse the in-flight promise or the result. */
export function probeEmbedGate(catalogId: string): Promise<void> {
  if (inflight) return inflight
  if (state !== 'unknown') return Promise.resolve()
  if (!CATALOG_ID_RE.test(catalogId)) return Promise.resolve()

  inflight = transport
    .get<{ gated: boolean }>('/media/embed-status', { catalogId })
    .then((res) => { state = res.gated ? 'gated' : 'open' })
    .catch(() => { state = 'open' })
    .finally(() => {
      inflight = null
      for (const listener of listeners) listener()
    })

  return inflight
}

/**
 * True when the embed endpoint is gated and an inline player would show
 * Cornell's error card. Pass an empty id to skip the probe (e.g. when embedded
 * media is switched off, so a disabled surface makes no network call).
 */
export function useMlEmbedGate(catalogId: string): boolean {
  const current = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  useEffect(() => {
    void probeEmbedGate(catalogId)
  }, [catalogId])

  return current === 'gated'
}

/** Test seam only — resets the session-scoped probe. */
export function resetEmbedGateForTests(): void {
  state = 'unknown'
  inflight = null
  listeners.clear()
}

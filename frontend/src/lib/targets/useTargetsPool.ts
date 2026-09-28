// The county's species pool (targets-tab, schema.md section 5.7; FR-11 to FR-15).
//
// THE POOL IS THE SHARED `county-completeness-v1` ENTRY, never a second copy
// (FR-11): the tab reads `loadAll()` first, so a cached list, fresh OR stale,
// renders before any network call and with no key or no connection (FR-12),
// and only then asks `dedupedFetch` with the same `/map/county-species` loader
// the Map Explorer's Completeness metric uses. The store owns the 30-day TTL,
// the in-flight dedupe, errors-never-cached and the offline stale read; the
// route is in EBIRD_GATED_PATHS, so the one gated call paces itself.
//
// A cached list whose refresh fails stays on screen, silently: it is still the
// county's all-time list, and a 30-day-old one is the honest answer offline.
// With nothing cached, a missing key and no connection each say so in one line
// with no spinner (FR-14), and a failed fetch says why with a retry (FR-15).

import { useCallback, useEffect, useState } from 'react'
import { transport, TransportError } from '../transport'
import { classifyLiveError, OFFLINE_MESSAGE_SHORT } from '../offlineMessage'
import { COMPLETENESS_TTL_MS, dedupedFetch, loadAll } from '../countyCompletenessCache'
import type { CountyEbirdData } from '../countyCompleteness'

export type PoolState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; data: CountyEbirdData; fetchedAt: number }
  | { status: 'no-key' }
  | { status: 'offline' }
  | { status: 'failed'; cause: string }

const IDLE: PoolState = { status: 'idle' }

function causeOf(err: unknown): string {
  const classified = classifyLiveError(err, { offlineMessage: OFFLINE_MESSAGE_SHORT })
  if (err instanceof TransportError && err.detail) return err.detail
  const detail = (err as { detail?: unknown } | null)?.detail
  if (classified.kind === 'error' && typeof detail === 'string' && detail) return detail
  return classified.message
}

export function useTargetsPool(
  regionCode: string | null,
  hasEbirdKey: boolean | null,
  online: boolean,
): { state: PoolState; retry: () => void } {
  const [state, setState] = useState<{ region: string | null; pool: PoolState }>({ region: null, pool: IDLE })
  const [nonce, setNonce] = useState(0)
  const retry = useCallback(() => setNonce(n => n + 1), [])

  useEffect(() => {
    if (!regionCode) return
    let cancelled = false
    const put = (pool: PoolState) => { if (!cancelled) setState({ region: regionCode, pool }) }
    void (async () => {
      let hit: { data: CountyEbirdData; fetchedAt: number } | null
      try {
        hit = (await loadAll()).get(regionCode) ?? null
      } catch {
        hit = null
      }
      if (cancelled) return
      if (hit) put({ status: 'ready', data: hit.data, fetchedAt: hit.fetchedAt })
      if (hit && Date.now() - hit.fetchedAt < COMPLETENESS_TTL_MS) return
      if (hasEbirdKey === null) { if (!hit) put({ status: 'loading' }); return }
      if (hasEbirdKey === false) { if (!hit) put({ status: 'no-key' }); return }
      if (!online) { if (!hit) put({ status: 'offline' }); return }
      if (!hit) put({ status: 'loading' })
      try {
        const res = await dedupedFetch(regionCode, () => transport.get<CountyEbirdData>('/map/county-species', { regionCode }))
        put({ status: 'ready', data: res.data, fetchedAt: res.fetchedAt })
      } catch (err) {
        if (hit) return
        const kind = classifyLiveError(err).kind
        if (kind === 'offline') put({ status: 'offline' })
        else if (kind === 'no-key' || (err as { status?: unknown } | null)?.status === 401) put({ status: 'no-key' })
        else put({ status: 'failed', cause: causeOf(err) })
      }
    })()
    return () => { cancelled = true }
  }, [regionCode, hasEbirdKey, online, nonce])

  // A state written for a different county is never shown for this one.
  const pool = regionCode && state.region === regionCode ? state.pool : (regionCode ? { status: 'loading' } as const : IDLE)
  return { state: pool, retry }
}

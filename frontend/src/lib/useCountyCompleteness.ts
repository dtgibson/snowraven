// The Completeness controller (schema.md — "CompletenessController"): owns the
// per-county eBird state for the Map Explorer's Completeness metric and exposes
// the render-safe CountyCompletenessView that CountyLayer consumes.
//
// Responsibilities:
//   • seed from the persistent 30-day cache once (offline/no-key friendly —
//     cached counties shade immediately, FR-29/FR-30);
//   • bounded eager fetch (pool of 4) of BIRDED, region-resolvable, non-fresh
//     in-view counties — never un-birded, never the viewport-cap set, never any
//     metric but completeness, never a bulk sweep (FR-13/FR-17, NFR-01);
//   • click-to-fetch / retry for a single explicit county (FR-14, FR-31);
//   • one batched /taxonomy/codes resolve for the user's countable county names
//     (recent-new favicons + the targets code subtraction, FR-22/FR-23);
//   • per-county degraded status via the app's standard three-state classifier
//     (offline / no-key / error — one voice, NFR-08).
//
// Purity: summaryFor/resultFor are called during render and read only state —
// every Date.now() lives in a handler, an effect, or the module-level session
// constant (the SESSION_NOW_MS pattern; react-hooks/purity is build-blocking).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { transport, TransportError } from './transport'
import { classifyLiveError, GENERIC_ERROR_MESSAGE, OFFLINE_MESSAGE_SHORT } from './offlineMessage'
import { countyKey, deriveCountyRegionCode } from './countyBoundaries'
import {
  completenessBand, completenessPercent, computeCompleteness,
  type CountyCompletenessResult, type CountyCompletenessSummary, type CountyCompletenessView,
  type CountyEbirdData, type CountyLocalCompleteness, type CompletenessStatus,
} from './countyCompleteness'
import * as completenessCache from './countyCompletenessCache'

/** OQ-07: fixed eager-fetch concurrency bound. */
export const EAGER_FETCH_CONCURRENCY = 4

export const EBIRD_NO_KEY_MESSAGE = 'eBird API key not configured. Add it in Settings.'

// Session-stable "now": marks entries loaded from the persistent store as
// fromCache (fetchedAt predates this session) and anchors the cache-line
// "N days ago" copy without calling Date.now() in render.
const SESSION_NOW_MS = Date.now()

interface EbirdEntry { data: CountyEbirdData; fetchedAt: number }
interface Transient { status: 'loading' | 'offline' | 'no-key' | 'error'; message?: string }

export interface UseCountyCompletenessArgs {
  /** Completeness metric selected + county shading on + backup ready. */
  active: boolean
  localByCounty: Map<string, CountyLocalCompleteness> | null
  hasEbirdKey: boolean | null
}

function classifyFetchError(err: unknown): Transient {
  const classified = classifyLiveError(err, { offlineMessage: OFFLINE_MESSAGE_SHORT })
  if (classified.kind === 'offline') return { status: 'offline', message: classified.message }
  const e = err as { status?: number; detail?: string }
  const status = err instanceof TransportError ? err.status : e.status
  if (status === 401 || classified.kind === 'no-key') {
    return { status: 'no-key', message: EBIRD_NO_KEY_MESSAGE }
  }
  const detail = err instanceof TransportError ? err.detail : (e.detail ?? (err instanceof Error ? err.message : undefined))
  return { status: 'error', message: detail || GENERIC_ERROR_MESSAGE }
}

export function useCountyCompleteness({ active, localByCounty, hasEbirdKey }: UseCountyCompletenessArgs): CountyCompletenessView | null {
  const [ebirdByRegion, setEbirdByRegion] = useState<ReadonlyMap<string, EbirdEntry>>(() => new Map())
  const [transient, setTransient] = useState<ReadonlyMap<string, Transient>>(() => new Map())
  const [codeByName, setCodeByName] = useState<Record<string, string>>({})

  const seededRef = useRef(false)
  const codesRequestedForRef = useRef<unknown>(null)
  const queueRef = useRef<string[]>([])
  const queuedRef = useRef<Set<string>>(new Set())
  const loadingRef = useRef<Set<string>>(new Set())
  const activeFetchesRef = useRef(0)

  // ── Seed from the persistent cache once (first activation) ──────────────────
  useEffect(() => {
    if (!active || seededRef.current) return
    seededRef.current = true
    let cancelled = false
    void completenessCache.loadAll()
      .then(entries => {
        if (cancelled || entries.size === 0) return
        setEbirdByRegion(prev => {
          const next = new Map(prev)
          for (const [rc, e] of entries) {
            if (!next.has(rc)) next.set(rc, { data: e.data, fetchedAt: e.fetchedAt })
          }
          return next
        })
      })
      .catch(() => { /* absent/corrupt store degrades to empty — fetch as usual */ })
    return () => { cancelled = true }
  }, [active])

  // ── One batched code resolve for the user's countable county names ───────────
  // (recent-new favicons + the targets code subtraction). Failure degrades
  // gracefully: favicons no-op, targets still subtract by normalized name.
  useEffect(() => {
    if (!active || !localByCounty || codesRequestedForRef.current === localByCounty) return
    codesRequestedForRef.current = localByCounty
    const seen = new Map<string, string>()
    for (const local of localByCounty.values()) {
      for (const n of local.countableNames) {
        if (!seen.has(n)) seen.set(n, local.sciByName[n] ?? '')
      }
    }
    if (seen.size === 0) return
    const species = [...seen.entries()].map(([commonName, scientificName]) => ({ commonName, scientificName }))
    let cancelled = false
    transport.post<{ codes: Record<string, string> }>('/taxonomy/codes', { species })
      .then(data => { if (!cancelled) setCodeByName(data.codes) })
      .catch(() => { /* taxonomy unavailable — plain names, name-based subtraction */ })
    return () => { cancelled = true }
  }, [active, localByCounty])

  // ── Bounded fetch pool (OQ-07: 4) ────────────────────────────────────────────
  // pump/launch are plain per-render closures used only from handlers/effects/
  // promise callbacks; they touch refs and stable setters only, so a stale
  // closure is harmless. Freshness is owned by the cache module (dedupedFetch
  // short-circuits a fresh entry with no network), so a re-queued fresh region
  // costs nothing (FR-15/QA-13).
  function launch(rc: string): void {
    loadingRef.current.add(rc)
    activeFetchesRef.current += 1
    setTransient(prev => {
      const next = new Map(prev)
      next.set(rc, { status: 'loading' })
      return next
    })
    completenessCache
      .dedupedFetch(rc, () => transport.get<CountyEbirdData>('/map/county-species', { regionCode: rc }))
      .then(res => {
        setEbirdByRegion(prev => {
          const next = new Map(prev)
          next.set(rc, { data: res.data, fetchedAt: res.fetchedAt })
          return next
        })
        setTransient(prev => {
          if (!prev.has(rc)) return prev
          const next = new Map(prev)
          next.delete(rc)
          return next
        })
      })
      .catch(err => {
        const t = classifyFetchError(err)
        setTransient(prev => {
          const next = new Map(prev)
          next.set(rc, t)
          return next
        })
      })
      .finally(() => {
        loadingRef.current.delete(rc)
        activeFetchesRef.current -= 1
        pump()
      })
  }

  function pump(): void {
    while (activeFetchesRef.current < EAGER_FETCH_CONCURRENCY && queueRef.current.length > 0) {
      const rc = queueRef.current.shift()!
      queuedRef.current.delete(rc)
      if (loadingRef.current.has(rc)) continue
      launch(rc)
    }
  }

  // ── Eager fetch: birded, resolvable, non-fresh in-view counties (FR-13) ─────
  const onViewportCounties = useCallback((rows: { stusps: string; name: string; geoid: string }[]): void => {
    if (!active || !localByCounty || hasEbirdKey !== true) return
    const now = Date.now()
    let added = false
    for (const r of rows) {
      const local = localByCounty.get(countyKey(r.stusps, r.name))
      if (!local || local.countableCount < 1) continue           // never un-birded (FR-13)
      const rc = deriveCountyRegionCode(r.geoid, r.stusps)
      if (!rc) continue                                          // never unresolvable (FR-18)
      const entry = ebirdByRegion.get(rc)
      if (entry && now - entry.fetchedAt < completenessCache.COMPLETENESS_TTL_MS) continue
      if (transient.has(rc)) continue                            // in flight, or failed — retry is click-driven
      if (queuedRef.current.has(rc) || loadingRef.current.has(rc)) continue
      queuedRef.current.add(rc)
      queueRef.current.push(rc)
      added = true
    }
    if (added) pump()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pump/launch are ref-driven per-render closures
  }, [active, localByCounty, hasEbirdKey, ebirdByRegion, transient])

  // ── Explicit single-county fetch: click-to-fetch + retry (FR-14/FR-31) ──────
  const requestCounty = useCallback((stusps: string, _name: string, geoid: string): void => {
    if (!active || hasEbirdKey === false) return                 // FR-29: no fetch attempts with no key
    const rc = deriveCountyRegionCode(geoid, stusps)
    if (!rc) return
    // Clear a prior failure so the retry actually relaunches (errors never cache).
    setTransient(prev => {
      const t = prev.get(rc)
      if (!t || t.status === 'loading') return prev
      const next = new Map(prev)
      next.delete(rc)
      return next
    })
    if (queuedRef.current.has(rc) || loadingRef.current.has(rc)) return
    queuedRef.current.add(rc)
    queueRef.current.unshift(rc)                                 // an explicit click jumps the queue
    pump()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pump/launch are ref-driven per-render closures
  }, [active, hasEbirdKey])

  // ── Popup-open hook: auto-fetch a BIRDED, unfetched county (FR-33) ───────────
  // Un-birded counties stay behind the explicit "Load completeness" button.
  const ensureCountyForPopup = useCallback((stusps: string, name: string, geoid: string): void => {
    if (!active || !localByCounty || hasEbirdKey !== true) return
    const local = localByCounty.get(countyKey(stusps, name))
    if (!local || local.countableCount < 1) return
    const rc = deriveCountyRegionCode(geoid, stusps)
    if (!rc) return
    if (ebirdByRegion.has(rc)) return                            // stale entries refresh via the eager path
    if (transient.has(rc)) return                                // loading, or failed (retry is the button)
    if (queuedRef.current.has(rc) || loadingRef.current.has(rc)) return
    queuedRef.current.add(rc)
    queueRef.current.unshift(rc)
    pump()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pump/launch are ref-driven per-render closures
  }, [active, localByCounty, hasEbirdKey, ebirdByRegion, transient])

  // ── Render-safe reads ────────────────────────────────────────────────────────
  const statusFor = useCallback((rc: string | null): { status: CompletenessStatus; message?: string } => {
    if (!rc) return { status: 'no-region' }
    const entry = ebirdByRegion.get(rc)
    if (entry) return { status: entry.data.speciesCount === 0 ? 'empty' : 'ready' }
    const t = transient.get(rc)
    if (t) return { status: t.status, message: t.message }
    if (hasEbirdKey === false) return { status: 'no-key', message: EBIRD_NO_KEY_MESSAGE }
    return { status: 'unfetched' }
  }, [ebirdByRegion, transient, hasEbirdKey])

  const summaryFor = useCallback((stusps: string, name: string, geoid: string): CountyCompletenessSummary => {
    const local = localByCounty?.get(countyKey(stusps, name)) ?? null
    const x = local?.countableCount ?? 0
    const rc = deriveCountyRegionCode(geoid, stusps)
    const { status, message } = statusFor(rc)
    const entry = rc ? ebirdByRegion.get(rc) : undefined
    if (entry && entry.data.speciesCount > 0) {
      const y = entry.data.speciesCount
      return {
        x, y,
        percent: completenessPercent(x, y),
        band: completenessBand(Math.min(x / y, 1)),
        status: 'ready',
        fromCache: entry.fetchedAt < SESSION_NOW_MS,
        fetchedAt: entry.fetchedAt,
      }
    }
    return {
      x,
      band: 0,
      status,
      message,
      fromCache: entry ? entry.fetchedAt < SESSION_NOW_MS : false,
      ...(entry ? { y: 0, fetchedAt: entry.fetchedAt } : {}),
    }
  }, [localByCounty, ebirdByRegion, statusFor])

  const userCodes = useMemo(() => new Set(Object.values(codeByName)), [codeByName])

  const resultFor = useCallback((stusps: string, name: string, geoid: string): CountyCompletenessResult => {
    const local = localByCounty?.get(countyKey(stusps, name)) ?? null
    const rc = deriveCountyRegionCode(geoid, stusps)
    const { status, message } = statusFor(rc)
    const entry = rc ? ebirdByRegion.get(rc) : undefined
    return computeCompleteness(local, entry?.data ?? null, userCodes, {
      status,
      message,
      fromCache: entry ? entry.fetchedAt < SESSION_NOW_MS : false,
      regionResolvable: rc !== null,
      fetchedAt: entry?.fetchedAt,
    })
  }, [localByCounty, ebirdByRegion, statusFor, userCodes])

  const codeFor = useCallback((commonName: string): string | undefined => codeByName[commonName], [codeByName])

  return useMemo<CountyCompletenessView | null>(() => {
    if (!active) return null
    return { summaryFor, resultFor, onViewportCounties, requestCounty, ensureCountyForPopup, codeFor, hasKey: hasEbirdKey }
  }, [active, summaryFor, resultFor, onViewportCounties, requestCounty, ensureCountyForPopup, codeFor, hasEbirdKey])
}

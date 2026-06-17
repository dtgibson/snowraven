// Public-hotspot determination. An eBird location is either a PUBLIC HOTSPOT (it has
// an ebird.org/hotspot page worth linking to) or a PERSONAL location (no public page —
// a link there 404s). The eBird CSV export carries NO hotspot flag, so we classify by
// membership in a region-scoped Set of hotspot locIds, built from eBird's
// ref/hotspot/{region} endpoint: one fetch per distinct region the user has data in
// (the backup's subnational1 `stateProvince` code, e.g. "US-CA") — typically 1–3
// fetches total, NOT one per location. Membership is then an O(1) test reused on every
// location-name surface. No key / a failed region fetch → that region's hotspots are
// simply absent → those locations read as personal (plain text), never a speculative
// link. Classification can lag reality (a location created after the last backup, or a
// hotspot newly promoted/demoted) — accepted; the user's own locations are the minority.

import { transport } from './transport'
import { loadEbirdObservations } from './observationsCache'
import type { ObservationEntry } from '../types'

const LOC_ID_RE = /^L\d+$/
// eBird region code: country "US", subnational1 "US-CA", subnational2 "US-CA-037".
const REGION_RE = /^[A-Z]{2}(-[A-Z0-9]+){0,2}$/

/** Distinct valid region codes (subnational1, e.g. "US-CA") from the backup's
 *  stateProvince column — the regions whose hotspots we fetch. Sorted for a stable
 *  cache key. */
export function regionsFromObservations(obs: ObservationEntry[]): string[] {
  const set = new Set<string>()
  for (const o of obs) {
    const code = o.stateProvince
    if (code && REGION_RE.test(code)) set.add(code)
  }
  return [...set].sort()
}

/** Fetch + union the public-hotspot locIds for the user's regions. One (cached)
 *  request per region; a failing region is skipped (degrade, never throw). */
export async function buildHotspotSet(obs: ObservationEntry[]): Promise<Set<string>> {
  const regions = regionsFromObservations(obs)
  const lists = await Promise.all(regions.map(region =>
    transport.get<string[]>('/map/hotspot-region', { regionCode: region }).catch(() => [] as string[]),
  ))
  const set = new Set<string>()
  for (const ids of lists) for (const id of ids) set.add(id)
  return set
}

/** True iff `locId` is a shape-valid eBird id present in the public-hotspot Set. */
export function isPublicHotspot(locId: string | null | undefined, set: Set<string>): boolean {
  return !!locId && LOC_ID_RE.test(locId) && set.has(locId)
}

// Module-level cache: build the Set ONCE per loaded backup (keyed on the region list)
// and share it across every tab that asks — re-derived only when the regions change
// (a new backup). useHotspotSet is the React seam over this.
let _key = ''
let _promise: Promise<Set<string>> | null = null

// Invalidation signal. The cache keys on the backup's REGION list, which doesn't change
// when the user later adds/fixes their eBird key (so a Set built empty for lack of a key
// would otherwise stay empty all session) and a same-region backup swap keeps the same
// key. So the React seam SUBSCRIBES to an epoch that the cache-clearing points (eBird
// file save AND key save, in Settings) bump via invalidateHotspotSet — forcing a rebuild
// + a re-load on every mounted tab without per-tab version threading. (A persistent tab's
// useHotspotSet effect is otherwise mount-only, so it never picks up a mid-session change.)
let _epoch = 0
const _subscribers = new Set<() => void>()

/** Current invalidation epoch — useSyncExternalStore snapshot for useHotspotSet. */
export function getHotspotSetEpoch(): number {
  return _epoch
}

/** Subscribe to invalidation; returns an unsubscribe. */
export function subscribeHotspotSet(cb: () => void): () => void {
  _subscribers.add(cb)
  return () => { _subscribers.delete(cb) }
}

/** Drop the cached Set and notify subscribers to rebuild. Call when the eBird file OR
 *  key changes (the two things that can make the cached classification stale). */
export function invalidateHotspotSet(): void {
  _key = ''
  _promise = null
  _epoch++
  for (const cb of _subscribers) cb()
}

export function getHotspotSet(obs: ObservationEntry[]): Promise<Set<string>> {
  const key = regionsFromObservations(obs).join(',')
  if (key !== _key || _promise === null) {
    _key = key
    _promise = key ? buildHotspotSet(obs) : Promise.resolve(new Set<string>())
  }
  return _promise
}

/** Parameterless seam for tabs that don't already hold the parsed backup: load it
 *  (from the shared observationsCache — no re-read/re-parse if a tab already did) and
 *  build/return the region-keyed hotspot Set. No file → empty Set (everything reads as
 *  personal). This is what useHotspotSet drives, so any tab can ask for the Set with a
 *  single top-level hook call. */
export async function loadHotspotSet(): Promise<Set<string>> {
  const loaded = await loadEbirdObservations()
  if (!loaded) return new Set<string>()
  return getHotspotSet(loaded.observations)
}

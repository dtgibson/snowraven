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
//
// ONE EXCEPTION, asked again (hotspot-links-retry-after-429): a region whose lookup ran
// out of the gate's 429 retries is UNANSWERED, not empty, because eBird never said the
// region has no hotspots. Without this, that region's links stayed plain all session,
// since nothing else ever asked again (networkCache never holds a 429 and the gate's
// cooldown ends on its own). The schedule below is this module's own pass-scale layer
// on top of the shared gate (lib/ebirdGate.ts), whose policy it does not touch:
//
//   which     only the regions whose answer was a 429 after the gate's retries; a region
//             that answered is never re-asked, and offline, a 5xx, or a missing or bad
//             key keep the plain behaviour above (a key or file save re-arms them).
//   rounds    HOTSPOT_RETRY_ROUNDS (3). Round k starts hotspotRetryDelayMs(k) after the
//             previous attempt ended: 1, 2, then 4 minutes, so about 7 minutes in all.
//   requests  per round, one transport.get per still-limited region, which the gate
//             turns into at most 1 + ACTIVITY_RATE_LIMIT_RETRIES (3) requests. So at most
//             9 requests per limited region per build beyond the build's own 3, and once
//             the rounds are spent the region stays plain, exactly as before this fix.
//   cooldown  every request still goes through transport.get and so through the gate,
//             which holds a request's START until any open cooldown has ended. That is
//             what guarantees no re-ask lands inside a cooldown; the 1 minute first
//             spacing is merely never shorter than the longest cooldown the gate opens
//             (Retry-After capped at RETRY_AFTER_CAP_SEC = 60, its own ladder at 30 s),
//             so a round's timer does not normally fire into one.
//
// Supersession: invalidateHotspotSet (an eBird key or file save or delete in Settings,
// an iCloud arrival or clear) and a new region list both run supersedeRetries, which
// bumps _buildGen and clears the one pending round timer, so a pending round never asks.
// A round already asking re-checks the generation after its answer lands, so an answer
// that started under an older build never merges into a newer one.

import { transport } from './transport'
import { loadEbirdObservations } from './observationsCache'
import { isRateLimitError } from './rateLimit'
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

/** Re-ask rounds per build for a region whose lookup ran out of 429 retries. */
export const HOTSPOT_RETRY_ROUNDS = 3

/** Spacing before the first re-ask round; each later round doubles it. */
export const HOTSPOT_RETRY_BASE_MS = 60_000

/** Spacing before re-ask round `round` (1-based), measured from the end of the
 *  previous attempt (the build, or the round before). */
export function hotspotRetryDelayMs(round: number): number {
  return HOTSPOT_RETRY_BASE_MS * 2 ** (round - 1)
}

/** One pass over some regions: the union of the ids that answered, and the regions
 *  whose answer was a 429 after the gate's retries (retry eligible). Any other
 *  failure contributes nothing and is not listed. */
async function askRegions(regions: string[]): Promise<{ ids: Set<string>; limited: string[] }> {
  const answers = await Promise.all(regions.map(region =>
    transport.get<string[]>('/map/hotspot-region', { regionCode: region }).then(
      list => ({ region, list, limited: false }),
      (err: unknown) => ({ region, list: [] as string[], limited: isRateLimitError(err) }),
    ),
  ))
  const ids = new Set<string>()
  const limited: string[] = []
  for (const a of answers) {
    for (const id of a.list) ids.add(id)
    if (a.limited) limited.push(a.region)
  }
  return { ids, limited }
}

/** Fetch + union the public-hotspot locIds for the user's regions. One (cached)
 *  request per region; a failing region is skipped (degrade, never throw). */
export async function buildHotspotSet(obs: ObservationEntry[]): Promise<Set<string>> {
  return (await askRegions(regionsFromObservations(obs))).ids
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
// A re-ask round that adds ids bumps the SAME epoch, so it is a change epoch rather than
// only an invalidation one: the mounted tabs reload (a cache hit on the merged Set, no
// request) and the links appear without a key or file save.
let _epoch = 0
const _subscribers = new Set<() => void>()

// The re-ask schedule's state (see the module header). _buildGen identifies the build the
// cached promise belongs to; _retryTimer is the one pending round, if any (rounds run one
// after another and a superseded build never arms one, so there is never a second).
let _buildGen = 0
let _retryTimer: ReturnType<typeof setTimeout> | null = null

/** Current change epoch — useSyncExternalStore snapshot for useHotspotSet. */
export function getHotspotSetEpoch(): number {
  return _epoch
}

/** Subscribe to changes (invalidation, or a re-ask that added ids); returns an
 *  unsubscribe. */
export function subscribeHotspotSet(cb: () => void): () => void {
  _subscribers.add(cb)
  return () => { _subscribers.delete(cb) }
}

function announce(): void {
  _epoch++
  for (const cb of _subscribers) cb()
}

/** Retire the current build's re-ask schedule: a pending round never asks, and a round
 *  already asking finds the generation moved when its answer lands. */
function supersedeRetries(): void {
  _buildGen++
  if (_retryTimer !== null) {
    clearTimeout(_retryTimer)
    _retryTimer = null
  }
}

/** Drop the cached Set and notify subscribers to rebuild. Call when the eBird file OR
 *  key changes (the two things that can make the cached classification stale). Also
 *  cancels any pending re-ask of a rate-limited region. */
export function invalidateHotspotSet(): void {
  supersedeRetries()
  _key = ''
  _promise = null
  announce()
}

function armRetry(gen: number, base: Set<string>, limited: string[], round: number): void {
  if (round > HOTSPOT_RETRY_ROUNDS) return
  _retryTimer = setTimeout(() => {
    _retryTimer = null
    // Discarded on purpose: retryRound cannot reject today. askRegions absorbs every
    // request failure through `.then(ok, err)`; transport.get's synchronous part cannot
    // throw on a code that passed REGION_RE (ASCII only, so encodeURIComponent cannot
    // raise); both transports resolve an array or reject; and the only subscriber
    // announce() calls is useSyncExternalStore's, which only schedules a render. If a
    // future change made it reject (a transport resolving a non-iterable body, say), or a
    // request never settled, the result is an unhandled rejection or a stalled round and
    // the schedule STOPS: the next round is armed only after this one completes, so it
    // can never loop.
    void retryRound(gen, base, limited, round)
  }, hotspotRetryDelayMs(round))
}

async function retryRound(gen: number, base: Set<string>, limited: string[], round: number): Promise<void> {
  const { ids, limited: still } = await askRegions(limited)
  // Superseded while asking: this answer belongs to an older build and never lands.
  if (gen !== _buildGen) return
  const merged = new Set(base)
  for (const id of ids) merged.add(id)
  if (merged.size > base.size) {
    _promise = Promise.resolve(merged)
    announce()
  }
  if (still.length > 0) armRetry(gen, merged, still, round + 1)
}

async function buildAndArm(regions: string[], gen: number): Promise<Set<string>> {
  const { ids, limited } = await askRegions(regions)
  if (gen === _buildGen && limited.length > 0) armRetry(gen, ids, limited, 1)
  return ids
}

export function getHotspotSet(obs: ObservationEntry[]): Promise<Set<string>> {
  const regions = regionsFromObservations(obs)
  const key = regions.join(',')
  if (key !== _key || _promise === null) {
    supersedeRetries()
    _key = key
    _promise = key ? buildAndArm(regions, _buildGen) : Promise.resolve(new Set<string>())
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

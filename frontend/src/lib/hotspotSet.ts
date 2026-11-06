// Public-hotspot determination. An eBird location is either a PUBLIC HOTSPOT (it has
// an ebird.org/hotspot page worth linking to) or a PERSONAL location (no public page:
// a link there 404s). The eBird CSV export carries NO hotspot flag, so we classify by
// membership in a region-scoped Set of hotspot locIds, built from eBird's
// ref/hotspot/{region} endpoint: one fetch per distinct region the user has data in
// (the backup's subnational1 `stateProvince` code, e.g. "US-CA"), typically 1 to 3
// regions, NOT one per location. Membership is then an O(1) test reused on every
// location-name surface. No key or a failed region fetch leaves that region's hotspots
// absent, so those locations read as personal (plain text), never a speculative link.
//
// PERSISTED PER REGION (hotspot-share-stat, schema.md section 10). A region's answer is
// stored by `lib/hotspotRegionCache.ts` after its first successful lookup, for 30 days,
// so a later launch whose regions all hold an entry asks eBird NOTHING, online or
// offline, and a replaced backup asks only about a region it newly introduces. A build
// of the Set runs in two phases plus an optional refresh:
//
//   phase 1   the local read: every region with a stored entry (fresh or past its
//             TTL) joins the Set and reads ANSWERED before any request. No announce.
//   phase 2   the first ask of the regions with no entry, exactly the old build over a
//             shorter list. The build's promise resolves here (or at phase 1 when
//             nothing is missing), with the snapshot already replaced. No announce.
//   refresh   one request per region whose entry is past the TTL, started after the
//             build resolves, skipped when `navigator.onLine` is false. A landing that
//             changes a list replaces the Set and announces once; a failure or a 429
//             leaves the stored list (and the ANSWERED state) in place.
//
// Classification can lag reality (a hotspot promoted or demoted since its region was
// last fetched) by up to the TTL; the share bar and the links read the same Set, so
// they lag together.
//
// THE RESOLUTION SNAPSHOT. Beside the Set the module keeps one immutable snapshot of
// the current build (`getHotspotResolution`): the region list, each region's state
// (pending, answered, unanswered) and the Set itself, replaced whole and written
// BEFORE the promise resolves or a round announces, so a consumer that re-renders on
// either reads the settled state. A region is ANSWERED exactly when the build holds a
// list for it, so a refresh in flight, failed or rate limited never leaves that state.
//
// ONE EXCEPTION, asked again (hotspot-links-retry-after-429): a region whose lookup ran
// out of the gate's 429 retries is not answered, because eBird never said the region
// has no hotspots, and a 429 is never stored. The schedule below is this module's own
// pass-scale layer on top of the shared gate (lib/ebirdGate.ts), whose policy it does
// not touch:
//
//   which     only the regions whose answer was a 429 after the gate's retries: a first
//             ask in phase 2, or a refresh. A region that answered is never re-asked
//             within a build, and offline, a 5xx, or a missing or bad key keep the
//             plain behaviour above (a key or file save re-arms them).
//   rounds    HOTSPOT_RETRY_ROUNDS (3). Round k starts hotspotRetryDelayMs(k) after the
//             previous attempt ended: 1, 2, then 4 minutes, so about 7 minutes in all.
//   requests  per round, one transport.get per still-limited region, which the gate
//             turns into at most 1 + ACTIVITY_RATE_LIMIT_RETRIES (3) requests. A region
//             costs at most one attempt per build (its first ask, or its refresh when
//             due) plus the rounds, so at most 3 + 9 requests per region per build;
//             once the rounds are spent a never-answered region stays plain and a
//             refreshed one keeps its stored list.
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
// that started under an older build never merges into a newer one. An invalidation also
// abandons the store's in-flight requests, so a request made under the old key is never
// joined by the rebuild and never persists.

import { transport } from './transport'
import { loadEbirdObservations } from './observationsCache'
import { isRateLimitError } from './rateLimit'
import {
  dedupedFetch, peekRegion, ensureLoaded as ensureRegionStoreLoaded, abandonInflight,
  isRegionEntryDue, HOTSPOT_REGION_CODE_RE,
} from './hotspotRegionCache'
import type { ObservationEntry } from '../types'

const LOC_ID_RE = /^L\d+$/
// eBird region code: country "US", subnational1 "US-CA", subnational2 "US-CA-037".
// Single-sourced with the store's key validator.
const REGION_RE = HOTSPOT_REGION_CODE_RE

/** True iff `code` is a region code this module would ask about (the REGION_RE shape
 *  test). Exported so the share classification and regionsFromObservations agree by
 *  construction on what "an askable region code" is. */
export function isAskableRegionCode(code: string | null | undefined): code is string {
  return typeof code === 'string' && code.length > 0 && REGION_RE.test(code)
}

/** Distinct valid region codes (subnational1, e.g. "US-CA") from the backup's
 *  stateProvince column: the regions whose hotspots we fetch. Sorted for a stable
 *  cache key. */
export function regionsFromObservations(obs: ObservationEntry[]): string[] {
  const set = new Set<string>()
  for (const o of obs) {
    const code = o.stateProvince
    if (isAskableRegionCode(code)) set.add(code)
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

/** What the module knows about one region's lookup in the CURRENT build. */
export type RegionResolution = 'pending' | 'answered' | 'unanswered'

/** One immutable snapshot of the current build: the ids known so far and each
 *  region's state. Replaced whole, never mutated, so a reference comparison is a
 *  change test (useSyncExternalStore reads it). */
export interface HotspotResolution {
  /** The build's region list (regionsFromObservations order). Empty before the
   *  first getHotspotSet call and for a backup with no askable region. */
  readonly regions: readonly string[]
  /** region code -> state, one entry per member of `regions`. */
  readonly byRegion: ReadonlyMap<string, RegionResolution>
  /** The ids known so far in this build (stored lists plus this session's
   *  answers): the SAME Set object the cached promise resolves with, or the object
   *  a later landing replaced it with (empty while nothing is known). */
  readonly set: ReadonlySet<string>
  /** Derived counts over `byRegion`, kept on the snapshot so a consumer does not
   *  iterate the map per render. */
  readonly pending: number
  readonly answered: number
  readonly unanswered: number
}

type Outcome =
  | { region: string; kind: 'answered'; ids: readonly string[] }
  | { region: string; kind: 'limited' }
  | { region: string; kind: 'failed' }

/** One pass over some regions through the store's chokepoint: a region with a stored
 *  entry costs no request unless `refresh(region)` is true and the entry is due. Every
 *  request failure is absorbed into its outcome: a 429 after the gate's retries is
 *  'limited' (retry eligible), anything else 'failed'. */
async function askRegions(regions: readonly string[], refresh: (region: string) => boolean): Promise<Outcome[]> {
  return Promise.all(regions.map(region =>
    dedupedFetch(
      region,
      () => transport.get<unknown>('/map/hotspot-region', { regionCode: region }),
      { refresh: refresh(region) },
    ).then(
      (r): Outcome => ({ region, kind: 'answered', ids: r.ids }),
      (err: unknown): Outcome => ({ region, kind: isRateLimitError(err) ? 'limited' : 'failed' }),
    ),
  ))
}

const unionOf = (lists: Iterable<readonly string[]>): Set<string> => {
  const out = new Set<string>()
  for (const list of lists) for (const id of list) out.add(id)
  return out
}

/** Fetch + union the public-hotspot locIds for the user's regions. One request per
 *  region with no stored entry; a failing region is skipped (degrade, never throw). */
export async function buildHotspotSet(obs: ObservationEntry[]): Promise<Set<string>> {
  const outcomes = await askRegions(regionsFromObservations(obs), () => false)
  return unionOf(outcomes.flatMap(o => (o.kind === 'answered' ? [o.ids] : [])))
}

/** True iff `locId` is a shape-valid eBird id present in the public-hotspot Set. */
export function isPublicHotspot(locId: string | null | undefined, set: ReadonlySet<string>): boolean {
  return !!locId && LOC_ID_RE.test(locId) && set.has(locId)
}

// Module-level cache: build the Set ONCE per loaded backup (keyed on the region list)
// and share it across every tab that asks; re-derived only when the regions change
// (a new backup). useHotspotSet is the React seam over this.
let _key = ''
let _promise: Promise<Set<string>> | null = null

// The current build's state. `_lists` holds one list per region the build has an
// answer for (stored, or fetched in this build); a region's ANSWERED state is exactly
// `_lists.has(region)`. `_unanswered` holds the regions whose first-ever lookup failed
// (or ran out of rounds). Every other region of `_regions` is pending.
let _regions: readonly string[] = []
let _lists = new Map<string, readonly string[]>()
let _unanswered = new Set<string>()

const EMPTY: ReadonlySet<string> = new Set<string>()
const EMPTY_RESOLUTION: HotspotResolution = Object.freeze({
  regions: [], byRegion: new Map(), set: EMPTY, pending: 0, answered: 0, unanswered: 0,
})
let _resolution: HotspotResolution = EMPTY_RESOLUTION

/** Replace the snapshot (silently: announcing is the caller's decision). */
function publish(set: ReadonlySet<string>): void {
  const byRegion = new Map<string, RegionResolution>()
  let pending = 0
  let answered = 0
  let unanswered = 0
  for (const r of _regions) {
    const state: RegionResolution = _lists.has(r) ? 'answered' : _unanswered.has(r) ? 'unanswered' : 'pending'
    byRegion.set(r, state)
    if (state === 'answered') answered += 1
    else if (state === 'unanswered') unanswered += 1
    else pending += 1
  }
  _resolution = Object.freeze({ regions: _regions, byRegion, set, pending, answered, unanswered })
}

/** Current snapshot. Stable reference until the module replaces it. */
export function getHotspotResolution(): HotspotResolution {
  return _resolution
}

// Invalidation signal. The cache keys on the backup's REGION list, which doesn't change
// when the user later adds/fixes their eBird key (so a Set built empty for lack of a key
// would otherwise stay empty all session) and a same-region backup swap keeps the same
// key. So the React seam SUBSCRIBES to an epoch that the cache-clearing points (eBird
// file save AND key save, in Settings) bump via invalidateHotspotSet, forcing a rebuild
// + a re-load on every mounted tab without per-tab version threading. (A persistent tab's
// useHotspotSet effect is otherwise mount-only, so it never picks up a mid-session change.)
// A re-ask round or a refresh that changes what a consumer reads (adds or replaces a
// list, or settles a region) bumps the SAME epoch, so it is a change epoch rather than
// only an invalidation one: the mounted tabs reload (a cache hit on the merged Set, no
// request) and the links appear without a key or file save. The build's own settle
// (phases 1 and 2) never bumps it: the hook's own load resolves then.
let _epoch = 0
const _subscribers = new Set<() => void>()

// The re-ask schedule's state (see the module header). _buildGen identifies the build the
// cached promise belongs to; _retryTimer is the one pending round, if any; _retryQueue
// is what that round will ask; _retryRound is the round it will run. Rounds run one
// after another (the next is armed only after the previous lands) and a superseded
// build never arms one, so there is never a second timer.
let _buildGen = 0
let _retryTimer: ReturnType<typeof setTimeout> | null = null
let _retryQueue = new Set<string>()
let _retryRound = 1
let _roundInFlight = false

/** Current change epoch: useSyncExternalStore snapshot for useHotspotSet. */
export function getHotspotSetEpoch(): number {
  return _epoch
}

/** Subscribe to changes (invalidation, or a round or refresh that changed the Set or
 *  a region's state); returns an unsubscribe. */
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
  _retryQueue = new Set()
  _retryRound = 1
  _roundInFlight = false
}

/** Start a new build's state for `regions`: nothing known, every region pending. */
function resetBuildState(regions: readonly string[]): void {
  _regions = regions
  _lists = new Map()
  _unanswered = new Set()
  publish(EMPTY)
}

/** Drop the cached Set and notify subscribers to rebuild. Call when the eBird file OR
 *  key changes (the two things that can make the cached classification stale). Also
 *  cancels any pending re-ask of a rate-limited region and abandons the store's
 *  in-flight requests. It does NOT purge the stored answers: a key save, a file save
 *  and an iCloud arrival are replaces, and the rebuild reads every stored region from
 *  its first read of the document with no request. */
export function invalidateHotspotSet(): void {
  supersedeRetries()
  abandonInflight()
  _key = ''
  _promise = null
  resetBuildState(_regions)
  announce()
}

/** Queue limited regions for the next round, arming it if nothing is scheduled. */
function queueRetry(gen: number, regions: readonly string[]): void {
  for (const r of regions) _retryQueue.add(r)
  if (_retryTimer === null && !_roundInFlight) armRetry(gen)
}

function armRetry(gen: number): void {
  if (_retryQueue.size === 0) return
  const round = _retryRound
  if (round > HOTSPOT_RETRY_ROUNDS) {
    // Only reachable for a refresh whose 429 landed after the final round had already
    // started: it keeps its stored list and is tried again at the next build.
    _retryQueue = new Set()
    return
  }
  _retryTimer = setTimeout(() => {
    _retryTimer = null
    // Discarded on purpose: retryRound cannot reject today. askRegions absorbs every
    // request failure through `.then(ok, err)`, a body that is not a list included (the
    // store rejects it); transport.get's synchronous part cannot throw on a code that
    // passed REGION_RE (ASCII only, so encodeURIComponent cannot raise); and the only
    // subscriber announce() calls is useSyncExternalStore's, which only schedules a
    // render. If a future change made it reject, or a request never settled, the
    // result is an unhandled rejection or a stalled round and the schedule STOPS: the
    // next round is armed only after this one completes, so it can never loop.
    void retryRound(gen, round)
  }, hotspotRetryDelayMs(round))
}

/** Apply a landing's outcomes to the build state; returns whether anything a consumer
 *  reads changed. `lastRound` decides whether a still-limited never-answered region
 *  becomes unanswered; `limitedOut` collects the regions still eligible. */
function applyOutcomes(outcomes: readonly Outcome[], lastRound: boolean, limitedOut: string[]): { changed: boolean; listsChanged: boolean } {
  let changed = false
  let listsChanged = false
  for (const o of outcomes) {
    if (o.kind === 'answered') {
      const prev = _lists.get(o.region)
      if (!prev) {
        _lists.set(o.region, o.ids)
        _unanswered.delete(o.region)
        changed = true
        if (o.ids.length > 0) listsChanged = true
      } else if (!sameIds(prev, o.ids)) {
        _lists.set(o.region, o.ids)
        changed = true
        listsChanged = true
      }
    } else if (o.kind === 'limited') {
      if (!lastRound) limitedOut.push(o.region)
      else if (!_lists.has(o.region) && !_unanswered.has(o.region)) { _unanswered.add(o.region); changed = true }
    } else if (!_lists.has(o.region) && !_unanswered.has(o.region)) {
      _unanswered.add(o.region)
      changed = true
    }
  }
  return { changed, listsChanged }
}

/** Two id lists hold the same members (eBird's answer order is not a change). Sorted
 *  copies, O(n log n) in a list the store's per-region bound caps. */
function sameIds(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false
  const x = [...a].sort()
  const y = [...b].sort()
  for (let i = 0; i < x.length; i += 1) if (x[i] !== y[i]) return false
  return true
}

/** After a landing that changed something: rebuild the union, replace the snapshot,
 *  THEN replace the cached promise and announce (snapshot first, so every reload reads
 *  the settled state). */
function landChange(listsChanged: boolean): void {
  const set = listsChanged ? unionOf(_lists.values()) : (_resolution.set as Set<string>)
  publish(set)
  _promise = Promise.resolve(set as Set<string>)
  announce()
}

async function retryRound(gen: number, round: number): Promise<void> {
  const regions = [..._retryQueue]
  _retryQueue = new Set()
  _roundInFlight = true
  // A region the build holds a list for is a refresh retry (its entry is due); any
  // other is a first-ever ask.
  const outcomes = await askRegions(regions, r => _lists.has(r))
  // Superseded while asking: this answer belongs to an older build and never lands.
  if (gen !== _buildGen) return
  _roundInFlight = false
  const still: string[] = []
  const { changed, listsChanged } = applyOutcomes(outcomes, round + 1 > HOTSPOT_RETRY_ROUNDS, still)
  if (changed) landChange(listsChanged)
  _retryRound = round + 1
  if (still.length > 0) queueRetry(gen, still)
  else armRetry(gen) // a refresh 429 queued while this round was asking
}

/** The refresh of every region whose stored entry is past its TTL: one request each,
 *  started after the build resolves, never on a timer of its own. */
async function refreshRound(gen: number, due: readonly string[]): Promise<void> {
  const outcomes = await askRegions(due, () => true)
  if (gen !== _buildGen) return
  const still: string[] = []
  const { changed, listsChanged } = applyOutcomes(outcomes, false, still)
  if (changed) landChange(listsChanged)
  if (still.length > 0) queueRetry(gen, still)
}

/** `navigator.onLine` is a HINT, never a gate on a user-visible request (the house
 *  posture in useOnline.ts). It gates only the optional background refresh of an
 *  answer the user already has, where skipping costs nothing visible and saves a
 *  request that would fail at the socket. First-ever asks never consult it. */
function offlineHint(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

async function buildAndArm(regions: readonly string[], gen: number): Promise<Set<string>> {
  // Phase 1: the local read (one disk read per session, a mirror hit thereafter).
  await ensureRegionStoreLoaded()
  const now = Date.now()
  const stored = new Map<string, readonly string[]>()
  const due: string[] = []
  for (const r of regions) {
    const entry = peekRegion(r)
    if (!entry) continue
    stored.set(r, entry.ids)
    if (isRegionEntryDue(entry, now)) due.push(r)
  }
  if (gen === _buildGen) {
    _lists = new Map(stored)
    publish(unionOf(_lists.values()))
  }
  // Phase 2: the first ask of the regions with no entry. A superseded build still asks
  // (as the build before persistence always did) but touches no module state and arms
  // nothing; its promise was already replaced.
  const missing = regions.filter(r => !stored.has(r))
  const outcomes = missing.length > 0 ? await askRegions(missing, () => false) : []
  if (gen !== _buildGen) {
    return unionOf([...stored.values(), ...outcomes.flatMap(o => (o.kind === 'answered' ? [o.ids] : []))])
  }
  const limited: string[] = []
  applyOutcomes(outcomes, false, limited)
  const set = unionOf(_lists.values())
  publish(set)
  if (limited.length > 0) queueRetry(gen, limited)
  if (due.length > 0 && !offlineHint()) void refreshRound(gen, due)
  return set
}

export function getHotspotSet(obs: ObservationEntry[]): Promise<Set<string>> {
  const regions = regionsFromObservations(obs)
  const key = regions.join(',')
  if (key !== _key || _promise === null) {
    supersedeRetries()
    _key = key
    resetBuildState(regions)
    _promise = key ? buildAndArm(regions, _buildGen) : Promise.resolve(new Set<string>())
  }
  return _promise
}

/** Parameterless seam for tabs that don't already hold the parsed backup: load it
 *  (from the shared observationsCache: no re-read/re-parse if a tab already did) and
 *  build/return the region-keyed hotspot Set. No file returns an empty Set (everything
 *  reads as personal). The stored document's one read overlaps the backup parse; both
 *  are local. This is what useHotspotSet drives, so any tab can ask for the Set with a
 *  single top-level hook call. */
export async function loadHotspotSet(): Promise<Set<string>> {
  const [loaded] = await Promise.all([loadEbirdObservations(), ensureRegionStoreLoaded()])
  if (!loaded) return new Set<string>()
  return getHotspotSet(loaded.observations)
}

// The day-obs pass of an iCloud check (icloud-bar-chart-sync, schema.md
// section 8; D1 and D8 at the copy review). The Targets tab's day-by-day eBird
// answers sync as ONE SNAPSHOT PER DEVICE, merged on read: each device uploads
// only its own local document to `day-obs/<deviceId>.json` and merges every
// OTHER device's snapshot into its own store. No device writes a document
// another device writes, so there is no conflict, no compare-and-swap and no
// write-back loop; a device's snapshot changes only when its own store does,
// so two devices reach a fixed point within two checks each (the PRD's single
// merged copy could not: once the union outgrew one device's budget, the two
// would exchange a 10 MB write on every check forever).
//
// It has no row and no state text of its own (FR-28): its only visible effect
// is the Targets tab showing days already checked without asking eBird, and
// nothing in it notifies `filesChanged` or the bar-chart epoch (the tab picks
// merged days up through `loadAll()` on its next sweep seed).
//
// A device with NO eBird backup does not merge (the pull half is skipped): the
// day cache is keyed on counties in the backup, so a device whose backup a
// synced clear has just removed, and whose cache that clear purged, never
// re-populates from its peers, which keeps "clearing your eBird backup also
// removes the day-by-day reports" true on the device that cleared.

import type { FileOrigin } from '../storage'
import { DEVICE_ID_RE, SHA256_RE, validateDayObsRecord } from './icloudRecord'
import type { ICloudNativeLayer, NativeListedItem, SyncItemRef } from './icloudNativeTypes'
import { ICloudNativeError, toICloudError } from './icloudNativeTypes'
import { setICloudState } from './icloudState'

/** The record's display filename: the local document's own name. */
export const DAY_OBS_FILENAME = 'county-day-obs.json'

/** The persisted day-obs half of the `icloud-sync` preference (schema.md section 7). */
export interface DayObsPref {
  /** The digest of this device's snapshot as last pushed (null: none in iCloud). */
  lastPushedSha256: string | null
  /** Per peer device: the digest of the snapshot last merged, so an unchanged
   *  snapshot is never downloaded again. */
  peers: Record<string, string>
  /** iCloud held at least one device's snapshot at the last listing (the
   *  Remove confirmation's day-answers line). */
  anyShared?: boolean
}

export function emptyDayObsPref(): DayObsPref {
  return { lastPushedSha256: null, peers: Object.create(null) as Record<string, string>, anyShared: false }
}

/** The persisted field, one shape check each; a bad value is dropped, never thrown on. */
export function normalizeDayObsPref(raw: unknown): DayObsPref | undefined {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined
  const r = raw as Record<string, unknown>
  const out = emptyDayObsPref()
  if (typeof r.lastPushedSha256 === 'string' && SHA256_RE.test(r.lastPushedSha256)) out.lastPushedSha256 = r.lastPushedSha256
  const peers = r.peers
  if (typeof peers === 'object' && peers !== null && !Array.isArray(peers)) {
    const p = peers as Record<string, unknown>
    for (const id of Object.keys(p)) {
      if (!DEVICE_ID_RE.test(id) || !Object.hasOwn(p, id)) continue
      const v = p[id]
      if (typeof v === 'string' && SHA256_RE.test(v)) out.peers[id] = v
    }
  }
  out.anyShared = r.anyShared === true
  return out
}

export interface DayObsPassContext {
  native: ICloudNativeLayer
  /** The live preference; the pass rewrites `dayObs` in place. */
  pref: { dayObs?: DayObsPref }
  deviceId: string
  now: () => number
  log: (message: string) => void
  thisDevice: () => FileOrigin
  raceTimeout: <T>(p: Promise<T>, ms: number) => Promise<T>
  /** `countyDayObsCache.mergeSharedSnapshot`, injected. `gen` is REQUIRED: the
   *  generation read by `purgeGeneration` before the download (security L1). */
  mergeSnapshot: (text: string, gen: number) => Promise<{ admitted: number; changed: boolean }>
  /** `countyDayObsCache.dayObsPurgeGeneration`, injected: read at the fetch
   *  chokepoint, before any request, never after the answer lands. */
  purgeGeneration: () => number
  /** `countyDayObsCache.awaitDayObsWrites`, injected. */
  awaitWrites: () => Promise<void>
  /** Whether this device holds an eBird backup right now (read after the file pass). */
  hasBackup: () => Promise<boolean>
}

const snapshotItem = (deviceId: string): SyncItemRef => ({ kind: 'day-obs', deviceId })

/** Publish whether iCloud holds any snapshot, from the preference. */
export function publishSharedDayObs(pref: { dayObs?: DayObsPref }): void {
  setICloudState({ sharedDayObsExists: pref.dayObs?.anyShared === true })
}

/**
 * The day-obs pass. Resolves with whether the check must report failure
 * (iCloud stopped answering inside it). `transferred` is true when a peer's
 * snapshot changed this device's store or this device's snapshot went up.
 * `pending` is true when a peer's record could not be read yet or its
 * snapshot's download was started, so the controller re-reads shortly, as it
 * does for the county pass (device pass on 1.0.40.2, decisions.md entry 18).
 */
export async function runDayObsPass(
  ctx: DayObsPassContext,
  remaining: () => number,
): Promise<{ transferred: boolean; failed: boolean; pending: boolean }> {
  const state = ctx.pref.dayObs ?? emptyDayObsPref()
  ctx.pref.dayObs = state
  let transferred = false
  let pending = false
  // The purge generation, captured BEFORE the listing, the backup check and
  // every download (the fetch-chokepoint rule, CLAUDE.md v1.0.14; security
  // L1). A Clear that lands anywhere in this pass moves it, so no peer text
  // downloaded across it is merged, and the push half below is skipped.
  const gen = ctx.purgeGeneration()

  // One listing: the pull half reads peers from it, and the push half needs
  // this device's own record (a snapshot some device removed must go up again).
  let items: NativeListedItem[]
  try {
    if (remaining() <= 0) throw new ICloudNativeError('timeout')
    const listed = await ctx.raceTimeout(ctx.native.listItems('day-obs'), remaining())
    // The day-obs directory is in iCloud but not here yet (decisions.md entry
    // 19): nothing was read, and a push now would create a second directory of
    // the same name. Nothing is decided; the follow-up re-read comes shortly.
    if (listed.pending) return { transferred: false, failed: false, pending: true }
    items = listed.items.filter(it => DEVICE_ID_RE.test(it.id))
  } catch (raw) {
    const err = toICloudError(raw)
    return { transferred: false, failed: err.code === 'timeout' || err.code === 'unavailable', pending: false }
  }
  const nowMs = ctx.now()
  state.anyShared = items.some(it => it.present)

  // ── Pull half: merge every OTHER device's snapshot, when this device has a backup.
  if (await ctx.hasBackup()) {
    const seen = new Set<string>()
    for (const it of items) {
      if (it.id === ctx.deviceId) continue
      seen.add(it.id)
      if (!it.present) continue
      if (it.record === null) { pending = true; continue } // a record not read yet
      const v = validateDayObsRecord(it.record, it.id, nowMs)
      if (!v.ok || v.record.state !== 'file') {
        ctx.log(`icloud: day-obs record rejected (${v.ok ? 'state' : v.reason}); treating it as absent`)
        continue
      }
      const rec = v.record
      if (Object.hasOwn(state.peers, it.id) && state.peers[it.id] === rec.sha256) continue // merged already
      if (!it.file.present) continue
      if (!it.file.downloaded) {
        // Merged on a later check once it lands; there is no view to spend a wait on (FR-28).
        try { await ctx.native.startDownloadItem(snapshotItem(it.id)) } catch { /* next check */ }
        pending = true
        continue
      }
      let text: string
      try {
        const r = await ctx.native.pullItem(snapshotItem(it.id), rec.sha256, rec.byteLength, 'text')
        if (typeof r.text !== 'string') continue
        text = r.text
      } catch (raw) {
        const err = toICloudError(raw)
        if (err.code === 'timeout' || err.code === 'unavailable') return { transferred, failed: true, pending }
        continue // a mismatch or a vanished file: the peer is left for the next check
      }
      const merged = await ctx.mergeSnapshot(text, gen)
      if (merged.changed) transferred = true
      // The digest names what was READ: an unparseable snapshot is treated as
      // absent for merging AND recorded, so it is not downloaded again until
      // that peer writes a new one (FR-26).
      state.peers[it.id] = rec.sha256
    }
    // Peers no longer in iCloud are forgotten.
    for (const id of Object.keys(state.peers)) if (!seen.has(id)) delete state.peers[id]
  }

  // ── Push half: this device's own snapshot, after the writer has drained.
  await ctx.awaitWrites()
  if (ctx.purgeGeneration() !== gen) {
    // A Clear landed during the pass. It owns the iCloud half (it removes
    // every device's snapshot and resets the preference this pass captured as
    // `state`), so nothing is pushed or removed here; a snapshot the Clear
    // could not remove goes at the next check, which finds no local document.
    publishSharedDayObs(ctx.pref)
    return { transferred, failed: false, pending }
  }
  const own = items.find(it => it.id === ctx.deviceId)
  let ownSha: string | null = null
  if (own?.present && own.record !== null) {
    const v = validateDayObsRecord(own.record, ctx.deviceId, nowMs)
    if (v.ok && v.record.state === 'file') ownSha = v.record.sha256
  }
  // Skip the write only when iCloud still holds exactly what this device last
  // pushed; a snapshot another device removed goes up again.
  const unless = ownSha !== null && ownSha === state.lastPushedSha256 ? ownSha : null
  try {
    const r = await ctx.native.pushItem(snapshotItem(ctx.deviceId), DAY_OBS_FILENAME, new Date(ctx.now()).toISOString(), ctx.thisDevice(), unless)
    if (!r.skipped) transferred = true
    state.lastPushedSha256 = r.sha256
    state.anyShared = true
  } catch (raw) {
    const err = toICloudError(raw)
    if (err.code === 'local-missing') {
      // No local document (never populated, or purged by a clear): this
      // device's snapshot, if iCloud holds one, goes too.
      if (own?.present || state.lastPushedSha256 !== null) {
        try {
          await ctx.native.removeItem(snapshotItem(ctx.deviceId))
          state.lastPushedSha256 = null
          state.anyShared = items.some(it => it.present && it.id !== ctx.deviceId)
        } catch (rawRemove) {
          const e2 = toICloudError(rawRemove)
          if (e2.code === 'timeout' || e2.code === 'unavailable') return { transferred, failed: true, pending }
        }
      }
    } else if (err.code === 'timeout' || err.code === 'unavailable') {
      return { transferred, failed: true, pending }
    } else {
      ctx.log(`icloud: day-obs snapshot not pushed (${err.code})`)
    }
  }
  publishSharedDayObs(ctx.pref)
  return { transferred, failed: false, pending }
}

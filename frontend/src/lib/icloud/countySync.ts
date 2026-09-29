// The county pass of an iCloud check (icloud-bar-chart-sync, schema.md
// section 5). A county's eBird bar-chart file is a third synced KIND beside
// the two data files, never a third slot: `SLOTS`, `FileSlot`, `readMeta` and
// every `{ ebird, ml }` literal are untouched. Each county is decided by the
// SHIPPED reconciliation table (`reconcileSlot`, verbatim) over that county's
// manifest entry and its shared record, so no county's outcome depends on
// another county's or on the two data files' (FR-03 by construction).
//
// WHAT THE PASS DOES, per check (after the file pass, before the day-obs pass):
//   1. read the manifest; a rejection (UNKNOWN) skips the pass and keeps every
//      county's view;
//   2. ONE listing of every county record in the container (NFR-02: work
//      proportional to N, one IPC call that performs N bounded reads);
//   3. finish remembered cleared markers first (FR-11);
//   4. decide and apply each county, sorted; downloads share ONE bounded wait;
//   5. publish the views and the shared county set.
//
// NO QUOTA (FR-09). Nothing here counts, caps, budgets or evicts the county
// set: the only bound is the finite space of county codes, and the native
// listing's hostile-container bound (`MAX_LISTED_ITEMS`), which no real user
// reaches and which is logged, never shown.
//
// CHANGE SIGNALS (FR-06). An arrival, a replacement and a removal notify the
// bar-chart epoch through `notifyBarCharts` (self-notifying, so no further
// check is triggered) and NEVER the data-files epoch: the widget hand-over and
// the eight tabs keyed on `filesChanged` have no interest in a county file.

import type { BarChartFileMeta, BarChartFilesStatus, FileOrigin, StorageAdapter } from '../storage'
import { isRegionCode } from '../regionCode'
import type { ICloudNativeLayer, NativeListedItem, SyncItemRef } from './icloudNativeTypes'
import { ICloudNativeError, toICloudError } from './icloudNativeTypes'
import {
  MAX_FILENAME, isPlausibleTime, isWritableTime, recordTimeMs, sanitizeFilename, validateCountyRecord,
  type SharedRecord,
} from './icloudRecord'
import { reconcileSlot, type SlotDecision } from './icloudReconcile'
import { getICloudState, setBarChartView, setICloudState, type SlotView } from './icloudState'
import { reasonFor } from './icloudCopy'

/** The persisted county half of the `icloud-sync` preference (schema.md section 7). */
export interface CountyPrefFields {
  /** Every county whose shared record was a FILE at the last successful listing. */
  knownSharedCounties?: Record<string, { filename: string }>
  /** A county cleared locally whose marker has not reached iCloud: code -> clearedAt. */
  pendingCountyClears?: Record<string, string>
}

/** How many cleared markers one native call writes, so one call stays well
 *  inside the 8 s command budget whatever the size of a clear-all. */
export const CLEAR_BATCH = 64

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * The county fields of a persisted preference, one shape check each: keys
 * through the region-code predicate (which also keeps `__proto__` and every
 * other inherited name out), values through their own bound; anything else is
 * dropped, never thrown on. Null-prototype accumulators (security.md, the
 * write side of the lookup-table rule).
 */
export function normalizeCountyPrefFields(raw: Record<string, unknown>, nowMs: number): CountyPrefFields {
  const out: CountyPrefFields = {}
  const known = raw.knownSharedCounties
  if (isPlainObject(known)) {
    const k: Record<string, { filename: string }> = Object.create(null)
    for (const code of Object.keys(known)) {
      if (!isRegionCode(code) || !Object.hasOwn(known, code)) continue
      const v = known[code]
      if (isPlainObject(v) && typeof v.filename === 'string' && v.filename.length <= MAX_FILENAME) k[code] = { filename: v.filename }
    }
    out.knownSharedCounties = k
  }
  const pending = raw.pendingCountyClears
  if (isPlainObject(pending)) {
    const p: Record<string, string> = Object.create(null)
    for (const code of Object.keys(pending)) {
      if (!isRegionCode(code) || !Object.hasOwn(pending, code)) continue
      const v = pending[code]
      if (isPlausibleTime(v, nowMs)) p[code] = v
    }
    if (Object.keys(p).length > 0) out.pendingCountyClears = p
  }
  return out
}

/** What the pass needs from the controller; everything native is behind `native`. */
export interface CountyPassContext {
  native: ICloudNativeLayer
  storage: Pick<StorageAdapter, 'getBarChartFiles' | 'applySyncedBarChartFile' | 'applySyncedBarChartClear' | 'stampBarChartOrigin'>
  /** The live preference object; the pass mutates its county fields in place. */
  pref: CountyPrefFields
  deviceId: string
  now: () => number
  log: (message: string) => void
  /** This device as a record may carry it (sanitized to the validator's bounds). */
  thisDevice: () => FileOrigin
  /** A manifest origin as a record may carry it. */
  recordOrigin: (origin: FileOrigin) => FileOrigin
  /** Bump the bar-chart epoch as the controller (self-notifying). */
  notifyBarCharts: () => void
  raceTimeout: <T>(p: Promise<T>, ms: number) => Promise<T>
  checkWaitMs: number
  downloadPollMs: number
}

const item = (county: string): SyncItemRef => ({ kind: 'barchart', county })

function isoNow(now: () => number): string {
  return new Date(now()).toISOString()
}

/** The provenance half of a view, from a manifest entry: this device when the origin is ours or missing. */
function originView(meta: BarChartFileMeta | null, deviceId: string): Pick<SlotView, 'fromThisDevice' | 'origin'> {
  const o = meta?.origin
  if (!o) return { fromThisDevice: true }
  return { fromThisDevice: o.deviceId === deviceId, origin: { label: o.label, platform: o.platform } }
}

function recordView(record: SharedRecord, deviceId: string): Pick<SlotView, 'fromThisDevice' | 'origin'> {
  return { fromThisDevice: record.origin.deviceId === deviceId, origin: { label: record.origin.label, platform: record.origin.platform } }
}

function errorView(code: string, err: ICloudNativeError, base: Partial<SlotView>): void {
  setBarChartView(code, { fromThisDevice: false, ...base, state: 'error', reason: reasonFor(err.code) })
}

/** `meta` as the manifest holds it, read through `Object.hasOwn`. */
function entryOf(manifest: BarChartFilesStatus, code: string): BarChartFileMeta | null {
  return Object.hasOwn(manifest.counties, code) ? manifest.counties[code] : null
}

/** Publish the shared county set (and whether any shared file exists) from the preference. */
export function publishSharedCounties(pref: CountyPrefFields): void {
  const codes = Object.keys(pref.knownSharedCounties ?? {}).sort()
  setICloudState({ sharedCountyCodes: codes })
}

/** Write cleared markers for `codes` in bounded batches. Resolves with the
 *  codes whose marker did NOT land (a per-county failure, or a whole batch
 *  that could not reach iCloud). Never rejects. */
export async function pushCleared(
  native: ICloudNativeLayer,
  codes: readonly string[],
  clearedAt: string,
  origin: FileOrigin,
): Promise<{ failed: Set<string>; unreachable: boolean }> {
  const failed = new Set<string>()
  let unreachable = false
  for (let i = 0; i < codes.length; i += CLEAR_BATCH) {
    const batch = codes.slice(i, i + CLEAR_BATCH)
    try {
      const r = await native.pushItemsCleared([...batch], clearedAt, origin)
      for (const c of r.failed) failed.add(c)
    } catch (raw) {
      const err = toICloudError(raw)
      if (err.code === 'timeout' || err.code === 'unavailable') unreachable = true
      for (const c of batch) failed.add(c)
    }
  }
  return { failed, unreachable }
}

/**
 * Wait, bounded by ATTEMPTS (budget / poll interval, never a clock read), for
 * any of `codes` to finish downloading. Resolves with the ones that did.
 */
export async function awaitCountiesDownloaded(
  ctx: Pick<CountyPassContext, 'native' | 'downloadPollMs'>,
  codes: ReadonlySet<string>,
  budgetMs: number,
): Promise<Map<string, NativeListedItem>> {
  const landed = new Map<string, NativeListedItem>()
  if (codes.size === 0) return landed
  const attempts = Math.max(1, Math.ceil(budgetMs / ctx.downloadPollMs))
  for (let i = 0; i < attempts; i++) {
    let listed
    try {
      listed = await ctx.native.listItems('barchart')
    } catch {
      return landed
    }
    for (const it of listed.items) {
      if (codes.has(it.id) && !landed.has(it.id) && it.file.present && it.file.downloaded) landed.set(it.id, it)
    }
    if (landed.size === codes.size) return landed
    if (i < attempts - 1) await new Promise<void>((resolve) => setTimeout(resolve, ctx.downloadPollMs))
  }
  return landed
}

/**
 * Pull one county's shared file through the guarded seam link. `true` when it
 * landed. A first arrival stamps no `replacedBySyncAt`; only a real replacement
 * does, so FR-17's "Replaced by" line never shows for a file that replaced
 * nothing (the deliberate difference from the slot pull).
 */
async function pullCounty(
  ctx: CountyPassContext,
  code: string,
  meta: BarChartFileMeta | null,
  record: SharedRecord & { state: 'file' },
): Promise<boolean> {
  const base: SlotView = { state: 'downloading', ...recordView(record, ctx.deviceId), uploadedAt: record.uploadedAt }
  setBarChartView(code, base)
  const entry: BarChartFileMeta = {
    filename: record.filename,
    uploadedAt: record.uploadedAt,
    origin: { deviceId: record.origin.deviceId, label: record.origin.label, platform: record.origin.platform },
  }
  if (meta) entry.replacedBySyncAt = isoNow(ctx.now)
  try {
    const applied = await ctx.storage.applySyncedBarChartFile(code, entry, meta?.uploadedAt ?? null, async () => {
      await ctx.native.pullItem(item(code), record.sha256, record.byteLength, 'file')
    })
    // A user add or remove landed during the download: the user wins, and the
    // next check (already queued by the bar-chart epoch) pushes it.
    if (!applied) return false
    ctx.notifyBarCharts()
    setBarChartView(code, meta
      ? { ...base, state: 'up-to-date', replacedAt: record.uploadedAt }
      : { state: 'up-to-date', ...recordView(record, ctx.deviceId) })
    return true
  } catch (raw) {
    const err = toICloudError(raw)
    if (err.code === 'not-downloaded') setBarChartView(code, { ...base, state: 'in-icloud-not-downloaded' })
    else errorView(code, err, base)
    return false
  }
}

/**
 * Push one county's local file. The record carries the manifest's time when
 * the writers' time check accepts it, else the time of this check (FR-04: an
 * adopted file is uploaded, never skipped), and the manifest is then stamped
 * to match, so the next check reads `none` rather than pulling the device's
 * own file back.
 */
async function pushCounty(ctx: CountyPassContext, code: string, meta: BarChartFileMeta): Promise<string | null> {
  const nowMs = ctx.now()
  const uploadedAt = isWritableTime(meta.uploadedAt, nowMs) ? meta.uploadedAt : new Date(nowMs).toISOString()
  const origin = ctx.recordOrigin(meta.origin ?? ctx.thisDevice())
  const filename = sanitizeFilename(meta.filename)
  const base: SlotView = {
    state: 'uploading',
    fromThisDevice: origin.deviceId === ctx.deviceId,
    origin: { label: origin.label, platform: origin.platform },
  }
  setBarChartView(code, base)
  try {
    const result = await ctx.native.pushItem(item(code), filename, uploadedAt, origin, null)
    if (!meta.origin || uploadedAt !== meta.uploadedAt) {
      try {
        await ctx.storage.stampBarChartOrigin(code, origin, uploadedAt, meta.uploadedAt)
      } catch { /* the next push stamps it */ }
    }
    setBarChartView(code, { ...base, state: result.uploaded === false ? 'waiting-to-upload' : 'up-to-date' })
    return filename
  } catch (raw) {
    // Every refusal reads "Could not sync" with its reason and Retry, and the
    // next check pushes again (device pass on 1.0.40.1, decisions.md entry
    // 17). "Waiting to upload" means the file is in the local container for
    // the daemon to send, which a refused write is not: the push writes only
    // locally, so offline it SUCCEEDS with `uploaded: false`, and a native
    // `unavailable` or `timeout` here is a write that did not land (or did
    // not land in time), which the old mapping showed as waiting on every
    // check, forever. The listing answered this check, so a timeout here is
    // the NFR-04 "answered once, then out of budget" case, not FR-05's offline.
    errorView(code, toICloudError(raw), base)
    return null
  }
}

/**
 * The county pass. `remaining` is the check's own deadline (the reads that
 * decide it share the check's budget; transfers are never raced). Resolves
 * with whether anything transferred and whether the check must report failure
 * (the listing could not reach iCloud: the file pass's own rule).
 */
export async function runCountyPass(
  ctx: CountyPassContext,
  remaining: () => number,
): Promise<{ transferred: boolean; failed: boolean }> {
  const none = { transferred: false, failed: false }

  // 1. The manifest. UNKNOWN is never EMPTY: a rejected read skips the pass.
  let manifest: BarChartFilesStatus
  try {
    manifest = await ctx.storage.getBarChartFiles()
  } catch (e) {
    ctx.log(`icloud: bar-chart manifest unreadable; county pass skipped (${String(e)})`)
    return none
  }

  // 2. One listing.
  let listed
  try {
    if (remaining() <= 0) throw new ICloudNativeError('timeout')
    listed = await ctx.raceTimeout(ctx.native.listItems('barchart'), remaining())
  } catch (raw) {
    const err = toICloudError(raw)
    const timeout = err.code === 'timeout' || err.code === 'unavailable'
    for (const code of Object.keys(manifest.counties)) {
      const meta = entryOf(manifest, code)
      if (!meta) continue
      const ours = !meta.origin || meta.origin.deviceId === ctx.deviceId
      const known = ctx.pref.knownSharedCounties ? Object.hasOwn(ctx.pref.knownSharedCounties, code) : false
      // Only an unreachable iCloud makes an unpushed county "waiting" (schema
      // section 5, step 2); any other refusal is "Could not sync" with Retry,
      // since it would otherwise repeat silently on every check while the
      // check itself reported success (device pass on 1.0.40.1).
      if (timeout && ours && !known) setBarChartView(code, { state: 'waiting-to-upload', ...originView(meta, ctx.deviceId) })
      else errorView(code, timeout ? new ICloudNativeError('timeout') : err, originView(meta, ctx.deviceId))
    }
    return { transferred: false, failed: timeout }
  }
  if (listed.truncated) ctx.log('icloud: county listing reached its bound; the rest are ignored this check')

  const shared = new Map<string, NativeListedItem>()
  for (const it of listed.items) if (isRegionCode(it.id)) shared.set(it.id, it)
  const nowMs = ctx.now()
  const records = new Map<string, SharedRecord | null>()
  const recordFor = (code: string): SharedRecord | null => {
    if (records.has(code)) return records.get(code) ?? null
    const it = shared.get(code)
    let rec: SharedRecord | null = null
    if (it?.record != null) {
      const v = validateCountyRecord(it.record, code, nowMs)
      if (v.ok) rec = v.record
      else if (it.record !== null) ctx.log(`icloud: county record ${code} rejected (${v.reason}); treating it as absent`)
    }
    records.set(code, rec)
    return rec
  }
  const undownloadedRecord = (code: string) => {
    const it = shared.get(code)
    return it !== undefined && it.present && it.record === null
  }

  let transferred = false

  // 3. Remembered clears (FR-11): finished unless a newer shared file has
  //    appeared since (the newer file wins and the memo is dropped), or the
  //    marker already landed (the same clear, or a newer one).
  const pending = ctx.pref.pendingCountyClears ?? {}
  const byTime = new Map<string, string[]>()
  for (const code of Object.keys(pending)) {
    if (undownloadedRecord(code)) continue // not read yet: keep the memo for a later check
    const clearedAt = pending[code]
    const memoAt = Date.parse(clearedAt)
    const rec = recordFor(code)
    if (rec && recordTimeMs(rec) > memoAt) { delete pending[code]; continue } // newer event wins
    if (rec?.state === 'cleared' && recordTimeMs(rec) === memoAt) { delete pending[code]; continue } // already there
    const group = byTime.get(clearedAt)
    if (group) group.push(code)
    else byTime.set(clearedAt, [code])
  }
  for (const [clearedAt, codes] of byTime) {
    const { failed, unreachable } = await pushCleared(ctx.native, codes, clearedAt, ctx.thisDevice())
    for (const code of codes) {
      if (failed.has(code)) continue
      delete pending[code]
      records.set(code, { version: 1, slot: 'barchart', county: code, state: 'cleared', clearedAt, origin: ctx.thisDevice() })
      transferred = true
    }
    if (unreachable) {
      ctx.pref.pendingCountyClears = pending
      return { transferred, failed: true }
    }
  }
  ctx.pref.pendingCountyClears = Object.keys(pending).length > 0 ? pending : undefined

  // 4. Decide and apply, one county at a time, in a deterministic order.
  const union = new Set<string>(Object.keys(manifest.counties))
  for (const code of shared.keys()) union.add(code)
  const codes = [...union].sort()
  const downloads = new Map<string, { meta: BarChartFileMeta | null; record: SharedRecord & { state: 'file' } }>()
  // Counties this pass pushed: shared now, although the listing predates them.
  const pushed = new Map<string, string>()
  for (const code of codes) {
    const meta = entryOf(manifest, code)
    if (undownloadedRecord(code)) {
      // A peer's record this device has not read: never treated as absent.
      if (meta) setBarChartView(code, { state: 'downloading', ...originView(meta, ctx.deviceId) })
      continue
    }
    const record = recordFor(code)
    let local = null
    if (meta) {
      const t = Date.parse(meta.uploadedAt)
      if (!Number.isFinite(t)) {
        // A corrupt local entry: keep the local copy and touch nothing.
        setBarChartView(code, { state: 'up-to-date', fromThisDevice: true })
        continue
      }
      local = { uploadedAt: t, originId: meta.origin?.deviceId ?? null }
    }
    const file = shared.get(code)?.file
    const decision: SlotDecision = reconcileSlot({
      local,
      shared: record,
      file: { downloaded: file?.downloaded ?? false, downloading: file?.downloading ?? false },
      deviceId: ctx.deviceId,
    })
    switch (decision.action) {
      case 'none': {
        if (meta && record?.state === 'file') {
          setBarChartView(code, {
            state: file?.uploaded === false ? 'waiting-to-upload' : 'up-to-date',
            fromThisDevice: record.origin.deviceId === ctx.deviceId || meta.origin === undefined,
            origin: { label: record.origin.label, platform: record.origin.platform },
            // The replaced line names the file's own upload time, which is the
            // shared record's (equal times: this is the file that replaced).
            ...(meta.replacedBySyncAt ? { replacedAt: meta.uploadedAt } : {}),
          })
        } else {
          setBarChartView(code, null)
        }
        break
      }
      case 'push': {
        const filename = meta ? await pushCounty(ctx, code, meta) : null
        if (filename !== null) {
          pushed.set(code, filename)
          transferred = true
        }
        break
      }
      case 'pull':
        if (record?.state === 'file' && await pullCounty(ctx, code, meta, record)) transferred = true
        break
      case 'download': {
        if (record?.state !== 'file') break
        setBarChartView(code, { state: 'downloading', ...recordView(record, ctx.deviceId), uploadedAt: record.uploadedAt })
        try {
          await ctx.native.startDownloadItem(item(code))
        } catch { /* the wait below tells us either way */ }
        downloads.set(code, { meta, record })
        break
      }
      case 'delete-local': {
        if (!meta) break
        const applied = await ctx.storage.applySyncedBarChartClear(code, meta.uploadedAt)
        if (!applied) break
        ctx.notifyBarCharts()
        setBarChartView(code, null)
        transferred = true
        break
      }
    }
  }

  // Every county needing a download shares ONE bounded wait (the shipped
  // per-slot wait, never multiplied by the number of counties).
  if (downloads.size > 0) {
    const landed = await awaitCountiesDownloaded(ctx, new Set(downloads.keys()), Math.max(0, Math.min(ctx.checkWaitMs, remaining())))
    for (const [code, d] of downloads) {
      if (landed.has(code)) {
        if (await pullCounty(ctx, code, d.meta, d.record)) transferred = true
      } else {
        // FR-08: keep the local file (or none), say a newer file exists, offer Download now.
        setBarChartView(code, { state: 'in-icloud-not-downloaded', ...recordView(d.record, ctx.deviceId), uploadedAt: d.record.uploadedAt })
      }
    }
  }

  // 5. The shared county set, from the listing (a county whose record this
  //    device has not read keeps what it was last known to be).
  const known: Record<string, { filename: string }> = Object.create(null)
  const before = ctx.pref.knownSharedCounties
  for (const code of shared.keys()) {
    if (undownloadedRecord(code)) {
      if (before && Object.hasOwn(before, code)) known[code] = before[code]
      continue
    }
    const rec = recordFor(code)
    if (rec?.state === 'file') known[code] = { filename: rec.filename }
  }
  for (const [code, filename] of pushed) known[code] = { filename }
  ctx.pref.knownSharedCounties = known
  // Views of counties that are neither local nor in iCloud any more go.
  const views = getICloudState().barCharts
  for (const code of Object.keys(views)) if (!union.has(code)) setBarChartView(code, null)
  publishSharedCounties(ctx.pref)
  return { transferred, failed: false }
}

/** Every county with a local file reads "iCloud unavailable" (availability is not 'available'). */
export async function markCountiesUnavailable(
  storage: Pick<StorageAdapter, 'getBarChartFiles'>,
  deviceId: string,
): Promise<void> {
  let manifest: BarChartFilesStatus
  try {
    manifest = await storage.getBarChartFiles()
  } catch {
    return
  }
  for (const code of Object.keys(manifest.counties)) {
    const meta = entryOf(manifest, code)
    if (meta) setBarChartView(code, { state: 'unavailable', ...originView(meta, deviceId) })
  }
}

// The iCloud Sync controller (icloud-sync; schema.md "Frontend modules and
// seams"). Dynamic-imported by App.tsx after first paint, only on macOS/iOS
// (showICloudSync), so nothing here is on the entry chunk and nothing here
// ever runs on Windows, web or Pi.
//
// What it owns:
// - the per-device preference (`settings.json` key 'icloud-sync': enabled,
//   the random device id minted on first enable, the last successful check,
//   and the last-known shared files so a relaunch with sync off still knows
//   whether iCloud holds copies); it never syncs (FR-10);
// - ONE check at a time with ONE queued follow-up (FR-20): triggers are boot,
//   enable, foreground/focus, the native change and identity events
//   (debounced), a five-minute poll while visible, Check now, Download now,
//   Retry, and a local file save;
// - applying each slot's decision through the storage seam's chained links,
//   running exactly the cache invalidations Settings runs today, and
//   notifying the file epoch so every tab re-enters its loading phase;
// - publishing everything Settings renders through icloudState.ts.
//
// Everything native is behind the ICloudNativeLayer interface, and every
// other dependency is injectable, so the controller is tested with a fake
// native layer and the real reconcile/validator modules.

import type { StorageAdapter, FileMetadata, FileOrigin, FilesStatus } from '../storage'
import type { ICloudNativeLayer, NativeAvailability } from './icloudNativeTypes'
import { ICloudNativeError, toICloudError } from './icloudNativeTypes'
import {
  DEVICE_ID_RE, PLATFORMS, SLOTS, sanitizeFilename, sanitizeLabel, validateSharedRecord,
  type SharedRecord, type Slot,
} from './icloudRecord'
import { reconcileSlot, type SlotDecision } from './icloudReconcile'
import {
  getICloudState,
  installICloudActions,
  setICloudState,
  setSlotView,
  type CheckOutcome,
  type ICloudActions,
  type SlotView,
} from './icloudState'
import { reasonFor } from './icloudCopy'

export const ICLOUD_SYNC_SETTING = 'icloud-sync'
export const POLL_INTERVAL_MS = 5 * 60_000
export const EVENT_DEBOUNCE_MS = 500
/** How long a check waits for a download it just started before moving on. */
export const CHECK_DOWNLOAD_WAIT_MS = 5_000
/** How long Download now waits before handing the row back with Download now. */
export const DOWNLOAD_NOW_WAIT_MS = 90_000
export const DOWNLOAD_POLL_MS = 1_000
/** NFR-04: one overall budget per check for the reads that decide it (the
    status probe, the two record reads, and the in-check download wait). A
    transfer already under way is never cut short: a raced pull could leave
    the csv and its metadata disagreeing, so pushes and pulls keep only the
    native per-command timeout. */
export const CHECK_DEADLINE_MS = 10_000

type KnownShared = Record<Slot, { filename: string } | null>

export interface ICloudSyncPref {
  version: 1
  enabled: boolean
  deviceId: string | null
  lastCheckAt: string | null
  /** last-known shared files (so "Sync off" and Remove render after a relaunch with sync off) */
  knownShared?: KnownShared
  /** a synced clear whose marker has not reached iCloud yet (see clearWithSync) */
  pendingClears?: Partial<Record<Slot, string>>
}

export interface ControllerDeps {
  native: ICloudNativeLayer
  storage: Pick<
    StorageAdapter,
    'getSetting' | 'setSetting' | 'getFilesStatus' | 'deleteFile' | 'applySyncedFile' | 'applySyncedClear' | 'stampFileOrigin'
  >
  /** the cache invalidations Settings runs for this slot today */
  invalidate: (slot: Slot) => void
  notifyFilesChanged: () => void
  subscribeFilesChanged: (cb: () => void) => () => void
  now: () => number
  mintDeviceId: () => string
  /** the window/document to hang foreground, focus and visibility listeners on; null in node */
  view: (Window & typeof globalThis) | null
  log: (message: string) => void
  /** timers, overridable for tests */
  pollIntervalMs?: number
  eventDebounceMs?: number
  checkDownloadWaitMs?: number
  downloadNowWaitMs?: number
  downloadPollMs?: number
  checkDeadlineMs?: number
}

export interface ICloudController extends ICloudActions {
  boot(): Promise<void>
  requestCheck(reason: string): Promise<CheckOutcome>
  dispose(): void
  /** number of checks that actually ran (tests: FR-20 bound) */
  readonly checksRun: number
}

function isoNow(now: () => number): string {
  return new Date(now()).toISOString()
}

function normalizePref(raw: unknown): ICloudSyncPref {
  const pref: ICloudSyncPref = { version: 1, enabled: false, deviceId: null, lastCheckAt: null }
  if (typeof raw !== 'object' || raw === null) return pref
  const r = raw as Record<string, unknown>
  pref.enabled = r.enabled === true
  pref.deviceId = typeof r.deviceId === 'string' && DEVICE_ID_RE.test(r.deviceId) ? r.deviceId : null
  pref.lastCheckAt =
    typeof r.lastCheckAt === 'string' && Number.isFinite(Date.parse(r.lastCheckAt)) ? r.lastCheckAt : null
  const ks = r.knownShared
  if (typeof ks === 'object' && ks !== null) {
    const k = ks as Record<string, unknown>
    const pick = (slot: Slot) => {
      const v = k[slot]
      if (typeof v === 'object' && v !== null && typeof (v as { filename?: unknown }).filename === 'string') {
        return { filename: (v as { filename: string }).filename }
      }
      return null
    }
    pref.knownShared = { ebird: pick('ebird'), ml: pick('ml') }
  }
  const pc = r.pendingClears
  if (typeof pc === 'object' && pc !== null) {
    const p = pc as Record<string, unknown>
    const out: Partial<Record<Slot, string>> = {}
    for (const slot of SLOTS) {
      const v = p[slot]
      if (typeof v === 'string' && Number.isFinite(Date.parse(v))) out[slot] = v
    }
    if (Object.keys(out).length > 0) pref.pendingClears = out
  }
  return pref
}

export function mintDeviceId(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  let hex = ''
  for (const b of bytes) hex += b.toString(16).padStart(2, '0')
  return hex
}

export function createICloudController(deps: ControllerDeps): ICloudController {
  const pollMs = deps.pollIntervalMs ?? POLL_INTERVAL_MS
  const debounceMs = deps.eventDebounceMs ?? EVENT_DEBOUNCE_MS
  const checkWaitMs = deps.checkDownloadWaitMs ?? CHECK_DOWNLOAD_WAIT_MS
  const downloadWaitMs = deps.downloadNowWaitMs ?? DOWNLOAD_NOW_WAIT_MS
  const downloadPollMs = deps.downloadPollMs ?? DOWNLOAD_POLL_MS
  const checkDeadlineMs = deps.checkDeadlineMs ?? CHECK_DEADLINE_MS

  let pref: ICloudSyncPref = { version: 1, enabled: false, deviceId: null, lastCheckAt: null }
  let shared: KnownShared = { ebird: null, ml: null }
  let inFlight: Promise<CheckOutcome> | null = null
  let queued = false
  let checksRun = 0
  let selfNotifying = false
  let disposed = false
  const detach: Array<() => void> = []
  let pollTimer: ReturnType<typeof setInterval> | null = null
  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  // ── preference ─────────────────────────────────────────────────────────

  async function loadPref(): Promise<void> {
    try {
      pref = normalizePref(await deps.storage.getSetting<unknown>(ICLOUD_SYNC_SETTING))
    } catch {
      pref = { version: 1, enabled: false, deviceId: null, lastCheckAt: null }
    }
    if (pref.knownShared) shared = { ...pref.knownShared }
  }

  async function savePref(): Promise<void> {
    pref.knownShared = { ...shared }
    try {
      await deps.storage.setSetting(ICLOUD_SYNC_SETTING, pref)
    } catch (e) {
      deps.log(`icloud: could not save the sync preference: ${String(e)}`)
    }
  }

  function platformWord(platform: string | null): string {
    return platform === 'ipad' ? 'iPad' : platform === 'iphone' ? 'iPhone' : 'Mac'
  }

  function thisDevice(): FileOrigin {
    const s = getICloudState()
    return {
      deviceId: pref.deviceId ?? '',
      label: sanitizeLabel(s.deviceLabel, platformWord(s.platform)),
      platform: s.platform ?? 'mac',
    }
  }

  /** The origin as it may be written into a record: sanitized to the validator's bounds. */
  function recordOrigin(origin: FileOrigin): FileOrigin {
    return {
      deviceId: origin.deviceId,
      label: sanitizeLabel(origin.label, platformWord(origin.platform)),
      platform: PLATFORMS.includes(origin.platform) ? origin.platform : 'mac',
    }
  }

  function publishShared(): void {
    const names = SLOTS.map((s) => shared[s]?.filename).filter((n): n is string => typeof n === 'string')
    setICloudState({ sharedExists: names.length > 0, sharedFilenames: names })
  }

  function notifyFiles(): void {
    selfNotifying = true
    try {
      deps.notifyFilesChanged()
    } finally {
      selfNotifying = false
    }
  }

  // ── availability ───────────────────────────────────────────────────────

  async function probe(): Promise<NativeAvailability> {
    try {
      const s = await deps.native.status()
      setICloudState({ availability: s.state, deviceLabel: s.deviceLabel, platform: s.platform })
      return s.state
    } catch {
      // The command is missing (a stale binary) or threw: the honest state
      // is that this build cannot use iCloud.
      setICloudState({ availability: 'build-cannot-use-icloud' })
      return 'build-cannot-use-icloud'
    }
  }

  function originView(meta: FileMetadata | null): Pick<SlotView, 'fromThisDevice' | 'origin'> {
    const o = meta?.origin
    if (!o) return { fromThisDevice: true }
    return {
      fromThisDevice: o.deviceId === pref.deviceId,
      origin: { label: o.label, platform: o.platform },
    }
  }

  async function markUnavailable(): Promise<void> {
    let files: FilesStatus = { ebird: null, ml: null }
    try {
      files = await deps.storage.getFilesStatus()
    } catch { /* keep empty */ }
    for (const slot of SLOTS) {
      const meta = files[slot]
      if (meta || shared[slot]) {
        setSlotView(slot, { state: 'unavailable', ...originView(meta) })
      } else {
        setSlotView(slot, null)
      }
    }
  }

  // ── the check ──────────────────────────────────────────────────────────

  function errorView(slot: Slot, err: ICloudNativeError, base: Partial<SlotView>): void {
    setSlotView(slot, { fromThisDevice: false, ...base, state: 'error', reason: reasonFor(err.code) })
  }

  /** Reject with 'timeout' after `ms` if `p` has not settled; `p` itself is not
      cancelled (only read-only native calls are raced this way). */
  function raceTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const t = setTimeout(() => reject(new ICloudNativeError('timeout')), Math.max(0, ms))
      p.then(
        (v) => { clearTimeout(t); resolve(v) },
        (e) => { clearTimeout(t); reject(e) },
      )
    })
  }

  // Bounded by ATTEMPTS (budget / poll interval), not by reading a clock, so
  // the bound holds whatever the injected clock does.
  async function awaitDownloaded(slot: Slot, budgetMs: number): Promise<boolean> {
    const attempts = Math.max(1, Math.ceil(budgetMs / downloadPollMs))
    for (let i = 0; i < attempts; i++) {
      try {
        const r = await deps.native.readRecord(slot)
        if (!r.file.present) return false
        if (r.file.downloaded) return true
      } catch {
        return false
      }
      if (i < attempts - 1) await new Promise<void>((resolve) => setTimeout(resolve, downloadPollMs))
    }
    return false
  }

  async function pullShared(slot: Slot, meta: FileMetadata | null, record: SharedRecord & { state: 'file' }): Promise<boolean> {
    const view: SlotView = {
      state: 'downloading',
      fromThisDevice: record.origin.deviceId === pref.deviceId,
      origin: { label: record.origin.label, platform: record.origin.platform },
      uploadedAt: record.uploadedAt,
    }
    setSlotView(slot, view)
    const entry: FileMetadata = {
      filename: record.filename,
      uploadedAt: record.uploadedAt,
      origin: { deviceId: record.origin.deviceId, label: record.origin.label, platform: record.origin.platform },
      replacedBySyncAt: isoNow(deps.now),
    }
    try {
      const applied = await deps.storage.applySyncedFile(slot, entry, meta?.uploadedAt ?? null, () =>
        deps.native.pull(slot, record.sha256, record.byteLength),
      )
      if (!applied) {
        // A user upload landed during the download: the user wins, and the
        // next check (already queued by the file epoch) pushes it.
        return false
      }
      deps.invalidate(slot)
      notifyFiles()
      setSlotView(slot, { ...view, state: 'up-to-date', replacedAt: record.uploadedAt })
      return true
    } catch (raw) {
      const err = toICloudError(raw)
      if (err.code === 'not-downloaded') {
        setSlotView(slot, { ...view, state: 'in-icloud-not-downloaded' })
      } else {
        errorView(slot, err, view)
      }
      return false
    }
  }

  async function pushLocal(slot: Slot, meta: FileMetadata): Promise<boolean> {
    // FR-11/FR-19: the record names the file's origin. A file this device
    // pulled from a peer keeps that peer as its origin when it is pushed
    // again (after a Remove, say); a file the user uploaded here is ours.
    const origin: FileOrigin = recordOrigin(meta.origin ?? thisDevice())
    // A filename from the file picker may carry what the validator refuses
    // (APFS allows control characters); write what every reader accepts.
    const filename = sanitizeFilename(meta.filename)
    const base: SlotView = {
      state: 'uploading',
      fromThisDevice: origin.deviceId === pref.deviceId,
      origin: { label: origin.label, platform: origin.platform },
      replacedAt: meta.replacedBySyncAt,
    }
    setSlotView(slot, base)
    try {
      const result = await deps.native.push(slot, filename, meta.uploadedAt, origin)
      shared[slot] = { filename }
      if (!meta.origin) {
        try {
          await deps.storage.stampFileOrigin(slot, origin, meta.uploadedAt)
        } catch { /* the next push stamps it */ }
      }
      // FR-05 (QA round 1): the push landed in the LOCAL container; it is in
      // iCloud only once the daemon has uploaded it. Until the native status
      // says so (re-read on the next trigger), the row waits.
      setSlotView(slot, { ...base, state: result.uploaded === false ? 'waiting-to-upload' : 'up-to-date' })
      return true
    } catch (raw) {
      const err = toICloudError(raw)
      if (err.code === 'timeout' || err.code === 'unavailable') {
        // FR-05: applied locally already; reaches iCloud when the connection returns.
        setSlotView(slot, { ...base, state: 'waiting-to-upload' })
      } else {
        errorView(slot, err, base)
      }
      return false
    }
  }

  async function applyDecision(
    slot: Slot,
    decision: SlotDecision,
    meta: FileMetadata | null,
    record: SharedRecord | null,
    uploaded: boolean,
    budgetMs: number,
  ): Promise<boolean> {
    switch (decision.action) {
      case 'none': {
        if (meta && record?.state === 'file') {
          setSlotView(slot, {
            // Identical on both sides, but a copy this device pushed while
            // offline may still be waiting for the daemon (FR-05).
            state: uploaded ? 'up-to-date' : 'waiting-to-upload',
            fromThisDevice: record.origin.deviceId === pref.deviceId || meta.origin === undefined,
            origin: { label: record.origin.label, platform: record.origin.platform },
            replacedAt: meta.replacedBySyncAt,
          })
        } else {
          setSlotView(slot, null)
        }
        return false
      }
      case 'push':
        return meta ? pushLocal(slot, meta) : false
      case 'pull':
        return record?.state === 'file' ? pullShared(slot, meta, record) : false
      case 'download': {
        if (record?.state !== 'file') return false
        setSlotView(slot, {
          state: 'downloading',
          fromThisDevice: record.origin.deviceId === pref.deviceId,
          origin: { label: record.origin.label, platform: record.origin.platform },
          uploadedAt: record.uploadedAt,
        })
        try {
          await deps.native.startDownload(slot)
        } catch { /* the status poll below tells us either way */ }
        // The in-check wait never runs past the check's own budget.
        if (await awaitDownloaded(slot, Math.max(0, Math.min(checkWaitMs, budgetMs)))) {
          return pullShared(slot, meta, record)
        }
        // FR-27/FR-28: keep the local copy, say a newer file exists, offer Download now.
        setSlotView(slot, {
          state: 'in-icloud-not-downloaded',
          fromThisDevice: record.origin.deviceId === pref.deviceId,
          origin: { label: record.origin.label, platform: record.origin.platform },
          uploadedAt: record.uploadedAt,
        })
        return false
      }
      case 'delete-local': {
        if (!meta) return false
        const applied = await deps.storage.applySyncedClear(slot, meta.uploadedAt)
        if (!applied) return false
        deps.invalidate(slot)
        notifyFiles()
        setSlotView(slot, null)
        return true
      }
    }
  }

  async function runCheck(): Promise<CheckOutcome> {
    checksRun += 1
    setICloudState({ checking: true })
    const failed: CheckOutcome = { ok: false, transferred: false, at: pref.lastCheckAt }
    // NFR-04: one 10 s budget for the reads of this check. Wall-clock from
    // the injectable clock; a read that would start past the deadline, or
    // that outlives it, is a timeout for the slots not yet decided.
    const deadline = deps.now() + checkDeadlineMs
    const remaining = () => deadline - deps.now()
    try {
      const availability = await probe()
      if (availability !== 'available') {
        await markUnavailable()
        return failed
      }
      const files = await deps.storage.getFilesStatus()
      let transferred = false
      let decidedFirst = false
      for (const slot of SLOTS) {
        const meta = files[slot]
        let read
        try {
          if (remaining() <= 0) throw new ICloudNativeError('timeout')
          read = await raceTimeout(deps.native.readRecord(slot), remaining())
        } catch (raw) {
          const err = toICloudError(raw)
          if (err.code === 'timeout' || err.code === 'unavailable') {
            if (!decidedFirst) {
              // Offline or iCloud not answering at all: keep every row's
              // last state and the last check time (FR-05).
              setICloudState({ checkFailed: true })
              return failed
            }
            // iCloud answered once and then ran past the check's budget:
            // the undecided rows say so and offer Retry (NFR-04).
            for (const rest of SLOTS.slice(SLOTS.indexOf(slot))) {
              if (files[rest] || shared[rest]) errorView(rest, new ICloudNativeError('timeout'), originView(files[rest]))
            }
            setICloudState({ checkFailed: true })
            return failed
          }
          errorView(slot, err, originView(meta))
          continue
        }
        decidedFirst = true
        const verdict = validateSharedRecord(read.record, slot, deps.now())
        if (!verdict.ok && read.record !== null) {
          deps.log(`icloud: ${slot} record rejected (${verdict.reason}); treating it as absent`)
        }
        let record: SharedRecord | null = verdict.ok ? verdict.record : null

        // A synced clear whose marker never reached iCloud (clearWithSync
        // failed at the push): finish it now unless a newer shared file has
        // appeared since, in which case the newer file wins and the memo is
        // dropped (latest event wins, FR-31).
        const pendingClear = pref.pendingClears?.[slot]
        if (pendingClear) {
          const sharedAt = record ? Date.parse(record.state === 'file' ? record.uploadedAt : record.clearedAt) : -Infinity
          if (sharedAt <= Date.parse(pendingClear)) {
            try {
              await deps.native.pushCleared(slot, pendingClear, thisDevice())
              record = { version: 1, slot, state: 'cleared', clearedAt: pendingClear, origin: thisDevice() }
              transferred = true
            } catch (raw) {
              const err = toICloudError(raw)
              if (err.code === 'timeout' || err.code === 'unavailable') {
                setICloudState({ checkFailed: true })
                return failed
              }
            }
          }
          delete pref.pendingClears?.[slot]
        }

        shared[slot] = record?.state === 'file' ? { filename: record.filename } : null

        let local = null
        if (meta) {
          const t = Date.parse(meta.uploadedAt)
          if (!Number.isFinite(t)) {
            // A corrupt local entry: keep the local copy and touch nothing.
            setSlotView(slot, { state: 'up-to-date', fromThisDevice: true })
            continue
          }
          local = { uploadedAt: t, originId: meta.origin?.deviceId ?? null }
        }
        const decision = reconcileSlot({
          local,
          shared: record,
          file: { downloaded: read.file.downloaded, downloading: read.file.downloading },
          deviceId: pref.deviceId ?? '',
        })
        // An older native layer (or a harness) that does not report the flag
        // is read as uploaded, so a missing field can never trap a row.
        const uploaded = read.file.uploaded !== false
        if (await applyDecision(slot, decision, meta, record, uploaded, remaining())) transferred = true
      }
      pref.lastCheckAt = isoNow(deps.now)
      await savePref()
      publishShared()
      setICloudState({ lastCheckAt: pref.lastCheckAt, checkFailed: false })
      return { ok: true, transferred, at: pref.lastCheckAt }
    } catch (e) {
      deps.log(`icloud: check failed: ${String(e)}`)
      setICloudState({ checkFailed: true })
      return failed
    } finally {
      setICloudState({ checking: false })
    }
  }

  function requestCheck(reason: string): Promise<CheckOutcome> {
    void reason
    if (disposed || !pref.enabled) {
      return Promise.resolve({ ok: false, transferred: false, at: pref.lastCheckAt })
    }
    if (inFlight) {
      // FR-20: one follow-up, never a pile. Callers that arrive during a check
      // get the in-flight check's outcome; the follow-up runs after it.
      queued = true
      return inFlight
    }
    inFlight = runCheck().finally(() => {
      inFlight = null
      if (queued) {
        queued = false
        void requestCheck('queued follow-up')
      }
    })
    return inFlight
  }

  // ── triggers ───────────────────────────────────────────────────────────

  function scheduleDebounced(): void {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      debounceTimer = null
      void requestCheck('native event')
    }, debounceMs)
  }

  function startWatching(): void {
    stopWatching()
    void deps.native.watch(true).catch((e) => deps.log(`icloud: watch failed: ${String(e)}`))
    void deps.native
      .onChanged(() => scheduleDebounced())
      .then((un) => detach.push(un))
      .catch(() => {})
    void deps.native
      .onIdentityChanged(() => {
        void probe().then((a) => {
          if (a === 'available') void requestCheck('identity changed')
        })
      })
      .then((un) => detach.push(un))
      .catch(() => {})
    detach.push(
      deps.subscribeFilesChanged(() => {
        if (!selfNotifying) void requestCheck('files changed')
      }),
    )
    const view = deps.view
    if (view && typeof view.addEventListener === 'function') {
      const onVisible = () => {
        if (view.document.visibilityState === 'visible') void requestCheck('foreground')
      }
      const onFocus = () => void requestCheck('focus')
      view.document.addEventListener('visibilitychange', onVisible)
      view.addEventListener('focus', onFocus)
      detach.push(() => view.document.removeEventListener('visibilitychange', onVisible))
      detach.push(() => view.removeEventListener('focus', onFocus))
    }
    pollTimer = setInterval(() => {
      if (view && view.document.visibilityState === 'hidden') return
      void requestCheck('poll')
    }, pollMs)
  }

  function stopWatching(): void {
    while (detach.length) {
      const un = detach.pop()
      try {
        un?.()
      } catch { /* ignore */ }
    }
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
    void deps.native.watch(false).catch(() => {})
  }

  // ── actions ────────────────────────────────────────────────────────────

  async function enable(): Promise<void> {
    if (!pref.deviceId) pref.deviceId = deps.mintDeviceId()
    pref.enabled = true
    await savePref()
    setICloudState({ syncEnabled: true, deviceId: pref.deviceId, checkFailed: false })
    startWatching()
    await requestCheck('enable')
  }

  async function disable(): Promise<void> {
    pref.enabled = false
    stopWatching()
    await savePref()
    // FR-32: local files untouched; rows read "Sync off" only where iCloud
    // still holds something to be off from.
    let files: FilesStatus = { ebird: null, ml: null }
    try {
      files = await deps.storage.getFilesStatus()
    } catch { /* keep empty */ }
    const anyShared = SLOTS.some((s) => shared[s] !== null)
    for (const slot of SLOTS) {
      setSlotView(slot, anyShared && (files[slot] || shared[slot]) ? { state: 'off', fromThisDevice: false } : null)
    }
    publishShared()
    setICloudState({ syncEnabled: false, checking: false })
  }

  function checkNow(): Promise<CheckOutcome> {
    return requestCheck('check now')
  }

  async function downloadNow(slot: Slot): Promise<void> {
    const current = getICloudState().slots[slot]
    setSlotView(slot, { ...(current ?? { fromThisDevice: false }), state: 'downloading' })
    try {
      await deps.native.startDownload(slot)
    } catch (raw) {
      const err = toICloudError(raw)
      if (err.code === 'absent') {
        errorView(slot, err, current ?? {})
        return
      }
    }
    await awaitDownloaded(slot, downloadWaitMs)
    await requestCheck('download now')
  }

  async function retry(slot: Slot): Promise<void> {
    const current = getICloudState().slots[slot]
    if (current) setSlotView(slot, { ...current, state: 'downloading', reason: undefined })
    await requestCheck('retry')
  }

  async function removeFromICloud(): Promise<void> {
    await deps.native.removeAll()
    shared = { ebird: null, ml: null }
    publishShared()
    await savePref()
    if (pref.enabled) {
      // The dialog says so: a device with sync on uploads its copy again at
      // its next check. Run it now so the rows tell the truth.
      await requestCheck('remove')
    } else {
      for (const slot of SLOTS) setSlotView(slot, null)
    }
  }

  async function clearWithSync(slot: Slot): Promise<void> {
    const clearedAt = isoNow(deps.now)
    await deps.storage.deleteFile(slot)
    deps.invalidate(slot)
    notifyFiles()
    setSlotView(slot, null)
    shared[slot] = null
    publishShared()
    try {
      await deps.native.pushCleared(slot, clearedAt, thisDevice())
      await savePref()
    } catch (raw) {
      // The local clear stands. Remember the marker so the next check
      // finishes the iCloud half instead of pulling the file back down.
      pref.pendingClears = { ...(pref.pendingClears ?? {}), [slot]: clearedAt }
      await savePref()
      const err = toICloudError(raw)
      setSlotView(slot, { state: 'error', fromThisDevice: true, reason: reasonFor(err.code) })
    }
  }

  function fileSaved(slot: Slot): void {
    if (!pref.enabled) return
    setSlotView(slot, { state: 'uploading', fromThisDevice: true })
    void requestCheck('file saved')
  }

  async function boot(): Promise<void> {
    await loadPref()
    setICloudState({ syncEnabled: pref.enabled, deviceId: pref.deviceId, lastCheckAt: pref.lastCheckAt })
    publishShared()
    await probe()
    if (pref.enabled) {
      startWatching()
      void requestCheck('boot')
    } else if (SLOTS.some((s) => shared[s] !== null)) {
      // Sync was on once and iCloud still held copies: say so on the rows.
      let files: FilesStatus = { ebird: null, ml: null }
      try {
        files = await deps.storage.getFilesStatus()
      } catch { /* keep empty */ }
      for (const slot of SLOTS) {
        setSlotView(slot, files[slot] || shared[slot] ? { state: 'off', fromThisDevice: false } : null)
      }
    }
  }

  function dispose(): void {
    disposed = true
    stopWatching()
    installICloudActions(null)
  }

  const controller: ICloudController = {
    boot,
    requestCheck,
    dispose,
    enable,
    disable,
    checkNow,
    downloadNow,
    retry,
    removeFromICloud,
    clearWithSync,
    fileSaved,
    get checksRun() {
      return checksRun
    },
  }
  installICloudActions(controller)
  return controller
}

let booted: Promise<void> | null = null

/**
 * Wire the real dependencies and boot once. Called from App.tsx via
 * setTimeout(0) after mount, only when showICloudSync(); nothing on the
 * launch path awaits it (FR-06).
 */
export function bootICloudSync(): Promise<void> {
  if (booted) return booted
  booted = (async () => {
    const [{ storage }, { icloudNative }, obs, ml, hs, fc] = await Promise.all([
      import('../storage'),
      import('./icloudNative'),
      import('../observationsCache'),
      import('../mlExportCache'),
      import('../hotspotSet'),
      import('../filesChanged'),
    ])
    const controller = createICloudController({
      native: icloudNative,
      storage,
      invalidate: (slot) => {
        // Exactly the set Settings.tsx runs on upload and clear today.
        if (slot === 'ebird') {
          obs.clearEbirdObservationsCache()
          hs.invalidateHotspotSet()
        }
        if (slot === 'ml') ml.clearMLExportCache()
      },
      notifyFilesChanged: fc.notifyFilesChanged,
      subscribeFilesChanged: fc.subscribeFilesChanged,
      now: () => Date.now(),
      mintDeviceId,
      view: typeof window !== 'undefined' ? window : null,
      log: (m) => console.warn(m),
    })
    await controller.boot()
  })()
  return booted
}

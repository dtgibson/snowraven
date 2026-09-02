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
// - publishing everything Settings renders through icloudState.ts;
// - the KEY pass (icloud-api-key-sync): inside the same check, after the
//   file pass, one shared key record is read at most once and written at
//   most once, each slot decided by the pure keyReconcile table and applied
//   through the storage seam's guarded api-keys links; the key switch, its
//   removal-on-disable (with a retry armed while iCloud is unreachable),
//   Clear-with-sync through a local cleared marker, and the keys epoch so a
//   received key reaches every networked feature without a relaunch.
//
// Everything native is behind the ICloudNativeLayer interface, and every
// other dependency is injectable, so the controller is tested with a fake
// native layer and the real reconcile/validator modules.

import type {
  ApiKeyEntries, ApiKeyEntry, ExpectedKeyEntry, FileMetadata, FileOrigin, FilesStatus, KeySlot, StorageAdapter,
} from '../storage'
import type { ICloudNativeLayer, KeySlotsInput, NativeAvailability } from './icloudNativeTypes'
import { ICloudNativeError, toICloudError } from './icloudNativeTypes'
import {
  DEVICE_ID_RE, PLATFORMS, SLOTS, isWritableTime, sanitizeFilename, sanitizeLabel, validateSharedRecord,
  type SharedRecord, type Slot,
} from './icloudRecord'
import { reconcileSlot, type SlotDecision } from './icloudReconcile'
import {
  KEY_SLOTS, isValidKeyValue, sanitizeKeyEntryForWrite, validateKeyRecord,
  type SharedKeyEntry, type SharedKeySlots,
} from './keyRecord'
import { reconcileKeySlot, type KeyDecision, type LocalKeyEntry } from './keyReconcile'
import {
  getICloudState,
  installICloudActions,
  setICloudState,
  setKeySlotView,
  setSlotView,
  type CheckOutcome,
  type ICloudActions,
  type KeySlotView,
  type SlotView,
} from './icloudState'
import { keyReasonFor, reasonFor } from './icloudCopy'

export const ICLOUD_SYNC_SETTING = 'icloud-sync'

/** The two write-chokepoint refusals a key row can name (KEY_REASONS in icloudCopy.ts). */
type KeyRefusal = 'key-shape' | 'key-time'
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

/** The last-known state of one slot of the key record (never a value). */
export interface KnownKeySlot {
  state: 'key' | 'cleared'
  at: string
  originId: string
}
type KnownSharedKeys = Record<KeySlot, KnownKeySlot | null>

export interface ICloudSyncPref {
  version: 1
  enabled: boolean
  deviceId: string | null
  lastCheckAt: string | null
  /** last-known shared files (so "Sync off" and Remove render after a relaunch with sync off) */
  knownShared?: KnownShared
  /** a synced clear whose marker has not reached iCloud yet (see clearWithSync) */
  pendingClears?: Partial<Record<Slot, string>>
  // ── icloud-api-key-sync (all optional; a 1.0.11 document reads as key switch off) ──
  /** the key switch; READ AS FALSE when `enabled` is false (FR-06) */
  keysEnabled?: boolean
  /** set true on the first key enable, never cleared (FR-40) */
  keysEverEnabled?: boolean
  /** a switch-off or Remove that could not reach iCloud (FR-33) */
  keyRemovalPending?: boolean
  /** iCloud is known to hold keys.record.json (FR-34, FR-36) */
  knownKeyRecord?: boolean
  /** per-slot state of the record at the last CONTENT read, so the rows are honest offline */
  knownSharedKeys?: KnownSharedKeys
}

export interface ControllerDeps {
  native: ICloudNativeLayer
  storage: Pick<
    StorageAdapter,
    | 'getSetting' | 'setSetting' | 'getFilesStatus' | 'deleteFile' | 'applySyncedFile' | 'applySyncedClear' | 'stampFileOrigin'
    | 'getApiKeyEntries' | 'clearApiKeyWithMarker' | 'applySyncedKey' | 'applySyncedKeyClear' | 'stampApiKeyEntry'
  >
  /** the cache invalidations Settings runs for this slot today */
  invalidate: (slot: Slot) => void
  notifyFilesChanged: () => void
  subscribeFilesChanged: (cb: () => void) => () => void
  /** the cache invalidations Settings runs after a key save or clear (ebird: the network cache and the hotspot set) */
  invalidateKey: (slot: KeySlot) => void
  notifyKeysChanged: () => void
  subscribeKeysChanged: (cb: () => void) => () => void
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
  // icloud-api-key-sync: one shape check per field, boolean else default.
  // A persisted key switch is read as OFF while the file switch is off (FR-06).
  pref.keysEnabled = r.keysEnabled === true && pref.enabled
  pref.keysEverEnabled = r.keysEverEnabled === true
  pref.keyRemovalPending = r.keyRemovalPending === true
  pref.knownKeyRecord = r.knownKeyRecord === true
  const ksk = r.knownSharedKeys
  if (typeof ksk === 'object' && ksk !== null) {
    const k = ksk as Record<string, unknown>
    const pickKey = (slot: KeySlot): KnownKeySlot | null => {
      const v = k[slot]
      if (typeof v !== 'object' || v === null) return null
      const { state, at, originId } = v as { state?: unknown; at?: unknown; originId?: unknown }
      if (state !== 'key' && state !== 'cleared') return null
      if (typeof at !== 'string' || !Number.isFinite(Date.parse(at))) return null
      if (typeof originId !== 'string' || !DEVICE_ID_RE.test(originId)) return null
      return { state, at, originId }
    }
    pref.knownSharedKeys = { ebird: pickKey('ebird'), openweather: pickKey('openweather') }
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
  // icloud-api-key-sync: the removal retry (FR-33) hangs its own listeners,
  // independent of startWatching (the file switch may be off after the
  // cascade, and then no checks run); one removal in flight at a time.
  const detachRemoval: Array<() => void> = []
  let removalInFlight: Promise<boolean> | null = null
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

  /** The key store fields, from the preference (icloud-api-key-sync). */
  function publishKeys(): void {
    setICloudState({
      keySyncEnabled: pref.enabled && pref.keysEnabled === true,
      keySyncEverOn: pref.keysEverEnabled === true,
      keyRecordExists: pref.knownKeyRecord === true,
      keyRemovalPending: pref.keyRemovalPending === true,
    })
  }

  function notifyFiles(): void {
    selfNotifying = true
    try {
      deps.notifyFilesChanged()
    } finally {
      selfNotifying = false
    }
  }

  function notifyKeys(): void {
    selfNotifying = true
    try {
      deps.notifyKeysChanged()
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
    await markKeysUnavailable()
  }

  // ── the key rows (icloud-api-key-sync) ─────────────────────────────────

  /** A local entry's provenance for the row: this device when the origin is ours or missing. */
  function keyOriginView(entry: ApiKeyEntry | null): Pick<KeySlotView, 'fromThisDevice' | 'origin' | 'changedAt'> {
    if (!entry) return { fromThisDevice: true }
    const o = entry.origin
    const base: Pick<KeySlotView, 'fromThisDevice' | 'origin' | 'changedAt'> = o
      ? { fromThisDevice: o.deviceId === pref.deviceId, origin: { label: o.label, platform: o.platform } }
      : { fromThisDevice: true }
    if (entry.state === 'key' && entry.changedAt) base.changedAt = entry.changedAt
    return base
  }

  /** Is this entry a change of ours that iCloud has not seen (FR-27, FR-30)? */
  function unpushedLocalChange(entry: ApiKeyEntry | null, slot: KeySlot): boolean {
    if (!entry) return false
    const ours = !entry.origin || entry.origin.deviceId === pref.deviceId
    if (!ours) return false
    const known = pref.knownSharedKeys?.[slot] ?? null
    if (entry.state === 'key') {
      if (entry.changedAt === null) return true // the seed (FR-13)
      return !known || Date.parse(entry.changedAt) > Date.parse(known.at)
    }
    return !known || Date.parse(entry.clearedAt) > Date.parse(known.at)
  }

  async function readEntries(): Promise<ApiKeyEntries> {
    try {
      return await deps.storage.getApiKeyEntries()
    } catch {
      return { ebird: null, openweather: null }
    }
  }

  /** FR-40: with the key switch off, "Sync off" only where there is something to be off from. */
  function offKeyView(entry: ApiKeyEntry | null): KeySlotView | null {
    const something = pref.keysEverEnabled === true || pref.knownKeyRecord === true
    return something && entry ? { state: 'off', fromThisDevice: false } : null
  }

  async function publishKeyRowsOff(): Promise<void> {
    const entries = await readEntries()
    for (const slot of KEY_SLOTS) setKeySlotView(slot, offKeyView(entries[slot]))
  }

  /** iCloud unavailable (FR-27): a key reads unavailable; an unpushed Clear says so (FR-30). */
  async function markKeysUnavailable(): Promise<void> {
    if (!(pref.enabled && pref.keysEnabled)) {
      await publishKeyRowsOff()
      return
    }
    const entries = await readEntries()
    for (const slot of KEY_SLOTS) {
      const entry = entries[slot]
      if (entry?.state === 'cleared' && unpushedLocalChange(entry, slot)) {
        setKeySlotView(slot, { state: 'waiting-to-upload', fromThisDevice: true, clearPending: true })
      } else if (entry?.state === 'key') {
        setKeySlotView(slot, { state: 'unavailable', ...keyOriginView(entry) })
      } else {
        setKeySlotView(slot, null)
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

  // ── the key pass (icloud-api-key-sync; schema.md "One key check, ordered") ──

  function thisDeviceLabelFallback(): string {
    return platformWord(getICloudState().platform)
  }

  function toLocal(entry: ApiKeyEntry | null): LocalKeyEntry | null {
    if (!entry) return null
    if (entry.state === 'key') {
      const t = entry.changedAt === null ? null : Date.parse(entry.changedAt)
      return { state: 'key', value: entry.value, changedAt: t === null || Number.isFinite(t) ? t : null, originId: entry.origin?.deviceId ?? null }
    }
    return { state: 'cleared', clearedAt: Date.parse(entry.clearedAt), originId: entry.origin.deviceId }
  }

  function expectOf(entry: ApiKeyEntry | null): ExpectedKeyEntry {
    if (!entry) return null
    if (entry.state === 'key') return { state: 'key', value: entry.value, changedAt: entry.changedAt }
    return { state: 'cleared', clearedAt: entry.clearedAt }
  }

  /** A local entry as a record entry, with this device standing in for a missing origin. */
  function toSharedEntry(entry: ApiKeyEntry, changedAtOverride?: string, originOverride?: FileOrigin): SharedKeyEntry {
    if (entry.state === 'key') {
      return {
        state: 'key',
        value: entry.value,
        changedAt: changedAtOverride ?? entry.changedAt ?? isoNow(deps.now),
        origin: originOverride ?? entry.origin ?? thisDevice(),
      }
    }
    return { state: 'cleared', clearedAt: entry.clearedAt, origin: entry.origin }
  }

  function keyErrorView(slot: KeySlot, entry: ApiKeyEntry | null, code: Parameters<typeof keyReasonFor>[0]): void {
    setKeySlotView(slot, { ...keyOriginView(entry), state: 'error', reason: keyReasonFor(code) })
  }

  /** Attempt the owed removal (FR-33); true when the copy is gone. Never throws. */
  async function tryRemoveKeys(): Promise<boolean> {
    if (!(pref.keyRemovalPending && pref.knownKeyRecord)) {
      if (pref.keyRemovalPending) {
        // Nothing is known to be there: there is nothing to owe.
        pref.keyRemovalPending = false
        disarmRemovalRetry()
        await savePref()
        publishKeys()
      }
      return true
    }
    if (removalInFlight) return removalInFlight
    removalInFlight = (async () => {
      try {
        await deps.native.removeKeys()
        pref.keyRemovalPending = false
        pref.knownKeyRecord = false
        pref.knownSharedKeys = undefined
        disarmRemovalRetry()
        await savePref()
        publishKeys()
        return true
      } catch (raw) {
        const err = toICloudError(raw)
        deps.log(`icloud: key removal still pending (${err.code})`)
        return false
      } finally {
        removalInFlight = null
      }
    })()
    return removalInFlight
  }

  /**
   * The key pass. Runs inside runCheck after the file pass has decided at
   * least its first slot, within the same deadline. At most one record read
   * and one record write (NFR-07). Returns whether the check as a whole must
   * report failure (a read that timed out: the file pass's own rule).
   */
  async function runKeyPass(remaining: () => number): Promise<{ transferred: boolean; failed: boolean }> {
    const none = { transferred: false, failed: false }
    // 1. Pending removal first (FR-33). Owed and unreachable: the record is
    //    not read while a removal is owed.
    if (pref.keyRemovalPending) {
      const gone = await tryRemoveKeys()
      if (!gone) {
        if (!pref.keysEnabled) await publishKeyRowsOff()
        return none
      }
    }
    // 2. Key switch off: existence only, never content, never a write (FR-03, FR-36).
    if (!pref.keysEnabled) {
      try {
        if (remaining() > 0) {
          const st = await raceTimeout(deps.native.readKeys('status'), remaining())
          pref.knownKeyRecord = st.status.present
        }
      } catch { /* keep the last-known answer */ }
      await publishKeyRowsOff()
      return none
    }
    // 3. Read: the local entries (one chained read) and the one record read.
    const entries = await readEntries()
    for (const slot of KEY_SLOTS) {
      const entry = entries[slot]
      if (entry?.state === 'key') setKeySlotView(slot, { state: 'syncing', ...keyOriginView(entry) })
    }
    let read
    try {
      if (remaining() <= 0) throw new ICloudNativeError('timeout')
      read = await raceTimeout(deps.native.readKeys('record'), remaining())
    } catch (raw) {
      const err = toICloudError(raw)
      const timeout = err.code === 'timeout' || err.code === 'unavailable'
      for (const slot of KEY_SLOTS) {
        const entry = entries[slot]
        if (!entry) {
          setKeySlotView(slot, null)
        } else if (unpushedLocalChange(entry, slot)) {
          setKeySlotView(slot, entry.state === 'cleared'
            ? { state: 'waiting-to-upload', fromThisDevice: true, clearPending: true }
            : { state: 'waiting-to-upload', ...keyOriginView(entry) })
        } else if (entry.state === 'key') {
          keyErrorView(slot, entry, timeout ? 'timeout' : err.code)
        } else {
          // A pushed marker on an empty row is not news; keep the last view.
        }
      }
      return { transferred: false, failed: timeout }
    }
    const now = deps.now()
    // 4. Validate. One line per rejected slot or envelope, naming the rule only.
    const verdict = validateKeyRecord(read.record, now)
    let sharedNow: SharedKeySlots = { ebird: null, openweather: null }
    if (verdict.ok) {
      sharedNow = verdict.slots
      for (const slot of KEY_SLOTS) {
        const why = verdict.rejected[slot]
        if (why) deps.log(`icloud: key record slot ${slot} rejected (${why}); treating it as absent`)
      }
    } else if (read.record !== null) {
      deps.log(`icloud: key record rejected (${verdict.reason}); treating it as absent`)
    }
    pref.knownKeyRecord = read.status.present

    // 5. Decide per slot, and refuse up front what the write chokepoint will
    //    refuse (a value outside its bound; a time outside the writers'
    //    predicate, from a skewed clock or a hand-edited document), so no
    //    local effect is applied for an entry that cannot be written and the
    //    row can name the rule (security fix round, Finding 1).
    const nowIso = new Date(now).toISOString()
    const decisions = {} as Record<KeySlot, KeyDecision>
    const refused: Partial<Record<KeySlot, KeyRefusal>> = {}
    for (const slot of KEY_SLOTS) {
      const entry = entries[slot]
      decisions[slot] = reconcileKeySlot({ local: toLocal(entry), shared: sharedNow[slot] })
      const d = decisions[slot]
      if (!entry || (d.action !== 'seed' && d.action !== 'push')) continue
      if (entry.state === 'key' && !isValidKeyValue(entry.value)) {
        refused[slot] = 'key-shape'
        continue
      }
      // The time the entry would carry: a seed stamps now; a push carries the local time.
      const time = entry.state === 'cleared' ? entry.clearedAt : d.action === 'seed' ? nowIso : (entry.changedAt ?? nowIso)
      if (!isWritableTime(time, now)) refused[slot] = 'key-time'
    }

    // 6. Apply local effects, each a guarded link (a failed guard = a user
    //    action landed; the next check pushes it, FR-26).
    let transferred = false
    const toWrite: KeySlotsInput = {}
    const pushed = {} as Record<KeySlot, boolean>
    const needsOriginStamp = {} as Record<KeySlot, boolean>
    const replacedAt = {} as Record<KeySlot, string | undefined>
    const clearedFrom = {} as Record<KeySlot, { clearedAt: string; origin: FileOrigin } | undefined>
    for (const slot of KEY_SLOTS) {
      const entry = entries[slot]
      const shared = sharedNow[slot]
      const d = decisions[slot]
      pushed[slot] = false
      needsOriginStamp[slot] = false
      if (refused[slot]) continue
      try {
        switch (d.action) {
          case 'seed': {
            if (entry?.state !== 'key') break
            const origin = thisDevice()
            const ok = await deps.storage.stampApiKeyEntry(slot, { changedAt: nowIso, origin }, entry.value)
            if (!ok) break
            toWrite[slot] = toSharedEntry(entry, nowIso, origin)
            pushed[slot] = true
            break
          }
          case 'push': {
            if (!entry) break
            toWrite[slot] = toSharedEntry(entry)
            pushed[slot] = true
            needsOriginStamp[slot] = entry.state === 'key' && !entry.origin
            break
          }
          case 'apply': {
            if (shared?.state !== 'key') break
            const ok = await deps.storage.applySyncedKey(
              slot,
              { value: shared.value, changedAt: shared.changedAt, origin: shared.origin },
              expectOf(entry),
              d.replaced === true,
            )
            if (!ok) break
            transferred = true
            if (d.replaced) replacedAt[slot] = shared.changedAt
            deps.invalidateKey(slot)
            notifyKeys()
            break
          }
          case 'adopt': {
            if (entry?.state !== 'key' || shared?.state !== 'key') break
            await deps.storage.stampApiKeyEntry(slot, { changedAt: shared.changedAt, origin: shared.origin }, entry.value)
            break
          }
          case 'clear-local': {
            if (shared?.state !== 'cleared') break
            const ok = await deps.storage.applySyncedKeyClear(
              slot,
              { clearedAt: shared.clearedAt, origin: shared.origin },
              expectOf(entry),
            )
            if (!ok) break
            transferred = true
            clearedFrom[slot] = { clearedAt: shared.clearedAt, origin: shared.origin }
            deps.invalidateKey(slot)
            notifyKeys()
            break
          }
          case 'none':
            break
        }
      } catch (e) {
        deps.log(`icloud: key ${slot} local apply failed: ${String(e)}`)
      }
    }

    // 7. Assemble the record to write. EVERY entry, pushed or carried from
    //    the record as validated, goes through the one chokepoint: a refused
    //    push is "this slot cannot sync" (never a truncated key or a
    //    rewritten time); a refused carried slot is OMITTED rather than
    //    failing the whole write, and its own device, whose local entry is
    //    newer than an absent slot, re-pushes it at its next check
    //    (security fix round, Finding 2).
    let anyPush = false
    const carry = (slot: KeySlot): void => {
      const shared = sharedNow[slot]
      const clean = shared ? sanitizeKeyEntryForWrite(shared, thisDeviceLabelFallback(), now) : null
      if (shared && !clean) deps.log(`icloud: key record slot ${slot} not carried (time); its device re-pushes it`)
      if (clean) toWrite[slot] = clean
      else delete toWrite[slot]
    }
    for (const slot of KEY_SLOTS) {
      if (!pushed[slot]) {
        carry(slot)
        continue
      }
      const clean = sanitizeKeyEntryForWrite(toWrite[slot] as SharedKeyEntry, thisDeviceLabelFallback(), now)
      if (!clean) {
        const entry = entries[slot]
        refused[slot] ??= (entry?.state === 'key' && !isValidKeyValue(entry.value)) ? 'key-shape' : 'key-time'
        pushed[slot] = false
        carry(slot)
        continue
      }
      toWrite[slot] = clean
      anyPush = true
    }

    // 8. Write at most once, and never after a switch-off (FR-08).
    let writeResult: { ok: true; uploaded: boolean } | { ok: false; code: 'timeout' | 'other'; reason: string } | null = null
    if (anyPush && pref.keysEnabled && pref.deviceId) {
      try {
        const r = await deps.native.writeKeys(pref.deviceId, toWrite)
        writeResult = { ok: true, uploaded: r.uploaded !== false }
        transferred = true
        for (const slot of KEY_SLOTS) {
          const entry = entries[slot]
          if (pushed[slot] && needsOriginStamp[slot] && entry?.state === 'key' && entry.changedAt) {
            try {
              await deps.storage.stampApiKeyEntry(slot, { changedAt: entry.changedAt, origin: thisDevice() }, entry.value)
            } catch { /* the next push stamps it */ }
          }
        }
      } catch (raw) {
        const err = toICloudError(raw)
        writeResult = err.code === 'timeout' || err.code === 'unavailable'
          ? { ok: false, code: 'timeout', reason: err.code }
          : { ok: false, code: 'other', reason: err.code }
      }
    }

    // 9. Publish rows from the local meta after the effects above.
    const after = await readEntries()
    for (const slot of KEY_SLOTS) {
      const entry = after[slot]
      const refusal = refused[slot]
      if (refusal) {
        keyErrorView(slot, entry, refusal)
        continue
      }
      if (pushed[slot]) {
        if (writeResult?.ok === false && writeResult.code === 'other') {
          keyErrorView(slot, entry, writeResult.reason as Parameters<typeof keyReasonFor>[0])
          continue
        }
        const up = writeResult?.ok === true && writeResult.uploaded
        if (entry?.state === 'cleared') {
          // A marker that reached iCloud is not news on an empty row.
          setKeySlotView(slot, up ? null : { state: 'waiting-to-upload', fromThisDevice: true, clearPending: true })
        } else if (entry?.state === 'key') {
          setKeySlotView(slot, { state: up ? 'up-to-date' : 'waiting-to-upload', ...keyOriginView(entry) })
        } else {
          setKeySlotView(slot, null)
        }
        continue
      }
      const cleared = clearedFrom[slot]
      if (cleared) {
        setKeySlotView(slot, {
          state: 'up-to-date',
          fromThisDevice: false,
          origin: { label: cleared.origin.label, platform: cleared.origin.platform },
          clearedAt: cleared.clearedAt,
        })
        continue
      }
      if (entry?.state === 'key') {
        const view: KeySlotView = { state: 'up-to-date', ...keyOriginView(entry) }
        const rep = replacedAt[slot] ?? (entry.replacedBySyncAt && entry.changedAt ? entry.changedAt : undefined)
        if (rep) view.replacedAt = rep
        // Identical on both sides, but a copy this device pushed while the
        // daemon was still uploading reads waiting (the file rule).
        if (view.fromThisDevice && read.status.present && read.status.uploaded === false) view.state = 'waiting-to-upload'
        setKeySlotView(slot, view)
        continue
      }
      if (entry?.state === 'cleared') {
        // A peer's marker applied earlier keeps saying who cleared it until
        // the next arrival (FR-42); this device's own pushed marker is not news.
        const ours = entry.origin.deviceId === pref.deviceId
        setKeySlotView(slot, ours
          ? null
          : {
              state: 'up-to-date',
              fromThisDevice: false,
              origin: { label: entry.origin.label, platform: entry.origin.platform },
              clearedAt: entry.clearedAt,
            })
        continue
      }
      setKeySlotView(slot, null)
    }

    // 10. Record the known state (never a value).
    const recordNow = writeResult?.ok === true ? toWrite : sharedNow
    const known: KnownSharedKeys = { ebird: null, openweather: null }
    for (const slot of KEY_SLOTS) {
      const e = recordNow[slot]
      if (!e) continue
      known[slot] = e.state === 'key'
        ? { state: 'key', at: e.changedAt, originId: e.origin.deviceId }
        : { state: 'cleared', at: e.clearedAt, originId: e.origin.deviceId }
    }
    pref.knownSharedKeys = known
    if (writeResult?.ok === true || read.status.present) pref.knownKeyRecord = true
    return { transferred, failed: false }
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
      // The key pass (icloud-api-key-sync FR-43): one check, both passes, one
      // lastCheckAt. A key read that ran past the budget fails the check the
      // way an undecided file slot does.
      const keys = await runKeyPass(remaining)
      if (keys.transferred) transferred = true
      if (keys.failed) {
        await savePref()
        publishKeys()
        setICloudState({ checkFailed: true })
        return failed
      }
      pref.lastCheckAt = isoNow(deps.now)
      await savePref()
      publishShared()
      publishKeys()
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
    detach.push(
      deps.subscribeKeysChanged(() => {
        if (!selfNotifying) void requestCheck('keys changed')
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

  // ── the removal retry (icloud-api-key-sync FR-33, OQ-1) ────────────────
  // Armed by boot() when a removal is owed and by disableKeys() on failure;
  // fires on foreground and focus (and step 1 of every check); installed
  // once and removed when the flag clears.

  function armRemovalRetry(): void {
    if (detachRemoval.length) return
    const view = deps.view
    if (view && typeof view.addEventListener === 'function') {
      const onVisible = () => {
        if (view.document.visibilityState === 'visible') void tryRemoveKeys()
      }
      const onFocus = () => void tryRemoveKeys()
      view.document.addEventListener('visibilitychange', onVisible)
      view.addEventListener('focus', onFocus)
      detachRemoval.push(() => view.document.removeEventListener('visibilitychange', onVisible))
      detachRemoval.push(() => view.removeEventListener('focus', onFocus))
    }
  }

  function disarmRemovalRetry(): void {
    while (detachRemoval.length) {
      const un = detachRemoval.pop()
      try {
        un?.()
      } catch { /* ignore */ }
    }
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
    // FR-07: the key switch goes off in the same action, with every effect
    // of FR-32 and FR-33; the file records are untouched (FR-37).
    if (pref.keysEnabled) await disableKeys()
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
    publishKeys()
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

  // ── key actions (icloud-api-key-sync) ──────────────────────────────────

  async function enableKeys(): Promise<void> {
    if (!(pref.enabled && getICloudState().availability === 'available')) return
    pref.keysEnabled = true
    pref.keysEverEnabled = true
    // An enable supersedes an owed removal.
    pref.keyRemovalPending = false
    disarmRemovalRetry()
    await savePref()
    publishKeys()
    await requestCheck('keys enabled')
  }

  async function disableKeys(): Promise<void> {
    pref.keysEnabled = false
    await savePref()
    publishKeys()
    // FR-08: a write that began under "on" has settled before the removal.
    if (inFlight) {
      try {
        await inFlight
      } catch { /* the check reports its own failure */ }
    }
    if (pref.knownKeyRecord) {
      try {
        await deps.native.removeKeys()
        pref.knownKeyRecord = false
        pref.knownSharedKeys = undefined
        pref.keyRemovalPending = false
      } catch (raw) {
        const err = toICloudError(raw)
        deps.log(`icloud: key removal pending after switch-off (${err.code})`)
        pref.keyRemovalPending = true
        armRemovalRetry()
      }
      await savePref()
    }
    publishKeys()
    await publishKeyRowsOff()
  }

  async function removeKeysFromICloud(): Promise<void> {
    try {
      await deps.native.removeKeys()
    } catch (raw) {
      const err = toICloudError(raw)
      deps.log(`icloud: remove keys failed (${err.code})`)
      if (err.code === 'timeout' || err.code === 'unavailable') {
        pref.keyRemovalPending = true
        armRemovalRetry()
        await savePref()
        publishKeys()
      }
      return
    }
    pref.knownKeyRecord = false
    pref.knownSharedKeys = undefined
    pref.keyRemovalPending = false
    disarmRemovalRetry()
    await savePref()
    publishKeys()
    if (pref.enabled && pref.keysEnabled) {
      // The confirmation says so: a device with key sync on uploads its
      // keys again at its next check. Run it now so the rows tell the truth.
      await requestCheck('remove keys')
    } else {
      await publishKeyRowsOff()
    }
  }

  async function clearKeyWithSync(slot: KeySlot): Promise<void> {
    const clearedAt = isoNow(deps.now)
    // The local key is gone at once; the marker persists in api-keys.json
    // (OQ-8) and is the memo the next check pushes, or that a newer shared
    // key overrides (latest event wins, FR-14).
    await deps.storage.clearApiKeyWithMarker(slot, { clearedAt, origin: thisDevice() })
    deps.invalidateKey(slot)
    notifyKeys()
    setKeySlotView(slot, { state: 'syncing', fromThisDevice: true })
    await requestCheck('key cleared')
  }

  function keySaved(slot: KeySlot): void {
    if (!(pref.enabled && pref.keysEnabled)) return
    setKeySlotView(slot, { state: 'syncing', fromThisDevice: true })
    void requestCheck('key saved')
  }

  async function retryKey(slot: KeySlot): Promise<void> {
    const current = getICloudState().keySlots[slot]
    setKeySlotView(slot, { ...(current ?? { fromThisDevice: true }), state: 'syncing', reason: undefined })
    await requestCheck('retry key')
  }

  async function boot(): Promise<void> {
    await loadPref()
    setICloudState({ syncEnabled: pref.enabled, deviceId: pref.deviceId, lastCheckAt: pref.lastCheckAt })
    publishShared()
    publishKeys()
    const availability = await probe()
    // An owed key removal is retried at launch (FR-33, OQ-1), and stays armed
    // for foreground and focus until the copy is gone.
    if (pref.keyRemovalPending && pref.knownKeyRecord) {
      armRemovalRetry()
      if (availability === 'available') void tryRemoveKeys()
    } else if (pref.keyRemovalPending) {
      pref.keyRemovalPending = false
      await savePref()
      publishKeys()
    }
    if (pref.enabled) {
      startWatching()
      void requestCheck('boot')
    } else {
      if (SLOTS.some((s) => shared[s] !== null)) {
        // Sync was on once and iCloud still held copies: say so on the rows.
        let files: FilesStatus = { ebird: null, ml: null }
        try {
          files = await deps.storage.getFilesStatus()
        } catch { /* keep empty */ }
        for (const slot of SLOTS) {
          setSlotView(slot, files[slot] || shared[slot] ? { state: 'off', fromThisDevice: false } : null)
        }
      }
      if (pref.keysEverEnabled || pref.knownKeyRecord) await publishKeyRowsOff()
    }
  }

  function dispose(): void {
    disposed = true
    stopWatching()
    disarmRemovalRetry()
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
    enableKeys,
    disableKeys,
    removeKeysFromICloud,
    clearKeyWithSync,
    retryKey,
    keySaved,
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
    const [{ storage }, { icloudNative }, obs, ml, hs, fc, nc, kc] = await Promise.all([
      import('../storage'),
      import('./icloudNative'),
      import('../observationsCache'),
      import('../mlExportCache'),
      import('../hotspotSet'),
      import('../filesChanged'),
      import('../networkCache'),
      import('../keysChanged'),
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
      invalidateKey: (slot) => {
        // Exactly what Settings.tsx's handleSaveKey runs after an eBird key save.
        if (slot === 'ebird') {
          nc.clearNetworkCache()
          hs.invalidateHotspotSet()
        }
      },
      notifyKeysChanged: kc.notifyKeysChanged,
      subscribeKeysChanged: kc.subscribeKeysChanged,
      now: () => Date.now(),
      mintDeviceId,
      view: typeof window !== 'undefined' ? window : null,
      log: (m) => console.warn(m),
    })
    await controller.boot()
  })()
  return booted
}

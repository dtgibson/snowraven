// icloud-sync controller (QA-19 FR-20, QA-37 FR-40, QA-11 FR-12, QA-05,
// QA-27, QA-14, QA-29, QA-32 where unit-testable): driven through a fake
// native layer and an in-memory storage that keeps the seam's guard
// semantics, with the REAL validator and reconcile modules underneath.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createICloudController, mintDeviceId, type ControllerDeps, ICLOUD_SYNC_SETTING } from './icloudSync'
import { getICloudState, resetICloudState, installICloudActions } from './icloudState'
import { serializeRecord, validateSharedRecord, type SharedRecord, type Slot } from './icloudRecord'
import type { FileMetadata, FilesStatus, FileOrigin } from '../storage'
import type { ICloudNativeLayer, NativeRecordRead, NativeStatus } from './icloudNativeTypes'
import { ICloudNativeError } from './icloudNativeTypes'

const ME = 'a'.repeat(32)
const PEER = 'f'.repeat(32)
const SHA = 'b'.repeat(64)
const T_OLD = '2026-08-20T10:00:00.000Z'
const T_NEW = '2026-08-24T22:12:00.000Z'
let clock = Date.parse('2026-09-01T16:00:00.000Z')

function fileRec(slot: Slot, uploadedAt: string, deviceId = PEER, filename = 'MyEBirdData.csv'): SharedRecord {
  return {
    version: 1, slot, state: 'file', filename, uploadedAt,
    origin: { deviceId, label: 'iPhone', platform: 'iphone' }, byteLength: 1000, sha256: SHA,
  }
}
function clearedRec(slot: Slot, clearedAt: string, deviceId = PEER): SharedRecord {
  return { version: 1, slot, state: 'cleared', clearedAt, origin: { deviceId, label: 'iPhone', platform: 'iphone' } }
}

// ── fake native ──────────────────────────────────────────────────────────
interface Container { record: Record<Slot, string | null>; file: Record<Slot, NativeRecordRead['file']> }

function makeNative(status: NativeStatus['state'] = 'available') {
  const container: Container = {
    record: { ebird: null, ml: null },
    file: {
      ebird: { present: false, downloaded: false, downloading: false, byteLength: null, uploaded: false, uploading: false },
      ml: { present: false, downloaded: false, downloading: false, byteLength: null, uploaded: false, uploading: false },
    },
  }
  // Whether a push is reported as already in iCloud (the daemon's upload).
  const knobs = { pushUploaded: true }
  const calls: Array<{ cmd: string; args: unknown[] }> = []
  const rec = (cmd: string, ...args: unknown[]) => { calls.push({ cmd, args }) }
  const fail: Partial<Record<string, ICloudNativeError>> = {}
  let changed: (() => void) | null = null
  let identity: (() => void) | null = null
  const native: ICloudNativeLayer = {
    async status() { rec('status'); if (fail.status) throw fail.status; return { state: status, deviceLabel: "Dave's Mac", platform: 'mac' } },
    async readRecord(slot) { rec('readRecord', slot); if (fail.readRecord) throw fail.readRecord; return { record: container.record[slot], file: { ...container.file[slot] } } },
    async push(slot, filename, uploadedAt, origin) {
      rec('push', slot, filename, uploadedAt, origin)
      if (fail.push) throw fail.push
      container.record[slot] = serializeRecord({ ...fileRec(slot, uploadedAt, origin.deviceId, filename), origin: { ...origin } })
      container.file[slot] = { present: true, downloaded: true, downloading: false, byteLength: 1000, uploaded: knobs.pushUploaded, uploading: !knobs.pushUploaded }
      return { sha256: SHA, byteLength: 1000, uploaded: knobs.pushUploaded }
    },
    async pushCleared(slot, clearedAt, origin) {
      rec('pushCleared', slot, clearedAt, origin)
      if (fail.pushCleared) throw fail.pushCleared
      container.record[slot] = serializeRecord(clearedRec(slot, clearedAt, origin.deviceId))
      container.file[slot] = { present: false, downloaded: false, downloading: false, byteLength: null, uploaded: false, uploading: false }
    },
    async pull(slot, sha, len) { rec('pull', slot, sha, len); if (fail.pull) throw fail.pull },
    async startDownload(slot) { rec('startDownload', slot); if (fail.startDownload) throw fail.startDownload },
    async removeAll() {
      rec('removeAll')
      let removed = 0
      for (const s of ['ebird', 'ml'] as Slot[]) {
        if (container.record[s]) { removed++; container.record[s] = null }
        if (container.file[s].present) { removed++; container.file[s] = { present: false, downloaded: false, downloading: false, byteLength: null, uploaded: false, uploading: false } }
      }
      return { removed }
    },
    async watch(enabled) { rec('watch', enabled) },
    async onChanged(cb) { changed = cb; return () => { changed = null } },
    async onIdentityChanged(cb) { identity = cb; return () => { identity = null } },
  }
  return {
    native, container, calls, fail, knobs,
    fireChanged: () => changed?.(),
    fireIdentity: () => identity?.(),
    setShared(slot: Slot, r: SharedRecord | null, downloaded = true) {
      container.record[slot] = r ? serializeRecord(r) : null
      container.file[slot] = r?.state === 'file'
        ? { present: true, downloaded, downloading: false, byteLength: downloaded ? 1000 : null, uploaded: true, uploading: false }
        : { present: false, downloaded: false, downloading: false, byteLength: null, uploaded: false, uploading: false }
    },
  }
}

// ── fake storage (the seam's guard semantics, in memory) ─────────────────
function makeStorage(meta: FilesStatus = { ebird: null, ml: null }) {
  const settings: Record<string, unknown> = {}
  const files: FilesStatus = { ebird: meta.ebird, ml: meta.ml }
  const csv: Record<Slot, string | null> = { ebird: meta.ebird ? 'local-ebird' : null, ml: meta.ml ? 'local-ml' : null }
  const storage: ControllerDeps['storage'] = {
    async getSetting<T>(key: string) { return (settings[key] as T) ?? null },
    async setSetting<T>(key: string, value: T) { settings[key] = JSON.parse(JSON.stringify(value)) },
    async getFilesStatus() { return { ebird: files.ebird, ml: files.ml } },
    async deleteFile(name) { files[name] = null; csv[name] = null },
    async applySyncedFile(name, entry: FileMetadata, expect, materialize) {
      if ((files[name]?.uploadedAt ?? null) !== expect) return false
      await materialize()
      csv[name] = 'pulled'
      files[name] = entry
      return true
    },
    async applySyncedClear(name, expect) {
      if ((files[name]?.uploadedAt ?? null) !== expect) return false
      files[name] = null
      csv[name] = null
      return true
    },
    async stampFileOrigin(name, origin: FileOrigin, expectUploadedAt) {
      const cur = files[name]
      if (!cur || cur.uploadedAt !== expectUploadedAt || cur.origin) return false
      files[name] = { ...cur, origin }
      return true
    },
  }
  return { storage, settings, files, csv }
}

function makeDeps(native: ICloudNativeLayer, storage: ControllerDeps['storage']) {
  const invalidate = vi.fn()
  const notifyFilesChanged = vi.fn()
  const subscribers = new Set<() => void>()
  const deps: ControllerDeps = {
    native,
    storage,
    invalidate,
    notifyFilesChanged,
    subscribeFilesChanged: (cb) => { subscribers.add(cb); return () => { subscribers.delete(cb) } },
    now: () => clock,
    mintDeviceId: () => ME,
    view: null,
    log: () => {},
    pollIntervalMs: 60_000_000,
    eventDebounceMs: 1,
    checkDownloadWaitMs: 5,
    downloadNowWaitMs: 5,
    downloadPollMs: 1,
  }
  return { deps, invalidate, notifyFilesChanged, fireFilesChanged: () => { for (const cb of subscribers) cb() } }
}

const local = (uploadedAt: string, origin?: FileOrigin): FileMetadata => ({ filename: 'MyEBirdData.csv', uploadedAt, ...(origin ? { origin } : {}) })

beforeEach(() => {
  resetICloudState()
  clock = Date.parse('2026-09-01T16:00:00.000Z')
})
afterEach(() => {
  installICloudActions(null)
})

describe('boot and preference (FR-07, FR-10, FR-13)', () => {
  it('boots off: probes availability only, reads no record, writes nothing to iCloud', async () => {
    const n = makeNative()
    const st = makeStorage({ ebird: local(T_OLD), ml: null })
    const { deps } = makeDeps(n.native, st.storage)
    const c = createICloudController(deps)
    await c.boot()
    expect(getICloudState().availability).toBe('available')
    expect(getICloudState().syncEnabled).toBe(false)
    expect(n.calls.map(x => x.cmd)).toEqual(['status'])
    expect(getICloudState().slots.ebird).toBeNull()
  })

  it('enable mints a 32-hex device id once, persists the preference, and never syncs it', async () => {
    const n = makeNative()
    const st = makeStorage()
    const { deps } = makeDeps(n.native, st.storage)
    const c = createICloudController(deps)
    await c.boot()
    await c.enable()
    const saved = st.settings[ICLOUD_SYNC_SETTING] as { enabled: boolean; deviceId: string }
    expect(saved.enabled).toBe(true)
    expect(saved.deviceId).toMatch(/^[0-9a-f]{32}$/)
    expect(getICloudState().deviceId).toBe(saved.deviceId)
    // FR-12 / QA-11: nothing but slot-scoped calls ever reach the native layer.
    const text = JSON.stringify(n.calls)
    for (const excluded of ['api-keys', 'settings.json', 'map-style', 'replay', 'county', 'hotspot', 'projects', 'taxonomy', 'icloud-sync']) {
      expect(text).not.toContain(excluded)
    }
  })

  it('mintDeviceId produces 32 lowercase hex and differs between calls', () => {
    const a = mintDeviceId()
    const b = mintDeviceId()
    expect(a).toMatch(/^[0-9a-f]{32}$/)
    expect(b).toMatch(/^[0-9a-f]{32}$/)
    expect(a).not.toBe(b)
  })

  it('a stale binary whose status command throws lands in "build cannot use iCloud" (QA-03)', async () => {
    const n = makeNative()
    n.fail.status = new ICloudNativeError('unknown')
    const { deps } = makeDeps(n.native, makeStorage().storage)
    const c = createICloudController(deps)
    await c.boot()
    expect(getICloudState().availability).toBe('build-cannot-use-icloud')
  })
})

describe('the reconciliation applied (FR-14 to FR-17, FR-31, FR-34)', () => {
  it('FR-14 local only: pushes, stamps the origin, row reads up to date from this device', async () => {
    const n = makeNative()
    const st = makeStorage({ ebird: local(T_OLD), ml: null })
    const { deps, invalidate, notifyFilesChanged } = makeDeps(n.native, st.storage)
    const c = createICloudController(deps)
    await c.boot()
    await c.enable()
    expect(n.calls.filter(x => x.cmd === 'push').map(x => x.args[0])).toEqual(['ebird'])
    expect(st.files.ebird?.origin?.deviceId).toBe(ME)
    expect(st.files.ebird?.uploadedAt).toBe(T_OLD) // never rewritten
    expect(getICloudState().slots.ebird).toMatchObject({ state: 'up-to-date', fromThisDevice: true })
    expect(getICloudState().slots.ml).toBeNull() // FR-18
    expect(getICloudState().sharedExists).toBe(true)
    expect(invalidate).not.toHaveBeenCalled() // a push changes nothing local
    expect(notifyFilesChanged).not.toHaveBeenCalled()
  })

  it('FR-15 shared only: pulls through the seam, invalidates, notifies, names the origin', async () => {
    const n = makeNative()
    n.setShared('ebird', fileRec('ebird', T_NEW))
    const st = makeStorage()
    const { deps, invalidate, notifyFilesChanged } = makeDeps(n.native, st.storage)
    const c = createICloudController(deps)
    await c.boot()
    await c.enable()
    expect(n.calls.some(x => x.cmd === 'pull' && x.args[0] === 'ebird' && x.args[1] === SHA && x.args[2] === 1000)).toBe(true)
    expect(st.files.ebird).toMatchObject({ filename: 'MyEBirdData.csv', uploadedAt: T_NEW, origin: { deviceId: PEER } })
    expect(st.csv.ebird).toBe('pulled')
    expect(invalidate).toHaveBeenCalledWith('ebird')
    expect(notifyFilesChanged).toHaveBeenCalledTimes(1)
    expect(getICloudState().slots.ebird).toMatchObject({ state: 'up-to-date', fromThisDevice: false, origin: { label: 'iPhone', platform: 'iphone' }, replacedAt: T_NEW })
  })

  it('FR-16 shared newer replaces the local copy whole; FR-25 the row says so', async () => {
    const n = makeNative()
    n.setShared('ebird', fileRec('ebird', T_NEW))
    const st = makeStorage({ ebird: local(T_OLD, { deviceId: ME, label: 'Mac', platform: 'mac' }), ml: null })
    const { deps } = makeDeps(n.native, st.storage)
    const c = createICloudController(deps)
    await c.boot()
    await c.enable()
    expect(st.files.ebird?.uploadedAt).toBe(T_NEW)
    expect(st.files.ebird?.replacedBySyncAt).toBeDefined()
    expect(getICloudState().slots.ebird?.replacedAt).toBe(T_NEW)
  })

  it('FR-16 local newer replaces the shared record whole (a push, no pull)', async () => {
    const n = makeNative()
    n.setShared('ebird', fileRec('ebird', T_OLD))
    const st = makeStorage({ ebird: local(T_NEW, { deviceId: ME, label: 'Mac', platform: 'mac' }), ml: null })
    const { deps } = makeDeps(n.native, st.storage)
    const c = createICloudController(deps)
    await c.boot()
    await c.enable()
    expect(n.calls.some(x => x.cmd === 'push')).toBe(true)
    expect(n.calls.some(x => x.cmd === 'pull')).toBe(false)
    expect(st.files.ebird?.uploadedAt).toBe(T_NEW)
  })

  it('FR-17 identical (pre-sync local, equal time): transfers nothing, row reads up to date', async () => {
    const n = makeNative()
    n.setShared('ebird', fileRec('ebird', T_NEW))
    const st = makeStorage({ ebird: local(T_NEW), ml: null })
    const { deps } = makeDeps(n.native, st.storage)
    const c = createICloudController(deps)
    await c.boot()
    await c.enable()
    expect(n.calls.some(x => x.cmd === 'push' || x.cmd === 'pull')).toBe(false)
    expect(getICloudState().slots.ebird?.state).toBe('up-to-date')
  })

  it('FR-31 a cleared marker newer than the local copy removes it through the guarded link', async () => {
    const n = makeNative()
    n.setShared('ebird', clearedRec('ebird', T_NEW))
    const st = makeStorage({ ebird: local(T_OLD, { deviceId: ME, label: 'Mac', platform: 'mac' }), ml: null })
    const { deps, invalidate, notifyFilesChanged } = makeDeps(n.native, st.storage)
    const c = createICloudController(deps)
    await c.boot()
    await c.enable()
    expect(st.files.ebird).toBeNull()
    expect(st.csv.ebird).toBeNull()
    expect(invalidate).toHaveBeenCalledWith('ebird')
    expect(notifyFilesChanged).toHaveBeenCalled()
    expect(getICloudState().slots.ebird).toBeNull()
  })

  it('FR-31 (QA-29) a local copy newer than the cleared marker is kept and pushed over it', async () => {
    const n = makeNative()
    n.setShared('ebird', clearedRec('ebird', T_OLD))
    const st = makeStorage({ ebird: local(T_NEW, { deviceId: ME, label: 'Mac', platform: 'mac' }), ml: null })
    const { deps } = makeDeps(n.native, st.storage)
    const c = createICloudController(deps)
    await c.boot()
    await c.enable()
    expect(st.files.ebird?.uploadedAt).toBe(T_NEW)
    expect(n.calls.some(x => x.cmd === 'push')).toBe(true)
    expect(n.container.record.ebird).toContain('"state":"file"')
  })

  it('a malformed shared record is treated as absent: the local copy is pushed, never deleted (FR-37)', async () => {
    const n = makeNative()
    n.container.record.ebird = '{"version":1,"slot":"ebird","state":"cleared","clearedAt":"2999-01-01T00:00:00Z","origin":{"deviceId":"zz","label":"x","platform":"mac"}}'
    const st = makeStorage({ ebird: local(T_OLD), ml: null })
    const log = vi.fn()
    const { deps } = makeDeps(n.native, st.storage)
    deps.log = log
    const c = createICloudController(deps)
    await c.boot()
    await c.enable()
    expect(st.files.ebird).not.toBeNull()
    expect(n.calls.some(x => x.cmd === 'push')).toBe(true)
    expect(log).toHaveBeenCalledWith(expect.stringContaining('record rejected'))
  })
})

describe('bounded checks (FR-20, QA-19) and idempotence (FR-40, QA-37)', () => {
  it('ten rapid triggers produce at most two checks: one in flight, one queued', async () => {
    const n = makeNative()
    const st = makeStorage({ ebird: local(T_OLD), ml: null })
    const { deps } = makeDeps(n.native, st.storage)
    const c = createICloudController(deps)
    await c.boot()
    await c.enable()
    const before = c.checksRun
    const burst = Array.from({ length: 10 }, (_, i) => c.requestCheck(`burst ${i}`))
    await Promise.all(burst)
    // The queued follow-up starts after the burst's in-flight check settles.
    await new Promise(r => setTimeout(r, 5))
    expect(c.checksRun - before).toBeLessThanOrEqual(2)
    expect(c.checksRun - before).toBeGreaterThanOrEqual(1)
  })

  it('two consecutive checks with no change: the second transfers nothing and changes no row', async () => {
    const n = makeNative()
    const st = makeStorage({ ebird: local(T_OLD), ml: null })
    const { deps } = makeDeps(n.native, st.storage)
    const c = createICloudController(deps)
    await c.boot()
    await c.enable()
    await new Promise(r => setTimeout(r, 5))
    const slotsBefore = JSON.stringify(getICloudState().slots)
    const callsBefore = n.calls.length
    const outcome = await c.checkNow()
    expect(outcome.ok).toBe(true)
    expect(outcome.transferred).toBe(false)
    const newCalls = n.calls.slice(callsBefore).map(x => x.cmd)
    expect(newCalls).not.toContain('push')
    expect(newCalls).not.toContain('pull')
    expect(JSON.stringify(getICloudState().slots)).toBe(slotsBefore)
  })

  it('native change events are debounced into one check', async () => {
    const n = makeNative()
    const { deps } = makeDeps(n.native, makeStorage().storage)
    const c = createICloudController(deps)
    await c.boot()
    await c.enable()
    await new Promise(r => setTimeout(r, 5))
    const before = c.checksRun
    n.fireChanged(); n.fireChanged(); n.fireChanged()
    await new Promise(r => setTimeout(r, 20))
    expect(c.checksRun - before).toBe(1)
  })

  it('a file save (the epoch) triggers a check, but the controller ignores its own notifications', async () => {
    const n = makeNative()
    n.setShared('ebird', fileRec('ebird', T_NEW))
    const st = makeStorage()
    const { deps, fireFilesChanged, notifyFilesChanged } = makeDeps(n.native, st.storage)
    const c = createICloudController(deps)
    await c.boot()
    await c.enable() // pulls, which notifies the epoch through the controller itself
    await new Promise(r => setTimeout(r, 5))
    expect(notifyFilesChanged).toHaveBeenCalledTimes(1)
    const before = c.checksRun
    fireFilesChanged() // an external save
    await new Promise(r => setTimeout(r, 5))
    expect(c.checksRun - before).toBe(1)
  })
})

describe('offline and failure (FR-04, FR-05, FR-29, QA-05, QA-27)', () => {
  it('a timeout keeps the last state and the last check time; nothing local changes', async () => {
    const n = makeNative()
    const st = makeStorage({ ebird: local(T_OLD), ml: null })
    const { deps } = makeDeps(n.native, st.storage)
    const c = createICloudController(deps)
    await c.boot()
    await c.enable()
    await new Promise(r => setTimeout(r, 5))
    const at = getICloudState().lastCheckAt
    const slots = JSON.stringify(getICloudState().slots)
    const meta = JSON.stringify(st.files)
    n.fail.readRecord = new ICloudNativeError('timeout')
    const outcome = await c.checkNow()
    expect(outcome.ok).toBe(false)
    expect(getICloudState().lastCheckAt).toBe(at)
    expect(getICloudState().checkFailed).toBe(true)
    expect(JSON.stringify(getICloudState().slots)).toBe(slots)
    expect(JSON.stringify(st.files)).toBe(meta)
  })

  it('a push that cannot reach iCloud reads "Waiting to upload" and the local file stays applied', async () => {
    const n = makeNative()
    n.fail.push = new ICloudNativeError('timeout')
    const st = makeStorage({ ebird: local(T_OLD), ml: null })
    const { deps } = makeDeps(n.native, st.storage)
    const c = createICloudController(deps)
    await c.boot()
    await c.enable()
    expect(getICloudState().slots.ebird?.state).toBe('waiting-to-upload')
    expect(st.files.ebird?.uploadedAt).toBe(T_OLD)
  })

  it('a failed pull (mismatch) leaves the local copy and its metadata untouched and reads Could not sync', async () => {
    const n = makeNative()
    n.setShared('ebird', fileRec('ebird', T_NEW))
    n.fail.pull = new ICloudNativeError('mismatch')
    const st = makeStorage({ ebird: local(T_OLD, { deviceId: ME, label: 'Mac', platform: 'mac' }), ml: null })
    const { deps, invalidate } = makeDeps(n.native, st.storage)
    const c = createICloudController(deps)
    await c.boot()
    await c.enable()
    expect(st.files.ebird?.uploadedAt).toBe(T_OLD)
    expect(st.csv.ebird).toBe('local-ebird')
    expect(invalidate).not.toHaveBeenCalled()
    expect(getICloudState().slots.ebird).toMatchObject({ state: 'error', reason: 'The file in iCloud did not download completely.' })
  })

  it('a shared file not downloaded here reads "In iCloud, not downloaded here" and keeps the local copy (FR-27/FR-28)', async () => {
    const n = makeNative()
    n.setShared('ebird', fileRec('ebird', T_NEW), false)
    const st = makeStorage({ ebird: local(T_OLD, { deviceId: ME, label: 'Mac', platform: 'mac' }), ml: null })
    const { deps } = makeDeps(n.native, st.storage)
    const c = createICloudController(deps)
    await c.boot()
    await c.enable()
    expect(n.calls.some(x => x.cmd === 'startDownload')).toBe(true)
    expect(getICloudState().slots.ebird).toMatchObject({ state: 'in-icloud-not-downloaded', uploadedAt: T_NEW, origin: { label: 'iPhone' } })
    expect(st.files.ebird?.uploadedAt).toBe(T_OLD)
  })

  it('Download now fetches it once the download lands', async () => {
    const n = makeNative()
    n.setShared('ebird', fileRec('ebird', T_NEW), false)
    const st = makeStorage({ ebird: local(T_OLD, { deviceId: ME, label: 'Mac', platform: 'mac' }), ml: null })
    const { deps } = makeDeps(n.native, st.storage)
    const c = createICloudController(deps)
    await c.boot()
    await c.enable()
    n.container.file.ebird = { present: true, downloaded: true, downloading: false, byteLength: 1000, uploaded: true, uploading: false }
    await c.downloadNow('ebird')
    expect(st.files.ebird?.uploadedAt).toBe(T_NEW)
    expect(getICloudState().slots.ebird).toMatchObject({ state: 'up-to-date', replacedAt: T_NEW })
  })

  it('iCloud unavailable after enable: rows read unavailable, local files untouched; back again, the next check runs (FR-04)', async () => {
    let state: NativeStatus['state'] = 'available'
    const n = makeNative()
    const base = n.native.status
    n.native.status = async () => ({ ...(await base()), state })
    const st = makeStorage({ ebird: local(T_OLD), ml: null })
    const { deps } = makeDeps(n.native, st.storage)
    const c = createICloudController(deps)
    await c.boot()
    await c.enable()
    state = 'not-signed-in'
    await c.checkNow()
    expect(getICloudState().availability).toBe('not-signed-in')
    expect(getICloudState().syncEnabled).toBe(true)
    expect(getICloudState().slots.ebird?.state).toBe('unavailable')
    expect(st.files.ebird?.uploadedAt).toBe(T_OLD)
    state = 'available'
    const before = c.checksRun
    n.fireIdentity()
    await new Promise(r => setTimeout(r, 10))
    expect(c.checksRun - before).toBe(1)
    expect(getICloudState().slots.ebird?.state).toBe('up-to-date')
  })
})

describe('clear, turn off, remove (FR-30, FR-32, FR-33)', () => {
  it('clearWithSync removes the file here, invalidates, notifies, and writes the cleared marker', async () => {
    const n = makeNative()
    const st = makeStorage({ ebird: local(T_OLD), ml: null })
    const { deps, invalidate, notifyFilesChanged } = makeDeps(n.native, st.storage)
    const c = createICloudController(deps)
    await c.boot()
    await c.enable()
    await c.clearWithSync('ebird')
    expect(st.files.ebird).toBeNull()
    expect(invalidate).toHaveBeenCalledWith('ebird')
    expect(notifyFilesChanged).toHaveBeenCalled()
    expect(n.container.record.ebird).toContain('"state":"cleared"')
    expect(getICloudState().slots.ebird).toBeNull()
  })

  it('a cleared marker that could not be pushed is finished on the next check instead of pulling the file back', async () => {
    const n = makeNative()
    const st = makeStorage({ ebird: local(T_OLD), ml: null })
    const { deps } = makeDeps(n.native, st.storage)
    const c = createICloudController(deps)
    await c.boot()
    await c.enable()
    n.fail.pushCleared = new ICloudNativeError('timeout')
    await c.clearWithSync('ebird')
    expect(st.files.ebird).toBeNull()
    expect(n.container.record.ebird).toContain('"state":"file"') // still the old file in iCloud
    delete n.fail.pushCleared
    await c.checkNow()
    expect(n.container.record.ebird).toContain('"state":"cleared"')
    expect(st.files.ebird).toBeNull()
    expect(n.calls.some(x => x.cmd === 'pull')).toBe(false)
  })

  it('disable stops checks, leaves files, rows read Sync off where iCloud holds copies', async () => {
    const n = makeNative()
    const st = makeStorage({ ebird: local(T_OLD), ml: null })
    const { deps } = makeDeps(n.native, st.storage)
    const c = createICloudController(deps)
    await c.boot()
    await c.enable()
    await c.disable()
    expect(getICloudState().syncEnabled).toBe(false)
    expect(st.files.ebird?.uploadedAt).toBe(T_OLD)
    expect(getICloudState().slots.ebird?.state).toBe('off')
    expect(n.calls.filter(x => x.cmd === 'watch').map(x => x.args[0])).toContain(false)
    const before = c.checksRun
    await c.requestCheck('after disable')
    expect(c.checksRun).toBe(before)
  })

  it('a relaunch with sync off still knows iCloud held copies (rows read Sync off, Remove offered)', async () => {
    const n = makeNative()
    const st = makeStorage({ ebird: local(T_OLD), ml: null })
    const { deps } = makeDeps(n.native, st.storage)
    const c = createICloudController(deps)
    await c.boot()
    await c.enable()
    await c.disable()
    resetICloudState()
    const c2 = createICloudController(makeDeps(n.native, st.storage).deps)
    await c2.boot()
    expect(getICloudState().syncEnabled).toBe(false)
    expect(getICloudState().sharedExists).toBe(true)
    expect(getICloudState().slots.ebird?.state).toBe('off')
  })

  it('removeFromICloud deletes the shared records, touches no local copy, and writes no cleared marker', async () => {
    const n = makeNative()
    const st = makeStorage({ ebird: local(T_OLD), ml: null })
    const { deps } = makeDeps(n.native, st.storage)
    const c = createICloudController(deps)
    await c.boot()
    await c.enable()
    await c.disable()
    await c.removeFromICloud()
    expect(n.container.record.ebird).toBeNull()
    expect(st.files.ebird?.uploadedAt).toBe(T_OLD)
    expect(n.calls.some(x => x.cmd === 'pushCleared')).toBe(false)
    expect(getICloudState().sharedExists).toBe(false)
    expect(getICloudState().slots.ebird).toBeNull()
  })
})

describe('QA round 1: FR-05 waiting-to-upload and the NFR-04 check budget', () => {
  it('a push the daemon has not uploaded yet reads "Waiting to upload", and "Up to date" once iCloud holds it', async () => {
    const n = makeNative()
    n.knobs.pushUploaded = false
    const st = makeStorage({ ebird: local(T_OLD), ml: null })
    const { deps } = makeDeps(n.native, st.storage)
    const c = createICloudController(deps)
    await c.boot()
    await c.enable()
    expect(getICloudState().slots.ebird).toMatchObject({ state: 'waiting-to-upload', fromThisDevice: true })
    // The next trigger re-reads the status: still uploading -> still waiting.
    await c.checkNow()
    expect(getICloudState().slots.ebird?.state).toBe('waiting-to-upload')
    expect(n.calls.filter(x => x.cmd === 'push').length).toBe(1) // identical on both sides: no re-push
    // The daemon finished: the next check reads uploaded and the row settles.
    n.container.file.ebird = { ...n.container.file.ebird, uploaded: true, uploading: false }
    await c.checkNow()
    expect(getICloudState().slots.ebird).toMatchObject({ state: 'up-to-date', fromThisDevice: true })
  })

  it('a native layer that does not report the flag never traps a row in waiting', async () => {
    const n = makeNative()
    const base = n.native.readRecord
    n.native.readRecord = async (slot) => {
      const r = await base(slot)
      const legacy = { present: r.file.present, downloaded: r.file.downloaded, downloading: r.file.downloading, byteLength: r.file.byteLength }
      return { record: r.record, file: legacy as typeof r.file }
    }
    const st = makeStorage({ ebird: local(T_OLD), ml: null })
    const { deps } = makeDeps(n.native, st.storage)
    const c = createICloudController(deps)
    await c.boot()
    await c.enable()
    await c.checkNow()
    expect(getICloudState().slots.ebird?.state).toBe('up-to-date')
  })

  it('a check that iCloud answered once but then ran past its budget stops, marks the undecided rows Could not sync (timeout), and keeps lastCheckAt', async () => {
    const n = makeNative()
    const base = n.native.readRecord
    n.native.readRecord = (slot) => slot === 'ml' ? new Promise(() => {}) : base(slot) // ml never answers
    const st = makeStorage({ ebird: local(T_OLD), ml: local(T_OLD) })
    const { deps } = makeDeps(n.native, st.storage)
    deps.checkDeadlineMs = 40
    const c = createICloudController(deps)
    await c.boot()
    const t0 = Date.now()
    await c.enable()
    const elapsed = Date.now() - t0
    expect(elapsed).toBeLessThan(2000) // bounded by the budget, not by the 8 s command timeout
    expect(getICloudState().checkFailed).toBe(true)
    expect(getICloudState().lastCheckAt).toBeNull()
    expect(getICloudState().slots.ebird?.state).toBe('up-to-date') // decided before the budget ran out
    expect(getICloudState().slots.ml).toMatchObject({ state: 'error', reason: 'iCloud did not respond in time.' })
    expect(st.files.ml?.uploadedAt).toBe(T_OLD) // nothing local changed
  })

  it('a check whose FIRST read never answers keeps the last state (FR-05) rather than marking rows', async () => {
    const n = makeNative()
    const st = makeStorage({ ebird: local(T_OLD), ml: null })
    const { deps } = makeDeps(n.native, st.storage)
    deps.checkDeadlineMs = 40
    const c = createICloudController(deps)
    await c.boot()
    await c.enable() // a normal first check
    const before = JSON.stringify(getICloudState().slots)
    n.native.readRecord = () => new Promise(() => {})
    const outcome = await c.checkNow()
    expect(outcome.ok).toBe(false)
    expect(getICloudState().checkFailed).toBe(true)
    expect(JSON.stringify(getICloudState().slots)).toBe(before)
  })
})

describe('security round: the write chokepoint sanitizes what it pushes', () => {
  it('a filename and a device label with control characters push a record the validator accepts, so the next check is idempotent', async () => {
    const n = makeNative()
    const st = makeStorage({ ebird: { filename: 'My\u0007EBird\nData.csv', uploadedAt: T_OLD }, ml: null })
    // The macOS label is the computer name, which scutil accepts with a
    // control character in it; the probe reports it as-is.
    const baseStatus = n.native.status
    n.native.status = async () => ({ ...(await baseStatus()), deviceLabel: "Dave\u0007's\tMac" })
    const { deps } = makeDeps(n.native, st.storage)
    const c = createICloudController(deps)
    await c.boot()
    await c.enable()
    const push = n.calls.find(x => x.cmd === 'push')!
    expect(push.args[1]).toBe('MyEBirdData.csv')
    expect((push.args[3] as { label: string }).label).toBe("Dave'sMac")
    // The record the fake native wrote (through serializeRecord, as Rust does) validates...
    expect(validateSharedRecord(n.container.record.ebird, 'ebird', clock).ok).toBe(true)
    // ...so the next check sees "identical" and does not push again.
    await c.checkNow()
    expect(n.calls.filter(x => x.cmd === 'push').length).toBe(1)
    expect(getICloudState().slots.ebird?.state).toBe('up-to-date')
  })
})

// icloud-api-key-sync controller: the key pass inside the check, the key
// switch and its removal, Clear-with-sync through the local marker, and the
// keys epoch (QA-03, QA-04, QA-06 to QA-10, QA-12 to QA-16, QA-18 to QA-21,
// QA-25, QA-27 to QA-29, QA-33, NFR-07). Driven through a fake native layer
// whose container holds the two file records AND the one key record, an
// in-memory storage that keeps the api-keys seam's guard semantics, and the
// REAL validator, sanitizer and reconcile modules underneath.
//
// A sentinel stands in for every key value. QA-16: it may appear ONLY in
// `writeKeys` slot values and in the fake storage; never in the state store,
// a log line, a thrown message, the persisted preference, or any other
// native call argument.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createICloudController, type ControllerDeps, ICLOUD_SYNC_SETTING } from './icloudSync'
import { getICloudState, resetICloudState, installICloudActions } from './icloudState'
import { serializeRecord, type SharedRecord, type Slot } from './icloudRecord'
import { serializeKeyRecord, validateKeyRecord, type SharedKeyEntry } from './keyRecord'
import type { ApiKeyEntries, ApiKeyEntry, ExpectedKeyEntry, FileMetadata, FileOrigin, FilesStatus, KeySlot } from '../storage'
import type { ICloudNativeLayer, KeySlotsInput, NativeKeyRecordStatus, NativeRecordRead, NativeStatus } from './icloudNativeTypes'
import { ICloudNativeError } from './icloudNativeTypes'
import * as copy from './icloudCopy'

const ME = 'a'.repeat(32)
const PEER = 'f'.repeat(32)
const SHA = 'b'.repeat(64)
const T_OLD = '2026-08-20T10:00:00.000Z'
const T_NEW = '2026-08-24T22:12:00.000Z'
const START = Date.parse('2026-09-01T16:00:00.000Z')
let clock = START
const iso = (ms: number) => new Date(ms).toISOString()

// The sentinel values (never real keys). Distinct per slot so a swap is visible.
const S_EBIRD = 'SENTINELebird0xA1B2C3D4'
const S_OW = 'SENTINELopenweather0x9F8E7D6C'
const S_PEER = 'SENTINELpeer0x00FF11EE'
const S_NEW = 'SENTINELnew0x55AA55AA'

const MINE: FileOrigin = { deviceId: ME, label: "Dave's Mac", platform: 'mac' }
const THEIRS: FileOrigin = { deviceId: PEER, label: 'iPhone', platform: 'iphone' }

function sharedKey(value: string, changedAt: string, origin: FileOrigin = THEIRS): SharedKeyEntry {
  return { state: 'key', value, changedAt, origin }
}
function sharedCleared(clearedAt: string, origin: FileOrigin = THEIRS): SharedKeyEntry {
  return { state: 'cleared', clearedAt, origin }
}
function fileRec(slot: Slot, uploadedAt: string, deviceId = PEER, filename = 'MyEBirdData.csv'): SharedRecord {
  return {
    version: 1, slot, state: 'file', filename, uploadedAt,
    origin: { deviceId, label: 'iPhone', platform: 'iphone' }, byteLength: 1000, sha256: SHA,
  }
}

// ── fake native: the container holds file records, csvs and the key record ──
interface Container {
  record: Record<Slot, string | null>
  file: Record<Slot, NativeRecordRead['file']>
  keys: string | null
  keyStatus: NativeKeyRecordStatus
}
const EMPTY_FILE: NativeRecordRead['file'] = { present: false, downloaded: false, downloading: false, byteLength: null, uploaded: false, uploading: false }
const NO_KEYS: NativeKeyRecordStatus = { present: false, downloaded: false, downloading: false, uploaded: false, uploading: false }

function makeNative(status: NativeStatus['state'] = 'available') {
  const container: Container = {
    record: { ebird: null, ml: null },
    file: { ebird: { ...EMPTY_FILE }, ml: { ...EMPTY_FILE } },
    keys: null,
    keyStatus: { ...NO_KEYS },
  }
  const knobs = { pushUploaded: true, keysUploaded: true }
  const calls: Array<{ cmd: string; args: unknown[] }> = []
  const rec = (cmd: string, ...args: unknown[]) => { calls.push({ cmd, args }) }
  const fail: Partial<Record<string, ICloudNativeError>> = {}
  // A deferred write: the test releases it (FR-08 ordering).
  let holdWrite: (() => void) | null = null
  const hooks = { holdNextWrite: false }
  let changed: (() => void) | null = null
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
    async pushCleared(slot, clearedAt, origin) { rec('pushCleared', slot, clearedAt, origin) },
    async pull(slot, sha, len) { rec('pull', slot, sha, len) },
    async startDownload(slot) { rec('startDownload', slot) },
    async removeAll() {
      rec('removeAll')
      let removed = 0
      for (const s of ['ebird', 'ml'] as Slot[]) {
        if (container.record[s]) { removed++; container.record[s] = null }
        if (container.file[s].present) { removed++; container.file[s] = { ...EMPTY_FILE } }
      }
      return { removed }
    },
    async readKeys(mode) {
      rec('readKeys', mode)
      if (fail.readKeys) throw fail.readKeys
      return { record: mode === 'record' ? container.keys : null, status: { ...container.keyStatus, present: container.keys !== null } }
    },
    async writeKeys(deviceId, slots) {
      rec('writeKeys', deviceId, slots)
      if (fail.writeKeys) throw fail.writeKeys
      if (hooks.holdNextWrite) {
        hooks.holdNextWrite = false
        await new Promise<void>((resolve) => { holdWrite = resolve })
      }
      // The Rust writer serializes what the TypeScript chokepoint handed it.
      container.keys = serializeKeyRecord(slots)
      container.keyStatus = { present: true, downloaded: true, downloading: false, uploaded: knobs.keysUploaded, uploading: !knobs.keysUploaded }
      return { uploaded: knobs.keysUploaded }
    },
    async removeKeys() {
      rec('removeKeys')
      if (fail.removeKeys) throw fail.removeKeys
      const removed = container.keys ? 1 : 0
      container.keys = null
      container.keyStatus = { ...NO_KEYS }
      return { removed }
    },
    async watch(enabled) { rec('watch', enabled) },
    async onChanged(cb) { changed = cb; return () => { changed = null } },
    async onIdentityChanged() { return () => {} },
  }
  return {
    native, container, calls, fail, knobs, hooks,
    releaseWrite: () => { holdWrite?.(); holdWrite = null },
    fireChanged: () => changed?.(),
    setSharedFile(slot: Slot, r: SharedRecord | null) {
      container.record[slot] = r ? serializeRecord(r) : null
      container.file[slot] = r?.state === 'file'
        ? { present: true, downloaded: true, downloading: false, byteLength: 1000, uploaded: true, uploading: false }
        : { ...EMPTY_FILE }
    },
    setSharedKeys(slots: Partial<Record<KeySlot, SharedKeyEntry | null>> | null, uploaded = true) {
      container.keys = slots ? serializeKeyRecord(slots) : null
      container.keyStatus = slots ? { present: true, downloaded: true, downloading: false, uploaded, uploading: !uploaded } : { ...NO_KEYS }
    },
    sharedKeys() {
      const v = validateKeyRecord(container.keys, clock)
      return v.ok ? v.slots : null
    },
    cmds: () => calls.map(c => c.cmd),
  }
}

// ── fake storage: the seam's guard semantics, in memory ─────────────────
function sameLocalEntry(current: ApiKeyEntry | null, expect: ExpectedKeyEntry): boolean {
  if (current === null || expect === null) return current === null && expect === null
  if (current.state !== expect.state) return false
  if (current.state === 'key' && expect.state === 'key') return current.value === expect.value && current.changedAt === expect.changedAt
  if (current.state === 'cleared' && expect.state === 'cleared') return current.clearedAt === expect.clearedAt
  return false
}

function makeStorage(meta: FilesStatus = { ebird: null, ml: null }, keys: Partial<Record<KeySlot, ApiKeyEntry | null>> = {}) {
  const settings: Record<string, unknown> = {}
  const files: FilesStatus = { ebird: meta.ebird, ml: meta.ml }
  const entries: ApiKeyEntries = { ebird: keys.ebird ?? null, openweather: keys.openweather ?? null }
  const clone = (e: ApiKeyEntry | null): ApiKeyEntry | null => (e ? JSON.parse(JSON.stringify(e)) : null)
  const hooks = { failNextApply: false }
  const storage: ControllerDeps['storage'] = {
    async getSetting<T>(key: string) { return (settings[key] as T) ?? null },
    async setSetting<T>(key: string, value: T) { settings[key] = JSON.parse(JSON.stringify(value)) },
    async getFilesStatus() { return { ebird: files.ebird, ml: files.ml } },
    async deleteFile(name) { files[name] = null },
    async applySyncedFile(name, entry: FileMetadata, expect, materialize) {
      if ((files[name]?.uploadedAt ?? null) !== expect) return false
      await materialize()
      files[name] = entry
      return true
    },
    async applySyncedClear(name, expect) {
      if ((files[name]?.uploadedAt ?? null) !== expect) return false
      files[name] = null
      return true
    },
    async stampFileOrigin(name, origin: FileOrigin, expectUploadedAt) {
      const cur = files[name]
      if (!cur || cur.uploadedAt !== expectUploadedAt || cur.origin) return false
      files[name] = { ...cur, origin }
      return true
    },
    async getApiKeyEntries() { return { ebird: clone(entries.ebird), openweather: clone(entries.openweather) } },
    async clearApiKeyWithMarker(slot, m) { entries[slot] = { state: 'cleared', clearedAt: m.clearedAt, origin: m.origin } },
    async applySyncedKey(slot, e, expect, replaced) {
      if (hooks.failNextApply) { hooks.failNextApply = false; return false }
      if (!sameLocalEntry(entries[slot], expect)) return false
      entries[slot] = { state: 'key', value: e.value, changedAt: e.changedAt, origin: e.origin, replacedBySyncAt: replaced ? iso(clock) : null }
      return true
    },
    async applySyncedKeyClear(slot, m, expect) {
      if (!sameLocalEntry(entries[slot], expect)) return false
      entries[slot] = { state: 'cleared', clearedAt: m.clearedAt, origin: m.origin }
      return true
    },
    async stampApiKeyEntry(slot, stamp, expectValue) {
      const c = entries[slot]
      if (!c || c.state !== 'key' || c.value !== expectValue) return false
      entries[slot] = { ...c, changedAt: stamp.changedAt, origin: stamp.origin }
      return true
    },
  }
  return {
    storage, settings, files, keys: entries, hooks,
    /** A Settings save: a fresh timed entry, this device when given, never replacedBySyncAt. */
    setKey(slot: KeySlot, value: string, origin: FileOrigin | null = MINE) {
      entries[slot] = { state: 'key', value, changedAt: iso(clock), origin, replacedBySyncAt: null }
    },
    /** A key-switch-off Clear: the entry gone entirely. */
    deleteKey(slot: KeySlot) { entries[slot] = null },
    pref: () => settings[ICLOUD_SYNC_SETTING] as Record<string, unknown> | undefined,
  }
}

function makeDeps(native: ICloudNativeLayer, storage: ControllerDeps['storage']) {
  const invalidate = vi.fn()
  const invalidateKey = vi.fn()
  const notifyFilesChanged = vi.fn()
  const notifyKeysChanged = vi.fn()
  const log = vi.fn()
  const keySubscribers = new Set<() => void>()
  const deps: ControllerDeps = {
    native,
    storage,
    invalidate,
    notifyFilesChanged,
    subscribeFilesChanged: () => () => {},
    invalidateKey,
    notifyKeysChanged,
    subscribeKeysChanged: (cb) => { keySubscribers.add(cb); return () => { keySubscribers.delete(cb) } },
    now: () => clock,
    mintDeviceId: () => ME,
    view: null,
    log,
    pollIntervalMs: 60_000_000,
    eventDebounceMs: 1,
    checkDownloadWaitMs: 5,
    downloadNowWaitMs: 5,
    downloadPollMs: 1,
  }
  return { deps, invalidate, invalidateKey, notifyFilesChanged, notifyKeysChanged, log, fireKeysChanged: () => { for (const cb of keySubscribers) cb() } }
}

const untimed = (value: string): ApiKeyEntry => ({ state: 'key', value, changedAt: null, origin: null, replacedBySyncAt: null })
const timed = (value: string, changedAt: string, origin: FileOrigin | null = MINE): ApiKeyEntry => ({ state: 'key', value, changedAt, origin, replacedBySyncAt: null })
const localFile = (uploadedAt: string): FileMetadata => ({ filename: 'MyEBirdData.csv', uploadedAt, origin: MINE })

/** Boot a controller with file sync on and the key switch on (the common start). */
async function bootOn(n: ReturnType<typeof makeNative>, st: ReturnType<typeof makeStorage>) {
  const made = makeDeps(n.native, st.storage)
  const c = createICloudController(made.deps)
  await c.boot()
  await c.enable()
  await settle()
  await c.enableKeys()
  await settle()
  return { c, ...made }
}
const settle = () => new Promise(r => setTimeout(r, 5))

/** QA-16: every string that could carry a sentinel, other than the fake storage and writeKeys values. */
function everythingButTheSlots(n: ReturnType<typeof makeNative>, st: ReturnType<typeof makeStorage>, log: ReturnType<typeof vi.fn>): string {
  const calls = n.calls.map(c => {
    if (c.cmd !== 'writeKeys') return c
    const slots = JSON.parse(JSON.stringify(c.args[1])) as KeySlotsInput
    for (const slot of ['ebird', 'openweather'] as KeySlot[]) {
      const e = slots[slot]
      if (e && e.state === 'key') (e as { value: string }).value = '<slot>'
    }
    return { cmd: c.cmd, args: [c.args[0], slots] }
  })
  const strings: string[] = [
    JSON.stringify(getICloudState()),
    JSON.stringify(calls),
    JSON.stringify(log.mock.calls),
    JSON.stringify(st.settings),
    copy.keyReplacedText({ label: 'x', platform: 'mac' }, 'now'),
    copy.keyClearedText({ label: 'x', platform: 'mac' }, 'now'),
    ...Object.values(copy.KEY_REASONS),
    ...copy.enableKeysNoteItems('this Mac').flatMap(i => [i.lead, i.text]),
    copy.keyClearBody('ebird', 'this Mac'), copy.removeKeysBody('this Mac'), copy.REMOVE_KEYS_OUTRO, copy.KEY_REMOVAL_PENDING_TEXT,
  ]
  return strings.join('\n')
}
const SENTINELS = [S_EBIRD, S_OW, S_PEER, S_NEW]

beforeEach(() => {
  resetICloudState()
  clock = START
})
afterEach(() => {
  installICloudActions(null)
})

describe('the key switch off (FR-03, FR-36, QA-03) and before Turn on (FR-04, QA-04)', () => {
  it('with the key switch off, only a status read is ever made: no content read, no write, across boot, enable, a check and Remove synced files', async () => {
    const n = makeNative()
    n.setSharedKeys({ ebird: sharedKey(S_PEER, T_NEW) })
    n.setSharedFile('ebird', fileRec('ebird', T_NEW))
    const st = makeStorage({ ebird: null, ml: null }, { ebird: untimed(S_EBIRD) })
    const { deps } = makeDeps(n.native, st.storage)
    const c = createICloudController(deps)
    await c.boot()
    await c.enable()
    await settle()
    await c.checkNow()
    await c.removeFromICloud()
    await settle()
    const keyReads = n.calls.filter(x => x.cmd === 'readKeys')
    expect(keyReads.length).toBeGreaterThan(0)
    for (const r of keyReads) expect(r.args[0]).toBe('status')
    expect(n.cmds()).not.toContain('writeKeys')
    // FR-16: the local key is untouched, and the record only known to exist.
    expect(st.keys.ebird).toEqual(untimed(S_EBIRD))
    expect(getICloudState().keyRecordExists).toBe(true)
    expect(getICloudState().keySyncEnabled).toBe(false)
    // FR-35: Remove synced files left the key record alone.
    expect(n.container.keys).not.toBeNull()
  })

  it('enableKeys is a no-op while the file switch is off, and nothing is written before it (QA-04)', async () => {
    const n = makeNative()
    const st = makeStorage({ ebird: null, ml: null }, { ebird: untimed(S_EBIRD) })
    const { deps } = makeDeps(n.native, st.storage)
    const c = createICloudController(deps)
    await c.boot()
    await c.enableKeys()
    expect(getICloudState().keySyncEnabled).toBe(false)
    expect(n.cmds()).not.toContain('writeKeys')
    expect(n.cmds()).not.toContain('readKeys')
    expect(st.pref()?.keysEnabled).toBeUndefined()
  })
})

describe('the preference (FR-06, QA-06)', () => {
  it('persists, survives a relaunch, reads as off with the file switch off, and never appears in a write', async () => {
    const n = makeNative()
    const st = makeStorage({ ebird: null, ml: null }, { ebird: untimed(S_EBIRD) })
    await bootOn(n, st)
    expect(st.pref()).toMatchObject({ keysEnabled: true, keysEverEnabled: true, enabled: true })
    // Relaunch: still on.
    resetICloudState()
    const c2 = createICloudController(makeDeps(n.native, st.storage).deps)
    await c2.boot()
    await settle()
    expect(getICloudState().keySyncEnabled).toBe(true)
    expect(getICloudState().keySyncEverOn).toBe(true)
    // A persisted preference with the key switch on and the file switch off reads as off.
    st.settings[ICLOUD_SYNC_SETTING] = { ...(st.pref() ?? {}), enabled: false, keysEnabled: true }
    resetICloudState()
    const c3 = createICloudController(makeDeps(n.native, st.storage).deps)
    await c3.boot()
    expect(getICloudState().keySyncEnabled).toBe(false)
    expect(getICloudState().syncEnabled).toBe(false)
    // The preference never appears in the record written.
    for (const w of n.calls.filter(x => x.cmd === 'writeKeys')) {
      const text = JSON.stringify(w.args)
      expect(text).not.toContain('keysEnabled')
      expect(text).not.toContain('icloud-sync')
    }
  })
})

describe('seeding and receiving (FR-13, FR-14, FR-23, QA-12, QA-18, QA-20)', () => {
  it('an untimed local key and nothing shared: uploaded as the seed with the upload time and this device, the local key stamped identically', async () => {
    const n = makeNative()
    const st = makeStorage({ ebird: null, ml: null }, { ebird: untimed(S_EBIRD) })
    const { invalidateKey, notifyKeysChanged } = await bootOn(n, st)
    const writes = n.calls.filter(x => x.cmd === 'writeKeys')
    expect(writes.length).toBe(1)
    expect(writes[0].args[0]).toBe(ME)
    const shared = n.sharedKeys()!
    expect(shared.ebird).toEqual({ state: 'key', value: S_EBIRD, changedAt: iso(START), origin: MINE })
    expect(shared.openweather).toBeNull()
    expect(st.keys.ebird).toEqual({ state: 'key', value: S_EBIRD, changedAt: iso(START), origin: MINE, replacedBySyncAt: null })
    expect(getICloudState().keySlots.ebird).toMatchObject({ state: 'up-to-date', fromThisDevice: true, changedAt: iso(START) })
    expect(getICloudState().keySlots.openweather).toBeNull()
    expect(getICloudState().keyRecordExists).toBe(true)
    expect(invalidateKey).not.toHaveBeenCalled()
    expect(notifyKeysChanged).not.toHaveBeenCalled()
  })

  it('an untimed local key against ANY shared entry: the shared entry wins (apply, replaced; the row says so, FR-41)', async () => {
    const n = makeNative()
    n.setSharedKeys({ ebird: sharedKey(S_PEER, T_NEW) })
    const st = makeStorage({ ebird: null, ml: null }, { ebird: untimed(S_EBIRD) })
    const { invalidateKey, notifyKeysChanged } = await bootOn(n, st)
    expect(st.keys.ebird).toMatchObject({ state: 'key', value: S_PEER, changedAt: T_NEW, origin: THEIRS })
    expect(st.keys.ebird?.state === 'key' && st.keys.ebird.replacedBySyncAt).toBeTruthy()
    expect(getICloudState().keySlots.ebird).toMatchObject({ state: 'up-to-date', fromThisDevice: false, origin: { label: 'iPhone', platform: 'iphone' }, replacedAt: T_NEW, changedAt: T_NEW })
    expect(invalidateKey).toHaveBeenCalledWith('ebird')
    expect(notifyKeysChanged).toHaveBeenCalledTimes(1)
    expect(n.cmds()).not.toContain('writeKeys') // nothing to push
  })

  it('a device with no key takes the shared one through the seam with the shared time and origin (QA-18), and the Replaced line persists across the next check until a user save', async () => {
    const n = makeNative()
    n.setSharedKeys({ ebird: sharedKey(S_PEER, T_NEW), openweather: sharedKey(S_OW, T_OLD) })
    const st = makeStorage()
    const { c } = await bootOn(n, st)
    expect(st.keys.ebird).toMatchObject({ state: 'key', value: S_PEER, changedAt: T_NEW, origin: THEIRS, replacedBySyncAt: null })
    expect(getICloudState().keySlots.ebird).toMatchObject({ state: 'up-to-date', fromThisDevice: false })
    expect(getICloudState().keySlots.ebird?.replacedAt).toBeUndefined() // nothing was replaced (FR-41 is for a replaced key)
    // A different local key, OLDER than the shared entry, is replaced: the
    // line persists across a no-op check.
    st.keys.openweather = timed(S_NEW, '2026-08-10T00:00:00.000Z', MINE)
    await c.checkNow()
    expect(getICloudState().keySlots.openweather?.replacedAt).toBe(T_OLD)
    await c.checkNow()
    expect(getICloudState().keySlots.openweather?.replacedAt).toBe(T_OLD)
    // The next user action on the row clears it (a fresh entry, then pushed).
    clock += 1000
    st.setKey('openweather', S_NEW, MINE)
    await c.checkNow()
    expect(getICloudState().keySlots.openweather?.replacedAt).toBeUndefined()
    expect(n.sharedKeys()!.openweather).toMatchObject({ value: S_NEW, origin: MINE })
  })

  it('a received key identical to the local key transfers nothing, reads Up to date, never Replaced, and adopts the shared time and origin (QA-20, OQ-3)', async () => {
    const n = makeNative()
    n.setSharedKeys({ ebird: sharedKey(S_EBIRD, T_NEW) })
    const st = makeStorage({ ebird: null, ml: null }, { ebird: untimed(S_EBIRD) })
    const { invalidateKey, notifyKeysChanged } = await bootOn(n, st)
    expect(n.cmds()).not.toContain('writeKeys')
    expect(invalidateKey).not.toHaveBeenCalled()
    expect(notifyKeysChanged).not.toHaveBeenCalled()
    expect(st.keys.ebird).toEqual({ state: 'key', value: S_EBIRD, changedAt: T_NEW, origin: THEIRS, replacedBySyncAt: null })
    expect(getICloudState().keySlots.ebird).toMatchObject({ state: 'up-to-date', fromThisDevice: false, origin: { label: 'iPhone', platform: 'iphone' }, changedAt: T_NEW })
    expect(getICloudState().keySlots.ebird?.replacedAt).toBeUndefined()
  })

  it('a timed local key newer than the shared one replaces the shared entry whole (push)', async () => {
    const n = makeNative()
    n.setSharedKeys({ ebird: sharedKey(S_PEER, T_OLD) })
    const st = makeStorage({ ebird: null, ml: null }, { ebird: timed(S_EBIRD, T_NEW) })
    await bootOn(n, st)
    expect(n.sharedKeys()!.ebird).toEqual({ state: 'key', value: S_EBIRD, changedAt: T_NEW, origin: MINE })
    expect(st.keys.ebird?.state === 'key' && st.keys.ebird.value).toBe(S_EBIRD)
  })

  it('a timed key with no origin is pushed as this device and stamped after the write', async () => {
    const n = makeNative()
    const st = makeStorage({ ebird: null, ml: null }, { ebird: timed(S_EBIRD, T_NEW, null) })
    await bootOn(n, st)
    expect(n.sharedKeys()!.ebird).toEqual({ state: 'key', value: S_EBIRD, changedAt: T_NEW, origin: MINE })
    expect(st.keys.ebird).toMatchObject({ changedAt: T_NEW, origin: MINE })
  })
})

describe('cleared markers (FR-24, FR-28 to FR-30, QA-19, QA-23 to QA-25)', () => {
  it('a newer shared marker removes the local key through the guarded link, invalidates, notifies, and the row says who cleared it (QA-19, FR-42)', async () => {
    const n = makeNative()
    n.setSharedKeys({ ebird: sharedCleared(T_NEW) })
    const st = makeStorage({ ebird: null, ml: null }, { ebird: timed(S_EBIRD, T_OLD) })
    const { invalidateKey, notifyKeysChanged, c } = await bootOn(n, st)
    expect(st.keys.ebird).toEqual({ state: 'cleared', clearedAt: T_NEW, origin: THEIRS })
    expect(invalidateKey).toHaveBeenCalledWith('ebird')
    expect(notifyKeysChanged).toHaveBeenCalledTimes(1)
    expect(getICloudState().keySlots.ebird).toEqual({ state: 'up-to-date', fromThisDevice: false, origin: { label: 'iPhone', platform: 'iphone' }, clearedAt: T_NEW })
    expect(n.cmds()).not.toContain('writeKeys')
    // The line stays until the next arrival: another check changes nothing.
    await c.checkNow()
    expect(getICloudState().keySlots.ebird?.clearedAt).toBe(T_NEW)
  })

  it('a local key newer than the shared marker is kept and uploaded, replacing the marker (FR-29, QA-24)', async () => {
    const n = makeNative()
    n.setSharedKeys({ ebird: sharedCleared(T_OLD) })
    const st = makeStorage({ ebird: null, ml: null }, { ebird: timed(S_EBIRD, T_NEW) })
    await bootOn(n, st)
    expect(st.keys.ebird?.state === 'key' && st.keys.ebird.value).toBe(S_EBIRD)
    expect(n.sharedKeys()!.ebird).toMatchObject({ state: 'key', value: S_EBIRD })
  })

  it('clearKeyWithSync: the local key goes at once with a marker, invalidates, notifies, the marker goes up, and the row settles to today\'s empty state (QA-23)', async () => {
    const n = makeNative()
    const st = makeStorage({ ebird: null, ml: null }, { ebird: timed(S_EBIRD, T_OLD), openweather: timed(S_OW, T_OLD) })
    const { c, invalidateKey, notifyKeysChanged } = await bootOn(n, st)
    invalidateKey.mockClear()
    notifyKeysChanged.mockClear()
    clock += 10_000
    await c.clearKeyWithSync('ebird')
    await settle()
    expect(st.keys.ebird).toEqual({ state: 'cleared', clearedAt: iso(clock), origin: MINE })
    expect(invalidateKey).toHaveBeenCalledWith('ebird')
    expect(notifyKeysChanged).toHaveBeenCalledTimes(1)
    const shared = n.sharedKeys()!
    expect(shared.ebird).toEqual({ state: 'cleared', clearedAt: iso(clock), origin: MINE })
    expect(shared.openweather).toMatchObject({ state: 'key', value: S_OW }) // the other slot untouched
    expect(getICloudState().keySlots.ebird).toBeNull()
    expect(getICloudState().keySlots.openweather?.state).toBe('up-to-date')
  })

  it('Clear while iCloud is unreachable: the local key is removed at once, the row says the clear has not reached iCloud, and the marker goes up at the next reachable check with the ORIGINAL time (QA-25)', async () => {
    const n = makeNative()
    const st = makeStorage({ ebird: null, ml: null }, { ebird: timed(S_EBIRD, T_OLD) })
    const { c } = await bootOn(n, st)
    n.fail.readKeys = new ICloudNativeError('timeout')
    clock += 10_000
    const clearedAt = iso(clock)
    await c.clearKeyWithSync('ebird')
    await settle()
    expect(st.keys.ebird).toEqual({ state: 'cleared', clearedAt, origin: MINE })
    expect(getICloudState().keySlots.ebird).toEqual({ state: 'waiting-to-upload', fromThisDevice: true, clearPending: true })
    expect(n.sharedKeys()!.ebird).toMatchObject({ state: 'key' }) // still the key in iCloud
    delete n.fail.readKeys
    clock += 60_000
    await c.checkNow()
    expect(n.sharedKeys()!.ebird).toEqual({ state: 'cleared', clearedAt, origin: MINE })
    expect(getICloudState().keySlots.ebird).toBeNull()
  })

  it('a device B that sets a key after A\'s Clear but before seeing it keeps its key; iCloud holds B\'s key; A adopts it (QA-24, latest event wins)', async () => {
    const n = makeNative()
    // A cleared at T_OLD (the marker is in iCloud).
    n.setSharedKeys({ ebird: sharedCleared(T_OLD, MINE) })
    // B set a key later, before its first check.
    const stB = makeStorage({ ebird: null, ml: null }, { ebird: timed(S_NEW, T_NEW, THEIRS) })
    const depsB = makeDeps(n.native, stB.storage)
    depsB.deps.mintDeviceId = () => PEER
    const b = createICloudController(depsB.deps)
    await b.boot(); await b.enable(); await settle(); await b.enableKeys(); await settle()
    expect(stB.keys.ebird?.state === 'key' && stB.keys.ebird.value).toBe(S_NEW)
    expect(n.sharedKeys()!.ebird).toMatchObject({ state: 'key', value: S_NEW, origin: THEIRS })
    // A (holding its own marker) now adopts B's key.
    resetICloudState()
    const stA = makeStorage({ ebird: null, ml: null }, { ebird: { state: 'cleared', clearedAt: T_OLD, origin: MINE } })
    await bootOn(n, stA)
    expect(stA.keys.ebird).toMatchObject({ state: 'key', value: S_NEW, changedAt: T_NEW, origin: THEIRS })
  })
})

describe('two devices converge (FR-15, QA-13)', () => {
  it('a set on A and a Clear on B within one minute: after one check each, both hold no key', async () => {
    const n = makeNative()
    // A: set at START, checks first (its key goes up).
    const stA = makeStorage({ ebird: null, ml: null }, { ebird: timed(S_EBIRD, iso(START), MINE) })
    const { c: a } = await bootOn(n, stA)
    expect(n.sharedKeys()!.ebird).toMatchObject({ value: S_EBIRD })
    // B: cleared 30 s later, checks second (its marker is newer than A's key).
    resetICloudState()
    const stB = makeStorage({ ebird: null, ml: null }, { ebird: { state: 'cleared', clearedAt: iso(START + 30_000), origin: THEIRS } })
    const depsB = makeDeps(n.native, stB.storage)
    depsB.deps.mintDeviceId = () => PEER
    clock = START + 40_000
    const b = createICloudController(depsB.deps)
    await b.boot(); await b.enable(); await settle(); await b.enableKeys(); await settle()
    expect(n.sharedKeys()!.ebird).toEqual({ state: 'cleared', clearedAt: iso(START + 30_000), origin: THEIRS })
    expect(stB.keys.ebird?.state).toBe('cleared')
    // A's next check: the marker is newer than its key, so the key goes.
    clock = START + 50_000
    await a.checkNow()
    expect(stA.keys.ebird).toEqual({ state: 'cleared', clearedAt: iso(START + 30_000), origin: THEIRS })
    expect(stB.keys.ebird).toEqual({ state: 'cleared', clearedAt: iso(START + 30_000), origin: THEIRS })
  })

  it('two different sets within one minute: both end with the later one, same origin and time', async () => {
    const n = makeNative()
    const stA = makeStorage({ ebird: null, ml: null }, { ebird: timed(S_EBIRD, iso(START), MINE) })
    const { c: a } = await bootOn(n, stA)
    resetICloudState()
    const stB = makeStorage({ ebird: null, ml: null }, { ebird: timed(S_NEW, iso(START + 1000), THEIRS) })
    const depsB = makeDeps(n.native, stB.storage)
    depsB.deps.mintDeviceId = () => PEER
    clock = START + 5000
    const b = createICloudController(depsB.deps)
    await b.boot(); await b.enable(); await settle(); await b.enableKeys(); await settle()
    await a.checkNow()
    const want = { state: 'key', value: S_NEW, changedAt: iso(START + 1000), origin: THEIRS }
    expect(stA.keys.ebird).toMatchObject(want)
    expect(stB.keys.ebird).toMatchObject(want)
    expect(n.sharedKeys()!.ebird).toEqual(want)
  })
})

describe('turning off and removal (FR-07, FR-32 to FR-35, FR-37, QA-07, QA-27 to QA-29)', () => {
  it('disableKeys: no further key reads or writes, local keys intact, the record gone, rows read Sync off (QA-27, FR-40)', async () => {
    const n = makeNative()
    const st = makeStorage({ ebird: null, ml: null }, { ebird: untimed(S_EBIRD) })
    const { c } = await bootOn(n, st)
    expect(n.container.keys).not.toBeNull()
    const before = n.calls.length
    await c.disableKeys()
    expect(n.cmds().slice(before)).toContain('removeKeys')
    expect(n.container.keys).toBeNull()
    expect(st.keys.ebird?.state === 'key' && st.keys.ebird.value).toBe(S_EBIRD)
    expect(getICloudState().keySyncEnabled).toBe(false)
    expect(getICloudState().keyRecordExists).toBe(false)
    expect(getICloudState().keySlots.ebird).toEqual({ state: 'off', fromThisDevice: false })
    expect(getICloudState().keySlots.openweather).toBeNull()
    const after = n.calls.length
    await c.checkNow()
    const later = n.calls.slice(after).map(x => ({ cmd: x.cmd, mode: x.args[0] }))
    expect(later.some(x => x.cmd === 'writeKeys')).toBe(false)
    expect(later.filter(x => x.cmd === 'readKeys').every(x => x.mode === 'status')).toBe(true)
  })

  it('the file switch off turns the key switch off in the same action, removes the record, and leaves the files and their records alone (QA-07, FR-37); turning the file switch back on leaves keys off', async () => {
    const n = makeNative()
    const st = makeStorage({ ebird: localFile(T_OLD), ml: null }, { ebird: untimed(S_EBIRD) })
    const { c } = await bootOn(n, st)
    expect(n.container.keys).not.toBeNull()
    expect(n.container.record.ebird).not.toBeNull()
    await c.disable()
    expect(getICloudState().syncEnabled).toBe(false)
    expect(getICloudState().keySyncEnabled).toBe(false)
    expect(n.container.keys).toBeNull()
    expect(n.container.record.ebird).not.toBeNull() // FR-37
    expect(st.files.ebird?.uploadedAt).toBe(T_OLD)
    expect(st.keys.ebird?.state === 'key' && st.keys.ebird.value).toBe(S_EBIRD)
    expect(st.pref()).toMatchObject({ enabled: false, keysEnabled: false })
    await c.enable()
    await settle()
    expect(getICloudState().syncEnabled).toBe(true)
    expect(getICloudState().keySyncEnabled).toBe(false)
    expect(n.container.keys).toBeNull()
  })

  it('a switch-off while iCloud is unreachable leaves the removal pending, retried by the next check; the Remove control stays until the copy is gone (QA-28)', async () => {
    const n = makeNative()
    const st = makeStorage({ ebird: null, ml: null }, { ebird: untimed(S_EBIRD) })
    const { c } = await bootOn(n, st)
    n.fail.removeKeys = new ICloudNativeError('unavailable')
    await c.disableKeys()
    expect(getICloudState().keySyncEnabled).toBe(false)
    expect(getICloudState().keyRemovalPending).toBe(true)
    expect(getICloudState().keyRecordExists).toBe(true)
    expect(st.pref()).toMatchObject({ keyRemovalPending: true, knownKeyRecord: true })
    expect(st.keys.ebird?.state === 'key' && st.keys.ebird.value).toBe(S_EBIRD)
    expect(n.container.keys).not.toBeNull()
    // The next check (file sync still on) retries and succeeds.
    delete n.fail.removeKeys
    await c.checkNow()
    expect(getICloudState().keyRemovalPending).toBe(false)
    expect(getICloudState().keyRecordExists).toBe(false)
    expect(n.container.keys).toBeNull()
  })

  it('a pending removal is retried at launch (OQ-1)', async () => {
    const n = makeNative()
    const st = makeStorage({ ebird: null, ml: null }, { ebird: untimed(S_EBIRD) })
    const { c } = await bootOn(n, st)
    n.fail.removeKeys = new ICloudNativeError('timeout')
    await c.disable() // the cascade: keys off, then files off
    expect(getICloudState().keyRemovalPending).toBe(true)
    delete n.fail.removeKeys
    resetICloudState()
    const c2 = createICloudController(makeDeps(n.native, st.storage).deps)
    await c2.boot()
    await settle()
    expect(n.container.keys).toBeNull()
    expect(getICloudState().keyRemovalPending).toBe(false)
    expect(getICloudState().keyRecordExists).toBe(false)
    expect(getICloudState().syncEnabled).toBe(false)
  })

  it('removeKeysFromICloud deletes only the key record, writes no marker, leaves local keys, and a sharing device uploads again at its next check (QA-29)', async () => {
    const n = makeNative()
    n.setSharedFile('ebird', fileRec('ebird', T_NEW))
    const st = makeStorage({ ebird: null, ml: null }, { ebird: untimed(S_EBIRD), openweather: untimed(S_OW) })
    const { c } = await bootOn(n, st)
    const writesBefore = n.calls.filter(x => x.cmd === 'writeKeys').length
    await c.removeKeysFromICloud()
    await settle()
    expect(n.cmds()).toContain('removeKeys')
    expect(n.cmds()).not.toContain('pushCleared')
    expect(st.keys.ebird?.state === 'key' && st.keys.ebird.value).toBe(S_EBIRD)
    expect(n.container.record.ebird).not.toBeNull() // the file record is untouched
    // With the switch on, the confirmation says it: the keys go up again.
    expect(n.calls.filter(x => x.cmd === 'writeKeys').length).toBe(writesBefore + 1)
    expect(n.sharedKeys()!.ebird).toMatchObject({ value: S_EBIRD })
    expect(n.sharedKeys()!.openweather).toMatchObject({ value: S_OW })
    expect(getICloudState().keyRecordExists).toBe(true)
  })

  it('removeKeysFromICloud with the switch off leaves iCloud empty and the rows Sync off; Remove synced files never touches the key record (FR-35)', async () => {
    const n = makeNative()
    n.setSharedFile('ebird', fileRec('ebird', T_NEW))
    const st = makeStorage({ ebird: null, ml: null }, { ebird: untimed(S_EBIRD) })
    const { c } = await bootOn(n, st)
    // Put the record back as if another device re-uploaded it, then switch off with the removal failing.
    await c.disableKeys()
    n.setSharedKeys({ ebird: sharedKey(S_PEER, T_NEW) })
    await c.checkNow() // status-only: learns the record exists
    expect(getICloudState().keyRecordExists).toBe(true)
    await c.removeFromICloud() // files
    expect(n.container.keys).not.toBeNull()
    await c.removeKeysFromICloud()
    expect(n.container.keys).toBeNull()
    expect(getICloudState().keyRecordExists).toBe(false)
    expect(getICloudState().keySlots.ebird).toEqual({ state: 'off', fromThisDevice: false })
    expect(st.keys.ebird?.state === 'key' && st.keys.ebird.value).toBe(S_EBIRD)
  })

  it('a device where the key switch was never on and iCloud holds no record renders no key sync line at all (FR-40, QA-32)', async () => {
    const n = makeNative()
    const st = makeStorage({ ebird: null, ml: null }, { ebird: untimed(S_EBIRD) })
    const { deps } = makeDeps(n.native, st.storage)
    const c = createICloudController(deps)
    await c.boot()
    await c.enable()
    await settle()
    expect(getICloudState().keySlots).toEqual({ ebird: null, openweather: null })
  })
})

describe('settling (FR-08, QA-08) and one check for both passes (FR-43, NFR-07, QA-33)', () => {
  it('a write that began under on and completes after off is followed by the removal, so no record is left', async () => {
    const n = makeNative()
    const st = makeStorage({ ebird: null, ml: null }, { ebird: untimed(S_EBIRD) })
    const made = makeDeps(n.native, st.storage)
    const c = createICloudController(made.deps)
    await c.boot()
    await c.enable()
    await settle()
    n.hooks.holdNextWrite = true
    const enabling = c.enableKeys()
    await settle()
    expect(n.cmds()).toContain('writeKeys') // the write is in flight, held
    const disabling = c.disableKeys()
    await settle()
    expect(n.cmds()).not.toContain('removeKeys') // waits for the in-flight check
    n.releaseWrite()
    await enabling
    await disabling
    await settle()
    const cmds = n.cmds()
    expect(cmds.lastIndexOf('removeKeys')).toBeGreaterThan(cmds.indexOf('writeKeys'))
    expect(n.container.keys).toBeNull()
    expect(getICloudState().keySyncEnabled).toBe(false)
    expect(getICloudState().keyRecordExists).toBe(false)
  })

  it('ten rapid toggles of the key switch settle on the last change with at most one check in flight and one queued', async () => {
    const n = makeNative()
    const st = makeStorage({ ebird: null, ml: null }, { ebird: untimed(S_EBIRD) })
    const { c } = await bootOn(n, st)
    const before = c.checksRun
    const ops: Promise<void>[] = []
    for (let i = 0; i < 10; i++) ops.push(i % 2 === 0 ? c.disableKeys() : c.enableKeys())
    await Promise.all(ops)
    await settle()
    // The last change was an enable (i = 9).
    expect(getICloudState().keySyncEnabled).toBe(true)
    expect(c.checksRun - before).toBeLessThanOrEqual(10)
    expect(st.keys.ebird?.state === 'key' && st.keys.ebird.value).toBe(S_EBIRD)
    // One more settled check: the record holds this device's key and nothing else moves.
    await c.checkNow()
    expect(n.sharedKeys()!.ebird).toMatchObject({ value: S_EBIRD })
  })

  it('Check now runs both passes: one lastCheckAt write, readKeys once and writeKeys at most once per check; nothing to transfer writes nothing', async () => {
    const n = makeNative()
    const st = makeStorage({ ebird: localFile(T_OLD), ml: null }, { ebird: untimed(S_EBIRD) })
    const { c } = await bootOn(n, st)
    const before = n.calls.length
    const setBefore = (st.pref() as { lastCheckAt: string }).lastCheckAt
    clock += 1000
    const outcome = await c.checkNow()
    expect(outcome.ok).toBe(true)
    const cmds = n.cmds().slice(before)
    expect(cmds.filter(x => x === 'readRecord').length).toBe(2)
    expect(cmds.filter(x => x === 'readKeys').length).toBe(1)
    expect(cmds.filter(x => x === 'writeKeys').length).toBe(0)
    expect(cmds).not.toContain('push')
    expect((st.pref() as { lastCheckAt: string }).lastCheckAt).toBe(iso(clock))
    expect((st.pref() as { lastCheckAt: string }).lastCheckAt).not.toBe(setBefore)
    expect(outcome.at).toBe(iso(clock))
  })

  it('a key epoch from Settings (not the controller\'s own) requests a check', async () => {
    const n = makeNative()
    const st = makeStorage({ ebird: null, ml: null }, { ebird: untimed(S_EBIRD) })
    const { c, fireKeysChanged } = await bootOn(n, st)
    const before = c.checksRun
    st.setKey('openweather', S_OW, MINE)
    fireKeysChanged()
    await settle()
    expect(c.checksRun - before).toBe(1)
    expect(n.sharedKeys()!.openweather).toMatchObject({ value: S_OW })
  })

  it('keySaved shows Syncing at once and pushes at the check; retryKey re-runs the check', async () => {
    const n = makeNative()
    const st = makeStorage({ ebird: null, ml: null }, { ebird: untimed(S_EBIRD) })
    const { c } = await bootOn(n, st)
    clock += 1000
    st.setKey('openweather', S_OW, MINE)
    c.keySaved('openweather')
    expect(getICloudState().keySlots.openweather?.state).toBe('syncing')
    await settle()
    expect(getICloudState().keySlots.openweather).toMatchObject({ state: 'up-to-date', fromThisDevice: true, changedAt: iso(clock) })
    const before = c.checksRun
    await c.retryKey('ebird')
    expect(c.checksRun - before).toBe(1)
  })
})

describe('offline and failure (FR-27, NFR-06)', () => {
  it('a key read that times out after the file pass answered: unpushed changes read Waiting to upload, other keys read Could not sync with Retry, and lastCheckAt is kept', async () => {
    const n = makeNative()
    const st = makeStorage({ ebird: null, ml: null }, { ebird: untimed(S_EBIRD), openweather: untimed(S_OW) })
    const { c } = await bootOn(n, st)
    const at = getICloudState().lastCheckAt
    clock += 1000
    st.setKey('openweather', S_NEW, MINE) // an unpushed change
    n.fail.readKeys = new ICloudNativeError('timeout')
    const outcome = await c.checkNow()
    expect(outcome.ok).toBe(false)
    expect(getICloudState().checkFailed).toBe(true)
    expect(getICloudState().lastCheckAt).toBe(at)
    expect(getICloudState().keySlots.openweather).toMatchObject({ state: 'waiting-to-upload', fromThisDevice: true })
    expect(getICloudState().keySlots.ebird).toMatchObject({ state: 'error', reason: copy.KEY_REASONS.timeout })
    // Local keys untouched.
    expect(st.keys.ebird?.state === 'key' && st.keys.ebird.value).toBe(S_EBIRD)
    expect(st.keys.openweather?.state === 'key' && st.keys.openweather.value).toBe(S_NEW)
  })

  it('a write the daemon has not uploaded yet reads Waiting to upload, then Up to date once iCloud holds it (FR-27)', async () => {
    const n = makeNative()
    n.knobs.keysUploaded = false
    const st = makeStorage({ ebird: null, ml: null }, { ebird: untimed(S_EBIRD) })
    const { c } = await bootOn(n, st)
    expect(getICloudState().keySlots.ebird).toMatchObject({ state: 'waiting-to-upload', fromThisDevice: true })
    await c.checkNow()
    expect(getICloudState().keySlots.ebird?.state).toBe('waiting-to-upload')
    expect(n.calls.filter(x => x.cmd === 'writeKeys').length).toBe(1) // identical: no re-push
    n.container.keyStatus = { ...n.container.keyStatus, uploaded: true, uploading: false }
    await c.checkNow()
    expect(getICloudState().keySlots.ebird?.state).toBe('up-to-date')
  })

  it('a write that times out reads Waiting to upload and is pushed by the next reachable check', async () => {
    const n = makeNative()
    n.fail.writeKeys = new ICloudNativeError('timeout')
    const st = makeStorage({ ebird: null, ml: null }, { ebird: timed(S_EBIRD, T_NEW) })
    const { c } = await bootOn(n, st)
    expect(getICloudState().keySlots.ebird).toMatchObject({ state: 'waiting-to-upload', fromThisDevice: true })
    expect(n.container.keys).toBeNull()
    delete n.fail.writeKeys
    await c.checkNow()
    expect(n.sharedKeys()!.ebird).toMatchObject({ value: S_EBIRD })
    expect(getICloudState().keySlots.ebird?.state).toBe('up-to-date')
  })

  it('iCloud unavailable: keys read iCloud unavailable with their provenance, an unpushed Clear says so, local keys untouched', async () => {
    let state: NativeStatus['state'] = 'available'
    const n = makeNative()
    const base = n.native.status
    n.native.status = async () => ({ ...(await base()), state })
    const st = makeStorage({ ebird: null, ml: null }, { ebird: untimed(S_EBIRD), openweather: untimed(S_OW) })
    const { c } = await bootOn(n, st)
    state = 'not-signed-in'
    n.fail.readKeys = new ICloudNativeError('unavailable')
    clock += 1000
    await c.clearKeyWithSync('openweather')
    await c.checkNow()
    expect(getICloudState().availability).toBe('not-signed-in')
    expect(getICloudState().keySlots.ebird).toMatchObject({ state: 'unavailable', fromThisDevice: true, changedAt: iso(START) })
    expect(getICloudState().keySlots.openweather).toEqual({ state: 'waiting-to-upload', fromThisDevice: true, clearPending: true })
    expect(st.keys.ebird?.state === 'key' && st.keys.ebird.value).toBe(S_EBIRD)
  })

  it('a user save landing while a check applies a received entry wins and is pushed at the next check (FR-26, QA-21)', async () => {
    const n = makeNative()
    n.setSharedKeys({ ebird: sharedKey(S_PEER, T_NEW) })
    const st = makeStorage()
    st.hooks.failNextApply = true // the guard sees a changed local entry
    const { c } = await bootOn(n, st)
    // The user's save (what the guard protected) is in the store, and nothing was clobbered.
    clock += 1000
    st.setKey('ebird', S_NEW, MINE)
    await c.checkNow()
    expect(st.keys.ebird?.state === 'key' && st.keys.ebird.value).toBe(S_NEW)
    expect(n.sharedKeys()!.ebird).toMatchObject({ value: S_NEW, origin: MINE })
  })
})

describe('the record is untrusted (FR-20, QA-15) and a key value never leaves its slot (FR-21, FR-44, QA-16)', () => {
  it('a malformed slot is treated as absent, logged by rule only, and overwritten by this device\'s entry at the same check; the other slot still applies', async () => {
    const n = makeNative()
    n.container.keys = JSON.stringify({
      version: 1, kind: 'keys',
      slots: {
        ebird: { state: 'key', value: 'has space', changedAt: T_NEW, origin: THEIRS },
        openweather: sharedKey(S_OW, T_NEW),
      },
    })
    n.container.keyStatus = { present: true, downloaded: true, downloading: false, uploaded: true, uploading: false }
    const st = makeStorage({ ebird: null, ml: null }, { ebird: timed(S_EBIRD, T_OLD) })
    const { log } = await bootOn(n, st)
    expect(st.keys.ebird?.state === 'key' && st.keys.ebird.value).toBe(S_EBIRD) // never deleted
    expect(st.keys.openweather).toMatchObject({ state: 'key', value: S_OW })
    expect(n.sharedKeys()!.ebird).toMatchObject({ value: S_EBIRD }) // healed
    expect(log).toHaveBeenCalledWith(expect.stringContaining('slot ebird rejected (value)'))
    expect(JSON.stringify(log.mock.calls)).not.toContain('has space')
  })

  it('an unparseable envelope reads as absent for both slots: local keys pushed, never deleted', async () => {
    const n = makeNative()
    n.container.keys = '{not json'
    n.container.keyStatus = { present: true, downloaded: true, downloading: false, uploaded: true, uploading: false }
    const st = makeStorage({ ebird: null, ml: null }, { ebird: timed(S_EBIRD, T_OLD), openweather: untimed(S_OW) })
    const { log } = await bootOn(n, st)
    expect(st.keys.ebird?.state === 'key' && st.keys.ebird.value).toBe(S_EBIRD)
    expect(n.sharedKeys()!.ebird).toMatchObject({ value: S_EBIRD })
    expect(n.sharedKeys()!.openweather).toMatchObject({ value: S_OW })
    expect(log).toHaveBeenCalledWith(expect.stringContaining('key record rejected (malformed-json)'))
  })

  it('a local key outside the bound reads Could not sync (key-shape) and is neither uploaded nor replaced; the other slot syncs', async () => {
    const n = makeNative()
    const st = makeStorage({ ebird: null, ml: null }, { ebird: untimed('has space'), openweather: untimed(S_OW) })
    await bootOn(n, st)
    expect(getICloudState().keySlots.ebird).toMatchObject({ state: 'error', reason: copy.KEY_REASONS['key-shape'] })
    expect(st.keys.ebird?.state === 'key' && st.keys.ebird.value).toBe('has space')
    expect(n.sharedKeys()!.ebird).toBeNull()
    expect(n.sharedKeys()!.openweather).toMatchObject({ value: S_OW })
  })

  // ── Security fix round (security-report.md Findings 1 to 3) ──

  it('Finding 1: a local key changed past the one-day allowance (a clock a day ahead) is never written, reads Could not sync (key-time), and the next check writes nothing again; the other slot syncs', async () => {
    const n = makeNative()
    const ahead = iso(START + 25 * 60 * 60 * 1000)
    const st = makeStorage({ ebird: null, ml: null }, { ebird: timed(S_EBIRD, ahead), openweather: untimed(S_OW) })
    const { c } = await bootOn(n, st)
    const writes = () => n.calls.filter(x => x.cmd === 'writeKeys')
    expect(writes()).toHaveLength(1)
    expect((writes()[0].args[1] as KeySlotsInput).ebird).toBeUndefined()
    expect(n.sharedKeys()!.ebird).toBeNull()
    expect(n.sharedKeys()!.openweather).toMatchObject({ value: S_OW })
    expect(getICloudState().keySlots.ebird).toMatchObject({ state: 'error', reason: copy.KEY_REASONS['key-time'] })
    expect(getICloudState().keySlots.openweather).toMatchObject({ state: 'up-to-date' })
    // No ping-pong: the next check finds nothing to write and says the same thing.
    await c.checkNow()
    expect(writes()).toHaveLength(1)
    expect(getICloudState().keySlots.ebird).toMatchObject({ state: 'error', reason: copy.KEY_REASONS['key-time'] })
    // The local key is untouched, and no writeKeys argument ever carried the skewed time.
    expect(st.keys.ebird?.state === 'key' && st.keys.ebird.value).toBe(S_EBIRD)
    expect(JSON.stringify(writes())).not.toContain(ahead)
  })

  it('Finding 1: a local cleared marker dated before 2000 is not pushed, its row says so, and the other slot syncs', async () => {
    const n = makeNative()
    const st = makeStorage({ ebird: null, ml: null }, { openweather: untimed(S_OW) })
    await st.storage.clearApiKeyWithMarker('ebird', { clearedAt: '1999-12-31T23:59:59.000Z', origin: MINE })
    await bootOn(n, st)
    const writes = n.calls.filter(x => x.cmd === 'writeKeys')
    expect(writes).toHaveLength(1)
    expect((writes[0].args[1] as KeySlotsInput).ebird).toBeUndefined()
    expect(n.sharedKeys()!.ebird).toBeNull()
    expect(n.sharedKeys()!.openweather).toMatchObject({ value: S_OW })
    expect(getICloudState().keySlots.ebird).toMatchObject({ state: 'error', reason: copy.KEY_REASONS['key-time'] })
  })

  it("Finding 2: a peer slot whose time the reader accepts but the writer refuses ('Sep 1, 2026 (\u00e9)') is omitted from this device's write, and this device's own slot still uploads", async () => {
    const n = makeNative()
    const odd = 'Sep 1, 2026 (\u00e9)'
    n.container.keys = JSON.stringify({ version: 1, kind: 'keys', slots: { openweather: { state: 'key', value: S_PEER, changedAt: odd, origin: THEIRS } } })
    n.container.keyStatus = { present: true, downloaded: true, downloading: false, uploaded: true, uploading: false }
    // Non-vacuity: the reader DOES accept that slot (both engines the app runs on parse it).
    const read = validateKeyRecord(n.container.keys, START)
    expect(read.ok && read.slots.openweather).toMatchObject({ value: S_PEER, changedAt: odd })
    const st = makeStorage({ ebird: null, ml: null }, { ebird: timed(S_EBIRD, T_OLD) })
    const { log } = await bootOn(n, st)
    const writes = n.calls.filter(x => x.cmd === 'writeKeys')
    expect(writes).toHaveLength(1)
    const slots = writes[0].args[1] as KeySlotsInput
    expect(slots.ebird).toMatchObject({ state: 'key', value: S_EBIRD, changedAt: T_OLD })
    expect(slots.openweather).toBeUndefined()
    expect(n.sharedKeys()!.ebird).toMatchObject({ value: S_EBIRD })
    expect(n.sharedKeys()!.openweather).toBeNull()
    expect(getICloudState().keySlots.ebird).toMatchObject({ state: 'up-to-date' })
    // The peer's key was still applied here (the reader accepted it); only the WRITE omitted it.
    expect(st.keys.openweather).toMatchObject({ state: 'key', value: S_PEER })
    expect(log).toHaveBeenCalledWith(expect.stringContaining('slot openweather not carried (time)'))
    expect(JSON.stringify(log.mock.calls)).not.toContain(S_PEER)
  })

  it('Finding 3: an empty record text (what the native layer now hands back for a directory, a symlink, non-UTF-8 bytes or an oversized file at the record name) reads as absent for both slots and is healed by this device\'s write at the same check', async () => {
    const n = makeNative()
    n.container.keys = ''
    n.container.keyStatus = { present: true, downloaded: true, downloading: false, uploaded: true, uploading: false }
    const st = makeStorage({ ebird: null, ml: null }, { ebird: timed(S_EBIRD, T_OLD), openweather: untimed(S_OW) })
    const { log } = await bootOn(n, st)
    expect(log).toHaveBeenCalledWith(expect.stringContaining('key record rejected (malformed-json)'))
    expect(n.calls.filter(x => x.cmd === 'writeKeys')).toHaveLength(1)
    expect(n.sharedKeys()!.ebird).toMatchObject({ value: S_EBIRD })
    expect(n.sharedKeys()!.openweather).toMatchObject({ value: S_OW })
    expect(st.keys.ebird?.state === 'key' && st.keys.ebird.value).toBe(S_EBIRD) // never deleted
    expect(getICloudState().keySlots.ebird).toMatchObject({ state: 'up-to-date' })
    expect(getICloudState().keySlots.openweather).toMatchObject({ state: 'up-to-date' })
  })

  it('across upload, receive, replace, clear, error and remove, the sentinel never appears outside the slots (QA-16)', async () => {
    const n = makeNative()
    n.setSharedKeys({ openweather: sharedKey(S_PEER, T_NEW) })
    const st = makeStorage({ ebird: null, ml: null }, { ebird: untimed(S_EBIRD), openweather: untimed(S_OW) })
    const { c, log } = await bootOn(n, st) // upload ebird, replace openweather
    clock += 1000
    st.setKey('ebird', S_NEW, MINE)
    c.keySaved('ebird')
    await settle()
    await c.clearKeyWithSync('openweather') // clear
    await settle()
    n.fail.readKeys = new ICloudNativeError('timeout') // error
    await c.checkNow()
    delete n.fail.readKeys
    n.fail.writeKeys = new ICloudNativeError('unknown')
    clock += 1000
    st.setKey('ebird', S_EBIRD, MINE)
    await c.checkNow()
    delete n.fail.writeKeys
    await c.removeKeysFromICloud() // remove
    await settle()
    await c.disableKeys()
    const text = everythingButTheSlots(n, st, log)
    for (const s of SENTINELS) expect(text).not.toContain(s)
    // Non-vacuity: the sentinels DID travel, in the slots.
    const writes = JSON.stringify(n.calls.filter(x => x.cmd === 'writeKeys'))
    expect(writes).toContain(S_EBIRD)
    expect(writes).toContain(S_NEW)
    // And the container held exactly one key record beside the file records (QA-09), never a settings or cache document.
    const argsText = JSON.stringify(n.calls)
    for (const excluded of ['api-keys', 'settings.json', 'map-style', 'replay', 'county', 'hotspot', 'projects', 'taxonomy', 'icloud-sync']) {
      expect(argsText).not.toContain(excluded)
    }
  })
})

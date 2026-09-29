// icloud-bar-chart-sync: the COUNTY pass of an iCloud check (schema.md
// section 5; PRD QA-03, QA-04, QA-05, QA-07, QA-09 to QA-12, QA-33 and the
// tri-state record), driven through the REAL controller with a fake native
// layer that keeps a per-county container and an in-memory storage that keeps
// the seam's guard semantics, with the REAL validator and reconcile modules
// underneath. The Rust half of each native rule is tested in icloud.rs.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { createICloudController, type ControllerDeps, type ICloudController, ICLOUD_SYNC_SETTING, UPLOAD_RECHECK_MAX } from './icloudSync'
import { getICloudState, installICloudActions, resetICloudState } from './icloudState'
import { serializeRecord, validateCountyRecord, type SharedRecord } from './icloudRecord'
import type { BarChartFileMeta, BarChartFilesStatus, FileOrigin, FilesStatus } from '../storage'
import type { ICloudNativeLayer, NativeListedItem, SyncItemRef } from './icloudNativeTypes'
import { ICloudNativeError } from './icloudNativeTypes'
import { CLEAR_BATCH } from './countySync'
import { REASONS } from './icloudCopy'

const ME = 'a'.repeat(32)
const PEER = 'f'.repeat(32)
const SHA = 'b'.repeat(64)
const T_OLD = '2026-08-20T10:00:00.000Z'
const T_NEW = '2026-08-24T22:12:00.000Z'
const START = Date.parse('2026-09-01T16:00:00.000Z')
let clock = START
const iso = (ms: number) => new Date(ms).toISOString()
const CA = 'US-CA-001'
const NY = 'US-NY-005'
const PEER_ORIGIN = { deviceId: PEER, label: 'iPhone', platform: 'iphone' as const }
const MINE: FileOrigin = { deviceId: ME, label: "Dave's Mac", platform: 'mac' }

function countyFile(county: string, uploadedAt: string, deviceId = PEER, filename = `ebird_${county}__1900_2026_1_12_barchart.txt`): SharedRecord {
  return {
    version: 1, slot: 'barchart', county, state: 'file', filename, uploadedAt,
    origin: deviceId === PEER ? PEER_ORIGIN : { deviceId, label: "Dave's Mac", platform: 'mac' }, byteLength: 1234, sha256: SHA,
  }
}
function countyCleared(county: string, clearedAt: string, deviceId = PEER): SharedRecord {
  return { version: 1, slot: 'barchart', county, state: 'cleared', clearedAt, origin: deviceId === PEER ? PEER_ORIGIN : { deviceId, label: "Dave's Mac", platform: 'mac' } }
}

interface CountyItem {
  record: string | null
  recordPresent: boolean
  recordDownloaded: boolean
  file: { present: boolean; downloaded: boolean }
  /** NSURLUbiquitousItemIsUploadedKey for the file and its record, as the listing reports it */
  uploaded: boolean
}

// ── fake native: the two slots empty, a per-county container, no day-obs ──
function makeNative() {
  const counties = new Map<string, CountyItem>()
  const calls: Array<{ cmd: string; args: unknown[] }> = []
  const rec = (cmd: string, ...args: unknown[]) => { calls.push({ cmd, args }) }
  const fail: Partial<Record<string, ICloudNativeError>> = {}
  const knobs = { landOnStartDownload: false, pushUploaded: true }
  let holdCleared: { release: () => void } | null = null
  const hooks = { holdNextCleared: false }
  const put = (county: string, r: SharedRecord | null, fileDownloaded = true, uploaded = true) => {
    if (!r) { counties.delete(county); return }
    counties.set(county, {
      record: serializeRecord(r), recordPresent: true, recordDownloaded: true,
      file: r.state === 'file' ? { present: true, downloaded: fileDownloaded } : { present: false, downloaded: false },
      uploaded,
    })
  }
  const listed = (): NativeListedItem[] => [...counties.entries()].map(([id, c]) => ({
    id,
    present: c.recordPresent,
    record: c.recordPresent && c.recordDownloaded ? c.record : null,
    file: { present: c.file.present, downloaded: c.file.downloaded, downloading: false, byteLength: c.file.present ? 1234 : null, uploaded: c.file.present && c.uploaded },
  }))
  const empty = { present: false, downloaded: false, downloading: false, byteLength: null, uploaded: false, uploading: false }
  const native: ICloudNativeLayer = {
    async status() { rec('status'); return { state: 'available', deviceLabel: "Dave's Mac", platform: 'mac' } },
    async readRecord(slot) { rec('readRecord', slot); return { record: null, file: { ...empty } } },
    async push(slot) { rec('push', slot); return { sha256: SHA, byteLength: 1, uploaded: true } },
    async pushCleared(slot) { rec('pushCleared', slot) },
    async pull(slot) { rec('pull', slot) },
    async startDownload(slot) { rec('startDownload', slot) },
    async removeAll() {
      rec('removeAll')
      const removed = counties.size
      counties.clear()
      return { removed }
    },
    async readKeys(mode) { rec('readKeys', mode); return { record: null, status: { present: false, downloaded: false, downloading: false, uploaded: false, uploading: false } } },
    async writeKeys() { rec('writeKeys'); return { uploaded: true } },
    async removeKeys() { rec('removeKeys'); return { removed: 0 } },
    async watch(enabled) { rec('watch', enabled) },
    async listItems(kind) {
      rec('listItems', kind)
      if (fail.listItems) throw fail.listItems
      return { items: kind === 'barchart' ? listed() : [], truncated: false }
    },
    async pushItem(item: SyncItemRef, filename, uploadedAt, origin, unless) {
      rec('pushItem', item, filename, uploadedAt, origin, unless)
      if (item.kind === 'day-obs') throw new ICloudNativeError('local-missing')
      if (fail.pushItem) throw fail.pushItem
      put(item.county, { ...countyFile(item.county, uploadedAt, origin.deviceId, filename), origin: { ...origin } }, true, knobs.pushUploaded)
      return { sha256: SHA, byteLength: 1234, uploaded: knobs.pushUploaded, skipped: false }
    },
    async pushItemsCleared(codes, clearedAt, origin) {
      rec('pushItemsCleared', [...codes], clearedAt, origin)
      if (hooks.holdNextCleared) {
        hooks.holdNextCleared = false
        await new Promise<void>((resolve) => { holdCleared = { release: resolve } })
      }
      if (fail.pushItemsCleared) throw fail.pushItemsCleared
      for (const c of codes) put(c, countyCleared(c, clearedAt, origin.deviceId))
      return { failed: [] }
    },
    async pullItem(item, sha, len, mode) {
      rec('pullItem', item, sha, len, mode)
      if (fail.pullItem) throw fail.pullItem
      return {}
    },
    async startDownloadItem(item) {
      rec('startDownloadItem', item)
      if (item.kind === 'barchart' && knobs.landOnStartDownload) {
        const c = counties.get(item.county)
        if (c) c.file.downloaded = true
      }
    },
    async removeItem(item) { rec('removeItem', item); return { removed: 0 } },
    async removeItems(kind) { rec('removeItems', kind); return { removed: 0 } },
    async onChanged() { return () => {} },
    async onIdentityChanged() { return () => {} },
  }
  return {
    native, counties, calls, fail, knobs, hooks, put,
    releaseCleared: () => { holdCleared?.release(); holdCleared = null },
    cmds: (cmd: string) => calls.filter(c => c.cmd === cmd),
    shared: (county: string) => {
      const c = counties.get(county)
      if (!c?.record) return null
      const v = validateCountyRecord(c.record, county, clock)
      return v.ok ? v.record : null
    },
  }
}

// ── fake storage: the bar-chart seam's guard semantics, in memory ─────────
function makeStorage(counties: Record<string, BarChartFileMeta> = {}, files: FilesStatus = { ebird: null, ml: null }) {
  const settings: Record<string, unknown> = {}
  const manifest: BarChartFilesStatus = { version: 1, counties: { ...counties } }
  const bytes = new Map<string, string>(Object.keys(counties).map(c => [c, 'local']))
  const hooks = { manifestReject: false }
  const storage: ControllerDeps['storage'] = {
    async getSetting<T>(key: string) { return (settings[key] as T) ?? null },
    async setSetting<T>(key: string, value: T) { settings[key] = JSON.parse(JSON.stringify(value)) },
    async getFilesStatus() { return { ebird: files.ebird, ml: files.ml } },
    async deleteFile(name) { files[name] = null },
    async applySyncedFile() { return false },
    async applySyncedClear() { return false },
    async stampFileOrigin() { return false },
    async getApiKeyEntries() { return { ebird: null, openweather: null } },
    async clearApiKeyWithMarker() {},
    async applySyncedKey() { return false },
    async applySyncedKeyClear() { return false },
    async stampApiKeyEntry() { return false },
    async getBarChartFiles() {
      if (hooks.manifestReject) throw new Error('EIO')
      return { version: 1, counties: JSON.parse(JSON.stringify(manifest.counties)) }
    },
    async applySyncedBarChartFile(code, entry, expect, materialize) {
      if ((manifest.counties[code]?.uploadedAt ?? null) !== expect) return false
      await materialize()
      bytes.set(code, 'pulled')
      manifest.counties[code] = { ...entry }
      return true
    },
    async applySyncedBarChartClear(code, expect) {
      if ((manifest.counties[code]?.uploadedAt ?? null) !== expect) return false
      bytes.delete(code)
      delete manifest.counties[code]
      return true
    },
    async stampBarChartOrigin(code, origin, uploadedAt, expect) {
      const cur = manifest.counties[code]
      if (!cur || cur.uploadedAt !== expect) return false
      manifest.counties[code] = { ...cur, uploadedAt, ...(cur.origin ? {} : { origin }) }
      return true
    },
  }
  return {
    storage, settings, manifest, bytes, files, hooks,
    /** A user add on the Targets tab (the seam's write, not a sync link). */
    add(code: string, uploadedAt = iso(clock), origin: FileOrigin | undefined = MINE) {
      manifest.counties[code] = origin ? { filename: `ebird_${code}__x_barchart.txt`, uploadedAt, origin } : { filename: `ebird_${code}__x_barchart.txt`, uploadedAt }
      bytes.set(code, 'local')
    },
    /** A user remove (the seam's delete). */
    remove(code: string) { delete manifest.counties[code]; bytes.delete(code) },
    pref: () => settings[ICLOUD_SYNC_SETTING] as Record<string, unknown> | undefined,
  }
}

function makeDeps(native: ICloudNativeLayer, storage: ControllerDeps['storage']) {
  const notifyFilesChanged = vi.fn()
  const notifyBarChartFilesChanged = vi.fn()
  const barSubs = new Set<() => void>()
  const deps: ControllerDeps = {
    native,
    storage,
    invalidate: vi.fn(),
    purgeDerived: async () => [],
    notifyFilesChanged,
    subscribeFilesChanged: () => () => {},
    invalidateKey: () => {},
    notifyKeysChanged: () => {},
    subscribeKeysChanged: () => () => {},
    // The real epoch module's shape: a notify reaches every subscriber, the
    // controller's own subscription included (it ignores its own bumps).
    notifyBarChartFilesChanged: () => { notifyBarChartFilesChanged(); for (const cb of barSubs) cb() },
    subscribeBarChartFilesChanged: (cb) => { barSubs.add(cb); return () => { barSubs.delete(cb) } },
    mergeDayObsSnapshot: async () => ({ admitted: 0, changed: false }),
    dayObsPurgeGeneration: () => 0,
    awaitDayObsWrites: async () => {},
    now: () => clock,
    mintDeviceId: () => ME,
    view: null,
    log: () => {},
    pollIntervalMs: 60_000_000,
    uploadRecheckMs: 60_000_000,
    eventDebounceMs: 1,
    checkDownloadWaitMs: 5,
    downloadNowWaitMs: 5,
    downloadPollMs: 1,
  }
  return {
    deps, notifyFilesChanged, notifyBarChartFilesChanged,
    /** A user action's bump (the import tail), not the controller's. */
    userBump: () => { for (const cb of barSubs) cb() },
  }
}

// Under fake timers (the re-read rows) the same pause advances the fake clock,
// which also drains every pending promise first.
const settle = () => vi.isFakeTimers() ? vi.advanceTimersByTimeAsync(10) : new Promise(r => setTimeout(r, 10))

// Every controller bootOn made is disposed after its test, so a timer a
// mutated controller leaves running cannot turn a later row red.
const live: ICloudController[] = []

async function bootOn(n: ReturnType<typeof makeNative>, st: ReturnType<typeof makeStorage>, over: Partial<ControllerDeps> = {}) {
  const made = makeDeps(n.native, st.storage)
  Object.assign(made.deps, over)
  const c = createICloudController(made.deps)
  live.push(c)
  await c.boot()
  await c.enable()
  await settle()
  return { c, ...made }
}

beforeEach(() => {
  resetICloudState()
  clock = START
})
afterEach(() => {
  for (const c of live.splice(0)) c.dispose()
  vi.useRealTimers()
  installICloudActions(null)
})

describe('push and adoption (FR-04, QA-03)', () => {
  it('a county file with no shared record is pushed with this device as origin and the manifest time; the entry is stamped', async () => {
    const n = makeNative()
    const st = makeStorage({ [CA]: { filename: 'ebird_US-CA-001__1900_2026_1_12_barchart.txt', uploadedAt: T_OLD } })
    const { notifyFilesChanged, notifyBarChartFilesChanged } = await bootOn(n, st)
    const pushes = n.cmds('pushItem').filter(c => (c.args[0] as SyncItemRef).kind === 'barchart')
    expect(pushes).toHaveLength(1)
    expect(pushes[0].args[0]).toEqual({ kind: 'barchart', county: CA })
    expect(pushes[0].args[2]).toBe(T_OLD) // the manifest's own time, never rewritten
    expect((pushes[0].args[3] as FileOrigin).deviceId).toBe(ME)
    expect(pushes[0].args[4]).toBeNull()
    expect(st.manifest.counties[CA].origin?.deviceId).toBe(ME)
    expect(st.manifest.counties[CA].uploadedAt).toBe(T_OLD)
    expect(getICloudState().barCharts[CA]).toMatchObject({ state: 'up-to-date', fromThisDevice: true })
    expect(getICloudState().sharedCountyCodes).toEqual([CA])
    expect(getICloudState().sharedExists).toBe(true)
    // A push changes nothing a reader shows: no epoch of either kind.
    expect(notifyBarChartFilesChanged).not.toHaveBeenCalled()
    expect(notifyFilesChanged).not.toHaveBeenCalled()
  })

  it('a pre-feature entry whose time the writers refuse is pushed with the CHECK time, never skipped, and the next check is idempotent', async () => {
    // web/Pi-shaped seconds precision: parseable, but not the canonical writer shape.
    const n = makeNative()
    const st = makeStorage({ [CA]: { filename: 'e.txt', uploadedAt: '2026-08-20T10:00:00Z' } })
    const { c } = await bootOn(n, st)
    const push = n.cmds('pushItem').find(x => (x.args[0] as SyncItemRef).kind === 'barchart')!
    expect(push.args[2]).toBe(iso(START))
    // The manifest now carries what the record carries, so the next check reads `none`.
    expect(st.manifest.counties[CA].uploadedAt).toBe(iso(START))
    const before = n.cmds('pushItem').length
    clock += 60_000
    const outcome = await c.checkNow()
    expect(outcome.ok).toBe(true)
    expect(n.cmds('pushItem').filter(x => (x.args[0] as SyncItemRef).kind === 'barchart')).toHaveLength(1)
    expect(n.cmds('pullItem')).toHaveLength(0)
    expect(n.cmds('pushItem').length - before).toBe(1) // only the day-obs push attempt
  })

  it('a pre-feature entry with no origin, identical to the shared record, adopts without a transfer', async () => {
    const n = makeNative()
    n.put(CA, countyFile(CA, T_OLD, PEER))
    const st = makeStorage({ [CA]: { filename: 'e.txt', uploadedAt: T_OLD } })
    await bootOn(n, st)
    expect(n.cmds('pullItem')).toHaveLength(0)
    expect(n.cmds('pushItem').filter(x => (x.args[0] as SyncItemRef).kind === 'barchart')).toHaveLength(0)
    expect(getICloudState().barCharts[CA]).toMatchObject({ state: 'up-to-date', fromThisDevice: true })
  })
})

describe('pull, download, replace whole (FR-05, FR-08, FR-17, QA-04, QA-05)', () => {
  it('a shared file absent here is written through the seam with the shared name, time and origin, and only the bar-chart epoch bumps', async () => {
    const n = makeNative()
    n.put(CA, countyFile(CA, T_NEW))
    const st = makeStorage()
    const { notifyFilesChanged, notifyBarChartFilesChanged } = await bootOn(n, st)
    const pull = n.cmds('pullItem')
    expect(pull).toHaveLength(1)
    expect(pull[0].args).toEqual([{ kind: 'barchart', county: CA }, SHA, 1234, 'file'])
    expect(st.manifest.counties[CA]).toEqual({
      filename: 'ebird_US-CA-001__1900_2026_1_12_barchart.txt', uploadedAt: T_NEW, origin: PEER_ORIGIN,
    })
    expect(st.bytes.get(CA)).toBe('pulled')
    // A first arrival replaced nothing: no replaced line (the deliberate difference from a slot).
    expect(getICloudState().barCharts[CA]).toEqual({ state: 'up-to-date', fromThisDevice: false, origin: { label: 'iPhone', platform: 'iphone' } })
    expect(notifyBarChartFilesChanged).toHaveBeenCalledTimes(1)
    expect(notifyFilesChanged).not.toHaveBeenCalled()
  })

  it('a newer shared file replaces the older local one whole, and the section says so', async () => {
    const n = makeNative()
    n.put(CA, countyFile(CA, T_NEW))
    const st = makeStorage({ [CA]: { filename: 'old.txt', uploadedAt: T_OLD, origin: MINE } })
    const { notifyBarChartFilesChanged, notifyFilesChanged } = await bootOn(n, st)
    expect(st.manifest.counties[CA].filename).toBe('ebird_US-CA-001__1900_2026_1_12_barchart.txt')
    expect(st.manifest.counties[CA].replacedBySyncAt).toBe(iso(START))
    expect(getICloudState().barCharts[CA]).toMatchObject({ state: 'up-to-date', fromThisDevice: false, replacedAt: T_NEW })
    expect(notifyBarChartFilesChanged).toHaveBeenCalledTimes(1)
    expect(notifyFilesChanged).not.toHaveBeenCalled()
  })

  it('a shared file not downloaded here keeps the local file and reads "In iCloud, not downloaded here"; Download now fetches it', async () => {
    const n = makeNative()
    n.put(CA, countyFile(CA, T_NEW), false)
    const st = makeStorage({ [CA]: { filename: 'old.txt', uploadedAt: T_OLD, origin: MINE } })
    const { c } = await bootOn(n, st)
    expect(n.cmds('startDownloadItem').map(x => x.args[0])).toContainEqual({ kind: 'barchart', county: CA })
    expect(n.cmds('pullItem')).toHaveLength(0)
    expect(st.manifest.counties[CA].filename).toBe('old.txt')
    expect(getICloudState().barCharts[CA]).toMatchObject({ state: 'in-icloud-not-downloaded', uploadedAt: T_NEW })
    n.knobs.landOnStartDownload = true
    await c.downloadBarChartNow(CA)
    await settle()
    expect(n.cmds('pullItem')).toHaveLength(1)
    expect(st.manifest.counties[CA].uploadedAt).toBe(T_NEW)
  })

  it('a record present but not yet downloaded is SKIPPED this check: never treated as absent, never pushed over', async () => {
    const n = makeNative()
    n.put(CA, countyFile(CA, T_NEW))
    n.counties.get(CA)!.recordDownloaded = false
    const st = makeStorage({ [CA]: { filename: 'mine.txt', uploadedAt: T_OLD, origin: MINE } })
    await bootOn(n, st)
    expect(n.cmds('pushItem').filter(x => (x.args[0] as SyncItemRef).kind === 'barchart')).toHaveLength(0)
    expect(n.cmds('pullItem')).toHaveLength(0)
    expect(getICloudState().barCharts[CA]).toMatchObject({ state: 'downloading' })
    // Known to be shared stays known while unread.
    expect(st.manifest.counties[CA].filename).toBe('mine.txt')
  })

  it('a hostile record (another county\'s, copied to this name) is treated as absent: the local file is pushed over it, never deleted', async () => {
    const n = makeNative()
    n.put(CA, countyCleared(NY, T_NEW)) // a NY marker planted at CA's name
    const st = makeStorage({ [CA]: { filename: 'mine.txt', uploadedAt: T_OLD, origin: MINE } })
    await bootOn(n, st)
    expect(st.manifest.counties[CA]).toBeDefined()
    expect(n.cmds('pushItem').filter(x => (x.args[0] as SyncItemRef).kind === 'barchart')).toHaveLength(1)
  })

  it('the control leg: a DATA-FILE arrival still bumps the files epoch (the county pass never does)', async () => {
    const n = makeNative()
    const record = serializeRecord({ version: 1, slot: 'ebird', state: 'file', filename: 'MyEBirdData.csv', uploadedAt: T_NEW, origin: PEER_ORIGIN, byteLength: 10, sha256: SHA })
    n.native.readRecord = async (slot) => ({
      record: slot === 'ebird' ? record : null,
      file: slot === 'ebird'
        ? { present: true, downloaded: true, downloading: false, byteLength: 10, uploaded: true, uploading: false }
        : { present: false, downloaded: false, downloading: false, byteLength: null, uploaded: false, uploading: false },
    })
    const st = makeStorage()
    st.storage.applySyncedFile = async (_name, _entry, _expect, materialize) => { await materialize(); return true }
    const { notifyFilesChanged, notifyBarChartFilesChanged } = await bootOn(n, st)
    expect(notifyFilesChanged).toHaveBeenCalledTimes(1)
    expect(notifyBarChartFilesChanged).not.toHaveBeenCalled()
  })
})

describe('removal and its propagation (FR-10 to FR-12, QA-09, QA-10)', () => {
  it('a cleared marker newer than the local file removes it through the guarded link, bumping only the bar-chart epoch', async () => {
    const n = makeNative()
    n.put(CA, countyCleared(CA, T_NEW))
    const st = makeStorage({ [CA]: { filename: 'x.txt', uploadedAt: T_OLD, origin: MINE } })
    const { notifyBarChartFilesChanged, notifyFilesChanged } = await bootOn(n, st)
    expect(st.manifest.counties[CA]).toBeUndefined()
    expect(st.bytes.has(CA)).toBe(false)
    expect(getICloudState().barCharts[CA]).toBeUndefined()
    expect(notifyBarChartFilesChanged).toHaveBeenCalledTimes(1)
    expect(notifyFilesChanged).not.toHaveBeenCalled()
  })

  it('with sync OFF a marker removes nothing, and no county call is ever made', async () => {
    const n = makeNative()
    n.put(CA, countyCleared(CA, T_NEW))
    const st = makeStorage({ [CA]: { filename: 'x.txt', uploadedAt: T_OLD, origin: MINE } })
    const made = makeDeps(n.native, st.storage)
    const c = createICloudController(made.deps)
    await c.boot()
    await c.checkNow()
    await settle()
    expect(st.manifest.counties[CA]).toBeDefined()
    expect(n.cmds('listItems')).toHaveLength(0)
    expect(getICloudState().barCharts).toEqual({})
  })

  it('a local removal with sync on writes the county\'s cleared marker', async () => {
    const n = makeNative()
    const st = makeStorage({ [CA]: { filename: 'x.txt', uploadedAt: T_OLD, origin: MINE } })
    const { c } = await bootOn(n, st)
    st.remove(CA)
    clock += 1000
    await c.barChartsCleared([CA], iso(clock))
    expect(n.shared(CA)).toMatchObject({ state: 'cleared', clearedAt: iso(clock) })
    expect(getICloudState().sharedCountyCodes).toEqual([])
    expect((st.pref()?.pendingCountyClears as Record<string, string> | undefined)?.[CA]).toBeUndefined()
  })

  it('a marker that cannot reach iCloud is remembered, finished at the next check, and the memo is then gone', async () => {
    const n = makeNative()
    const st = makeStorage({ [CA]: { filename: 'x.txt', uploadedAt: T_OLD, origin: MINE } })
    const { c } = await bootOn(n, st)
    st.remove(CA)
    n.fail.pushItemsCleared = new ICloudNativeError('unavailable')
    const at = iso(clock + 1000)
    await c.barChartsCleared([CA], at)
    expect((st.pref()?.pendingCountyClears as Record<string, string>)[CA]).toBe(at)
    expect(getICloudState().barCharts[CA]).toMatchObject({ state: 'error' })
    // The file is still in iCloud: the next check must NOT pull it back down.
    delete n.fail.pushItemsCleared
    clock += 60_000
    await c.checkNow()
    expect(n.cmds('pullItem')).toHaveLength(0)
    expect(n.shared(CA)).toMatchObject({ state: 'cleared', clearedAt: at })
    expect(st.pref()?.pendingCountyClears).toBeUndefined()
    expect(st.manifest.counties[CA]).toBeUndefined()
  })

  it('a remembered clear yields to a NEWER shared file: the memo is dropped and the file comes down', async () => {
    const n = makeNative()
    const st = makeStorage({ [CA]: { filename: 'x.txt', uploadedAt: T_OLD, origin: MINE } })
    const { c } = await bootOn(n, st)
    st.remove(CA)
    n.fail.pushItemsCleared = new ICloudNativeError('timeout')
    await c.barChartsCleared([CA], iso(Date.parse(T_OLD) + 1000))
    delete n.fail.pushItemsCleared
    // Meanwhile a peer uploaded a newer file for the county.
    n.put(CA, countyFile(CA, T_NEW))
    const clearsBefore = n.cmds('pushItemsCleared').length
    await c.checkNow()
    expect(n.cmds('pushItemsCleared').length).toBe(clearsBefore)
    expect(st.pref()?.pendingCountyClears).toBeUndefined()
    expect(st.manifest.counties[CA]?.uploadedAt).toBe(T_NEW)
  })

  it('RACE: the check a local removal triggers never pulls the file back before the marker lands', async () => {
    // Synced first: local and shared identical.
    const n = makeNative()
    const st = makeStorage({ [CA]: { filename: 'x.txt', uploadedAt: T_OLD, origin: MINE } })
    const { c, userBump } = await bootOn(n, st)
    expect(n.shared(CA)).toMatchObject({ state: 'file', uploadedAt: T_OLD })
    // The Targets Remove: the local delete, its epoch bump (which starts a
    // check), then the marker, whose native write is HELD so the check races it.
    n.hooks.holdNextCleared = true
    st.remove(CA)
    userBump()
    const cleared = c.barChartsCleared([CA], iso(clock + 1000))
    await settle()
    expect(n.cmds('pullItem')).toHaveLength(0)
    n.releaseCleared()
    await cleared
    await settle()
    await c.checkNow()
    expect(n.cmds('pullItem')).toHaveLength(0)
    expect(st.manifest.counties[CA]).toBeUndefined()
    expect(n.shared(CA)).toMatchObject({ state: 'cleared' })
  })
})

describe('turning off, Remove synced files, and the backup clear (FR-13, FR-14, QA-11, QA-12)', () => {
  it('turning sync off writes and deletes nothing for any county, and clears the Targets lines', async () => {
    const n = makeNative()
    const st = makeStorage({ [CA]: { filename: 'x.txt', uploadedAt: T_OLD, origin: MINE } })
    const { c } = await bootOn(n, st)
    const before = n.calls.length
    await c.disable()
    const after = n.calls.slice(before).map(x => x.cmd)
    for (const cmd of ['pushItem', 'pushItemsCleared', 'removeItem', 'removeItems', 'removeAll']) expect(after).not.toContain(cmd)
    expect(st.manifest.counties[CA]).toBeDefined()
    expect(n.shared(CA)).not.toBeNull()
    expect(getICloudState().barCharts).toEqual({})
  })

  it('Remove synced files from iCloud empties the county set in iCloud and never touches the key record', async () => {
    const n = makeNative()
    const st = makeStorage({ [CA]: { filename: 'x.txt', uploadedAt: T_OLD, origin: MINE } })
    const { c } = await bootOn(n, st)
    await c.disable()
    await c.removeFromICloud()
    expect(n.cmds('removeAll')).toHaveLength(1)
    expect(n.cmds('removeKeys')).toHaveLength(0)
    expect(n.counties.size).toBe(0)
    expect(getICloudState().sharedCountyCodes).toEqual([])
    expect(st.manifest.counties[CA]).toBeDefined() // no device is touched
  })

  it('clearing the eBird backup with sync on leaves every county file, entry and record alone', async () => {
    const n = makeNative()
    const st = makeStorage({ [CA]: { filename: 'x.txt', uploadedAt: T_OLD, origin: MINE } }, { ebird: { filename: 'MyEBirdData.csv', uploadedAt: T_OLD, origin: MINE }, ml: null })
    const { c } = await bootOn(n, st)
    const recordBefore = n.counties.get(CA)!.record
    const manifestBefore = JSON.stringify(st.manifest)
    await c.clearWithSync('ebird')
    expect(JSON.stringify(st.manifest)).toBe(manifestBefore)
    expect(n.counties.get(CA)!.record).toBe(recordBefore)
    expect(n.cmds('pushItemsCleared')).toHaveLength(0)
    // Only the shared day answers go (FR-27, D5).
    expect(n.cmds('removeItems').map(x => x.args[0])).toEqual(['day-obs'])
  })
})

describe('no quota and the work bound (FR-09, NFR-02, QA-07, QA-33)', () => {
  function codes(n: number): string[] {
    const states = ['CA', 'NY', 'TX', 'WA', 'OR', 'MA', 'FL', 'AK', 'IL', 'PA']
    const out: string[] = []
    for (let i = 0; out.length < n; i++) out.push(`US-${states[i % states.length]}-${String(Math.floor(i / states.length) + 1).padStart(3, '0')}`)
    return out
  }

  it.each([1, 50, 500])('%i counties: every one syncs, one listing per check, at most N transfers, and a second check transfers nothing', async (count) => {
    const n = makeNative()
    const local: Record<string, BarChartFileMeta> = {}
    for (const code of codes(count)) local[code] = { filename: 'e.txt', uploadedAt: T_OLD, origin: MINE }
    const st = makeStorage(local)
    const { c } = await bootOn(n, st)
    expect(n.cmds('listItems').filter(x => x.args[0] === 'barchart')).toHaveLength(1)
    expect(n.cmds('pushItem').filter(x => (x.args[0] as SyncItemRef).kind === 'barchart')).toHaveLength(count)
    expect(n.counties.size).toBe(count)
    expect(getICloudState().sharedCountyCodes).toHaveLength(count)
    const listBefore = n.cmds('listItems').length
    const pushBefore = n.cmds('pushItem').filter(x => (x.args[0] as SyncItemRef).kind === 'barchart').length
    await c.checkNow()
    expect(n.cmds('listItems').filter(x => x.args[0] === 'barchart').length - listBefore + 1).toBeLessThanOrEqual(2)
    expect(n.cmds('pushItem').filter(x => (x.args[0] as SyncItemRef).kind === 'barchart')).toHaveLength(pushBefore)
    expect(n.cmds('pullItem')).toHaveLength(0)
    // No county ever reads an error or a count-shaped state.
    for (const view of Object.values(getICloudState().barCharts)) expect(view.state).toBe('up-to-date')
  })

  it('a clear-all of more counties than one batch writes every marker, in batches that stay inside the command budget', async () => {
    const n = makeNative()
    const all = codes(CLEAR_BATCH * 2 + 3)
    const st = makeStorage()
    const { c } = await bootOn(n, st)
    await c.barChartsCleared(all, iso(clock + 1000))
    const batches = n.cmds('pushItemsCleared').map(x => (x.args[0] as string[]).length)
    expect(batches).toEqual([CLEAR_BATCH, CLEAR_BATCH, 3])
    for (const code of all) expect(n.shared(code)).toMatchObject({ state: 'cleared' })
  })

  it('the county pass carries no count cap, payload budget or eviction over the county set', () => {
    const src = readFileSync(new URL('./countySync.ts', import.meta.url), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .split('\n').filter(l => !l.trim().startsWith('//')).join('\n')
    expect(src).not.toMatch(/MAX_(?:COUNTIES|ENTRIES|ITEMS|LISTED|BYTES)/)
    // (An emptiness check, `.length > 0`, is not a cap; any other length bound is.)
    expect(src).not.toMatch(/\bevict|slice\(0,|\.length\s*>=?\s*[1-9]/)
    // Non-vacuity: the scan reads the real module (it names the pass).
    expect(src).toContain('export async function runCountyPass(')
  })
})

describe('the bar-chart epoch and the triggers (FR-06, schema.md 5.7)', () => {
  it('a user add runs a check that pushes it; the controller\'s own arrival triggers no further check', async () => {
    const n = makeNative()
    const st = makeStorage()
    const { c, userBump } = await bootOn(n, st)
    const runs = c.checksRun
    st.add(CA)
    c.barChartSaved(CA)
    expect(getICloudState().barCharts[CA]).toEqual({ state: 'uploading', fromThisDevice: true })
    userBump()
    await settle()
    expect(c.checksRun).toBe(runs + 1)
    expect(n.shared(CA)).toMatchObject({ state: 'file' })
    // A peer file arrives: the controller bumps the epoch itself, and that bump
    // must not start another check.
    n.put(NY, countyFile(NY, T_NEW))
    const before = c.checksRun
    await c.checkNow()
    await settle()
    expect(c.checksRun).toBe(before + 1)
  })

  it('a manifest the seam cannot read skips the county pass without touching any view', async () => {
    const n = makeNative()
    const st = makeStorage({ [CA]: { filename: 'x.txt', uploadedAt: T_OLD, origin: MINE } })
    const { c } = await bootOn(n, st)
    const view = getICloudState().barCharts[CA]
    st.hooks.manifestReject = true
    const outcome = await c.checkNow()
    expect(outcome.ok).toBe(true)
    expect(getICloudState().barCharts[CA]).toEqual(view)
  })

  it('a listing that cannot reach iCloud fails the check and keeps lastCheckAt', async () => {
    const n = makeNative()
    const st = makeStorage({ [CA]: { filename: 'x.txt', uploadedAt: T_OLD, origin: MINE } })
    const { c } = await bootOn(n, st)
    const at = getICloudState().lastCheckAt
    n.fail.listItems = new ICloudNativeError('timeout')
    clock += 60_000
    const outcome = await c.checkNow()
    expect(outcome.ok).toBe(false)
    expect(getICloudState().checkFailed).toBe(true)
    expect(getICloudState().lastCheckAt).toBe(at)
    expect(getICloudState().barCharts[CA]).toMatchObject({ state: 'error' })
  })
})

// The device pass on TestFlight 1.0.40.1 (decisions.md entry 17): "when I
// attempt to upload a bar chart from another device, it appears to be stuck on
// the 'waiting to upload' step". Driven as the device that did NOT make the
// first upload: a peer's file arrived here, the peer removed it, and the user
// then added the county's file on this device.
describe('device pass on 1.0.40.1: a county never hangs on "Waiting to upload"', () => {
  const barchartPushes = (n: ReturnType<typeof makeNative>) => n.cmds('pushItem').filter(x => (x.args[0] as SyncItemRef).kind === 'barchart')
  const until = async (cond: () => boolean, ms = 500) => {
    for (let waited = 0; !cond() && waited < ms; waited += 5) await new Promise(r => setTimeout(r, 5))
  }
  // The re-read rows drive fake timers by hand, one interval per step and a
  // bounded number of steps, so a missing bound fails an assertion rather than
  // the test timeout. Date stays real (the harness clock is `clock`), and
  // RECHECK sits well under CHECK_DEADLINE_MS, so a check held in flight across
  // a re-read's due time never times out its listing.
  const RECHECK = 1_000
  const fakeTimers = () => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
  const step = async (intervals: number) => {
    for (let i = 0; i < intervals; i++) await vi.advanceTimersByTimeAsync(RECHECK)
  }

  /** Peer upload, pulled here; peer removal, applied here; then a user add here. */
  async function secondDeviceAdds(over: Partial<ControllerDeps> = {}) {
    const n = makeNative()
    n.put(CA, countyFile(CA, T_OLD))
    const st = makeStorage()
    const booted = await bootOn(n, st, over)
    expect(st.manifest.counties[CA]?.origin?.deviceId).toBe(PEER) // the first sync arrived
    clock += 60_000
    n.put(CA, countyCleared(CA, iso(clock)))
    clock += 60_000
    await booted.c.checkNow()
    expect(st.manifest.counties[CA]).toBeUndefined() // the removal arrived
    clock += 60_000
    n.knobs.pushUploaded = false // the daemon has not sent it when the push returns
    st.add(CA)
    booted.c.barChartSaved(CA)
    const checksBeforeAdd = booted.c.checksRun
    booted.userBump()
    await settle()
    return { n, st, checksBeforeAdd, ...booted }
  }

  it('the row settles to "Up to date" once iCloud holds the file, with no native event and no Check now', async () => {
    const { n, c } = await secondDeviceAdds({ uploadRecheckMs: 20 })
    // Pushed; the daemon has not uploaded it yet.
    expect(barchartPushes(n)).toHaveLength(1)
    expect(getICloudState().barCharts[CA]).toMatchObject({ state: 'waiting-to-upload', fromThisDevice: true })
    // The daemon finishes. On a device the only native event is the record
    // query, which never sees the county FILE finish, and the poll is minutes
    // away: nothing else re-reads the flag.
    n.counties.get(CA)!.uploaded = true
    const runs = c.checksRun
    await until(() => getICloudState().barCharts[CA]?.state === 'up-to-date')
    expect(getICloudState().barCharts[CA]).toMatchObject({ state: 'up-to-date', fromThisDevice: true })
    expect(c.checksRun).toBeGreaterThan(runs)
    // Re-reading the status never uploads the file again.
    expect(barchartPushes(n)).toHaveLength(1)
  })

  it('the re-read is bounded: while iCloud never takes the file it stops after UPLOAD_RECHECK_MAX checks', async () => {
    fakeTimers()
    const { n, c, checksBeforeAdd } = await secondDeviceAdds({ uploadRecheckMs: RECHECK })
    expect(getICloudState().barCharts[CA]?.state).toBe('waiting-to-upload')
    // The add's own check, then the follow-ups, counted over a bounded run of
    // intervals well past the cap.
    const followUps = () => c.checksRun - checksBeforeAdd - 1
    await step(UPLOAD_RECHECK_MAX + 4)
    expect(followUps()).toBe(UPLOAD_RECHECK_MAX)
    expect(vi.getTimerCount()).toBe(1) // the five-minute poll alone: no re-read is left
    expect(getICloudState().barCharts[CA]?.state).toBe('waiting-to-upload')
    expect(barchartPushes(n)).toHaveLength(1)
  })

  // Each row pins one guard in icloudSync.ts and fails when ONLY that guard is
  // removed. Once sync is off or the controller is disposed, requestCheck
  // refuses a stray re-read anyway (security-report I7), so those rows assert
  // on the timer itself and that fallback cannot hide a guard's removal.
  describe('the re-read timer stops, and no further check runs', () => {
    /** One county on this device, pushed but not yet uploaded: a re-read is scheduled. */
    async function waiting(over: Partial<ControllerDeps> = {}) {
      fakeTimers()
      const n = makeNative()
      n.knobs.pushUploaded = false
      const st = makeStorage({ [CA]: { filename: 'x.txt', uploadedAt: T_OLD, origin: MINE } })
      const booted = await bootOn(n, st, { uploadRecheckMs: RECHECK, ...over })
      expect(getICloudState().barCharts[CA]?.state).toBe('waiting-to-upload')
      expect(vi.getTimerCount()).toBe(2) // the visible poll and one re-read
      return { n, st, ...booted }
    }

    /** Holds the next county listing until released: a check parked in flight. */
    function holdListing(n: ReturnType<typeof makeNative>) {
      const list = n.native.listItems
      let release!: () => void
      const gate = new Promise<void>((r) => { release = () => r() })
      let held = false
      n.native.listItems = async (kind) => {
        if (kind === 'barchart' && !held) {
          held = true
          await gate
        }
        return list(kind)
      }
      return { release: () => release(), held: () => held }
    }

    it.each([
      ['sync is turned off', 'while the re-read is scheduled'],
      ['sync is turned off', 'while a check is in flight'],
      ['the controller is disposed', 'while the re-read is scheduled'],
      ['the controller is disposed', 'while a check is in flight'],
    ] as const)('%s %s', async (stop, when) => {
      const { n, c } = await waiting()
      const halt = async () => {
        if (stop === 'sync is turned off') await c.disable()
        else c.dispose()
      }
      if (when === 'while the re-read is scheduled') {
        // stopWatching clears the scheduled re-read.
        await halt()
      } else {
        // The check dropped the re-read as it started; the one it would arm as
        // it lands is refused, because sync is now off or the controller gone.
        const listing = holdListing(n)
        const check = c.checkNow()
        await settle()
        expect(listing.held()).toBe(true)
        await halt()
        listing.release()
        await check
        await settle()
      }
      // No timer of the controller's is left, the re-read included, and no
      // check runs however far the clock moves on.
      expect(vi.getTimerCount()).toBe(0)
      const runs = c.checksRun
      await step(UPLOAD_RECHECK_MAX + 2)
      expect(c.checksRun).toBe(runs)
    })

    it('the app is in the background when the re-read comes due', async () => {
      let visibility: DocumentVisibilityState = 'visible'
      const noop = () => undefined
      const view = {
        document: { get visibilityState() { return visibility }, addEventListener: noop, removeEventListener: noop },
        addEventListener: noop,
        removeEventListener: noop,
      } as unknown as ControllerDeps['view']
      const { c } = await waiting({ view })
      const runs = c.checksRun
      visibility = 'hidden'
      await step(UPLOAD_RECHECK_MAX + 2)
      // The re-read came due, ran no check and armed no other: the poll alone is
      // left, and it skips while hidden too. The foreground trigger re-reads.
      expect(c.checksRun).toBe(runs)
      expect(vi.getTimerCount()).toBe(1)
    })

    it('the waiting county is Removed on the Targets tab while its re-read is scheduled', async () => {
      const { n, st, c, userBump } = await waiting()
      const runs = c.checksRun
      // The Remove: the local delete and its epoch bump, which starts a check,
      // then the county's cleared marker. The check is held in flight past the
      // moment the re-read was due. It dropped the re-read when it started, so
      // nothing queues behind it, and it leaves no county waiting, so it arms none.
      const listing = holdListing(n)
      st.remove(CA)
      userBump()
      const cleared = c.barChartsCleared([CA], iso(clock + 1000))
      await settle()
      expect(listing.held()).toBe(true)
      await step(2)
      listing.release()
      await cleared
      await settle()
      expect(c.checksRun).toBe(runs + 1)
      expect(vi.getTimerCount()).toBe(1) // the poll alone
      await step(UPLOAD_RECHECK_MAX + 2)
      expect(c.checksRun).toBe(runs + 1)
      expect(st.manifest.counties[CA]).toBeUndefined()
      expect(n.shared(CA)).toMatchObject({ state: 'cleared' })
      expect(n.cmds('pullItem')).toHaveLength(0)
    })

    it('repeated checks, a check in flight when the re-read comes due, and a second waiting county share one timer and one budget', async () => {
      const { n, st, c, userBump } = await waiting()
      // Each check drops the pending re-read and arms one from its own outcome.
      for (let i = 0; i < 3; i++) {
        await c.checkNow()
        expect(vi.getTimerCount()).toBe(2)
      }
      await Promise.all([c.checkNow(), c.checkNow(), c.checkNow()])
      await settle()
      expect(vi.getTimerCount()).toBe(2)
      // A check held in flight past the re-read's due time: nothing queues behind it.
      const listing = holdListing(n)
      let runs = c.checksRun
      const check = c.checkNow()
      await settle()
      expect(listing.held()).toBe(true)
      await step(2)
      listing.release()
      await check
      await settle()
      expect(c.checksRun).toBe(runs + 1)
      expect(vi.getTimerCount()).toBe(2)
      // Two re-reads for CA alone, then the user adds NY, which waits too: the
      // add starts a fresh budget, and the two counties share it.
      runs = c.checksRun
      await step(2)
      expect(c.checksRun).toBe(runs + 2)
      st.add(NY)
      c.barChartSaved(NY)
      userBump()
      await settle()
      expect(getICloudState().barCharts[CA]?.state).toBe('waiting-to-upload')
      expect(getICloudState().barCharts[NY]?.state).toBe('waiting-to-upload')
      expect(vi.getTimerCount()).toBe(2)
      runs = c.checksRun
      await step(2 * UPLOAD_RECHECK_MAX + 2)
      expect(c.checksRun - runs).toBe(UPLOAD_RECHECK_MAX)
      expect(vi.getTimerCount()).toBe(1)
    })
  })

  it.each(['unavailable', 'timeout'] as const)('a push the native write refuses (%s) reads "Could not sync" with its reason and Retry, and the next check retries it', async (code) => {
    const n = makeNative()
    n.fail.pushItem = new ICloudNativeError(code)
    const st = makeStorage({ [CA]: { filename: 'x.txt', uploadedAt: T_OLD, origin: MINE } })
    const { c } = await bootOn(n, st)
    expect(getICloudState().barCharts[CA]).toMatchObject({ state: 'error', reason: REASONS[code], fromThisDevice: true })
    // The local file stays applied, and the next check pushes it again.
    expect(st.manifest.counties[CA]).toBeDefined()
    delete n.fail.pushItem
    await c.retryBarChart(CA)
    expect(n.shared(CA)).toMatchObject({ state: 'file', uploadedAt: T_OLD })
    expect(getICloudState().barCharts[CA]).toMatchObject({ state: 'up-to-date' })
  })

  it.each([
    ['unknown', 'error'],
    ['timeout', 'waiting-to-upload'],
    ['unavailable', 'waiting-to-upload'],
  ] as const)('a listing that fails with %s leaves an unpushed county reading %s', async (code, state) => {
    const n = makeNative()
    const st = makeStorage()
    const { c } = await bootOn(n, st)
    st.add(CA)
    n.fail.listItems = new ICloudNativeError(code)
    await c.checkNow()
    expect(getICloudState().barCharts[CA]?.state).toBe(state)
  })
})

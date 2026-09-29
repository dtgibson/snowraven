// icloud-bar-chart-sync: the DAY-OBS pass (schema.md section 8; PRD QA-22,
// QA-23 at the protocol level, QA-24; D1 and D8). One snapshot per device,
// merged on read: a device writes only its own snapshot and merges its peers'.
// Driven through `runDayObsPass` itself with a fake native container shared by
// two simulated devices, each with its own local store, so the PROTOCOL
// (digests, the skip, the removal, the fixed point) is what is under test. The
// merge RULE (union, complete over incomplete, later fetch, validation) is the
// real `mergeSharedSnapshot`, tested against the real store in
// countyDayObsCache.test.ts.

import { describe, it, expect, beforeEach } from 'vitest'
import { createHash } from 'node:crypto'
import { runDayObsPass, emptyDayObsPref, normalizeDayObsPref, type DayObsPassContext, type DayObsPref } from './dayObsSync'
import { serializeRecord, type SharedRecord } from './icloudRecord'
import type { ICloudNativeLayer, NativeListedItem, SyncItemRef } from './icloudNativeTypes'
import { ICloudNativeError } from './icloudNativeTypes'
import { resetICloudState, getICloudState } from './icloudState'

const A = 'a'.repeat(32)
const B = 'b'.repeat(32)
const NOW = Date.parse('2026-09-01T16:00:00.000Z')
const sha = (text: string) => createHash('sha256').update(text).digest('hex')

interface Snap { text: string; recordText: string; downloaded: boolean }

/** A device's local day store, as a map of key -> { complete, fetchedAt }. */
type Store = Map<string, { complete: boolean; fetchedAt: number }>
const serialize = (store: Store): string => {
  const keys = [...store.keys()].sort()
  const entries: Record<string, unknown> = {}
  for (const k of keys) entries[k] = { ...store.get(k)!, bytes: 2, species: [] }
  return JSON.stringify({ version: 2, entries, order: keys })
}
/** The shipped preference rule, restated for the protocol simulation only. */
function mergeInto(store: Store, text: string): { admitted: number; changed: boolean } {
  let doc: { entries?: Record<string, { complete: boolean; fetchedAt: number }> }
  try { doc = JSON.parse(text) } catch { return { admitted: 0, changed: false } }
  let changed = false
  let admitted = 0
  for (const [k, peer] of Object.entries(doc.entries ?? {})) {
    admitted += 1
    const local = store.get(k)
    if (!local || (peer.complete && !local.complete) || (peer.complete === local.complete && peer.fetchedAt > local.fetchedAt)) {
      store.set(k, { complete: peer.complete, fetchedAt: peer.fetchedAt })
      changed = true
    }
  }
  return { admitted, changed }
}

function makeContainer() {
  const snaps = new Map<string, Snap>()
  const calls: Array<{ device: string; cmd: string; args: unknown[] }> = []
  const fail: Partial<Record<string, ICloudNativeError>> = {}
  function nativeFor(device: string, local: () => string | null): ICloudNativeLayer {
    const rec = (cmd: string, ...args: unknown[]) => calls.push({ device, cmd, args })
    const listed = (): NativeListedItem[] => [...snaps.entries()].map(([id, s]) => ({
      id, present: true, record: s.recordText,
      file: { present: true, downloaded: s.downloaded, downloading: false, byteLength: s.text.length, uploaded: true },
    }))
    const unsupported = async (): Promise<never> => { throw new ICloudNativeError('unknown') }
    return {
      status: unsupported, readRecord: unsupported, push: unsupported, pushCleared: unsupported, pull: unsupported,
      startDownload: unsupported, removeAll: unsupported, readKeys: unsupported, writeKeys: unsupported, removeKeys: unsupported,
      watch: async () => {}, onChanged: async () => () => {}, onIdentityChanged: async () => () => {},
      pushItemsCleared: unsupported,
      async listItems(kind) {
        rec('listItems', kind)
        if (fail.listItems) throw fail.listItems
        return { items: kind === 'day-obs' ? listed() : [], truncated: false }
      },
      async pushItem(item: SyncItemRef, filename, uploadedAt, origin, unless) {
        rec('pushItem', item, unless)
        const text = local()
        if (text === null) throw new ICloudNativeError('local-missing')
        const digest = sha(text)
        if (unless === digest) return { sha256: digest, byteLength: text.length, uploaded: true, skipped: true }
        const r: SharedRecord = { version: 1, slot: 'day-obs', state: 'file', filename, uploadedAt, origin, byteLength: text.length, sha256: digest }
        snaps.set(device, { text, recordText: serializeRecord(r), downloaded: true })
        return { sha256: digest, byteLength: text.length, uploaded: true, skipped: false }
      },
      async pullItem(item, expectSha, len, mode) {
        rec('pullItem', item, mode)
        if (fail.pullItem) throw fail.pullItem
        const id = item.kind === 'day-obs' ? item.deviceId : ''
        const s = snaps.get(id)
        if (!s || sha(s.text) !== expectSha || s.text.length !== len) throw new ICloudNativeError('mismatch')
        return { text: s.text }
      },
      async startDownloadItem(item) { rec('startDownloadItem', item) },
      async removeItem(item) {
        rec('removeItem', item)
        if (item.kind === 'day-obs') snaps.delete(item.deviceId)
        return { removed: 1 }
      },
      async removeItems(kind) { rec('removeItems', kind); snaps.clear(); return { removed: 0 } },
    }
  }
  return { snaps, calls, fail, nativeFor }
}

function device(id: string, container: ReturnType<typeof makeContainer>, opts: { store?: Store; hasBackup?: boolean; pref?: DayObsPref } = {}) {
  const store: Store = opts.store ?? new Map()
  const state = { hasBackup: opts.hasBackup ?? true, localExists: true, gen: 0 }
  const pref: { dayObs?: DayObsPref } = { dayObs: opts.pref }
  const native = container.nativeFor(id, () => (state.localExists ? serialize(store) : null))
  const ctx: DayObsPassContext = {
    native, pref, deviceId: id, now: () => NOW, log: () => {},
    thisDevice: () => ({ deviceId: id, label: 'Mac', platform: 'mac' }),
    raceTimeout: (p) => p,
    // The store's generation contract, restated: a generation that moved since
    // the caller captured it admits nothing (the real one is exercised end to
    // end in countyDayObsCache.sync.test.ts).
    mergeSnapshot: async (text, gen) => (gen === state.gen ? mergeInto(store, text) : { admitted: 0, changed: false }),
    purgeGeneration: () => state.gen,
    awaitWrites: async () => {},
    hasBackup: async () => state.hasBackup,
  }
  return { id, store, state, pref, ctx, pass: () => runDayObsPass(ctx, () => 10_000) }
}

beforeEach(() => resetICloudState())

describe('the pull half: merge every OTHER device\'s snapshot (FR-24, FR-26)', () => {
  it('merges a peer\'s snapshot once, records its digest, and never downloads an unchanged one again', async () => {
    const c = makeContainer()
    const b = device(B, c, { store: new Map([['US-CA-001|2026-08-30', { complete: true, fetchedAt: 5 }]]) })
    await b.pass()
    const a = device(A, c)
    await a.pass()
    expect(a.store.get('US-CA-001|2026-08-30')).toEqual({ complete: true, fetchedAt: 5 })
    expect(a.pref.dayObs!.peers[B]).toBe(sha(serialize(b.store)))
    const pulls = () => c.calls.filter(x => x.device === A && x.cmd === 'pullItem')
    expect(pulls()).toHaveLength(1)
    await a.pass()
    expect(pulls()).toHaveLength(1)
    // It never pulls its OWN snapshot.
    expect(pulls().every(x => (x.args[0] as { deviceId: string }).deviceId === B)).toBe(true)
  })

  it('with no eBird backup nothing is merged (the synced clear keeps holding), though the device still lists', async () => {
    const c = makeContainer()
    const b = device(B, c, { store: new Map([['US-CA-001|2026-08-30', { complete: true, fetchedAt: 5 }]]) })
    await b.pass()
    const a = device(A, c, { hasBackup: false })
    a.state.localExists = false
    await a.pass()
    expect(a.store.size).toBe(0)
    expect(c.calls.filter(x => x.device === A && x.cmd === 'pullItem')).toHaveLength(0)
    expect(c.calls.filter(x => x.device === A && x.cmd === 'listItems')).toHaveLength(1)
  })

  it('an unparseable snapshot is treated as absent AND recorded, so it is not downloaded again until the peer writes a new one', async () => {
    const c = makeContainer()
    const text = '{"version":2,"entries":'
    const r: SharedRecord = { version: 1, slot: 'day-obs', state: 'file', filename: 'county-day-obs.json', uploadedAt: '2026-09-01T00:00:00.000Z', origin: { deviceId: B, label: 'iPhone', platform: 'iphone' }, byteLength: text.length, sha256: sha(text) }
    c.snaps.set(B, { text, recordText: serializeRecord(r), downloaded: true })
    const a = device(A, c)
    await a.pass()
    await a.pass()
    expect(a.store.size).toBe(0)
    expect(c.calls.filter(x => x.device === A && x.cmd === 'pullItem')).toHaveLength(1)
  })

  it.each([
    ['another device\'s record at this device\'s name', (r: SharedRecord) => ({ ...r, origin: { deviceId: A, label: 'Mac', platform: 'mac' as const } })],
    ['a byteLength over the snapshot bound', (r: SharedRecord) => ({ ...r, byteLength: 64_000_001 })],
    ['a county record planted at a snapshot name', (r: SharedRecord) => ({ ...r, slot: 'barchart' as const, county: 'US-CA-001' })],
  ])('%s is rejected and never pulled', async (_label, mutate) => {
    const c = makeContainer()
    const text = serialize(new Map([['US-CA-001|2026-08-30', { complete: true, fetchedAt: 5 }]]))
    const r: SharedRecord = { version: 1, slot: 'day-obs', state: 'file', filename: 'county-day-obs.json', uploadedAt: '2026-09-01T00:00:00.000Z', origin: { deviceId: B, label: 'iPhone', platform: 'iphone' }, byteLength: text.length, sha256: sha(text) }
    c.snaps.set(B, { text, recordText: serializeRecord(mutate(r) as SharedRecord), downloaded: true })
    const a = device(A, c)
    await a.pass()
    expect(c.calls.filter(x => x.device === A && x.cmd === 'pullItem')).toHaveLength(0)
    expect(a.store.size).toBe(0)
  })

  it('a peer snapshot not downloaded here starts its download and is merged on a later check', async () => {
    const c = makeContainer()
    const b = device(B, c, { store: new Map([['US-CA-001|2026-08-30', { complete: true, fetchedAt: 5 }]]) })
    await b.pass()
    c.snaps.get(B)!.downloaded = false
    const a = device(A, c)
    await a.pass()
    expect(c.calls.filter(x => x.device === A && x.cmd === 'startDownloadItem')).toHaveLength(1)
    expect(a.store.size).toBe(0)
    c.snaps.get(B)!.downloaded = true
    await a.pass()
    expect(a.store.size).toBe(1)
  })
})

describe('the push half: this device\'s own snapshot (FR-25, schema.md 8.2)', () => {
  it('pushes once, then skips while iCloud still holds exactly what it last pushed', async () => {
    const c = makeContainer()
    const a = device(A, c, { store: new Map([['US-CA-001|2026-08-30', { complete: true, fetchedAt: 5 }]]) })
    const first = await a.pass()
    expect(first.transferred).toBe(true)
    const pushes = () => c.calls.filter(x => x.device === A && x.cmd === 'pushItem')
    expect(pushes()[0].args[1]).toBeNull()
    const second = await a.pass()
    expect(second.transferred).toBe(false)
    expect(pushes()[1].args[1]).toBe(a.pref.dayObs!.lastPushedSha256)
    expect(getICloudState().sharedDayObsExists).toBe(true)
  })

  it('a snapshot another device removed goes up again at the next check (the skip needs the record present)', async () => {
    const c = makeContainer()
    const a = device(A, c, { store: new Map([['US-CA-001|2026-08-30', { complete: true, fetchedAt: 5 }]]) })
    await a.pass()
    c.snaps.clear() // Remove synced files from iCloud, run on another device
    const again = await a.pass()
    expect(again.transferred).toBe(true)
    expect(c.snaps.has(A)).toBe(true)
  })

  it('no local document (never populated, or purged by a clear): this device\'s snapshot goes too', async () => {
    const c = makeContainer()
    const a = device(A, c, { store: new Map([['US-CA-001|2026-08-30', { complete: true, fetchedAt: 5 }]]) })
    await a.pass()
    a.state.localExists = false
    await a.pass()
    expect(c.snaps.has(A)).toBe(false)
    expect(a.pref.dayObs!.lastPushedSha256).toBeNull()
    expect(c.calls.filter(x => x.device === A && x.cmd === 'removeItem')).toHaveLength(1)
    // And a device that never had one removes nothing.
    const fresh = device(B, c)
    fresh.state.localExists = false
    await fresh.pass()
    expect(c.calls.filter(x => x.device === B && x.cmd === 'removeItem')).toHaveLength(0)
  })

  it('a listing that cannot reach iCloud fails the check and changes nothing', async () => {
    const c = makeContainer()
    const a = device(A, c, { store: new Map([['US-CA-001|2026-08-30', { complete: true, fetchedAt: 5 }]]) })
    c.fail.listItems = new ICloudNativeError('timeout')
    const r = await a.pass()
    expect(r).toEqual({ transferred: false, failed: true })
    expect(c.calls.filter(x => x.cmd === 'pushItem')).toHaveLength(0)
  })
})

describe('convergence (FR-25, QA-22): two devices reach a fixed point within two checks each', () => {
  it('overlapping, disjoint and conflicting days: after two checks each, a further round writes and reads nothing', async () => {
    const c = makeContainer()
    const a = device(A, c, { store: new Map([
      ['US-CA-001|2026-08-30', { complete: true, fetchedAt: 10 }],
      ['US-CA-001|2026-09-01', { complete: false, fetchedAt: 20 }],
      ['US-NY-005|2026-08-31', { complete: true, fetchedAt: 15 }],
    ]) })
    const b = device(B, c, { store: new Map([
      ['US-CA-001|2026-08-30', { complete: true, fetchedAt: 12 }],
      ['US-CA-001|2026-09-01', { complete: true, fetchedAt: 18 }],
      ['US-TX-201|2026-08-29', { complete: true, fetchedAt: 9 }],
    ]) })
    await a.pass(); await b.pass(); await a.pass(); await b.pass()
    expect(serialize(a.store)).toBe(serialize(b.store))
    // Complete beats incomplete, whatever the times; otherwise the later fetch wins.
    expect(a.store.get('US-CA-001|2026-09-01')).toEqual({ complete: true, fetchedAt: 18 })
    expect(a.store.get('US-CA-001|2026-08-30')).toEqual({ complete: true, fetchedAt: 12 })
    const before = c.calls.length
    const r1 = await a.pass()
    const r2 = await b.pass()
    expect([r1.transferred, r2.transferred]).toEqual([false, false])
    const later = c.calls.slice(before)
    expect(later.filter(x => x.cmd === 'pullItem')).toHaveLength(0)
    // Every later push was a skip (the native side wrote nothing).
    for (const p of later.filter(x => x.cmd === 'pushItem')) expect(p.args[1]).not.toBeNull()
  })
})

describe('the persisted field (schema.md section 7)', () => {
  it('keeps well-shaped values and drops everything else, never throwing', () => {
    const good = { lastPushedSha256: 'c'.repeat(64), peers: { [B]: 'd'.repeat(64) }, anyShared: true }
    expect(normalizeDayObsPref(good)).toEqual(good)
    const bad = JSON.parse(`{"lastPushedSha256":"x","peers":{"__proto__":"${'d'.repeat(64)}","${'Z'.repeat(32)}":"${'d'.repeat(64)}","${B}":"nope"},"anyShared":"yes"}`)
    expect(normalizeDayObsPref(bad)).toEqual(emptyDayObsPref())
    for (const v of [null, 3, 'x', [], undefined]) expect(normalizeDayObsPref(v)).toBeUndefined()
    expect(Object.getPrototypeOf(normalizeDayObsPref(bad)!.peers)).toBeNull()
  })
})

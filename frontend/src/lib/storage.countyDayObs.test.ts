// The Targets day cache's OWN document on both adapters (targets-tab, schema.md
// sections 3.2 and 3.6, amended 2026-09-27; the `storage.barcharts.test.ts`
// shape).
//
// Four claims:
//   1. Tauri: `data/county-day-obs.json`, read as `null` on absence and on ANY
//      failure (for a derived cache an unreadable document is an empty one),
//      written after a recursive `mkdir('data')`, deleted only when it exists.
//      The delete is NOT swallowed: it is the Clear path's teardown.
//   2. None of the three touches `docChains` or `settings.json`: the store's
//      ordering is its own `writeThrough`, and a 10 MB document must never be
//      rewritten by a preference save.
//   3. Web/Pi: the three map onto the generic `/settings/county-day-obs-v2`
//      route (its own file on the backend), with the `deleteSetting` failure
//      shape.
//   4. The fs grant: the path is a NON-dotted name under `data/`, deliberately
//      INSIDE `$APPLOCALDATA/**` (the inverse of security.md's v1.0.13 dot rule,
//      which is for native-side documents), and the capability grants remove.
/// <reference types="node" />
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'

const plat = vi.hoisted(() => ({ tauri: true }))
vi.mock('./platform', () => ({
  isTauri: () => plat.tauri, isIOS: () => false, isWindows: () => false, isMacOS: () => false,
}))

const harness = vi.hoisted(() => ({
  files: new Map<string, string>(),
  failRead: false,
  failRemove: false,
  /** Every fs call as `op:path`, in order. */
  calls: [] as string[],
}))

vi.mock('@tauri-apps/plugin-fs', () => ({
  BaseDirectory: { AppLocalData: 4 },
  exists: async (path: string) => { harness.calls.push(`exists:${path}`); return harness.files.has(path) },
  readTextFile: async (path: string) => {
    harness.calls.push(`read:${path}`)
    if (harness.failRead) throw new Error(`EIO (injected): ${path}`)
    const v = harness.files.get(path)
    if (v === undefined) throw new Error(`ENOENT: ${path}`)
    return v
  },
  writeTextFile: async (path: string, content: string, opts: { baseDir: number }) => {
    harness.calls.push(`write:${path}:${opts.baseDir}`)
    harness.files.set(path, content)
  },
  mkdir: async (path: string, opts: { baseDir: number; recursive: boolean }) => {
    harness.calls.push(`mkdir:${path}:${opts.baseDir}:${opts.recursive}`)
  },
  remove: async (path: string) => {
    harness.calls.push(`remove:${path}`)
    if (harness.failRemove) throw new Error(`EIO (injected): ${path}`)
    harness.files.delete(path)
  },
}))

// Static import so the mock is registered before any dynamic import races it
// (the reason is recorded in storageWriteSerialization.test.ts).
import * as pluginFs from '@tauri-apps/plugin-fs'
import { storage, COUNTY_DAY_OBS_PATH } from './storage'

const DOC = { version: 2, entries: {}, order: [] }

beforeEach(() => {
  harness.files.clear()
  harness.failRead = false
  harness.failRemove = false
  harness.calls = []
})

describe('Tauri: data/county-day-obs.json', () => {
  it('the path is the exported constant, and the fs mock is in place', () => {
    expect(pluginFs.BaseDirectory.AppLocalData).toBe(4)
    expect(COUNTY_DAY_OBS_PATH).toBe('data/county-day-obs.json')
  })

  it('reads null on an absent file, on unreadable text and on a readTextFile rejection', async () => {
    await expect(storage.getCountyDayObsStore()).resolves.toBeNull()
    harness.files.set(COUNTY_DAY_OBS_PATH, '{"version": 2, "entries": ')
    await expect(storage.getCountyDayObsStore()).resolves.toBeNull()
    harness.files.set(COUNTY_DAY_OBS_PATH, JSON.stringify(DOC))
    harness.failRead = true
    await expect(storage.getCountyDayObsStore()).resolves.toBeNull()
    harness.failRead = false
    await expect(storage.getCountyDayObsStore()).resolves.toEqual(DOC)
  })

  it('writes after a recursive mkdir of data/, the whole document as JSON, under AppLocalData', async () => {
    await storage.setCountyDayObsStore(DOC)
    expect(harness.calls).toEqual(['mkdir:data:4:true', `write:${COUNTY_DAY_OBS_PATH}:4`])
    expect(harness.files.get(COUNTY_DAY_OBS_PATH)).toBe(JSON.stringify(DOC))
  })

  it('deletes only when the file exists, resolves on an absent file, and does not swallow a failed remove', async () => {
    await expect(storage.deleteCountyDayObsStore()).resolves.toBeUndefined()
    expect(harness.calls).toEqual([`exists:${COUNTY_DAY_OBS_PATH}`])
    harness.calls = []
    harness.files.set(COUNTY_DAY_OBS_PATH, JSON.stringify(DOC))
    await storage.deleteCountyDayObsStore()
    expect(harness.calls).toEqual([`exists:${COUNTY_DAY_OBS_PATH}`, `remove:${COUNTY_DAY_OBS_PATH}`])
    expect(harness.files.has(COUNTY_DAY_OBS_PATH)).toBe(false)
    harness.files.set(COUNTY_DAY_OBS_PATH, JSON.stringify(DOC))
    harness.failRemove = true
    await expect(storage.deleteCountyDayObsStore()).rejects.toThrow(/EIO/)
  })

  it('none of the three touches docChains or settings.json', async () => {
    await storage.setCountyDayObsStore(DOC)
    await storage.getCountyDayObsStore()
    await storage.deleteCountyDayObsStore()
    const chains = (storage as unknown as { docChains: Record<string, unknown> }).docChains
    expect(Object.keys(chains)).not.toContain(COUNTY_DAY_OBS_PATH)
    expect(Object.keys(chains)).not.toContain('data/settings.json')
    expect(harness.calls.some(c => c.includes('settings.json'))).toBe(false)
    // Non-vacuity: the chain map is real and a settings save does land on it.
    await storage.setSetting('probe', 1)
    expect(Object.keys((storage as unknown as { docChains: Record<string, unknown> }).docChains)).toContain('data/settings.json')
  })
})

describe('the webview fs grant covers this document (inside it on purpose)', () => {
  it('the path is a non-dotted name under data/', () => {
    expect(COUNTY_DAY_OBS_PATH.startsWith('data/')).toBe(true)
    // The inverse of security.md's v1.0.13 rule: a LEADING DOT would put the
    // file outside `$APPLOCALDATA/**` (tauri-plugin-fs requires a literal
    // leading dot on unix) and fail every write.
    for (const segment of COUNTY_DAY_OBS_PATH.split('/')) expect(segment.startsWith('.')).toBe(false)
  })

  it('default.json grants read, write, mkdir, exists and remove on $APPLOCALDATA/**', () => {
    const cap = JSON.parse(readFileSync(new URL('../../../src-tauri/capabilities/default.json', import.meta.url), 'utf8')) as {
      permissions: Array<string | { identifier: string; allow?: Array<{ path?: string }> }>
    }
    const granted = (id: string) => cap.permissions.some(p =>
      typeof p === 'object' && p.identifier === id && (p.allow ?? []).some(a => a.path === '$APPLOCALDATA/**'))
    // The Clear path's delete depends on remove; the flush on write and mkdir;
    // the load on read and exists.
    for (const id of ['fs:allow-remove', 'fs:allow-write-text-file', 'fs:allow-mkdir', 'fs:allow-read-text-file', 'fs:allow-exists']) {
      expect(granted(id), id).toBe(true)
    }
  })
})

describe('web/Pi: the generic /settings/county-day-obs-v2 route', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    plat.tauri = true
    vi.resetModules()
  })

  async function webStorage() {
    plat.tauri = false
    vi.resetModules()
    const m = await import('./storage')
    return m.storage
  }

  it('GET reads the key, and a non-OK answer is null', async () => {
    const web = await webStorage()
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => DOC }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(web.getCountyDayObsStore()).resolves.toEqual(DOC)
    expect(fetchMock).toHaveBeenCalledWith('/settings/county-day-obs-v2')
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404 })))
    await expect(web.getCountyDayObsStore()).resolves.toBeNull()
  })

  it('POST writes the whole document as JSON, and a non-OK answer throws', async () => {
    const web = await webStorage()
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await web.setCountyDayObsStore(DOC)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, { method: string; body: string }]
    expect(url).toBe('/settings/county-day-obs-v2')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual(DOC)
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 413 })))
    await expect(web.setCountyDayObsStore(DOC)).rejects.toThrow(/413/)
  })

  it('DELETE removes the key, and a non-OK answer throws (the deleteSetting failure shape)', async () => {
    const web = await webStorage()
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await web.deleteCountyDayObsStore()
    expect(fetchMock).toHaveBeenCalledWith('/settings/county-day-obs-v2', { method: 'DELETE' })
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500 })))
    await expect(web.deleteCountyDayObsStore()).rejects.toThrow(/500/)
  })
})

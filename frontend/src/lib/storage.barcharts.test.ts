// The eBird bar-chart file family on the DESKTOP adapter (targets-tab, schema.md
// sections 1.2, 1.3; QA-28, QA-41, QA-42, QA-73).
//
// Four claims:
//   1. UNKNOWN is never EMPTY: an absent manifest reads as `{ counties: {} }`,
//      a manifest that cannot be read or parsed REJECTS (FR-40).
//   2. The manifest is normalized on read: a malformed entry, a key that is not
//      a region code, a JSON-parsed `__proto__` key and a wrong version are all
//      dropped, never thrown on.
//   3. A region code that fails the shape never reaches the filesystem.
//   4. SERIALIZATION (QA-73): `data/barcharts.json` is a shared document, so its
//      read-modify-write cycles ride their own chain. Forced with the same
//      reads-first adversarial scheduler `storageWriteSerialization.test.ts`
//      uses: two adds for different counties both survive, and an add
//      overlapping a settings save and a backup save leaves all three documents
//      whole.

import { describe, it, expect, vi, beforeEach } from 'vitest'

type FsOp = 'exists' | 'read' | 'write' | 'mkdir' | 'remove'
interface Step { op: FsOp; path: string; go: () => void }

const harness = {
  files: new Map<string, string>(),
  pending: [] as Step[],
  manual: false,
  failRead: new Set<string>(),
  touched: [] as string[],
  reset() {
    this.files.clear()
    this.pending = []
    this.manual = false
    this.failRead.clear()
    this.touched = []
  },
}

function gate<T>(op: FsOp, path: string, effect: () => T): Promise<T> {
  harness.touched.push(path)
  if (!harness.manual) return Promise.resolve().then(effect)
  return new Promise<T>((resolve, reject) => {
    harness.pending.push({ op, path, go: () => { try { resolve(effect()) } catch (e) { reject(e) } } })
  })
}

vi.mock('@tauri-apps/plugin-fs', () => ({
  BaseDirectory: { AppLocalData: 4 },
  exists: (path: string) => gate('exists', path, () => harness.files.has(path)),
  readTextFile: (path: string) => gate('read', path, () => {
    if (harness.failRead.has(path)) throw new Error(`EIO (injected): ${path}`)
    const v = harness.files.get(path)
    if (v === undefined) throw new Error(`ENOENT: ${path}`)
    return v
  }),
  writeTextFile: (path: string, content: string) => gate('write', path, () => { harness.files.set(path, content) }),
  mkdir: (path: string) => gate('mkdir', path, () => undefined),
  remove: (path: string) => gate('remove', path, () => { harness.files.delete(path) }),
}))

vi.mock('./platform', () => ({ isTauri: () => true, isIOS: () => false, isWindows: () => false, isMacOS: () => false }))

// Static import so the mock is registered before any dynamic import races it
// (the reason is recorded in storageWriteSerialization.test.ts).
import * as pluginFs from '@tauri-apps/plugin-fs'
import { storage, normalizeBarChartManifest, BARCHARTS_META_PATH, BARCHARTS_DIR } from './storage'
import { refuseByFilename, BARCHART_FILENAME_MAX } from './uploadGuard'

const settle = () => new Promise<void>(r => setTimeout(r, 0))
async function drainReadsFirst(): Promise<void> {
  for (;;) {
    await settle()
    if (harness.pending.length === 0) break
    const i = harness.pending.findIndex(s => s.op === 'exists' || s.op === 'read')
    const [step] = harness.pending.splice(i >= 0 ? i : 0, 1)
    step.go()
  }
  harness.manual = false
}

const manifest = () => JSON.parse(harness.files.get(BARCHARTS_META_PATH) ?? '{}') as { version: number; counties: Record<string, { filename: string }> }

beforeEach(() => harness.reset())

describe('harness', () => {
  it('the plugin-fs mock is in place', () => {
    expect(pluginFs.BaseDirectory.AppLocalData).toBe(4)
    expect(BARCHARTS_META_PATH).toBe('data/barcharts.json')
    expect(BARCHARTS_DIR).toBe('data/barcharts')
  })
})

describe('UNKNOWN is never EMPTY (FR-40, QA-42)', () => {
  it('an absent manifest reads as the empty manifest', async () => {
    await expect(storage.getBarChartFiles()).resolves.toEqual({ version: 1, counties: {} })
  })

  it('an unreadable manifest REJECTS', async () => {
    harness.files.set(BARCHARTS_META_PATH, '{}')
    harness.failRead.add(BARCHARTS_META_PATH)
    await expect(storage.getBarChartFiles()).rejects.toThrow(/EIO/)
  })

  it('a manifest that is not JSON REJECTS', async () => {
    harness.files.set(BARCHARTS_META_PATH, '{"version": 1, "counties": ')
    await expect(storage.getBarChartFiles()).rejects.toThrow()
  })

  it('an absent file reads as null, and so does an unreadable one', async () => {
    await expect(storage.readBarChartFile('US-CA-001')).resolves.toBeNull()
    harness.files.set('data/barcharts/US-CA-001.txt', 'x')
    harness.failRead.add('data/barcharts/US-CA-001.txt')
    await expect(storage.readBarChartFile('US-CA-001')).resolves.toBeNull()
  })
})

describe('the manifest normalizer (schema 1.2)', () => {
  it('keeps a well-formed entry and drops everything malformed, never throwing', () => {
    const raw = JSON.parse(JSON.stringify({
      version: 1,
      counties: {
        'US-CA-001': { filename: 'ebird_US-CA-001__1900_2026_1_12_barchart.txt', uploadedAt: '2026-09-26T20:00:00.000Z' },
        'US-CA-013': { filename: 42, uploadedAt: 'x' },
        'US-CA-085': { filename: 'a'.repeat(256), uploadedAt: 'x' },
        'US-CA-041': { filename: 'ok.txt', uploadedAt: 'x'.repeat(41) },
        'us-ca-001': { filename: 'lower.txt', uploadedAt: 'x' },
        'US-CA-001\n': { filename: 'newline.txt', uploadedAt: 'x' },
        '../etc': { filename: 'up.txt', uploadedAt: 'x' },
        'US-CA-081': null,
      },
    }))
    expect(Object.keys(normalizeBarChartManifest(raw).counties)).toEqual(['US-CA-001'])
  })

  it('a JSON __proto__ key is dropped and cannot reach the prototype', () => {
    const raw = JSON.parse('{"version":1,"counties":{"__proto__":{"filename":"p.txt","uploadedAt":"x"},"constructor":{"filename":"c.txt","uploadedAt":"x"}}}')
    const out = normalizeBarChartManifest(raw)
    expect(Object.keys(out.counties)).toEqual([])
    expect(Object.getPrototypeOf(out.counties)).toBeNull()
  })

  it('a wrong version, a non-object and an array read as empty', () => {
    for (const raw of [{ version: 2, counties: { 'US-CA-001': { filename: 'a', uploadedAt: 'b' } } }, null, 'x', [], { version: 1, counties: [] }]) {
      expect(normalizeBarChartManifest(raw).counties).toEqual({})
    }
  })
})

describe('a region code that fails the shape never reaches the filesystem (NFR-06)', () => {
  it.each(['../US-CA-001', 'US-CA-001/..', 'US-CA-0011', 'US-CA-001\n', 'US-CA-١٢٣', ''])('%j', async bad => {
    await expect(storage.writeBarChartFile(bad, 'x', 'a.txt')).rejects.toThrow(/region code/)
    await expect(storage.deleteBarChartFile(bad)).rejects.toThrow(/region code/)
    await expect(storage.readBarChartFile(bad)).resolves.toBeNull()
    expect(harness.touched.filter(p => p.startsWith(BARCHARTS_DIR))).toEqual([])
  })
})

describe('add, replace and remove (QA-28, QA-41)', () => {
  it('writes the file under its region code and records it in the manifest', async () => {
    await storage.writeBarChartFile('US-CA-001', 'content-1', 'ebird_US-CA-001__1900_2026_1_12_barchart.txt')
    expect(harness.files.get('data/barcharts/US-CA-001.txt')).toBe('content-1')
    expect(manifest().counties['US-CA-001'].filename).toBe('ebird_US-CA-001__1900_2026_1_12_barchart.txt')
    await expect(storage.readBarChartFile('US-CA-001')).resolves.toBe('content-1')
    const status = await storage.getBarChartFiles()
    expect(Object.keys(status.counties)).toEqual(['US-CA-001'])
  })

  it('replace overwrites both, and remove leaves no file and no entry behind', async () => {
    await storage.writeBarChartFile('US-CA-001', 'old', 'old.txt')
    await storage.writeBarChartFile('US-CA-001', 'new', 'new.txt')
    expect(harness.files.get('data/barcharts/US-CA-001.txt')).toBe('new')
    expect(manifest().counties['US-CA-001'].filename).toBe('new.txt')
    await storage.deleteBarChartFile('US-CA-001')
    expect(harness.files.has('data/barcharts/US-CA-001.txt')).toBe(false)
    expect(manifest().counties).toEqual({})
    // Nothing derived was ever written beside them (FR-39).
    expect([...harness.files.keys()].sort()).toEqual([BARCHARTS_META_PATH])
  })

  it('remove is idempotent', async () => {
    await expect(storage.deleteBarChartFile('US-CA-001')).resolves.toBeUndefined()
    await expect(storage.deleteBarChartFile('US-CA-001')).resolves.toBeUndefined()
  })

  it('the filename round trip: every name the registry admits is written and read back, and the first it refuses the writer refuses too, writing nothing (security review L2)', async () => {
    // Before this, a name past the reader's bound was written and then dropped
    // on read: the county's file invisible, orphaned on disk.
    const named = (units: number) => `${'n'.repeat(units - '.txt'.length)}.txt`
    const atBound = named(BARCHART_FILENAME_MAX)
    expect(refuseByFilename(atBound, 'barchart')).toBeNull()
    await storage.writeBarChartFile('US-CA-001', 'kept', atBound)
    await expect(storage.getBarChartFiles()).resolves.toMatchObject({ counties: { 'US-CA-001': { filename: atBound } } })

    const over = named(BARCHART_FILENAME_MAX + 1)
    expect(refuseByFilename(over, 'barchart')).not.toBeNull()
    harness.touched = []
    await expect(storage.writeBarChartFile('US-CA-013', 'orphan', over)).rejects.toThrow(/too long/)
    expect(harness.touched).toEqual([])
    expect(Object.keys((await storage.getBarChartFiles()).counties)).toEqual(['US-CA-001'])
  })

  it('a corrupt manifest is healed by the next add, not wedged forever', async () => {
    harness.files.set(BARCHARTS_META_PATH, 'not json')
    await expect(storage.getBarChartFiles()).rejects.toThrow()
    await storage.writeBarChartFile('US-CA-013', 'c', 'c.txt')
    await expect(storage.getBarChartFiles()).resolves.toMatchObject({ counties: { 'US-CA-013': { filename: 'c.txt' } } })
  })
})

describe('serialization on the manifest chain (QA-73)', () => {
  it('two concurrent adds for different counties both survive in the one manifest', async () => {
    harness.manual = true
    const a = storage.writeBarChartFile('US-CA-001', 'a', 'a.txt')
    const b = storage.writeBarChartFile('US-CA-013', 'b', 'b.txt')
    await drainReadsFirst()
    await Promise.all([a, b])
    expect(Object.keys(manifest().counties).sort()).toEqual(['US-CA-001', 'US-CA-013'])
  })

  it('an add overlapping a settings save and a backup save leaves all three documents whole', async () => {
    await storage.setSetting('keep', 1)
    await storage.writeFile('ml', 'ml-content', 'ml.csv')
    harness.manual = true
    const ops = [
      storage.writeBarChartFile('US-CA-001', 'a', 'a.txt'),
      storage.setSetting('targetsCounty', 'US-CA-001'),
      storage.writeFile('ebird', 'ebird-content', 'MyEBirdData.csv'),
    ]
    await drainReadsFirst()
    await Promise.all(ops)
    expect(JSON.parse(harness.files.get('data/settings.json')!)).toEqual({ keep: 1, targetsCounty: 'US-CA-001' })
    const meta = JSON.parse(harness.files.get('data/metadata.json')!) as { ebird: { filename: string }; ml: { filename: string } }
    expect(meta.ebird.filename).toBe('MyEBirdData.csv')
    expect(meta.ml.filename).toBe('ml.csv')
    // The data-file metadata never learned about the bar-chart family (schema 1.1).
    expect(Object.keys(meta).sort()).toEqual(['ebird', 'ml'])
    expect(Object.keys(manifest().counties)).toEqual(['US-CA-001'])
  })
})

// ── icloud-bar-chart-sync (schema.md 6.1, 6.2; FR-07, FR-21, FR-22; QA-06, QA-19) ──

const ORIGIN = { deviceId: 'f'.repeat(32), label: 'iPhone', platform: 'iphone' as const }
const MINE = { deviceId: 'a'.repeat(32), label: "Dave's Mac", platform: 'mac' as const }
const T1 = '2026-09-20T12:05:00.000Z'
const T2 = '2026-09-21T08:00:00.000Z'
const entryOf = (code: string) => (JSON.parse(harness.files.get(BARCHARTS_META_PATH) ?? '{"counties":{}}') as { counties: Record<string, unknown> }).counties[code]

describe('the manifest\'s two new optional fields (FR-07, QA-06)', () => {
  it('a pre-feature entry reads intact with no origin (a file from this device)', () => {
    const out = normalizeBarChartManifest({ version: 1, counties: { 'US-CA-001': { filename: 'a.txt', uploadedAt: T1 } } })
    expect(out.counties['US-CA-001']).toEqual({ filename: 'a.txt', uploadedAt: T1 })
  })

  it('a well-formed origin and replaced time are kept', () => {
    const out = normalizeBarChartManifest({ version: 1, counties: { 'US-CA-001': { filename: 'a.txt', uploadedAt: T1, origin: ORIGIN, replacedBySyncAt: T2 } } })
    expect(out.counties['US-CA-001']).toEqual({ filename: 'a.txt', uploadedAt: T1, origin: ORIGIN, replacedBySyncAt: T2 })
  })

  it.each([
    ['a short device id', { ...ORIGIN, deviceId: 'f'.repeat(31) }],
    ['an uppercase device id', { ...ORIGIN, deviceId: 'F'.repeat(32) }],
    ['a path-shaped device id', { ...ORIGIN, deviceId: '../../../../../../../../etc/x' }],
    ['an unknown platform', { ...ORIGIN, platform: 'windows' }],
    ['a label that is not a string', { ...ORIGIN, label: 7 }],
    ['a label over the record bound', { ...ORIGIN, label: 'x'.repeat(65) }],
    ['not an object', 'iPhone'],
  ])('a malformed origin (%s) is dropped and the county KEPT', (_label, origin) => {
    const out = normalizeBarChartManifest({ version: 1, counties: { 'US-CA-001': { filename: 'a.txt', uploadedAt: T1, origin, replacedBySyncAt: 5 } } })
    expect(out.counties['US-CA-001']).toEqual({ filename: 'a.txt', uploadedAt: T1 })
  })
})

describe('the sync links on the manifest chain (schema.md 6.2)', () => {
  it('writeBarChartFile records the origin when given, never replacedBySyncAt', async () => {
    await storage.writeBarChartFile('US-CA-001', 'x', 'a.txt', MINE)
    expect(entryOf('US-CA-001')).toMatchObject({ filename: 'a.txt', origin: MINE })
    expect(entryOf('US-CA-001')).not.toHaveProperty('replacedBySyncAt')
  })

  it('applySyncedBarChartFile writes the entry after the pull, and a moved entry means the user won: false, nothing touched', async () => {
    const pull = vi.fn(async () => { harness.files.set('data/barcharts/US-CA-001.txt', 'pulled') })
    await expect(storage.applySyncedBarChartFile('US-CA-001', { filename: 'e.txt', uploadedAt: T1, origin: ORIGIN }, null, pull)).resolves.toBe(true)
    expect(entryOf('US-CA-001')).toEqual({ filename: 'e.txt', uploadedAt: T1, origin: ORIGIN })
    // A user add landed since the decision (expect no longer matches).
    await storage.writeBarChartFile('US-CA-001', 'mine', 'mine.txt')
    const before = harness.files.get(BARCHARTS_META_PATH)
    const pull2 = vi.fn(async () => {})
    await expect(storage.applySyncedBarChartFile('US-CA-001', { filename: 'e2.txt', uploadedAt: T2, origin: ORIGIN }, T1, pull2)).resolves.toBe(false)
    expect(pull2).not.toHaveBeenCalled()
    expect(harness.files.get(BARCHARTS_META_PATH)).toBe(before)
  })

  it('a rejecting pull leaves the manifest byte-identical and rejects only its own caller', async () => {
    await storage.writeBarChartFile('US-CA-013', 'x', 'other.txt')
    const before = harness.files.get(BARCHARTS_META_PATH)
    await expect(storage.applySyncedBarChartFile('US-CA-001', { filename: 'e.txt', uploadedAt: T1 }, null, async () => { throw new Error('mismatch') })).rejects.toThrow(/mismatch/)
    expect(harness.files.get(BARCHARTS_META_PATH)).toBe(before)
    // The chain is not poisoned.
    await storage.writeBarChartFile('US-CA-041', 'x', 'next.txt')
    expect(entryOf('US-CA-041')).toBeDefined()
  })

  it('an entry the manifest reader would drop is refused BEFORE anything is written (the write chokepoint validates)', async () => {
    const pull = vi.fn(async () => {})
    await expect(storage.applySyncedBarChartFile('US-CA-001', { filename: 'e.txt', uploadedAt: 'x'.repeat(41) }, null, pull)).rejects.toThrow(/out of bounds/)
    expect(pull).not.toHaveBeenCalled()
    await expect(storage.applySyncedBarChartFile('US-CA-001\n', { filename: 'e.txt', uploadedAt: T1 }, null, pull)).rejects.toThrow()
    expect(harness.touched).not.toContain('data/barcharts/US-CA-001\n.txt')
  })

  it('applySyncedBarChartClear removes the file and the entry under the same guard', async () => {
    await storage.writeBarChartFile('US-CA-001', 'x', 'a.txt')
    const at = (entryOf('US-CA-001') as { uploadedAt: string }).uploadedAt
    await expect(storage.applySyncedBarChartClear('US-CA-001', 'wrong')).resolves.toBe(false)
    expect(harness.files.has('data/barcharts/US-CA-001.txt')).toBe(true)
    await expect(storage.applySyncedBarChartClear('US-CA-001', at)).resolves.toBe(true)
    expect(harness.files.has('data/barcharts/US-CA-001.txt')).toBe(false)
    expect(entryOf('US-CA-001')).toBeUndefined()
  })

  it('stampBarChartOrigin sets a missing origin and rewrites the time when told, only while the entry is unchanged', async () => {
    await storage.writeBarChartFile('US-CA-001', 'x', 'a.txt')
    const at = (entryOf('US-CA-001') as { uploadedAt: string }).uploadedAt
    await expect(storage.stampBarChartOrigin('US-CA-001', MINE, T1, 'moved')).resolves.toBe(false)
    await expect(storage.stampBarChartOrigin('US-CA-001', MINE, T1, at)).resolves.toBe(true)
    expect(entryOf('US-CA-001')).toMatchObject({ uploadedAt: T1, origin: MINE })
    // An origin already present is never replaced; nothing to record answers false.
    await expect(storage.stampBarChartOrigin('US-CA-001', ORIGIN, T1, T1)).resolves.toBe(false)
    expect(entryOf('US-CA-001')).toMatchObject({ origin: MINE })
  })
})

describe('deleteAllBarChartFiles: the manifest describes exactly what is left (FR-21, FR-22, QA-19)', () => {
  it('removes every file and empties the manifest', async () => {
    await storage.writeBarChartFile('US-CA-001', 'x', 'a.txt')
    await storage.writeBarChartFile('US-CA-013', 'y', 'b.txt')
    const r = await storage.deleteAllBarChartFiles()
    expect(r).toEqual({ removed: ['US-CA-001', 'US-CA-013'], failed: [] })
    expect(harness.files.has('data/barcharts/US-CA-001.txt')).toBe(false)
    expect(harness.files.has('data/barcharts/US-CA-013.txt')).toBe(false)
    expect(manifest().counties).toEqual({})
  })

  it('a file whose removal fails and which is still there is a SURVIVOR: kept listed, reported, and nothing else is left inconsistent', async () => {
    await storage.writeBarChartFile('US-CA-001', 'x', 'a.txt')
    await storage.writeBarChartFile('US-CA-013', 'y', 'b.txt')
    const realRemove = pluginFs.remove
    const spy = vi.spyOn(pluginFs, 'remove').mockImplementation(async (path, opts) => {
      if (String(path) === 'data/barcharts/US-CA-013.txt') throw new Error('EBUSY')
      return realRemove(path, opts)
    })
    try {
      const r = await storage.deleteAllBarChartFiles()
      expect(r).toEqual({ removed: ['US-CA-001'], failed: ['US-CA-013'] })
    } finally {
      spy.mockRestore()
    }
    expect(Object.keys(manifest().counties)).toEqual(['US-CA-013'])
    expect(harness.files.has('data/barcharts/US-CA-013.txt')).toBe(true)
    expect(harness.files.has('data/barcharts/US-CA-001.txt')).toBe(false)
  })

  it('on an empty store it removes nothing and never rejects', async () => {
    await expect(storage.deleteAllBarChartFiles()).resolves.toEqual({ removed: [], failed: [] })
  })

  it('rides the manifest chain: an add queued behind it survives, never erased by a stale base', async () => {
    await storage.writeBarChartFile('US-CA-001', 'x', 'a.txt')
    harness.manual = true
    const clearing = storage.deleteAllBarChartFiles()
    const adding = storage.writeBarChartFile('US-CA-013', 'y', 'b.txt')
    await drainReadsFirst()
    await Promise.all([clearing, adding])
    expect(Object.keys(manifest().counties)).toEqual(['US-CA-013'])
  })
})

describe('a synced arrival interleaved with a user add for another county (schema.md 11.1)', () => {
  it('both entries persist', async () => {
    harness.manual = true
    const pulled = storage.applySyncedBarChartFile('US-CA-001', { filename: 'e.txt', uploadedAt: T1, origin: ORIGIN }, null, async () => {
      harness.files.set('data/barcharts/US-CA-001.txt', 'pulled')
    })
    const added = storage.writeBarChartFile('US-CA-013', 'y', 'b.txt')
    await drainReadsFirst()
    await Promise.all([pulled, added])
    expect(Object.keys(manifest().counties).sort()).toEqual(['US-CA-001', 'US-CA-013'])
  })
})

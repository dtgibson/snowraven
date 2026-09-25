// The hand-over controller's triggers and failure posture (ios-lifer-widgets
// FR-23, FR-31; QA-23, QA-31). Driven through the controller's dependency seam
// with fake timers, so every assertion is about calls made, never elapsed time.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createHandoverController, HANDOVER_DEBOUNCE_MS, type HandoverDeps } from './widgetHandoverController'
import { notifyFilesChanged, subscribeFilesChanged } from '../filesChanged'
import { notifyKeysChanged, subscribeKeysChanged } from '../keysChanged'
import { notifyMapDefaultsChanged, subscribeMapDefaultsChanged } from '../mapDefaultsChanged'
import type { WidgetHandoverV1 } from './widgetHandover'

interface World {
  ebird: boolean
  ml: boolean
  key: string | null
  defaults: unknown
  ebirdLoad: 'ok' | 'null' | 'throw'
  statusThrows: boolean
  /** The backup's common names (default: two clean ones). */
  names?: string[]
  /** Reject the next N native writes with "unavailable". */
  failWrites?: number
  /** Reject the next N native removals with "unavailable". */
  failRemoves?: number
}

function harness(world: World) {
  const writes: WidgetHandoverV1[] = []
  let removes = 0
  const deps: HandoverDeps = {
    getFilesStatus: vi.fn(async () => {
      if (world.statusThrows) throw new Error('unreadable')
      return { ebird: world.ebird ? { filename: 'e.csv', uploadedAt: 'x' } : null, ml: world.ml ? { filename: 'm.csv', uploadedAt: 'x' } : null } as never
    }),
    loadEbird: vi.fn(async () => {
      if (world.ebirdLoad === 'throw') throw new Error('x')
      return world.ebirdLoad === 'null' ? null
        : { observations: (world.names ?? ['Mallard', 'Wrentit']).map(commonName => ({ commonName })) }
    }),
    loadML: vi.fn(async () => ({ rows: [{ commonName: 'Mallard', format: 'Photo' }] })),
    getEbirdKey: vi.fn(async () => world.key),
    getMapDefaults: vi.fn(async () => world.defaults),
    getAppVersion: vi.fn(async () => '1.0.36'),
    now: () => Date.UTC(2026, 8, 23, 18, 0, 0),
    write: vi.fn(async (doc: string) => {
      if ((world.failWrites ?? 0) > 0) { world.failWrites!--; throw 'unavailable' }
      writes.push(JSON.parse(doc))
    }),
    remove: vi.fn(async () => {
      if ((world.failRemoves ?? 0) > 0) { world.failRemoves!--; throw 'unavailable' }
      removes++
    }),
    subscribe: trigger => {
      const offs = [subscribeFilesChanged(trigger), subscribeKeysChanged(trigger), subscribeMapDefaultsChanged(trigger)]
      return () => offs.forEach(o => o())
    },
    setTimer: (fn, ms) => setTimeout(fn, ms),
    clearTimer: h => clearTimeout(h as ReturnType<typeof setTimeout>),
  }
  const ctl = createHandoverController(deps)
  const settle = async () => { await vi.advanceTimersByTimeAsync(HANDOVER_DEBOUNCE_MS + 1); await ctl.idle() }
  return { ctl, deps, writes, settle, removes: () => removes }
}

/** The no-key document: the widget reads it as S2 and makes no request. */
const REVOKED = {
  ebirdKey: null, hasEbirdBackup: false, recorded: [], hasMlExport: false,
  targetsMissingPhoto: [], targetsMissingAudio: [], targetsMissingVideo: [], defaultLocation: null,
}

const WORLD = (): World => ({ ebird: true, ml: true, key: 'abc123', defaults: { lat: 1, lng: 2, dist: 5 }, ebirdLoad: 'ok', statusThrows: false })

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

describe('triggers: boot and the three epochs, one whole-document write each', () => {
  it('boot (the first trigger) writes once', async () => {
    const h = harness(WORLD())
    h.ctl.trigger()
    await h.settle()
    expect(h.deps.write).toHaveBeenCalledTimes(1)
    expect(h.writes[0]!.hasEbirdBackup).toBe(true)
    h.ctl.stop()
  })

  it.each([
    ['filesChanged', notifyFilesChanged],
    ['keysChanged', notifyKeysChanged],
    ['mapDefaultsChanged', notifyMapDefaultsChanged],
  ])('%s regenerates and writes once', async (_name, notify) => {
    const h = harness(WORLD())
    notify()
    await h.settle()
    expect(h.deps.write).toHaveBeenCalledTimes(1)
    h.ctl.stop()
    notify()
    await h.settle()
    expect(h.deps.write).toHaveBeenCalledTimes(1)   // stopped: unsubscribed
  })

  it('a burst inside the debounce (an upload, then a key save) is ONE write', async () => {
    const h = harness(WORLD())
    notifyFilesChanged(); notifyKeysChanged(); notifyMapDefaultsChanged()
    await h.settle()
    expect(h.deps.write).toHaveBeenCalledTimes(1)
    h.ctl.stop()
  })

  it('every write is a whole document read fresh from the seams', async () => {
    const w = WORLD()
    const h = harness(w)
    h.ctl.trigger(); await h.settle()
    w.key = null
    notifyKeysChanged(); await h.settle()
    expect(h.writes).toHaveLength(2)
    expect(h.writes[1]!.ebirdKey).toBeNull()
    expect(h.writes[1]!.recorded).toEqual(h.writes[0]!.recorded)
    expect(h.deps.getFilesStatus).toHaveBeenCalledTimes(2)
    h.ctl.stop()
  })
})

describe('the clear shapes arrive through the epochs (FR-31)', () => {
  it('clearing the backup writes hasEbirdBackup false; clearing the export writes hasMlExport false; clearing the key writes null', async () => {
    const w = WORLD()
    const h = harness(w)
    w.ebird = false; notifyFilesChanged(); await h.settle()
    expect(h.writes.at(-1)).toMatchObject({ hasEbirdBackup: false, recorded: [] })
    w.ebird = true; w.ml = false; notifyFilesChanged(); await h.settle()
    expect(h.writes.at(-1)).toMatchObject({ hasMlExport: false, targetsMissingPhoto: [] })
    w.key = null; notifyKeysChanged(); await h.settle()
    expect(h.writes.at(-1)!.ebirdKey).toBeNull()
    w.defaults = null; notifyMapDefaultsChanged(); await h.settle()
    expect(h.writes.at(-1)!.defaultLocation).toBeNull()
    h.ctl.stop()
  })
})

describe('a failed read is UNKNOWN, never empty: nothing is written', () => {
  it.each([
    ['the file status throws', (w: World) => { w.statusThrows = true }],
    ['a stored backup cannot be loaded (null)', (w: World) => { w.ebirdLoad = 'null' }],
    ['a stored backup load rejects', (w: World) => { w.ebirdLoad = 'throw' }],
  ])('%s', async (_n, mutate) => {
    const w = WORLD(); mutate(w)
    const h = harness(w)
    h.ctl.trigger(); await h.settle()
    expect(h.deps.write).not.toHaveBeenCalled()
    h.ctl.stop()
  })

  it('an unreadable backup with the key UNCHANGED since the last write keeps the last document', async () => {
    const w = WORLD()
    const h = harness(w)
    h.ctl.trigger(); await h.settle()
    w.ebirdLoad = 'throw'; notifyFilesChanged(); await h.settle()
    expect(h.deps.write).toHaveBeenCalledTimes(1)
    expect(h.ctl.lastOutcome()).toEqual({ kind: 'kept' })
    h.ctl.stop()
  })

  it('a native write that rejects is swallowed and the next trigger still writes', async () => {
    const h = harness(WORLD())
    ;(h.deps.write as ReturnType<typeof vi.fn>).mockRejectedValueOnce('unavailable')
    h.ctl.trigger(); await h.settle()
    notifyFilesChanged(); await h.settle()
    expect(h.deps.write).toHaveBeenCalledTimes(2)
    h.ctl.stop()
  })
})

// Security review M1: a removed or replaced key (or a removed file) never
// survives in the App Group because an UNRELATED input failed. Each row starts
// from a written document holding the old key, as a real session does.
describe('a removal is never left behind (M1): the rewrite fails, the key still goes', () => {
  async function afterFirstWrite(w: World) {
    const h = harness(w)
    h.ctl.trigger(); await h.settle()
    expect(h.writes.at(-1)!.ebirdKey).toBe('abc123')
    return h
  }

  it('a key CLEAR with an unloadable backup writes the no-key document', async () => {
    const w = WORLD()
    const h = await afterFirstWrite(w)
    w.key = null; w.ebirdLoad = 'throw'; notifyKeysChanged(); await h.settle()
    expect(h.writes.at(-1)).toMatchObject(REVOKED)
    expect(h.ctl.lastOutcome()).toEqual({ kind: 'revoked', by: 'no-key-document', failed: [] })
    h.ctl.stop()
  })

  it('a key CLEAR with one out-of-bounds name in the backup writes the whole document, the name skipped', async () => {
    const w = WORLD()
    const h = await afterFirstWrite(w)
    w.key = null; w.names = ['Mallard', 'Mal\tlard', 'a'.repeat(201), 'Wrentit']; notifyKeysChanged(); await h.settle()
    const last = h.writes.at(-1)!
    expect(last.ebirdKey).toBeNull()
    expect(last.hasEbirdBackup).toBe(true)
    expect(last.recorded).toEqual(['mallard', 'wrentit'])
    expect(h.ctl.lastOutcome()).toEqual({ kind: 'written' })
    h.ctl.stop()
  })

  it('a key REPLACE with a key the class refuses writes the no-key document, never keeping the old key', async () => {
    const w = WORLD()
    const h = await afterFirstWrite(w)
    w.key = 'new key'; notifyKeysChanged(); await h.settle()
    expect(h.writes.at(-1)).toMatchObject(REVOKED)
    h.ctl.stop()
  })

  it('a key REPLACE with a valid key and an unloadable backup revokes too', async () => {
    const w = WORLD()
    const h = await afterFirstWrite(w)
    w.key = 'def456'; w.ebirdLoad = 'null'; notifyKeysChanged(); await h.settle()
    expect(h.writes.at(-1)).toMatchObject(REVOKED)
    h.ctl.stop()
  })

  it('a backup CLEAR whose rewrite cannot finish (the Default Location unreadable) drops the names', async () => {
    const w = WORLD()
    const h = await afterFirstWrite(w)
    const getDefaults = h.deps.getMapDefaults as ReturnType<typeof vi.fn>
    getDefaults.mockRejectedValueOnce(new Error('unreadable'))
    w.ebird = false; notifyFilesChanged(); await h.settle()
    expect(h.writes.at(-1)).toMatchObject(REVOKED)
    h.ctl.stop()
  })

  it('a key CLEAR whose whole build THROWS (a defect, not a read failure) still revokes', async () => {
    const w = WORLD()
    const h = await afterFirstWrite(w)
    ;(h.deps.loadEbird as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ observations: [{ commonName: undefined as unknown as string }] })
    w.key = null; notifyKeysChanged(); await h.settle()
    expect(h.writes.at(-1)).toMatchObject(REVOKED)
    h.ctl.stop()
  })

  it('at boot (nothing written yet) a cleared key with an unloadable backup revokes', async () => {
    const w = WORLD(); w.key = null; w.ebirdLoad = 'throw'
    const h = harness(w)
    h.ctl.trigger(); await h.settle()
    expect(h.writes).toHaveLength(1)
    expect(h.writes[0]).toMatchObject(REVOKED)
    h.ctl.stop()
  })

  it('at boot an unloadable backup with a valid key and no export keeps the document (Nearby Lifers keeps working)', async () => {
    const w = WORLD(); w.ml = false; w.ebirdLoad = 'throw'
    const h = harness(w)
    h.ctl.trigger(); await h.settle()
    expect(h.deps.write).not.toHaveBeenCalled()
    expect(h.ctl.lastOutcome()).toEqual({ kind: 'kept' })
    h.ctl.stop()
  })

  it('when the native write rejects, the document is REMOVED instead', async () => {
    const w = WORLD()
    const h = await afterFirstWrite(w)
    w.key = null; w.failWrites = 2; notifyKeysChanged(); await h.settle()
    expect(h.removes()).toBe(1)
    expect(h.ctl.lastOutcome()).toEqual({ kind: 'revoked', by: 'removal', failed: ['write:unavailable'] })
    h.ctl.stop()
  })

  it('a clock the documents cannot carry (past the Date range) falls back to REMOVING the document', async () => {
    const w = WORLD()
    const h = await afterFirstWrite(w)
    h.deps.now = () => 8.64e15 + 1
    w.key = null; notifyKeysChanged(); await h.settle()
    expect(h.removes()).toBe(1)
    expect(h.ctl.lastOutcome()).toEqual({ kind: 'revoked', by: 'removal', failed: ['write:unbuildable'] })
    h.ctl.stop()
  })

  it('a revocation that cannot be done is RETURNED and retried by the next regeneration, even with nothing changed', async () => {
    const w = WORLD()
    const h = await afterFirstWrite(w)
    w.key = null; w.failWrites = 2; w.failRemoves = 1; notifyKeysChanged(); await h.settle()
    expect(h.ctl.lastOutcome()).toEqual({ kind: 'revoke-failed', failed: ['write:unavailable', 'remove:unavailable'] })
    expect(h.writes.at(-1)!.ebirdKey).toBe('abc123')   // still on disk: the failure is reported, not hidden
    // The retry cannot even read the key this time, so nothing it reads shows
    // a removal; only the PENDING revocation makes it run.
    ;(h.deps.getEbirdKey as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('unreadable'))
    notifyMapDefaultsChanged(); await h.settle()
    expect(h.writes.at(-1)).toMatchObject(REVOKED)
    expect(h.ctl.lastOutcome()).toMatchObject({ kind: 'revoked' })
    h.ctl.stop()
  })
})

describe('one regeneration at a time, one queued follow-up', () => {
  it('a trigger during a running regeneration produces exactly one more write', async () => {
    const w = WORLD()
    const h = harness(w)
    let release!: () => void
    ;(h.deps.getFilesStatus as ReturnType<typeof vi.fn>).mockImplementationOnce(() => new Promise(r => {
      release = () => r({ ebird: { filename: 'e', uploadedAt: 'x' }, ml: null })
    }))
    h.ctl.trigger()
    await vi.advanceTimersByTimeAsync(HANDOVER_DEBOUNCE_MS + 1)
    expect(h.deps.getFilesStatus).toHaveBeenCalledTimes(1)
    notifyFilesChanged(); await vi.advanceTimersByTimeAsync(HANDOVER_DEBOUNCE_MS + 1)
    notifyKeysChanged(); await vi.advanceTimersByTimeAsync(HANDOVER_DEBOUNCE_MS + 1)
    release()
    await h.ctl.idle()
    expect(h.deps.write).toHaveBeenCalledTimes(2)
    h.ctl.stop()
  })
})

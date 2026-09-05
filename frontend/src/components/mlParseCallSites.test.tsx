// @vitest-environment jsdom
// Guard for improve: ml-export-hardening.
//
// THERE ARE TWO ML PARSE CALL SITES, AND BOTH GO OFF-THREAD SEPARATELY.
// `mlExportCache.loadFresh` is the obvious one. The other is Multimedia's own read
// in `LifeList.tsx`, which v0.5.52 deliberately did NOT route through the cache
// (the cache swallows a bad parse to null and has no `detectExportType` gate, and
// this tab needs both distinctions). That decision stays; what changed is that both
// sites now await the same off-thread twin.
//
// This file exists because converting only the cache would have left the freeze
// exactly where it matters most: Multimedia is the tab whose whole purpose is the
// export, so it is the one most likely to be holding a large one. The code would
// have looked converted, and one of the two paths would still have been parsing a
// 30 MB CSV on the thread that paints. Symmetry in the code is not symmetry in the
// evidence (v1.0.14), so each site gets its own row, and each row proves the same
// two things: a worker was constructed, and the main-thread parser was never called.
//
// The counter is the load-bearing half. `parseMLExport` is mocked here only to
// count calls THROUGH THE APP'S IMPORT; the fake worker parses with the real,
// unmocked function, exactly as the real worker does in its own module scope. So a
// row that quietly fell back to a main-thread parse would show a count of one.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import type { MLParseReply } from '../lib/parseMLExportOffThread'

const H = vi.hoisted(() => ({
  getFilesStatus: vi.fn(),
  readFile: vi.fn(),
  getSetting: vi.fn(),
  setSetting: vi.fn(),
  loadEbird: vi.fn(),
  tGet: vi.fn(),
  tPost: vi.fn(),
  mainThreadParses: { count: 0 },
}))

vi.mock('../lib/storage', () => ({
  storage: {
    getFilesStatus: H.getFilesStatus,
    readFile: H.readFile,
    getSetting: H.getSetting,
    setSetting: H.setSetting,
  },
}))
vi.mock('../lib/observationsCache', () => ({ loadEbirdObservations: H.loadEbird }))
vi.mock('../lib/transport', () => ({
  transport: { get: H.tGet, post: H.tPost },
  TransportError: class extends Error {},
}))
vi.mock('../lib/parseMLExport', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/parseMLExport')>()
  return {
    ...actual,
    parseMLExport: (text: string) => {
      H.mainThreadParses.count += 1
      return actual.parseMLExport(text)
    },
  }
})

import { LifeList } from './LifeList'
import { clearMLExportCache, loadMLExport } from '../lib/mlExportCache'

// The REAL parser, reached around the counting mock, so the fake worker does what
// the real one does: parse in its own scope, post the result back.
const realParse = (await vi.importActual<typeof import('../lib/parseMLExport')>('../lib/parseMLExport')).parseMLExport

const ML_CSV = [
  'Catalog Number,Common Name,Scientific Name,Format,Date,Locality',
  '101,American Robin,Turdus migratorius,Photo,2024-05-01,West Pond',
  '102,Song Sparrow,Melospiza melodia,Audio,2024-05-02,West Pond',
].join('\n') + '\n'

const ML_ONLY = { ebird: null, ml: { filename: 'ML__2024_abc.csv', uploadedAt: '2024-06-01' } }

class FakeWorker {
  static made: FakeWorker[] = []
  onmessage: ((e: MessageEvent<MLParseReply>) => void) | null = null
  onerror: ((e: unknown) => void) | null = null
  onmessageerror: ((e: unknown) => void) | null = null
  terminations = 0

  constructor() { FakeWorker.made.push(this) }

  postMessage(text: string): void {
    void Promise.resolve().then(() => {
      let reply: MLParseReply
      try { reply = { ok: true, result: realParse(text) } } catch { reply = { ok: false } }
      this.onmessage?.({ data: reply } as MessageEvent<MLParseReply>)
    })
  }

  terminate(): void { this.terminations += 1 }
}

beforeEach(() => {
  clearMLExportCache()
  for (const fn of [H.getFilesStatus, H.readFile, H.getSetting, H.setSetting, H.loadEbird, H.tGet, H.tPost]) fn.mockReset()
  H.getFilesStatus.mockResolvedValue(ML_ONLY)
  H.readFile.mockResolvedValue(ML_CSV)
  H.getSetting.mockResolvedValue(null)
  H.setSetting.mockResolvedValue(undefined)
  H.loadEbird.mockResolvedValue(null)
  H.tGet.mockRejectedValue(new Error('no network in this suite'))
  H.tPost.mockRejectedValue(new Error('no network in this suite'))
  H.mainThreadParses.count = 0
  FakeWorker.made = []
  ;(globalThis as { Worker?: unknown }).Worker = FakeWorker
})

afterEach(() => {
  cleanup()
  delete (globalThis as { Worker?: unknown }).Worker
})

describe('both ML parse call sites parse off the main thread', () => {
  it('mlExportCache.loadFresh: the shared cache', async () => {
    const loaded = await loadMLExport()

    expect(loaded).not.toBeNull()
    expect(loaded!.entries.map(e => e.commonName)).toEqual(['American Robin', 'Song Sparrow'])
    expect(FakeWorker.made).toHaveLength(1)
    expect(FakeWorker.made[0].terminations).toBe(1)
    expect(H.mainThreadParses.count).toBe(0)
  })

  it('LifeList: Multimedia\'s own read, which v0.5.52 kept separate', async () => {
    render(<LifeList onGoToSettings={() => {}} filesVersion={0} />)

    // Reaches the ready list rather than a load-failure panel: the off-thread parse
    // produced the same rows the synchronous one did.
    expect(await screen.findByRole('switch', { name: /Show all forms/ })).toBeTruthy()
    expect(screen.getByText('American Robin')).toBeTruthy()

    expect(FakeWorker.made).toHaveLength(1)
    expect(FakeWorker.made[0].terminations).toBe(1)
    expect(H.mainThreadParses.count).toBe(0)
    // It did NOT quietly start going through the shared cache instead: the tab read
    // the file itself, which is the v0.5.52 split this build preserves.
    expect(H.readFile).toHaveBeenCalledWith('ml')
  })

  it('guard the guard: with no Worker, each site parses here exactly once', async () => {
    // Non-vacuity for the counter. If the counting mock were wired wrong, the two
    // rows above would pass with the parse running on the main thread all along.
    delete (globalThis as { Worker?: unknown }).Worker

    await loadMLExport()
    expect(H.mainThreadParses.count).toBe(1)

    clearMLExportCache()
    H.mainThreadParses.count = 0
    render(<LifeList onGoToSettings={() => {}} filesVersion={0} />)
    await screen.findByRole('switch', { name: /Show all forms/ })
    expect(H.mainThreadParses.count).toBe(1)
    expect(FakeWorker.made).toHaveLength(0)
  })

  it('a dead worker leaves Multimedia on its honest load-failure message, not a spinner', async () => {
    // The v1.0.14 hazard on this tab: without the settle contract a worker that
    // dies without dispatching `error` would leave the awaited promise pending and
    // the tab spinning for the session.
    class DeadWorker extends FakeWorker {
      override postMessage(): void {
        void Promise.resolve().then(() => this.onerror?.({ type: 'error' }))
      }
    }
    ;(globalThis as { Worker?: unknown }).Worker = DeadWorker

    render(<LifeList onGoToSettings={() => {}} filesVersion={0} />)

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
    // Not the setup panel: an export IS stored (the 1.0.14 lie).
    expect(screen.queryByText(/Macaulay Library Export Required/)).toBeNull()
    expect(H.mainThreadParses.count).toBe(0)
  })
})

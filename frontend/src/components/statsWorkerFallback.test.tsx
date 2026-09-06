// @vitest-environment jsdom
// Guard for improve: statistics-compute-off-thread.
//
// `lib/statsOffThreadSettle.test.ts` proves the settle contract at the promise: every
// failure path settles and returns the right bundle. THIS file proves the sentence
// that actually matters to a user, on the rendered tab: a worker that dies, a reply
// that will not clone back, and a worker that simply goes quiet each leave
// Statistics showing its statistics — the same figures, in the same places, as a
// healthy run.
//
// It matters as a separate file because the two halves can be wired wrong
// independently. A promise that resolves correctly is worthless if the component
// never commits its result, or commits it into a branch still gated on the
// spinner, or leaves the page on "Computing your statistics…" because the failure
// arrived on a rejection the render path does not read. The counted claim is
// therefore always the DOM.
//
// The baseline is jsdom's own no-Worker path (`Worker` undefined), which is the
// behaviour 1.0.19 shipped everywhere: the chain on this thread. Every failing
// worker is asserted to produce THE SAME PAGE.
//
// The second half of the file is the worker's LIFECYCLE as the tab drives it,
// which is the other thing only a rendered test can see. The held copy of the
// export is torn down through a chain of four links -- the files epoch, the load
// effect's phase, the `computed` gate, and the observations identity that keys the
// session -- and nothing else in the suite pairs that chain to the clear path the
// way `cacheInventory.test.ts` pairs the durable stores to theirs. The worker's
// copy correctly sits OUTSIDE `clearDerived.ts` (every row there is a durable
// on-disk document, and this is in-memory state that cannot outlive the session),
// so what is owed is not a registry row but evidence that the chain still runs.
import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest'
import { act, render, renderHook, screen, cleanup, waitFor } from '@testing-library/react'
import { notifyFilesChanged } from '../lib/filesChanged'
import { useStatsBundle } from '../lib/useStatsBundle'
import type { ObservationEntry } from '../types'

let rafQueue: FrameRequestCallback[] = []
function flushRaf() {
  const batch = rafQueue
  rafQueue = []
  for (const cb of batch) cb(performance.now())
}

vi.mock('./SnowMap', () => ({
  SnowMap: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}))
vi.mock('react-map-gl/maplibre', () => ({
  Marker: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Popup: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  useMap: () => ({ current: undefined }),
}))

function obs(p: Partial<ObservationEntry> & { submissionId: string; commonName: string; date: string }): ObservationEntry {
  return {
    scientificName: 'Sci', location: 'Park', locationId: 'L1',
    latitude: 44.9, longitude: -93.1, county: 'Hennepin', stateProvince: 'US-MN',
    count: 2, breedingCode: null, speciesComments: '', catalogIds: [],
    time: '07:30 AM', duration: 30, distance: 1, area: null, protocol: 'Traveling',
    numObservers: 1, allObsReported: true, checklistComments: '',
    ...p,
  }
}

// Four checklists and five countable species, so the figures asserted below are
// distinctive numbers rather than 0 or 1.
const FIXTURE_OBS: ObservationEntry[] = [
  obs({ submissionId: 'S1', commonName: 'American Robin', date: '2023-01-10', count: 2 }),
  obs({ submissionId: 'S1', commonName: 'Mallard', date: '2023-01-10', count: 9 }),
  obs({ submissionId: 'S2', commonName: 'Blue Jay', date: '2023-02-15', count: 1, locationId: 'L2', location: 'Woods', county: 'Ramsey' }),
  obs({ submissionId: 'S3', commonName: 'Northern Cardinal', date: '2023-03-20', count: 3, locationId: 'L3', location: 'Yard' }),
  obs({ submissionId: 'S4', commonName: 'Snowy Owl', date: '2024-11-02', count: 1, locationId: 'L4', location: 'Field', county: 'Anoka' }),
]

// Mutable through a hoisted holder so a test can change what the disk reports
// between loads -- a cleared file, or a replaced one -- which is what the
// lifecycle describe at the foot of this file drives.
const H = vi.hoisted(() => ({
  ebirdStatus: null as null | { filename: string; uploadedAt: string },
  observations: null as null | unknown[],
}))

vi.mock('../lib/observationsCache', () => ({
  loadEbirdObservations: vi.fn(async () =>
    (H.observations ? { headerLine: '', observations: H.observations } : null)),
}))
vi.mock('../lib/mlExportCache', () => ({ loadMLExport: vi.fn(async () => null) }))
vi.mock('../lib/storage', () => ({
  storage: {
    getFilesStatus: vi.fn(async () => ({ ebird: H.ebirdStatus, ml: null })),
    getSetting: vi.fn(async () => null),
    setSetting: vi.fn(async () => {}),
    readFile: vi.fn(async () => null),
    getApiKey: vi.fn(async () => null),
  },
}))
vi.mock('../lib/transport', () => ({
  transport: {
    post: vi.fn(async (path: string) => (path === '/taxonomy/codes' ? { codes: {}, orders: {} } : {})),
    get: vi.fn(async () => ({ species: [] })),
  },
}))

// ── The failing workers ──────────────────────────────────────────────────────
// Deliberately NOT a worker that answers: a healthy worker is covered at the
// promise, and jsdom cannot run a real module worker anyway. What this file needs
// is the three shapes of silence, delivered into the real component.
type Behavior = 'error' | 'messageerror' | 'silent' | 'healthy'
let behavior: Behavior = 'error'
let workersMade = 0
const workers: FailingWorker[] = []

class FailingWorker {
  onmessage: ((e: { data: unknown }) => void) | null = null
  onerror: ((e: unknown) => void) | null = null
  onmessageerror: ((e: unknown) => void) | null = null
  terminations = 0
  held: unknown = null
  constructor() { workersMade += 1; workers.push(this) }
  postMessage(message: { id: number; observations?: unknown; request: unknown }): void {
    if (behavior === 'silent') return
    if (message.observations) this.held = message.observations
    void Promise.resolve().then(async () => {
      if (behavior === 'error') { this.onerror?.({ type: 'error' }); return }
      if (behavior === 'messageerror') { this.onmessageerror?.({ type: 'messageerror' }); return }
      // 'healthy': answer the way statsWorker.ts does, over the HELD copy, so the
      // lifecycle tests exercise a worker that is genuinely alive and holding the
      // export rather than one that died on arrival.
      const { computeStatsBundle } = await import('../lib/statsBundle')
      const bundle = computeStatsBundle(
        (this.held ?? []) as never, message.request as never,
      )
      this.onmessage?.({ data: { id: message.id, ok: true, bundle } })
    })
  }
  terminate(): void { this.terminations += 1 }
}

let BirdingStats: typeof import('./BirdingStats').BirdingStats

beforeEach(async () => {
  rafQueue = []
  workersMade = 0
  workers.length = 0
  behavior = 'error'
  H.ebirdStatus = { filename: 'ebird.csv', uploadedAt: '2023-04-01' }
  H.observations = FIXTURE_OBS
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { rafQueue.push(cb); return rafQueue.length })
  vi.stubGlobal('cancelAnimationFrame', () => {})
  vi.stubGlobal('requestIdleCallback', (cb: () => void) => { cb(); return 1 })
  vi.stubGlobal('cancelIdleCallback', () => {})
  ;({ BirdingStats } = await import('./BirdingStats'))
})

afterEach(() => {
  cleanup()
  delete (globalThis as { Worker?: unknown }).Worker
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

// recharts bundles @reduxjs/toolkit, whose autoBatch fallback timer (100 ms) must
// fire before this file's jsdom environment is torn down (test-setup.ts rule).
afterAll(() => new Promise(r => setTimeout(r, 120)))

async function renderComputed() {
  render(<BirdingStats onGoToSettings={() => {}} onOpenSpecies={() => {}} />)
  await waitFor(() => expect(screen.getByText('Statistics')).toBeTruthy())
  // Wait on the stub queue itself, not the DOM: the passive effect that queues the
  // rAF cascade can land after the commit `waitFor` resolves on, and flushing an
  // empty queue would leave the shell frozen (the repo's frozen-shell rule).
  await waitFor(() => expect(rafQueue.length).toBeGreaterThan(0))
  await act(async () => { flushRaf() })
  await act(async () => { flushRaf() })
}

/** The whole page as text, whitespace-collapsed. Comparing PAGES rather than a
 *  handful of chosen numbers is the point: a fallback that dropped one section
 *  would pass any assertion list short enough to write out. */
function pageText(): string {
  return (document.body.textContent ?? '').replace(/\s+/g, ' ').trim()
}

/** A few figures named individually, so a failure says WHICH number moved rather
 *  than printing two pages of diff. */
function figures() {
  return {
    checklists: /(\d+) checklists · eBird backup/.exec(pageText())?.[1],
    hasSpeciesTile: pageText().includes('Species'),
    hasLifeListTotals: pageText().includes('Life List Totals'),
    hasHighlights: pageText().includes('Highlights & Records'),
    computing: pageText().includes('Computing your statistics'),
  }
}

describe('a worker that cannot answer leaves the tab showing its statistics', () => {
  // The baseline: no Worker at all, which is what 1.0.19 did on every device.
  let baseline = ''

  it('captures the no-worker baseline', async () => {
    delete (globalThis as { Worker?: unknown }).Worker
    await renderComputed()
    baseline = pageText()

    // Non-vacuity: the baseline is a computed page, not a spinner and not a shell.
    expect(figures().computing).toBe(false)
    expect(figures().checklists).toBe('4')
    expect(baseline).toContain('Life List Totals')
    expect(baseline).toContain('Highlights & Records')
    expect(baseline).toContain('American Robin')
    expect(baseline.length).toBeGreaterThan(1_000)
    expect(workersMade).toBe(0)
  })

  for (const b of ['error', 'messageerror', 'silent'] as const) {
    it(`renders the identical page when the worker ${{
      error: 'dies', messageerror: 'replies with something unreadable', silent: 'goes quiet',
    }[b]}`, async () => {
      expect(baseline.length).toBeGreaterThan(1_000)   // the baseline test ran first
      behavior = b
      ;(globalThis as { Worker?: unknown }).Worker = FailingWorker

      if (b === 'silent') {
        // Silence settles on the watchdog, tens of seconds out, so this one case
        // needs a controlled clock. Testing Library's `waitFor` cannot be used
        // under it: RTL detects Jest's fake timers, not vitest's, so its poll
        // interval is itself faked and never fires. Pump explicitly instead —
        // bounded, and asserted to have actually got somewhere.
        // ONLY setTimeout, which is the watchdog. Vitest's default fake-timer set
        // also replaces requestAnimationFrame, which would silently override this
        // file's rAF stub and leave the `computed` gate unreachable — the queue
        // simply never fills and the assertion below is what says so.
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
        try {
          const pump = async (ms = 0) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms) }) }
          render(<BirdingStats onGoToSettings={() => {}} onOpenSpecies={() => {}} />)
          for (let i = 0; i < 30 && rafQueue.length === 0; i++) await pump()
          expect(rafQueue.length).toBeGreaterThan(0)     // the load really resolved
          await act(async () => { flushRaf() })
          await act(async () => { flushRaf() })
          // Before the budget elapses the page is on its EXISTING shell — the
          // state this tab already had while its memos ran, not a new one.
          expect(figures().computing).toBe(true)
          await pump(120_000)
        } finally {
          vi.useRealTimers()
        }
      } else {
        await renderComputed()
      }

      // The worker really was reached — otherwise this is the baseline test again.
      expect(workersMade).toBeGreaterThan(0)
      expect(figures().computing).toBe(false)
      expect(figures().checklists).toBe('4')
      expect(pageText()).toBe(baseline)
    })
  }
})

describe('the held copy of the export does not outlive the export', () => {
  // The chain under test: notifyFilesChanged() -> the files epoch -> the load
  // effect -> the phase -> the `computed` gate -> the observations identity that
  // keys the session -> dispose() -> terminate(). Every link is somewhere else,
  // which is exactly why a future change can break it with nothing going red.
  async function renderWithLiveWorker() {
    behavior = 'healthy'
    ;(globalThis as { Worker?: unknown }).Worker = FailingWorker
    await renderComputed()
    await waitFor(() => expect(workers.length).toBe(1))
    // Non-vacuity: the worker was really constructed AND really answered, so a
    // teardown assertion below is about a live worker rather than about nothing.
    expect(figures().computing).toBe(false)
    expect(figures().checklists).toBe('4')
    expect(workers[0].terminations).toBe(0)
    return workers[0]
  }

  it('a cleared eBird file tears the worker down', async () => {
    const worker = await renderWithLiveWorker()

    // The clear path, driven through the real seam rather than by unmounting: the
    // Settings delete and the iCloud clear both end in exactly this call.
    H.ebirdStatus = null
    H.observations = null
    await act(async () => { notifyFilesChanged() })

    await waitFor(() => expect(worker.terminations).toBe(1))
    // And the tab really did leave the ready phase, so the teardown is the one
    // the clear caused rather than an idle timer or a stray re-render.
    await waitFor(() => expect(pageText()).toContain('Statistics require your eBird backup'))
    expect(workers.length).toBe(1)          // nothing respawned over a file that is gone
  })

  it('a REPLACED eBird file tears the old worker down and hands the new export to a new one', async () => {
    const worker = await renderWithLiveWorker()

    // A different array, which is what a re-upload or an iCloud arrival produces.
    // The session is keyed on that identity, so the old worker's copy must go.
    H.observations = [...FIXTURE_OBS, obs({ submissionId: 'S5', commonName: 'Sora', date: '2025-02-02', locationId: 'L5' })]
    await act(async () => { notifyFilesChanged() })
    await waitFor(() => expect(worker.terminations).toBe(1))

    // The arriving export re-runs the tab's two-pass render, so flush its rAF
    // ladder the way the first visit does.
    await waitFor(() => expect(rafQueue.length).toBeGreaterThan(0))
    await act(async () => { flushRaf() })
    await act(async () => { flushRaf() })

    // EVERY worker but the last is gone, and the last holds the NEW export.
    //
    // There is more than one, and that is worth stating rather than asserting a
    // count around. A replacement commits the new observations while `computed`
    // is still true, so the tab briefly holds a session for the new export before
    // the `computed` gate resets for the second pass and it is torn down again.
    // That transient pass is NOT something the worker introduced: 1.0.19 ran the
    // whole ~48 ms memo cascade in exactly that commit and threw it away too. Here
    // it costs a worker spawn and a hand-over instead of a blocking recompute, so
    // the path is cheaper than it was, and the assertion is on the property that
    // matters -- no copy of a replaced export is left alive anywhere.
    await waitFor(() => expect(workers.at(-1)!.held).toHaveLength(FIXTURE_OBS.length + 1))
    const last = workers.at(-1)!
    for (const w of workers) {
      if (w !== last) expect(w.terminations).toBe(1)
    }
    expect(last.terminations).toBe(0)
    await waitFor(() => expect(figures().checklists).toBe('5'))
  })
})

describe('the session is keyed on the export itself, not on the tab that hosts it', () => {
  // WHY THIS IS NOT COVERED BY THE TWO TESTS ABOVE. On this tab a new export
  // always drives `active` false and back again -- BirdingStats' `computed` gate
  // resets on the observations identity -- so removing `observations` from the
  // session effect's dependencies leaves both of them green: the `active`
  // transition tears the worker down anyway. Measured, not assumed; that mutation
  // survived the whole suite until this test existed.
  //
  // The redundancy is the CALLER's behaviour, though, and the hook must not depend
  // on it. A caller that swapped exports without cycling `active` would otherwise
  // keep the previous export's worker and answer every later toggle from a copy of
  // a file the user has replaced -- stale figures with nothing to show for them.
  // So the guarantee is pinned here, on the hook, with no component in the way.
  const EMPTY = new Set<string>()

  it('a new observations array replaces the worker even while `active` stays true', async () => {
    behavior = 'healthy'
    ;(globalThis as { Worker?: unknown }).Worker = FailingWorker

    const first = FIXTURE_OBS
    const second = [...FIXTURE_OBS, obs({ submissionId: 'S9', commonName: 'Sora', date: '2025-03-03', locationId: 'L9' })]

    const { result, rerender, unmount } = renderHook(
      ({ observations }) => useStatsBundle({
        observations, includeSpuh: false, granularity: 'total', excludedNames: EMPTY, active: true,
      }),
      { initialProps: { observations: first } },
    )

    await waitFor(() => expect(result.current).not.toBeNull())
    await waitFor(() => expect(workers.length).toBe(1))
    expect(workers[0].held).toHaveLength(first.length)
    expect(workers[0].terminations).toBe(0)
    const firstCount = result.current!.totals.checklistCount

    // `active` never changes. Only the export does.
    rerender({ observations: second })

    await waitFor(() => expect(workers[0].terminations).toBe(1))
    await waitFor(() => expect(workers.length).toBe(2))
    expect(workers[1].held).toHaveLength(second.length)
    // ...and the figures follow the new export rather than the retained copy.
    await waitFor(() => expect(result.current!.totals.checklistCount).toBe(firstCount + 1))
    unmount()
  })

  it('unmounting takes the worker with it', async () => {
    behavior = 'healthy'
    ;(globalThis as { Worker?: unknown }).Worker = FailingWorker
    const { result, unmount } = renderHook(() => useStatsBundle({
      observations: FIXTURE_OBS, includeSpuh: false, granularity: 'total',
      excludedNames: EMPTY, active: true,
    }))
    await waitFor(() => expect(result.current).not.toBeNull())
    await waitFor(() => expect(workers.length).toBe(1))
    expect(workers[0].terminations).toBe(0)

    unmount()
    expect(workers[0].terminations).toBe(1)
  })
})

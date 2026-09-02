/// <reference types="node" />
// Guard for fix: observations-worker-hang.
//
// `parseOffThread` built its promise with a RESOLVE-ONLY executor: no reject, no
// timeout, no `messageerror`, no death detection. `onmessage` and `onerror` were the
// only two settle paths, so a worker that died without dispatching `error` — an OOM
// kill, a crash, a reply that fails structured clone — left the promise pending
// forever, left the dead worker un-terminated, and (because `loadEbirdObservations`
// memoizes that promise in `inflight`, whose `.finally` therefore never ran) left
// EVERY later caller for the rest of the session awaiting the same dead promise.
// All eight observations tabs showed a permanent spinner until the eBird file was
// re-saved or cleared.
//
// Four things are proved here, none of them by forcing a real OOM — the stand-in is
// a worker under the test's control that reproduces each way a worker can go quiet:
//
//   1. EVERY PATH SETTLES, AND THE WORKER IS ALWAYS TORN DOWN — silence, `error`,
//      `messageerror`, and a `postMessage` that throws on the way out.
//   2. THE BUDGET SCALES WITH THE FILE. A fixed timeout that fired on a healthy but
//      slow parse would be a worse bug than the hang; the wait a large export gets
//      is strictly longer than the wait a small one gets.
//   3. THE FAILURE PATH DOES NOT RE-PARSE ON THE MAIN THREAD. The old `onerror`
//      branch called `parseEbirdObservations(text)` synchronously — retrying the
//      allocation that had just failed, on the thread that paints.
//   4. A FAILED LOAD DOES NOT POISON THE SESSION. `inflight` is clear once it
//      settles, so the next caller re-reads and re-parses from scratch.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { ObservationEntry } from '../types'

const mocks = vi.hoisted(() => ({
  readFile: vi.fn(),
  mainThreadParses: { count: 0 },
}))

vi.mock('./storage', () => ({
  storage: { readFile: (name: string) => mocks.readFile(name) },
}))

// The real parser, wrapped in a counter. Counting is the whole point: a call to it
// from THIS module's failure path is the anti-pattern being fixed.
vi.mock('./parseEbirdObservations', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./parseEbirdObservations')>()
  return {
    ...actual,
    parseEbirdObservations: (text: string) => {
      mocks.mainThreadParses.count += 1
      return actual.parseEbirdObservations(text)
    },
  }
})

import { clearEbirdObservationsCache, loadEbirdObservations } from './observationsCache'

const CSV = 'Submission ID,Common Name,Scientific Name,Date\nS1,Sora,Porzana carolina,2024-04-09\n'

/** What a healthy worker posts back. Hand-built, so a reply never runs the parser. */
const REPLY: ObservationEntry[] = [{
  submissionId: 'S1', commonName: 'Sora', scientificName: 'Porzana carolina',
  date: '2024-04-09', location: '', locationId: '', latitude: null, longitude: null,
  county: null, count: null, breedingCode: null, speciesComments: '', catalogIds: [],
}]

// The budget in observationsCache.ts: 30 s floor + 4 ms per 1,000 characters.
const budgetFor = (chars: number) => 30_000 + chars * 0.004

type Behavior = 'reply' | 'silent' | 'error' | 'messageerror' | 'post-throws' | 'late-reply'

let behavior: Behavior = 'reply'

class FakeWorker {
  static made: FakeWorker[] = []
  onmessage: ((e: MessageEvent<ObservationEntry[]>) => void) | null = null
  onerror: ((e: unknown) => void) | null = null
  onmessageerror: ((e: unknown) => void) | null = null
  terminations = 0
  posted: string[] = []

  constructor() { FakeWorker.made.push(this) }

  postMessage(text: string): void {
    this.posted.push(text)
    if (behavior === 'post-throws') throw new Error('DataCloneError')
    if (behavior === 'silent' || behavior === 'late-reply') return
    // Reply on a microtask, the way a real worker replies on a later task: never
    // synchronously inside postMessage, so the handlers are already attached.
    void Promise.resolve().then(() => {
      if (behavior === 'reply') this.onmessage?.({ data: REPLY } as MessageEvent<ObservationEntry[]>)
      // Plain event stand-ins: the tests run under the node environment, and the
      // module only ever asks THAT the handler fired, never what it carried.
      else if (behavior === 'error') this.onerror?.({ type: 'error' })
      else if (behavior === 'messageerror') this.onmessageerror?.({ type: 'messageerror' })
    })
  }

  terminate(): void { this.terminations += 1 }
}

const only = () => {
  expect(FakeWorker.made).toHaveLength(1)
  return FakeWorker.made[0]
}

beforeEach(() => {
  clearEbirdObservationsCache()
  mocks.readFile.mockReset()
  mocks.readFile.mockResolvedValue(CSV)
  mocks.mainThreadParses.count = 0
  FakeWorker.made = []
  behavior = 'reply'
  vi.useFakeTimers()
  ;(globalThis as { Worker?: unknown }).Worker = FakeWorker
})

afterEach(() => {
  vi.useRealTimers()
  delete (globalThis as { Worker?: unknown }).Worker
})

describe('the parse settles on every path, and the worker is always torn down', () => {
  it('a worker that dies silently settles at the budget instead of hanging forever', async () => {
    behavior = 'silent'
    let done = false
    const load = loadEbirdObservations().then(v => { done = true; return v })

    // Well past anything a reply would take, and still nothing — this is exactly
    // the state the bug left the app in permanently.
    await vi.advanceTimersByTimeAsync(5_000)
    expect(done).toBe(false)
    expect(only().terminations).toBe(0)

    await vi.advanceTimersByTimeAsync(budgetFor(CSV.length))
    expect(done).toBe(true)
    expect(await load).toBeNull()
    expect(only().terminations).toBe(1)
    expect(mocks.mainThreadParses.count).toBe(0)
  })

  it('an onerror worker settles WITHOUT re-parsing the same text on the main thread', async () => {
    behavior = 'error'
    const loaded = await loadEbirdObservations()

    expect(loaded).toBeNull()
    expect(only().terminations).toBe(1)
    // The anti-pattern being fixed: resolve(parseEbirdObservations(text)) here
    // retried the allocation that had just failed, synchronously, on the UI thread.
    expect(mocks.mainThreadParses.count).toBe(0)
  })

  it('a reply that cannot be structured-cloned back (messageerror) settles', async () => {
    behavior = 'messageerror'
    expect(await loadEbirdObservations()).toBeNull()
    expect(only().terminations).toBe(1)
    expect(mocks.mainThreadParses.count).toBe(0)
  })

  it('a postMessage that throws on the way out settles, and does not leak the worker', async () => {
    behavior = 'post-throws'
    expect(await loadEbirdObservations()).toBeNull()
    expect(only().terminations).toBe(1)
    expect(mocks.mainThreadParses.count).toBe(0)
    // No timer is left armed behind it — a leaked watchdog would fire minutes later.
    expect(vi.getTimerCount()).toBe(0)
  })

  it('a healthy reply resolves through the worker, terminates it, and parses nothing here', async () => {
    const loaded = await loadEbirdObservations()

    expect(loaded).not.toBeNull()
    expect(loaded!.observations).toEqual(REPLY)
    expect(loaded!.headerLine).toBe('Submission ID,Common Name,Scientific Name,Date')
    expect(only().terminations).toBe(1)
    expect(only().posted).toEqual([CSV])
    expect(mocks.mainThreadParses.count).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('an event arriving after the watchdog cannot re-settle or terminate twice', async () => {
    behavior = 'late-reply'
    const load = loadEbirdObservations()
    await vi.advanceTimersByTimeAsync(budgetFor(CSV.length))
    expect(await load).toBeNull()

    const worker = only()
    expect(worker.terminations).toBe(1)
    // A real worker's handlers are detached at settle; firing them is a no-op.
    expect(worker.onmessage).toBeNull()
    expect(worker.onerror).toBeNull()
    expect(worker.onmessageerror).toBeNull()
    expect(worker.terminations).toBe(1)
  })
})

describe('the budget scales with the file, so a slow-but-healthy parse is not cut off', () => {
  it('a large export is still waited on well past the point a small one would time out', async () => {
    const big = 'Submission ID,Common Name,Scientific Name,Date\n' + 'S1,Sora,Porzana carolina,2024-04-09\n'.repeat(200_000)
    expect(big.length).toBeGreaterThan(5_000_000)
    mocks.readFile.mockResolvedValue(big)

    behavior = 'silent'
    let done = false
    const load = loadEbirdObservations().then(v => { done = true; return v })

    // The whole budget a demo-sized export would have received, elapsed — and this
    // parse is still allowed to run, because the budget is a function of the input.
    await vi.advanceTimersByTimeAsync(budgetFor(CSV.length) + 1)
    expect(done).toBe(false)
    expect(budgetFor(big.length)).toBeGreaterThan(budgetFor(CSV.length))

    await vi.advanceTimersByTimeAsync(budgetFor(big.length))
    expect(done).toBe(true)
    expect(await load).toBeNull()
  })
})

describe('a failed load does not poison the session', () => {
  it('clears inflight, so the next caller re-reads and re-parses instead of re-joining it', async () => {
    behavior = 'silent'
    const first = loadEbirdObservations()
    await vi.advanceTimersByTimeAsync(budgetFor(CSV.length))
    expect(await first).toBeNull()
    expect(mocks.readFile).toHaveBeenCalledTimes(1)

    // This is the line the bug made impossible: a later mount gets its own attempt.
    behavior = 'reply'
    const second = await loadEbirdObservations()

    expect(second).not.toBeNull()
    expect(second!.observations).toEqual(REPLY)
    expect(mocks.readFile).toHaveBeenCalledTimes(2)
    expect(FakeWorker.made).toHaveLength(2)
    expect(FakeWorker.made[1].terminations).toBe(1)
  })

  it('does not cache the failure: a third caller after a success gets the cached parse', async () => {
    behavior = 'error'
    expect(await loadEbirdObservations()).toBeNull()

    behavior = 'reply'
    const a = await loadEbirdObservations()
    const b = await loadEbirdObservations()

    expect(a).not.toBeNull()
    expect(b).toBe(a)
    expect(mocks.readFile).toHaveBeenCalledTimes(2)   // failure, then the one success
  })
})

describe('where Workers do not exist, the parse still happens — exactly once', () => {
  it('falls back to this thread when Worker is unavailable', async () => {
    delete (globalThis as { Worker?: unknown }).Worker

    const loaded = await loadEbirdObservations()

    expect(loaded).not.toBeNull()
    expect(loaded!.observations).toHaveLength(1)
    expect(loaded!.observations[0].commonName).toBe('Sora')
    // ONE parse: the only one on that path, not a retry of a failed one.
    expect(mocks.mainThreadParses.count).toBe(1)
    expect(FakeWorker.made).toHaveLength(0)
  })

  it('reports an unparseable file as a falsy load rather than throwing', async () => {
    delete (globalThis as { Worker?: unknown }).Worker
    mocks.readFile.mockResolvedValue('not,an,ebird,export\n1,2,3,4\n')

    // A throw here would land in each tab's outer catch, which maps to
    // setup-required — "upload a backup" while a backup is loaded.
    await expect(loadEbirdObservations()).resolves.toBeNull()
  })
})

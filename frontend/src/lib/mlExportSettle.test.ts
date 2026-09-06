/// <reference types="node" />
// Guard for improve: ml-export-hardening.
//
// `parseMLExport` ran on the thread that paints, at both of its call sites. Moving
// it off is only safe with the v1.0.14 settle contract attached, because the promise
// it produces is memoized: `loadMLExport` parks it in `inflight`, so a worker that
// dies without dispatching `error` would leave every ML-backed tab awaiting the same
// dead promise for the rest of the session, and `.finally` would never run to clear
// it. A memoized promise inherits its producer's worst settle path.
//
// Six claims:
//
//   1. EVERY PATH SETTLES, AND THE WORKER IS ALWAYS TORN DOWN — a reply, silence,
//      `error`, `messageerror`, and a `postMessage` that throws on the way out.
//   2. AN INVALID EXPORT IS A REPLY, NOT A DEATH. `parseMLExport` throws on a file
//      that is not an ML export, and an uncaught throw in a worker arrives as the
//      same `error` event a dead worker sends. The worker catches it and answers
//      `{ ok: false }`, so the two stay distinguishable on the wire — and the
//      off-thread twin rejects with the SAME `INVALID_ML_EXPORT` message the
//      synchronous parser throws, which is what lets a call site convert by moving
//      one expression inside the `try` it already had.
//   3. THE BUDGET WAS RE-MEASURED, NOT INHERITED. `parseMLExport` still builds the
//      whole cell grid and is measurably slower than the streaming eBird parser the
//      4 s/MB constant was measured against. The distinguishing assertion is that a
//      silent worker is STILL waiting when the eBird budget for the same input has
//      elapsed, and settles at the ML one.
//   4. THE FAILURE PATH DOES NOT RE-PARSE ON THE MAIN THREAD — that would re-run
//      the allocation that had just failed, on the thread that paints.
//   5. `loadMLExport` STILL RESOLVES null AND STRUCTURALLY CANNOT REJECT (v1.0.15).
//      Its consumers all branch on falsy; a throw would land in each tab's outer
//      catch, which maps to setup-required, over an export that is plainly stored.
//   6. A FAILED LOAD DOES NOT POISON THE SESSION: `inflight` clears, nothing is
//      cached, and the next caller gets its own attempt.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { MLExportResult } from './parseMLExport'
import type { MLParseReply } from './parseMLExportOffThread'

const mocks = vi.hoisted(() => ({
  readFile: vi.fn(),
  mainThreadParses: { count: 0 },
}))

vi.mock('./storage', () => ({
  storage: { readFile: (name: string) => mocks.readFile(name) },
}))

// The real parser, wrapped in a counter. Counting is the whole point: a call to it
// from the failure path is the anti-pattern the settle contract exists to prevent.
vi.mock('./parseMLExport', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./parseMLExport')>()
  return {
    ...actual,
    parseMLExport: (text: string) => {
      mocks.mainThreadParses.count += 1
      return actual.parseMLExport(text)
    },
  }
})

import { parseMLExportOffThread } from './parseMLExportOffThread'
import { clearMLExportCache, loadMLExport } from './mlExportCache'

const ML_CSV = 'Catalog Number,Common Name,Scientific Name,Format\n1,American Robin,Turdus migratorius,Photo\n'

/** What a healthy worker posts back. Hand-built, so a reply never runs the parser. */
const RESULT: MLExportResult = {
  entries: [{ commonName: 'American Robin', scientificName: 'Turdus migratorius', taxonomicOrder: Infinity, catalogIds: ['1'] }],
  mediaMap: { 1: 'Photo' },
  rows: [],
}
const REPLY: MLParseReply = { ok: true, result: RESULT }

// The budget in parseMLExportOffThread.ts: 30 s floor + 6 ms per 1,000 characters.
const mlBudgetFor = (chars: number) => 30_000 + chars * 0.006
// Its eBird twin's, for the distinguishing assertion in claim 3.
const ebirdBudgetFor = (chars: number) => 30_000 + chars * 0.004

type Behavior = 'reply' | 'invalid' | 'silent' | 'error' | 'messageerror' | 'post-throws' | 'late-reply' | 'junk-reply'

let behavior: Behavior = 'reply'

class FakeWorker {
  static made: FakeWorker[] = []
  onmessage: ((e: MessageEvent<MLParseReply>) => void) | null = null
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
      if (behavior === 'reply') this.onmessage?.({ data: REPLY } as MessageEvent<MLParseReply>)
      else if (behavior === 'invalid') this.onmessage?.({ data: { ok: false } } as MessageEvent<MLParseReply>)
      else if (behavior === 'junk-reply') this.onmessage?.({ data: undefined as unknown as MLParseReply } as MessageEvent<MLParseReply>)
      // Plain event stand-ins: these tests run under the node environment, and the
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
  clearMLExportCache()
  mocks.readFile.mockReset()
  mocks.readFile.mockResolvedValue(ML_CSV)
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

describe('parseMLExportOffThread settles on every path, and the worker is always torn down', () => {
  it('a worker that dies silently settles at the budget instead of hanging forever', async () => {
    behavior = 'silent'
    let done = false
    const parse = parseMLExportOffThread(ML_CSV).then(
      v => { done = true; return v },
      e => { done = true; throw e },
    )
    parse.catch(() => {})

    await vi.advanceTimersByTimeAsync(5_000)
    expect(done).toBe(false)
    expect(only().terminations).toBe(0)

    await vi.advanceTimersByTimeAsync(mlBudgetFor(ML_CSV.length))
    expect(done).toBe(true)
    await expect(parse).rejects.toThrow('ML_PARSE_TIMEOUT')
    expect(only().terminations).toBe(1)
    expect(mocks.mainThreadParses.count).toBe(0)
  })

  it('an onerror worker settles WITHOUT re-parsing the same text on the main thread', async () => {
    behavior = 'error'
    await expect(parseMLExportOffThread(ML_CSV)).rejects.toThrow('ML_PARSE_WORKER_ERROR')
    expect(only().terminations).toBe(1)
    expect(mocks.mainThreadParses.count).toBe(0)
  })

  it('a reply that cannot be structured-cloned back (messageerror) settles', async () => {
    behavior = 'messageerror'
    await expect(parseMLExportOffThread(ML_CSV)).rejects.toThrow('ML_PARSE_REPLY_UNREADABLE')
    expect(only().terminations).toBe(1)
    expect(mocks.mainThreadParses.count).toBe(0)
  })

  it('a postMessage that throws on the way out settles, and does not leak the worker', async () => {
    behavior = 'post-throws'
    await expect(parseMLExportOffThread(ML_CSV)).rejects.toThrow('ML_PARSE_POST_FAILED')
    expect(only().terminations).toBe(1)
    expect(mocks.mainThreadParses.count).toBe(0)
    // No timer is left armed behind it — a leaked watchdog would fire minutes later.
    expect(vi.getTimerCount()).toBe(0)
  })

  it('a healthy reply resolves through the worker, terminates it, and parses nothing here', async () => {
    const result = await parseMLExportOffThread(ML_CSV)
    expect(result).toEqual(RESULT)
    expect(only().terminations).toBe(1)
    expect(only().posted).toEqual([ML_CSV])
    expect(mocks.mainThreadParses.count).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('an event arriving after the watchdog cannot re-settle or terminate twice', async () => {
    behavior = 'late-reply'
    const parse = parseMLExportOffThread(ML_CSV)
    parse.catch(() => {})
    await vi.advanceTimersByTimeAsync(mlBudgetFor(ML_CSV.length))
    await expect(parse).rejects.toThrow('ML_PARSE_TIMEOUT')

    const worker = only()
    expect(worker.terminations).toBe(1)
    // A real worker's handlers are detached at settle; firing them is a no-op.
    expect(worker.onmessage).toBeNull()
    expect(worker.onerror).toBeNull()
    expect(worker.onmessageerror).toBeNull()
    expect(worker.terminations).toBe(1)
  })
})

describe('an invalid export is a reply, not a death', () => {
  it('rejects with the SAME message the synchronous parser throws', async () => {
    behavior = 'invalid'
    await expect(parseMLExportOffThread('name,value\n1,2\n')).rejects.toThrow('INVALID_ML_EXPORT')
    expect(only().terminations).toBe(1)
    // Non-vacuity, and the claim that makes the conversion at each call site safe:
    // this really is what the synchronous parser says on the same input.
    const actual = await vi.importActual<typeof import('./parseMLExport')>('./parseMLExport')
    expect(() => actual.parseMLExport('name,value\n1,2\n')).toThrow('INVALID_ML_EXPORT')
  })

  it('a reply of an unexpected shape is an unusable file, not a resolved parse', async () => {
    behavior = 'junk-reply'
    await expect(parseMLExportOffThread(ML_CSV)).rejects.toThrow('INVALID_ML_EXPORT')
    expect(only().terminations).toBe(1)
  })
})

describe('the budget was re-measured against parseMLExport, not inherited', () => {
  it('a silent worker is still waiting when its eBird twin\'s budget has elapsed', async () => {
    // 5 MB, so the per-character term dominates the shared 30 s floor and the two
    // constants are far enough apart to tell one from the other.
    const big = 'Catalog Number,Common Name,Format\n' + '1,American Robin,Photo\n'.repeat(220_000)
    expect(big.length).toBeGreaterThan(5_000_000)

    behavior = 'silent'
    let done = false
    const parse = parseMLExportOffThread(big).then(() => { done = true }, () => { done = true })

    // The eBird constant (4 ms per 1,000 chars) would have fired by here. This one
    // has not, which is the whole point of re-measuring: a slower parser inheriting
    // a faster parser's allowance cuts off healthy work.
    await vi.advanceTimersByTimeAsync(ebirdBudgetFor(big.length) + 1)
    expect(done).toBe(false)
    expect(mlBudgetFor(big.length)).toBeGreaterThan(ebirdBudgetFor(big.length))

    await vi.advanceTimersByTimeAsync(mlBudgetFor(big.length))
    expect(done).toBe(true)
    await expect(parse).resolves.toBeUndefined()
  })

  it('scales with the file, so a slow-but-healthy parse is not cut off', async () => {
    const big = 'Catalog Number,Common Name,Format\n' + '1,American Robin,Photo\n'.repeat(220_000)
    mocks.readFile.mockResolvedValue(big)

    behavior = 'silent'
    let done = false
    const load = loadMLExport().then(v => { done = true; return v })

    // The whole budget a small export would have received, elapsed, and this parse
    // is still allowed to run: the budget is a function of the input.
    await vi.advanceTimersByTimeAsync(mlBudgetFor(ML_CSV.length) + 1)
    expect(done).toBe(false)

    await vi.advanceTimersByTimeAsync(mlBudgetFor(big.length))
    expect(done).toBe(true)
    expect(await load).toBeNull()
  })
})

describe('loadMLExport still resolves null and structurally cannot reject (v1.0.15)', () => {
  const FAILURES: { name: string; behavior: Behavior }[] = [
    { name: 'the worker dies silently', behavior: 'silent' },
    { name: 'the worker errors', behavior: 'error' },
    { name: 'the reply cannot be read back', behavior: 'messageerror' },
    { name: 'the request cannot be posted', behavior: 'post-throws' },
    { name: 'the stored file is not an ML export', behavior: 'invalid' },
  ]

  it.each(FAILURES.map(f => [f.name, f] as const))('resolves null when %s', async (_n, row) => {
    behavior = row.behavior
    const load = loadMLExport()
    if (row.behavior === 'silent') await vi.advanceTimersByTimeAsync(mlBudgetFor(ML_CSV.length))
    // `resolves` rather than a try/catch: a rejection here is the defect, because
    // every consumer branches on falsy and a throw reaches each tab's outer catch.
    await expect(load).resolves.toBeNull()
    expect(mocks.mainThreadParses.count).toBe(0)
  })

  it('the healthy row is real, so the null rows above are not vacuous', async () => {
    const loaded = await loadMLExport()
    expect(loaded).toEqual(RESULT)
    // ...and it is cached: a second caller gets the same object with no second read.
    expect(await loadMLExport()).toBe(loaded)
    expect(mocks.readFile).toHaveBeenCalledTimes(1)
  })
})

describe('a failed load does not poison the session', () => {
  it('clears inflight, so the next caller re-reads and re-parses instead of re-joining it', async () => {
    behavior = 'silent'
    const first = loadMLExport()
    await vi.advanceTimersByTimeAsync(mlBudgetFor(ML_CSV.length))
    expect(await first).toBeNull()
    expect(mocks.readFile).toHaveBeenCalledTimes(1)

    behavior = 'reply'
    const second = await loadMLExport()

    expect(second).toEqual(RESULT)
    expect(mocks.readFile).toHaveBeenCalledTimes(2)
    expect(FakeWorker.made).toHaveLength(2)
    expect(FakeWorker.made[1].terminations).toBe(1)
  })

  it('does not cache the failure: a caller after a success gets the cached parse', async () => {
    behavior = 'error'
    expect(await loadMLExport()).toBeNull()

    behavior = 'reply'
    const a = await loadMLExport()
    const b = await loadMLExport()

    expect(a).toEqual(RESULT)
    expect(b).toBe(a)
    expect(mocks.readFile).toHaveBeenCalledTimes(2)   // the failure, then the one success
  })

  it('concurrent first-callers share one attempt and all get null', async () => {
    behavior = 'error'
    const [a, b, c] = await Promise.all([loadMLExport(), loadMLExport(), loadMLExport()])
    expect([a, b, c]).toEqual([null, null, null])
    expect(mocks.readFile).toHaveBeenCalledTimes(1)
    expect(FakeWorker.made).toHaveLength(1)
  })
})

describe('where Workers do not exist, the parse still happens — exactly once', () => {
  beforeEach(() => { delete (globalThis as { Worker?: unknown }).Worker })

  it('falls back to this thread', async () => {
    const result = await parseMLExportOffThread(ML_CSV)
    expect(result.entries).toHaveLength(1)
    expect(result.entries[0].commonName).toBe('American Robin')
    // ONE parse: the only one on that path, not a retry of a failed one.
    expect(mocks.mainThreadParses.count).toBe(1)
    expect(FakeWorker.made).toHaveLength(0)
  })

  it('REJECTS rather than throwing synchronously when the file is not an export', async () => {
    // The contract is a promise. A caller that holds it before awaiting must not be
    // handed a throw instead, which is what `Promise.resolve(parseMLExport(text))`
    // would do — the parser throws before Promise.resolve is ever reached.
    let promise: Promise<unknown> | undefined
    expect(() => { promise = parseMLExportOffThread('name,value\n1,2\n') }).not.toThrow()
    await expect(promise).rejects.toThrow('INVALID_ML_EXPORT')
  })

  it('reports an unparseable file as a falsy load rather than throwing', async () => {
    mocks.readFile.mockResolvedValue('name,value\n1,2\n')
    await expect(loadMLExport()).resolves.toBeNull()
  })
})

/// <reference types="node" />
// Guard for improve: statistics-compute-off-thread.
//
// The v1.0.14 settle contract, THIRD instance — and the first one whose worker is
// not one-shot. `observationsCacheSettle.test.ts` proves the contract for a worker
// that is spawned, asked one question and terminated; this worker is handed the
// parsed export once and then answers a question per filter toggle for as long as
// the tab is open, which changes what has to be proved:
//
//   1. EVERY REQUEST SETTLES, on all five exits — a reply, `error`,
//      `messageerror`, a `postMessage` that throws on the way out, and silence
//      past the budget. A request that never settled would leave the tab on the
//      figures it was already showing, forever, with a worker holding a second
//      copy of the export behind it.
//   2. AND THE TAB STILL SHOWS CORRECT STATISTICS. This is the half that inverts
//      its precedent. A failed PARSE deliberately does not retry on the main
//      thread — that re-runs the multi-megabyte allocation that just failed, on
//      the thread that paints, and there is no other way to get the answer. A
//      failed COMPUTE has an honest fallback its precedent lacked: the input array
//      is already resident here, and running the chain on this thread is precisely
//      what 1.0.19 does on every render. So every failure below is asserted to
//      produce the SAME BUNDLE a healthy worker would have.
//   3. A HEALTHY REPLY DOES NOT TERMINATE THE WORKER, which is the whole design:
//      the observations are posted once and every later request is three small
//      values. The termination assertions are therefore two-sided — zero on the
//      happy path, exactly one on each fatal path — where the one-shot precedent
//      could assert one everywhere.
//   4. THE HELD COPY IS BOUNDED. An idle worker is torn down and the next request
//      respawns it and re-posts the export, so the ~19 MB second copy does not
//      outlive the user's interest in it.
//
// None of it is proved by forcing a real OOM; the stand-in is a worker under the
// test's control that reproduces each way a real one can go quiet.
//
// WHAT THIS FILE CATCHES, MEASURED. Every guard in `statsOffThread.ts` was deleted
// in turn and the suite re-run, against an unmutated baseline first so a harness
// that never ran the suite could not report everything as caught:
//
//   `if (!p) return`        RED - "a reply that ARRIVES after the watchdog gave up"
//                                 and "a DUPLICATE reply ... changes nothing either"
//   `if (!w) return`        RED - "an error arriving after the teardown cannot
//                                 terminate the worker twice"
//   `clearTimeout(watchdog)`RED - "a settled request leaves no watchdog armed"
//   `pending.delete(id)`    RED - the same test, and the idle-respawn test
//   `if (settled) return`   GREEN alone, RED paired with `pending.delete(id)`
//   `if (!settled)` (w'dog) GREEN alone, RED paired with `clearTimeout(watchdog)`
//
// The last two are stated rather than quietly left as coverage: each is one half of
// a redundant pair whose partner IS independently killed, so neither is reachable
// while the other stands. The reasoning is at the definition site, so a future
// reader deleting one as dead code meets the measurement instead of a green suite.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { ObservationEntry } from '../types'
import type { StatsBundle, StatsRequest } from './statsBundle'
import type { StatsWorkerMessage, StatsWorkerReply } from './statsOffThread'

const mocks = vi.hoisted(() => ({ mainThreadComputes: { count: 0 } }))

// The real chain, wrapped in a counter. Counting is the point on both sides: a
// call from the fallback is the behaviour under test, and a call that happens when
// the worker answered fine would mean the work is being done twice.
vi.mock('./statsBundle', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./statsBundle')>()
  return {
    ...actual,
    computeStatsBundle: (observations: readonly ObservationEntry[], request: StatsRequest) => {
      mocks.mainThreadComputes.count += 1
      return actual.computeStatsBundle(observations, request)
    },
  }
})

import { computeStatsWithFallback, createStatsSession, statsBudgetMs, STATS_WORKER_IDLE_MS } from './statsOffThread'
import { isStatsBundle } from './statsBundle'

/** The UNwrapped chain, for building the expected answer and for the fake worker's
 *  own reply — neither of which is a main-thread compute by the app. */
const real = await vi.importActual<typeof import('./statsBundle')>('./statsBundle')

function obs(submissionId: string, commonName: string, date: string): ObservationEntry {
  return {
    submissionId, commonName, scientificName: '', date,
    location: 'Loc', locationId: 'L1', latitude: 44.9, longitude: -93.2,
    county: 'Hennepin', stateProvince: 'US-MN', count: 2, breedingCode: null,
    speciesComments: '', catalogIds: [], time: '07:30 AM', duration: 45,
    distance: 1.2, area: null, protocol: 'Traveling', numObservers: 1,
    allObsReported: true, checklistComments: '',
  }
}

const OBSERVATIONS: ObservationEntry[] = [
  obs('S1', 'American Robin', '2024-04-09'),
  obs('S1', 'Mallard', '2024-04-09'),
  obs('S2', 'Sora', '2024-04-10'),
  obs('S2', 'gull sp.', '2024-04-10'),
  obs('S3', 'Snowy Owl', '2025-01-02'),
]

const REQUEST: StatsRequest = { includeSpuh: false, granularity: 'total', excludedNames: [] }
const OTHER_REQUEST: StatsRequest = { includeSpuh: true, granularity: 'yearly', excludedNames: [] }

/** What the tab must end up showing, whatever happened to the worker. */
const expectedFor = (request: StatsRequest): StatsBundle =>
  real.computeStatsBundle(OBSERVATIONS, request)

type Behavior =
  | 'reply'           // a healthy worker
  | 'silent'          // died with no event to settle on
  | 'error'           // dispatched `error`
  | 'messageerror'    // replied with something that will not clone back
  | 'post-throws'     // the request could not be cloned out
  | 'compute-failed'  // the chain threw INSIDE the worker: a reply, not a death
  | 'malformed'       // a reply this thread cannot attribute to a request
  | 'bundle-missing'  // `ok: true` and no bundle at all
  | 'bundle-partial'  // `ok: true` and a half-built bundle
  | 'bundle-wrong'    // `ok: true` and something that is not a bundle
  | 'late-reply'      // silent, then answers after the watchdog has given up

let behavior: Behavior = 'reply'

type Handlers = {
  onmessage: ((e: MessageEvent<StatsWorkerReply>) => void) | null
  onerror: ((e: unknown) => void) | null
  onmessageerror: ((e: unknown) => void) | null
}

class FakeWorker {
  static made: FakeWorker[] = []
  onmessage: ((e: MessageEvent<StatsWorkerReply>) => void) | null = null
  onerror: ((e: unknown) => void) | null = null
  onmessageerror: ((e: unknown) => void) | null = null
  terminations = 0
  posted: StatsWorkerMessage[] = []
  /** The worker's own held copy — the protocol under test, mirrored. */
  held: readonly ObservationEntry[] | null = null

  /**
   * THE HANDLERS AS THEY STOOD WHEN A MESSAGE WAS POSTED, and the reply that
   * message earned — the machinery that makes a LATE event a real event rather
   * than a described one.
   *
   * `'late-reply'` used to be byte-identical to `'silent'`: it never delivered
   * anything, so the test named for it could only assert that the handlers had
   * been nulled — the MECHANISM — and the idempotency guards underneath were
   * never reached by any test in the file. Delivering through the live property
   * would not fix that, because teardown sets it to null and the event would
   * vanish into the `?.`, which is the same non-event by a longer route.
   *
   * A captured reference is what a real late event has. A `message` event can be
   * dispatched into the task queue before `terminate()` runs; the dispatch
   * already holds the callback, and that callback does not become null because
   * the property did. So the reply arrives, the handler body runs, and the guards
   * inside it are the only thing standing between a settled request and a second
   * result.
   */
  captured: Handlers | null = null
  /** The reply this worker owes, so a late delivery sends the real answer. */
  owed: StatsWorkerReply | null = null
  /** Anything a late handler threw. A guard that is doing its job leaves this
   *  empty; a deleted one shows up here rather than as a silent no-op. */
  handlerErrors: unknown[] = []

  constructor() { FakeWorker.made.push(this) }

  private replyFor(message: StatsWorkerMessage): StatsWorkerReply {
    if (behavior === 'malformed') return { nonsense: true } as unknown as StatsWorkerReply
    if (behavior === 'compute-failed') return { id: message.id, ok: false }
    if (behavior === 'bundle-missing') return { id: message.id, ok: true } as StatsWorkerReply
    if (behavior === 'bundle-wrong') {
      return { id: message.id, ok: true, bundle: 'not a bundle' } as unknown as StatsWorkerReply
    }
    if (behavior === 'bundle-partial') {
      // Everything a plausible reply carries EXCEPT one section. This is the
      // shape a protocol drift produces, and the one a shallow truthiness check
      // would wave through.
      const full = real.computeStatsBundle(this.held ?? [], message.request)
      const rest: Record<string, unknown> = { ...full }
      delete rest.geo
      return { id: message.id, ok: true, bundle: rest as unknown as typeof full }
    }
    // exactly what statsWorker.ts does — compute over the HELD copy
    return { id: message.id, ok: true, bundle: real.computeStatsBundle(this.held ?? [], message.request) }
  }

  postMessage(message: StatsWorkerMessage): void {
    this.posted.push(message)
    if (behavior === 'post-throws') throw new Error('DataCloneError')
    if (message.observations) this.held = message.observations
    this.captured = { onmessage: this.onmessage, onerror: this.onerror, onmessageerror: this.onmessageerror }
    // Per MESSAGE, captured in the closure -- never read back off the instance.
    // With two requests in flight the field holds the SECOND reply by the time
    // the first one's microtask runs, which would answer request 1 with request
    // 2's id and hang it. The field exists only as `deliverLate`'s default.
    const owed = this.replyFor(message)
    this.owed = owed
    if (behavior === 'silent' || behavior === 'late-reply') return
    // Reply on a microtask, the way a real worker replies on a later task: never
    // synchronously inside postMessage, so the handlers are already attached.
    void Promise.resolve().then(() => {
      if (behavior === 'error') { this.onerror?.({ type: 'error' }); return }
      if (behavior === 'messageerror') { this.onmessageerror?.({ type: 'messageerror' }); return }
      this.onmessage?.({ data: owed } as MessageEvent<StatsWorkerReply>)
    })
  }

  /**
   * Deliver an event through the handlers captured at post time — i.e. one that
   * was already on its way when the worker was torn down. Anything the handler
   * throws is recorded rather than escaping, because a throw is exactly what a
   * missing guard produces and a test needs to see it rather than have it become
   * an unhandled rejection attributed to some other file.
   */
  deliverLate(kind: 'message' | 'error' | 'messageerror', data?: StatsWorkerReply): void {
    const c = this.captured
    if (!c) throw new Error('nothing was ever posted, so nothing can arrive late')
    try {
      if (kind === 'error') c.onerror?.({ type: 'error' })
      else if (kind === 'messageerror') c.onmessageerror?.({ type: 'messageerror' })
      else c.onmessage?.({ data: data ?? this.owed! } as MessageEvent<StatsWorkerReply>)
    } catch (err) {
      this.handlerErrors.push(err)
    }
  }

  terminate(): void { this.terminations += 1 }
}

const only = () => {
  expect(FakeWorker.made).toHaveLength(1)
  return FakeWorker.made[0]
}

const budget = () => statsBudgetMs(OBSERVATIONS.length)

beforeEach(() => {
  mocks.mainThreadComputes.count = 0
  FakeWorker.made = []
  behavior = 'reply'
  vi.useFakeTimers()
  ;(globalThis as { Worker?: unknown }).Worker = FakeWorker
})

afterEach(() => {
  vi.useRealTimers()
  delete (globalThis as { Worker?: unknown }).Worker
})

describe('every request settles, and the tab still shows correct statistics', () => {
  it('a worker that dies silently settles at the budget instead of hanging forever', async () => {
    behavior = 'silent'
    const session = createStatsSession(OBSERVATIONS)
    let done = false
    const run = computeStatsWithFallback(session, OBSERVATIONS, REQUEST).then(b => { done = true; return b })

    // Well past anything a healthy compute would take, and still nothing. This is
    // the state an unbounded promise would leave the tab in permanently.
    await vi.advanceTimersByTimeAsync(5_000)
    expect(done).toBe(false)
    expect(only().terminations).toBe(0)
    expect(mocks.mainThreadComputes.count).toBe(0)

    await vi.advanceTimersByTimeAsync(budget())
    expect(done).toBe(true)
    expect(await run).toEqual(expectedFor(REQUEST))
    // The silent worker is torn down, not left holding a copy of the export.
    expect(only().terminations).toBe(1)
    expect(session!.hasWorker()).toBe(false)
    expect(mocks.mainThreadComputes.count).toBe(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('a worker error settles, tears the worker down, and the figures are right', async () => {
    behavior = 'error'
    const session = createStatsSession(OBSERVATIONS)
    expect(await computeStatsWithFallback(session, OBSERVATIONS, REQUEST)).toEqual(expectedFor(REQUEST))
    expect(only().terminations).toBe(1)
    expect(mocks.mainThreadComputes.count).toBe(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('a reply that cannot be structured-cloned back (messageerror) settles', async () => {
    behavior = 'messageerror'
    const session = createStatsSession(OBSERVATIONS)
    expect(await computeStatsWithFallback(session, OBSERVATIONS, REQUEST)).toEqual(expectedFor(REQUEST))
    expect(only().terminations).toBe(1)
    expect(mocks.mainThreadComputes.count).toBe(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('a postMessage that throws on the way out settles, and leaks neither worker nor timer', async () => {
    behavior = 'post-throws'
    const session = createStatsSession(OBSERVATIONS)
    expect(await computeStatsWithFallback(session, OBSERVATIONS, REQUEST)).toEqual(expectedFor(REQUEST))
    expect(only().terminations).toBe(1)
    expect(mocks.mainThreadComputes.count).toBe(1)
    // A leaked watchdog would fire a minute later, on a worker already gone.
    expect(vi.getTimerCount()).toBe(0)
  })

  it('a reply this thread cannot attribute to a request is fatal rather than ignored', async () => {
    // There is no honest way to settle ONE request from a reply with no id, and
    // silently dropping it is the shape that hangs.
    behavior = 'malformed'
    const session = createStatsSession(OBSERVATIONS)
    expect(await computeStatsWithFallback(session, OBSERVATIONS, REQUEST)).toEqual(expectedFor(REQUEST))
    expect(only().terminations).toBe(1)
    expect(mocks.mainThreadComputes.count).toBe(1)
  })

  it('a reply that ARRIVES after the watchdog gave up changes nothing', async () => {
    // The sequence, in full: the worker goes quiet, the watchdog fails the
    // request and tears the worker down, the caller is answered from this thread
    // -- and only THEN does the worker's reply land, through a handler reference
    // the dispatch already held. Everything from that point on is what the
    // idempotency guards are for, so the assertions are about the OUTCOME (no
    // second answer, no second teardown, no resurrected worker, no re-armed
    // timer) rather than about the nulled properties, which are merely the first
    // of two lines of defence and were the whole of what this test used to say.
    behavior = 'late-reply'
    const session = createStatsSession(OBSERVATIONS)
    const run = computeStatsWithFallback(session, OBSERVATIONS, REQUEST)
    await vi.advanceTimersByTimeAsync(budget())

    const answered = await run
    expect(answered).toEqual(expectedFor(REQUEST))
    const worker = only()
    expect(worker.terminations).toBe(1)
    expect(mocks.mainThreadComputes.count).toBe(1)

    worker.deliverLate('message')
    await vi.advanceTimersByTimeAsync(0)

    // The handler ran and did nothing. A guard that had been removed shows up
    // here as a throw rather than as a silent no-op.
    expect(worker.handlerErrors).toEqual([])
    expect(worker.terminations).toBe(1)
    expect(session!.hasWorker()).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
    // The caller's answer is the one it already had, and no second compute of any
    // kind happened on either thread.
    expect(await run).toBe(answered)
    expect(mocks.mainThreadComputes.count).toBe(1)
    // The outer line of defence, still asserted -- just no longer the whole test.
    expect(worker.onmessage).toBeNull()
    expect(worker.onerror).toBeNull()
    expect(worker.onmessageerror).toBeNull()
  })

  it('a DUPLICATE reply for a request that already settled changes nothing either', async () => {
    // The same hazard on a healthy worker, which is the likelier way to meet it:
    // this worker is long-lived, so a second reply for an id that has already
    // been answered arrives at a LIVE handler with nothing detached in front of
    // it. Only the guard inside the handler stands between that and a second
    // result.
    const session = createStatsSession(OBSERVATIONS)
    const first = await computeStatsWithFallback(session, OBSERVATIONS, REQUEST)
    const worker = only()
    expect(worker.terminations).toBe(0)

    worker.deliverLate('message')            // the same reply, the same id, again
    await vi.advanceTimersByTimeAsync(0)

    expect(worker.handlerErrors).toEqual([])
    expect(worker.terminations).toBe(0)
    expect(session!.hasWorker()).toBe(true)
    expect(first).toEqual(expectedFor(REQUEST))
    // And the session is undamaged: the next request is answered by the same
    // worker, off-thread, exactly as before.
    expect(await computeStatsWithFallback(session, OBSERVATIONS, OTHER_REQUEST))
      .toEqual(expectedFor(OTHER_REQUEST))
    expect(FakeWorker.made).toHaveLength(1)
    expect(mocks.mainThreadComputes.count).toBe(0)
    session!.dispose()
  })

  it('an error arriving after the teardown cannot terminate the worker twice', async () => {
    behavior = 'silent'
    const session = createStatsSession(OBSERVATIONS)
    const run = computeStatsWithFallback(session, OBSERVATIONS, REQUEST)
    await vi.advanceTimersByTimeAsync(budget())
    expect(await run).toEqual(expectedFor(REQUEST))
    const worker = only()
    expect(worker.terminations).toBe(1)

    // The dying worker's own `error`, dispatched before it was torn down and
    // delivered after. Tearing down a worker that is already gone would reach for
    // handlers on a null reference.
    worker.deliverLate('error')
    await vi.advanceTimersByTimeAsync(0)
    expect(worker.handlerErrors).toEqual([])
    expect(worker.terminations).toBe(1)
    expect(vi.getTimerCount()).toBe(0)

    // A `messageerror` behind it fares no better.
    worker.deliverLate('messageerror')
    await vi.advanceTimersByTimeAsync(0)
    expect(worker.handlerErrors).toEqual([])
    expect(worker.terminations).toBe(1)
  })

  it('a settled request leaves no watchdog armed behind it', async () => {
    // The disarm, asserted as a count rather than inferred. A watchdog left
    // running past its own request is not inert: it would reach `die` on a
    // session that is working perfectly and drop the tab onto the synchronous
    // path for the rest of the export's life.
    //
    // NOTE FOR ANYONE MUTATING THIS FILE. `clearTimeout(watchdog)` in `settle`
    // and the watchdog callback's own `if (!settled)` are two guards over ONE
    // hazard, so deleting either ALONE leaves this green and only the pair is
    // killable. The timer count below rejects the first; the wait after it
    // rejects the pair. Said out loud rather than papered over, per the repo's
    // rule about a guard whose discrimination has been measured to be absent.
    const session = createStatsSession(OBSERVATIONS)
    await computeStatsWithFallback(session, OBSERVATIONS, REQUEST)
    expect(vi.getTimerCount()).toBe(1)          // the idle timer, and nothing else

    // Wait out both the idle window and the watchdog budget. The worker is torn
    // down for being IDLE, which is not death, so the session must still answer
    // off-thread afterwards.
    await vi.advanceTimersByTimeAsync(STATS_WORKER_IDLE_MS + budget())
    expect(session!.hasWorker()).toBe(false)
    expect(await computeStatsWithFallback(session, OBSERVATIONS, OTHER_REQUEST))
      .toEqual(expectedFor(OTHER_REQUEST))
    expect(mocks.mainThreadComputes.count).toBe(0)
    session!.dispose()
  })

  it('a healthy reply resolves through the worker and computes NOTHING on this thread', async () => {
    const session = createStatsSession(OBSERVATIONS)
    const bundle = await computeStatsWithFallback(session, OBSERVATIONS, REQUEST)

    expect(bundle).toEqual(expectedFor(REQUEST))
    expect(mocks.mainThreadComputes.count).toBe(0)
    // AND THE WORKER IS STILL ALIVE. This is the line that separates this contract
    // from its two one-shot precedents: terminating here would throw away the held
    // copy and make the next toggle pay the hand-over again.
    expect(only().terminations).toBe(0)
    expect(session!.hasWorker()).toBe(true)
    session!.dispose()
  })
})

describe('a reply is not trusted just because its id matches', () => {
  // Correlation was reviewed and came out clean -- monotone ids, handlers detached
  // before terminate, a per-worker `onmessage` rather than a global listener -- so
  // a reply that reaches a pending request really is that request's answer. What
  // an id cannot vouch for is the PAYLOAD, and an unusable one is the settle
  // contract's own failure shape arriving one layer above it: the promise settles,
  // the tab takes the value, and `setBundle(undefined)` leaves it reading its
  // "Computing your statistics..." spinner for the rest of the session. Every
  // shape below must therefore be a FAILED reply, not a resolved one.
  const SHAPES: Array<[Behavior, string]> = [
    ['bundle-missing', 'no bundle at all'],
    ['bundle-partial', 'a bundle missing one section'],
    ['bundle-wrong', 'a bundle that is not an object'],
  ]

  for (const [shape, label] of SHAPES) {
    it(`falls back and shows correct statistics when a reply carries ${label}`, async () => {
      behavior = shape
      const session = createStatsSession(OBSERVATIONS)
      expect(await computeStatsWithFallback(session, OBSERVATIONS, REQUEST))
        .toEqual(expectedFor(REQUEST))
      expect(mocks.mainThreadComputes.count).toBe(1)
      // Treated as the worker REPORTING a failure, not as the worker dying: it
      // is still holding a valid 19 MB hand-over, and one bad payload says
      // nothing about whether the next one will be bad too.
      expect(only().terminations).toBe(0)
      expect(session!.hasWorker()).toBe(true)
      expect(vi.getTimerCount()).toBe(1)          // the idle timer, nothing leaked

      behavior = 'reply'
      expect(await computeStatsWithFallback(session, OBSERVATIONS, OTHER_REQUEST))
        .toEqual(expectedFor(OTHER_REQUEST))
      expect(mocks.mainThreadComputes.count).toBe(1)
      session!.dispose()
    })
  }

  it('a well-formed bundle is still accepted, so the check is not simply refusing', () => {
    // Non-vacuity for the predicate: a real bundle passes, and the two fields the
    // shallow half of the check reads are the ones a truthiness test would miss.
    const good = real.computeStatsBundle(OBSERVATIONS, REQUEST)
    expect(isStatsBundle(good)).toBe(true)
    expect(isStatsBundle({ ...good, filteredCount: undefined })).toBe(false)
    expect(isStatsBundle({ ...good, checklists: 'lots' })).toBe(false)
    expect(isStatsBundle({ ...good, includeSpuh: 'yes' })).toBe(false)
    expect(isStatsBundle(null)).toBe(false)
    expect(isStatsBundle([])).toBe(false)
  })
})

describe('a compute that threw inside the worker is a reply, not a death', () => {
  it('answers from this thread but keeps the worker, which answers the next request', async () => {
    behavior = 'compute-failed'
    const session = createStatsSession(OBSERVATIONS)
    expect(await computeStatsWithFallback(session, OBSERVATIONS, REQUEST)).toEqual(expectedFor(REQUEST))
    expect(mocks.mainThreadComputes.count).toBe(1)
    // Not terminated: a chain that threw says nothing about the worker's health,
    // and the alternative is throwing away a 19 MB hand-over on one bad answer.
    expect(only().terminations).toBe(0)
    expect(session!.hasWorker()).toBe(true)

    behavior = 'reply'
    expect(await computeStatsWithFallback(session, OBSERVATIONS, OTHER_REQUEST))
      .toEqual(expectedFor(OTHER_REQUEST))
    expect(mocks.mainThreadComputes.count).toBe(1)   // still just the one
    expect(FakeWorker.made).toHaveLength(1)          // the same worker
    session!.dispose()
  })
})

describe('the export is handed over once, and every later request is small', () => {
  it('posts the observations on the first message only', async () => {
    const session = createStatsSession(OBSERVATIONS)
    await computeStatsWithFallback(session, OBSERVATIONS, REQUEST)
    await computeStatsWithFallback(session, OBSERVATIONS, OTHER_REQUEST)
    await computeStatsWithFallback(session, OBSERVATIONS, REQUEST)

    const posted = only().posted
    expect(posted).toHaveLength(3)
    expect(posted[0].observations).toBe(OBSERVATIONS)
    // The whole reason this session holds a worker: a toggle costs three values,
    // not a clone of the export.
    expect(posted[1].observations).toBeUndefined()
    expect(posted[2].observations).toBeUndefined()
    expect(posted.map(m => m.id)).toEqual([1, 2, 3])
    session!.dispose()
  })

  it('every request gets its own answer, including two in flight at once', async () => {
    const session = createStatsSession(OBSERVATIONS)
    const [a, bResult] = await Promise.all([
      computeStatsWithFallback(session, OBSERVATIONS, REQUEST),
      computeStatsWithFallback(session, OBSERVATIONS, OTHER_REQUEST),
    ])
    expect(a).toEqual(expectedFor(REQUEST))
    expect(bResult).toEqual(expectedFor(OTHER_REQUEST))
    expect(mocks.mainThreadComputes.count).toBe(0)
    session!.dispose()
  })

  it('one worker error fails BOTH outstanding requests, and both fall back correctly', async () => {
    // A dead worker cannot answer either of them, and a request left waiting on a
    // terminated worker is the hang this contract exists to remove.
    const session = createStatsSession(OBSERVATIONS)
    behavior = 'error'
    const [a, bResult] = await Promise.all([
      computeStatsWithFallback(session, OBSERVATIONS, REQUEST),
      computeStatsWithFallback(session, OBSERVATIONS, OTHER_REQUEST),
    ])
    expect(a).toEqual(expectedFor(REQUEST))
    expect(bResult).toEqual(expectedFor(OTHER_REQUEST))
    expect(only().terminations).toBe(1)
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('the held copy of the export is bounded', () => {
  it('an idle worker is torn down, and the next request respawns and re-posts', async () => {
    const session = createStatsSession(OBSERVATIONS)
    await computeStatsWithFallback(session, OBSERVATIONS, REQUEST)
    expect(session!.hasWorker()).toBe(true)

    await vi.advanceTimersByTimeAsync(STATS_WORKER_IDLE_MS - 1)
    expect(session!.hasWorker()).toBe(true)          // still within the window
    await vi.advanceTimersByTimeAsync(2)
    expect(session!.hasWorker()).toBe(false)
    expect(FakeWorker.made[0].terminations).toBe(1)

    // Idle is not death: the next toggle gets a worker again, and it is handed the
    // export because this one has never seen it.
    const again = await computeStatsWithFallback(session, OBSERVATIONS, OTHER_REQUEST)
    expect(again).toEqual(expectedFor(OTHER_REQUEST))
    expect(FakeWorker.made).toHaveLength(2)
    expect(FakeWorker.made[1].posted[0].observations).toBe(OBSERVATIONS)
    expect(mocks.mainThreadComputes.count).toBe(0)
    session!.dispose()
  })

  it('the idle timer is re-armed by activity rather than left running from the first reply', async () => {
    const session = createStatsSession(OBSERVATIONS)
    await computeStatsWithFallback(session, OBSERVATIONS, REQUEST)
    await vi.advanceTimersByTimeAsync(STATS_WORKER_IDLE_MS - 1_000)
    await computeStatsWithFallback(session, OBSERVATIONS, OTHER_REQUEST)
    // The first request's window would have expired by now; the second's has not.
    await vi.advanceTimersByTimeAsync(2_000)
    expect(session!.hasWorker()).toBe(true)
    expect(FakeWorker.made).toHaveLength(1)
    session!.dispose()
  })

  it('dispose terminates the worker, fails what is outstanding, and still answers', async () => {
    behavior = 'silent'
    const session = createStatsSession(OBSERVATIONS)
    const run = computeStatsWithFallback(session, OBSERVATIONS, REQUEST)
    session!.dispose()

    expect(await run).toEqual(expectedFor(REQUEST))
    expect(only().terminations).toBe(1)
    expect(vi.getTimerCount()).toBe(0)               // the watchdog went with it

    // A disposed session never spawns again: the tab unmounted or the export was
    // replaced, and either way this session's held copy is finished with.
    behavior = 'reply'
    expect(await computeStatsWithFallback(session, OBSERVATIONS, OTHER_REQUEST))
      .toEqual(expectedFor(OTHER_REQUEST))
    expect(FakeWorker.made).toHaveLength(1)
    expect(mocks.mainThreadComputes.count).toBe(2)
  })

  it('dispose twice terminates once', async () => {
    const session = createStatsSession(OBSERVATIONS)
    await computeStatsWithFallback(session, OBSERVATIONS, REQUEST)
    session!.dispose()
    session!.dispose()
    expect(only().terminations).toBe(1)
  })
})

describe('the budget scales with the export, so a slow-but-healthy compute is not cut off', () => {
  it('a large export is still waited on well past the point a small one would time out', async () => {
    const big: ObservationEntry[] = []
    for (let i = 0; i < 50_000; i++) big.push(obs(`S${i % 4_000}`, 'American Robin', '2024-04-09'))
    expect(statsBudgetMs(big.length)).toBeGreaterThan(statsBudgetMs(OBSERVATIONS.length))

    behavior = 'silent'
    const session = createStatsSession(big)
    let done = false
    const run = computeStatsWithFallback(session, big, REQUEST).then(v => { done = true; return v })

    // The whole budget the five-row export would have received, elapsed — and this
    // compute is still allowed to run, because the budget is a function of its input.
    await vi.advanceTimersByTimeAsync(statsBudgetMs(OBSERVATIONS.length) + 1)
    expect(done).toBe(false)

    await vi.advanceTimersByTimeAsync(statsBudgetMs(big.length))
    expect(done).toBe(true)
    expect(await run).not.toBeNull()
    expect(only().terminations).toBe(1)
  })

  it('the budget has a floor, so a tiny export still clears worker spawn', () => {
    expect(statsBudgetMs(0)).toBeGreaterThanOrEqual(30_000)
  })

  it('and a CEILING, so an export of very short rows cannot buy hours', () => {
    // Rows are not bounded by the 50 MB upload cap the way characters are: at the
    // reference export's ~329 characters per row the cap is ~152,000 rows, but an
    // export of 60-character rows reaches the same 50 MB with several times as
    // many, and an uncapped formula hands out hours. Hours is not a bounded
    // failure.
    expect(statsBudgetMs(10_000_000)).toBe(240_000)
    expect(statsBudgetMs(1_000_000)).toBe(240_000)
    // It binds only past ~140,000 rows, so every realistic export is still on the
    // linear part and nothing healthy is cut short.
    expect(statsBudgetMs(139_000)).toBeLessThan(240_000)
    expect(statsBudgetMs(21_856)).toBeLessThan(240_000)
    // Monotone up to the ceiling, so a bigger export never gets a smaller budget.
    expect(statsBudgetMs(50_000)).toBeGreaterThan(statsBudgetMs(21_856))
  })
})

describe('where Workers do not exist, the chain still runs — exactly once', () => {
  it('there is no session at all, and the compute happens here', async () => {
    delete (globalThis as { Worker?: unknown }).Worker

    const session = createStatsSession(OBSERVATIONS)
    expect(session).toBeNull()

    const bundle = await computeStatsWithFallback(session, OBSERVATIONS, REQUEST)
    expect(bundle).toEqual(expectedFor(REQUEST))
    // ONE compute: the only one on that path, not a retry of a failed one.
    expect(mocks.mainThreadComputes.count).toBe(1)
    expect(FakeWorker.made).toHaveLength(0)
  })

  it('a Worker constructor that throws is treated the same way', async () => {
    ;(globalThis as { Worker?: unknown }).Worker = function ThrowingWorker() {
      throw new Error('module workers unavailable')
    }
    const session = createStatsSession(OBSERVATIONS)
    expect(session).not.toBeNull()
    expect(await computeStatsWithFallback(session, OBSERVATIONS, REQUEST)).toEqual(expectedFor(REQUEST))
    expect(mocks.mainThreadComputes.count).toBe(1)
    expect(vi.getTimerCount()).toBe(0)

    // And it does not try again on every toggle for the rest of the session.
    expect(await computeStatsWithFallback(session, OBSERVATIONS, OTHER_REQUEST))
      .toEqual(expectedFor(OTHER_REQUEST))
    expect(mocks.mainThreadComputes.count).toBe(2)
  })
})

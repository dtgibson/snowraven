import type { ObservationEntry } from '../types'
import { computeStatsBundle, isStatsBundle } from './statsBundle'
import type { StatsBundle, StatsRequest } from './statsBundle'

/**
 * The worker protocol.
 *
 * ONE MESSAGE KIND, not a `load` followed by `compute`s. The observations ride the
 * FIRST message of a worker's life and are then held in worker heap; every later
 * message on that worker carries only the request (three small values), which is
 * the whole point of the design — see the note on `createStatsSession`. Folding the
 * hand-over into a request rather than sending it as its own message is what keeps
 * "every message this session posts has exactly one reply" true: a bare `load` would
 * be a post with nothing to settle on, so a worker that died during it would be
 * invisible until the next request's watchdog.
 */
export interface StatsWorkerMessage {
  id: number
  /** Present only on the first message to a given worker (and again after a
   *  respawn). Absent means "use the observations you are already holding". */
  observations?: readonly ObservationEntry[]
  request: StatsRequest
}

/**
 * A compute that THREW inside the worker is a REPLY, not an error — the same
 * distinction `mlExportWorker.ts` draws, for the same reason. An uncaught throw
 * reaches this thread as the worker's `error` event, which the settle contract
 * below reads as the worker having died; and unlike the one-shot parse workers,
 * this worker is meant to answer again. "That one request failed" leaves a healthy
 * worker holding a 19 MB copy it can still use; "the worker is gone" must tear it
 * down. Collapsing them would either leak the worker or throw it away needlessly.
 */
export type StatsWorkerReply =
  | { id: number; ok: true; bundle: StatsBundle }
  | { id: number; ok: false }

// How long a healthy compute is allowed to take before the worker is presumed dead.
//
// A worker that dies without dispatching `error` — an OOM kill, a crash — gives the
// main thread NO event to settle on, so the only remaining evidence of death is
// silence, and silence has to be bounded by a clock. The bound scales with the
// input because the thing being waited on does.
//
// MEASURED FOR THIS WORK, NEVER INHERITED. Neither parse budget transfers: this
// worker does not parse anything, and its per-request cost is a different shape —
// a compute over an already-parsed array, plus (on the first request of a worker's
// life) the structured clone of that array, plus the clone of the reply. Keyed on
// ROWS rather than characters, because rows are what this worker is given; the
// characters are back on the parse seam, which this change does not touch.
//
// Measured on the reference export and fractions/multiples of it (Node 24.18 / V8,
// quiet machine, best of three after a warm-up), over a 15x range from 5,898 to
// 87,424 rows. Microseconds per row, and the three legs the budget must cover:
//
//     rows     compute   clone-in   reply-out   TOTAL
//    5,898       3.57       1.57        0.44     5.58
//   11,182       2.54       1.51        0.34     4.38
//   21,856       2.34       1.55        0.19     4.08
//   43,712       2.08       1.61        0.10     3.79
//   87,424       2.33       1.81        0.05     4.20
//
// Flat across the range, so the work is linear in the row count and the allowance
// can be too. The anchor is the SLOWEST reading, 5.58 us/row at the smallest input
// where the fixed overheads dominate; anchoring there errs toward a wider budget.
//
// The comparative measurement, taken in the SAME run on the same machine, is what
// makes the constant defensible rather than copied: `parseEbirdObservations` ran at
// 88-93 Mchar/s throughout, and at the reference export that is 77.4 ms of parse
// against 47.9 ms of compute — this chain is about 1.6x FASTER than the parse whose
// budget it sits beside. (observationsCache.ts records 57-75 Mchar/s for that same
// parser on a different machine; the RATIO is what transfers, not the rate.)
//
// The allowance below is 1.5 MILLISECONDS per row — about 269x the anchor, a hair
// wider than the ~250x both parse budgets carry, which is right because this budget
// also has to cover a clone leg they do not have. That clears the slowest device
// this app ships to (a Pi's browser, an older iPhone's WKWebView) by a wide margin
// even with the heap under GC pressure, and still turns an unbounded hang into a
// bounded failure: ~63 s for the reference export, against the eBird parse's ~59 s
// for the same file. The floor covers worker spawn, module evaluation and the
// request's structured clone on a busy device, none of which scale with the export.
//
// AND IT IS CAPPED, because rows are not bounded the way characters are. The two
// parse budgets scale on the size of the file they were handed, so the 50 MB
// upload cap (`MAX_UPLOAD_BYTES`, twinned with the backend's `MAX_BYTES`) bounds
// them arithmetically: the eBird parse cannot hand out more than 30 s + 50 MB x
// 4 s/MB, about 230 s. This budget scales on ROWS, and the byte cap bounds rows
// only through a rows-per-byte ratio nothing enforces. The reference export runs
// ~329 characters per row, which at the cap is ~152,000 rows and lands near the
// parse's own ceiling by coincidence rather than by construction; an export of
// short rows reaches the same 50 MB with several times as many, and an uncapped
// formula would hand out hours. A budget of hours is not a bounded failure, it
// is the hang with extra steps.
//
// The ceiling is 4 MINUTES, chosen as the analogue of the parse's ~230 s rather
// than as a new number: this budget covers a structured-clone leg the parse does
// not, so a little above it is right. It binds only past ~140,000 rows, where
// the measured compute-plus-clone cost is about 0.6 s, so the ceiling is still
// some 400x the measured work at the point it starts to apply. The stated cost:
// that margin narrows as the row count grows — at the ~833,000 rows a 50 MB
// export of 60-character rows would carry, the measured cost is ~3.5 s and the
// ceiling is ~69x it. Still a wide margin, and still a bounded failure, which is
// the property being bought.
const STATS_BUDGET_FLOOR_MS = 30_000
const STATS_BUDGET_MS_PER_ROW = 1.5
const STATS_BUDGET_CEILING_MS = 240_000

export function statsBudgetMs(rows: number): number {
  return Math.min(STATS_BUDGET_FLOOR_MS + rows * STATS_BUDGET_MS_PER_ROW, STATS_BUDGET_CEILING_MS)
}

/**
 * How long a worker with nothing to do keeps its copy of the observations.
 *
 * THE MEMORY BOUND, and the reason this session holds a worker at all is also the
 * reason it must let go of one. Handing the observations over once and sending only
 * `{ includeSpuh, granularity, excludedNames }` afterwards is what makes a filter
 * toggle cost 0.002 ms of main-thread clone instead of 17 ms — but it parks a
 * SECOND copy of the parsed export in worker heap, measured at 19.2 MB for the
 * reference export (2.7 MB per Mchar), against a main-thread copy of 19.3 MB. This
 * repo has already decided once that a retained copy of that order is not worth its
 * convenience: `observationsCache` used to hold the raw CSV (13.2 MB on the same
 * export) to answer a boolean, and that retention was removed.
 *
 * The Statistics tab is not unmounted when the user leaves it (tabs are hidden with
 * `display:none`), so without this the copy would be held for the rest of the
 * session after one visit. Instead the worker is torn down once it has been idle
 * this long and respawned by the next request, which costs the ~17 ms hand-over
 * again — still well inside the ~48 ms of compute it saves, so a toggle after a long
 * pause is a smaller win, never a loss. Thirty seconds comfortably covers a burst of
 * toggles while returning the memory promptly once the user has read their numbers.
 */
export const STATS_WORKER_IDLE_MS = 30_000

export interface StatsSession {
  /** The bundle for one request. Rejects — never hangs — on every failure path. */
  compute(request: StatsRequest): Promise<StatsBundle>
  /** Tear the worker down and reject anything outstanding. Idempotent. */
  dispose(): void
  /** Test seam: is a worker alive right now? (Idle teardown and death are both
   *  invisible from `compute` alone, and both are things a guard must be able to
   *  see.) */
  hasWorker(): boolean
}

/**
 * A stats worker that HOLDS the observations, for one loaded export.
 *
 * THE TRADE THIS SHAPE TAKES, stated because the alternative is the obvious one.
 * Re-posting the filtered observations with every request needs no held copy and no
 * idle timer, and costs a `structuredClone` of ~21k rows per toggle: measured at
 * 34 ms round trip, ~17 ms of it unbreakable main-thread serialization, against
 * ~48 ms of compute moved off. That hands back a third of the win, and it scales
 * with the device exactly as the compute does, so it is worth least on the phones
 * and the Pi this change exists for. Holding the copy makes every request after the
 * first cost 0.002 ms out and ~4 ms back. The price is the 19.2 MB above, bounded
 * by `STATS_WORKER_IDLE_MS`.
 *
 * SETTLE CONTRACT — every request settles, and the worker is always torn down.
 * This is the v1.0.14 contract, third instance, and the one structural difference
 * from its two one-shot precedents is that TEARDOWN AND SETTLE ARE NOT THE SAME
 * EVENT here: a worker outlives a request, so each request owns an idempotent
 * settle (clear its watchdog, drop it from `pending`, resolve or reject exactly
 * once) while the worker's teardown is separate and is triggered by the fatal
 * paths, by the idle timer, and by `dispose`. The five exits a request can take:
 *
 *   1. a reply for its id — resolve; or, for `{ ok: false }`, reject WITHOUT
 *      killing the worker, since a compute that threw says nothing about the
 *      worker's health;
 *   2. the worker's `error` event — the worker is gone, so this and every other
 *      outstanding request rejects and the session dies;
 *   3. `onmessageerror`, a reply that cannot be structured-cloned back to us — the
 *      event carries no usable id, so it cannot be attributed to one request and
 *      is treated as fatal for all of them;
 *   4. a `postMessage` that throws on the way out (cloning ~19 MB of observations
 *      into the worker can fail on a device under memory pressure) — fatal;
 *   5. silence past `statsBudgetMs` — fatal, and deliberately so: a worker that has
 *      gone quiet is both useless and holding a second copy of the export.
 *
 * Whichever fires first wins. A fatal path detaches the handlers and terminates the
 * worker before failing the waiting requests, so a late event afterwards can
 * neither re-settle a request nor terminate twice.
 *
 * A rejection does NOT hang the tab: the caller falls back to computing on this
 * thread. That is the OPPOSITE of the rule its two precedents state, and the
 * difference is real rather than a relaxation. A failed parse must not be retried
 * on the main thread because that re-runs the identical multi-megabyte allocation
 * that had just failed, on the thread that paints, and there is no other way to get
 * the answer. Here the input array is already resident on this thread — it is the
 * array we cloned FROM — so the fallback allocates nothing the worker allocated:
 * measured, the whole bundle retains 1.3 MB against the 19.3 MB of observations
 * already sitting in this heap. And the fallback is not a novel risk being taken,
 * it is the SHIPPED BEHAVIOUR: 1.0.19 runs this exact chain on this exact thread on
 * every render. Refusing it would replace a working tab with a blank one.
 *
 * Returns null where Workers do not exist at all (an older browser, jsdom under
 * vitest); the caller then computes here, which is that platform's only compute
 * and not a retry of a failed one.
 */
export function createStatsSession(observations: readonly ObservationEntry[]): StatsSession | null {
  if (typeof Worker === 'undefined') return null

  interface Pending {
    resolve: (b: StatsBundle) => void
    fail: (reason: string) => void
  }

  let worker: Worker | null = null
  /** Does the LIVE worker already hold `observations`? False after a respawn. */
  let loaded = false
  /**
   * A fatal failure or a dispose. No worker is ever spawned again.
   *
   * THE ASYMMETRY WITH THE IDLE TEARDOWN IS DELIBERATE, and it is the exception to
   * "a torn-down worker is respawned by the next request", so it is named here
   * rather than left for a reader to infer from two flags. An idle teardown says
   * nothing went wrong — the memory was simply not being used — so the next
   * request spawns again and re-pays the hand-over. A FATAL event is a verdict
   * about this device and this export, and every one of them is a verdict that
   * would repeat: a worker OOM-killed on a 19 MB hand-over is killed again by the
   * same hand-over; a `postMessage` that could not clone the export out cannot
   * clone it out a moment later; a constructor that refused is a platform saying
   * no; and silence past a budget of 30 s plus 1.5 ms per row means either the
   * worker is gone or the device took a thousand times the measured cost. Trying
   * again on each toggle would re-run the allocation that just killed a thread,
   * pay the spawn and the ~17 ms serialize for it, and then fall back anyway.
   *
   * The stated cost, which is bounded and is why this is the right side to err
   * on: one transient death that would not have recurred leaves the tab computing
   * on the main thread for the rest of the export's life — that is, behaving
   * exactly as 1.0.19 does. The worst case of being wrong here is the shipped
   * behaviour, not a broken tab. `dead` and "no worker" are therefore two flags
   * rather than one; collapsing them loses this distinction.
   */
  let dead = false
  let nextId = 1
  const pending = new Map<number, Pending>()
  let idleTimer: ReturnType<typeof setTimeout> | undefined

  const budget = statsBudgetMs(observations.length)

  /** Terminate the live worker, if any, and stop the idle timer. Never touches
   *  `pending` — the callers below decide what the outstanding requests deserve. */
  const teardown = (): void => {
    if (idleTimer !== undefined) { clearTimeout(idleTimer); idleTimer = undefined }
    const w = worker
    worker = null
    loaded = false
    if (!w) return
    w.onmessage = null
    w.onerror = null
    w.onmessageerror = null
    w.terminate()
  }

  /** A fatal path: the worker cannot answer. Tear it down FIRST, so a late event
   *  fires into detached handlers, then fail everything that was waiting. */
  const die = (reason: string): void => {
    dead = true
    const waiting = [...pending.values()]
    pending.clear()
    teardown()
    for (const p of waiting) p.fail(reason)
  }

  const armIdle = (): void => {
    if (idleTimer !== undefined) { clearTimeout(idleTimer); idleTimer = undefined }
    if (dead || !worker || pending.size > 0) return
    idleTimer = setTimeout(teardown, STATS_WORKER_IDLE_MS)
  }

  const attach = (w: Worker): void => {
    w.onmessage = (e: MessageEvent<StatsWorkerReply>) => {
      const reply = e.data
      // A reply with no usable id cannot be attributed to a request, so there is
      // no honest way to settle just one. Treat it as the worker having stopped
      // making sense — the same conclusion `messageerror` reaches.
      if (!reply || typeof reply.id !== 'number') { die('STATS_REPLY_MALFORMED'); return }
      const p = pending.get(reply.id)
      // A reply for a request that already settled (its watchdog fired, or the
      // session was disposed and respawned). Nothing to do; not an error.
      if (!p) return
      // A matching id is not a reason to trust the payload. `ok: true` with no
      // usable bundle would resolve the request and park the tab on its spinner
      // for the session — the settle contract's own failure shape, one layer up
      // — so an unusable bundle is a failed reply, handled exactly like the
      // worker reporting failure itself: this request falls back, the worker
      // lives on.
      if (reply.ok && isStatsBundle(reply.bundle)) p.resolve(reply.bundle)
      else p.fail('STATS_COMPUTE_FAILED')
    }
    w.onerror = () => die('STATS_WORKER_ERROR')
    w.onmessageerror = () => die('STATS_REPLY_UNREADABLE')
  }

  const compute = (request: StatsRequest): Promise<StatsBundle> => {
    if (dead) return Promise.reject(new Error('STATS_SESSION_UNAVAILABLE'))
    if (idleTimer !== undefined) { clearTimeout(idleTimer); idleTimer = undefined }

    if (!worker) {
      try {
        worker = new Worker(new URL('./statsWorker.ts', import.meta.url), { type: 'module' })
      } catch {
        // The constructor itself refused (no module-worker support, a blocked
        // URL). There is no worker to tear down and no point trying again.
        dead = true
        return Promise.reject(new Error('STATS_WORKER_UNAVAILABLE'))
      }
      loaded = false
      attach(worker)
    }
    const w = worker
    const id = nextId++

    return new Promise<StatsBundle>((resolve, reject) => {
      let settled = false

      // The one exit for THIS request. A reply arriving after the watchdog — or an
      // `error` following a `messageerror` — can neither settle it twice, nor
      // re-arm the idle timer, nor terminate the worker again. `watchdog` is
      // declared below and read only from inside these closures, none of which can
      // run before that line.
      //
      // TWO OF THESE FOUR LINES ARE REDUNDANT PAIRS, and that was measured rather
      // than assumed, because a reader deciding one of them is dead code needs to
      // know which test would notice:
      //
      //   `pending.delete(id)` is what makes a second delivery unreachable at all
      //   (`onmessage` then finds nothing to settle), and `if (settled) return` is
      //   what would stop it if it did. Deleting EITHER alone leaves the suite
      //   green; deleting both turns it red. `pending.delete(id)` alone is caught
      //   by "a settled request leaves no watchdog armed behind it".
      //
      //   `clearTimeout(watchdog)` is what stops a settled request's watchdog ever
      //   firing, and the callback's own `if (!settled)` is what would stop it if
      //   it did. Same shape: either alone is green, the pair is red, and
      //   `clearTimeout` alone is caught by the same test's timer count.
      //
      // Both survivors are kept. Each is one line, each closes a hazard the other
      // closes by a different route, and a settle contract is exactly the place to
      // pay a line for a second route.
      const settle = (act: () => void): void => {
        if (settled) return
        settled = true
        clearTimeout(watchdog)
        pending.delete(id)
        act()
        armIdle()
      }
      const p: Pending = {
        resolve: b => settle(() => resolve(b)),
        fail: reason => settle(() => reject(new Error(reason))),
      }
      pending.set(id, p)

      const watchdog = setTimeout(() => {
        // Silence. Fail this request and kill the worker: it is not answering and
        // it is holding a second copy of the export.
        //
        // The `if` is the second half of a redundant pair — see the note on
        // `settle` above, which records the measurement. It is reachable only if
        // `clearTimeout(watchdog)` ever stops running, and the cost of being wrong
        // about that is a healthy session dropped onto the synchronous path for the
        // rest of the export's life.
        if (!settled) die('STATS_COMPUTE_TIMEOUT')
      }, budget)

      // Cloning the observations out to the worker can itself fail on a large
      // export. Inside the executor a throw would reject, but the worker would
      // leak and the watchdog would keep a timer armed for a minute; route it
      // through `die`, which does both.
      try {
        const message: StatsWorkerMessage = loaded
          ? { id, request }
          : { id, observations, request }
        w.postMessage(message)
        loaded = true
      } catch {
        die('STATS_POST_FAILED')
      }
    })
  }

  return {
    compute,
    dispose: () => die('STATS_SESSION_DISPOSED'),
    hasWorker: () => worker !== null,
  }
}

/**
 * One request's bundle: off the main thread when a worker can answer, on it when
 * one cannot.
 *
 * TOTALITY, BOUNDED — and the bound is named here rather than left implied. This
 * settles for every outcome `createStatsSession` can produce: a session that is
 * null (no Worker on this platform), a rejection from any of the five settle paths
 * above, and a resolved bundle. It does NOT close non-settlement: if
 * `session.compute` never settled, neither would this. That is closed one level
 * down, by the watchdog, which is the only place it can be closed — and it is the
 * reason a caller may treat this as total.
 *
 * `return await`, not `return`, on the worker path. An async function performs
 * promise resolution of a plain `return v` AFTER the try block has exited, so both
 * the `then` call and the `Get(v, "then")` lookup escape the `catch` — the v1.0.16
 * rule, whose entry names this exact change class. Without the `await`, a
 * `session.compute` rejection would escape this function instead of falling back,
 * and the caller's tab would sit on its spinner for the session. The cost is one
 * microtask tick.
 */
export async function computeStatsWithFallback(
  session: StatsSession | null,
  observations: readonly ObservationEntry[],
  request: StatsRequest,
): Promise<StatsBundle> {
  if (session) {
    try {
      return await session.compute(request)
    } catch {
      // Fall through and compute here — see the settle-contract note above for
      // why this is the honest answer rather than the one its precedents forbid.
    }
  }
  return computeStatsBundle(observations, request)
}

import { parseMLExport } from './parseMLExport'
import type { MLExportResult } from './parseMLExport'

/**
 * The worker protocol. A file that is not an ML export is a REPLY, not an error:
 * `parseMLExport` throws on it, and an uncaught throw inside the worker reaches
 * this thread as the worker's `error` event — the same event a worker that fell
 * over dispatches. Those two mean different things to a user (one is a file they
 * can replace, one is the app failing), so the invalid file is answered explicitly
 * and the `error` path is left to mean death only.
 */
export type MLParseReply =
  | { ok: true; result: MLExportResult }
  | { ok: false }

// How long a healthy parse is allowed to take before the worker is presumed dead.
//
// A worker that dies without dispatching `error` — an OOM kill, a crash — gives the
// main thread NO event to settle on, so the only remaining evidence of death is
// silence, and silence has to be bounded by a clock. The bound scales with the
// input because the thing being waited on does.
//
// MEASURED AGAINST `parseMLExport`, NEVER INHERITED. Its eBird twin's `4 s/MB` came
// from `parseEbirdObservations`, which is a different function with a different
// memory shape: since v1.0.13 that one STREAMS one reused row array, while this one
// still materializes the whole `string[][]` cell grid (knowingly not converged —
// moving it off-thread relocates that peak into worker heap rather than removing
// it). It is measurably slower for it.
//
// Measured on the tracked demo ML export and multiples of it (Node 24.18 / V8, best
// of three after a warm-up), over a 240x size range from 0.13 to 30.4 Mchar, in two
// runs at different machine loads:
//
//   run 1 (load avg ~20)   43.0  44.8  55.4  48.7  45.2  46.5  Mchar/s
//   run 2 (load avg ~14)   50.9  59.7  57.4  52.9  52.7  52.7  Mchar/s
//
// Flat across the range in both, so the parse is linear in the input and the
// allowance can be too. The anchor is the SLOWEST reading of the two runs,
// 43.0 Mchar/s, or 23.3 ms per million characters; a loaded machine reads slower,
// so anchoring there errs toward a wider budget.
//
// The comparative measurement is the one that decides the constant, and it was
// taken in the same run on the same machine: at ~30 Mchar `parseEbirdObservations`
// ran at 82.1 Mchar/s against this parser's 52.7, so the streaming parser is about
// 1.5x faster. (Its own recorded figures, 57.8 to 75.0 Mchar/s, were taken on
// another machine; the RATIO is what transfers, not the absolute rate.)
//
// The allowance below is 6 SECONDS per million characters — about 258x slower than
// the anchor, and 1.5x its twin's 4 s/MB, which is the measured ratio. It carries
// that twin's SAFETY FACTOR rather than its number, which is the whole reason the
// measurement had to be redone. That clears the slowest device this app ships to
// (a Pi's browser, an older iPhone's WKWebView) by a wide margin even with the heap
// under GC pressure, and still turns an unbounded hang into a bounded failure:
// ~31 s for the demo export, ~1 min for a 5 MB one. The floor covers worker spawn,
// module evaluation and the structured clone of the request, none of which scale
// with the file.
//
// The far end is bounded by the size cap this build added at upload: a stored
// export cannot exceed 50 MB, so the widest budget this can hand out is about five
// and a half minutes. The cap and the watchdog are what make the retained cell grid
// safe to keep for now.
const PARSE_BUDGET_FLOOR_MS = 30_000
const PARSE_BUDGET_MS_PER_CHAR = 0.006

function parseBudgetMs(chars: number): number {
  return PARSE_BUDGET_FLOOR_MS + chars * PARSE_BUDGET_MS_PER_CHAR
}

/** The no-Worker fallback, wrapped so an `INVALID_ML_EXPORT` throw comes back as a
 *  REJECTION. This function's contract is a promise; a caller that holds it before
 *  awaiting must not be handed a synchronous throw instead. */
function parseHere(text: string): Promise<MLExportResult> {
  try {
    return Promise.resolve(parseMLExport(text))
  } catch (err) {
    return Promise.reject(err instanceof Error ? err : new Error(String(err)))
  }
}

/**
 * `parseMLExport`, off the main thread, so a large export does not freeze the tab
 * that is loading it. Output-identical to calling it directly, its throw included:
 * a file that is not an ML export rejects with `INVALID_ML_EXPORT`, the same
 * `Error` message the synchronous parser throws, so a call site converts by moving
 * `parseMLExport(text)` to `await parseMLExportOffThread(text)` inside the `try` it
 * already has.
 *
 * SETTLE CONTRACT — every path settles, and the worker is always torn down.
 * This is the v1.0.14 contract, second instance. `onmessage` and `onerror` alone
 * are not enough: a worker that dies without dispatching `error` leaves nothing to
 * settle on, and `loadMLExport` memoizes the promise built on top of this one in
 * `inflight`, so ONE such death would hang every ML-backed tab for the rest of the
 * session and leak the dead worker with it. A memoized promise inherits its
 * producer's worst settle path. The paths are: a reply (resolve, or reject
 * `INVALID_ML_EXPORT` when the worker says the file is not an export); a worker
 * error (reject); a reply that cannot be structured-cloned back to us
 * (`messageerror`, reject); a request that cannot be cloned out (`postMessage`
 * throws, reject); and silence past the budget above (reject). Whichever fires
 * first wins — it clears the watchdog, detaches the handlers, and terminates the
 * worker, so a late event after the watchdog can neither re-settle nor terminate
 * twice.
 *
 * A rejection deliberately does NOT re-parse on this thread. That would re-run the
 * identical allocation that had just failed, on the thread that paints.
 *
 * Where Workers do not exist at all (an older browser, jsdom under vitest) the
 * parse runs here. That is the ONLY parse on that path — not a retry of a failed
 * one.
 *
 * BOTH CALL SITES CONVERT SEPARATELY AND STAY SEPARATE. `mlExportCache.loadFresh`
 * is one; `LifeList`'s own read is the other, which v0.5.52 deliberately did not
 * route through the cache (the cache swallows a bad parse to null and has no
 * `detectExportType` gate, and Multimedia needs both distinctions). Converting only
 * the cache would leave the freeze on the tab most likely to be holding a large
 * export.
 */
export function parseMLExportOffThread(text: string): Promise<MLExportResult> {
  let worker: Worker
  try {
    worker = new Worker(new URL('./mlExportWorker.ts', import.meta.url), { type: 'module' })
  } catch {
    return parseHere(text)
  }
  return new Promise<MLExportResult>((resolve, reject) => {
    let settled = false

    // The one exit. Idempotent, so a late event after the watchdog (or an `error`
    // that follows a `messageerror`) cannot resolve an already-rejected promise or
    // terminate twice. `watchdog` is declared below and read only from inside these
    // closures, none of which can run before that line executes.
    const settle = (act: () => void) => {
      if (settled) return
      settled = true
      clearTimeout(watchdog)
      worker.onmessage = null
      worker.onerror = null
      worker.onmessageerror = null
      worker.terminate()
      act()
    }
    const fail = (reason: string) => settle(() => reject(new Error(reason)))

    const watchdog = setTimeout(() => fail('ML_PARSE_TIMEOUT'), parseBudgetMs(text.length))

    worker.onmessage = (e: MessageEvent<MLParseReply>) => {
      const reply = e.data
      // A reply is only a success when it says so. An unreadable or unexpected
      // reply shape is treated as an unusable file rather than as a resolved
      // parse, so nothing downstream can receive a half-built result.
      if (reply && reply.ok) settle(() => resolve(reply.result))
      else fail('INVALID_ML_EXPORT')
    }
    worker.onerror = () => fail('ML_PARSE_WORKER_ERROR')
    worker.onmessageerror = () => fail('ML_PARSE_REPLY_UNREADABLE')

    // Cloning the CSV out to the worker can itself fail on a very large export.
    // Inside the executor a throw would reject, but the worker would leak and the
    // watchdog would keep a timer alive for minutes; route it through `settle`.
    try {
      worker.postMessage(text)
    } catch {
      fail('ML_PARSE_POST_FAILED')
    }
  })
}

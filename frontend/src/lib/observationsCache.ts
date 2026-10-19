import { storage } from './storage'
import { firstLine } from './firstLine'
import { parseEbirdObservations } from './parseEbirdObservations'
import { materializeObservations } from './observationsPacked'
import type { PackedObservations } from './observationsPacked'
import type { ObservationEntry } from '../types'

// Shared cache for the parsed eBird backup. Several tabs each parse the same ~20k-row
// CSV; this memoizes the parse so they share one result. Once parsed, a cache hit
// returns immediately — no re-read of the ~6 MB file and no content compare on every
// heavy-tab mount. The cache is invalidated explicitly when the eBird file is saved
// or cleared (clearEbirdObservationsCache, called from Settings).
//
// WHAT IS CACHED, AND WHAT DELIBERATELY IS NOT. This used to hold
// `{ text, observations }` — the entire raw CSV, at module scope, for the whole
// session. `text` had exactly one consumer: BreedingCodeList passed it to
// `deriveBreedingData`, which uses it only for `hasBreedingCodeColumn`, which reads
// the FIRST LINE. So megabytes were retained to answer a boolean (13.2 MB on the
// reference export; ~116 MB at 500k rows). The cache now keeps `headerLine` — the
// first line, and nothing else. Anything that genuinely needs the whole file must
// re-read it from storage and let it go again, never park it here.
export interface LoadedEbird {
  /** The CSV's first line — the header row, verbatim, including any BOM. */
  headerLine: string
  observations: ObservationEntry[]
}

let cache: LoadedEbird | null = null
// In-flight parse, so concurrent first-callers share one parse.
let inflight: Promise<LoadedEbird | null> | null = null
// Bumped on invalidation so a parse that's in flight when the file changes won't
// repopulate the cache with now-stale content.
let generation = 0

// How long a healthy parse is allowed to take before the worker is presumed dead.
//
// A worker that dies without dispatching `error` — an OOM kill, a crash — gives the
// main thread NO event to settle on, so the only remaining evidence of death is
// silence, and silence has to be bounded by a clock. The bound scales with the input
// because the thing being waited on does: a budget right for a 1 MB export would fire
// on a healthy 100 MB one, and firing on a slow-but-healthy parse would be a worse
// bug than the hang it replaces.
//
// Measured on the tracked demo export and multiples of it (Node 24 / V8, quiet
// machine): 57-75 million characters per second — 13 to 18 ms per megabyte, flat
// across 1.4 MB, 6.8 MB and 27 MB, so the parse is linear in the input and the
// allowance can be too. The allowance below is 4 SECONDS per megabyte, roughly 250x
// slower than measured. That clears the slowest device this app ships to (a Pi's
// browser, an older iPhone's WKWebView) by a wide margin even with the heap under GC
// pressure, and still turns an unbounded hang into a bounded failure: ~34 s for the
// demo export, ~56 s for the 6.6 MB reference export, ~10 min for a 148 MB one.
// The floor covers worker spawn, module evaluation and the structured clone of the
// request on a busy device — none of which scale with the file.
//
// big-old-life-lists re-measured it for the packed parse, which interns every
// string through a Map as it goes: 7.5 s for 277 Mchar in JavaScriptCore, about
// 0.027 us per character, so the allowance is still about 150x the slowest
// engine on this Mac. The formula is unchanged; it is exported so the stats
// budget's ceiling can be DERIVED from it at each platform's upload cap
// (`statsOffThread.ts`) instead of restating a number.
const PARSE_BUDGET_FLOOR_MS = 30_000
const PARSE_BUDGET_MS_PER_CHAR = 0.004

export function parseBudgetMs(chars: number): number {
  return PARSE_BUDGET_FLOOR_MS + chars * PARSE_BUDGET_MS_PER_CHAR
}

/**
 * Parse off the main thread via a Web Worker so the UI stays responsive while a
 * large export is parsed (especially on low-power / Raspberry Pi deployments).
 *
 * The worker replies with the PACKED parse, its buffers transferred, and the
 * entries are materialized here (`observationsPacked.ts`): moving the arrays
 * costs nothing per row, and every entry shares its strings with every other
 * entry that carries them, which a structured clone of entries could not give.
 *
 * SETTLE CONTRACT — every path settles, and the worker is always torn down.
 * `onmessage` and `onerror` alone are not enough. A worker that dies without
 * dispatching `error` leaves nothing to settle on, and the promise this returns is
 * memoized in `inflight`, so ONE such death hung every observations tab for the rest
 * of the session and leaked the dead worker with it. The paths are now: a reply
 * (resolve, or reject when the reply does not materialize); a worker error
 * (reject); a reply that cannot be structured-cloned back to us (`messageerror`,
 * reject); a request that cannot be cloned out (`postMessage` throws, reject); and
 * silence past the budget above (reject). Whichever fires first wins — it clears
 * the watchdog, detaches the handlers, and terminates the worker.
 *
 * A rejection deliberately does NOT re-parse on this thread. The old `onerror` branch
 * did, which re-ran the identical allocation that had just failed, on the thread that
 * paints, and only terminated the worker after it returned.
 * `loadEbirdObservations` turns a rejection into `null`, which every tab already
 * reads as "couldn't load your backup" rather than "you have no backup".
 *
 * THE TEXT IS NOT KEPT ALIVE BY THE WAIT. The handlers that wait for the reply are
 * made in `awaitParseReply`, which never sees the text, so once the text has been
 * posted nothing on this side refers to it: during the parse only the worker's
 * copy is alive, not two. At 1M rows a copy is 277 M characters, 554 MB as a
 * two-byte string (a weather block's emoji make the whole export two-byte).
 *
 * Where Workers do not exist at all (an older browser, jsdom under vitest) the parse
 * runs here. That is the ONLY parse on that path — not a retry of a failed one.
 */
function parseOffThread(text: string): Promise<ObservationEntry[]> {
  let worker: Worker
  try {
    worker = new Worker(new URL('./observationsWorker.ts', import.meta.url), { type: 'module' })
  } catch {
    return Promise.resolve(parseEbirdObservations(text))
  }
  const wait = awaitParseReply(worker, parseBudgetMs(text.length))
  // Cloning the CSV out to the worker can itself fail on a very large export;
  // route it through the same settle so the worker and the watchdog go with it.
  try {
    worker.postMessage(text)
  } catch {
    wait.fail('EBIRD_PARSE_POST_FAILED')
  }
  return wait.reply
}

/** The waiting half of `parseOffThread`, kept in a scope that never holds the text. */
function awaitParseReply(worker: Worker, budgetMs: number): {
  reply: Promise<ObservationEntry[]>
  fail: (reason: string) => void
} {
  let fail: (reason: string) => void = () => {}
  const reply = new Promise<ObservationEntry[]>((resolve, reject) => {
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
    fail = (reason: string) => settle(() => reject(new Error(reason)))

    const watchdog = setTimeout(() => fail('EBIRD_PARSE_TIMEOUT'), budgetMs)

    worker.onmessage = (e: MessageEvent<PackedObservations>) => {
      // Materialized here, inside the handler, so the packed form is garbage the
      // moment this returns. A reply that does not fit the packed shape is a
      // failed parse, never entries built from it (the payload rule, v1.0.20).
      let observations: ObservationEntry[]
      try {
        observations = materializeObservations(e.data)
      } catch {
        fail('EBIRD_PARSE_REPLY_MALFORMED')
        return
      }
      settle(() => resolve(observations))
    }
    worker.onerror = () => fail('EBIRD_PARSE_WORKER_ERROR')
    worker.onmessageerror = () => fail('EBIRD_PARSE_REPLY_UNREADABLE')
  })
  return { reply, fail }
}

// The CSV's first line, re-exported so every existing caller and the retention
// suite keep importing it from here. It moved to its own module when a second
// reader of a whole stored export needed it (`detectExportType.ts`, upload
// classification); the measurement and the two retention traps it avoids are
// recorded at the definition, and the drift guard now covers both files.
export { firstLine, MAX_HEADER_CHARS } from './firstLine'

/**
 * Read the stored eBird backup and parse it into observations, memoized by file
 * content. The returned `headerLine` is the CSV's first line only — the full text is
 * NOT retained (see the note above).
 *
 * Returns null when the backup cannot be handed back: no eBird file is stored, OR
 * the stored file could not be READ (the backend was unreachable, the body was
 * truncated mid-download), OR it could not be parsed (the worker died, the reply
 * was unreadable, the CSV was not an eBird export). This promise structurally
 * cannot reject. ONE falsy answer for all of them, deliberately: every
 * tab already reads a falsy result as "couldn't load your eBird backup from
 * Settings", whereas a THROWN load lands in each tab's outer catch, which maps to
 * `setup-required` — telling the user to upload a backup they plainly already have.
 * A failed load is not cached and does not survive in `inflight`, so the next mount,
 * re-save or file arrival starts a fresh attempt rather than re-joining a dead
 * promise.
 */
export async function loadEbirdObservations(): Promise<LoadedEbird | null> {
  if (cache) return cache
  if (!inflight) {
    inflight = loadFresh(generation).finally(() => { inflight = null })
  }
  return inflight
}

function loadFresh(myGen: number): Promise<LoadedEbird | null> {
  // A promise chain, not an async function, and that is load-bearing: a suspended
  // async function keeps its locals in its own frame across every await, so a
  // `const text = await storage.readFile(...)` would hold the whole export on this
  // thread for the length of the parse. Here the text lives only in `startParse`'s
  // argument, which returns as soon as the text is posted.
  //
  // The READ is inside this chain's catch, not outside it: on web/Pi a read
  // rejection is an ordinary event (`WebStorage.readFile` rejects when the backend
  // is unreachable, the body is truncated, or the transfer stays silent past its
  // inactivity bound, over a ~6 MB CSV served off a Pi).
  return storage.readFile('ebird')
    .then(startParse)
    .then(started => (started === null ? null : finishParse(started, myGen)))
    .catch(() => {
      // A read or parse that failed for any reason — including a worker that died
      // without saying so — is reported as "no usable backup", never as a throw. See
      // the note on loadEbirdObservations for why the distinction matters to the
      // tabs. Nothing is cached, so the next caller re-reads and re-parses.
      return null
    })
}

interface StartedParse {
  headerLine: string
  parsing: Promise<ObservationEntry[]>
}

/**
 * Take the header line and start the parse; the text goes out of scope when this
 * returns. Null when there is no file, or when no header line ends within
 * `MAX_HEADER_CHARS` (see firstLine). A file whose first line runs past the bound
 * is not an eBird export: the backup's header is 309 characters, and one record
 * per line is the format. Reporting it as an unusable backup is this module's
 * existing honest failure, which every tab already reads as "couldn't load your
 * backup". The alternative — an empty `headerLine` — would have
 * `hasBreedingCodeColumn` answer "no Breeding Code column" about a header nobody
 * read, which is a claim about the FILE rather than about our reading of it, and
 * that is the shape of lie the 1.0.14 family exists to remove. Checked BEFORE the
 * parse now, so such a file is never parsed only to be refused.
 */
function startParse(text: string | null): StartedParse | null {
  if (text === null) return null
  const headerLine = firstLine(text)
  if (headerLine === null) return null
  return { headerLine, parsing: parseOffThread(text) }
}

async function finishParse(started: StartedParse, myGen: number): Promise<LoadedEbird> {
  const result: LoadedEbird = { headerLine: started.headerLine, observations: await started.parsing }
  // Don't cache if the file was invalidated while we were parsing.
  if (myGen === generation) cache = result
  return result
}

/** Invalidate the cached parse. Call whenever the stored eBird file changes (save or
 * clear) so the next load re-reads + re-parses. */
export function clearEbirdObservationsCache(): void {
  cache = null
  inflight = null
  generation++
}

import { storage } from './storage'
import { parseEbirdObservations } from './parseEbirdObservations'
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

// Parse off the main thread via a Web Worker so the UI stays responsive while a
// large export is parsed (especially on low-power / Raspberry Pi deployments).
// Falls back to a synchronous parse if Workers are unavailable or the worker errors,
// so behavior is identical everywhere — just smoother where Workers are supported.
function parseOffThread(text: string): Promise<ObservationEntry[]> {
  let worker: Worker
  try {
    worker = new Worker(new URL('./observationsWorker.ts', import.meta.url), { type: 'module' })
  } catch {
    return Promise.resolve(parseEbirdObservations(text))
  }
  return new Promise<ObservationEntry[]>((resolve) => {
    worker.onmessage = (e: MessageEvent<ObservationEntry[]>) => {
      resolve(e.data)
      worker.terminate()
    }
    worker.onerror = () => {
      resolve(parseEbirdObservations(text))
      worker.terminate()
    }
    worker.postMessage(text)
  })
}

/**
 * The CSV's first line — found with `indexOf` and copied CHARACTER BY CHARACTER.
 *
 * Both halves of that sentence are load-bearing, and BOTH were measured rather than
 * reasoned about, because the obvious spellings retain the entire export while
 * looking exactly like this one. Holding the "header line" of a 148 MB / 500k-row
 * export, source dropped and GC forced (Node 24 / V8, one-byte strings):
 *
 *   the whole text                       152.2 MB   <- what this replaced
 *   content.search(/\r?\n/) then .slice   152.2 MB   <- the obvious rewrite
 *   content.indexOf then .slice          152.2 MB   <- still the whole file
 *   content.search(/\r?\n/) then a copy   152.2 MB   <- still the whole file
 *   content.indexOf then a copy            3.8 MB   <- this function (baseline heap)
 *
 * Two independent mechanisms, neither visible in review:
 *   - `.slice()` of a long parent is a SlicedString that REFERENCES the parent, so
 *     a 309-character header cut that way keeps every byte of the export alive.
 *   - a regex method leaves the SUBJECT in the engine's last-match state (what the
 *     legacy `RegExp.$_` / `RegExp.lastMatch` accessors read), so merely ASKING a
 *     regex where the line ends is enough to retain the file, however the answer is
 *     then used. `indexOf` has no such state.
 *
 * Figures are one engine's accounting on ASCII input and are evidence, not a bound;
 * the structural claim is that neither the returned string nor any engine-side state
 * references `content`. The suite asserts the OTHER half — that this returns exactly
 * what `content.slice(0, content.search(/\r?\n/))` returns, over hand-written probes
 * and every string over the line-break alphabet up to length 4 — plus a drift guard
 * that neither spelling comes back. Two cases worth stating: a lone `\r` NOT followed
 * by `\n` is an ordinary character and does not end the line, and a leading BOM is
 * kept, because `hasBreedingCodeColumn` sees the raw text today.
 */
export function firstLine(content: string): string {
  const nl = content.indexOf('\n')
  // No line break at all: the file IS its first line. Hand back the same string
  // rather than copying it — a copy would retain exactly as much, and this is the
  // one case where the previous behavior also passed the whole string along.
  if (nl === -1) return content
  // /\r?\n/ matches at the CR when the break is CRLF, and at the LF otherwise; no
  // earlier position can match, because there is no earlier LF.
  const end = nl > 0 && content[nl - 1] === '\r' ? nl - 1 : nl
  let out = ''
  for (let i = 0; i < end; i++) out += content[i]
  return out
}

/**
 * Read the stored eBird backup and parse it into observations, memoized by file
 * content. Returns null when no eBird file is stored. The returned `headerLine` is
 * the CSV's first line only — the full text is NOT retained (see the note above).
 */
export async function loadEbirdObservations(): Promise<LoadedEbird | null> {
  if (cache) return cache
  if (!inflight) {
    inflight = loadFresh(generation).finally(() => { inflight = null })
  }
  return inflight
}

async function loadFresh(myGen: number): Promise<LoadedEbird | null> {
  const text = await storage.readFile('ebird')
  if (text === null) return null
  const observations = await parseOffThread(text)
  // `text` goes out of scope with this call — only the header line survives it.
  const result: LoadedEbird = { headerLine: firstLine(text), observations }
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

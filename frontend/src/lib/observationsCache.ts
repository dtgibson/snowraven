import { storage } from './storage'
import { parseEbirdObservations } from './parseEbirdObservations'
import type { ObservationEntry } from '../types'

// Shared, content-keyed cache for the parsed eBird backup. Several tabs each read
// and parse the same ~20k-row CSV independently; this memoizes the parse so they
// share one result. Keying on the file's text means a re-upload (new content)
// naturally invalidates the cache without any explicit signal.
let cache: { text: string; observations: ObservationEntry[] } | null = null
// In-flight parse, so concurrent callers for the same content share one parse.
let inflight: { text: string; promise: Promise<ObservationEntry[]> } | null = null

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
 * Read the stored eBird backup and parse it into observations, memoized by file
 * content. Returns null when no eBird file is stored. The returned `text` is the
 * raw CSV (callers that also need it — e.g. to parse comments or ML — can reuse it).
 */
export async function loadEbirdObservations(): Promise<{ text: string; observations: ObservationEntry[] } | null> {
  const text = await storage.readFile('ebird')
  if (text === null) return null
  if (cache && cache.text === text) return cache
  if (inflight && inflight.text === text) return { text, observations: await inflight.promise }

  const promise = parseOffThread(text)
  inflight = { text, promise }
  try {
    const observations = await promise
    cache = { text, observations }
    return { text, observations }
  } finally {
    if (inflight?.text === text) inflight = null
  }
}

/** Drop the cached parse. Content-keying already invalidates on change; this just
 * frees the retained array (e.g. when a file is cleared). */
export function clearEbirdObservationsCache(): void {
  cache = null
}

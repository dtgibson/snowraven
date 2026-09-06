// Web Worker: runs the Statistics tab's whole derivation chain off the main thread
// so the ~48 ms of paint-blocking work on the reference export (and plausibly
// several hundred on a phone or a Pi) does not land on the frame the user is
// looking at. The third worker in this repo, after `observationsWorker.ts` and
// `mlExportWorker.ts`.
//
// UNLIKE BOTH OF THOSE, THIS WORKER IS NOT ONE-SHOT. It is handed the parsed
// observations once, on the first message of its life, and holds them; every later
// message carries only `{ includeSpuh, granularity, excludedNames }`. That is the
// whole reason it exists as a separate worker rather than a job on the parse
// worker: a filter toggle then costs a 0.002 ms message instead of a 34 ms clone of
// the observations array. `statsOffThread.ts` owns the memory bound that buys.
//
// A THROW IS ANSWERED, NOT LEAKED — the same reason `mlExportWorker.ts` has a body
// rather than a one-liner. An uncaught throw here reaches the main thread as this
// worker's `error` event, which the settle contract reads as the worker having
// DIED, and this worker is meant to answer again. Catching it keeps "that compute
// failed" and "the worker is gone" as two different events on the wire.
import { computeStatsBundle } from './statsBundle'
import type { StatsWorkerMessage, StatsWorkerReply } from './statsOffThread'
import type { ObservationEntry } from '../types'

const ctx = self as unknown as Worker

let held: readonly ObservationEntry[] | null = null

ctx.onmessage = (e: MessageEvent<StatsWorkerMessage>) => {
  const { id, observations, request } = e.data
  if (observations) held = observations
  let reply: StatsWorkerReply
  try {
    // A compute with nothing to compute over means the hand-over was lost — a
    // request built as a follow-up for a worker that never received the first
    // message. Answering `{ ok: false }` sends the caller to its fallback, which
    // has the observations, rather than replying with a bundle over nothing.
    if (!held) throw new Error('NO_OBSERVATIONS')
    reply = { id, ok: true, bundle: computeStatsBundle(held, request) }
  } catch {
    reply = { id, ok: false }
  }
  ctx.postMessage(reply)
}

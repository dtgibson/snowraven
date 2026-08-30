// The key-global eBird pacing gate (ebird-cooldown-and-app-icon): ONE shared
// request-start spacing and ONE shared 429 cooldown for every governed eBird
// lookup, extending the v0.5.92 pacing contract (lib/rateLimit.ts) from the
// hotspot-activity pass to the Map Explorer's other eBird surfaces. A 429
// means the KEY is over the limit, not one surface — so the state here is
// module-scoped (session-lifetime), written by BOTH enforcement points:
//
//   • the activity controller (useHotspotActivity) keeps its own pump — it
//     needs per-hotspot retry bookkeeping and progress emission — but reads
//     and writes THIS state, so its 429s slow the single-shot lookups and
//     vice versa;
//   • gatedEbirdCall() below governs the single-shot lookups wired at the
//     transport chokepoint (/map/hotspots, /map/recent-obs,
//     /map/hotspot-region, /map/county-species): serialized starts (the
//     v0.5.86 Nominatim request-start-queue precedent, at eBird's 150 ms
//     rather than Nominatim's 1 s), cooldown wait-out, and bounded retries.
//
// One enforcement point per request: /map/hotspot-activity is deliberately
// NOT routed through gatedEbirdCall (the controller enforces for it), and the
// transport wires the gate BELOW the short-TTL cache so a cache hit never
// waits. Accepted, documented cost: a transport-cache miss that an inner
// cache would serve (the backend's recent-obs single-flight, the desktop
// service's raw-fetch dedupe) still waits for its start slot — bounded at the
// spacing floor, and conservative in the right direction while a cooldown is
// live. Stated per the v0.5.84 no-silent-caps rule rather than discovered.
//
// Dependency-light by design: rateLimit.ts is the only import, so transport.ts
// (entry chunk) can import this without new weight. Clock and random are read
// inside functions (never at render — the callers are handlers/effects).

import * as rateLimit from './rateLimit'

interface EbirdGateState {
  /** No governed request may START before this ms epoch (0 = no cooldown). */
  cooldownUntil: number
  /** Consecutive 429 WAVES (a 429 arriving outside any active cooldown);
   *  drives the bounded exponential. Reset by a post-cooldown success. */
  cooldownWave: number
  /** MONOTONIC count of 429 waves this session — OBSERVATION ONLY. A pass
   *  counts waves over its own window by differencing this against a
   *  pass-start reading (the projects sweep's progressive layer). It advances
   *  in lockstep with cooldownWave but is never reset by a success and is
   *  never consulted by the gate's own policy, so the cooldown/reset
   *  semantics for single-shot lookups are untouched by its existence. Reset
   *  only by the test seam. */
  waveCount: number
  /** ms epoch of the last governed request start (global start spacing). */
  lastStart: number
}

const state: EbirdGateState = { cooldownUntil: 0, cooldownWave: 0, waveCount: 0, lastStart: 0 }

/** Read-only view of the shared pacing state (the activity controller's
 *  pass-start "already rate limited?" read; tests). */
export function ebirdGateState(): Readonly<EbirdGateState> {
  return state
}

/** ms until the next governed request may start (0 = clear now). Reads the
 *  LIVE ACTIVITY_START_SPACING_MS binding (the mutable test seam). */
export function ebirdWaitMs(now: number): number {
  return Math.max(
    state.cooldownUntil - now,
    state.lastStart + rateLimit.ACTIVITY_START_SPACING_MS - now,
    0,
  )
}

/** Stamp a governed request start (the caller is starting NOW). */
export function noteEbirdStart(now: number): void {
  state.lastStart = now
}

/** Record a 429 against the key: opens or extends the ONE shared cooldown.
 *  A burst of simultaneous 429s counts as one wave (only a 429 arriving
 *  outside an active cooldown advances the ladder). */
export function noteEbirdRateLimit(err: unknown, now: number, random: number): void {
  if (now >= state.cooldownUntil) {
    state.cooldownWave += 1
    state.waveCount += 1
  }
  const delay = rateLimit.cooldownDelayMs(
    state.cooldownWave, rateLimit.retryAfterMsFrom(err), random,
  )
  state.cooldownUntil = Math.max(state.cooldownUntil, now + delay)
}

/** Record a success: one arriving at/after the cooldown end closes the slowed
 *  regime (resets the wave ladder). A success still inside the window — a
 *  request that started before the 429 landed — proves nothing and is a no-op. */
export function noteEbirdSuccess(now: number): void {
  if (now >= state.cooldownUntil) state.cooldownWave = 0
}

// ── The serialized start queue for single-shot lookups ───────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/** Start turns are strictly serialized so two concurrent gated calls can never
 *  observe the same lastStart and burst together; each turn RE-checks the wait
 *  after waking (a cooldown opened while queued is honored in full). Turns
 *  never reject, so one failed call can never wedge the chain. */
let startChain: Promise<void> = Promise.resolve()

function reserveEbirdStart(): Promise<void> {
  const turn = startChain.then(async () => {
    for (;;) {
      const wait = ebirdWaitMs(Date.now())
      if (wait <= 0) break
      await sleep(wait)
    }
    state.lastStart = Date.now()
  })
  startChain = turn
  return turn
}

/**
 * Run one governed single-shot eBird lookup under the shared gate: wait for
 * the key-global cooldown and the global start spacing, then call; on a 429,
 * record it (opening/extending the shared cooldown) and retry after the wait,
 * bounded at ACTIVITY_RATE_LIMIT_RETRIES — the same 3-requests-total contract
 * the activity pass gives one hotspot. A non-429 error throws unchanged; the
 * final 429 throws with the transports' shared detail for the caller's
 * existing error display. 429 responses are never cached by any layer above
 * (networkCache and the durable caches cache successes only).
 */
export async function gatedEbirdCall<T>(doCall: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    await reserveEbirdStart()
    try {
      const result = await doCall()
      noteEbirdSuccess(Date.now())
      return result
    } catch (err) {
      if (rateLimit.isRateLimitError(err)) {
        noteEbirdRateLimit(err, Date.now(), Math.random())
        if (attempt < rateLimit.ACTIVITY_RATE_LIMIT_RETRIES) continue
      }
      throw err
    }
  }
}

/** Test seam: reset the shared state AND the start queue. Module state is
 *  session-scoped by design (the cooldown deliberately survives pass
 *  restarts), so suites that exercise pacing must reset between tests. */
export function _resetEbirdGateForTests(): void {
  state.cooldownUntil = 0
  state.cooldownWave = 0
  state.waveCount = 0
  state.lastStart = 0
  startChain = Promise.resolve()
}

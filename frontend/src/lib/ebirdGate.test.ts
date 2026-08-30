// The shared key-global eBird pacing gate (v0.5.93 cooldown extension):
// serialized spaced starts, ONE cooldown shared across every governed
// surface, bounded retries, and the reset seam. Fake timers throughout —
// every assertion is on request-START times or call counts, never wall
// clock (the v0.5.92 pacing-test rule).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  gatedEbirdCall, ebirdGateState, ebirdWaitMs,
  noteEbirdRateLimit, noteEbirdStart, noteEbirdSuccess,
  _resetEbirdGateForTests,
} from './ebirdGate'
import {
  ACTIVITY_START_SPACING_DEFAULT_MS, ACTIVITY_RATE_LIMIT_RETRIES,
  ACTIVITY_COOLDOWN_MAX_MS,
  _setActivityStartSpacingMsForTests,
} from './rateLimit'

const rateLimit429 = (retryAfterSec: number | null) =>
  Object.assign(new Error('rate limited'), {
    status: 429,
    detail: 'eBird is limiting requests right now. Try again in a moment.',
    ...(retryAfterSec !== null ? { retryAfterSec } : {}),
  })

let randSpy: ReturnType<typeof vi.spyOn> | null = null

beforeEach(() => {
  vi.useFakeTimers()
  _resetEbirdGateForTests()
  _setActivityStartSpacingMsForTests(ACTIVITY_START_SPACING_DEFAULT_MS)
  randSpy = vi.spyOn(Math, 'random').mockReturnValue(0)
})
afterEach(() => {
  randSpy?.mockRestore()
  randSpy = null
  _resetEbirdGateForTests()
  _setActivityStartSpacingMsForTests(ACTIVITY_START_SPACING_DEFAULT_MS)
  vi.useRealTimers()
})

async function drain(ms: number): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms)
}

describe('serialized spaced starts', () => {
  it('concurrent gated calls start at least the spacing apart, never a burst', async () => {
    const starts: number[] = []
    const call = () => gatedEbirdCall(async () => { starts.push(Date.now()); return 'ok' })
    const all = Promise.all([call(), call(), call()])
    await drain(0)
    expect(starts.length).toBe(1) // only the first starts immediately
    await drain(ACTIVITY_START_SPACING_DEFAULT_MS * 2 + 10)
    await all
    expect(starts.length).toBe(3)
    expect(starts[1] - starts[0]).toBeGreaterThanOrEqual(ACTIVITY_START_SPACING_DEFAULT_MS)
    expect(starts[2] - starts[1]).toBeGreaterThanOrEqual(ACTIVITY_START_SPACING_DEFAULT_MS)
  })

  it('a failed call never wedges the chain — the next call still starts', async () => {
    // Handler attached before the timer drain so the rejection is never
    // unobserved (fake timers settle microtasks inside the drain).
    const boomSettled = gatedEbirdCall(async () => { throw new Error('backend down') })
      .then(() => 'resolved', (e: Error) => e.message)
    await drain(0)
    expect(await boomSettled).toBe('backend down')
    let ran = false
    const next = gatedEbirdCall(async () => { ran = true; return 1 })
    await drain(ACTIVITY_START_SPACING_DEFAULT_MS + 10)
    await next
    expect(ran).toBe(true)
  })
})

describe('the one shared cooldown', () => {
  it('a 429 with Retry-After opens the cooldown; the NEXT call (any surface) waits it out', async () => {
    let calls = 0
    const first = gatedEbirdCall(async () => {
      calls += 1
      if (calls === 1) throw rateLimit429(5)
      return 'recovered'
    })
    await drain(0)
    expect(calls).toBe(1)
    // Inside the server-named 5 s window: the gate's own retry has not started.
    await drain(4900)
    expect(calls).toBe(1)
    await drain(200)
    await expect(first).resolves.toBe('recovered')
    expect(calls).toBe(2)
  })

  it('a cooldown recorded by ONE surface gates a different caller (key-global, not per-surface)', async () => {
    // Surface A (e.g. the activity controller) records a 429 via the note API.
    noteEbirdRateLimit(rateLimit429(10), Date.now(), 0)
    expect(ebirdWaitMs(Date.now())).toBeGreaterThan(9000)
    // Surface B's gated single-shot lookup must not start inside the window.
    let started = false
    const call = gatedEbirdCall(async () => { started = true; return 'ok' })
    await drain(9900)
    expect(started).toBe(false)
    await drain(200)
    await call
    expect(started).toBe(true)
  })

  it('bounded retries: persistent 429s throw after the contract total, on the exponential ladder', async () => {
    const starts: number[] = []
    const always429 = gatedEbirdCall(async () => { starts.push(Date.now()); throw rateLimit429(null) })
    const settled = always429.then(() => 'resolved', () => 'rejected')
    await drain(0)
    // Ladder with random=0: waves at 2 s then 4 s → starts at 0, 2000, 6000.
    await drain(7000)
    expect(await settled).toBe('rejected')
    expect(starts.length).toBe(1 + ACTIVITY_RATE_LIMIT_RETRIES)
    expect(starts.map(t => t - starts[0])).toEqual([0, 2000, 6000])
  })

  it('a post-cooldown success resets the wave ladder (the next 429 backs off from the base again)', async () => {
    noteEbirdRateLimit(rateLimit429(null), Date.now(), 0) // wave 1 → 2 s
    expect(ebirdGateState().cooldownWave).toBe(1)
    await drain(2100)
    noteEbirdSuccess(Date.now())
    expect(ebirdGateState().cooldownWave).toBe(0)
    const before = Date.now()
    noteEbirdRateLimit(rateLimit429(null), before, 0)
    expect(ebirdGateState().cooldownUntil - before).toBe(2000) // base, not 4 s
  })

  it('a success still inside the window proves nothing (wave not reset)', () => {
    noteEbirdRateLimit(rateLimit429(30), Date.now(), 0)
    noteEbirdSuccess(Date.now())
    expect(ebirdGateState().cooldownWave).toBe(1)
  })

  it('simultaneous 429s count as one wave (only a 429 outside an active cooldown advances the ladder)', () => {
    const now = Date.now()
    noteEbirdRateLimit(rateLimit429(null), now, 0)
    noteEbirdRateLimit(rateLimit429(null), now + 1, 0)
    noteEbirdRateLimit(rateLimit429(null), now + 2, 0)
    expect(ebirdGateState().cooldownWave).toBe(1)
  })

  it('a non-429 error throws through unchanged with no cooldown opened', async () => {
    const err = Object.assign(new Error('Transport error: 502'), { status: 502 })
    const call = gatedEbirdCall(async () => { throw err })
    const settled = call.then(() => null, (e: unknown) => e)
    await drain(0)
    expect(await settled).toBe(err)
    expect(ebirdGateState().cooldownUntil).toBe(0)
  })
})

describe('the monotonic wave counter (observation only — project-checker-rate-limiting)', () => {
  it('advances in lockstep with the policy ladder but is NOT reset by a post-cooldown success', async () => {
    // The whole point of the second counter: the policy ladder deliberately
    // resets so single-shot lookups recover fast, while a pass differencing
    // waveCount over its own window still sees every wave of the session.
    noteEbirdRateLimit(rateLimit429(null), Date.now(), 0)
    expect(ebirdGateState().cooldownWave).toBe(1)
    expect(ebirdGateState().waveCount).toBe(1)
    await drain(2100)
    noteEbirdSuccess(Date.now())
    expect(ebirdGateState().cooldownWave).toBe(0)   // policy: reset
    expect(ebirdGateState().waveCount).toBe(1)      // observation: monotonic
    noteEbirdRateLimit(rateLimit429(null), Date.now(), 0)
    expect(ebirdGateState().waveCount).toBe(2)
  })

  it('a burst inside an active cooldown is still ONE wave on the counter', () => {
    const now = Date.now()
    noteEbirdRateLimit(rateLimit429(null), now, 0)
    noteEbirdRateLimit(rateLimit429(null), now + 1, 0)
    noteEbirdRateLimit(rateLimit429(null), now + 2, 0)
    expect(ebirdGateState().waveCount).toBe(1)
  })

  it('observation only: the counter never feeds the delay, so single-shot cooldowns are untouched', async () => {
    // Ten historical waves on the monotonic counter, ladder reset by a
    // post-cooldown success: the next 429 still backs off from the BASE. This
    // is the "never leaks into Map Explorer lookups" guarantee at the gate.
    for (let i = 0; i < 10; i += 1) {
      noteEbirdRateLimit(rateLimit429(null), Date.now(), 0)
      await drain(ACTIVITY_COOLDOWN_MAX_MS + 100)
      noteEbirdSuccess(Date.now())
    }
    expect(ebirdGateState().waveCount).toBe(10)
    const before = Date.now()
    noteEbirdRateLimit(rateLimit429(null), before, 0)
    expect(ebirdGateState().cooldownUntil - before).toBe(2000) // base, not a rung 11 figure
  })
})

describe('the note/read API the activity controller shares', () => {
  it('noteEbirdStart is what spaces the next start (ebirdWaitMs reads it live)', () => {
    const now = Date.now()
    expect(ebirdWaitMs(now)).toBe(0)
    noteEbirdStart(now)
    expect(ebirdWaitMs(now)).toBe(ACTIVITY_START_SPACING_DEFAULT_MS)
    expect(ebirdWaitMs(now + ACTIVITY_START_SPACING_DEFAULT_MS)).toBe(0)
  })

  it('the reset seam clears state and the start queue', async () => {
    noteEbirdRateLimit(rateLimit429(30), Date.now(), 0)
    noteEbirdStart(Date.now())
    _resetEbirdGateForTests()
    expect(ebirdGateState()).toEqual({ cooldownUntil: 0, cooldownWave: 0, waveCount: 0, lastStart: 0 })
    let ran = false
    const call = gatedEbirdCall(async () => { ran = true; return 1 })
    await drain(0)
    await call
    expect(ran).toBe(true)
  })
})

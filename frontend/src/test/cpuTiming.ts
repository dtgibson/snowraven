/// <reference types="node" />
// CPU-time timing for the same-run speed checks (steady-speed-check-tests).
//
// The speed checks in this repo are SAME-RUN QUOTIENTS: two sizes of one input
// timed in one process and compared against a limit that sits between linear
// growth and the defect the row exists for (testing.md v1.0.5, v1.0.21). This
// module changes the CLOCK those quotients are read with, never the limit or
// the inputs.
//
// WHY NOT THE WALL CLOCK. On a machine running more work than it has cores, a
// timed sample also counts the time other processes ran while this one waited
// for a core. A longer sample waits more often, so best-of-N finds a clean
// short sample far more often than a clean long one, and the LARGE leg of a
// quotient is inflated more than the small one. That is a systematic excess,
// not noise, and more rounds do not remove it. Measured on the SAME samples
// with two full frontend suites looping alongside (load about 85 on the 8-core
// dev Mac), the wall clock read the bar chart's 512/513 names quotient at up to
// 5.44 over twelve trials where this clock read at most 2.65 (limit 3.2).
//
// THE CLOCK IS THIS PROCESS'S CPU TIME, `process.cpuUsage()`, user plus
// system, summed over its threads. It does not advance while the process waits
// for a core. Vitest's forks pool runs each test file in its own worker
// process (checked: three files, three pids) and the rows that use this are
// synchronous, so what it counts is the code under test plus V8's own helper
// threads. It reports microseconds, and it exists on CI's Node 20 (checked on
// 20.20.2). The main thread's own CPU time was tried as well and was no
// steadier on the same samples; it does not exist on Node 20 either.
//
// WHAT IT DOES NOT REMOVE, so a limit still needs margin on both sides. A
// sample that runs on one of the dev Mac's efficiency cores costs more CPU time
// than the same work on a performance core; best of `rounds`, interleaved,
// absorbs that. The collector it does not: a call whose output the collector
// must keep alive pays a collection cost that depends on the heap's state when
// the call starts, and V8's parallel collector threads count toward this clock
// as well. Where that cost grows faster than the input, the quotient spreads
// under every clock; `parseBarChart.test.ts`'s 512/513 names row is the one
// known case and says what would retire it.
//
// THE SHAPE, the same for every row that uses it:
//  1. every leg runs once first, untimed as far as the result goes, so the
//     compiler's first tier-up lands outside every sample; a leg whose first
//     call is already past `minSampleMs` gets a batch of 1;
//  2. a sample is `batch` back-to-back calls lasting at least `minSampleMs`,
//     sized per leg from a second, warm call (0 times one call per sample, for
//     a row whose single call is already milliseconds long or whose inputs
//     must be distinct per call);
//  3. the legs are INTERLEAVED, the starting leg rotating each round, so a
//     burst of load lands on every leg rather than on whichever one happened
//     to be running;
//  4. the result is each leg's best sample over `rounds`, PER CALL.
// A quadratic regression's single call is already past `minSampleMs`, so it
// gets a batch of 1 and costs what it did before this module existed.
//
// THE CLOCK IS CHECKED, NOT TRUSTED (security review F1). A clock that stops
// advancing, or reads far too slowly, turns every quotient here into 0 over a
// floor and passes every row vacuously; one that reads far too fast does the
// same through the floors the other way. So each leg's best CPU time is held
// against its best WALL time, which bounds it from both sides whatever the
// load: it can be no more than the wall time times the cores the process can
// run on, and it cannot fall below 1/200 of it for any leg whose best wall
// sample is at least 50 us. Measured over the four timing files with two full
// suites looping alongside (load 40 to 79), every real leg read between 0.42
// and 1.16 of its wall time; a clock scaled 1,000 times too slow reads 1/1000
// or less. A clock that reads zero over a warm call of a millisecond or more,
// or under 1/200 of a warm call of a second or more, throws at once, before
// any batching. Either failure throws, loudly.

import { availableParallelism } from 'node:os'

/** This process's CPU time in milliseconds: user plus system, every thread. */
export function cpuMs(): number {
  const u = process.cpuUsage()
  return (u.user + u.system) / 1000
}

export interface PerCallOptions {
  /** Interleaved rounds; each leg's best sample is kept. Default 7. */
  rounds?: number
  /** A sample repeats the call until it lasts at least this long, in CPU ms.
   *  0 times one call per sample. Default 20. */
  minSampleMs?: number
  /** The most calls one sample may batch; bounds a clock that reads 0. */
  maxBatch?: number
}

export interface PerCallTimes {
  /** Each leg's best per-call CPU time, in milliseconds, in the legs' order. */
  perCall: number[]
  /** Calls per timed sample, per leg. */
  batch: number[]
  /** How many times each leg was called in all, first calls included. */
  calls: number[]
}

/**
 * Times each leg (a function that performs ONE call) as described in this
 * module's header and returns its best per-call CPU time. A leg that must see
 * a distinct input on every call can hand one out from its own closure: with
 * `minSampleMs: 0` it is called exactly `rounds + 1` times.
 */
export function bestPerCallCpuMs(legs: ReadonlyArray<() => unknown>, options: PerCallOptions = {}): PerCallTimes {
  const { rounds = 7, minSampleMs = 20, maxBatch = 64 } = options
  const calls = legs.map(() => 0)
  const batch = legs.map((leg, i) => {
    let t0 = cpuMs()
    leg()
    calls[i] += 1
    const first = cpuMs() - t0
    if (minSampleMs <= 0 || first >= minSampleMs) return 1
    const w0 = performance.now()
    t0 = cpuMs()
    leg()
    calls[i] += 1
    const warm = cpuMs() - t0
    const warmWall = performance.now() - w0
    // Fail before batching: zero CPU over a millisecond of wall time, or under
    // 1/200 of a full second of it, is a stalled or far-too-slow clock (a
    // single call can wait a long time for a core, but not a second at 1/200).
    if ((warmWall >= 1 && warm <= 0) || (warmWall >= 1_000 && warm < warmWall / 200)) {
      throw new Error(`cpuTiming: leg ${i}'s warm call took ${warmWall.toFixed(2)} ms of wall time and ${warm.toFixed(4)} ms of CPU time; the CPU clock is not advancing, or reads far too slowly`)
    }
    return Math.max(1, Math.min(maxBatch, Math.ceil(minSampleMs / Math.max(warm, 0.001))))
  })
  const perCall = legs.map(() => Number.POSITIVE_INFINITY)
  const perCallWall = legs.map(() => Number.POSITIVE_INFINITY)
  for (let r = 0; r < rounds; r++) {
    for (let k = 0; k < legs.length; k++) {
      const i = (r + k) % legs.length
      const leg = legs[i]
      const w0 = performance.now()
      const t0 = cpuMs()
      for (let b = 0; b < batch[i]; b++) leg()
      const ms = (cpuMs() - t0) / batch[i]
      const wallMs = (performance.now() - w0) / batch[i]
      calls[i] += batch[i]
      if (ms < perCall[i]) perCall[i] = ms
      if (wallMs < perCallWall[i]) perCallWall[i] = wallMs
    }
  }
  assertPlausibleClock(perCall, perCallWall)
  return { perCall, batch, calls }
}

/** Throws when a leg's best CPU time is implausible against its best wall
 *  time (this module's header says why each bound holds under any load). */
export function assertPlausibleClock(perCall: readonly number[], perCallWall: readonly number[]): void {
  const cores = availableParallelism()
  for (let i = 0; i < perCall.length; i++) {
    const cpu = perCall[i]
    const wall = perCallWall[i]
    if (!Number.isFinite(cpu) || !Number.isFinite(wall)) {
      throw new Error(`cpuTiming: leg ${i} read ${cpu} ms of CPU and ${wall} ms of wall time; the clock is not usable`)
    }
    if (cpu > wall * (cores + 1) + 0.01) {
      throw new Error(`cpuTiming: leg ${i} read ${cpu.toFixed(4)} ms of CPU in ${wall.toFixed(4)} ms of wall time, more than ${cores} cores can do; the CPU clock reads far too fast`)
    }
    if (wall >= 0.05 && cpu < wall / 200) {
      throw new Error(`cpuTiming: leg ${i} read ${cpu.toFixed(4)} ms of CPU in ${wall.toFixed(4)} ms of wall time; the CPU clock is not advancing, or reads far too slowly`)
    }
  }
}

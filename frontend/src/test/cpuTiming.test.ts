/// <reference types="node" />
// The CPU-time helper the speed checks share (steady-speed-check-tests). Each
// row pins one property the rows rely on, so a helper that quietly stopped
// having it fails here rather than as a flake somewhere else.
import { describe, it, expect } from 'vitest'
import { assertPlausibleClock, bestPerCallCpuMs, cpuMs } from './cpuTiming'

/** Runs until this process has used `ms` of CPU, or until 5 s of wall time
 *  have passed, whichever is first. The wall cap is what makes a stalled or
 *  mis-scaled clock a red row rather than a hung file: a testTimeout cannot
 *  interrupt this loop (testing.md v1.0.33). Returns the CPU and wall used. */
const BURN_WALL_CAP_MS = 5_000
const burn = (ms: number): { cpu: number; wall: number } => {
  const c0 = cpuMs()
  const w0 = performance.now()
  const end = c0 + ms
  const wallEnd = w0 + BURN_WALL_CAP_MS
  while (cpuMs() < end && performance.now() < wallEnd) { /* spin */ }
  return { cpu: cpuMs() - c0, wall: performance.now() - w0 }
}

describe('cpuMs', () => {
  it('advances at a plausible rate: 25 ms of spinning reads as at least 25 ms of CPU, and no more than four times its wall time', () => {
    // Stalled, the burn stops at its wall cap and reads far under 25 ms; scaled
    // too slow, the same; scaled too fast, it reads 25 ms in a sliver of wall
    // time. A loaded machine only stretches the wall time, which both bounds allow.
    const { cpu, wall } = burn(25)
    expect(cpu, `cpu ${cpu.toFixed(3)} ms in ${wall.toFixed(3)} ms of wall time`).toBeGreaterThanOrEqual(25)
    expect(wall, `cpu ${cpu.toFixed(3)} ms in ${wall.toFixed(3)} ms of wall time`).toBeGreaterThanOrEqual(cpu / 4)
  })

  it('does not count time the process spends off the CPU, which is why it replaces the wall clock', () => {
    // Atomics.wait blocks this thread without running it: the wall clock
    // counts the 60 ms, the CPU clock must not.
    const cell = new Int32Array(new SharedArrayBuffer(4))
    const w0 = performance.now()
    const c0 = cpuMs()
    Atomics.wait(cell, 0, 0, 60)
    const cpu = cpuMs() - c0
    const wall = performance.now() - w0
    expect(wall).toBeGreaterThanOrEqual(55)
    expect(cpu, `wall ${wall.toFixed(2)} ms, cpu ${cpu.toFixed(2)} ms`).toBeLessThan(wall / 2)
  })
})

describe('bestPerCallCpuMs', () => {
  it('calls every leg once first, then interleaves them with a rotating start', () => {
    const order: string[] = []
    const { calls, batch } = bestPerCallCpuMs(
      [() => order.push('a'), () => order.push('b'), () => order.push('c')],
      { rounds: 3, minSampleMs: 0 },
    )
    expect(order).toEqual(['a', 'b', 'c', 'a', 'b', 'c', 'b', 'c', 'a', 'c', 'a', 'b'])
    // Unbatched, a leg handing out distinct inputs needs exactly rounds + 1.
    expect(calls).toEqual([4, 4, 4])
    expect(batch).toEqual([1, 1, 1])
  })

  it('batches a short leg up to minSampleMs, leaves a long one at 1, and reports PER CALL', () => {
    const { perCall, batch, calls } = bestPerCallCpuMs([() => burn(1.5), () => burn(25)], { rounds: 3, minSampleMs: 20 })
    // 20 ms of 1.5 ms calls is 14 (13.3 rounded up); a sizing call that read
    // long gives fewer. 1.5 rather than 1 because 20 / 1 sits exactly on the
    // rounding edge: two microsecond readings 1 ms apart can subtract to
    // 0.9999999999999 in floating point, which gave 21 in 2 of 20 runs.
    expect(batch[0]).toBeGreaterThanOrEqual(7)
    expect(batch[0]).toBeLessThanOrEqual(14)
    // Past minSampleMs on its first call: one call per sample, no sizing call.
    expect(batch[1]).toBe(1)
    expect(calls).toEqual([2 + 3 * batch[0], 1 + 3])
    // Per call, not per sample: about 1.5 ms, never the batch's 20.
    expect(perCall[0]).toBeGreaterThanOrEqual(1.4)
    expect(perCall[0]).toBeLessThan(5)
    expect(perCall[1]).toBeGreaterThanOrEqual(24.9)
  })
})

describe('the helper refuses an implausible clock rather than returning a vacuous quotient (security review F1)', () => {
  it('holds each leg\'s best CPU time against its best wall time, from both sides', () => {
    // A stalled clock, one 1,000 times too slow, and one 1,000 times too fast.
    expect(() => assertPlausibleClock([0], [10])).toThrow(/not advancing/)
    expect(() => assertPlausibleClock([0.01], [10])).toThrow(/far too slowly/)
    expect(() => assertPlausibleClock([10_000], [10])).toThrow(/far too fast/)
    expect(() => assertPlausibleClock([Number.POSITIVE_INFINITY], [10])).toThrow(/not usable/)
    // What a heavily loaded machine produces (a twentieth of a core), and a
    // leg too cheap for its wall time to say anything, both pass.
    expect(() => assertPlausibleClock([1, 70], [20, 1_400])).not.toThrow()
    expect(() => assertPlausibleClock([0], [0.01])).not.toThrow()
  })
})

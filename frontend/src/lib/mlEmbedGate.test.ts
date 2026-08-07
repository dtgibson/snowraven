// The out-of-band probe behind the Macaulay Library embed gate. The two
// properties that matter are that it FAILS OPEN (a probe that cannot run never
// hides media that would have played) and that it is single-flight (one call per
// session no matter how many tiles mount).
import { describe, it, expect, beforeEach, vi } from 'vitest'

const get = vi.fn()
vi.mock('./transport', () => ({ transport: { get: (...args: unknown[]) => get(...args) } }))

import { probeEmbedGate, getEmbedGateState, resetEmbedGateForTests } from './mlEmbedGate'

beforeEach(() => {
  resetEmbedGateForTests()
  get.mockReset()
})

describe('probeEmbedGate', () => {
  it('asks the transport for the embed status with the catalog id', async () => {
    get.mockResolvedValue({ gated: false })
    await probeEmbedGate('662004247')
    expect(get).toHaveBeenCalledTimes(1)
    expect(get).toHaveBeenCalledWith('/media/embed-status', { catalogId: '662004247' })
  })

  it('records a gated endpoint', async () => {
    get.mockResolvedValue({ gated: true })
    await probeEmbedGate('123')
    expect(getEmbedGateState()).toBe('gated')
  })

  it('records an open endpoint', async () => {
    get.mockResolvedValue({ gated: false })
    await probeEmbedGate('123')
    expect(getEmbedGateState()).toBe('open')
  })

  it('is single-flight: many tiles mounting probe the network once', async () => {
    let resolveIt: (v: { gated: boolean }) => void = () => {}
    get.mockReturnValue(new Promise((r) => { resolveIt = r }))

    const all = [probeEmbedGate('1'), probeEmbedGate('2'), probeEmbedGate('3')]
    resolveIt({ gated: true })
    await Promise.all(all)

    expect(get).toHaveBeenCalledTimes(1)
    expect(getEmbedGateState()).toBe('gated')
  })

  it('does not re-probe once resolved', async () => {
    get.mockResolvedValue({ gated: true })
    await probeEmbedGate('123')
    await probeEmbedGate('123')
    expect(get).toHaveBeenCalledTimes(1)
  })

  it('makes no call for an id that is not digits-only, and stays unknown', async () => {
    await probeEmbedGate('')
    await probeEmbedGate('not-a-number')
    await probeEmbedGate('12x')
    expect(get).not.toHaveBeenCalled()
    expect(getEmbedGateState()).toBe('unknown')
  })

  // The load-bearing property: a probe that cannot run must never hide media.
  // An implementation that resolved a failure to `gated` (or left it `unknown`
  // and treated unknown as blocked) would blank every tile the moment the user
  // went offline or the probe route 500'd.
  it('fails OPEN when the probe errors, so the real embed still mounts', async () => {
    get.mockRejectedValue(new Error('offline'))
    await expect(probeEmbedGate('123')).resolves.toBeUndefined()
    expect(getEmbedGateState()).toBe('open')
  })
})

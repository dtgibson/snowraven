// The pending widget-link store and the controller that feeds it
// (ios-lifer-widgets FR-37; QA-37 "two links before mount apply only the last").
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { clearPendingLink, getPendingLink, setPendingLink, subscribePendingLink, _resetPendingLinkForTests } from './linkRequest'
import { acceptLink, startLinkController } from './linkController'

beforeEach(() => _resetPendingLinkForTests())

describe('linkRequest store', () => {
  it('last one wins, with a new id each time, even for identical values', () => {
    setPendingLink({ view: 'lifers', window: 'day' })
    setPendingLink({ view: 'targets', window: 'week', media: 'photo' })
    expect(getPendingLink()).toEqual({ view: 'targets', window: 'week', media: 'photo', id: 2 })
    setPendingLink({ view: 'targets', window: 'week', media: 'photo' })
    expect(getPendingLink()!.id).toBe(3)
  })

  it('clear by id never removes a newer link', () => {
    setPendingLink({ view: 'lifers', window: 'day' })
    const first = getPendingLink()!.id
    setPendingLink({ view: 'lifers', window: 'all' })
    clearPendingLink(first)
    expect(getPendingLink()).toEqual({ view: 'lifers', window: 'all', id: first + 1 })
    clearPendingLink(first + 1)
    expect(getPendingLink()).toBeNull()
  })

  it('notifies subscribers on set and on an effective clear only', () => {
    const cb = vi.fn()
    const off = subscribePendingLink(cb)
    setPendingLink({ view: 'lifers', window: 'day' })
    clearPendingLink(999)
    clearPendingLink(getPendingLink()!.id)
    expect(cb).toHaveBeenCalledTimes(2)
    off()
    setPendingLink({ view: 'lifers', window: 'day' })
    expect(cb).toHaveBeenCalledTimes(2)
  })
})

describe('link controller', () => {
  it('acceptLink publishes only an allowlisted URL and ignores everything else whole', () => {
    acceptLink('snowraven://map/lifers?window=day&x=1')
    acceptLink(null)
    expect(getPendingLink()).toBeNull()
    acceptLink('snowraven://map/targets?window=day&media=photo')
    expect(getPendingLink()).toEqual({ view: 'targets', window: 'day', media: 'photo', id: 1 })
  })

  it('arms the listener BEFORE the start-up take, and a cold-start URL is delivered by the take', async () => {
    const order: string[] = []
    let parked: string | null = 'snowraven://map/lifers?window=all'
    await startLinkController({
      onLinkParked: async () => { order.push('listen'); return () => {} },
      takePendingLink: async () => { order.push('take'); const p = parked; parked = null; return p },
    })
    expect(order).toEqual(['listen', 'take'])
    expect(getPendingLink()).toEqual({ view: 'lifers', window: 'all', id: 1 })
  })

  it('a poke answers with a take, and one parked URL is applied once however the paths interleave', async () => {
    let parked: string | null = null
    let poke: () => void = () => {}
    await startLinkController({
      onLinkParked: async cb => { poke = cb; return () => {} },
      takePendingLink: async () => { const p = parked; parked = null; return p },
    })
    parked = 'snowraven://map/targets?window=week&media=any'
    poke(); poke()
    await new Promise(r => setTimeout(r, 0))
    expect(getPendingLink()).toEqual({ view: 'targets', window: 'week', media: 'any', id: 1 })
  })

  it('a rejected take sets nothing and throws nothing', async () => {
    await expect(startLinkController({
      onLinkParked: async () => () => {},
      takePendingLink: async () => { throw new Error('native gone') },
    })).resolves.toBeTypeOf('function')
    expect(getPendingLink()).toBeNull()
  })
})

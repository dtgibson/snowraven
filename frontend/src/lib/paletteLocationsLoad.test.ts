// When Search derives its locations (visited-hotspots-in-search, schema 4.2 and
// 10.5): the first-frame gate, the one decision, and that neither new module can
// reach the network or the store.

/// <reference types="node" />
import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { row } from '../test/hotspotReportsRows'
import { afterFirstFrame, locationsAtAnswer, FIRST_FRAME_FALLBACK_MS } from './paletteLocationsLoad'
import { _locationSearchBuilds, peekLocationSearchIndex, locationSearchIndexFor } from './paletteLocations'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

/** A held frame: callbacks queue until `present()` runs them. */
function holdFrames() {
  const queue: FrameRequestCallback[] = []
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { queue.push(cb); return queue.length })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => { queue[id - 1] = () => {} })
  return {
    queue,
    present: () => { for (const cb of queue.splice(0)) cb(0) },
  }
}

describe('afterFirstFrame', () => {
  it('runs once, in a task AFTER the frame callback, and never again', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const frames = holdFrames()
    const run = vi.fn()
    afterFirstFrame(run)
    expect(run).not.toHaveBeenCalled()
    frames.present()
    // Not inside the frame callback itself: a task queued from it.
    expect(run).not.toHaveBeenCalled()
    vi.advanceTimersByTime(0)
    expect(run).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(FIRST_FRAME_FALLBACK_MS * 2)
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('falls back to a timer when no frame comes (a hidden window), once', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const frames = holdFrames()
    const run = vi.fn()
    afterFirstFrame(run)
    vi.advanceTimersByTime(FIRST_FRAME_FALLBACK_MS - 1)
    expect(run).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(run).toHaveBeenCalledTimes(1)
    frames.present()
    vi.advanceTimersByTime(10)
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('cancel stops both routes', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const frames = holdFrames()
    const run = vi.fn()
    const cancel = afterFirstFrame(run)
    cancel()
    frames.present()
    vi.advanceTimersByTime(FIRST_FRAME_FALLBACK_MS * 2)
    expect(run).not.toHaveBeenCalled()
  })
})

describe('locationsAtAnswer: the one decision', () => {
  const obsFor = (tag: string) => [row({ submissionId: `S${tag}`, locationId: `L${tag}`, location: `${tag} pond` })]

  it('a miss does NO work and returns undefined: the derivation is never run in the answer\'s task (E-08)', () => {
    const obs = obsFor('a')
    const before = _locationSearchBuilds()
    expect(locationsAtAnswer(obs)).toBeUndefined()
    expect(_locationSearchBuilds()).toBe(before)
    expect(peekLocationSearchIndex(obs)).toBeUndefined()
  })

  it('a memo hit is returned with no work, so later opens join in the species update', () => {
    const obs = obsFor('c')
    const ix = locationSearchIndexFor(obs)
    const before = _locationSearchBuilds()
    expect(locationsAtAnswer(obs)).toBe(ix)
    expect(_locationSearchBuilds()).toBe(before)
  })
})

describe('neither new module can make a request or touch the store (NFR-07, QA-46)', () => {
  const code = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map(l => l.replace(/(^|\s)\/\/.*$/, '$1')).join('\n')
  const imports = (rel: string) => [...code(rel).matchAll(/from\s+'([^']+)'/g)].map(m => m[1])
  const FORBIDDEN = (spec: string) => /(?:^|\/)(?:transport|storage)$/.test(spec) || spec.includes('/tauri/') || spec.startsWith('@tauri-apps')

  it.each(['./paletteLocations.ts', './paletteLocationsLoad.ts'])('%s imports no transport, storage or lib/tauri service, and calls no fetch', rel => {
    const specs = imports(rel)
    expect(specs.length, 'the import scan found imports').toBeGreaterThan(0)
    expect(specs.filter(FORBIDDEN)).toEqual([])
    expect(code(rel)).not.toMatch(/\bfetch\s*\(/)
  })

  it('GUARD THE GUARD: the same scan finds the edges in a module that has them', () => {
    expect(imports('../components/hotspotReports/HotspotReportsTab.tsx').filter(FORBIDDEN).length).toBeGreaterThan(0)
  })
})

// @vitest-environment jsdom
//
// "Checklists at hotspots" on the real Statistics tab (hotspot-share-stat). The
// hotspot module, its persisted store, the hook and the block are all REAL; only the
// transport (the one eBird route), the storage seam (an in-memory settings document)
// and the loaded backup are faked. So these rows see the composed seam: the build's
// two phases, the snapshot, the epoch and the memo, as the tab sees them.
//
// The fixture is ten checklists over two regions. US-MN: L1 three checklists and L2
// one (both public hotspots), L3 three (a personal location; one of them holds only a
// spuh). US-WI: L7 three checklists (a hotspot). So, fully answered, 7 of 10 are at
// hotspots.

import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest'
import { act, render, screen, cleanup, waitFor, fireEvent, within } from '@testing-library/react'
import type { ObservationEntry } from '../types'

let rafQueue: FrameRequestCallback[] = []
function flushRaf() {
  const batch = rafQueue
  rafQueue = []
  for (const cb of batch) cb(performance.now())
}

vi.mock('./SnowMap', () => ({
  SnowMap: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}))
vi.mock('react-map-gl/maplibre', () => ({
  Marker: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Popup: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  useMap: () => ({ current: undefined }),
}))

const H = vi.hoisted(() => ({
  obs: [] as ObservationEntry[],
  key: 'k' as string | null,
  settings: new Map<string, unknown>(),
  // Replaced per row: (region code, nth ask of it) -> the transport's answer.
  region: (() => Promise.resolve([])) as (code: string, nth: number) => Promise<unknown>,
  calls: [] as Array<{ path: string; region?: string }>,
}))

let n = 0
const row = (sub: string, loc: string, name: string, region: string, commonName = 'American Robin'): ObservationEntry => {
  n += 1
  return {
    submissionId: sub, commonName, scientificName: 'X y', date: `2023-0${(n % 9) + 1}-10`,
    location: name, locationId: loc, latitude: 44.9, longitude: -93.1,
    county: 'Hennepin', count: 1, breedingCode: null, speciesComments: '', catalogIds: [],
    stateProvince: region, duration: 30, distance: 1, protocol: 'Traveling', numObservers: 1,
  }
}
const TEN: ObservationEntry[] = [
  row('S1', 'L1', 'Lake Harriet', 'US-MN'), row('S2', 'L1', 'Lake Harriet', 'US-MN'), row('S3', 'L1', 'Lake Harriet', 'US-MN'),
  row('S4', 'L2', 'Crosby Farm', 'US-MN'),
  row('S5', 'L3', 'Back yard', 'US-MN'), row('S6', 'L3', 'Back yard', 'US-MN'), row('S7', 'L3', 'Back yard', 'US-MN', 'hawk sp.'),
  row('S8', 'L7', 'Crex Meadows', 'US-WI'), row('S9', 'L7', 'Crex Meadows', 'US-WI'), row('S10', 'L7', 'Crex Meadows', 'US-WI'),
]
const ANSWERS: Record<string, string[]> = { 'US-MN': ['L1', 'L2'], 'US-WI': ['L7'] }
const err = (status: number) => Object.assign(new Error(`Transport error: ${status}`), { status })

vi.mock('../lib/observationsCache', () => ({
  loadEbirdObservations: vi.fn(async () => ({ headerLine: '', observations: H.obs })),
}))
vi.mock('../lib/mlExportCache', () => ({ loadMLExport: vi.fn(async () => null) }))
vi.mock('../lib/storage', () => ({
  storage: {
    getFilesStatus: vi.fn(async () => ({ ebird: { filename: 'ebird.csv', uploadedAt: '2023-04-01' }, ml: null })),
    getSetting: async (k: string) => (H.settings.has(k) ? JSON.parse(JSON.stringify(H.settings.get(k))) as unknown : null),
    setSetting: async (k: string, v: unknown) => { H.settings.set(k, JSON.parse(JSON.stringify(v)) as unknown) },
    deleteSetting: async (k: string) => { H.settings.delete(k) },
    readFile: vi.fn(async () => null),
    getApiKey: vi.fn(async () => H.key),
  },
}))
vi.mock('../lib/transport', () => ({
  transport: {
    post: vi.fn(async (path: string) => (path === '/taxonomy/codes' ? { codes: {} } : {})),
    get: vi.fn(async (path: string, params?: { regionCode?: string }) => {
      H.calls.push({ path, region: params?.regionCode })
      if (path === '/map/hotspot-region') {
        const code = params?.regionCode ?? ''
        return H.region(code, H.calls.filter(c => c.region === code).length)
      }
      return { species: [] }
    }),
  },
}))
// The memo row counts calls into the REAL helper.
vi.mock('../lib/hotspotShare', async (importActual) => {
  const actual = await importActual<typeof import('../lib/hotspotShare')>()
  return { ...actual, computeHotspotShare: vi.fn(actual.computeHotspotShare) }
})

import { invalidateHotspotSet, hotspotRetryDelayMs } from '../lib/hotspotSet'
import { _resetHotspotRegionCacheForTests, HOTSPOT_REGIONS_STORE_KEY } from '../lib/hotspotRegionCache'
import { computeHotspotShare } from '../lib/hotspotShare'
import { hotspotLinkAriaLabel } from './HotspotLink'

let BirdingStats: typeof import('./BirdingStats').BirdingStats
const regionCalls = (code: string) => H.calls.filter(c => c.path === '/map/hotspot-region' && c.region === code).length
const seedStore = (entries: Record<string, string[]>) => H.settings.set(HOTSPOT_REGIONS_STORE_KEY, {
  version: 1,
  entries: Object.fromEntries(Object.entries(entries).map(([k, ids]) => [k, { ids, fetchedAt: Date.now() }])),
  order: Object.keys(entries),
})

beforeEach(async () => {
  rafQueue = []
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { rafQueue.push(cb); return rafQueue.length })
  vi.stubGlobal('cancelAnimationFrame', () => {})
  vi.stubGlobal('requestIdleCallback', () => 0)
  vi.stubGlobal('cancelIdleCallback', () => {})
  H.obs = TEN
  H.key = 'k'
  H.calls = []
  H.settings.clear()
  H.region = (code) => Promise.resolve(ANSWERS[code] ?? [])
  invalidateHotspotSet()
  _resetHotspotRegionCacheForTests()
  ;({ BirdingStats } = await import('./BirdingStats'))
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

afterAll(() => new Promise((r) => setTimeout(r, 120)))

async function renderComputed() {
  render(<BirdingStats onGoToSettings={() => {}} onGoToWeather={() => {}} onOpenSpecies={() => {}} />)
  await waitFor(() => expect(screen.getByText('Statistics')).toBeTruthy())
  await waitFor(() => expect(rafQueue.length).toBeGreaterThan(0))
  await act(async () => { flushRaf() })
  await act(async () => { flushRaf() })
}

/** The block's text (between its sub-label and its divider). */
function block(): string {
  const el = document.querySelector('.sr-hs-body')
  return el ? (el.textContent ?? '').replace(/\s+/g, ' ').trim() : ''
}
const SUBLABEL = 'Checklists at hotspots'

describe('placement and the denominator (QA-01 to QA-03)', () => {
  it('QA-01: the block sits in Geographic Stats above "Top locations by checklists", with a divider between', async () => {
    await renderComputed()
    await waitFor(() => expect(block()).toContain('7 of 10 checklists at hotspots'))
    const sub = screen.getByText(SUBLABEL)
    const body = sub.nextElementSibling as HTMLElement
    expect(body.classList.contains('sr-hs-body')).toBe(true)
    const divider = body.nextElementSibling as HTMLElement
    expect(divider.style.height).toBe('1px')
    expect((divider.nextElementSibling as HTMLElement).textContent).toBe('Top locations by checklists')
  })

  it('QA-02: an export with no checklists renders no block, no sub-label and no sentence', async () => {
    H.obs = []
    await renderComputed()
    expect(screen.queryByText(SUBLABEL)).toBeNull()
    expect(document.querySelector('.sr-hs-body')).toBeNull()
  })

  it('QA-03 / QA-32: the denominator counts the spuh-only checklist, and "Count all forms" neither moves it nor re-runs the pass', async () => {
    await renderComputed()
    await waitFor(() => expect(block()).toContain('of 10 checklists'))
    const calls = vi.mocked(computeHotspotShare).mock.calls.length
    const toggle = screen.getByRole('checkbox', { name: /Count all forms/ })
    await act(async () => { fireEvent.click(toggle) })
    await act(async () => { flushRaf() })
    expect(block()).toContain('of 10 checklists')
    expect(vi.mocked(computeHotspotShare).mock.calls.length).toBe(calls)
  })
})

describe('agreement with the links, and the request count (QA-07, QA-30, QA-36)', () => {
  it('QA-30 / QA-07: one request per region on an empty store, and every linked top location is a counted hotspot', async () => {
    await renderComputed()
    await waitFor(() => expect(block()).toContain('7 of 10 checklists at hotspots, 3 at personal locations.'))
    expect(regionCalls('US-MN')).toBe(1)
    expect(regionCalls('US-WI')).toBe(1)
    expect(new Set(H.calls.map(c => c.path))).toEqual(new Set(['/map/hotspot-region']))
    const hotspotIds = new Set(Object.values(ANSWERS).flat())
    const names: Record<string, string> = { L1: 'Lake Harriet', L2: 'Crosby Farm', L3: 'Back yard', L7: 'Crex Meadows' }
    for (const [loc, name] of Object.entries(names)) {
      const linked = screen.queryAllByRole('link', { name: hotspotLinkAriaLabel(name) }).length > 0
      expect(linked, name).toBe(hotspotIds.has(loc))
    }
    expect(block()).toContain('70%')
    expect(block()).toContain('30%')
  })

  it('QA-36: a later launch with every region stored issues zero requests and renders the bar and the links from the document', async () => {
    seedStore(ANSWERS)
    await renderComputed()
    await waitFor(() => expect(block()).toContain('7 of 10 checklists at hotspots'))
    expect(regionCalls('US-MN') + regionCalls('US-WI')).toBe(0)
    expect(screen.queryAllByRole('link', { name: hotspotLinkAriaLabel('Crex Meadows') }).length).toBeGreaterThan(0)
    expect(document.querySelector('.sr-hs-bar')).not.toBeNull()
  })
})

describe('the unresolved and no-key states (QA-12 to QA-18)', () => {
  it('QA-13 / QA-14: no key renders the no-key sentence and button, even with every region stored', async () => {
    H.key = null
    seedStore(ANSWERS)
    await renderComputed()
    await waitFor(() => expect(block()).toContain('cannot be counted without an eBird API key'))
    // Scoped to the block: the Projects section carries the same idiom below.
    expect(within(document.querySelector('.sr-hs-body') as HTMLElement).getByRole('button', { name: 'Add a key in Settings' })).toBeTruthy()
    expect(document.querySelector('.sr-hs-bar')).toBeNull()
    expect(block()).not.toMatch(/%|\d/)
  })

  it('QA-15: US-MN answered and US-WI still on its first lookup render the pending sentence with the counts so far', async () => {
    H.region = (code) => (code === 'US-WI' ? new Promise(() => {}) : Promise.resolve(ANSWERS[code]))
    seedStore({ 'US-MN': ANSWERS['US-MN'] })
    await renderComputed()
    await waitFor(() => expect(regionCalls('US-WI')).toBe(1))
    expect(block()).toContain('Checking which locations are public hotspots. 3 of 10 checklists not yet classified.')
    expect(block()).toContain('So far 4 at hotspots and 3 at personal locations.')
    expect(block()).not.toContain('%')
  })

  it('QA-17: offline, with US-WI never answered, renders the offline sentence and no bar', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false })
    try {
      H.region = (code) => (code === 'US-WI' ? Promise.reject(new TypeError('Failed to fetch')) : Promise.resolve(ANSWERS[code]))
      seedStore({ 'US-MN': ANSWERS['US-MN'] })
      await renderComputed()
      await waitFor(() => expect(block()).toContain('Offline, so 3 of 10 checklists could not be classified yet.'))
      expect(document.querySelector('.sr-hs-bar')).toBeNull()
    } finally {
      Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true })
    }
  })

  it('QA-18: online, US-WI failing its first lookup renders the unanswered sentence', async () => {
    H.region = (code) => (code === 'US-WI' ? Promise.reject(err(502)) : Promise.resolve(ANSWERS[code]))
    await renderComputed()
    await waitFor(() => expect(block()).toContain('eBird did not answer for 1 of your 2 regions, so 3 of 10 checklists could not be classified.'))
    expect(document.querySelector('.sr-hs-bar')).toBeNull()
  })

  it('QA-12: a re-ask round that answers US-WI turns the mounted block from pending to the bar with no user action', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'], shouldAdvanceTime: true })
    H.region = (code, nth) => (code === 'US-WI' && nth === 1 ? Promise.reject(err(429)) : Promise.resolve(ANSWERS[code]))
    await renderComputed()
    await waitFor(() => expect(block()).toContain('3 of 10 checklists not yet classified'))
    await act(async () => { await vi.advanceTimersByTimeAsync(hotspotRetryDelayMs(1) + 1_000) })
    await waitFor(() => expect(block()).toContain('7 of 10 checklists at hotspots'))
    expect(regionCalls('US-WI')).toBe(2)
    expect(document.querySelector('.sr-hs-bar')).not.toBeNull()
  })
})

// @vitest-environment jsdom
//
// The way into Hotspot Reports from Search (visited-hotspots-in-search FR-29 to
// FR-31, QA-29 to QA-31; schema 5.2 and 10.6): a single-use request carrying a
// Location ID, consumed once the tab's phase has settled for the CURRENT file.
//
// The mocks are HotspotReportsTab.test.tsx's, so the tab under test is the same
// one its own suite drives, and that suite's assertions are untouched (QA-32).
// A `Host` stands in for App: it holds the request and clears it when the tab
// says it was consumed, exactly as `clearRequestedLocation` does.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, fireEvent, waitFor, act } from '@testing-library/react'
import { useEffect, useState, useSyncExternalStore } from 'react'
import type { ObservationEntry } from '../../types'
import type { HotspotResolution } from '../../lib/hotspotSet'

const H = vi.hoisted(() => ({
  files: { ebird: { filename: 'MyEBirdData.csv' }, ml: null } as { ebird: unknown; ml: unknown },
  observations: [] as unknown[],
  post: vi.fn(),
  getFilesStatus: vi.fn(),
  getApiKey: vi.fn(),
  resolution: null as unknown,
  resListeners: new Set<() => void>(),
}))

vi.mock('../../lib/storage', () => ({
  storage: {
    getFilesStatus: H.getFilesStatus,
    getApiKey: H.getApiKey,
    getSetting: vi.fn(async () => null),
    setSetting: vi.fn(async () => {}),
    deleteSetting: vi.fn(async () => {}),
  },
}))
vi.mock('../../lib/observationsCache', () => ({
  loadEbirdObservations: vi.fn(async () => ({ headerLine: '', observations: H.observations })),
}))
vi.mock('../../lib/mlExportCache', () => ({ loadMLExport: vi.fn(async () => null) }))
vi.mock('../../lib/transport', () => ({ transport: { post: H.post, get: vi.fn() } }))
vi.mock('../../lib/exoticProvenanceCache', () => {
  // One stable snapshot: a store getter must return the same object until it changes.
  const snapshot = { checklists: new Set(), species: new Map(), excludedNames: [], exoticNames: null }
  return { getSnapshot: () => snapshot, subscribe: () => () => {}, loadSnapshot: vi.fn(async () => snapshot) }
})
vi.mock('../../lib/useHotspotSet', () => ({
  useHotspotSet: () => ({ set: new Set(), isHotspot: () => false }),
  useHotspotResolution: () => useSyncExternalStore(
    (l: () => void) => { H.resListeners.add(l); return () => { H.resListeners.delete(l) } },
    () => H.resolution, () => H.resolution,
  ),
}))
vi.mock('./HotspotReportMap', () => ({ HotspotReportMap: () => <div data-testid="map" /> }))
vi.mock('../../lib/hotspotReports', async importOriginal => {
  const m = await importOriginal<typeof import('../../lib/hotspotReports')>()
  return { ...m, buildLocationIndex: vi.fn(m.buildLocationIndex) }
})

import { HotspotReportsTab } from './HotspotReportsTab'
import { buildLocationIndex } from '../../lib/hotspotReports'
import { notifyFilesChanged } from '../../lib/filesChanged'
import { _locationSearchBuilds } from '../../lib/paletteLocations'
import { EBIRD_BACKUP_LOAD_ERROR } from '../setupCopy'
import { checklist } from '../../test/hotspotReportsRows'

const BASE: ObservationEntry[] = [
  ...checklist({ submissionId: 'S1', locationId: 'L100', location: 'Jamaica Bay', county: 'Queens', stateProvince: 'US-NY', species: ['Song Sparrow', 'Blue Jay'] }),
  ...checklist({ submissionId: 'S2', locationId: 'L100', location: 'Jamaica Bay', county: 'Queens', stateProvince: 'US-NY', date: '2025-05-01', species: ['Mute Swan'] }),
  ...checklist({ submissionId: 'S3', locationId: 'L200', location: 'Backyard', county: 'Kings', stateProvince: 'US-NY', species: ['Blue Jay'] }),
]

const consumed = vi.fn()
/** The Host's setter, handed out after its first commit. */
const hostSetter: { current: (id: string | undefined) => void } = { current: () => {} }
const setRequest = (id: string | undefined) => hostSetter.current(id)

function Host({ initial }: { initial?: string }) {
  const [req, setReq] = useState<string | undefined>(initial)
  useEffect(() => { hostSetter.current = setReq }, [])
  return (
    <HotspotReportsTab
      onGoToSettings={() => {}}
      requestedLocationId={req}
      onRequestedLocationConsumed={() => { consumed(req); setReq(undefined) }}
    />
  )
}

const pickerValue = (c: HTMLElement) => (c.querySelector('input[role="combobox"]') as HTMLInputElement | null)?.value
const reportName = (c: HTMLElement) => c.querySelector('.sr-hsr-report .sr-hsr-name')?.textContent ?? null
const live = (c: HTMLElement) => c.querySelector('[role="status"][aria-live="polite"]')
async function choose(container: HTMLElement, name: string) {
  const input = container.querySelector('input[role="combobox"]') as HTMLInputElement
  fireEvent.focus(input)
  const opt = [...container.querySelectorAll('[role="option"]')].find(o => o.querySelector('.sr-hsr-opt-name')?.textContent === name)!
  fireEvent.mouseDown(opt)
  await waitFor(() => expect(reportName(container)).toContain(name))
}

const animate = vi.fn()
const scrollIntoView = vi.fn()

beforeEach(() => {
  H.files = { ebird: { filename: 'MyEBirdData.csv' }, ml: null }
  H.observations = BASE
  H.resolution = { regions: [], byRegion: new Map(), set: new Set(), pending: 0, answered: 0 } as unknown as HotspotResolution
  H.resListeners.clear()
  H.getFilesStatus.mockReset()
  H.getFilesStatus.mockImplementation(async () => H.files)
  H.getApiKey.mockImplementation(async () => 'key')
  H.post.mockReset()
  H.post.mockImplementation(async () => ({ codes: {} }))
  vi.mocked(buildLocationIndex).mockClear()
  consumed.mockReset()
  animate.mockReset()
  scrollIntoView.mockReset()
  Object.defineProperty(Element.prototype, 'animate', { value: animate, configurable: true, writable: true })
  Object.defineProperty(Element.prototype, 'scrollIntoView', { value: scrollIntoView, configurable: true, writable: true })
})
afterEach(() => {
  cleanup()
  delete (Element.prototype as { animate?: unknown }).animate
  delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView
})

describe('a request from Search (FR-29, FR-30, QA-29, QA-30)', () => {
  it('is consumed exactly once after the tab is ready, and behaves as a picker selection', async () => {
    const { container } = render(<Host initial="L200" />)
    await waitFor(() => expect(reportName(container)).toContain('Backyard'))
    expect(consumed).toHaveBeenCalledTimes(1)
    expect(consumed).toHaveBeenCalledWith('L200')
    expect(pickerValue(container)).toBe('Backyard')
    expect(live(container)!.textContent).toMatch(/^Backyard: /)
    // The report's header is brought into view after the commit that drew it.
    const header = container.querySelector('.sr-hsr-report header')
    expect(scrollIntoView.mock.contexts).toContain(header)
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' })
  })

  it('is never re-applied: a later file epoch keeps whatever the user chose since', async () => {
    const { container } = render(<Host initial="L200" />)
    await waitFor(() => expect(reportName(container)).toContain('Backyard'))
    await choose(container, 'Jamaica Bay')
    await act(async () => { notifyFilesChanged() })
    await waitFor(() => expect(vi.mocked(buildLocationIndex)).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(reportName(container)).toContain('Jamaica Bay'))
    expect(consumed).toHaveBeenCalledTimes(1)
  })

  it('the later of two requests made before consumption wins', async () => {
    let release!: () => void
    H.getFilesStatus.mockImplementation(() => new Promise(r => { release = () => r(H.files) }))
    const { container } = render(<Host initial="L100" />)
    act(() => setRequest('L200'))
    await act(async () => { release() })
    await waitFor(() => expect(reportName(container)).toContain('Backyard'))
    expect(consumed).toHaveBeenCalledTimes(1)
    expect(consumed).toHaveBeenCalledWith('L200')
  })

  it('a request and a file change in one commit are consumed against the NEW file', async () => {
    const { container } = render(<Host />)
    await waitFor(() => expect(pickerValue(container)).toBe('Overview'))
    const NEXT = [
      ...BASE,
      ...checklist({ submissionId: 'S9', locationId: 'L900', location: 'New Marsh', county: 'Kings', stateProvince: 'US-NY', species: ['Sora'] }),
    ]
    await act(async () => { H.observations = NEXT; notifyFilesChanged(); setRequest('L900') })
    await waitFor(() => expect(reportName(container)).toContain('New Marsh'))
    expect(consumed).toHaveBeenCalledTimes(1)
  })

  it('choosing the location already shown announces it once more and changes nothing else', async () => {
    const { container } = render(<Host />)
    await waitFor(() => expect(pickerValue(container)).toBe('Overview'))
    await choose(container, 'Backyard')
    const animationsBefore = animate.mock.calls.length
    const nodeBefore = live(container)!.firstElementChild
    expect(nodeBefore).not.toBeNull()
    act(() => setRequest('L200'))
    await waitFor(() => expect(consumed).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(live(container)!.firstElementChild).not.toBe(nodeBefore))
    expect(live(container)!.textContent).toBe(nodeBefore!.textContent)
    expect(animate.mock.calls.length).toBe(animationsBefore)
    expect(reportName(container)).toContain('Backyard')
  })

  it('reads the tab\'s index and never builds one: one build across five requests', async () => {
    const before = _locationSearchBuilds()
    const { container } = render(<Host />)
    await waitFor(() => expect(pickerValue(container)).toBe('Overview'))
    for (const id of ['L100', 'L200', 'L100', 'L200', 'L100']) {
      act(() => setRequest(id))
      await waitFor(() => expect(consumed).toHaveBeenLastCalledWith(id))
    }
    expect(consumed).toHaveBeenCalledTimes(5)
    expect(vi.mocked(buildLocationIndex)).toHaveBeenCalledTimes(1)
    // And the tab does no Search location work of its own (gate R2).
    expect(_locationSearchBuilds()).toBe(before)
  })
})

describe('a request the tab cannot honour (FR-29 c, FR-31, QA-29, QA-31)', () => {
  it('an ID the file lacks shows the overview, with no message and no announcement, and is cleared', async () => {
    const { container } = render(<Host />)
    await waitFor(() => expect(pickerValue(container)).toBe('Overview'))
    await choose(container, 'Jamaica Bay')
    const nodeBefore = live(container)!.firstElementChild
    act(() => setRequest('L999'))
    await waitFor(() => expect(consumed).toHaveBeenCalledWith('L999'))
    await waitFor(() => expect(container.querySelector('.sr-hsr-report')).toBeNull())
    expect(pickerValue(container)).toBe('Overview')
    expect(live(container)!.firstElementChild).toBe(nodeBefore)
    expect(container.querySelector('[role="alert"]')!.textContent).toBe('')
  })

  it.each([
    ['no backup saved', () => { H.files = { ebird: null, ml: null } }, 'eBird Backup Required'],
    ['a backup that would not load', () => { H.getFilesStatus.mockImplementation(async () => { throw new Error('x') }) }, EBIRD_BACKUP_LOAD_ERROR],
  ])('is dropped silently when the tab settles on %s', async (_label, arrange, shown) => {
    arrange()
    const { container } = render(<Host initial="L200" />)
    await waitFor(() => expect(container.textContent).toContain(shown))
    await waitFor(() => expect(consumed).toHaveBeenCalledTimes(1))
    expect(container.textContent).not.toContain('L200')
    expect(container.querySelector('.sr-hsr-report')).toBeNull()
  })
})

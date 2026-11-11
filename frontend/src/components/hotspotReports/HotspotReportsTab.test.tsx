// @vitest-environment jsdom
//
// The Hotspot Reports tab (hotspot-reports). Component rows for what the pure
// suites cannot see: the phase gate (QA-07, QA-08), the ML states (QA-09), the
// kind following the shared Set (QA-17), choosing and the announcement (QA-24,
// QA-25), the overview and its count block (QA-26, QA-27), ranked-row presses
// and their focus (QA-30), the report's parts and jump row (QA-31, QA-77), the
// header link (QA-32), the map only with coordinates (QA-40), the selection
// following the files (QA-55), nothing persisted (QA-56), the codes batch
// (QA-63), hostile text at the surface (QA-67), and zero file-scaled rebuilds
// on a picker press or a provenance snapshot (QA-06, QA-35). jsdom has no
// layout, so nothing here claims a geometric fact; those are the live look's.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor, act } from '@testing-library/react'
import { useSyncExternalStore } from 'react'
import type { ObservationEntry } from '../../types'
import type { MLExportRow } from '../../lib/parseMLExport'
import type { HotspotResolution } from '../../lib/hotspotSet'

const H = vi.hoisted(() => ({
  files: { ebird: { filename: 'MyEBirdData.csv' }, ml: null } as { ebird: unknown; ml: unknown },
  observations: [] as unknown[],
  mlRows: null as unknown[] | null,
  post: vi.fn(),
  getFilesStatus: vi.fn(),
  getApiKey: vi.fn(),
  writes: [] as string[],
  snapshot: null as unknown,
  provListeners: new Set<() => void>(),
  resolution: null as unknown,
  resListeners: new Set<() => void>(),
}))

vi.mock('../../lib/storage', () => ({
  storage: {
    getFilesStatus: H.getFilesStatus,
    getApiKey: H.getApiKey,
    getSetting: vi.fn(async () => null),
    setSetting: vi.fn(async (k: string) => { H.writes.push(`set:${k}`) }),
    deleteSetting: vi.fn(async (k: string) => { H.writes.push(`delete:${k}`) }),
  },
}))
vi.mock('../../lib/observationsCache', () => ({
  loadEbirdObservations: vi.fn(async () => ({ headerLine: '', observations: H.observations })),
}))
vi.mock('../../lib/mlExportCache', () => ({
  loadMLExport: vi.fn(async () => (H.mlRows ? { entries: [], mediaMap: {}, rows: H.mlRows } : null)),
}))
vi.mock('../../lib/transport', () => ({ transport: { post: H.post, get: vi.fn() } }))
vi.mock('../../lib/exoticProvenanceCache', () => ({
  getSnapshot: () => H.snapshot,
  subscribe: (l: () => void) => { H.provListeners.add(l); return () => { H.provListeners.delete(l) } },
  loadSnapshot: vi.fn(async () => H.snapshot),
}))
vi.mock('../../lib/useHotspotSet', () => ({
  useHotspotSet: () => ({ set: new Set(), isHotspot: () => false }),
  useHotspotResolution: () => useSyncExternalStore(
    (l: () => void) => { H.resListeners.add(l); return () => { H.resListeners.delete(l) } },
    () => H.resolution, () => H.resolution,
  ),
}))
// The map is its own lazy chunk (maplibre); a stub stands in for it here.
vi.mock('./HotspotReportMap', () => ({
  HotspotReportMap: ({ name, lat, lng }: { name: string; lat: number; lng: number }) => (
    <div data-testid="map" role="group" aria-label={`Map showing ${name}`} data-at={`${lat},${lng}`} />
  ),
}))
// The two file-scaled derivations, wrapped so QA-06 and QA-35 can count them.
vi.mock('../../lib/hotspotReports', async importOriginal => {
  const m = await importOriginal<typeof import('../../lib/hotspotReports')>()
  return { ...m, buildLocationIndex: vi.fn(m.buildLocationIndex) }
})
vi.mock('../../lib/hotspotReportsLocation', async importOriginal => {
  const m = await importOriginal<typeof import('../../lib/hotspotReportsLocation')>()
  return { ...m, deriveLocationFacts: vi.fn(m.deriveLocationFacts) }
})

import { HotspotReportsTab } from './HotspotReportsTab'
import { buildLocationIndex } from '../../lib/hotspotReports'
import { deriveLocationFacts } from '../../lib/hotspotReportsLocation'
import { notifyFilesChanged } from '../../lib/filesChanged'
import { EBIRD_BACKUP_LOAD_ERROR } from '../setupCopy'
import { checklist, mlRow } from '../../test/hotspotReportsRows'
import { RULE_SENTENCE } from '../../lib/hotspotReportsCopy'

function res(set: string[], byRegion: Record<string, 'pending' | 'answered' | 'unanswered'>): HotspotResolution {
  return { regions: Object.keys(byRegion), byRegion: new Map(Object.entries(byRegion)), set: new Set(set), pending: 0, answered: 0 } as unknown as HotspotResolution
}

const BASE: ObservationEntry[] = [
  ...checklist({ submissionId: 'S1', locationId: 'L100', location: 'Jamaica Bay', county: 'Queens', stateProvince: 'US-NY', date: '2024-05-01', protocol: 'P22', species: ['Song Sparrow', 'Blue Jay'] }),
  ...checklist({ submissionId: 'S2', locationId: 'L100', location: 'Jamaica Bay', county: 'Queens', stateProvince: 'US-NY', date: '2025-05-01', protocol: 'P21', species: ['Song Sparrow', 'Mute Swan'] }),
  ...checklist({ submissionId: 'S3', locationId: 'L200', location: 'Backyard', county: 'Kings', stateProvince: 'US-NY', latitude: null, longitude: null, species: ['Blue Jay'] }),
]

beforeEach(() => {
  H.files = { ebird: { filename: 'MyEBirdData.csv' }, ml: null }
  H.observations = BASE
  H.mlRows = null
  H.writes = []
  H.snapshot = { checklists: new Set(), species: new Map(), excludedNames: [], exoticNames: null }
  H.provListeners.clear()
  H.resolution = res(['L100'], { 'US-NY': 'answered' })
  H.resListeners.clear()
  H.getFilesStatus.mockImplementation(async () => H.files)
  H.getApiKey.mockImplementation(async () => 'key')
  H.post.mockReset()
  H.post.mockImplementation(async () => ({ codes: { 'Song Sparrow': 'sonspa', 'Blue Jay': 'blujay' } }))
  vi.mocked(buildLocationIndex).mockClear()
  vi.mocked(deriveLocationFacts).mockClear()
})
afterEach(() => cleanup())

async function ready() {
  const r = render(<HotspotReportsTab onGoToSettings={() => {}} />)
  await waitFor(() => expect(r.container.querySelector('input[role="combobox"]')).not.toBeNull())
  return r
}
async function choose(container: HTMLElement, name: string) {
  const input = container.querySelector('input[role="combobox"]') as HTMLInputElement
  fireEvent.focus(input)
  const opt = [...container.querySelectorAll('[role="option"]')].find(o => o.querySelector('.sr-hsr-opt-name')?.textContent === name)!
  fireEvent.mouseDown(opt)
  await waitFor(() => expect(container.querySelector('.sr-hsr-report')).not.toBeNull())
}
const liveText = (c: HTMLElement) => c.querySelector('[role="status"][aria-live="polite"]')!.textContent

describe('phases (FR-07, FR-08, QA-07, QA-08)', () => {
  it('with no backup shows the setup guidance and no picker', async () => {
    H.files = { ebird: null, ml: null }
    const { container } = render(<HotspotReportsTab onGoToSettings={() => {}} />)
    await waitFor(() => expect(container.textContent).toContain('eBird Backup Required'))
    expect(container.querySelector('input[role="combobox"]')).toBeNull()
  })

  it('a rejected status lookup is the load failure in a region that existed empty before', async () => {
    let reject!: (e: Error) => void
    H.getFilesStatus.mockImplementation(() => new Promise((_, rj) => { reject = rj }))
    const { container } = render(<HotspotReportsTab onGoToSettings={() => {}} />)
    const region = container.querySelector('[role="alert"]')!
    expect(region).not.toBeNull()
    expect(region.textContent).toBe('')
    await act(async () => { reject(new Error('x')) })
    await waitFor(() => expect(container.querySelector('[role="alert"]')!.textContent).toBe(EBIRD_BACKUP_LOAD_ERROR))
    expect(container.querySelector('[role="alert"]')).toBe(region)
    expect(container.textContent).not.toContain('eBird Backup Required')
  })

  it('a backup with no location shows one sentence and a disabled picker, and nothing else', async () => {
    H.observations = checklist({ submissionId: 'S1', locationId: '', species: ['A'] })
    const { container } = await ready()
    expect(container.textContent).toContain('Your eBird backup has no locations to report on.')
    expect((container.querySelector('input[role="combobox"]') as HTMLInputElement).disabled).toBe(true)
    expect(container.querySelector('.sr-hsr-sum')).toBeNull()
    expect(container.querySelector('.sr-hsr-rank')).toBeNull()
  })
})

describe('the overview (FR-26 to FR-30, QA-26 to QA-30)', () => {
  it('holds the count block and the two lists, and no map', async () => {
    const { container } = await ready()
    expect(container.querySelector('.sr-hsr-total')!.textContent).toBe('2locations in your backup')
    expect(container.querySelectorAll('.sr-hsr-rank').length).toBe(2)
    expect(container.querySelector('[data-testid="map"]')).toBeNull()
    expect(container.textContent).toContain('1hotspot')
    expect(container.textContent).toContain('1personal location')
  })

  it('with no key and nothing classified draws no split and no zero, and offers the Settings link', async () => {
    H.getApiKey.mockImplementation(async () => '')
    H.resolution = res([], {})
    const { container } = await ready()
    await waitFor(() => expect(container.textContent).toContain('No eBird API key is saved'))
    expect(container.querySelector('.sr-hs-bar')).toBeNull()
    expect(container.textContent).toContain('Whether each is a hotspot or a personal location is not yet known.')
    expect(container.textContent).not.toMatch(/\b0\s*(hotspots|personal)/)
    const link = [...container.querySelectorAll('.sr-hsr-sum button')]
    expect(link.map(b => b.textContent)).toEqual(['Add a key in Settings'])
  })

  it('with some classified shows the known figures, the not-yet-known figure and one reason', async () => {
    H.observations = [...BASE, ...checklist({ submissionId: 'S9', locationId: 'L300', location: 'Truckee', stateProvince: 'US-NV', species: ['A'] })]
    H.resolution = res(['L100'], { 'US-NY': 'answered', 'US-NV': 'pending' })
    const { container } = await ready()
    expect(container.querySelector('.sr-hs-bar')).not.toBeNull()
    expect(container.querySelector('.sr-hsr-seg--unk')).not.toBeNull()
    expect(container.textContent).toContain('1 not yet known.')
    expect(container.textContent).toContain('Still checking which of your locations are eBird hotspots.')
    expect(container.querySelectorAll('.sr-hsr-sum button').length).toBe(0)
  })

  it('a ranked row is a Button whose name holds its name and figure; a press opens the report, focuses its heading and announces', async () => {
    const { container } = await ready()
    const btn = [...container.querySelectorAll('.sr-hsr-rankrow')][0] as HTMLButtonElement
    expect(btn.getAttribute('aria-label')).toBe('Jamaica Bay, Hotspot, Queens, NY, 2 checklists')
    fireEvent.click(btn)
    await waitFor(() => expect(document.activeElement?.classList.contains('sr-hsr-name')).toBe(true))
    expect(liveText(container)).toBe('Jamaica Bay: 3 species, 2 checklists.')
    expect((container.querySelector('input[role="combobox"]') as HTMLInputElement).getAttribute('aria-expanded')).toBe('false')
  })

  it('a ranked-row press, then a picker choice of the same place, replaces the live node each time (QA-25, two routes)', async () => {
    const { container } = await ready()
    fireEvent.click(container.querySelector('.sr-hsr-rankrow')!)
    await waitFor(() => expect(liveText(container)).toBe('Jamaica Bay: 3 species, 2 checklists.'))
    const first = container.querySelector('[aria-live="polite"] > span')
    expect(first).not.toBeNull()
    await choose(container, 'Jamaica Bay')
    const second = container.querySelector('[aria-live="polite"] > span')
    expect(second).not.toBe(first)
    expect(first!.isConnected).toBe(false)
    expect(second!.textContent).toBe('Jamaica Bay: 3 species, 2 checklists.')
    // The region itself is the one always-mounted node; only its child changed.
    expect(second!.parentElement).toBe(container.querySelector('[aria-live="polite"]'))
  })

  it('kinds follow the shared Set without a reload (QA-17)', async () => {
    H.resolution = res([], { 'US-NY': 'pending' })
    const { container } = await ready()
    expect(container.textContent).not.toContain('Personal location')
    await act(async () => { H.resolution = res(['L100'], { 'US-NY': 'answered' }); for (const l of H.resListeners) l() })
    expect(container.querySelector('.sr-hsr-rank .sr-hsr-kind')!.textContent).toBe('Hotspot')
  })
})

describe('the ranked lists in all three shapes: many, one, none (FR-30, ui.md v1.0.3)', () => {
  const soleTexts = (c: HTMLElement) => [...c.querySelectorAll('.sr-hsr-sole')].map(p => p.textContent)
  const headings = (c: HTMLElement) => [...c.querySelectorAll('.sr-hsr-rank h3')].map(h => h.textContent)

  it('many: ranked Button rows under both headings', async () => {
    const { container } = await ready()
    expect(headings(container)).toEqual(['Most checklists', 'Most species'])
    expect(container.querySelectorAll('.sr-hsr-rankrow').length).toBe(4)
    expect(soleTexts(container)).toEqual([])
  })

  it('one location: one sentence per list with a control that opens its report, and no rank', async () => {
    H.observations = [
      ...checklist({ submissionId: 'S1', locationId: 'L5', location: 'Home', species: ['Song Sparrow', 'Blue Jay'] }),
      ...checklist({ submissionId: 'S2', locationId: 'L5', location: 'Home', species: ['Song Sparrow'] }),
    ]
    const { container } = await ready()
    expect(headings(container)).toEqual(['Most checklists', 'Most species'])
    expect(soleTexts(container)).toEqual(['All 2 of your checklists are at Home.', 'All 2 species on your list were recorded at Home.'])
    expect(container.querySelector('.sr-hsr-rankrow')).toBeNull()
    expect(container.querySelector('.sr-hsr-rank-num')).toBeNull()
    fireEvent.click(container.querySelectorAll('.sr-hsr-sole button')[0])
    await waitFor(() => expect(document.activeElement?.classList.contains('sr-hsr-name')).toBe(true))
    expect(liveText(container)).toBe('Home: 2 species, 2 checklists.')
  })

  it('one location with one checklist and one species: the singular sentences', async () => {
    H.observations = checklist({ submissionId: 'S1', locationId: 'L5', location: 'Home', species: ['Song Sparrow'] })
    const { container } = await ready()
    expect(soleTexts(container)).toEqual(['Your 1 checklist is at Home.', 'Your 1 species was recorded at Home.'])
  })

  it('one location with no countable species: the checklists sentence, and no species block at all', async () => {
    H.observations = checklist({ submissionId: 'S1', locationId: 'L5', location: 'Home', species: ['gull sp.'] })
    const { container } = await ready()
    expect(headings(container)).toEqual(['Most checklists'])
    expect(soleTexts(container)).toEqual(['Your 1 checklist is at Home.'])
  })

  it('none: when no location has a countable species the species block renders nothing, heading included', async () => {
    H.observations = [
      ...checklist({ submissionId: 'S1', locationId: 'L5', location: 'Home', species: ['gull sp.'] }),
      ...checklist({ submissionId: 'S2', locationId: 'L6', location: 'Pond', species: ['duck sp.'] }),
    ]
    const { container } = await ready()
    expect(headings(container)).toEqual(['Most checklists'])
    expect(container.querySelectorAll('.sr-hsr-rankrow').length).toBe(2)
    expect(soleTexts(container)).toEqual([])
  })
})

describe('a report (FR-31 to FR-56, QA-24, QA-25, QA-31, QA-32, QA-40, QA-77)', () => {
  it('renders the parts in reading order, with both totals and the rule sentence in the header', async () => {
    const { container } = await ready()
    await choose(container, 'Jamaica Bay')
    const report = container.querySelector('.sr-hsr-report')!
    const order = [...report.querySelectorAll('.sr-hsr-hero, .sr-hsr-jump, section h4')].map(e => e.className === '' ? e.textContent : e.className.split(' ').pop())
    expect(order).toEqual(['sr-hsr-hero', 'sr-hsr-jump', 'Life list', 'Map', 'Checklists by protocol', 'Weather on your visits', 'Visits and media'])
    expect(report.querySelector('.sr-hsr-rule')!.textContent).toBe(RULE_SENTENCE)
    expect([...report.querySelectorAll('.sr-hsr-fig-value')].map(e => e.textContent)).toEqual(['3', '2'])
    expect(report.querySelectorAll('input, select').length).toBe(0)
  })

  it('choosing by pointer shows the name in the input, keeps focus in the picker, and announces once', async () => {
    const { container } = await ready()
    const input = container.querySelector('input[role="combobox"]') as HTMLInputElement
    input.focus()
    await choose(container, 'Jamaica Bay')
    expect(input.value).toBe('Jamaica Bay')
    expect(document.activeElement).toBe(input)
    expect(liveText(container)).toBe('Jamaica Bay: 3 species, 2 checklists.')
    const node = container.querySelector('[aria-live="polite"] > span')
    // The same location again: the region's child is replaced, so it is spoken again.
    await choose(container, 'Jamaica Bay')
    expect(container.querySelector('[aria-live="polite"] > span')).not.toBe(node)
  })

  it('the life list\'s column header row is visual only: aria-hidden, while each row carries its words (FR-37, QA-37)', async () => {
    const { container } = await ready()
    await choose(container, 'Jamaica Bay')
    const cols = container.querySelector('.sr-hsr-ll-cols')!
    expect(cols).not.toBeNull()
    expect(cols.getAttribute('aria-hidden')).toBe('true')
    // The words the header row would have supplied are in every row instead.
    const rows = [...container.querySelectorAll('.sr-hsr-ll-row')]
    expect(rows.length).toBe(3)
    for (const r of rows) {
      const sr = [...r.querySelectorAll('.sr-only')].map(e => e.textContent).join(' ')
      expect(sr).toContain('First recorded here')
      expect(sr).toMatch(/On \d+ of 2 checklists here\./)
    }
  })

  it('the jump row is a named nav of Link chips, one per section, and a chip moves focus to its heading', async () => {
    const { container } = await ready()
    await choose(container, 'Jamaica Bay')
    const nav = container.querySelector('nav[aria-label="Jump to section"]')!
    const chips = [...nav.querySelectorAll('a')]
    expect(chips.map(a => a.textContent)).toEqual(['Life list', 'Map', 'Protocols', 'Weather', 'Visits'])
    for (const a of chips) expect(a.getAttribute('tabindex')).toBe('0')
    Element.prototype.scrollIntoView = vi.fn()
    const before = container.querySelector('.sr-hsr-fig-value')!.textContent
    fireEvent.click(chips[3])
    expect(document.activeElement!.textContent).toBe('Weather on your visits')
    expect(container.querySelector('.sr-hsr-fig-value')!.textContent).toBe(before)
  })

  it('a hotspot\'s name links to eBird; a personal location\'s is text', async () => {
    const { container } = await ready()
    await choose(container, 'Jamaica Bay')
    expect(container.querySelector('.sr-hsr-name a')!.getAttribute('href')).toBe('https://ebird.org/hotspot/L100')
    await choose(container, 'Backyard')
    expect(container.querySelector('.sr-hsr-name a')).toBeNull()
    expect(container.querySelector('.sr-hsr-eyebrow')!.textContent).toBe('Personal location')
  })

  it('mounts the map only with coordinates, and the no-map sentence otherwise', async () => {
    const { container } = await ready()
    await choose(container, 'Jamaica Bay')
    await waitFor(() => expect(container.querySelector('[data-testid="map"]')).not.toBeNull())
    expect(container.querySelector('[data-testid="map"]')!.getAttribute('aria-label')).toBe('Map showing Jamaica Bay')
    await choose(container, 'Backyard')
    expect(container.querySelector('[data-testid="map"]')).toBeNull()
    expect(container.textContent).toContain('Your backup has no coordinates for this location, so there is no map.')
  })

  it('media counts follow the linked checklist, and an absent export never reads as zero (QA-09)', async () => {
    const { container, unmount } = await ready()
    await choose(container, 'Jamaica Bay')
    expect(container.textContent).toContain('Media counts need your Macaulay Library export.')
    unmount()
    H.files = { ebird: { filename: 'x' }, ml: { filename: 'y' } }
    H.mlRows = [mlRow({ checklistId: 'S1', format: 'Photo' }), mlRow({ checklistId: 'S3', format: 'Photo' })] as MLExportRow[]
    const r2 = await ready()
    await choose(r2.container, 'Jamaica Bay')
    expect(r2.container.querySelector('.sr-hsr-media')!.textContent).toContain('1 photo')
    expect(r2.container.querySelector('.sr-hsr-media')!.textContent).toContain('0 audio recordings')
  })
})

describe('the files, the requests and what is stored (QA-06, QA-35, QA-55, QA-56, QA-63)', () => {
  it('one index build per epoch and none per press; a snapshot change rebuilds nothing file-scaled', async () => {
    const { container } = await ready()
    expect(vi.mocked(buildLocationIndex)).toHaveBeenCalledTimes(1)
    await choose(container, 'Jamaica Bay')
    await choose(container, 'Backyard')
    expect(vi.mocked(buildLocationIndex)).toHaveBeenCalledTimes(1)
    const facts = vi.mocked(deriveLocationFacts).mock.calls.length
    await act(async () => {
      H.snapshot = { checklists: new Set(['S2']), species: new Map(), excludedNames: ['Mute Swan'], exoticNames: null }
      for (const l of H.provListeners) l()
    })
    expect(vi.mocked(buildLocationIndex)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(deriveLocationFacts).mock.calls.length).toBe(facts)
  })

  it('a replaced backup that still holds the id re-derives in place; one without it falls back silently', async () => {
    const { container } = await ready()
    await choose(container, 'Jamaica Bay')
    H.observations = [...BASE, ...checklist({ submissionId: 'S4', locationId: 'L100', location: 'Jamaica Bay', date: '2026-01-01', species: ['Wood Duck'] })]
    await act(async () => { notifyFilesChanged() })
    await waitFor(() => expect(container.querySelector('.sr-hsr-fig-value')?.textContent).toBe('4'))
    expect(vi.mocked(buildLocationIndex)).toHaveBeenCalledTimes(2)
    const live = liveText(container)
    H.observations = checklist({ submissionId: 'S5', locationId: 'L999', location: 'Elsewhere', species: ['A'] })
    await act(async () => { notifyFilesChanged() })
    await waitFor(() => expect(container.querySelector('.sr-hsr-sum')).not.toBeNull())
    expect(container.querySelector('.sr-hsr-report')).toBeNull()
    expect(liveText(container)).toBe(live)
    H.observations = BASE
    await act(async () => { notifyFilesChanged() })
    await waitFor(() => expect(container.querySelector('.sr-hsr-total')!.textContent).toBe('2locations in your backup'))
    expect(container.querySelector('.sr-hsr-report')).toBeNull()
  })

  it('posts the selected location\'s names once, never on the overview, and not again for the same names', async () => {
    const { container } = await ready()
    expect(H.post).not.toHaveBeenCalled()
    await choose(container, 'Jamaica Bay')
    await waitFor(() => expect(H.post).toHaveBeenCalledTimes(1))
    expect(H.post.mock.calls[0][0]).toBe('/taxonomy/codes')
    await choose(container, 'Backyard')
    await choose(container, 'Jamaica Bay')
    expect(H.post).toHaveBeenCalledTimes(1)
  })

  it('writes nothing through the storage seam across choosing and clearing', async () => {
    const { container } = await ready()
    await choose(container, 'Jamaica Bay')
    const input = container.querySelector('input[role="combobox"]') as HTMLInputElement
    fireEvent.focus(input)
    fireEvent.mouseDown(container.querySelector('[role="option"]')!)
    await waitFor(() => expect(container.querySelector('.sr-hsr-sum')).not.toBeNull())
    expect(H.writes).toEqual([])
    expect(liveText(container)).toBe('Overview: 2 locations.')
  })
})

describe('user-file text at the surface (QA-67)', () => {
  it('renders hostile names and ids as text and never in an id or IDREF', async () => {
    H.observations = [
      ...checklist({ submissionId: 'S1', locationId: 'constructor', location: '<script>x</script> "q"', species: ['__proto__'] }),
      ...checklist({ submissionId: 'S2', locationId: '__proto__', location: 'two words', species: ['A'] }),
    ]
    const { container } = await ready()
    expect(container.textContent).toContain('<script>x</script> "q"')
    const input = container.querySelector('input[role="combobox"]') as HTMLInputElement
    fireEvent.focus(input)
    for (const el of container.querySelectorAll('*')) {
      for (const attr of ['id', 'aria-activedescendant', 'aria-controls', 'aria-labelledby', 'href']) {
        const v = el.getAttribute(attr)
        if (v === null) continue
        for (const bad of ['script', 'constructor', '__proto__', 'two words', '"']) expect(v.includes(bad), `${attr}=${v}`).toBe(false)
      }
    }
    screen.getAllByText('<script>x</script> "q"')
  })
})

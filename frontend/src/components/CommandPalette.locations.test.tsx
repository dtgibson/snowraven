/// <reference types="node" />
// @vitest-environment jsdom
//
// Search's location results (visited-hotspots-in-search, schema 10.5): the third
// group, its rows and cap line, the sentences it shares with species, the route
// out, the highlight, the ids, the zero-request and zero-write cycle, and the
// laziness of the derivation (gate R2).
//
// As in CommandPalette.test.tsx, ONLY `lib/storage` (and, so a request would be
// an assertion rather than an inference, `lib/transport`) is mocked: the
// observations cache, the species index, the location index, the row builder
// and both resolvers are REAL. `lib/paletteLocations` is wrapped, not replaced:
// every call passes through to the real module unless a row arms the injected
// throw for FR-25.
//
// jsdom has no layout and no accessibility tree. The accessibility tree, the
// layout at 320px and 200% text and the cap lines' exposure are measured in
// Chromium and WebKit against the built app (decisions.md, the Engineer's
// measurements); what is asserted here is the DOM those engines read.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor, act, within } from '@testing-library/react'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const H = vi.hoisted(() => ({
  getFilesStatus: vi.fn(),
  readFile: vi.fn(),
  tGet: vi.fn(),
  tPost: vi.fn(),
  otherStorage: [] as string[],
  throwDerive: false,
  deriveCalls: 0,
}))
vi.mock('../lib/storage', () => ({
  // Any storage member other than the two reads is recorded, so a write (or any
  // other seam call) by Search is an assertion, not an inference.
  storage: new Proxy({}, {
    get(_t, prop) {
      if (prop === 'getFilesStatus') return H.getFilesStatus
      if (prop === 'readFile') return H.readFile
      if (typeof prop === 'string' && prop !== 'then') H.otherStorage.push(prop)
      return () => Promise.resolve(null)
    },
  }),
}))
vi.mock('../lib/transport', () => ({
  transport: { get: H.tGet, post: H.tPost },
  TransportError: class extends Error {},
}))
vi.mock('../lib/paletteLocations', async importOriginal => {
  const real = await importOriginal<typeof import('../lib/paletteLocations')>()
  return {
    ...real,
    locationSearchIndexFor: (obs: Parameters<typeof real.locationSearchIndexFor>[0]) => {
      // Every call is counted, memo hits included: a call in the species
      // answer's task is what E-08 forbids.
      H.deriveCalls += 1
      if (H.throwDerive) throw new Error('injected derivation failure')
      return real.locationSearchIndexFor(obs)
    },
  }
})

import { CommandPalette } from './CommandPalette'
import { clearEbirdObservationsCache } from '../lib/observationsCache'
import { _resetSpeciesIndexMemoForTests } from '../lib/speciesIndex'
import { notifyFilesChanged } from '../lib/filesChanged'
import { PALETTE_COPY, locationCapLine, speciesCapLine } from '../lib/paletteCopy'
import { SPECIES_CAP, type PaletteNavItem } from '../lib/paletteRows'
import { LOCATION_CAP, _locationSearchBuilds } from '../lib/paletteLocations'
import { FIRST_FRAME_FALLBACK_MS } from '../lib/paletteLocationsLoad'
import { UNNAMED_LOCATION } from '../lib/hotspotReportsCopy'
import { EBIRD_BACKUP_LOAD_ERROR } from './setupCopy'
import { FOCUSABLE_SELECTOR } from '../lib/useFocusTrap'
import { _resetAlphaCodesForTests, _setAlphaCodesImporterForTests, loadAlphaCodes } from '../lib/alphaCodesAsset'
import type { TabIcon } from '../lib/tabIcons'

function readSrc(rel: string): string {
  const path = resolve(process.cwd(), rel)
  if (!existsSync(path)) throw new Error(`could not locate ${rel} from ${process.cwd()}`)
  return readFileSync(path, 'utf8')
}

const icon = (() => <svg />) as unknown as TabIcon
const ITEMS: PaletteNavItem[] = [
  { id: 'weather', label: 'Weather', icon },
  { id: 'birding-stats', label: 'Statistics', icon },
  { id: 'map-explorer', label: 'Map Explorer', icon },
  { id: 'species-detail', label: 'Species Detail', icon },
  { id: 'hotspot-reports', label: 'Hotspot Reports', icon },
  { id: 'settings', label: 'Settings', icon },
]

const HEADER = 'Submission ID,Common Name,Scientific Name,Taxonomic Order,Count,State/Province,County,Location ID,Location,Date'
const esc = (v: string) => (/[",\n]/.test(v) ? '"' + v.split('"').join('""') + '"' : v)
type Line = [sub: string, common: string, sci: string, state: string, county: string, locId: string, loc: string]
const csv = (...lines: Line[]) => [HEADER, ...lines.map(([s, c, sci, st, co, id, loc], i) =>
  [s, c, sci, String(100 + i), '1', st, co, id, esc(loc), '2024-05-01'].map(v => (v === loc ? v : esc(v))).join(','))].join('\n')

const BACKUP = csv(
  ['S0', 'American Robin', 'Turdus migratorius', 'US-NY', 'Queens', 'L100', 'Jamaica Bay Wildlife Refuge'],
  ['S1', 'Marsh Wren', 'Cistothorus palustris', 'US-NY', 'Kings', 'L200', 'Prospect Park'],
  ['S2', "Anna's Hummingbird", 'Calypte anna', 'US-CA', 'Santa Clara', 'L300', 'Backyard'],
  ['S3', 'Bushtit', 'Psaltriparus minimus', 'US-CA', 'Santa Clara', 'L301', 'Backyard'],
  ['S4', 'Wrentit', 'Chamaea fasciata', 'US-CA', 'Marin', 'L400', 'Backyard'],
  ['S5', 'Song Sparrow', 'Melospiza melodia', 'US-NY', 'Kings', 'L500', ''],
  ['S6', 'Sora', 'Porzana carolina', 'US-CA', 'Contra Costa', 'L600', 'Marsh Creek Trail'],
  ['S7', 'Wood Duck', 'Aix sponsa', 'US-NY', 'Kings', 'L700', 'Camron Pond'],
)
const STORED = { ebird: { filename: 'MyEBirdData.csv', uploadedAt: '2024-06-01' }, ml: null }
const NO_FILES = { ebird: null, ml: null }

function open(onOpenLocation: ((id: string) => void) | null = vi.fn()) {
  const s = { onSelectTab: vi.fn(), onOpenSpecies: vi.fn(), onClose: vi.fn(), onOpenLocation }
  const view = render(
    <CommandPalette
      items={ITEMS}
      onSelectTab={s.onSelectTab}
      onOpenSpecies={s.onOpenSpecies}
      onClose={s.onClose}
      {...(onOpenLocation ? { onOpenLocation } : {})}
    />,
  )
  return { ...view, s }
}

const input = () => screen.getByRole('combobox') as HTMLInputElement
const listbox = () => screen.getByRole('listbox')
const type = (value: string) => fireEvent.change(input(), { target: { value } })
const key = (k: string) => fireEvent.keyDown(input(), { key: k })
const group = (label: string) => within(listbox()).queryByRole('group', { name: label })
const locationOptions = () => {
  const g = group(PALETTE_COPY.groupLocations)
  return g ? within(g).queryAllByRole('option') : []
}
const speciesOptions = () => {
  const g = group(PALETTE_COPY.groupSpecies)
  return g ? within(g).queryAllByRole('option') : []
}
const status = () => document.querySelector('[role="status"]') as HTMLElement

async function speciesReady() {
  await waitFor(() => expect(screen.queryByText(PALETTE_COPY.speciesLoading)).toBeNull())
}
async function locationsFor(q: string, n: number) {
  type(q)
  await waitFor(() => expect(locationOptions()).toHaveLength(n))
}

/**
 * Hold this mount's first frame: animation-frame callbacks queue, and the
 * fallback timer is captured instead of scheduled. `present()` runs the frame
 * and waits for the task it queues; `presentHoldingTask()` runs the frame but
 * holds that task and returns it, so a row can land something in between.
 */
function holdFirstFrame() {
  const frames: FrameRequestCallback[] = []
  const fallbacks: (() => void)[] = []
  const tasks: (() => void)[] = []
  let holdTasks = false
  const realSetTimeout = globalThis.setTimeout
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { frames.push(cb); return frames.length })
  vi.stubGlobal('cancelAnimationFrame', () => {})
  vi.stubGlobal('setTimeout', ((fn: () => void, ms?: number, ...rest: unknown[]) => {
    if (ms === FIRST_FRAME_FALLBACK_MS) { fallbacks.push(fn); return 0 }
    if (holdTasks && (ms === 0 || ms === undefined)) { tasks.push(fn); return 0 }
    return realSetTimeout(fn, ms, ...rest)
  }) as typeof setTimeout)
  return {
    frames,
    fallbacks,
    present: async () => {
      vi.unstubAllGlobals()
      await act(async () => {
        for (const cb of frames.splice(0)) cb(0)
        await new Promise(r => realSetTimeout(r, 5))
      })
    },
    presentHoldingTask: () => {
      holdTasks = true
      for (const cb of frames.splice(0)) cb(0)
      holdTasks = false
      return tasks.splice(0)
    },
  }
}

beforeEach(() => {
  for (const fn of [H.getFilesStatus, H.readFile, H.tGet, H.tPost]) fn.mockReset()
  H.otherStorage.length = 0
  H.throwDerive = false
  H.deriveCalls = 0
  H.getFilesStatus.mockImplementation(async () => STORED)
  H.readFile.mockImplementation(async () => BACKUP)
  clearEbirdObservationsCache()
  _resetSpeciesIndexMemoForTests()
  _resetAlphaCodesForTests()
  // The code data never arrives unless a row releases it.
  _setAlphaCodesImporterForTests(() => new Promise(() => {}))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

// ─────────────────────────────────────────────────────────────────────────────

describe('the third group (FR-08, FR-09, QA-08, QA-09)', () => {
  it('comes after Destinations and Species, under its own heading, which is not an option', async () => {
    open()
    await speciesReady()
    type('a')
    await waitFor(() => expect(locationOptions().length).toBeGreaterThan(0))
    const groups = within(listbox()).getAllByRole('group').map(g => g.getAttribute('aria-label'))
    expect(groups).toEqual([PALETTE_COPY.groupDestinations, PALETTE_COPY.groupSpecies, PALETTE_COPY.groupLocations])
    const heading = within(group(PALETTE_COPY.groupLocations)!).getByText(PALETTE_COPY.groupLocations)
    expect(heading.getAttribute('role')).toBe('presentation')
    expect(heading.closest('[role="option"]')).toBeNull()
  })

  it('shows no location row for an empty or whitespace-only query', async () => {
    open()
    await speciesReady()
    for (const q of ['', '   ', '\t', ' \t ']) {
      type(q)
      expect(locationOptions()).toHaveLength(0)
      expect(speciesOptions()).toHaveLength(0)
      expect(group(PALETTE_COPY.groupLocations)).toBeNull()
    }
  })

  it('is not armed without onOpenLocation: no group, no derivation', async () => {
    const before = _locationSearchBuilds()
    open(null)
    await speciesReady()
    type('marsh')
    await waitFor(() => expect(speciesOptions()).toHaveLength(1))
    await new Promise(r => setTimeout(r, FIRST_FRAME_FALLBACK_MS + 50))
    expect(group(PALETTE_COPY.groupLocations)).toBeNull()
    expect(_locationSearchBuilds()).toBe(before)
  })
})

describe('a location row (FR-13, FR-14, FR-15, QA-13, QA-14)', () => {
  it('shows the name, then the place, then the Location ID only on a full tie', async () => {
    open()
    await speciesReady()
    await locationsFor('backyard', 3)
    const texts = locationOptions().map(o => o.textContent)
    // Two in Santa Clara share name and place, so both show their IDs; the Marin
    // one differs by place and shows none. The tab's order: name, then place.
    expect(texts).toEqual([
      'Backyard Marin, CA',
      'Backyard Santa Clara, CA \u00B7 L300',
      'Backyard Santa Clara, CA \u00B7 L301',
    ])
    // The middle dot is hidden from assistive technology, so the name reads
    // "name place ID".
    for (const dot of listbox().querySelectorAll('[aria-hidden="true"]')) expect(dot.textContent).toBe('\u00B7')
  })

  it('an unnamed location shows the tab\'s placeholder and is found by it', async () => {
    open()
    await speciesReady()
    await locationsFor('unnamed', 1)
    const name = locationOptions()[0].querySelector('.sr-palette-loc-name')!
    expect(name.textContent).toBe(UNNAMED_LOCATION)
    expect(name.className).toContain('sr-palette-loc-name--unnamed')
  })

  it('holds no link, no button and no tab stop, and the overlay never imports HotspotLink', async () => {
    open()
    await speciesReady()
    await locationsFor('backyard', 3)
    expect(listbox().querySelector('a, button, [tabindex]')).toBeNull()
    // Comments stripped first: the file's own header names what it never renders.
    const src = readSrc('src/components/CommandPalette.tsx')
    const code = src.split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n')
    expect(src).toContain('HotspotLink')
    expect(code).not.toContain('HotspotLink')
    expect(code).toContain("from '../lib/hotspotReportsCopy'")
  })
})

describe('choosing a location (FR-17, FR-26, QA-17)', () => {
  it('a click opens it by Location ID, then closes through the one close path', async () => {
    const order: string[] = []
    const onOpenLocation = vi.fn((id: string) => order.push(`open:${id}`))
    const { s } = open(onOpenLocation)
    s.onClose.mockImplementation(() => order.push('close'))
    await speciesReady()
    await locationsFor('backyard', 3)
    fireEvent.click(locationOptions()[2])
    expect(order).toEqual(['open:L301', 'close'])
    expect(s.onOpenSpecies).not.toHaveBeenCalled()
  })

  it('ArrowDown crosses from the last species into the first location, stops at the end, and Enter opens it', async () => {
    const { s } = open()
    await speciesReady()
    await locationsFor('marsh', 1)
    expect(speciesOptions()).toHaveLength(1)
    key('ArrowDown')
    expect(input().getAttribute('aria-activedescendant')).toBe(speciesOptions()[0].id)
    key('ArrowDown')
    expect(input().getAttribute('aria-activedescendant')).toBe(locationOptions()[0].id)
    key('ArrowDown')
    expect(input().getAttribute('aria-activedescendant')).toBe(locationOptions()[0].id)
    key('Enter')
    expect(s.onOpenLocation).toHaveBeenCalledWith('L600')
    expect(s.onClose).toHaveBeenCalledTimes(1)
  })

  it('Enter with nothing highlighted opens a location only when it is the first row of the list', async () => {
    const a = open()
    await speciesReady()
    await locationsFor('jamaica', 1)
    key('Enter')
    expect(a.s.onOpenLocation).toHaveBeenCalledWith('L100')
    cleanup()

    const b = open()
    await speciesReady()
    await locationsFor('marsh', 1)
    key('Enter')
    expect(b.s.onOpenSpecies).toHaveBeenCalledWith('Marsh Wren')
    expect(b.s.onOpenLocation).not.toHaveBeenCalled()
  })
})

describe('the cap and both cap lines (FR-12, DD-3, QA-12)', () => {
  const many = csv(...Array.from({ length: 120 }, (_, i): Line => [
    `S${i}`, `Zzz Bird ${String(i).padStart(3, '0')}`, `Zzzus ${i}`, 'US-NY', 'Kings', `L${1000 + i}`, `Zzz Marsh ${String(i).padStart(3, '0')}`,
  ]))

  it('renders the cap\'s worth of locations, the first in order, and a line inside the group it describes', async () => {
    H.readFile.mockImplementation(async () => many)
    open()
    await speciesReady()
    await locationsFor('zzz marsh', LOCATION_CAP)
    expect(locationOptions().map(o => o.textContent)).toEqual(
      Array.from({ length: LOCATION_CAP }, (_, i) => `Zzz Marsh ${String(i).padStart(3, '0')} Kings, NY`),
    )
    const g = group(PALETTE_COPY.groupLocations)!
    const line = within(g).getByText(locationCapLine(LOCATION_CAP))
    expect(g.lastElementChild).toBe(line)
    expect(line.getAttribute('role')).toBe('presentation')
    expect(g.getAttribute('aria-describedby')).toBe(line.id)
    expect(line.closest('[role="option"]')).toBeNull()
  })

  it('with both groups cut, each line follows its own group, and the species line keeps its wording', async () => {
    H.readFile.mockImplementation(async () => many)
    open()
    await speciesReady()
    await locationsFor('zzz', LOCATION_CAP)
    expect(speciesOptions()).toHaveLength(SPECIES_CAP)
    const sg = group(PALETTE_COPY.groupSpecies)!
    const lg = group(PALETTE_COPY.groupLocations)!
    expect(sg.lastElementChild!.textContent).toBe(speciesCapLine(SPECIES_CAP))
    expect(lg.lastElementChild!.textContent).toBe(locationCapLine(LOCATION_CAP))
    expect(sg.getAttribute('aria-describedby')).toBe(sg.lastElementChild!.id)
    expect(lg.getAttribute('aria-describedby')).toBe(lg.lastElementChild!.id)
    expect(sg.lastElementChild!.id).not.toBe(lg.lastElementChild!.id)
    // No cap line is a direct child of the listbox: it owns only groups.
    for (const child of Array.from(listbox().children)) expect(child.getAttribute('role')).toBe('group')
  })

  it('below the cap, every match renders and no line does', async () => {
    H.readFile.mockImplementation(async () => many)
    open()
    await speciesReady()
    await locationsFor('zzz marsh 01', 10)
    expect(screen.queryByText(locationCapLine(LOCATION_CAP))).toBeNull()
    expect(group(PALETTE_COPY.groupLocations)!.hasAttribute('aria-describedby')).toBe(false)
  })
})

describe('what Search says about the backup (FR-20 to FR-25, QA-20 to QA-25)', () => {
  it('no backup saved: the shared sentence names both, under a heading that is not "Species" alone', async () => {
    H.getFilesStatus.mockImplementation(async () => NO_FILES)
    open()
    await screen.findByText(PALETTE_COPY.speciesNoBackup)
    expect(PALETTE_COPY.speciesNoBackup).toMatch(/species and locations/)
    expect(screen.getByText(PALETTE_COPY.groupBackup).getAttribute('class')).toContain('sr-palette-group')
    expect(screen.queryByText(PALETTE_COPY.groupSpecies)).toBeNull()
  })

  it('a failed status read is the load error, never "no backup", and offers no location', async () => {
    H.getFilesStatus.mockImplementation(async () => { throw new Error('unreachable') })
    open()
    await screen.findByText(EBIRD_BACKUP_LOAD_ERROR)
    expect(screen.queryByText(PALETTE_COPY.speciesNoBackup)).toBeNull()
    type('backyard')
    expect(locationOptions()).toHaveLength(0)
  })

  it('a derivation that throws leaves destinations and species working and says the load error under Locations', async () => {
    H.throwDerive = true
    open()
    await speciesReady()
    await waitFor(() => expect(status().textContent).toBe(EBIRD_BACKUP_LOAD_ERROR))
    type('marsh')
    await waitFor(() => expect(speciesOptions()).toHaveLength(1))
    expect(locationOptions()).toHaveLength(0)
    expect(status().textContent).toBe(EBIRD_BACKUP_LOAD_ERROR)
    expect(screen.getByText(PALETTE_COPY.groupLocations).getAttribute('class')).toContain('sr-palette-group')
    expect(screen.queryByText(PALETTE_COPY.noMatches)).toBeNull()
    expect(screen.queryByText(PALETTE_COPY.speciesNoBackup)).toBeNull()
    type('weather')
    expect(screen.getAllByRole('option')).toHaveLength(1)
  })

  it('while locations are still to come for a typed query, "nothing matches" is withheld (FR-22)', async () => {
    // A parse already cached, so the species answer lands before the held frame.
    const frame = holdFirstFrame()
    open()
    await speciesReady()
    type('jamaica')
    expect(locationOptions()).toHaveLength(0)
    expect(screen.queryByText(PALETTE_COPY.noMatches)).toBeNull()
    expect(status().textContent).toBe(PALETTE_COPY.speciesLoading)
    expect(screen.getByText(PALETTE_COPY.groupLocations)).toBeTruthy()
    await frame.present()
    await waitFor(() => expect(locationOptions()).toHaveLength(1))
    expect(status().textContent).toBe('')
  })

  it('"nothing matches" once every half has answered', async () => {
    open()
    await speciesReady()
    await locationsFor('backyard', 3)
    type('zzqxv')
    await waitFor(() => expect(status().textContent).toBe(PALETTE_COPY.noMatches))
  })

  it('a backup with no location: no group, no heading and no sentence of its own (FR-24)', async () => {
    H.readFile.mockImplementation(async () => csv(['S1', 'Sora', 'Porzana carolina', 'US-CA', 'Marin', '', 'Nowhere']))
    open()
    await speciesReady()
    type('sora')
    await waitFor(() => expect(speciesOptions()).toHaveLength(1))
    await new Promise(r => setTimeout(r, 50))
    expect(group(PALETTE_COPY.groupLocations)).toBeNull()
    expect(screen.queryByText(PALETTE_COPY.groupLocations)).toBeNull()
    expect(status().textContent).toBe('')
    type('zzqxv')
    await waitFor(() => expect(status().textContent).toBe(PALETTE_COPY.noMatches))
  })
})

describe('ids, attributes and tab stops (FR-19, NFR-10, QA-19)', () => {
  const HOSTILE = ['__proto__', 'constructor', 'a b"c<d>', '\'quoted\' place']
  const hostile = csv(...HOSTILE.map((s, i): Line => [`S${i}`, 'Sora', 'Porzana carolina', 'US-CA', s, s.slice(0, 16), `${s} Hostile`]))

  it('every option id is the prefix plus an index, and no attribute but the typed value holds file text', async () => {
    H.readFile.mockImplementation(async () => hostile)
    const { container } = open()
    await speciesReady()
    await locationsFor('hostile', HOSTILE.length)
    const prefix = input().getAttribute('aria-controls')!.replace(/-listbox$/, '')
    for (const o of screen.getAllByRole('option')) expect(o.id).toMatch(new RegExp(`^${prefix.replace(/[^\w]/g, '\\$&')}-option-\\d+$`))
    key('ArrowDown')
    for (const el of container.querySelectorAll('*')) {
      for (const attr of Array.from(el.attributes)) {
        if (el === input() && attr.name === 'value') continue
        for (const s of HOSTILE) expect(attr.value.includes(s), `${attr.name}="${attr.value}"`).toBe(false)
      }
    }
    expect(input().value).toBe('hostile')
  })

  it('exactly two tab stops, with no location rows and with the cap\'s worth', async () => {
    H.readFile.mockImplementation(async () => csv(...Array.from({ length: 60 }, (_, i): Line => [
      `S${i}`, 'Sora', 'Porzana carolina', 'US-CA', 'Marin', `L${i}`, `Pond ${i}`])))
    const { container } = open()
    await speciesReady()
    const stops = () => Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR))
    expect(stops()).toHaveLength(2)
    await locationsFor('pond', LOCATION_CAP)
    expect(stops()).toHaveLength(2)
    expect(stops().map(e => e.tagName)).toEqual(['INPUT', 'BUTTON'])
  })
})

describe('no request and no write over a full cycle (NFR-07, NFR-08, QA-46, QA-47)', () => {
  async function cycle(armed: boolean) {
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    open(armed ? vi.fn() : null)
    await speciesReady()
    type('marsh')
    await waitFor(() => expect(speciesOptions()).toHaveLength(1))
    if (armed) await waitFor(() => expect(locationOptions()).toHaveLength(1))
    key('ArrowDown')
    key('ArrowDown')
    key('Enter')
    const out = {
      status: H.getFilesStatus.mock.calls.length,
      reads: H.readFile.mock.calls.length,
      transport: H.tGet.mock.calls.length + H.tPost.mock.calls.length,
      other: [...H.otherStorage],
      localStorage: setItem.mock.calls.length,
    }
    setItem.mockRestore()
    cleanup()
    return out
  }

  it('the armed overlay makes no request, no other seam call and no write, with the same reads per open as without it', async () => {
    const unarmed = await cycle(false)
    for (const fn of [H.getFilesStatus, H.readFile]) fn.mockClear()
    clearEbirdObservationsCache()
    const armed = await cycle(true)
    expect(armed).toEqual({ ...unarmed })
    expect(armed.transport).toBe(0)
    expect(armed.other).toEqual([])
    expect(armed.localStorage).toBe(0)
    expect([armed.status, armed.reads]).toEqual([1, 1])
  })
})

describe('the derivation is lazy, single and gated on the first frame (R2, QA-07, QA-42)', () => {
  it('none before the first frame, even after species have landed and a key was typed; one after', async () => {
    const before = _locationSearchBuilds()
    const frame = holdFirstFrame()
    open()
    await speciesReady()
    type('backyard')
    await waitFor(() => expect(screen.queryAllByRole('option').length).toBeGreaterThanOrEqual(0))
    expect(frame.fallbacks).toHaveLength(1)
    expect(_locationSearchBuilds()).toBe(before)
    expect(locationOptions()).toHaveLength(0)
    await frame.present()
    await waitFor(() => expect(locationOptions()).toHaveLength(3))
    expect(_locationSearchBuilds() - before).toBe(1)
  })

  it('zero more across ten opens and fifty keystrokes on one file; one more after a replace', async () => {
    const before = _locationSearchBuilds()
    for (let n = 0; n < 10; n++) {
      open()
      await speciesReady()
      for (let k = 0; k < 5; k++) type(['b', 'ba', 'bac', 'back', 'backyard'][k])
      await waitFor(() => expect(locationOptions()).toHaveLength(3))
      cleanup()
    }
    expect(_locationSearchBuilds() - before).toBe(1)

    open()
    await speciesReady()
    H.readFile.mockImplementation(async () => csv(['S9', 'Sora', 'Porzana carolina', 'US-CA', 'Marin', 'L900', 'New Backyard']))
    await act(async () => { clearEbirdObservationsCache(); notifyFilesChanged() })
    await locationsFor('backyard', 1)
    expect(_locationSearchBuilds() - before).toBe(2)
  })
})

describe('joining and leaving with species (FR-23, FR-33, QA-23, QA-33)', () => {
  /** Every DOM state the listbox passes through, one snapshot per mutation batch. */
  function watch() {
    const snaps: { species: string[]; locations: string[]; status: string }[] = []
    const take = () => snaps.push({
      species: speciesOptions().map(o => o.textContent ?? ''),
      locations: locationOptions().map(o => o.textContent ?? ''),
      status: status()?.textContent ?? '',
    })
    const mo = new MutationObserver(take)
    mo.observe(document.body, { childList: true, subtree: true, characterData: true })
    return { snaps, stop: () => mo.disconnect() }
  }

  // E-08 (the Guide's decision, 2026-11-13): when Search is opened before the
  // backup has been read, the derivation is NOT run in the task that commits the
  // species rows, which already sits near the long-task line; it runs in its own
  // task after the frame that presented them, and the rows are appended.
  /** Scenario A: open, let the overlay's first frame be presented while the
   *  parse is still out, then hold the frames from here and land the parse. */
  async function openBeforeTheParse(query: string) {
    let release!: () => void
    H.readFile.mockImplementation(() => new Promise(r => { release = () => r(BACKUP) }))
    const view = open()
    type(query)
    await waitFor(() => expect(H.readFile).toHaveBeenCalled())
    await act(async () => { await new Promise(r => setTimeout(r, 80)) })
    const frame = holdFirstFrame()
    return { view, frame, land: () => act(async () => { release() }) }
  }

  it('Search opened before the backup is read: species rows commit with NO derivation, and locations join after the next frame, derived once', async () => {
    const before = { builds: _locationSearchBuilds(), calls: H.deriveCalls }
    const { frame, land } = await openBeforeTheParse('marsh')
    await land()
    await waitFor(() => expect(speciesOptions()).toHaveLength(1))
    // The species update has committed: nothing derived yet, no location row.
    expect(H.deriveCalls - before.calls).toBe(0)
    expect(_locationSearchBuilds() - before.builds).toBe(0)
    expect(locationOptions()).toHaveLength(0)
    expect(frame.frames.length).toBeGreaterThan(0)
    const speciesRow = speciesOptions()[0]
    const speciesId = speciesRow.id
    await frame.present()
    await waitFor(() => expect(locationOptions()).toHaveLength(1))
    expect(H.deriveCalls - before.calls).toBe(1)
    expect(_locationSearchBuilds() - before.builds).toBe(1)
    // Appended: the species row is the same node with the same id.
    expect(speciesOptions()[0]).toBe(speciesRow)
    expect(speciesOptions()[0].id).toBe(speciesId)
  })

  it('in that window a typed query with nothing else to show reads the reading sentence under Locations, never "nothing matches"', async () => {
    const { frame, land } = await openBeforeTheParse('jamaica')
    await land()
    await waitFor(() => expect(screen.queryByText(PALETTE_COPY.groupLocations)).not.toBeNull())
    expect(H.deriveCalls).toBe(0)
    expect(status().textContent).toBe(PALETTE_COPY.speciesLoading)
    expect(screen.queryByText(PALETTE_COPY.noMatches)).toBeNull()
    await frame.present()
    await waitFor(() => expect(locationOptions()).toHaveLength(1))
    expect(status().textContent).toBe('')
  })

  it('a waiting derivation is cancelled when Search closes, and never runs', async () => {
    const { view, frame, land } = await openBeforeTheParse('marsh')
    await land()
    await waitFor(() => expect(speciesOptions()).toHaveLength(1))
    expect(frame.fallbacks).toHaveLength(1)
    view.unmount()
    await frame.present()
    for (const fn of frame.fallbacks) fn()
    expect(H.deriveCalls).toBe(0)
  })

  it('a waiting derivation is cancelled by a files-epoch change, and the old file\'s locations are never adopted', async () => {
    const { frame, land } = await openBeforeTheParse('marsh')
    await land()
    await waitFor(() => expect(speciesOptions()).toHaveLength(1))
    // The backup is replaced before the frame comes; the new read never lands.
    H.readFile.mockImplementation(() => new Promise(() => {}))
    await act(async () => { clearEbirdObservationsCache(); notifyFilesChanged() })
    await frame.present()
    for (const fn of frame.fallbacks) fn()
    await act(async () => { await new Promise(r => setTimeout(r, 20)) })
    expect(H.deriveCalls).toBe(0)
    expect(locationOptions()).toHaveLength(0)
    expect(status().textContent).toBe(PALETTE_COPY.speciesLoading)
  })

  // Security F-1 (decisions.md E-10). The frame HAS been presented and the task
  // it queued is waiting when the backup changes. React renders that epoch change
  // and runs its effect before the waiting task (a microtask comes before any
  // task), but the resets that effect makes are a later render, so the effect's
  // cleanup cannot reach a task already queued. Without the generation check the
  // task put the old file's places back: after a clear until Search closed, after
  // a replace until the new file's parse landed. The epoch change is made OUTSIDE
  // `act`, so React schedules it as it does in the app; the control leg lets it
  // fully commit first, which the cleanup alone already covered.
  for (const leg of [
    { name: 'cleared', sentence: PALETTE_COPY.speciesNoBackup, committed: false },
    { name: 'replaced', sentence: PALETTE_COPY.speciesLoading, committed: false },
    { name: 'cleared (control: the change commits before the task)', sentence: PALETTE_COPY.speciesNoBackup, committed: true },
  ]) {
    it(`a derivation task already queued when the backup is ${leg.name} never runs or shows the old file's locations`, async () => {
      const { frame, land } = await openBeforeTheParse('marsh')
      await land()
      await waitFor(() => expect(speciesOptions()).toHaveLength(1))
      const tasks = frame.presentHoldingTask()
      expect(tasks).toHaveLength(1)
      if (leg.sentence === PALETTE_COPY.speciesNoBackup) H.getFilesStatus.mockImplementation(async () => NO_FILES)
      else H.readFile.mockImplementation(() => new Promise(() => {}))
      const statusReads = H.getFilesStatus.mock.calls.length
      if (leg.committed) {
        await act(async () => { clearEbirdObservationsCache(); notifyFilesChanged() })
      } else {
        clearEbirdObservationsCache()
        notifyFilesChanged()
        for (let i = 0; i < 5; i++) await Promise.resolve()
      }
      // The premise: the epoch effect has run (it re-reads the status) before the task.
      expect(H.getFilesStatus.mock.calls.length).toBeGreaterThan(statusReads)
      tasks[0]()
      vi.unstubAllGlobals()
      await act(async () => { await new Promise(r => setTimeout(r, 30)) })
      expect(locationOptions().map(o => o.textContent)).toEqual([])
      expect(status().textContent).toBe(leg.sentence)
      expect(H.deriveCalls).toBe(0)
    })
  }

  it('a replace removes the old file\'s locations in the update that removes its species, and never offers them again', async () => {
    open()
    await speciesReady()
    await locationsFor('marsh', 1)
    const w = watch()
    H.readFile.mockImplementation(async () => csv(['S9', 'Sedge Wren', 'Cistothorus stellaris', 'US-NY', 'Kings', 'L900', 'Salt Marsh Nature Center']))
    await act(async () => { clearEbirdObservationsCache(); notifyFilesChanged() })
    await waitFor(() => expect(locationOptions().map(o => o.textContent)).toEqual(['Salt Marsh Nature Center Kings, NY']))
    w.stop()
    const old = (s: { locations: string[] }) => s.locations.some(t => t.startsWith('Marsh Creek Trail'))
    const oldSpecies = (s: { species: string[] }) => s.species.some(t => t.startsWith('Marsh Wren'))
    for (const s of w.snaps) expect(old(s), JSON.stringify(s)).toBe(oldSpecies(s))
    const reading = w.snaps.findIndex(s => s.status === PALETTE_COPY.speciesLoading)
    expect(reading).toBeGreaterThan(-1)
    expect(w.snaps.slice(reading).some(old)).toBe(false)
  })
})

describe('the highlight never moves to another row (FR-18, QA-18)', () => {
  it('a highlighted species keeps its row and its id when location rows join', async () => {
    const frame = holdFirstFrame()
    open()
    await speciesReady()
    type('marsh')
    await waitFor(() => expect(speciesOptions()).toHaveLength(1))
    key('ArrowDown')
    const id = input().getAttribute('aria-activedescendant')
    expect(id).toBe(speciesOptions()[0].id)
    await frame.present()
    await waitFor(() => expect(locationOptions()).toHaveLength(1))
    expect(input().getAttribute('aria-activedescendant')).toBe(id)
    expect(document.getElementById(id!)).toBe(speciesOptions()[0])
  })

  it('a highlighted location is cleared, never moved, when the code data changes the species rows', async () => {
    let releaseCodes!: () => void
    const gate = new Promise<void>(r => { releaseCodes = r })
    _setAlphaCodesImporterForTests(async () => { await gate; return import('../assets/ebird-alpha-codes.json') as Promise<{ default: unknown }> })
    open()
    await speciesReady()
    await locationsFor('amro', 1)
    expect(speciesOptions()).toHaveLength(0)
    key('ArrowDown')
    expect(input().getAttribute('aria-activedescendant')).toBe(locationOptions()[0].id)
    await act(async () => { releaseCodes(); await loadAlphaCodes() })
    await waitFor(() => expect(speciesOptions().map(o => o.textContent)).toContain('American RobinTurdus migratorius'))
    expect(input().hasAttribute('aria-activedescendant')).toBe(false)
  })

  it('and keeps its row when the code data leaves the species rows unchanged', async () => {
    let releaseCodes!: () => void
    const gate = new Promise<void>(r => { releaseCodes = r })
    _setAlphaCodesImporterForTests(async () => { await gate; return import('../assets/ebird-alpha-codes.json') as Promise<{ default: unknown }> })
    open()
    await speciesReady()
    await locationsFor('jamaica', 1)
    key('ArrowDown')
    const id = input().getAttribute('aria-activedescendant')
    await act(async () => { releaseCodes(); await loadAlphaCodes() })
    expect(input().getAttribute('aria-activedescendant')).toBe(id)
    expect(document.getElementById(id!)).toBe(locationOptions()[0])
  })
})

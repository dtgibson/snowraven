// @vitest-environment jsdom
//
// The Family Tree tab (family-rollups-and-tree), component rows for what the
// pure suites cannot see: the phase gate (QA-13 to QA-15), the files epoch
// (QA-17), the status sentence (QA-23), the controls (QA-28 to QA-31, QA-35),
// persistence (QA-32, QA-90), the empty states (QA-34), the table (QA-37,
// QA-41 to QA-43, QA-45), the Names control (QA-88, QA-89, QA-91's component
// half), Expand all and Collapse all (QA-94), the request count (QA-50's
// component half) and the tab lifecycle (QA-84). jsdom has no layout, so
// nothing here claims a geometric fact; those belong to the real-engine probe.
// The real family asset is loaded, as in the app.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import v8 from 'node:v8'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import { resolve as resolvePath } from 'node:path'
import { render, screen, cleanup, fireEvent, waitFor, act, within } from '@testing-library/react'
import type { ObservationEntry } from '../../types'
import type { MLExportRow } from '../../lib/parseMLExport'
import type { ProvenanceSnapshot } from '../../lib/exoticProvenance'

const H = vi.hoisted(() => ({
  files: { ebird: { filename: 'MyEBirdData.csv' }, ml: null } as { ebird: unknown; ml: unknown },
  observations: [] as unknown[],
  mlRows: null as unknown[] | null,
  ebirdNull: false,
  assetFails: 0,
  post: vi.fn(),
  setSetting: vi.fn<(key: string, value: unknown) => Promise<void>>(async () => {}),
  deleteSetting: vi.fn<(key: string) => Promise<void>>(async () => {}),
  getSetting: vi.fn<(key: string) => Promise<unknown>>(async () => null),
  snapshot: null as unknown,
  getFilesStatus: vi.fn(),
  listeners: new Set<() => void>(),
  // A gate a load waits on after reading its dataset (QA-15's supersession rows).
  hold: null as Promise<void> | null,
  // A WeakRef to every model the tab builds (QA-78): weak, so it retains none.
  models: [] as WeakRef<object>[],
  // The still tier (useIsPhone). True by default so the Slice A rows meet the
  // table, the first view at or under the tier (FR-53); the tree rows set it.
  phone: true,
}))

vi.mock('../../lib/storage', () => ({
  storage: { getFilesStatus: H.getFilesStatus, getSetting: H.getSetting, setSetting: H.setSetting, deleteSetting: H.deleteSetting },
}))
vi.mock('../../lib/observationsCache', () => ({
  loadEbirdObservations: vi.fn(async () => {
    const observations = H.observations
    if (H.hold) await H.hold
    return H.ebirdNull ? null : { headerLine: '', observations }
  }),
}))
vi.mock('../../lib/mlExportCache', () => ({
  loadMLExport: vi.fn(async () => (H.mlRows ? { entries: [], mediaMap: {}, rows: H.mlRows } : null)),
}))
// Passing through, keeping only a WeakRef to each model built (QA-78). A plain
// function, not vi.fn, whose recorded results would retain every model.
vi.mock('../../lib/familyTreeModel', async importOriginal => {
  const m = await importOriginal<typeof import('../../lib/familyTreeModel')>()
  return {
    ...m,
    buildFamilyModel: (input: Parameters<typeof m.buildFamilyModel>[0]) => {
      const out = m.buildFamilyModel(input)
      H.models.push(new WeakRef(out))
      return out
    },
  }
})
// Counted, passing through: a superseded run must never reach the passes.
vi.mock('../../lib/lifeLists', async importOriginal => {
  const m = await importOriginal<typeof import('../../lib/lifeLists')>()
  return { ...m, deriveFirstSightings: vi.fn(m.deriveFirstSightings) }
})
vi.mock('../../lib/transport', () => ({ transport: { post: H.post, get: vi.fn() } }))
vi.mock('../../lib/useIsPhone', () => ({ useIsPhone: () => H.phone }))
vi.mock('../../lib/exoticProvenanceCache', () => ({
  getSnapshot: () => H.snapshot,
  subscribe: (l: () => void) => { H.listeners.add(l); return () => { H.listeners.delete(l) } },
  loadSnapshot: vi.fn(async () => H.snapshot),
}))
vi.mock('../../lib/familyTreeAsset', async importOriginal => {
  const m = await importOriginal<typeof import('../../lib/familyTreeAsset')>()
  return {
    ...m,
    loadFamilyIndex: vi.fn(async () => {
      if (H.assetFails > 0) { H.assetFails -= 1; throw new Error('chunk failed') }
      return m.loadFamilyIndex()
    }),
  }
})

import { FamilyTreeTab } from './FamilyTreeTab'
import { notifyFilesChanged } from '../../lib/filesChanged'
import { deriveFirstSightings } from '../../lib/lifeLists'
import { loadEbirdObservations } from '../../lib/observationsCache'
import { loadMLExport } from '../../lib/mlExportCache'
import { EBIRD_BACKUP_LOAD_ERROR } from '../setupCopy'
import { FAMILY_TREE_NAMES_SETTING, FAMILY_TREE_REGION_SETTING, FAMILY_TREE_VIEW_SETTING } from '../../lib/familyTreeSettings'
import {
  EMPTY_FILTERED, EMPTY_UNFILTERED, ESCAPEE_STATUS, FAMILY_DATA_ERROR, FILTER_NOTE, ML_NONE_SENTENCE, ML_UNREADABLE_SENTENCE,
} from '../../lib/familyTreeCopy'
import { loadFamilyIndex } from '../../lib/familyTreeAsset'
import { EXPAND_CHUNK_SPECIES } from '../../lib/familyTreeModel'

function obs(commonName: string, date: string, submissionId: string, extra: Partial<ObservationEntry> = {}): ObservationEntry {
  return {
    submissionId, commonName, scientificName: '', date, location: 'Lake Park', locationId: 'L1',
    latitude: null, longitude: null, county: 'Marin', count: 1, breedingCode: null, speciesComments: '',
    catalogIds: [], time: '7:05 AM', stateProvince: 'US-CA', ...extra,
  }
}
function ml(commonName: string, format: MLExportRow['format'], date: string, checklistId: string): MLExportRow {
  return {
    catalogId: `ML-${commonName}-${format}-${date}`, commonName, scientificName: '', format, date, location: '', county: '',
    latitude: null, longitude: null, caption: '', mediaNotes: '', observationDetails: '', ageSex: '', behaviors: '',
    time: '643', year: null, month: null, avgRating: null, numRatings: 0, checklistId,
  }
}
const snapshot = (over: Partial<ProvenanceSnapshot> = {}): ProvenanceSnapshot =>
  ({ checklists: new Set(), species: new Map(), excludedNames: [], exoticNames: null, ...over })

const BASE = [
  obs('Snow Goose', '2019-05-02', 'S1'),
  obs("Ross's Goose", '2021-03-09', 'S2', { stateProvince: 'US-NY', county: 'Kings' }),
  obs('Canada Goose', '2021-03-09', 'S2', { stateProvince: 'US-NY', county: 'Kings' }),
  obs('American Robin', '2020-01-01', 'S3'),
  obs('Imaginary Warbler', '2020-01-01', 'S3', { scientificName: 'Fictus imaginarius' }),
  obs('gull sp.', '2020-01-01', 'S3'),
]

beforeEach(() => {
  H.files = { ebird: { filename: 'MyEBirdData.csv' }, ml: null }
  H.observations = BASE
  H.mlRows = null
  H.ebirdNull = false
  H.assetFails = 0
  H.snapshot = snapshot()
  H.listeners.clear()
  H.phone = true
  H.getFilesStatus.mockImplementation(async () => H.files)
  H.getSetting.mockImplementation(async () => null)
  H.setSetting.mockImplementation(async () => {})
  H.deleteSetting.mockImplementation(async () => {})
  H.post.mockImplementation(async () => ({ codes: { 'Snow Goose': 'snogoo', "Ross's Goose": 'rosgoo', 'Canada Goose': 'cangoo', 'American Robin': 'amerob' } }))
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.useRealTimers()
})

const openSpecies = vi.fn()
async function ready(props: Partial<{ showing: boolean }> = {}) {
  const r = render(<FamilyTreeTab onGoToSettings={() => {}} onOpenSpecies={openSpecies} showing={props.showing ?? true} />)
  await waitFor(() => expect(document.querySelector('.sr-ft-glance')).not.toBeNull())
  return r
}
const familyRow = (name: RegExp | string) => screen.getByRole('button', { name: typeof name === 'string' ? new RegExp(`^${name}`) : name })
const tileValue = (i: number) => document.querySelectorAll('.sr-ft-tile-value')[i]?.textContent

describe('one model, both views (QA-33)', () => {
  it('a control change builds the model once; a view switch builds it zero times and keeps every filter', async () => {
    const { modelWork } = await import('../../lib/familyTreeModel')
    await ready()
    await waitFor(() => expect(H.post).toHaveBeenCalledTimes(1))
    await act(async () => { await new Promise(r => setTimeout(r, 30)) })
    const b0 = modelWork.builds
    fireEvent.change(screen.getByRole('combobox', { name: 'Year' }), { target: { value: '2021' } })
    expect(modelWork.builds).toBe(b0 + 1)
    expect(tileValue(0)).toBe('2')
    fireEvent.click(screen.getByRole('button', { name: 'Tree' }))
    fireEvent.click(screen.getByRole('button', { name: 'Table' }))
    expect(modelWork.builds).toBe(b0 + 1)
    expect(tileValue(0)).toBe('2')
    expect((screen.getByRole('combobox', { name: 'Year' }) as HTMLSelectElement).value).toBe('2021')
  })
  it('neither view computes a figure: both read the model\'s fields and import no builder', () => {
    for (const f of ['FamilyTreeRollup.tsx', 'FamilyTreeDiagram.tsx']) {
      const code = readFileSync(resolvePath('src/components/familyTree', f), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !l.trimStart().startsWith('//')).join('\n')
      expect(code.length, f).toBeGreaterThan(2000)
      for (const banned of ['buildFamilyModel', 'deriveScope', 'worldCounts', 'deriveYearColumns', 'deriveFirstSightings', '.reduce(']) {
        expect(code.includes(banned), `${f} holds ${banned}`).toBe(false)
      }
    }
  })
})

describe('a superseded load writes nothing (QA-15)', () => {
  afterEach(() => { H.hold = null })
  it('a files-epoch bump mid-load: the first run never derives, and the tab shows the second file', async () => {
    const A = [obs('Snow Goose', '2019-05-02', 'S1')]
    let release: () => void = () => {}
    H.hold = new Promise<void>(r => { release = r })
    H.observations = A
    render(<FamilyTreeTab onGoToSettings={() => {}} showing />)
    await waitFor(() => expect(vi.mocked(loadEbirdObservations)).toHaveBeenCalledTimes(1))
    H.hold = null
    H.observations = BASE
    act(() => notifyFilesChanged())
    await waitFor(() => expect(document.querySelector('.sr-ft-glance')).not.toBeNull())
    expect(tileValue(0)).toBe('5')
    await act(async () => { release(); await new Promise(r => setTimeout(r, 20)) })
    expect(tileValue(0)).toBe('5')
    expect(vi.mocked(deriveFirstSightings).mock.calls.some(c => c[0] === A)).toBe(false)
    expect(vi.mocked(deriveFirstSightings).mock.calls.some(c => c[0] === BASE)).toBe(true)
  })
  it('an unmount mid-load: the run never derives and posts nothing', async () => {
    let release: () => void = () => {}
    H.hold = new Promise<void>(r => { release = r })
    const r = render(<FamilyTreeTab onGoToSettings={() => {}} showing />)
    await waitFor(() => expect(vi.mocked(loadEbirdObservations)).toHaveBeenCalledTimes(1))
    r.unmount()
    await act(async () => { release(); await new Promise(res => setTimeout(res, 20)) })
    expect(vi.mocked(deriveFirstSightings)).not.toHaveBeenCalled()
    expect(H.post).not.toHaveBeenCalled()
  })
})

describe('the phase gate (QA-13 to QA-15)', () => {
  it('shows the setup panel with no backup, and no controls or table (QA-13)', async () => {
    H.files = { ebird: null, ml: null }
    render(<FamilyTreeTab onGoToSettings={() => {}} showing />)
    expect(await screen.findByText('eBird Backup Required')).toBeTruthy()
    expect(screen.getByText("The Family Tree tab loads automatically from your stored eBird backup. You haven't saved one yet.")).toBeTruthy()
    expect(screen.queryByRole('switch')).toBeNull()
    expect(document.querySelector('.sr-ft-list')).toBeNull()
  })
  it('an unreadable backup shows the shared alert, not the setup panel (QA-14)', async () => {
    H.ebirdNull = true
    render(<FamilyTreeTab onGoToSettings={() => {}} showing />)
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain(EBIRD_BACKUP_LOAD_ERROR))
    expect(screen.queryByText('eBird Backup Required')).toBeNull()
  })
  it('a failed family asset fills the mounted region with its message and one Reload, lists nothing, and showing the tab again loads nothing (QA-14, schema 8.2)', async () => {
    H.assetFails = 1
    let release: () => void = () => {}
    H.getFilesStatus.mockImplementation(() => new Promise(res => { release = () => res(H.files) }))
    const reload = vi.fn()
    vi.stubGlobal('location', { ...window.location, reload })
    try {
      const r = render(<FamilyTreeTab onGoToSettings={() => {}} showing />)
      const region = screen.getByRole('alert')
      expect(region.textContent).toBe('')
      await act(async () => { release() })
      await waitFor(() => expect(screen.getByRole('alert').textContent).toBe(FAMILY_DATA_ERROR))
      expect(screen.getByRole('alert')).toBe(region)
      // One action, Reload, beside the region; Settings cannot repair an app file.
      const action = screen.getByRole('button', { name: 'Reload' })
      expect(region.contains(action)).toBe(false)
      expect(screen.queryByRole('button', { name: /Go to Settings/ })).toBeNull()
      expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull()
      expect(document.querySelector('.sr-ft-list, .sr-ft-box, .sr-ft-unplaced, .sr-ft-glance')).toBeNull()
      expect(screen.queryByText('Not placed')).toBeNull()
      // Hidden and shown again: no load starts.
      const assetCalls = vi.mocked(loadFamilyIndex).mock.calls.length
      const statusReads = H.getFilesStatus.mock.calls.length
      expect(assetCalls).toBe(1)
      r.rerender(<FamilyTreeTab onGoToSettings={() => {}} showing={false} />)
      r.rerender(<FamilyTreeTab onGoToSettings={() => {}} showing />)
      await act(async () => { await new Promise(res => setTimeout(res, 30)) })
      expect(vi.mocked(loadFamilyIndex).mock.calls.length).toBe(assetCalls)
      expect(H.getFilesStatus.mock.calls.length).toBe(statusReads)
      expect(screen.getByRole('alert').textContent).toBe(FAMILY_DATA_ERROR)
      expect(reload).not.toHaveBeenCalled()
      fireEvent.click(action)
      expect(reload).toHaveBeenCalledTimes(1)
    } finally {
      vi.unstubAllGlobals()
    }
  })
  it('the backup\'s own load failure keeps Go to Settings and has no Reload (only the family data reloads)', async () => {
    H.ebirdNull = true
    render(<FamilyTreeTab onGoToSettings={() => {}} showing />)
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain(EBIRD_BACKUP_LOAD_ERROR))
    expect(screen.getByRole('button', { name: /Go to Settings/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Reload' })).toBeNull()
  })
  it('the alert region exists, empty, while loading (QA-14) and a status names the load (QA-15)', async () => {
    let release: () => void = () => {}
    H.getFilesStatus.mockImplementation(() => new Promise(res => { release = () => res(H.files) }))
    render(<FamilyTreeTab onGoToSettings={() => {}} showing />)
    expect(screen.getByRole('alert').textContent).toBe('')
    expect(screen.getByRole('status', { name: 'Loading your family tree' })).toBeTruthy()
    await act(async () => { release() })
    await waitFor(() => expect(document.querySelector('.sr-ft-glance')).not.toBeNull())
  })
})

describe('the headline and the table (QA-36, QA-37, QA-41 to QA-43)', () => {
  it('counts species, families and orders, unplaced species in the species figure', async () => {
    await ready()
    // Snow, Ross's and Canada Goose (Anatidae), American Robin (Turdidae), Imaginary Warbler (unplaced).
    expect(tileValue(0)).toBe('5')
    expect(tileValue(1)).toBe('2')
    expect(tileValue(2)).toBe('2')
  })
  it('lists each recorded family once with both names, seen of world as text, and no other family', async () => {
    await ready()
    const rows = [...document.querySelectorAll('.sr-ft-frow')].filter(r => r.getAttribute('data-ft-family') !== '-1')
    expect(rows).toHaveLength(2)
    expect(rows[0].textContent).toContain('Ducks, Geese, and Waterfowl')
    expect(rows[0].textContent).toContain('Anatidae')
    expect(rows[0].textContent).toMatch(/3 of \d+/)
  })
  it('a family row is a disclosure; its contents render only while open, and focus stays on it', async () => {
    await ready()
    const row = familyRow('Ducks, Geese, and Waterfowl')
    expect(row.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('button', { name: 'Snow Goose' })).toBeNull()
    row.focus()
    fireEvent.click(row)
    expect(row.getAttribute('aria-expanded')).toBe('true')
    expect(document.activeElement).toBe(row)
    // Genera in taxonomic order, then species, each through BirdName.
    const open = row.parentElement!.querySelector('.sr-ft-open')!
    expect([...open.querySelectorAll('.sr-ft-genus b')].map(b => b.textContent)).toEqual(['Geese', 'Branta'])
    expect(within(open as HTMLElement).getByRole('button', { name: 'Snow Goose' })).toBeTruthy()
    fireEvent.click(row)
    expect(screen.queryByRole('button', { name: 'Snow Goose' })).toBeNull()
    expect(document.activeElement).toBe(row)
  })
  it('a species name opens Species Detail with its own name, and carries its two marks once codes resolve (QA-42)', async () => {
    await ready()
    fireEvent.click(familyRow('Ducks, Geese, and Waterfowl'))
    fireEvent.click(screen.getByRole('button', { name: 'Snow Goose' }))
    expect(openSpecies).toHaveBeenCalledWith('Snow Goose')
    await waitFor(() => expect(document.querySelector('a[href="https://ebird.org/species/snogoo"]')).not.toBeNull())
  })
  it('the Not placed group opens to its species and its reason (QA-25)', async () => {
    await ready()
    const row = screen.getByRole('button', { name: /^Species with no family here/ })
    fireEvent.click(row)
    expect(screen.getByText("eBird's taxonomy in this version of SnowRaven does not list this name, so it has no family here.")).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Imaginary Warbler' })).toBeTruthy()
  })
  it('the not-single-species line counts the distinct names (QA-26)', async () => {
    await ready()
    expect(screen.getByText('1 other entry in your backup is not a single species, so it has no place on the tree.')).toBeTruthy()
  })
})

describe('index-keyed ids over hostile names (QA-45)', () => {
  it('a species named like markup renders as text and mints no id from it', async () => {
    H.observations = [...BASE, obs('"><img src=x>', '2020-01-01', 'S9'), obs('__proto__', '2020-01-01', 'S9')]
    await ready()
    fireEvent.click(screen.getByRole('button', { name: /^Species with no family here/ }))
    expect(document.querySelector('img[src="x"]')).toBeNull()
    for (const el of document.querySelectorAll('[id]')) expect(el.id).not.toContain('img')
    const ids = [...document.querySelectorAll('[id]')].map(e => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('the controls (QA-28 to QA-31, QA-35)', () => {
  it('Region and Year carry accessible names; Year lists all years then each year newest first', async () => {
    await ready()
    expect(screen.getByRole('combobox', { name: 'Region' })).toBeTruthy()
    const year = screen.getByRole('combobox', { name: 'Year' }) as HTMLSelectElement
    expect([...year.options].map(o => o.textContent)).toEqual(['All years', '2021', '2020', '2019'])
  })
  it('a Year narrows the roster and shows the filter note; All years removes it', async () => {
    await ready()
    expect(screen.queryByText(FILTER_NOTE)).toBeNull()
    fireEvent.change(screen.getByRole('combobox', { name: 'Year' }), { target: { value: '2021' } })
    expect(tileValue(0)).toBe('2')
    expect(screen.getByText(FILTER_NOTE)).toBeTruthy()
    fireEvent.change(screen.getByRole('combobox', { name: 'Year' }), { target: { value: '' } })
    expect(tileValue(0)).toBe('5')
  })
  it('Include Escapees is a switch, off by default, and turning it on adds the reader\'s escapees', async () => {
    H.snapshot = snapshot({ excludedNames: ['Canada Goose'], checklists: new Set(['S2']) })
    await ready()
    const sw = screen.getByRole('switch', { name: 'Include Escapees' })
    expect(sw.getAttribute('aria-checked')).toBe('false')
    // Off: the reader's confirmed escapee is excluded; on: exactly it returns (QA-20).
    expect(tileValue(0)).toBe('4')
    fireEvent.click(sw)
    expect(tileValue(0)).toBe('5')
    expect(sw.getAttribute('aria-checked')).toBe('true')
  })
  it('a published escapee the reader cannot confirm (a carrier not consulted) is not excluded', async () => {
    H.snapshot = snapshot({ excludedNames: ['Canada Goose'], checklists: new Set(['S1']) })
    await ready()
    expect(tileValue(0)).toBe('5')
    fireEvent.click(screen.getByRole('switch', { name: 'Include Escapees' }))
    expect(tileValue(0)).toBe('5')
  })
  it('without an ML export the pills are aria-disabled, the sentence is wired, and no media figure renders (QA-35)', async () => {
    await ready()
    expect(screen.getByText(ML_NONE_SENTENCE)).toBeTruthy()
    for (const p of document.querySelectorAll('.sr-ft-pill')) {
      expect(p.getAttribute('aria-disabled')).toBe('true')
      expect(p.getAttribute('aria-describedby')).toBe(document.querySelector('.sr-ft-note')!.id)
    }
    expect(document.querySelector('.sr-ft-mc')).toBeNull()
    expect(document.querySelector('.sr-ft-tab')!.getAttribute('data-media')).toBe('off')
  })
  it('with an export saved that could not be read, the second sentence shows', async () => {
    H.files = { ebird: { filename: 'MyEBirdData.csv' }, ml: { filename: 'ML__x.csv' } }
    await ready()
    expect(screen.getByText(ML_UNREADABLE_SENTENCE)).toBeTruthy()
  })
  it('with a readable export the media figures show and a pill cycles any, has, lacks', async () => {
    H.files = { ebird: { filename: 'MyEBirdData.csv' }, ml: { filename: 'ML__x.csv' } }
    H.mlRows = [ml('Snow Goose', 'Photo', '2019-05-02', 'S1')]
    await ready()
    expect(document.querySelector('.sr-ft-mc')).not.toBeNull()
    const photo = screen.getByRole('button', { name: 'Photo' })
    fireEvent.click(photo)
    expect(photo.textContent).toBe('Has photo')
    expect(photo.getAttribute('aria-pressed')).toBe('true')
    expect(tileValue(0)).toBe('1')
    fireEvent.click(photo)
    expect(photo.textContent).toBe('No photo')
    expect(photo.getAttribute('data-state')).toBe('negative')
    expect(tileValue(0)).toBe('4')
    fireEvent.click(photo)
    expect(photo.getAttribute('aria-pressed')).toBe('false')
  })
})

describe('the status sentence (QA-23)', () => {
  it('shows while the escapee check is not complete, as plain text with no control', async () => {
    await ready()
    const line = screen.getByText(ESCAPEE_STATUS)
    expect(line.querySelector('button, a')).toBeNull()
  })
  it('with the check complete, though most checklists were never consulted, no sentence renders', async () => {
    // Every coded species has an answer (Statistics' own completion test), and
    // only S2 of three checklists was consulted (the Life Lists suite's shape).
    const rec = (seen: string[]) => ({ seen, n: seen.length, at: 0 })
    H.snapshot = snapshot({
      checklists: new Set(['S2']),
      species: new Map([['snogoo', rec(['|'])], ['rosgoo', rec(['|'])], ['cangoo', rec(['|'])], ['amerob', rec(['|'])]]),
    })
    await ready()
    await waitFor(() => expect(H.post).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.queryByText(ESCAPEE_STATUS)).toBeNull())
  })
  it('with the codes batch failed, the sentence renders, the check being unknown', async () => {
    const rec = (seen: string[]) => ({ seen, n: seen.length, at: 0 })
    H.snapshot = snapshot({
      checklists: new Set(['S2']),
      species: new Map([['snogoo', rec(['|'])], ['rosgoo', rec(['|'])], ['cangoo', rec(['|'])], ['amerob', rec(['|'])]]),
    })
    H.post.mockImplementation(async () => { throw new Error('offline') })
    await ready()
    await waitFor(() => expect(H.post).toHaveBeenCalledTimes(1))
    expect(screen.getByText(ESCAPEE_STATUS)).toBeTruthy()
  })
})

describe('empty states (QA-34)', () => {
  it('a backup with only non-countable rows says so, and the controls stay', async () => {
    H.observations = [obs('gull sp.', '2020-01-01', 'S1')]
    await ready()
    expect(screen.getByText(EMPTY_UNFILTERED)).toBeTruthy()
    expect(screen.getByRole('combobox', { name: 'Year' })).toBeTruthy()
  })
  it('a filter matching nothing gives the second sentence', async () => {
    H.files = { ebird: { filename: 'MyEBirdData.csv' }, ml: { filename: 'ML__x.csv' } }
    H.mlRows = [ml('Snow Goose', 'Photo', '2019-05-02', 'S1')]
    await ready()
    fireEvent.click(screen.getByRole('button', { name: 'Video' }))
    expect(screen.getByText(EMPTY_FILTERED)).toBeTruthy()
  })
})

describe('the Names control (QA-88 to QA-91)', () => {
  const names = () => screen.getByRole('group', { name: 'Names shown' })
  it('opens on Both, with three pressed-state options', async () => {
    await ready()
    const opts = within(names()).getAllByRole('button')
    expect(opts.map(o => o.textContent)).toEqual(['Common', 'Scientific', 'Both'])
    expect(opts.map(o => o.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'true'])
  })
  it('each state changes how names read at every level, and nothing else', async () => {
    await ready()
    fireEvent.click(familyRow('Ducks, Geese, and Waterfowl'))
    const counts = () => [tileValue(0), tileValue(1), tileValue(2)]
    const before = counts()
    const order = () => document.querySelector('.sr-ft-oband h3')!.textContent
    expect(order()).toBe('Waterfowl Anseriformes')
    fireEvent.click(within(names()).getByRole('button', { name: 'Scientific' }))
    await waitFor(() => expect(order()).toBe('Anseriformes'))
    expect(screen.getByRole('button', { name: 'Anser caerulescens' })).toBeTruthy()
    expect(familyRow('Anatidae').getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(within(names()).getByRole('button', { name: 'Common' }))
    await waitFor(() => expect(order()).toBe('Waterfowl'))
    // A genus with no common name shows its scientific name in Common.
    expect([...document.querySelectorAll('.sr-ft-genus b')].map(b => b.textContent)).toEqual(['Geese', 'Branta'])
    expect(counts()).toEqual(before)
    // In Scientific the species still opens on its common name (QA-91).
    fireEvent.click(within(names()).getByRole('button', { name: 'Scientific' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Branta canadensis' })).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Branta canadensis' }))
    expect(openSpecies).toHaveBeenLastCalledWith('Canada Goose')
  })
  it('a choice writes one setting under its own key; a remount restores it (QA-90)', async () => {
    const r = await ready()
    fireEvent.click(within(names()).getByRole('button', { name: 'Scientific' }))
    await waitFor(() => expect(H.setSetting).toHaveBeenCalledWith(FAMILY_TREE_NAMES_SETTING, 'scientific'))
    expect(H.setSetting).toHaveBeenCalledTimes(1)
    r.unmount()
    H.getSetting.mockImplementation(async key => (key === FAMILY_TREE_NAMES_SETTING ? 'scientific' : null))
    await ready()
    expect(within(names()).getByRole('button', { name: 'Scientific' }).getAttribute('aria-pressed')).toBe('true')
  })
  it('a malformed stored value reads as Both and writes nothing', async () => {
    H.getSetting.mockImplementation(async key => (key === FAMILY_TREE_NAMES_SETTING ? { __proto__: 'x' } : null))
    await ready()
    expect(within(names()).getByRole('button', { name: 'Both' }).getAttribute('aria-pressed')).toBe('true')
    expect(H.setSetting).not.toHaveBeenCalled()
  })
})

describe('persistence (QA-32)', () => {
  it('a Region choice writes its one key; Year, Media, the switch, sort and expansion write nothing', async () => {
    await ready()
    fireEvent.change(screen.getByRole('combobox', { name: 'Year' }), { target: { value: '2021' } })
    fireEvent.click(screen.getByRole('switch', { name: 'Include Escapees' }))
    fireEvent.change(screen.getByRole('combobox', { name: 'Sort' }), { target: { value: 'seen' } })
    fireEvent.click(screen.getByRole('button', { name: 'Expand all' }))
    expect(H.setSetting).not.toHaveBeenCalled()
    const region = screen.getByRole('combobox', { name: 'Region' })
    fireEvent.focus(region)
    fireEvent.mouseDown(await screen.findByRole('option', { name: 'California' }))
    await waitFor(() => expect(H.setSetting).toHaveBeenCalledWith(FAMILY_TREE_REGION_SETTING, { level: 'state', code: 'US-CA' }))
    expect(H.setSetting).toHaveBeenCalledTimes(1)
  })
})

describe('the files epoch (QA-17)', () => {
  it('re-derives from the new file, and a year it lacks reads as All years', async () => {
    await ready()
    fireEvent.change(screen.getByRole('combobox', { name: 'Year' }), { target: { value: '2019' } })
    expect(tileValue(0)).toBe('1')
    H.observations = [obs('Mallard', '2022-02-02', 'S5')]
    act(() => { notifyFilesChanged() })
    await waitFor(() => expect(tileValue(0)).toBe('1'))
    expect((screen.getByRole('combobox', { name: 'Year' }) as HTMLSelectElement).value).toBe('')
    expect(screen.queryByText(FILTER_NOTE)).toBeNull()
  })
})

describe('Expand all and Collapse all (QA-94)', () => {
  it('opens every family and Not placed in chunks with focus kept on the button; Collapse all closes them all', async () => {
    await ready()
    const expand = screen.getByRole('button', { name: 'Expand all' })
    expand.focus()
    fireEvent.click(expand)
    await waitFor(() => expect([...document.querySelectorAll('.sr-ft-frow')].every(r => r.getAttribute('aria-expanded') === 'true')).toBe(true))
    expect(document.activeElement).toBe(expand)
    const collapse = screen.getByRole('button', { name: 'Collapse all' })
    collapse.focus()
    fireEvent.click(collapse)
    expect([...document.querySelectorAll('.sr-ft-frow')].every(r => r.getAttribute('aria-expanded') === 'false')).toBe(true)
    expect(document.activeElement).toBe(collapse)
    expect(document.querySelectorAll('.sr-ft-order').length).toBeGreaterThan(0)   // order headings stay
  })
  it('a roster wider than one chunk commits in more than one step, and a Collapse all between chunks ends the run', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] })
    // Every species of two big families, so the plan has several chunks.
    const { readFamilyIndex, speciesNames } = await import('../../test/familyTreeCorpus')
    const index = readFamilyIndex()
    const all = speciesNames(index)
    // Every 20th species, so the roster spans many families and the plan many steps.
    H.observations = all.filter((_, i) => i % 20 === 0).slice(0, EXPAND_CHUNK_SPECIES * 3).map((n, i) => obs(n, '2020-01-01', `S${i}`))
    render(<FamilyTreeTab onGoToSettings={() => {}} showing />)
    await vi.waitFor(() => expect(document.querySelector('.sr-ft-glance')).not.toBeNull())
    fireEvent.click(screen.getByRole('button', { name: 'Expand all' }))
    const openCount = () => [...document.querySelectorAll('.sr-ft-frow')].filter(r => r.getAttribute('aria-expanded') === 'true').length
    const first = openCount()
    const total = document.querySelectorAll('.sr-ft-frow').length
    expect(first).toBeGreaterThan(0)
    expect(first).toBeLessThan(total)
    fireEvent.click(screen.getByRole('button', { name: 'Collapse all' }))
    await act(async () => { vi.runAllTimers() })
    expect(openCount()).toBe(0)
  })
})

describe('Expand all in exact steps (schema 9.2 as amended, D-43)', () => {
  /** Every open family's mounted rows against its own seen figure. */
  const halfMounted = () => [...document.querySelectorAll('.sr-ft-fblock')].filter(b => {
    const open = b.querySelector('.sr-ft-open')
    const seen = b.querySelector('.sr-ft-seen-figs b')
    return open !== null && seen !== null && open.querySelectorAll('.sr-ft-sp').length !== Number(seen.textContent!.replace(/,/g, ''))
  }).length
  async function bigRoster() {
    vi.useFakeTimers({ toFake: ['setTimeout'] })
    const { readFamilyIndex, speciesNames } = await import('../../test/familyTreeCorpus')
    const all = speciesNames(readFamilyIndex())
    // Whole families at the head of the asset (a split family on the first step)
    // and a spread after them (many families, many steps).
    H.observations = [...all.slice(0, EXPAND_CHUNK_SPECIES * 2), ...all.filter((_, i) => i % 25 === 0).slice(0, EXPAND_CHUNK_SPECIES * 2)]
      .filter((n, i, a) => a.indexOf(n) === i).map((n, i) => obs(n, '2020-01-01', `S${i}`))
    render(<FamilyTreeTab onGoToSettings={() => {}} showing />)
    await vi.waitFor(() => expect(document.querySelector('.sr-ft-glance')).not.toBeNull())
  }
  it('rows Expand all mounts arrive without the entrance, and a single press keeps it', async () => {
    await bigRoster()
    fireEvent.click(screen.getByRole('button', { name: 'Expand all' }))
    await act(async () => { vi.runAllTimers() })
    expect(document.querySelectorAll('.sr-ft-open').length).toBeGreaterThan(3)
    expect(document.querySelector('.sr-ft-open.is-new')).toBeNull()
    expect(halfMounted()).toBe(0)
    fireEvent.click(screen.getByRole('button', { name: 'Collapse all' }))
    fireEvent.click(document.querySelectorAll<HTMLElement>('.sr-ft-frow')[0])
    expect(document.querySelector('.sr-ft-open.is-new')).not.toBeNull()
  })
  it('the first step mounts part of a split family; a toggle mid-run ends the run with no family half mounted', async () => {
    await bigRoster()
    fireEvent.click(screen.getByRole('button', { name: 'Expand all' }))
    const mounted = document.querySelectorAll('.sr-ft-sp').length
    expect(mounted).toBeLessThanOrEqual(EXPAND_CHUNK_SPECIES)
    expect(mounted).toBeGreaterThan(0)
    const closed = [...document.querySelectorAll<HTMLElement>('.sr-ft-frow')].find(r => r.getAttribute('aria-expanded') === 'false')!
    fireEvent.click(closed)
    await act(async () => { vi.runAllTimers() })
    expect(halfMounted()).toBe(0)
    expect([...document.querySelectorAll('.sr-ft-frow')].some(r => r.getAttribute('aria-expanded') === 'false')).toBe(true)
  })
  it('a find reveal mid-run ends the run with no family half mounted', async () => {
    Element.prototype.scrollIntoView = vi.fn()
    await bigRoster()
    fireEvent.click(screen.getByRole('button', { name: 'Expand all' }))
    const input = screen.getByRole('combobox', { name: 'Find a species, genus, family, or order' })
    fireEvent.change(input, { target: { value: 'tinamou' } })
    fireEvent.mouseDown(within(screen.getByRole('listbox')).getAllByRole('option')[0])
    await act(async () => { vi.runAllTimers() })
    expect(halfMounted()).toBe(0)
  })
})

describe('requests and the lifecycle (QA-50, QA-84)', () => {
  it('posts one codes batch for the world roster, and no control change posts again', async () => {
    await ready()
    await waitFor(() => expect(H.post).toHaveBeenCalledTimes(1))
    expect(H.post.mock.calls[0][0]).toBe('/taxonomy/codes')
    fireEvent.change(screen.getByRole('combobox', { name: 'Year' }), { target: { value: '2021' } })
    fireEvent.click(within(screen.getByRole('group', { name: 'Names shown' })).getByRole('button', { name: 'Common' }))
    fireEvent.click(screen.getByRole('button', { name: 'Expand all' }))
    await act(async () => { await new Promise(r => setTimeout(r, 20)) })
    expect(H.post).toHaveBeenCalledTimes(1)
  })
  it('the tab installs no document or window listener', async () => {
    const doc = vi.spyOn(document, 'addEventListener')
    const win = vi.spyOn(window, 'addEventListener')
    const r = await ready({ showing: false })
    r.rerender(<FamilyTreeTab onGoToSettings={() => {}} showing />)
    const mine = (calls: unknown[][]) => calls.filter(c => ['keydown', 'wheel', 'pointerdown', 'pointermove', 'scroll', 'resize'].includes(String(c[0])))
    expect(mine(doc.mock.calls)).toEqual([])
    expect(mine(win.mock.calls)).toEqual([])
  })
})

// -- Slice B: the view switch, Find and the tree --------------------------------

/** jsdom has no layout: the tree box reports a desktop size and a
 *  ResizeObserver that reports once on observe, so the layout runs. */
function layoutShims(boxW = 1100, boxH = 424) {
  const dims = (el: Element, wide: boolean) => (el.classList.contains('sr-ft-box') ? (wide ? boxW : boxH) : 0)
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) { return dims(this, true) })
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function (this: HTMLElement) { return dims(this, false) })
  vi.stubGlobal('ResizeObserver', class {
    private cb: () => void
    constructor(cb: () => void) { this.cb = cb }
    observe() { queueMicrotask(() => this.cb()) }
    disconnect() {}
  })
}

describe('the view switch (FR-53, D-35)', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })
  it('first use: the tree wider than the still tier, the table at or under it, and nothing is written', async () => {
    H.phone = false
    layoutShims()
    await ready()
    expect(await screen.findByRole('tree')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Tree' }).getAttribute('aria-pressed')).toBe('true')
    cleanup()
    H.phone = true
    await ready()
    expect(screen.getByRole('button', { name: 'Table' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.queryByRole('tree')).toBeNull()
    expect(H.setSetting.mock.calls.filter(c => c[0] === FAMILY_TREE_VIEW_SETTING)).toEqual([])
  })
  it('a choice writes one setting under its own key, and a remount restores it on every tier', async () => {
    layoutShims()
    await ready()
    fireEvent.click(screen.getByRole('button', { name: 'Tree' }))
    expect(await screen.findByRole('tree')).toBeTruthy()
    await waitFor(() => expect(H.setSetting).toHaveBeenCalledWith(FAMILY_TREE_VIEW_SETTING, 'diagram'))
    cleanup()
    H.getSetting.mockImplementation(async key => (key === FAMILY_TREE_VIEW_SETTING ? 'diagram' : null))
    await ready()
    expect(await screen.findByRole('tree')).toBeTruthy()
  })
})

describe('the tree (FR-55 to FR-70)', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })
  async function tree() {
    H.phone = false
    layoutShims()
    await ready()
    const t = await screen.findByRole('tree')
    await waitFor(() => expect(t.querySelectorAll('[role="treeitem"]').length).toBeGreaterThan(0))
    return t
  }
  it('the headline\'s container holds the headline alone, never the tree\'s host (D-74)', async () => {
    await tree()
    const wrap = document.querySelector('.sr-ft-glance-wrap')!
    expect(wrap.children).toHaveLength(1)
    expect(wrap.firstElementChild!.matches('dl.sr-ft-glance')).toBe(true)
    const host = document.querySelector('.sr-ft-host')!
    expect(host).not.toBeNull()
    expect(wrap.contains(host)).toBe(false)
    expect(host.contains(wrap)).toBe(false)
  })
  it('is one tab stop: the tree carries the one tabIndex and its items none, no link and no button', async () => {
    const t = await tree()
    expect(t.getAttribute('tabindex')).toBe('0')
    const items = [...t.querySelectorAll('[role="treeitem"]')]
    for (const it of items) {
      expect(it.hasAttribute('tabindex')).toBe(false)
      expect(it.querySelector('a, button, [tabindex]')).toBeNull()
      expect(it.getAttribute('id')).toMatch(/-n-\d+$/)
    }
    expect(t.getAttribute('aria-label')).toBe('Family tree of your species')
    expect(document.getElementById(t.getAttribute('aria-describedby')!)?.textContent).toBe('The Table view holds the same information as a list.')
  })
  it('arrival is every branch open, with species named, and each item names its level and figures', async () => {
    const t = await tree()
    const labels = [...t.querySelectorAll('[role="treeitem"]')].map(e => e.getAttribute('aria-label'))
    expect(labels).toContain('Species, Snow Goose, Anser caerulescens')
    expect(labels.some(l => /^Order, Waterfowl, Anseriformes, \d+ of [\d,]+ species$/.test(l ?? ''))).toBe(true)
  })
  it('a key moves the active node; aria-activedescendant resolves; the readout follows', async () => {
    const t = await tree()
    fireEvent.keyDown(t, { key: 'ArrowDown' })
    await waitFor(() => expect(t.getAttribute('aria-activedescendant')).not.toBeNull())
    const active = document.getElementById(t.getAttribute('aria-activedescendant')!)!
    expect(active.getAttribute('role')).toBe('treeitem')
    expect(active.getAttribute('aria-selected')).toBe('true')
    const readout = screen.getByRole('region', { name: 'Selected' })
    expect(within(readout).getByText('Order')).toBeTruthy()
  })
  it('a species in the readout renders through BirdName with its lineage as buttons', async () => {
    const t = await tree()
    const item = [...t.querySelectorAll('[role="treeitem"]')].find(e => e.getAttribute('aria-label')?.startsWith('Species, Snow Goose'))!
    // A touch press acts on click; a mouse press acts on a pointer-up that moved under 4px.
    fireEvent.pointerDown(item, { pointerType: 'touch' })
    fireEvent.click(item)
    const readout = screen.getByRole('region', { name: 'Selected' })
    await waitFor(() => expect(within(readout).getByRole('button', { name: 'Snow Goose' })).toBeTruthy())
    fireEvent.click(within(readout).getByRole('button', { name: 'Snow Goose' }))
    expect(openSpecies).toHaveBeenCalledWith('Snow Goose')
    expect(within(readout).getByText('Genus')).toBeTruthy()
    expect(within(readout).getByText('Family')).toBeTruthy()
  })
  it('the tools render in the toolbar; at its limit a zoom tool is aria-disabled and stays a tab stop (D-38(b), QA-80)', async () => {
    const t = await tree()
    const tools = screen.getByRole('toolbar', { name: 'View tools' })
    const zoomIn = within(tools).getByRole('button', { name: 'Zoom in' }) as HTMLButtonElement
    expect(zoomIn.getAttribute('aria-disabled')).toBe('true')
    expect(zoomIn.disabled).toBe(false)
    expect(zoomIn.getAttribute('tabindex')).toBe('0')
    fireEvent.click(within(tools).getByRole('button', { name: 'Collapse all' }))
    await waitFor(() => expect([...t.querySelectorAll('[role="treeitem"]')].every(e => e.getAttribute('aria-level') === '1')).toBe(true))
  })
  it('the readout adds the tab stops design-spec 9.9 counts for each kind, in its order (QA-86)', async () => {
    const t = await tree()
    const readout = screen.getByRole('region', { name: 'Selected' })
    const stops = () => [...readout.querySelectorAll<HTMLElement>('a[href], button')].filter(e => e.getAttribute('tabindex') === '0' && !(e as HTMLButtonElement).disabled)
    const press = (label: RegExp) => {
      const item = [...t.querySelectorAll('[role="treeitem"]')].find(e => label.test(e.getAttribute('aria-label') ?? ''))!
      fireEvent.pointerDown(item, { pointerType: 'touch' })
      fireEvent.click(item)
    }
    expect(stops()).toHaveLength(0)
    press(/^Family, Ducks, Geese, and Waterfowl/)
    await waitFor(() => expect(stops()).toHaveLength(4))
    expect(stops().map(e => e.getAttribute('aria-label') ?? e.textContent)).toEqual([
      'Waterfowl', 'Collapse', 'Focus', 'Open Ducks, Geese, and Waterfowl on Birds of the World (opens in a new tab)',
    ])
    press(/^Order, Waterfowl/)
    await waitFor(() => expect(stops().map(e => e.textContent)).toEqual(['Collapse', 'Focus']))
    press(/^Species, Snow Goose/)
    await waitFor(() => expect(stops()).toHaveLength(6))
  })
  it('the family link opens its own Birds of the World URL once in the Tauri apps (FR-50, QA-47)', async () => {
    const { installTauriOpener } = await import('../../test/tauriOpener')
    const t = await tree()
    const item = [...t.querySelectorAll('[role="treeitem"]')].find(e => /^Family, Ducks, Geese/.test(e.getAttribute('aria-label') ?? ''))!
    fireEvent.pointerDown(item, { pointerType: 'touch' })
    fireEvent.click(item)
    const link = await screen.findByRole('link', { name: 'Open Ducks, Geese, and Waterfowl on Birds of the World (opens in a new tab)' }) as HTMLAnchorElement
    expect(link.getAttribute('href')).toBe('https://birdsoftheworld.org/bow/species/anatid1/cur/introduction')
    const opener = installTauriOpener()
    try {
      expect(fireEvent.click(link)).toBe(false)
      expect(opener.calls()).toEqual([{ url: link.href, via: 'own' }])
    } finally {
      opener.uninstall()
    }
  })
  it('each zoom tool pressed to its limit keeps focus, and a press at the limit does nothing (QA-80)', async () => {
    await tree()
    const tools = screen.getByRole('toolbar', { name: 'View tools' })
    for (const name of ['Zoom out', 'Zoom in', 'Fit the whole tree']) {
      const b = within(tools).getByRole('button', { name }) as HTMLButtonElement
      b.focus()
      for (let i = 0; i < 20 && b.getAttribute('aria-disabled') !== 'true'; i++) fireEvent.click(b)
      await waitFor(() => expect(b.getAttribute('aria-disabled')).toBe('true'))
      const zoom = document.querySelector('.sr-ft-zoomval')!.textContent
      fireEvent.click(b)
      expect(document.querySelector('.sr-ft-zoomval')!.textContent).toBe(zoom)
      expect(b.disabled).toBe(false)
      expect(document.activeElement).toBe(b)
    }
  })
  it('no order or genus in either view carries an outside link; a family\'s link is in both (QA-49, D-55(a))', async () => {
    const t = await tree()
    expect(t.querySelector('a')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Table' }))
    await waitFor(() => expect(document.querySelector('.sr-ft-list')).not.toBeNull())
    expect(document.querySelector('.sr-ft-oband a, .sr-ft-genus a, .sr-ft-frow a')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Expand all' }))
    await waitFor(() => expect(document.querySelector('.sr-ft-unplaced .sr-ft-open')).not.toBeNull())
    // First line of each opened family, never in Not placed.
    const blocks = [...document.querySelectorAll('.sr-ft-fblock .sr-ft-open')].filter(b => !b.closest('.sr-ft-unplaced'))
    expect(blocks.length).toBeGreaterThan(0)
    for (const b of blocks) {
      expect(b.firstElementChild?.classList.contains('sr-ft-open-links')).toBe(true)
      expect(b.querySelectorAll('.sr-ft-open-links')).toHaveLength(1)
      expect(b.querySelectorAll('.sr-ft-open-links a')).toHaveLength(1)
    }
    expect(document.querySelector('.sr-ft-unplaced .sr-ft-open-links')).toBeNull()
  })
  it('the table holds every level, count and link the tree offers (QA-79\'s set comparison)', async () => {
    const t = await tree()
    const items = () => [...t.querySelectorAll('[role="treeitem"]')]
    const familyLabels = items().filter(e => e.getAttribute('aria-level') === '2').map(e => e.getAttribute('aria-label')!)
    const genusLabels = items().filter(e => e.getAttribute('aria-level') === '3').map(e => e.getAttribute('aria-label')!)
    const speciesLabels = items().filter(e => e.getAttribute('aria-level') === '4').map(e => e.getAttribute('aria-label')!)
    expect(familyLabels.length).toBeGreaterThan(1)
    // The links the tree offers: a family's readout link, read by selecting each family.
    const treeLinks = new Set<string>()
    for (const label of familyLabels) {
      const item = items().find(e => e.getAttribute('aria-label') === label)!
      fireEvent.pointerDown(item, { pointerType: 'touch' })
      fireEvent.click(item)
      const link = await within(screen.getByRole('region', { name: 'Selected' })).findByRole('link')
      treeLinks.add(`${link.getAttribute('href')} | ${link.getAttribute('aria-label')}`)
    }
    fireEvent.click(screen.getByRole('button', { name: 'Table' }))
    await waitFor(() => expect(document.querySelector('.sr-ft-list')).not.toBeNull())
    fireEvent.click(screen.getByRole('button', { name: 'Expand all' }))
    await waitFor(() => expect(document.querySelectorAll('.sr-ft-fblock .sr-ft-open').length).toBeGreaterThanOrEqual(familyLabels.length))
    const rowLabels = [...document.querySelectorAll('.sr-ft-frow')].map(r => r.getAttribute('aria-label') ?? '')
    for (const l of familyLabels) {
      const names = l.replace(/^Family, /, '')
      expect(rowLabels.some(r => r.startsWith(`${names}, `)), names).toBe(true)
    }
    const genusLines = [...document.querySelectorAll('.sr-ft-genus')].map(g => g.textContent!.replace(/\s+/g, ' '))
    for (const l of genusLabels) {
      const m = /^Genus, (.+), (\d+) species$/.exec(l)!
      const lead = m[1].split(', ')[0]
      expect(genusLines.some(g => g.includes(lead) && g.includes(`${m[2]} species`)), l).toBe(true)
    }
    const rows = [...document.querySelectorAll('.sr-ft-sp')].map(r => r.textContent ?? '')
    for (const l of speciesLabels) {
      const lead = l.replace(/^Species, /, '').split(', ')[0]
      expect(rows.some(r => r.includes(lead)), lead).toBe(true)
    }
    const tableLinks = new Set([...document.querySelectorAll('.sr-ft-open-links a')].map(a => `${a.getAttribute('href')} | ${a.getAttribute('aria-label')}`))
    expect(treeLinks.size).toBeGreaterThan(0)
    expect(tableLinks).toEqual(treeLinks)
  })
  it('the table\'s family link opens its own URL once in the Tauri apps (FR-50)', async () => {
    const { installTauriOpener } = await import('../../test/tauriOpener')
    await ready()
    fireEvent.click(familyRow(/^Ducks, Geese, and Waterfowl/))
    const link = await screen.findByRole('link', { name: 'Open Ducks, Geese, and Waterfowl on Birds of the World (opens in a new tab)' }) as HTMLAnchorElement
    expect(link.getAttribute('href')).toBe('https://birdsoftheworld.org/bow/species/anatid1/cur/introduction')
    expect(link.closest('.sr-ft-open-links')).not.toBeNull()
    const opener = installTauriOpener()
    try {
      expect(fireEvent.click(link)).toBe(false)
      expect(opener.calls()).toEqual([{ url: link.href, via: 'own' }])
    } finally {
      opener.uninstall()
    }
  })
  it('a change made inside the save pause survives switching to the table and back', async () => {
    const t = await tree()
    fireEvent.click(within(screen.getByRole('toolbar', { name: 'View tools' })).getByRole('button', { name: 'Collapse all' }))
    await waitFor(() => expect([...t.querySelectorAll('[role="treeitem"]')].every(e => e.getAttribute('aria-level') === '1')).toBe(true))
    // At once, well inside the 250 ms pause before the session is handed over.
    fireEvent.click(screen.getByRole('button', { name: 'Table' }))
    expect(screen.queryByRole('tree')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Tree' }))
    const back = await screen.findByRole('tree')
    await waitFor(() => expect(back.querySelectorAll('[role="treeitem"]').length).toBeGreaterThan(0))
    expect([...back.querySelectorAll('[role="treeitem"]')].every(e => e.getAttribute('aria-level') === '1')).toBe(true)
  })
})

describe('Find (FR-65 to FR-67)', () => {
  // jsdom implements no scrolling; the reveal's scroll is the real-engine probe's.
  beforeEach(() => { Element.prototype.scrollIntoView = vi.fn() })
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })
  it('is a combobox in both views; a result opens its family in the table and focuses the row', async () => {
    await ready()
    const input = screen.getByRole('combobox', { name: 'Find a species, genus, family, or order' })
    fireEvent.change(input, { target: { value: 'robin' } })
    const list = screen.getByRole('listbox', { name: 'Matching species, genera, families, and orders' })
    const opt = within(list).getAllByRole('option')[0]
    expect(opt.textContent).toContain('American Robin')
    expect(opt.id).toMatch(/-find-opt-0$/)
    fireEvent.mouseDown(opt)
    await waitFor(() => expect((document.activeElement as HTMLElement | null)?.textContent).toBe('American Robin'))
  })
  it('Escape closes the list only and is consumed while it is open', async () => {
    await ready()
    const outer = vi.fn()
    document.addEventListener('keydown', outer)
    const input = screen.getByRole('combobox', { name: 'Find a species, genus, family, or order' })
    fireEvent.change(input, { target: { value: 'goose' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(outer).not.toHaveBeenCalled()
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(outer).toHaveBeenCalledTimes(1)
    document.removeEventListener('keydown', outer)
  })
  it('in the tree a result opens its lineage, makes it active and moves focus to the tree', async () => {
    H.phone = false
    layoutShims()
    await ready()
    const t = await screen.findByRole('tree')
    await waitFor(() => expect(t.querySelectorAll('[role="treeitem"]').length).toBeGreaterThan(0))
    fireEvent.click(screen.getByRole('button', { name: 'Collapse all' }))
    const input = screen.getByRole('combobox', { name: 'Find a species, genus, family, or order' })
    fireEvent.change(input, { target: { value: 'canada goose' } })
    fireEvent.mouseDown(within(screen.getByRole('listbox')).getAllByRole('option')[0])
    await waitFor(() => expect(document.activeElement).toBe(t))
    await waitFor(() => {
      const id = t.getAttribute('aria-activedescendant')
      expect(id).not.toBeNull()
      expect(document.getElementById(id!)?.getAttribute('aria-label')).toMatch(/^Species, Canada Goose/)
    })
  })
})

// -- QA-78's tab leg: a files-epoch change releases the previous file ---------
// With the tree mounted (the lazy chunk and its layout included), a files-epoch
// change to a second file must leave nothing holding the first file's arrays or
// any model built from them. The data caches are mocked, so what is measured is
// the tab's own modules; the real caches release a parse on clear and replace
// (paletteLocationsLifetime.test.ts). The mocks' own call records are cleared
// before the collection, since vi.fn keeps every argument and result.
v8.setFlagsFromString('--expose-gc')
const gc = vm.runInNewContext('gc') as (() => void) | undefined
async function collect(): Promise<void> {
  for (let i = 0; i < 4; i++) {
    await act(async () => { await new Promise<void>(r => setTimeout(r, 0)) })
    gc!()
  }
}
function seedFirstFile(): { obs: WeakRef<object>; ml: WeakRef<object> } {
  const first = [obs('Snow Goose', '2019-05-02', 'S1'), obs('American Robin', '2020-01-01', 'S3')]
  const firstMl = [ml('Snow Goose', 'Photo', '2019-05-02', 'S1')]
  H.observations = first
  H.mlRows = firstMl
  return { obs: new WeakRef(first), ml: new WeakRef(firstMl) }
}

describe('a files-epoch change releases the previous file and its models (QA-78, NFR-05)', () => {
  afterEach(() => { vi.unstubAllGlobals() })
  it('this process can force a collection (the suite fails rather than skips without it)', () => {
    expect(typeof gc).toBe('function')
  })
  it('after the change, the first file\'s arrays and every model built from them are collected; the shown model is alive', async () => {
    H.phone = false
    H.models = []
    layoutShims()
    const first = seedFirstFile()
    await ready()
    const t = await screen.findByRole('tree')
    await waitFor(() => expect(t.querySelectorAll('[role="treeitem"]').length).toBeGreaterThan(0))
    expect(tileValue(0)).toBe('2')
    const firstModels = H.models.slice()
    expect(firstModels.length).toBeGreaterThan(0)

    H.observations = BASE
    H.mlRows = [ml('Canada Goose', 'Photo', '2021-03-09', 'S2')]
    act(() => notifyFilesChanged())
    await waitFor(() => expect(tileValue(0)).toBe('5'))
    // Two more renders, so neither of React's fiber buffers keeps the first state.
    fireEvent.change(screen.getByRole('combobox', { name: 'Year' }), { target: { value: '2021' } })
    fireEvent.change(screen.getByRole('combobox', { name: 'Year' }), { target: { value: '' } })
    expect(tileValue(0)).toBe('5')
    // Past the tree's session flush pause, so no pending timer holds a closure.
    await act(async () => { await new Promise<void>(r => setTimeout(r, 300)) })
    vi.mocked(loadEbirdObservations).mockClear()
    vi.mocked(loadMLExport).mockClear()
    vi.mocked(deriveFirstSightings).mockClear()
    await collect()

    expect(first.obs.deref(), 'the first file\'s observations').toBeUndefined()
    expect(first.ml.deref(), 'the first file\'s ML rows').toBeUndefined()
    firstModels.forEach((r, i) => expect(r.deref(), `the first file's model ${i}`).toBeUndefined())
    // CONTROL: the model on screen is held, so the collection is not blind.
    expect(H.models.slice(firstModels.length).some(r => r.deref() !== undefined)).toBe(true)
    expect(screen.getByRole('tree')).toBeTruthy()
  })
})

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
  // The still tier (useIsPhone). True by default so the Slice A rows meet the
  // table, the first view at or under the tier (FR-53); the tree rows set it.
  phone: true,
}))

vi.mock('../../lib/storage', () => ({
  storage: { getFilesStatus: H.getFilesStatus, getSetting: H.getSetting, setSetting: H.setSetting, deleteSetting: H.deleteSetting },
}))
vi.mock('../../lib/observationsCache', () => ({
  loadEbirdObservations: vi.fn(async () => (H.ebirdNull ? null : { headerLine: '', observations: H.observations })),
}))
vi.mock('../../lib/mlExportCache', () => ({
  loadMLExport: vi.fn(async () => (H.mlRows ? { entries: [], mediaMap: {}, rows: H.mlRows } : null)),
}))
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
  it('a failed family asset shows its own message, lists nothing as unplaced, and is tried again when the tab is shown again (QA-14)', async () => {
    H.assetFails = 1
    const r = render(<FamilyTreeTab onGoToSettings={() => {}} showing />)
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe(FAMILY_DATA_ERROR))
    expect(document.querySelector('.sr-ft-list')).toBeNull()
    expect(screen.queryByText('Not placed')).toBeNull()
    r.rerender(<FamilyTreeTab onGoToSettings={() => {}} showing={false} />)
    r.rerender(<FamilyTreeTab onGoToSettings={() => {}} showing />)
    await waitFor(() => expect(document.querySelector('.sr-ft-glance')).not.toBeNull())
    expect(vi.mocked(loadFamilyIndex).mock.calls.length).toBe(2)
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
    const before = tileValue(0)
    fireEvent.click(sw)
    expect(Number(tileValue(0))).toBeGreaterThanOrEqual(Number(before))
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
    H.observations = all.slice(0, EXPAND_CHUNK_SPECIES * 3).map((n, i) => obs(n, '2020-01-01', `S${i}`))
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
  it('the tools render in the toolbar; Zoom in is disabled at full zoom, and Collapse all closes every branch', async () => {
    const t = await tree()
    const tools = screen.getByRole('toolbar', { name: 'View tools' })
    expect((within(tools).getByRole('button', { name: 'Zoom in' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(within(tools).getByRole('button', { name: 'Collapse all' }))
    await waitFor(() => expect([...t.querySelectorAll('[role="treeitem"]')].every(e => e.getAttribute('aria-level') === '1')).toBe(true))
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

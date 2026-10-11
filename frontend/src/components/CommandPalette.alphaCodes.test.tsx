/// <reference types="node" />
// @vitest-environment jsdom
//
// Species code search in Search (species-code-search; PRD QA-01, QA-22,
// QA-31 to QA-36, QA-50). Only `lib/storage` and `lib/transport` are mocked,
// as in `CommandPalette.test.tsx`: the observations cache, the species index,
// the row builder, the matcher and the alpha-code join are REAL, so a backup
// replaced through the files epoch (QA-35) travels the same seam it does in
// production. The code data is driven through the loader's importer seam; the
// table itself is always the REAL committed asset.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor, act } from '@testing-library/react'

const H = vi.hoisted(() => ({ getFilesStatus: vi.fn(), readFile: vi.fn(), tGet: vi.fn(), tPost: vi.fn() }))
vi.mock('../lib/storage', () => ({ storage: { getFilesStatus: H.getFilesStatus, readFile: H.readFile } }))
vi.mock('../lib/transport', () => ({ transport: { get: H.tGet, post: H.tPost }, TransportError: class extends Error {} }))

import { CommandPalette } from './CommandPalette'
import { clearEbirdObservationsCache } from '../lib/observationsCache'
import { _resetSpeciesIndexMemoForTests } from '../lib/speciesIndex'
import { notifyFilesChanged } from '../lib/filesChanged'
import { PALETTE_COPY } from '../lib/paletteCopy'
import { EBIRD_BACKUP_LOAD_ERROR } from './setupCopy'
import { _resetAlphaCodesForTests, _setAlphaCodesImporterForTests, loadAlphaCodes } from '../lib/alphaCodesAsset'
import type { PaletteNavItem } from '../lib/paletteRows'
import type { TabIcon } from '../lib/tabIcons'

type Module = { default: unknown }
const realModule = () => import('../assets/ebird-alpha-codes.json') as Promise<Module>

const icon = (() => <svg />) as unknown as TabIcon
const ITEMS: PaletteNavItem[] = [
  { id: 'weather', label: 'Weather', icon },
  { id: 'birding-stats', label: 'Statistics', icon },
  { id: 'species-detail', label: 'Species Detail', icon },
  { id: 'checklists', label: 'Checklists', icon },
  { id: 'comparer', label: 'List Comparer', icon },
  { id: 'settings', label: 'Settings', icon },
]

const HEADER = 'Submission ID,Common Name,Scientific Name,Taxonomic Order,Date'
const csv = (...species: [string, string][]) =>
  [HEADER, ...species.map(([n, s], i) => `S${i},${n},${s},${100 + i},2024-05-01`)].join('\n')
const BACKUP = csv(
  ['Yellow-rumped Warbler', 'Setophaga coronata'],
  ['Yellow-rumped Warbler (Myrtle)', 'Setophaga coronata coronata'],
  ["Yellow-rumped Warbler (Audubon's)", 'Setophaga coronata auduboni'],
  ['Northern Yellow Warbler', 'Setophaga aestiva'],
  ['Cape May Warbler', 'Setophaga tigrina'],
  ["Anna's Hummingbird", 'Calypte anna'],
  ['Little Stint', 'Calidris minuta'],
  ['Snow Goose', 'Anser caerulescens'],
  ['Snowy Owl', 'Bubo scandiacus'],
)
const STORED = { ebird: { filename: 'MyEBirdData.csv', uploadedAt: '2024-06-01' }, ml: null }

function open() {
  const onOpenSpecies = vi.fn()
  const onSelectTab = vi.fn()
  const view = render(<CommandPalette items={ITEMS} onSelectTab={onSelectTab} onOpenSpecies={onOpenSpecies} onClose={() => {}} />)
  return { ...view, onOpenSpecies, onSelectTab }
}
const input = () => screen.getByRole('combobox') as HTMLInputElement
const type = (value: string) => fireEvent.change(input(), { target: { value } })
const speciesNames = () => screen.queryAllByRole('option')
  .map(o => o.querySelector('.sr-palette-row-sci') ? o.querySelector('.sr-palette-row-name')?.textContent ?? '' : null)
  .filter((n): n is string => n !== null)
const rowNames = () => screen.queryAllByRole('option').map(o => o.querySelector('.sr-palette-row-name')?.textContent ?? '')
async function speciesReady() {
  await waitFor(() => expect(screen.queryByText(PALETTE_COPY.speciesLoading)).toBeNull())
}
async function codesLoaded() {
  await act(async () => { await loadAlphaCodes() })
}
function deferredImporter() {
  let open!: () => void
  const gate = new Promise<void>(resolve => { open = resolve })
  _setAlphaCodesImporterForTests(async () => { await gate; return realModule() })
  return { release: async () => { open(); await codesLoaded() } }
}

beforeEach(() => {
  for (const fn of Object.values(H)) fn.mockReset()
  H.getFilesStatus.mockImplementation(async () => STORED)
  H.readFile.mockImplementation(async () => BACKUP)
  H.tGet.mockImplementation(async () => ({}))
  H.tPost.mockImplementation(async () => ({}))
  clearEbirdObservationsCache()
  _resetSpeciesIndexMemoForTests()
  _resetAlphaCodesForTests()
})
afterEach(() => { cleanup(); _resetAlphaCodesForTests() })

describe('a code in Search', () => {
  it('`yrwa` lists the bird and its forms first, and Enter opens Species Detail on it (QA-01)', async () => {
    _setAlphaCodesImporterForTests(realModule)
    const { onOpenSpecies } = open()
    await speciesReady()
    await codesLoaded()
    type('yrwa')
    expect(speciesNames()).toEqual(['Yellow-rumped Warbler', "Yellow-rumped Warbler (Audubon's)", 'Yellow-rumped Warbler (Myrtle)'])
    fireEvent.keyDown(input(), { key: 'Enter' })
    expect(onOpenSpecies).toHaveBeenCalledWith('Yellow-rumped Warbler')
  })

  it('destinations still lead, and Enter opens the first one (QA-22)', async () => {
    _setAlphaCodesImporterForTests(realModule)
    const { onSelectTab } = open()
    await speciesReady()
    await codesLoaded()
    type('list')
    expect(rowNames()).toEqual(['Checklists', 'List Comparer', 'Little Stint'])
    fireEvent.keyDown(input(), { key: 'Enter' })
    expect(onSelectTab).toHaveBeenCalledWith('checklists')
  })

  it('every aria-activedescendant resolves to an element under a code query (QA-50)', async () => {
    _setAlphaCodesImporterForTests(realModule)
    open()
    await speciesReady()
    await codesLoaded()
    type('yrwa')
    for (let i = 0; i < 4; i++) {
      fireEvent.keyDown(input(), { key: 'ArrowDown' })
      const id = input().getAttribute('aria-activedescendant')
      expect(id).toBeTruthy()
      expect(document.getElementById(id!)?.getAttribute('role')).toBe('option')
    }
  })

  it('hostile backup names render, take no codes, and leave codes working (QA-36)', async () => {
    _setAlphaCodesImporterForTests(realModule)
    H.readFile.mockImplementation(async () => csv(
      ['__proto__', 'X x'], ['constructor', 'X x'], ['toString', 'X x'], ['valueOf', 'X x'], ['hasOwnProperty', 'X x'],
      ['Yellow-rumped Warbler', 'Setophaga coronata'],
    ))
    open()
    await speciesReady()
    await codesLoaded()
    type('yrwa')
    expect(speciesNames()).toEqual(['Yellow-rumped Warbler'])
    type('constructor')
    expect(speciesNames()).toEqual(['constructor'])
  })
})

describe('never wait, loading once, and failure', () => {
  it('a load that never settles: destinations render, names match, a code shows today\'s empty state (QA-31)', async () => {
    _setAlphaCodesImporterForTests(() => new Promise<Module>(() => {}))
    open()
    expect(rowNames()).toEqual(ITEMS.map(i => i.label))
    await speciesReady()
    type('calypte')
    expect(speciesNames()).toEqual(["Anna's Hummingbird"])
    type('yrwa')
    expect(speciesNames()).toEqual([])
    expect(screen.getByText(PALETTE_COPY.noMatches)).toBeTruthy()
  })

  it('nothing loads before Search opens, and once across five opens (QA-32)', async () => {
    let calls = 0
    _setAlphaCodesImporterForTests(() => { calls += 1; return realModule() })
    expect(calls).toBe(0)
    for (let i = 0; i < 5; i++) {
      const view = open()
      // Opening Search is what starts the load: nothing in this test calls the
      // loader before this line.
      expect(calls).toBe(1)
      for (const v of ['y', 'yr', 'yrw', 'yrwa']) type(v)
      view.unmount()
    }
    await codesLoaded()
    expect(calls).toBe(1)
  })

  it.each([
    ['a rejected import', () => Promise.reject(new Error('chunk failed'))],
    ['a wrong shape', async () => ({ default: { v: 1, version: 2027 } })],
  ])('%s: names only, the species-half sentences unchanged, no new text, no retry (QA-34)', async (_label, importer) => {
    let calls = 0
    _setAlphaCodesImporterForTests(() => { calls += 1; return importer() as Promise<Module> })
    const view = open()
    await speciesReady()
    await codesLoaded()
    type('yrwa')
    expect(speciesNames()).toEqual([])
    expect(screen.getByText(PALETTE_COPY.noMatches)).toBeTruthy()
    expect(document.querySelector('[role="alert"]')?.textContent ?? '').toBe('')
    type('warbler')
    expect(speciesNames()).toEqual(['Cape May Warbler', 'Northern Yellow Warbler', 'Yellow-rumped Warbler', "Yellow-rumped Warbler (Audubon's)", 'Yellow-rumped Warbler (Myrtle)'])
    view.unmount()
    open()
    await speciesReady()
    await codesLoaded()
    expect(calls).toBe(1)
  })

  it('the unloadable-backup sentence is unaffected by a failed code load (QA-34)', async () => {
    _setAlphaCodesImporterForTests(() => Promise.reject(new Error('chunk failed')))
    H.readFile.mockImplementation(async () => { throw new Error('read failed') })
    open()
    await waitFor(() => expect(screen.getByText(EBIRD_BACKUP_LOAD_ERROR)).toBeTruthy())
  })
})

describe('the code data arriving while Search is open (QA-33, FR-25)', () => {
  it('rows update for the typed query without retyping', async () => {
    const { release } = deferredImporter()
    open()
    await speciesReady()
    type('yrwa')
    expect(speciesNames()).toEqual([])
    await release()
    expect(speciesNames()).toEqual(['Yellow-rumped Warbler', "Yellow-rumped Warbler (Audubon's)", 'Yellow-rumped Warbler (Myrtle)'])
  })

  it('a highlighted species row is cleared when the rows change; Enter then opens the code bird', async () => {
    const { release } = deferredImporter()
    const { onOpenSpecies } = open()
    await speciesReady()
    type('snow')
    expect(speciesNames()).toEqual(['Snow Goose', 'Snowy Owl'])
    fireEvent.keyDown(input(), { key: 'ArrowDown' })
    expect(input().getAttribute('aria-activedescendant')).toBeTruthy()
    await release()
    expect(speciesNames()).toEqual(['Snowy Owl', 'Snow Goose'])
    expect(input().getAttribute('aria-activedescendant')).toBeNull()
    fireEvent.keyDown(input(), { key: 'Enter' })
    expect(onOpenSpecies).toHaveBeenCalledWith('Snowy Owl')
  })

  it('a highlighted destination keeps its highlight', async () => {
    const { release } = deferredImporter()
    open()
    await speciesReady()
    type('list')
    fireEvent.keyDown(input(), { key: 'ArrowDown' })
    const before = input().getAttribute('aria-activedescendant')
    expect(document.getElementById(before!)?.textContent).toContain('Checklists')
    await release()
    expect(input().getAttribute('aria-activedescendant')).toBe(before)
  })

  it('a query whose rows do not change keeps its highlight', async () => {
    const { release } = deferredImporter()
    open()
    await speciesReady()
    type('calypte')
    fireEvent.keyDown(input(), { key: 'ArrowDown' })
    const before = input().getAttribute('aria-activedescendant')
    expect(before).toBeTruthy()
    await release()
    expect(input().getAttribute('aria-activedescendant')).toBe(before)
  })
})

describe('a replaced or cleared backup reaches code matching (QA-35, FR-27)', () => {
  async function replaceBackup(content: string) {
    H.readFile.mockImplementation(async () => content)
    await act(async () => {
      clearEbirdObservationsCache()
      notifyFilesChanged()
      await Promise.resolve()
    })
  }

  it('a backup without the bird stops matching its code; one that adds a bird matches its code, no relaunch', async () => {
    _setAlphaCodesImporterForTests(realModule)
    open()
    await speciesReady()
    await codesLoaded()
    type('yrwa')
    expect(speciesNames()).toContain('Yellow-rumped Warbler')

    await replaceBackup(csv(['Northern Shoveler', 'Spatula clypeata'], ['American Robin', 'Turdus migratorius']))
    type('nosh')
    await waitFor(() => expect(speciesNames()).toEqual(['Northern Shoveler']))
    type('yrwa')
    expect(speciesNames()).toEqual([])
  })
})

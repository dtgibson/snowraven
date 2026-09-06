/// <reference types="node" />
// @vitest-environment jsdom
//
// The command palette overlay (feature: command-palette).
//
// ONLY `lib/storage` IS MOCKED, AND THAT IS THE POINT. The observations cache,
// the species index, the row builder, the matcher and the load resolver are all
// REAL here, so the failure and the invalidation start exactly where they start
// in production and travel the real seam into the component -- the
// `cacheReadThrowTabs.test.tsx` shape. A file that mocked
// `lib/observationsCache` wholesale could not have tested FR-31 at all, because
// the ordering invariant FR-31 rests on lives inside that module's relationship
// with the files epoch (.claude/rules/testing.md: a guard test that mocks a
// module wholesale structurally cannot verify that module).
//
// WHAT THIS FILE CANNOT PROVE, and where the evidence for it lives. jsdom has no
// layout engine, no tab order and no accessibility tree. So:
//   * FOCUS CONTAINMENT (QA-15) is asserted here as the SOURCE property that
//     makes WebKit's real order predictable -- every focusable inside the panel
//     is a native form control or carries a literal tabIndex={0} -- and as the
//     rendered focusable set. Whether Tab actually stays inside is a browser
//     measurement, in Chromium AND WebKit, on the production build.
//   * The 320px / 200% geometry (QA-59) and the grouped-listbox accessibility
//     tree (QA-37, QA-40, R-05) are browser work for the same reason. A jsdom
//     containment test would only re-assert the broken assumption.
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor, act, within } from '@testing-library/react'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const H = vi.hoisted(() => ({
  getFilesStatus: vi.fn(),
  readFile: vi.fn(),
  tGet: vi.fn(),
  tPost: vi.fn(),
}))
vi.mock('../lib/storage', () => ({ storage: { getFilesStatus: H.getFilesStatus, readFile: H.readFile } }))
// Not imported by anything under test; mocked so QA-21's "no request leaves the
// app" is an assertion rather than an inference from the import graph.
vi.mock('../lib/transport', () => ({
  transport: { get: H.tGet, post: H.tPost },
  TransportError: class extends Error {},
}))

import { CommandPalette } from './CommandPalette'
import { clearEbirdObservationsCache } from '../lib/observationsCache'
import { _resetSpeciesIndexMemoForTests } from '../lib/speciesIndex'
import { notifyFilesChanged } from '../lib/filesChanged'
import { PALETTE_COPY, speciesCapLine } from '../lib/paletteCopy'
import { SPECIES_CAP, type PaletteNavItem } from '../lib/paletteRows'
import { EBIRD_BACKUP_LOAD_ERROR } from './setupCopy'
import { FOCUSABLE_SELECTOR } from '../lib/useFocusTrap'
import type { TabIcon } from '../lib/tabIcons'
import type { Tab } from '../lib/tabLayout'

/**
 * Read a repo source file from the vitest working directory (`frontend/`).
 *
 * NOT `new URL(rel, import.meta.url)`: in the jsdom environment `import.meta.url`
 * is an http: URL and `readFileSync` refuses it. `process.cwd()` is the house
 * shape for a source scan inside a jsdom file (RavenGlyph.test.tsx,
 * mapFullscreenWiring.test.tsx), and the existence check is what turns a moved
 * file into a named failure rather than a vacuous empty string.
 */
function readSrc(rel: string): string {
  const path = resolve(process.cwd(), rel)
  if (!existsSync(path)) throw new Error(`could not locate ${rel} from ${process.cwd()}`)
  return readFileSync(path, 'utf8')
}

const icon = (() => <svg data-testid="glyph" />) as unknown as TabIcon

/** Real labels from TAB_LABELS: `life-list` is Multimedia, `birding-stats` is Statistics. */
const ITEMS: PaletteNavItem[] = [
  { id: 'weather', label: 'Weather', icon },
  { id: 'birding-stats', label: 'Statistics', icon },
  { id: 'map-explorer', label: 'Map Explorer', icon },
  { id: 'species-detail', label: 'Species Detail', icon },
  { id: 'calendar', label: 'Calendar', icon },
  { id: 'life-list', label: 'Multimedia', icon },
  { id: 'settings', label: 'Settings', icon },
]

const HEADER = 'Submission ID,Common Name,Scientific Name,Taxonomic Order,Date'
function csv(...species: [string, string][]): string {
  return [HEADER, ...species.map(([n, s], i) => `S${i},${n},${s},${100 + i},2024-05-01`)].join('\n')
}
const BAY_AREA = csv(
  ['American Robin', 'Turdus migratorius'],
  ["Anna's Hummingbird", 'Calypte anna'],
  ['Bay-breasted Warbler', 'Setophaga castanea'],
  ['Ring-billed Gull', 'Larus delawarensis'],
  ['Warbling Vireo', 'Vireo gilvus'],
  ["Wilson's Warbler", 'Cardellina pusilla'],
  ["Yellow-rumped Warbler (Audubon's)", 'Setophaga coronata auduboni'],
)
const EBIRD_STORED = { ebird: { filename: 'MyEBirdData.csv', uploadedAt: '2024-06-01' }, ml: null }
const NO_FILES = { ebird: null, ml: null }

function deferred<T>() {
  let resolve!: (v: T) => void
  const promise = new Promise<T>(res => { resolve = res })
  return { promise, resolve }
}

interface Spies {
  onSelectTab: Mock<(tab: Tab) => void>
  onOpenSpecies: Mock<(commonName: string) => void>
  onClose: Mock<() => void>
}
function spies(): Spies {
  return {
    onSelectTab: vi.fn<(tab: Tab) => void>(),
    onOpenSpecies: vi.fn<(commonName: string) => void>(),
    onClose: vi.fn<() => void>(),
  }
}

function open(s: Spies = spies(), items: PaletteNavItem[] = ITEMS) {
  const view = render(
    <CommandPalette items={items} onSelectTab={s.onSelectTab} onOpenSpecies={s.onOpenSpecies} onClose={s.onClose} />,
  )
  return { ...view, s }
}

const input = () => screen.getByRole('combobox') as HTMLInputElement
const listbox = () => screen.getByRole('listbox')
const optionNames = () => screen.queryAllByRole('option').map(o => o.textContent)
const type = (value: string) => fireEvent.change(input(), { target: { value } })

/** Wait for the species half to settle, whichever way it settled. */
async function settled() {
  await waitFor(() => expect(screen.queryByText(PALETTE_COPY.speciesLoading)).toBeNull())
}

beforeEach(() => {
  for (const fn of Object.values(H)) fn.mockReset()
  H.getFilesStatus.mockImplementation(async () => EBIRD_STORED)
  H.readFile.mockImplementation(async () => BAY_AREA)
  H.tGet.mockImplementation(async () => ({}))
  H.tPost.mockImplementation(async () => ({}))
  clearEbirdObservationsCache()
  _resetSpeciesIndexMemoForTests()
})
afterEach(cleanup)

// ─────────────────────────────────────────────────────────────────────────────
// The shell (FR-10, FR-13, QA-10, QA-13)
// ─────────────────────────────────────────────────────────────────────────────

describe('the overlay shell', () => {
  it('is a modal dialog named by the query input', () => {
    open()
    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(dialog.getAttribute('aria-label')).toBe(PALETTE_COPY.inputLabel)
    // The backdrop carries the shared scrim token; the class is the mechanism a
    // jsdom test can see, and paletteCss.test.ts asserts the token behind it.
    expect(dialog.parentElement?.className).toContain('sr-palette-root')
  })

  it('opens with an EMPTY, FOCUSED query input (FR-13, QA-13)', () => {
    open()
    expect(input().value).toBe('')
    expect(document.activeElement).toBe(input())
  })

  it('remembers nothing: a fresh mount is a fresh query', () => {
    const first = open()
    type('warb')
    expect(input().value).toBe('warb')
    first.unmount()
    open()
    expect(input().value).toBe('')
    expect(optionNames()).toEqual(ITEMS.map(i => i.label))
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Destinations are never blocked by the species half (FR-20, FR-21, QA-20)
// ─────────────────────────────────────────────────────────────────────────────

describe('destinations render before any parse', () => {
  it('renders the full list synchronously, with the backup load never settling', () => {
    // The load is parked forever. Every destination is present and selectable in
    // the FIRST commit, because they come from a prop that is already computed.
    H.getFilesStatus.mockImplementation(() => new Promise(() => {}))
    const { s } = open()
    expect(optionNames()).toEqual(ITEMS.map(i => i.label))
    fireEvent.click(screen.getByRole('option', { name: 'Calendar' }))
    expect(s.onSelectTab).toHaveBeenCalledWith('calendar')
  })

  it('shows only destinations for an empty query, even with a loaded backup (QA-23)', async () => {
    open()
    await settled()
    expect(optionNames()).toEqual(ITEMS.map(i => i.label))
    expect(screen.queryByText(PALETTE_COPY.groupSpecies)).toBeNull()
  })

  it('shows exactly what the caller passed, so a hidden destination cannot appear (QA-18)', () => {
    const without = ITEMS.filter(i => i.id !== 'breeding-codes' && i.id !== 'calendar')
    open(spies(), without)
    expect(optionNames()).not.toContain('Calendar')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Species (FR-22 to FR-28, QA-21, QA-25, QA-26, QA-27, QA-31)
// ─────────────────────────────────────────────────────────────────────────────

describe('species results', () => {
  it('join the SAME open session when the parse lands (FR-32, QA-31)', async () => {
    const gate = deferred<typeof EBIRD_STORED>()
    H.getFilesStatus.mockImplementation(() => gate.promise)
    open()
    // Typed while the parse is in flight, with no species yet.
    type('warb')
    expect(optionNames()).toEqual([])
    expect(screen.getByText(PALETTE_COPY.speciesLoading)).toBeTruthy()

    await act(async () => { gate.resolve(EBIRD_STORED); await Promise.resolve() })
    await waitFor(() => expect(optionNames().length).toBeGreaterThan(0))
    // No close and reopen was needed.
    expect(optionNames()).toEqual([
      'Bay-breasted WarblerSetophaga castanea',
      'Warbling VireoVireo gilvus',
      "Wilson's WarblerCardellina pusilla",
      "Yellow-rumped Warbler (Audubon's)Setophaga coronata auduboni",
    ])
  })

  it('match on the SCIENTIFIC name alone', async () => {
    open()
    await settled()
    type('calypte')
    expect(optionNames()).toEqual(["Anna's HummingbirdCalypte anna"])
  })

  it('include subspecies and other forms (FR-30)', async () => {
    open()
    await settled()
    type('audubon')
    expect(optionNames()).toEqual(["Yellow-rumped Warbler (Audubon's)Setophaga coronata auduboni"])
  })

  it('open Species Detail on the EXACT common name, and close (FR-28, QA-27)', async () => {
    const { s } = open()
    await settled()
    type("wilson's")
    fireEvent.click(screen.getByRole('option', { name: /Wilson's Warbler/ }))
    expect(s.onOpenSpecies).toHaveBeenCalledWith("Wilson's Warbler")
    expect(s.onSelectTab).not.toHaveBeenCalled()
    expect(s.onClose).toHaveBeenCalledTimes(1)
  })

  it('cap at SPECIES_CAP with a non-selectable line, and stay uncapped below it (QA-25)', async () => {
    const many = csv(...Array.from({ length: 120 }, (_, i) =>
      [`Zzz Bird ${String(i).padStart(3, '0')}`, `Zzzus ${i}`] as [string, string]))
    H.readFile.mockImplementation(async () => many)
    open()
    await settled()

    type('zzz')
    await waitFor(() => expect(screen.queryAllByRole('option')).toHaveLength(SPECIES_CAP))
    const capLine = screen.getByText(speciesCapLine(SPECIES_CAP))
    expect(capLine.getAttribute('role')).toBeNull()
    // Outside the listbox, so it is not an option and the arrows cannot reach it.
    expect(listbox().contains(capLine)).toBe(false)

    type('zzz bird 01')
    await waitFor(() => expect(screen.queryAllByRole('option')).toHaveLength(10))
    expect(screen.queryByText(speciesCapLine(SPECIES_CAP))).toBeNull()
  })

  it('render escaped plain text with a muted scientific name, and NO link or nested button (QA-26)', async () => {
    open()
    await settled()
    type('warb')
    const box = listbox()
    expect(box.querySelectorAll('a[href]')).toHaveLength(0)
    expect(box.querySelectorAll('button')).toHaveLength(0)
    const row = screen.getByRole('option', { name: /Bay-breasted Warbler/ })
    expect(row.querySelector('.sr-palette-row-name')?.textContent).toBe('Bay-breasted Warbler')
    expect(row.querySelector('.sr-palette-row-sci')?.textContent).toBe('Setophaga castanea')
    // Species rows carry no glyph; destination rows do.
    expect(row.querySelector('.sr-palette-row-icon')).toBeNull()
  })

  it('makes NO network call over a full open, type and select cycle (QA-21, NFR-06)', async () => {
    const { s } = open()
    await settled()
    type('robin')
    fireEvent.click(screen.getByRole('option', { name: /American Robin/ }))
    expect(s.onOpenSpecies).toHaveBeenCalled()
    expect(H.tGet).not.toHaveBeenCalled()
    expect(H.tPost).not.toHaveBeenCalled()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// The four species states (FR-33 to FR-37, QA-32 to QA-36)
// ─────────────────────────────────────────────────────────────────────────────

describe('the species half has four distinguishable states', () => {
  it('NO BACKUP: says what is needed and names the Settings path, destinations unaffected (QA-32)', async () => {
    H.getFilesStatus.mockImplementation(async () => NO_FILES)
    const { s } = open()
    expect(await screen.findByText(PALETTE_COPY.speciesNoBackup)).toBeTruthy()
    expect(PALETTE_COPY.speciesNoBackup).toContain('Settings → Default Files → eBird Backup')
    // Destinations are still there and still selectable.
    expect(optionNames()).toEqual(ITEMS.map(i => i.label))
    fireEvent.click(screen.getByRole('option', { name: 'Statistics' }))
    expect(s.onSelectTab).toHaveBeenCalledWith('birding-stats')
  })

  it('PARSE IN FLIGHT: shows the loading line, which is replaced and never outlives the answer (QA-33)', async () => {
    const gate = deferred<typeof EBIRD_STORED>()
    H.getFilesStatus.mockImplementation(() => gate.promise)
    open()
    expect(await screen.findByText(PALETTE_COPY.speciesLoading)).toBeTruthy()
    // While loading, no terminal state is on screen at the same time.
    expect(screen.queryByText(PALETTE_COPY.speciesNoBackup)).toBeNull()
    expect(screen.queryByText(EBIRD_BACKUP_LOAD_ERROR)).toBeNull()

    await act(async () => { gate.resolve(NO_FILES as unknown as typeof EBIRD_STORED); await Promise.resolve() })
    await waitFor(() => expect(screen.getByText(PALETTE_COPY.speciesNoBackup)).toBeTruthy())
    expect(screen.queryByText(PALETTE_COPY.speciesLoading)).toBeNull()
  })

  it('STORED BUT UNLOADABLE: renders EBIRD_BACKUP_LOAD_ERROR verbatim (FR-35, QA-34)', async () => {
    // A stored file whose read comes back empty -- an interrupted write leaves a
    // truncated CSV with its metadata intact, and the slot accepts any .csv.
    H.readFile.mockImplementation(async () => null)
    open()
    expect(await screen.findByText(EBIRD_BACKUP_LOAD_ERROR)).toBeTruthy()
    // NOT the no-backup sentence: the file IS stored, and telling the user to go
    // upload one is the lie this family exists to remove.
    expect(screen.queryByText(PALETTE_COPY.speciesNoBackup)).toBeNull()
  })

  it('NO MATCHES: one line, and its text differs from the other three (QA-35)', async () => {
    open()
    await settled()
    type('zzzzqq')
    expect(await screen.findByText(PALETTE_COPY.noMatches)).toBeTruthy()
    expect(optionNames()).toEqual([])
    const four = [
      PALETTE_COPY.speciesLoading,
      PALETTE_COPY.speciesNoBackup,
      EBIRD_BACKUP_LOAD_ERROR,
      PALETTE_COPY.noMatches,
    ]
    expect(new Set(four).size).toBe(4)
  })

  it('shows exactly ONE sentence at a time, in every state', async () => {
    open()
    await settled()
    type('zzzzqq')
    await screen.findByText(PALETTE_COPY.noMatches)
    expect(document.querySelectorAll('.sr-palette-status-line')).toHaveLength(1)
    type('warb')
    await waitFor(() => expect(document.querySelectorAll('.sr-palette-status-line')).toHaveLength(0))
  })
})

describe('the live region (FR-37, QA-36)', () => {
  it('exists, EMPTY, in the commit before its first message, and is the same node afterwards', async () => {
    // The property, not the mechanism: a region created together with its first
    // message is the documented way for an announcement to be missed. The
    // identity check is what proves React reconciled it rather than replacing
    // it, which is the half a textContent assertion cannot see.
    const gate = deferred<typeof EBIRD_STORED>()
    H.getFilesStatus.mockImplementation(() => gate.promise)
    open()
    const region = document.querySelector('[role="status"]') as HTMLElement
    expect(region).toBeTruthy()

    await act(async () => { gate.resolve(NO_FILES as unknown as typeof EBIRD_STORED); await Promise.resolve() })
    await waitFor(() => expect(region.textContent).toContain('Searching species needs your eBird backup'))
    expect(document.querySelector('[role="status"]')).toBe(region)
  })

  it('holds the sentence and nothing else, with its glyph hidden from assistive technology', async () => {
    H.getFilesStatus.mockImplementation(async () => NO_FILES)
    open()
    await screen.findByText(PALETTE_COPY.speciesNoBackup)
    const region = document.querySelector('[role="status"]') as HTMLElement
    expect(region.textContent).toBe(PALETTE_COPY.speciesNoBackup)
    for (const svg of region.querySelectorAll('svg')) {
      expect(svg.getAttribute('aria-hidden')).toBe('true')
    }
    // No control inside the region: nothing to add a tab stop or be read as part
    // of the failure.
    expect(region.querySelectorAll('button, a[href]')).toHaveLength(0)
  })

  it('replaces the message NODE rather than reconciling its text, so a repeat still announces', async () => {
    open()
    await settled()
    type('zzzzqq')
    const first = await screen.findByText(PALETTE_COPY.noMatches)
    type('warb')
    await waitFor(() => expect(screen.queryByText(PALETTE_COPY.noMatches)).toBeNull())
    type('qqqqzz')
    const second = await screen.findByText(PALETTE_COPY.noMatches)
    expect(second).not.toBe(first)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// The keyboard and ARIA model (FR-38 to FR-42, QA-37 to QA-41)
// ─────────────────────────────────────────────────────────────────────────────

describe('the combobox wiring (FR-38, QA-37)', () => {
  it('wires the input to the listbox and to the active option', async () => {
    open()
    await settled()
    const box = input()
    expect(box.getAttribute('aria-expanded')).toBe('true')
    expect(box.getAttribute('aria-autocomplete')).toBe('list')
    expect(box.getAttribute('aria-haspopup')).toBe('listbox')
    expect(box.getAttribute('aria-controls')).toBe(listbox().id)
    // Nothing active on open.
    expect(box.getAttribute('aria-activedescendant')).toBeNull()

    fireEvent.keyDown(box, { key: 'ArrowDown' })
    const first = screen.getAllByRole('option')[0]
    expect(box.getAttribute('aria-activedescendant')).toBe(first.id)
    expect(first.getAttribute('aria-selected')).toBe('true')
    expect(screen.getAllByRole('option')[1].getAttribute('aria-selected')).toBe('false')
  })

  it('gives the listbox only options and role=group wrappers (D-08)', async () => {
    // A listbox may own only `option` and `group`. The cap line and the status
    // region are siblings BELOW it inside the scroller, and each visible heading
    // is a role="presentation" child of its group.
    open()
    await settled()
    // A query that reaches BOTH halves: the Calendar destination, and
    // Anna's Hummingbird through *Calypte* anna. A species-only query would
    // render one group and the assertion below would pass without ever seeing
    // the boundary this test exists for.
    type('cal')
    await waitFor(() => expect(screen.queryAllByRole('option').length).toBeGreaterThan(1))
    const box = listbox()
    for (const child of Array.from(box.children)) {
      expect(child.getAttribute('role')).toBe('group')
      expect(child.getAttribute('aria-label')).toBeTruthy()
    }
    const groups = within(box).getAllByRole('group')
    expect(groups.map(g => g.getAttribute('aria-label')))
      .toEqual([PALETTE_COPY.groupDestinations, PALETTE_COPY.groupSpecies])
    expect(box.querySelector('[role="status"]')).toBeNull()
  })
})

describe('arrow navigation (FR-39, QA-38)', () => {
  it('crosses the group boundary in one press', async () => {
    open()
    await settled()
    // "cal" matches the Calendar destination and two species on their
    // scientific names, so the boundary is one row down.
    type('cal')
    await waitFor(() => expect(screen.queryAllByRole('option').length).toBeGreaterThan(1))
    const options = screen.getAllByRole('option')
    expect(options[0].textContent).toBe('Calendar')

    fireEvent.keyDown(input(), { key: 'ArrowDown' })
    fireEvent.keyDown(input(), { key: 'ArrowDown' })
    expect(input().getAttribute('aria-activedescendant')).toBe(screen.getAllByRole('option')[1].id)
    expect(screen.getAllByRole('option')[1].textContent).toContain("Anna's Hummingbird")
  })

  it('CLAMPS at both ends rather than wrapping, matching the shipped picker', async () => {
    open()
    await settled()
    const count = screen.getAllByRole('option').length

    // ArrowUp with nothing active leaves nothing active.
    fireEvent.keyDown(input(), { key: 'ArrowUp' })
    expect(input().getAttribute('aria-activedescendant')).toBeNull()

    for (let i = 0; i < count + 3; i += 1) fireEvent.keyDown(input(), { key: 'ArrowDown' })
    const last = screen.getAllByRole('option')[count - 1]
    expect(input().getAttribute('aria-activedescendant')).toBe(last.id)

    for (let i = 0; i < count + 3; i += 1) fireEvent.keyDown(input(), { key: 'ArrowUp' })
    expect(input().getAttribute('aria-activedescendant')).toBeNull()
  })

  it('resets the active option on every query change', async () => {
    open()
    await settled()
    fireEvent.keyDown(input(), { key: 'ArrowDown' })
    expect(input().getAttribute('aria-activedescendant')).toBeTruthy()
    type('stat')
    expect(input().getAttribute('aria-activedescendant')).toBeNull()
  })

  it('skips the group headings entirely (FR-41, QA-40)', async () => {
    open()
    await settled()
    type('cal')
    await waitFor(() => expect(screen.queryAllByRole('option').length).toBeGreaterThan(1))
    const options = screen.getAllByRole('option')
    // Walking the whole list with ArrowDown visits every option and nothing else.
    const visited: string[] = []
    for (let i = 0; i < options.length; i += 1) {
      fireEvent.keyDown(input(), { key: 'ArrowDown' })
      visited.push(input().getAttribute('aria-activedescendant') ?? '')
    }
    expect(visited).toEqual(options.map(o => o.id))
    // The headings carry no option role and no tabindex.
    for (const heading of document.querySelectorAll('.sr-palette-group')) {
      expect(heading.getAttribute('role')).not.toBe('option')
      expect(heading.hasAttribute('tabindex')).toBe(false)
    }
  })
})

describe('Enter (FR-40, QA-39)', () => {
  it('activates the ACTIVE option', async () => {
    const { s } = open()
    await settled()
    fireEvent.keyDown(input(), { key: 'ArrowDown' })
    fireEvent.keyDown(input(), { key: 'ArrowDown' })
    fireEvent.keyDown(input(), { key: 'Enter' })
    expect(s.onSelectTab).toHaveBeenCalledWith('birding-stats')
    expect(s.onClose).toHaveBeenCalledTimes(1)
  })

  it('activates the FIRST ROW when nothing is active and there are results', async () => {
    // Deliberately different from SpeciesCombobox, which prefers the first
    // SPECIES match because it carries a synthetic "All species" row at index 0.
    // The palette has no such row, so "the first row" is unambiguous.
    const { s } = open()
    await settled()
    type('warb')
    await waitFor(() => expect(screen.queryAllByRole('option').length).toBeGreaterThan(0))
    fireEvent.keyDown(input(), { key: 'Enter' })
    expect(s.onOpenSpecies).toHaveBeenCalledWith('Bay-breasted Warbler')
  })

  it('does NOTHING with no results, and the palette stays open', async () => {
    const { s } = open()
    await settled()
    type('zzzzqq')
    await screen.findByText(PALETTE_COPY.noMatches)
    fireEvent.keyDown(input(), { key: 'Enter' })
    expect(s.onSelectTab).not.toHaveBeenCalled()
    expect(s.onOpenSpecies).not.toHaveBeenCalled()
    expect(s.onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeTruthy()
  })
})

describe('tab stops inside the overlay (FR-42, QA-15, QA-41)', () => {
  it('are exactly two: the query input and the close button, each explicit', async () => {
    open()
    await settled()
    type('warb')
    await waitFor(() => expect(screen.queryAllByRole('option').length).toBeGreaterThan(0))
    const panel = screen.getByRole('dialog')
    const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    expect(focusables).toHaveLength(2)
    expect(focusables[0].tagName).toBe('INPUT')
    expect(focusables[1].tagName).toBe('BUTTON')
    // THE PROPERTY THAT MAKES THE KEYDOWN TRAP'S PREDICTION CORRECT: every one
    // is a native form control or carries a literal tabindex="0", which is
    // exactly the set WebKit's default tab mode visits.
    for (const el of focusables) {
      const native = ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName)
      expect(native || el.getAttribute('tabindex') === '0').toBe(true)
    }
  })

  it('leaves every option row OUT of both lists', async () => {
    open()
    await settled()
    type('warb')
    await waitFor(() => expect(screen.queryAllByRole('option').length).toBeGreaterThan(0))
    for (const row of screen.getAllByRole('option')) {
      // No tabindex at all, so FOCUSABLE_SELECTOR's [tabindex] clause does not
      // match it and WebKit does not visit it either. The prediction and the
      // engine agree.
      expect(row.hasAttribute('tabindex')).toBe(false)
    }
  })

  it('renders no <details> / <summary>, the one gap the trap cannot close', () => {
    open()
    const panel = screen.getByRole('dialog')
    expect(panel.querySelectorAll('details, summary')).toHaveLength(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// One close path (FR-11, QA-11)
// ─────────────────────────────────────────────────────────────────────────────

describe('every close affordance routes through the SAME onClose', () => {
  it('the close button', () => {
    const { s } = open()
    fireEvent.click(screen.getByRole('button', { name: PALETTE_COPY.closeLabel }))
    expect(s.onClose).toHaveBeenCalledTimes(1)
  })

  it('a backdrop press', () => {
    const { s } = open()
    fireEvent.mouseDown(screen.getByRole('dialog').parentElement as HTMLElement)
    expect(s.onClose).toHaveBeenCalledTimes(1)
  })

  it('but NOT a drag that started inside the panel and ended on the backdrop', () => {
    // mousedown, not click, and the target check is what makes the difference.
    const { s } = open()
    fireEvent.mouseDown(screen.getByRole('dialog'))
    fireEvent.click(screen.getByRole('dialog').parentElement as HTMLElement)
    expect(s.onClose).not.toHaveBeenCalled()
  })

  it('selecting a destination', () => {
    const { s } = open()
    fireEvent.click(screen.getByRole('option', { name: 'Map Explorer' }))
    expect(s.onSelectTab).toHaveBeenCalledWith('map-explorer')
    expect(s.onClose).toHaveBeenCalledTimes(1)
  })

  it('selecting a species', async () => {
    const { s } = open()
    await settled()
    type('robin')
    fireEvent.click(screen.getByRole('option', { name: /American Robin/ }))
    expect(s.onClose).toHaveBeenCalledTimes(1)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// FR-31 / R-01 — the files epoch, through the REAL observations cache
// ─────────────────────────────────────────────────────────────────────────────

describe('a file change reaches an OPEN palette (FR-31, QA-30, R-01)', () => {
  /**
   * The shipped mutation sequence, in the order all three call sites run it:
   * invalidate the parse, THEN bump the epoch. That ordering is what makes a
   * plain epoch-keyed re-load correct, and it is not the palette's to enforce --
   * it lives in `Settings.tsx` (upload and clear) and in the iCloud controller.
   * Driving the REAL cache here is what makes the ordering the thing under test
   * rather than a mocked loader's return value.
   */
  async function mutate(next: { status: unknown; content: string | null }) {
    H.getFilesStatus.mockImplementation(async () => next.status)
    H.readFile.mockImplementation(async () => next.content)
    await act(async () => {
      clearEbirdObservationsCache()
      notifyFilesChanged()
      await Promise.resolve()
    })
  }

  it('the Settings CLEAR path moves the species half to the no-backup state', async () => {
    open()
    await settled()
    type('robin')
    expect(optionNames()).toEqual(['American RobinTurdus migratorius'])

    await mutate({ status: NO_FILES, content: null })

    await waitFor(() => expect(screen.getByText(PALETTE_COPY.speciesNoBackup)).toBeTruthy())
    // And it never offers species from a file that is gone.
    expect(optionNames()).toEqual([])
  })

  it('the Settings REPLACE path yields the NEW file\'s species', async () => {
    open()
    await settled()
    type('robin')
    expect(optionNames()).toEqual(['American RobinTurdus migratorius'])

    await mutate({
      status: EBIRD_STORED,
      content: csv(['Roseate Spoonbill', 'Platalea ajaja'], ['American Robin', 'Turdus migratorius']),
    })

    type('ro')
    await waitFor(() => expect(optionNames()).toEqual([
      'American RobinTurdus migratorius',
      'Roseate SpoonbillPlatalea ajaja',
    ]))
  })

  it('and REVERSING that order is what breaks it, which is why the invariant is named', async () => {
    // THE MUTATION THAT MAKES THE TWO ROWS ABOVE EVIDENCE. With the epoch bumped
    // BEFORE the parse cache is cleared, the re-load runs against the OLD cached
    // parse and the palette keeps offering species from the replaced file. If any
    // of the three shipped call sites is ever reordered, this is the shape that
    // would ship.
    //
    // The two calls are AWAITED APART rather than run in one act(), and that is
    // what makes this a real interleaving rather than a re-ordering React would
    // batch away: the palette's re-load has to actually run between them. The
    // read count below is what proves it did, and proves what it read.
    open()
    await settled()
    type('robin')
    expect(optionNames()).toEqual(['American RobinTurdus migratorius'])
    const readsAfterFirstLoad = H.readFile.mock.calls.length
    expect(readsAfterFirstLoad).toBe(1)

    H.readFile.mockImplementation(async () => csv(['Roseate Spoonbill', 'Platalea ajaja']))
    await act(async () => { notifyFilesChanged(); await Promise.resolve() })
    await act(async () => { await Promise.resolve() })

    // NON-VACUITY, and the whole mechanism in one number: the re-load DID run,
    // and it answered from the stale parse without touching the disk, because
    // nothing had invalidated it. The clear that follows is then too late.
    expect(H.readFile.mock.calls.length).toBe(readsAfterFirstLoad)
    await act(async () => { clearEbirdObservationsCache(); await Promise.resolve() })

    // The replacement file's ONE species never arrives...
    type('spoonbill')
    expect(optionNames()).toEqual([])
    // ...and the replaced file's is still on offer, which is the defect.
    type('robin')
    expect(optionNames()).toEqual(['American RobinTurdus migratorius'])
  })

  it('the shipped call sites really do run the clear BEFORE the epoch bump', () => {
    // The row above proves the ORDER matters. This one proves the app has it,
    // at all three sites, read from the source with comments stripped so a
    // commented-out call cannot satisfy it.
    const code = (rel: string) =>
      readSrc(rel)
        .split('\n')
        .filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l))
        .join('\n')
        .replace(/\/\*[\s\S]*?\*\//g, '')

    const settings = code('src/components/Settings.tsx')
    // Settings' two paths: the upload/replace tail and the clear handler. Each
    // clears the parse and then calls `onFilesSaved`, which IS the epoch bump.
    const settingsPairs = [...settings.matchAll(/clearEbirdObservationsCache\(\)[\s\S]{0,900}?onFilesSaved\?\.\(\)/g)]
    expect(settingsPairs).toHaveLength(2)

    const icloud = code('src/lib/icloud/icloudSync.ts')
    // The controller's three sites each call `deps.invalidate(slot)` (whose
    // eBird arm is `clearEbirdObservationsCache`) before `notifyFiles()`.
    expect(icloud).toMatch(/invalidate: \(slot\) => \{[\s\S]{0,400}?clearEbirdObservationsCache\(\)/)
    const controllerPairs = [...icloud.matchAll(/deps\.invalidate\(slot\)[\s\S]{0,900}?notifyFiles\(\)/g)]
    expect(controllerPairs.length).toBeGreaterThanOrEqual(3)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Source properties (QA-16, QA-26, QA-55, QA-57)
// ─────────────────────────────────────────────────────────────────────────────

describe('what the palette\'s own source may and may not contain', () => {
  const src = readSrc('src/components/CommandPalette.tsx')
  const code = src.split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n')

  it('holds NO hand-written destination list (QA-16)', () => {
    // Every destination name comes from TAB_LABELS through App's `navItems`, so
    // one added in a future release appears with no registration step. A label
    // spelled here would be a second source of truth with nothing keeping the
    // two in step.
    for (const label of ['Weather', 'Species Detail', 'Statistics', 'Map Explorer', 'Multimedia',
                         'Breeding Codes', 'Named Birds', 'Checklists', 'List Comparer']) {
      expect(code).not.toContain(`'${label}'`)
    }
    expect(code).not.toContain('TAB_LABELS')
  })

  it('never imports BirdName or SpeciesCombobox (FR-27, QA-26)', () => {
    expect(code).not.toContain('BirdName')
    expect(code).not.toContain('SpeciesCombobox')
  })

  it('imports EBIRD_BACKUP_LOAD_ERROR from setupCopy rather than re-spelling it (FR-35)', () => {
    expect(code).toMatch(/import \{ EBIRD_BACKUP_LOAD_ERROR \} from '\.\/setupCopy'/)
    expect(code).not.toContain("Couldn't load your eBird backup")
  })

  it('builds no RegExp from the query (NFR-07, QA-62)', () => {
    expect(code).not.toContain('new RegExp')
  })

  it('resolves every user-facing string from the copy module (FR-56)', () => {
    // No em dash may appear in any of them, and every string rides the repo's
    // sweeps because it lives in one module.
    for (const value of Object.values(PALETTE_COPY)) expect(value).not.toContain('—')
    expect(speciesCapLine(SPECIES_CAP)).not.toContain('—')
    expect(src).not.toContain('—')
  })
})

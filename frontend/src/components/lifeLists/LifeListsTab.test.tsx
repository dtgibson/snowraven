// @vitest-environment jsdom
//
// The Life Lists tab (life-lists-tab). Component rows for what the pure suites
// cannot see: the phase gate (QA-05 to QA-07), the three ML states (QA-28), the
// controls (QA-22, QA-37, QA-38), the rows (QA-31 to QA-34, QA-54 to QA-56),
// paging and its focus (QA-39), the live region (QA-48), index-keyed ids
// (QA-40), the files epoch (QA-09) and the request count at the transport seam
// (QA-41). jsdom has no layout, so nothing here claims a geometric fact; the
// 320px / 200% claims belong to the live look in a real engine.
//
// The Region control (life-list-region-filter) has its rows at the end: the
// Everywhere golden (QA-05), one region build per epoch (QA-06), the control's
// semantics and ids (QA-07, QA-08), a region change as a control press (QA-09,
// QA-21), the composition and order (QA-17, QA-18), the setting's write, read
// and validation (QA-22 to QA-26) and the request count (QA-28).

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
  post: vi.fn(),
  setSetting: vi.fn<(key: string, value: unknown) => Promise<void>>(async () => {}),
  deleteSetting: vi.fn<(key: string) => Promise<void>>(async () => {}),
  getSetting: vi.fn<(key: string) => Promise<unknown>>(async () => null),
  snapshot: null as unknown,
  getFilesStatus: vi.fn(),
  listeners: new Set<() => void>(),
}))

vi.mock('../../lib/storage', () => ({
  storage: {
    getFilesStatus: H.getFilesStatus,
    getSetting: H.getSetting,
    setSetting: H.setSetting,
    deleteSetting: H.deleteSetting,
  },
}))
vi.mock('../../lib/observationsCache', () => ({
  loadEbirdObservations: vi.fn(async () => (H.ebirdNull ? null : { headerLine: '', observations: H.observations })),
}))
vi.mock('../../lib/mlExportCache', () => ({
  loadMLExport: vi.fn(async () => (H.mlRows ? { entries: [], mediaMap: {}, rows: H.mlRows } : null)),
}))
vi.mock('../../lib/transport', () => ({ transport: { post: H.post, get: vi.fn() } }))
// The two file passes, wrapped so QA-45 can count them; behaviour unchanged.
// The status reader's per-row index, wrapped so the L2 row can count builds.
vi.mock('../../lib/exoticProvenance', async importOriginal => {
  const m = await importOriginal<typeof import('../../lib/exoticProvenance')>()
  return { ...m, buildCoverIndex: vi.fn(m.buildCoverIndex) }
})
vi.mock('../../lib/lifeLists', async importOriginal => {
  const m = await importOriginal<typeof import('../../lib/lifeLists')>()
  return { ...m, deriveFirstSightings: vi.fn(m.deriveFirstSightings), deriveFirstAssets: vi.fn(m.deriveFirstAssets) }
})
vi.mock('../../lib/lifeListsRegion', async importOriginal => {
  const m = await importOriginal<typeof import('../../lib/lifeListsRegion')>()
  return { ...m, deriveRegionIndex: vi.fn(m.deriveRegionIndex), deriveRegionAssets: vi.fn(m.deriveRegionAssets) }
})
vi.mock('../../lib/exoticProvenanceCache', () => ({
  getSnapshot: () => H.snapshot,
  subscribe: (l: () => void) => { H.listeners.add(l); return () => { H.listeners.delete(l) } },
  loadSnapshot: vi.fn(async () => H.snapshot),
}))

import { LifeListsTab } from './LifeListsTab'
import { deriveFirstAssets, deriveFirstSightings, selectRows, type MediaFormat } from '../../lib/lifeLists'
import { deriveRegionAssets, deriveRegionIndex } from '../../lib/lifeListsRegion'
import { buildCoverIndex } from '../../lib/exoticProvenance'
import { readFileSync } from 'node:fs'
import { notifyFilesChanged } from '../../lib/filesChanged'
import { formatDate } from '../../lib/formatDate'
import { EBIRD_BACKUP_LOAD_ERROR } from '../setupCopy'
import { ML_NONE_SENTENCE, ML_UNREADABLE_SENTENCE, STATUS_RESOLVED, STATUS_UNRESOLVED, countSentence } from '../../lib/lifeListsCopy'

function obs(commonName: string, date: string, time: string | null, submissionId: string, extra: Partial<ObservationEntry> = {}): ObservationEntry {
  return {
    submissionId, commonName, scientificName: 'Turdus migratorius', date, location: 'Lake Park', locationId: 'L1',
    latitude: null, longitude: null, county: 'Hennepin', count: 1, breedingCode: null, speciesComments: '',
    catalogIds: [], time, stateProvince: 'US-MN', ...extra,
  }
}
function ml(commonName: string, format: MLExportRow['format'], date: string, time: string): MLExportRow {
  return {
    catalogId: `ML-${commonName}-${format}`, commonName, scientificName: '', format, date, location: 'River Trail', county: 'Dakota',
    latitude: null, longitude: null, caption: '', mediaNotes: '', observationDetails: '', ageSex: '', behaviors: '',
    time, year: null, month: null, avgRating: null, numRatings: 0, checklistId: 'S90',
  }
}
const rec = (seen: string[]) => ({ seen, n: seen.length, at: 0 })
const snapshot = (over: Partial<ProvenanceSnapshot> = {}): ProvenanceSnapshot =>
  ({ checklists: new Set(), species: new Map(), excludedNames: [], exoticNames: null, ...over })

const BASE = [
  obs('American Robin', '2019-05-02', '6:30 AM', 'S1', { scientificName: 'Turdus migratorius' }),
  obs('Mandarin Duck', '2021-03-09', null, 'S2', { scientificName: 'Aix galericulata' }),
  obs('Rock Pigeon', '2020-01-01', '9:00 AM', 'junk', { scientificName: 'Columba livia', county: null, stateProvince: null }),
]

beforeEach(() => {
  H.files = { ebird: { filename: 'MyEBirdData.csv' }, ml: null }
  H.observations = BASE
  H.mlRows = null
  H.ebirdNull = false
  H.snapshot = snapshot()
  H.listeners.clear()
  H.getFilesStatus.mockImplementation(async () => H.files)
  H.getSetting.mockImplementation(async () => null)
  H.setSetting.mockImplementation(async () => {})
  H.deleteSetting.mockImplementation(async () => {})
  H.post.mockImplementation(async () => ({ codes: { 'American Robin': 'amerob', 'Mandarin Duck': 'mandar', 'Rock Pigeon': 'rocpig' } }))
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

async function ready() {
  render(<LifeListsTab onGoToSettings={() => {}} onOpenSpecies={open} />)
  await waitFor(() => expect(document.querySelector('.sr-lfl-count')).not.toBeNull())
}
/** The visible count sentence (the live region carries a twin of it). */
const countText = () => document.querySelector('.sr-lfl-count')?.textContent ?? ''
const open = vi.fn()
const rowNames = () => screen.getAllByRole('listitem').map(li => within(li).getAllByRole('button')[0].textContent)

describe('the phase gate (FR-05 to FR-07)', () => {
  it('shows the setup panel with no backup, and no rows or controls (QA-05)', async () => {
    H.files = { ebird: null, ml: null }
    render(<LifeListsTab onGoToSettings={() => {}} />)
    expect(await screen.findByText('eBird Backup Required')).toBeTruthy()
    expect(screen.getByText("The Life Lists tab loads automatically from your stored eBird backup. You haven't saved one yet.")).toBeTruthy()
    expect(screen.queryByRole('switch')).toBeNull()
    expect(screen.queryByRole('listitem')).toBeNull()
  })

  it('shows the shared load error, not the setup panel, for an unreadable backup (QA-06)', async () => {
    H.ebirdNull = true
    render(<LifeListsTab onGoToSettings={() => {}} />)
    expect(await screen.findByText(EBIRD_BACKUP_LOAD_ERROR)).toBeTruthy()
    expect(screen.queryByText('eBird Backup Required')).toBeNull()
  })

  it('a rejected files-status read is UNKNOWN: the load error, never the setup panel', async () => {
    H.getFilesStatus.mockImplementation(async () => { throw new Error('seam down') })
    render(<LifeListsTab onGoToSettings={() => {}} />)
    expect(await screen.findByText(EBIRD_BACKUP_LOAD_ERROR)).toBeTruthy()
    expect(screen.queryByText('eBird Backup Required')).toBeNull()
  })

  it('shows a labelled loading status while the backup loads (QA-07)', async () => {
    H.getFilesStatus.mockImplementation(() => new Promise(() => {}))
    render(<LifeListsTab onGoToSettings={() => {}} />)
    expect(screen.getByRole('status', { name: 'Loading your life list' })).toBeTruthy()
  })
})

describe('the rows (FR-29 to FR-32, FR-42, FR-43)', () => {
  it('renders each row in reading order, newest first, with the position carried to a screen reader', async () => {
    await ready()
    expect(rowNames()).toEqual(['Mandarin Duck', 'Rock Pigeon', 'American Robin'])
    const [first, , last] = screen.getAllByRole('listitem')
    expect(first.querySelector('.sr-lfl-num')!.textContent).toBe('3')
    expect(first.querySelector('.sr-lfl-num')!.getAttribute('aria-hidden')).toBe('true')
    expect(first.querySelector('.sr-lfl-name .sr-only')!.textContent).toBe('3 of 3. ')
    expect(last.querySelector('.sr-lfl-num')!.textContent).toBe('1')
    // The visible number is plain text, never inside an anchor.
    expect(first.querySelector('.sr-lfl-num a')).toBeNull()
    // FR-29: the date through the preference, the time, the checklist, the place.
    expect(within(last).getByText(formatDate('2019-05-02'))).toBeTruthy()
    expect(within(last).getByText('6:30 AM')).toBeTruthy()
    expect(within(last).getByRole('link', { name: /S1.*eBird/ }).getAttribute('href')).toBe('https://ebird.org/checklist/S1')
    expect(within(last).getByText('Lake Park')).toBeTruthy()
    expect(within(last).getByText('Hennepin, MN')).toBeTruthy()
  })

  it('a blank time and an unlinkable checklist render a dash, with no anchor (QA-32, QA-33, QA-34)', async () => {
    await ready()
    const [duck, pigeon] = screen.getAllByRole('listitem')
    expect(duck.querySelector('.sr-lfl-time')!.textContent).toBe('-')
    expect(within(pigeon).queryByRole('link', { name: /checklist/ })).toBeNull()
    expect(within(pigeon).getByText('No checklist')).toBeTruthy()
    // No county and no state: the location line alone.
    expect(pigeon.querySelector('.sr-lfl-county')).toBeNull()
  })

  it('opens the species on Species Detail through the host, and shows the binomial (QA-31, QA-55)', async () => {
    await ready()
    const robin = screen.getAllByRole('listitem')[2]
    fireEvent.click(within(robin).getByRole('button', { name: /American Robin/ }))
    expect(open).toHaveBeenCalledWith('American Robin')
    expect(robin.querySelector('.sr-birdname-sci')!.textContent).toBe('Turdus migratorius')
  })
})

describe('the codes batch is the one request (FR-39, FR-43, QA-41, QA-55)', () => {
  it('posts once per roster, draws the marks once it resolves, and never again for a control or a page', async () => {
    await ready()
    await waitFor(() => expect(screen.getAllByRole('link', { name: /^View .+ on eBird \(opens/ }).length).toBeGreaterThan(0))
    expect(H.post).toHaveBeenCalledTimes(1)
    expect(H.post.mock.calls[0][0]).toBe('/taxonomy/codes')
    expect((H.post.mock.calls[0][1] as { species: { commonName: string }[] }).species.map(s => s.commonName).sort())
      .toEqual(['American Robin', 'Mandarin Duck', 'Rock Pigeon'])
    fireEvent.click(screen.getByRole('switch', { name: 'Include Escapees' }))
    fireEvent.click(screen.getByRole('switch', { name: 'Include Exotics' }))
    expect(H.post).toHaveBeenCalledTimes(1)
    expect(H.setSetting).not.toHaveBeenCalled()   // session-only (QA-38)
  })

  it('a re-load of the same species re-issues nothing; a changed roster issues one more', async () => {
    await ready()
    await waitFor(() => expect(H.post).toHaveBeenCalledTimes(1))
    H.observations = [...BASE]
    await act(async () => { notifyFilesChanged() })
    await waitFor(() => expect(countText()).toMatch(/^3 species, newest first/))
    expect(H.post).toHaveBeenCalledTimes(1)
    H.observations = [...BASE, obs('Snowy Owl', '2024-02-02', null, 'S9')]
    await act(async () => { notifyFilesChanged() })
    await waitFor(() => expect(countText()).toMatch(/^4 species, newest first/))
    await waitFor(() => expect(H.post).toHaveBeenCalledTimes(2))
  })

  it('a rejected batch leaves the names unmarked and the list unchanged', async () => {
    H.post.mockImplementation(async () => { throw new Error('offline') })
    await ready()
    await waitFor(() => expect(H.post).toHaveBeenCalledTimes(1))
    expect(rowNames()).toEqual(['Mandarin Duck', 'Rock Pigeon', 'American Robin'])
    expect(screen.queryByRole('link', { name: /^View .+ on eBird \(opens/ })).toBeNull()
  })
})

describe('the switches and the status line (FR-18 to FR-20, FR-35)', () => {
  it('Include Escapees starts off and Include Exotics on, both expose their state, and each adds exactly its species (QA-19, QA-37)', async () => {
    // Only S2 (the escapee's one carrier) and junk were consulted: the exotic
    // list is read as published, and S1 never being asked does not stop the
    // check from being complete, because every species has an answer.
    H.snapshot = snapshot({
      checklists: new Set(['S2', 'junk']), excludedNames: ['Mandarin Duck'], exoticNames: ['Rock Pigeon'],
      species: new Map([['amerob', rec(['|'])], ['mandar', rec(['X|'])], ['rocpig', rec(['N|'])]]),
    })
    await ready()
    const esc = screen.getByRole('switch', { name: 'Include Escapees' })
    const exo = screen.getByRole('switch', { name: 'Include Exotics' })
    // ebird-store-hygiene: the defaults follow eBird's life-list rule, as the
    // Statistics headline does: the exotic is listed, the escapee is not.
    expect(esc.getAttribute('aria-checked')).toBe('false')
    expect(exo.getAttribute('aria-checked')).toBe('true')
    expect(rowNames()).toEqual(['Rock Pigeon', 'American Robin'])
    fireEvent.click(exo)
    expect(exo.getAttribute('aria-checked')).toBe('false')
    expect(rowNames()).toEqual(['American Robin'])
    fireEvent.click(esc)
    expect(esc.getAttribute('aria-checked')).toBe('true')
    expect(rowNames()).toEqual(['Mandarin Duck', 'American Robin'])
    fireEvent.click(exo)
    expect(rowNames()).toEqual(['Mandarin Duck', 'Rock Pigeon', 'American Robin'])
    fireEvent.click(esc)
    expect(rowNames()).toEqual(['Rock Pigeon', 'American Robin'])
    // Statistics' own completion (every species answered) and the list
    // published: the second sentence, once this roster's codes resolve.
    expect(await screen.findByText(STATUS_RESOLVED)).toBeTruthy()
  })

  it('an unpublished exotic list lists everything and says the check has not finished (QA-20, QA-21)', async () => {
    H.snapshot = snapshot({ checklists: new Set(['S1', 'S2', 'junk']), species: new Map([['amerob', rec(['|'])], ['mandar', rec(['X|'])], ['rocpig', rec(['N|'])]]) })
    await ready()
    await waitFor(() => expect(H.post).toHaveBeenCalledTimes(1))
    expect(rowNames()).toHaveLength(3)
    const status = screen.getByText(STATUS_UNRESOLVED)
    expect(status.querySelector('a, button')).toBeNull()
  })

  it('a published list with a species still unanswered says the check has not finished (FR-20)', async () => {
    H.snapshot = snapshot({ checklists: new Set(['S2']), excludedNames: [], exoticNames: [], species: new Map([['amerob', rec(['|'])], ['mandar', rec(['X|'])]]) })
    await ready()
    await waitFor(() => expect(H.post).toHaveBeenCalledTimes(1))
    // Rock Pigeon has no record yet: Statistics would not say complete either.
    expect(screen.getByText(STATUS_UNRESOLVED)).toBeTruthy()
  })

  it('a failed codes batch never claims the check is finished', async () => {
    H.post.mockImplementation(async () => { throw new Error('offline') })
    H.snapshot = snapshot({ checklists: new Set(['S1', 'S2', 'junk']), exoticNames: [], species: new Map([['amerob', rec(['|'])], ['mandar', rec(['X|'])], ['rocpig', rec(['N|'])]]) })
    await ready()
    await waitFor(() => expect(H.post).toHaveBeenCalledTimes(1))
    expect(screen.getByText(STATUS_UNRESOLVED)).toBeTruthy()
  })
})

describe('the media buttons (FR-21 to FR-27, FR-44)', () => {
  it('without an ML export: the buttons are inert, focusable and described, the cell absent (QA-28, QA-56)', async () => {
    await ready()
    const photo = screen.getByRole('button', { name: /Photo/ })
    expect(photo.getAttribute('aria-disabled')).toBe('true')
    const note = document.getElementById(photo.getAttribute('aria-describedby')!)!
    expect(note.textContent).toBe(ML_NONE_SENTENCE)
    fireEvent.click(photo)
    expect(photo.getAttribute('aria-pressed')).toBe('false')
    expect(document.querySelector('.sr-lfl-media')).toBeNull()
    expect(document.querySelector('.sr-lfl-tab')!.getAttribute('data-media')).toBe('off')
    // The switches still work.
    fireEvent.click(screen.getByRole('switch', { name: 'Include Escapees' }))
    expect(rowNames()).toHaveLength(3)
  })

  it('an unreadable export says so, beside inert buttons (QA-28)', async () => {
    H.files = { ebird: { filename: 'x.csv' }, ml: { filename: 'ml.csv' } }
    H.mlRows = null
    await ready()
    expect(screen.getByText(ML_UNREADABLE_SENTENCE)).toBeTruthy()
    expect(screen.getByRole('button', { name: /Video/ }).getAttribute('aria-disabled')).toBe('true')
    expect(document.querySelector('.sr-lfl-media')).toBeNull()
  })

  it('with an export: toggles narrow, date and renumber the list, and the cell reports presence (QA-22, QA-26, QA-27, QA-56)', async () => {
    H.files = { ebird: { filename: 'x.csv' }, ml: { filename: 'ml.csv' } }
    H.mlRows = [ml('American Robin', 'Photo', '2022-04-01', '0905'), ml('American Robin', 'Audio', '2023-01-01', '0650'), ml('Mandarin Duck', 'Photo', '2021-04-01', '1000')]
    await ready()
    const robin = screen.getAllByRole('listitem')[2]
    expect(within(robin).getByRole('img').getAttribute('aria-label')).toBe('Media: photo, audio')
    expect(within(screen.getAllByRole('listitem')[1]).getByRole('img').getAttribute('aria-label')).toBe('No media')
    expect(robin.querySelector('.sr-lfl-media a, .sr-lfl-media button, .sr-lfl-media [tabindex]')).toBeNull()

    const photo = screen.getByRole('button', { name: /Photo/ })
    const audio = screen.getByRole('button', { name: /Audio/ })
    fireEvent.click(photo)
    expect(photo.getAttribute('aria-pressed')).toBe('true')
    expect(rowNames()).toEqual(['American Robin', 'Mandarin Duck'])
    expect(countText()).toBe('2 species with a photo, newest first by the date of your first photo.')
    expect(screen.getAllByRole('listitem')[0].querySelector('.sr-lfl-num')!.textContent).toBe('2')
    fireEvent.click(audio)
    expect(rowNames()).toEqual(['American Robin'])
    expect(within(screen.getAllByRole('listitem')[0]).getByText('6:50 AM')).toBeTruthy()
    fireEvent.click(photo)
    fireEvent.click(audio)
    expect(photo.getAttribute('aria-pressed')).toBe('false')
    expect(rowNames()).toEqual(['Mandarin Duck', 'Rock Pigeon', 'American Robin'])
  })

  it('a selection that matches nothing says so, with no paging (QA-36)', async () => {
    H.files = { ebird: { filename: 'x.csv' }, ml: { filename: 'ml.csv' } }
    H.mlRows = [ml('American Robin', 'Photo', '2022-04-01', '0905')]
    await ready()
    fireEvent.click(screen.getByRole('button', { name: /Video/ }))
    expect(screen.getByText('No species matches this selection yet.')).toBeTruthy()
    expect(screen.queryByRole('listitem')).toBeNull()
    expect(screen.queryByRole('button', { name: /^Show (next|all)/ })).toBeNull()
  })
})

describe('paging, focus and the live region (FR-37, NFR-04; QA-39, QA-48)', () => {
  const MANY = Array.from({ length: 250 }, (_, i) => obs(`Bird ${String(i).padStart(3, '0')}`, '2020-01-01', null, `S${i}`))

  it('shows 100, then 200, then all, and focus never falls to the body', async () => {
    H.observations = MANY
    await ready()
    expect(screen.getAllByRole('listitem')).toHaveLength(100)
    const next = screen.getByRole('button', { name: 'Show next 100' })
    next.focus()
    fireEvent.click(next)
    expect(screen.getAllByRole('listitem')).toHaveLength(200)
    expect(document.activeElement).toBe(next)
    // Row 101 continues the numbering from the first page.
    expect(screen.getAllByRole('listitem')[100].querySelector('.sr-lfl-num')!.textContent).toBe('150')
    fireEvent.click(screen.getByRole('button', { name: 'Show all (250)' }))
    expect(screen.getAllByRole('listitem')).toHaveLength(250)
    expect(screen.queryByRole('button', { name: /^Show (next|all)/ })).toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(document.querySelector('.sr-lfl-count')))
    expect(document.querySelector('.sr-lfl-count')!.textContent).toBe('250 species, newest first by the date of your first sighting.')
  })

  it('a control press resets paging to 100', async () => {
    H.observations = MANY
    await ready()
    fireEvent.click(screen.getByRole('button', { name: /Show all/ }))
    fireEvent.click(screen.getByRole('switch', { name: 'Include Exotics' }))
    expect(screen.getAllByRole('listitem')).toHaveLength(100)
  })

  it('the live region carries the sentence, and a repeated press replaces its child node', async () => {
    await ready()
    const region = screen.getByRole('status')
    expect(region.getAttribute('aria-live')).toBe('polite')
    expect(region.textContent).toBe('3 species, newest first by the date of your first sighting.')
    const before = region.firstChild
    fireEvent.click(screen.getByRole('switch', { name: 'Include Escapees' }))
    expect(region.textContent).toBe('3 species, newest first by the date of your first sighting.')
    expect(region.firstChild).not.toBe(before)
  })
})

describe('a control change re-runs no file pass (NFR-02, QA-45)', () => {
  it('runs each file pass once per files epoch, never for a switch, a media press or a page', async () => {
    H.files = { ebird: { filename: 'x.csv' }, ml: { filename: 'ml.csv' } }
    H.mlRows = [ml('American Robin', 'Photo', '2022-04-01', '0905')]
    await ready()
    expect(vi.mocked(deriveFirstSightings)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(deriveFirstAssets)).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('switch', { name: 'Include Escapees' }))
    fireEvent.click(screen.getByRole('button', { name: /Photo/ }))
    fireEvent.click(screen.getByRole('button', { name: /Photo/ }))
    expect(vi.mocked(deriveFirstSightings)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(deriveFirstAssets)).toHaveBeenCalledTimes(1)
    await act(async () => { notifyFilesChanged() })
    await waitFor(() => expect(vi.mocked(deriveFirstSightings)).toHaveBeenCalledTimes(2))
    expect(vi.mocked(deriveFirstAssets)).toHaveBeenCalledTimes(2)
  })
})

describe('security review rows (security L2, I3)', () => {
  /** A Statistics merge: the store replaces its snapshot and notifies. */
  async function merge(next: ProvenanceSnapshot) {
    await act(async () => {
      H.snapshot = next
      for (const l of [...H.listeners]) l()
    })
  }

  it('a provenance merge re-runs the per-species check, never the per-row index (L2)', async () => {
    const base = { checklists: new Set(['S2']), exoticNames: [] as string[] }
    H.snapshot = snapshot({ ...base, species: new Map([['amerob', rec(['|'])]]) })
    await ready()
    await waitFor(() => expect(vi.mocked(buildCoverIndex)).toHaveBeenCalledTimes(1))
    expect(screen.getByText(STATUS_UNRESOLVED)).toBeTruthy()
    // Two merges with the rows unchanged; the second answers the last species.
    await merge(snapshot({ ...base, species: new Map([['amerob', rec(['|'])], ['mandar', rec(['X|'])]]) }))
    expect(screen.getByText(STATUS_UNRESOLVED)).toBeTruthy()
    await merge(snapshot({ ...base, species: new Map([['amerob', rec(['|'])], ['mandar', rec(['X|'])], ['rocpig', rec(['N|'])]]) }))
    // The cheap half re-ran (the sentence moved); the index was built once.
    expect(await screen.findByText(STATUS_RESOLVED)).toBeTruthy()
    expect(vi.mocked(buildCoverIndex)).toHaveBeenCalledTimes(1)
  })

  it('species named constructor and __proto__ get no code and no mark (I3)', async () => {
    H.observations = [...BASE, obs('constructor', '2022-01-01', null, 'S7'), obs('__proto__', '2022-02-02', null, 'S8')]
    await ready()
    await waitFor(() => expect(screen.getAllByRole('link', { name: /^View American Robin on eBird/ })).toHaveLength(1))
    expect(rowNames()).toEqual(expect.arrayContaining(['constructor', '__proto__']))
    for (const name of ['constructor', '__proto__']) {
      const li = screen.getAllByRole('listitem').find(l => within(l).getAllByRole('button')[0].textContent === name)!
      expect(within(li).queryByRole('link', { name: /^View / }), name).toBeNull()
    }
    for (const a of Array.from(document.querySelectorAll('a[href]'))) {
      expect(a.getAttribute('href')).not.toMatch(/object|function|undefined|__proto__|constructor/i)
    }
    // SpeciesLinks' own shape gate would also contain an inherited member, so
    // the outcome alone cannot tell the read guard is there: pin the call site
    // too (testing.md v0.5.88, a pattern test cannot see a weakened call site).
    const src = readFileSync(process.cwd() + '/src/components/lifeLists/LifeListsTab.tsx', 'utf8')
    expect(src).toContain('Object.hasOwn(taxonMap, name)')
    expect(src).toContain('Object.hasOwn(taxonMap, norm)')
  })
})

describe('ids and the files epoch (FR-09, FR-38; QA-09, QA-40)', () => {
  it('mints no id or IDREF from file content', async () => {
    H.observations = [obs('"><img src=x>', '2020-01-01', null, 'S1'), ...BASE]
    await ready()
    const refs: string[] = []
    for (const el of Array.from(document.querySelectorAll('*'))) {
      for (const attr of ['id', 'aria-describedby', 'aria-labelledby', 'aria-controls']) {
        const v = el.getAttribute(attr)
        if (v) refs.push(v)
      }
    }
    expect(refs.length).toBeGreaterThan(0)
    for (const v of refs) {
      expect(v).not.toMatch(/img|Robin|Mandarin|Pigeon|Lake Park/)
      expect(document.getElementById(v), v).not.toBeNull()
    }
  })

  it('re-derives on a files-epoch bump, and a removed backup returns the setup state', async () => {
    await ready()
    H.files = { ebird: null, ml: null }
    await act(async () => { notifyFilesChanged() })
    expect(await screen.findByText('eBird Backup Required')).toBeTruthy()
    expect(screen.queryByRole('listitem')).toBeNull()
  })
})

// ── The Region control (life-list-region-filter) ─────────────────────────────

const REGIONS = [
  obs('American Robin', '2019-05-02', '6:30 AM', 'S1', { scientificName: 'Turdus migratorius' }),
  obs('American Robin', '2022-06-01', '8:15 AM', 'S5', { scientificName: 'Turdus migratorius', county: 'Marin', stateProvince: 'US-CA', location: 'Point Reyes' }),
  obs('Mandarin Duck', '2021-03-09', null, 'S2', { scientificName: 'Aix galericulata', county: 'Marin', stateProvince: 'US-CA' }),
  obs('Rock Pigeon', '2020-01-01', '9:00 AM', 'junk', { scientificName: 'Columba livia', county: null, stateProvince: null }),
  obs('Wrentit', '2023-04-04', '7:00 AM', 'S6', { scientificName: 'Chamaea fasciata', county: 'Marin', stateProvince: 'US-CA' }),
]
const MARIN = { level: 'county', code: 'US-CA', county: 'Marin' }

const combo = () => screen.getByRole('combobox', { name: 'Region' }) as HTMLInputElement
/** Open the list by focus, as a user does, and press an option by its name. */
function chooseRegion(label: string) {
  const input = combo()
  if (input.getAttribute('aria-expanded') !== 'true') {
    act(() => { input.blur() })
    act(() => { input.focus() })
  }
  fireEvent.mouseDown(screen.getByRole('option', { name: label }))
}
const isoOf = (day: number) => `${String(day).slice(0, 4)}-${String(day).slice(4, 6)}-${String(day).slice(6)}`
/** The rendered rows as the user reads them: name, position, date. */
const rendered = () => screen.getAllByRole('listitem').map(li => [
  within(li).getAllByRole('button')[0].textContent, li.querySelector('.sr-lfl-num')!.textContent, li.querySelector('.sr-lfl-date')!.textContent,
])

describe('the Region control (life-list-region-filter FR-07, FR-08; QA-07, QA-08)', () => {
  it('offers Everywhere and the three groups from the backup, keyboard operable, with index-keyed ids', async () => {
    H.observations = [...REGIONS, obs('Bushtit', '2020-02-02', null, 'S7', { county: 'Prince George\'s "x" <b>', stateProvince: 'US-MD' })]
    await ready()
    const input = combo()
    expect(input.value).toBe('Everywhere')
    expect(input.getAttribute('aria-expanded')).toBe('false')
    expect(input.hasAttribute('aria-controls')).toBe(false)
    act(() => { input.focus() })
    expect(input.getAttribute('aria-expanded')).toBe('true')
    const list = screen.getByRole('listbox', { name: 'Regions in your backup' })
    expect(input.getAttribute('aria-controls')).toBe(list.id)
    expect(within(list).getAllByRole('group').map(g => g.querySelector('.sr-lfl-region-grp')!.textContent)).toEqual(['Countries', 'States and provinces', 'Counties'])
    expect(within(list).getAllByRole('option').map(o => o.textContent)).toEqual([
      'Everywhere', 'United States', 'California', 'Maryland', 'Minnesota', 'Hennepin, MN', 'Marin, CA', 'Prince George\'s "x" <b>, MD',
    ])
    // Exactly one selected value is exposed, and the active option is the selection.
    expect(within(list).getAllByRole('option').filter(o => o.getAttribute('aria-selected') === 'true').map(o => o.textContent)).toEqual(['Everywhere'])
    expect(document.getElementById(input.getAttribute('aria-activedescendant')!)!.textContent).toBe('Everywhere')
    // QA-07: every id and IDREF resolves and none carries a place name.
    const refs: string[] = []
    for (const el of Array.from(document.querySelectorAll('*'))) {
      for (const attr of ['id', 'aria-labelledby', 'aria-controls', 'aria-activedescendant', 'aria-describedby']) {
        const v = el.getAttribute(attr)
        if (v) refs.push(v)
      }
    }
    expect(refs.length).toBeGreaterThan(10)
    for (const v of refs) {
      expect(v).not.toMatch(/Marin|Hennepin|Prince|George|CA|MN|MD|United|<|"/)
      for (const id of v.split(' ')) expect(document.getElementById(id), id).not.toBeNull()
    }
    // Keyboard alone: type to filter by label, move, commit, then close and reopen.
    fireEvent.change(input, { target: { value: 'mar' } })
    expect(within(screen.getByRole('listbox')).getAllByRole('option').map(o => o.textContent)).toEqual(['Everywhere', 'Maryland', 'Marin, CA'])
    expect(document.getElementById(input.getAttribute('aria-activedescendant')!)!.textContent).toBe('Maryland')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(input.getAttribute('aria-expanded')).toBe('false')
    expect(input.value).toBe('Marin, CA')
    expect(document.activeElement).toBe(input)
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(input.getAttribute('aria-expanded')).toBe('true')
    fireEvent.change(input, { target: { value: 'zz' } })
    expect(screen.getByText('No region matches this search.')).toBeTruthy()
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(input.getAttribute('aria-expanded')).toBe('false')
    expect(input.value).toBe('Marin, CA')
  })

  it('a hostile county, once chosen, is the input value and no attribute of the control carries it (security I3, v1.0.34)', async () => {
    const hostile = 'Prince George\'s "x" <b>'
    const label = `${hostile}, MD`
    H.observations = [...REGIONS, obs('Bushtit', '2020-02-02', null, 'S7', { county: hostile, stateProvince: 'US-MD' })]
    await ready()
    chooseRegion(label)
    const input = combo()
    expect(input.value).toBe(label)
    expect(countText()).toBe(`1 species in ${label}, newest first by the date of your first sighting there.`)
    // Closed, then open again (options, the active descendant and the group
    // ids minted): only the input's own value may hold the text.
    const scan = (when: string) => {
      const control = input.closest('.sr-lfl-region-row')!
      const els = [control, ...Array.from(control.querySelectorAll('*'))]
      let attrs = 0
      for (const el of els) {
        for (const a of Array.from(el.attributes)) {
          if (el === input && a.name === 'value') { expect(a.value, when).toBe(input.value); continue }
          attrs += 1
          for (const needle of [label, hostile, 'Prince', 'George']) expect(a.value, `${when}: ${a.name}`).not.toContain(needle)
        }
      }
      expect(attrs, when).toBeGreaterThan(15)
    }
    scan('closed')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(input.getAttribute('aria-expanded')).toBe('true')
    expect(document.getElementById(input.getAttribute('aria-activedescendant')!)!.textContent).toBe(label)
    scan('open')
  })

  it('a backup with no State/Province anywhere offers only Everywhere, disabled (QA-08)', async () => {
    H.observations = BASE.map(o => ({ ...o, stateProvince: '' }))
    await ready()
    const input = combo()
    expect(input.disabled).toBe(true)
    expect(input.value).toBe('Everywhere')
    expect((screen.getByRole('button', { name: 'Show regions' }) as HTMLButtonElement).disabled).toBe(true)
    expect(countText()).toBe('3 species, newest first by the date of your first sighting.')
  })
})

describe('the Everywhere golden (FR-05, QA-05)', () => {
  it('equals selectRows as shipped under all eight media states and all four switch states, before and after a region round trip', async () => {
    H.files = { ebird: { filename: 'x.csv' }, ml: { filename: 'ml.csv' } }
    H.observations = REGIONS
    H.mlRows = [ml('American Robin', 'Photo', '2022-04-01', '0905'), ml('American Robin', 'Audio', '2023-01-01', '0650'), ml('Mandarin Duck', 'Photo', '2021-04-01', '1000'), ml('Wrentit', 'Video', '2023-05-01', '0700')]
    H.snapshot = snapshot({
      checklists: new Set(['S2', 'junk']), excludedNames: ['Mandarin Duck'], exoticNames: ['Rock Pigeon'],
      species: new Map([['amerob', rec(['|'])], ['mandar', rec(['X|'])], ['rocpig', rec(['N|'])]]),
    })
    await ready()
    const cls = { escapees: new Set(['Mandarin Duck']), exotics: new Set(['Rock Pigeon']) }
    const firsts = deriveFirstSightings(REGIONS), assets = deriveFirstAssets(H.mlRows as MLExportRow[])
    const SEL: MediaFormat[][] = [[], ['Photo'], ['Audio'], ['Video'], ['Photo', 'Audio'], ['Photo', 'Video'], ['Audio', 'Video'], ['Photo', 'Audio', 'Video']]
    const state = { esc: false, exo: true, sel: new Set<MediaFormat>() }
    const setTo = (esc: boolean, exo: boolean, sel: MediaFormat[]) => {
      if (state.esc !== esc) { fireEvent.click(screen.getByRole('switch', { name: 'Include Escapees' })); state.esc = esc }
      if (state.exo !== exo) { fireEvent.click(screen.getByRole('switch', { name: 'Include Exotics' })); state.exo = exo }
      for (const f of ['Photo', 'Audio', 'Video'] as MediaFormat[]) {
        if (state.sel.has(f) !== sel.includes(f)) {
          fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${f}$`) }))
          if (sel.includes(f)) state.sel.add(f); else state.sel.delete(f)
        }
      }
    }
    const sweep = () => {
      let seen = 0
      for (const [esc, exo] of [[false, false], [false, true], [true, false], [true, true]] as const) for (const sel of SEL) {
        setTo(esc, exo, sel)
        const want = selectRows(firsts, assets, cls, { includeEscapees: esc, includeExotics: exo, formats: new Set(sel) })
        const got = want.length === 0 ? [] : rendered()
        expect(got, `${esc} ${exo} ${sel}`).toEqual(want.map(r => [r.name, String(r.position), formatDate(isoOf(r.day))]))
        expect(countText()).toBe(countSentence(want.length, new Set(sel)))
        seen += 1
      }
      expect(seen).toBe(32)
    }
    sweep()
    chooseRegion('Marin, CA')
    expect(countText()).toMatch(/ in Marin, CA, /)
    chooseRegion('Everywhere')
    sweep()
  })
})

describe('a region change (FR-09 to FR-12, FR-17 to FR-21; QA-09, QA-10, QA-17 to QA-21)', () => {
  it('lists the regional first sightings, renumbered, named in the sentence, with focus kept on the control', async () => {
    H.observations = REGIONS
    await ready()
    const everywhere = rendered()
    chooseRegion('Marin, CA')
    expect(document.activeElement).toBe(combo())
    expect(combo().getAttribute('aria-expanded')).toBe('false')
    expect(rendered()).toEqual([
      ['Wrentit', '3', formatDate('2023-04-04')], ['American Robin', '2', formatDate('2022-06-01')], ['Mandarin Duck', '1', formatDate('2021-03-09')],
    ])
    expect(everywhere.find(r => r[0] === 'American Robin')![1]).not.toBe('2')
    const robin = screen.getAllByRole('listitem')[1]
    expect(within(robin).getByText('8:15 AM')).toBeTruthy()
    expect(within(robin).getByText('Point Reyes')).toBeTruthy()
    expect(within(robin).getByRole('link', { name: /S5.*eBird/ })).toBeTruthy()
    expect(robin.querySelector('.sr-lfl-name .sr-only')!.textContent).toBe('2 of 3. ')
    expect(countText()).toBe('3 species in Marin, CA, newest first by the date of your first sighting there.')
    expect(document.querySelector('.sr-lfl-count-region')!.textContent).toBe('Marin, CA')
    // Rock Pigeon's row has no State/Province, so it is in no region (FR-03);
    // Robin's US first is its world first, in Minnesota.
    chooseRegion('United States')
    expect(countText()).toBe('3 species in United States, newest first by the date of your first sighting there.')
    expect(rowNames()).not.toContain('Rock Pigeon')
    expect(rendered().find(r => r[0] === 'American Robin')![2]).toBe(formatDate('2019-05-02'))
    chooseRegion('Everywhere')
    expect(rendered()).toEqual(everywhere)
    expect(document.querySelector('.sr-lfl-count-region')).toBeNull()
  })

  it('resets paging, re-keys the live region once, and animates only the rows it adds (QA-09, QA-21)', async () => {
    const many = Array.from({ length: 250 }, (_, i) => obs(`Bird ${String(i).padStart(3, '0')}`, '2020-01-01', null, `S${i}`, i % 2 ? {} : { county: 'Marin', stateProvince: 'US-CA' }))
    H.observations = [...many, obs('Wrentit', '2024-01-01', null, 'S900', { county: 'Marin', stateProvince: 'US-CA' })]
    await ready()
    fireEvent.click(screen.getByRole('button', { name: 'Show next 100' }))
    expect(screen.getAllByRole('listitem')).toHaveLength(200)
    chooseRegion('Minnesota')
    expect(screen.getAllByRole('listitem')).toHaveLength(100)
    const region = screen.getByRole('status')
    const before = region.firstChild
    chooseRegion('California')
    expect(region.firstChild).not.toBe(before)
    expect(region.childNodes).toHaveLength(1)
    expect(region.textContent).toBe('126 species in California, newest first by the date of your first sighting there.')
    // Nothing under Minnesota is under California, so every row shown enters.
    const items = screen.getAllByRole('listitem')
    expect(items.every(li => li.className === 'sr-lfl-row is-new')).toBe(true)
    expect(document.activeElement).toBe(combo())
    // A region sharing rows with the last one animates only the rows it adds.
    chooseRegion('Marin, CA')
    expect(screen.getAllByRole('listitem').filter(li => li.className.includes('is-new'))).toHaveLength(0)
  })

  it('the switches keep their meaning under a region, and the status line is unchanged (QA-17)', async () => {
    H.observations = [...REGIONS, obs('Rock Pigeon', '2023-01-01', null, 'S8', { scientificName: 'Columba livia', county: 'Marin', stateProvince: 'US-CA' })]
    H.snapshot = snapshot({
      checklists: new Set(['S2', 'junk', 'S8']), excludedNames: ['Mandarin Duck'], exoticNames: ['Rock Pigeon'],
      species: new Map([['amerob', rec(['|'])], ['mandar', rec(['X|'])], ['rocpig', rec(['N|'])]]),
    })
    await ready()
    // The status line settles once this roster's codes resolve; read it then.
    await waitFor(() => expect(screen.getAllByRole('link', { name: /^View .+ on eBird \(opens/ }).length).toBeGreaterThan(0))
    const status = document.querySelector('.sr-lfl-status')!.textContent
    chooseRegion('Marin, CA')
    expect(document.querySelector('.sr-lfl-status')!.textContent).toBe(status)
    expect(rowNames()).toEqual(['Wrentit', 'Rock Pigeon', 'American Robin'])
    fireEvent.click(screen.getByRole('switch', { name: 'Include Exotics' }))
    expect(rowNames()).toEqual(['Wrentit', 'American Robin'])
    fireEvent.click(screen.getByRole('switch', { name: 'Include Escapees' }))
    expect(rowNames()).toEqual(['Wrentit', 'American Robin', 'Mandarin Duck'])
    expect(document.querySelector('.sr-lfl-status')!.textContent).toBe(status)
  })

  it('the empty state names the region, and the media cell stays global (QA-12, QA-14, QA-20)', async () => {
    H.observations = REGIONS
    H.files = { ebird: { filename: 'x.csv' }, ml: { filename: 'ml.csv' } }
    H.mlRows = [ml('American Robin', 'Photo', '2022-04-01', '0905')]
    await ready()
    chooseRegion('Marin, CA')
    // FR-12, at the tab's own composition: the photo's checklist is not in the
    // backup, so it dates nothing here, yet the cell reports what Robin has.
    const robin = screen.getAllByRole('listitem').find(li => within(li).getAllByRole('button')[0].textContent === 'American Robin')!
    expect(within(robin).getByRole('img').getAttribute('aria-label')).toBe('Media: photo')
    fireEvent.click(screen.getByRole('button', { name: /^Photo$/ }))
    expect(screen.getByText('No species matches this selection in Marin, CA yet.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /^Photo$/ }))
    fireEvent.click(screen.getByRole('button', { name: /^Video$/ }))
    expect(screen.getByText('No species matches this selection in Marin, CA yet.')).toBeTruthy()
  })
})

describe('the region passes run once per files epoch (FR-06, FR-28; QA-06)', () => {
  it('a region, switch or media press re-runs no region pass; an epoch re-derives the choices', async () => {
    H.files = { ebird: { filename: 'x.csv' }, ml: { filename: 'ml.csv' } }
    H.observations = REGIONS
    H.mlRows = [ml('American Robin', 'Photo', '2022-04-01', '0905')]
    await ready()
    expect(vi.mocked(deriveRegionIndex)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(deriveRegionAssets)).toHaveBeenCalledTimes(1)
    chooseRegion('Marin, CA')
    fireEvent.click(screen.getByRole('switch', { name: 'Include Escapees' }))
    fireEvent.click(screen.getByRole('button', { name: /^Photo$/ }))
    chooseRegion('Everywhere')
    expect(vi.mocked(deriveRegionIndex)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(deriveRegionAssets)).toHaveBeenCalledTimes(1)
    H.observations = [...REGIONS, obs('Wrentit', '2024-01-01', null, 'S9', { county: 'Sonoma', stateProvince: 'US-CA' })]
    await act(async () => { notifyFilesChanged() })
    await waitFor(() => expect(vi.mocked(deriveRegionIndex)).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(document.querySelector('.sr-lfl-count')).not.toBeNull())
    act(() => { combo().focus() })
    expect(screen.getByRole('option', { name: 'Sonoma, CA' })).toBeTruthy()
  })
})

describe('the saved region (FR-22 to FR-27; QA-22 to QA-26, QA-28)', () => {
  it('a region choice writes the one key once; Everywhere deletes it; switches and media write nothing; no request (QA-22, QA-26, QA-28)', async () => {
    H.files = { ebird: { filename: 'x.csv' }, ml: { filename: 'ml.csv' } }
    H.observations = REGIONS
    H.mlRows = [ml('American Robin', 'Photo', '2022-04-01', '0905')]
    await ready()
    await waitFor(() => expect(H.post).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole('switch', { name: 'Include Escapees' }))
    fireEvent.click(screen.getByRole('button', { name: /^Photo$/ }))
    fireEvent.click(screen.getByRole('button', { name: /^Photo$/ }))
    chooseRegion('Marin, CA')
    await waitFor(() => expect(H.setSetting).toHaveBeenCalledTimes(1))
    expect(H.setSetting).toHaveBeenCalledWith('lifeListsRegion', MARIN)
    chooseRegion('Marin, CA')                        // the region already shown: a no-op
    chooseRegion('Everywhere')
    await waitFor(() => expect(H.deleteSetting).toHaveBeenCalledTimes(1))
    expect(H.deleteSetting).toHaveBeenCalledWith('lifeListsRegion')
    expect(H.setSetting).toHaveBeenCalledTimes(1)
    expect(H.post).toHaveBeenCalledTimes(1)
    expect(H.getSetting.mock.calls.map(c => c[0])).toEqual(['lifeListsRegion'])
  })

  it('a rejected write leaves the selection applied and shows nothing (FR-22)', async () => {
    H.observations = REGIONS
    H.setSetting.mockImplementation(async () => { throw new Error('disk full') })
    await ready()
    chooseRegion('Marin, CA')
    await waitFor(() => expect(H.setSetting).toHaveBeenCalledTimes(1))
    expect(countText()).toMatch(/^3 species in Marin, CA/)
    expect(document.querySelector('[role="alert"]')?.textContent ?? '').toBe('')
  })

  it('a saved region present in the backup is the first list rendered, with no unfiltered render before it (QA-23)', async () => {
    H.observations = REGIONS
    H.getSetting.mockImplementation(async () => MARIN)
    const seen: string[] = []
    const mo = new MutationObserver(() => { const t = document.querySelector('.sr-lfl-count')?.textContent; if (t && seen[seen.length - 1] !== t) seen.push(t) })
    mo.observe(document.body, { subtree: true, childList: true, characterData: true })
    await ready()
    mo.disconnect()
    expect(seen).toEqual(['3 species in Marin, CA, newest first by the date of your first sighting there.'])
    expect(combo().value).toBe('Marin, CA')
    expect(H.setSetting).not.toHaveBeenCalled()
  })

  it('a saved region absent from the backup reads Everywhere silently, applies again when it returns, and yields to a session choice (QA-24)', async () => {
    H.observations = BASE
    H.getSetting.mockImplementation(async () => MARIN)
    await ready()
    expect(combo().value).toBe('Everywhere')
    expect(countText()).toBe('3 species, newest first by the date of your first sighting.')
    expect(document.querySelector('[role="alert"]')?.textContent ?? '').toBe('')
    H.observations = REGIONS
    await act(async () => { notifyFilesChanged() })
    await waitFor(() => expect(countText()).toMatch(/^3 species in Marin, CA/))
    chooseRegion('Minnesota')
    await waitFor(() => expect(H.setSetting).toHaveBeenCalledTimes(1))
    H.observations = [...REGIONS]
    await act(async () => { notifyFilesChanged() })
    await waitFor(() => expect(vi.mocked(deriveRegionIndex)).toHaveBeenCalledTimes(3))
    await waitFor(() => expect(countText()).toMatch(/ in Minnesota, /))
    expect(H.setSetting).toHaveBeenCalledTimes(1)
    expect(H.deleteSetting).not.toHaveBeenCalled()
  })

  it.each([
    ['a string', 'US-CA'], ['an unknown level', { level: 'city', code: 'US' }], ['a long county', { ...MARIN, county: 'M'.repeat(97) }],
    ['a long state', { level: 'state', code: 'US-' + 'C'.repeat(14) }], ['a prototype key', JSON.parse('{"__proto__": {"level": "country", "code": "US"}}')],
    ['a rejected read', 'REJECT'],
  ])('a stored value that is %s reads as Everywhere with no throw (QA-25)', async (_label, value) => {
    H.observations = REGIONS
    H.getSetting.mockImplementation(async () => { if (value === 'REJECT') throw new Error('seam down'); return value })
    await ready()
    expect(combo().value).toBe('Everywhere')
    expect(countText()).toMatch(/^4 species, newest first/)
  })

  it('a valid stored region matching no choice never reaches the DOM (QA-25)', async () => {
    H.observations = REGIONS
    H.getSetting.mockImplementation(async () => ({ level: 'county', code: 'US-CA', county: 'Zzyzx Flats' }))
    await ready()
    act(() => { combo().focus() })
    expect(document.body.innerHTML).not.toContain('Zzyzx')
    expect(combo().value).toBe('')
  })
})

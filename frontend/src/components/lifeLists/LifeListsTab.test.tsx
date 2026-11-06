// @vitest-environment jsdom
//
// The Life Lists tab (life-lists-tab). Component rows for what the pure suites
// cannot see: the phase gate (QA-05 to QA-07), the three ML states (QA-28), the
// controls (QA-22, QA-37, QA-38), the rows (QA-31 to QA-34, QA-54 to QA-56),
// paging and its focus (QA-39), the live region (QA-48), index-keyed ids
// (QA-40), the files epoch (QA-09) and the request count at the transport seam
// (QA-41). jsdom has no layout, so nothing here claims a geometric fact; the
// 320px / 200% claims belong to the live look in a real engine.

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
  setSetting: vi.fn(async () => {}),
  snapshot: null as unknown,
  getFilesStatus: vi.fn(),
}))

vi.mock('../../lib/storage', () => ({
  storage: {
    getFilesStatus: H.getFilesStatus,
    getSetting: vi.fn(async () => null),
    setSetting: H.setSetting,
  },
}))
vi.mock('../../lib/observationsCache', () => ({
  loadEbirdObservations: vi.fn(async () => (H.ebirdNull ? null : { headerLine: '', observations: H.observations })),
}))
vi.mock('../../lib/mlExportCache', () => ({
  loadMLExport: vi.fn(async () => (H.mlRows ? { entries: [], mediaMap: {}, rows: H.mlRows } : null)),
}))
vi.mock('../../lib/transport', () => ({ transport: { post: H.post, get: vi.fn() } }))
vi.mock('../../lib/exoticProvenanceCache', () => ({
  getSnapshot: () => H.snapshot,
  subscribe: () => () => {},
  loadSnapshot: vi.fn(async () => H.snapshot),
}))

import { LifeListsTab } from './LifeListsTab'
import { notifyFilesChanged } from '../../lib/filesChanged'
import { formatDate } from '../../lib/formatDate'
import { EBIRD_BACKUP_LOAD_ERROR } from '../setupCopy'
import { ML_NONE_SENTENCE, ML_UNREADABLE_SENTENCE, STATUS_RESOLVED, STATUS_UNRESOLVED } from '../../lib/lifeListsCopy'

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
  H.getFilesStatus.mockImplementation(async () => H.files)
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
  it('start off, expose their state, and add exactly their species (QA-19, QA-37)', async () => {
    H.snapshot = snapshot({ checklists: new Set(['S1', 'S2', 'junk']), excludedNames: ['Mandarin Duck'], exoticNames: ['Rock Pigeon'] })
    await ready()
    const esc = screen.getByRole('switch', { name: 'Include Escapees' })
    const exo = screen.getByRole('switch', { name: 'Include Exotics' })
    expect(esc.getAttribute('aria-checked')).toBe('false')
    expect(exo.getAttribute('aria-checked')).toBe('false')
    expect(rowNames()).toEqual(['American Robin'])
    fireEvent.click(esc)
    expect(esc.getAttribute('aria-checked')).toBe('true')
    expect(rowNames()).toEqual(['Mandarin Duck', 'American Robin'])
    fireEvent.click(exo)
    expect(rowNames()).toEqual(['Mandarin Duck', 'Rock Pigeon', 'American Robin'])
    fireEvent.click(esc)
    expect(rowNames()).toEqual(['Rock Pigeon', 'American Robin'])
    // Every carrier consulted and the list published: the second sentence.
    expect(screen.getByText(STATUS_RESOLVED)).toBeTruthy()
  })

  it('an unpublished exotic list lists everything and says the check has not finished (QA-20, QA-21)', async () => {
    await ready()
    expect(rowNames()).toHaveLength(3)
    const status = screen.getByText(STATUS_UNRESOLVED)
    expect(status.querySelector('a, button')).toBeNull()
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
    expect(screen.queryByRole('button', { name: /Show/ })).toBeNull()
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
    expect(screen.queryByRole('button', { name: /Show/ })).toBeNull()
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

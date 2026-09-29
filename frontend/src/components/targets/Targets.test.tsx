// @vitest-environment jsdom
// The Targets tab, rendered (targets-tab QA-09, QA-11, QA-12, QA-22, QA-25,
// QA-27, QA-38, QA-40, QA-42, QA-44, QA-58, QA-59, QA-60, QA-68).
//
// The pool comes from the REAL shared completeness store over a faked storage
// seam, so "renders before any network call" is a claim about the shipped
// store rather than about a mock of it; the day cache and the bar-chart pipeline
// are real too. Faked: storage, the backup and ML loaders, the transport, the
// county geometry and the external-open seam.
//
// WHAT THIS CANNOT SEE: layout (jsdom has none), the accessibility tree (only
// the DOM's roles and names), and WebKit's tab order. The 320px / 200% claims
// and the live look belong to the browser-verified stage (schema.md 9.3).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor, fireEvent, within } from '@testing-library/react'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import type { ObservationEntry } from '../../types'

const H = vi.hoisted(() => ({
  settings: new Map<string, unknown>(),
  files: { ebird: { filename: 'MyEBirdData.csv', uploadedAt: '2026-09-01' }, ml: null } as { ebird: unknown; ml: unknown },
  filesReject: false,
  key: null as string | null,
  barcharts: { version: 1, counties: {} } as unknown,
  barchartsReject: false,
  barchartText: null as string | null,
  obs: [] as unknown[],
  ml: null as unknown,
  tGet: vi.fn(),
  tPost: vi.fn(),
  open: vi.fn(),
  dayDoc: null as unknown,
  /** Every value any storage write carried, serialized, for the never-written proof. */
  writes: [] as Array<{ method: string; key: string; json: string }>,
  locate: vi.fn(),
}))

vi.mock('../../lib/storage', () => ({
  storage: {
    getFilesStatus: async () => { if (H.filesReject) throw new TypeError('Failed to fetch'); return H.files },
    getApiKey: async () => H.key,
    getSetting: async (k: string) => (H.settings.has(k) ? structuredClone(H.settings.get(k)) : null),
    setSetting: async (k: string, v: unknown) => {
      H.writes.push({ method: 'setSetting', key: k, json: JSON.stringify(v) })
      H.settings.set(k, structuredClone(v))
    },
    deleteSetting: async (k: string) => { H.settings.delete(k) },
    getCountyDayObsStore: async () => (H.dayDoc === null ? null : structuredClone(H.dayDoc)),
    setCountyDayObsStore: async (doc: unknown) => {
      H.writes.push({ method: 'setCountyDayObsStore', key: '', json: JSON.stringify(doc) })
      H.dayDoc = structuredClone(doc)
    },
    deleteCountyDayObsStore: async () => { H.dayDoc = null },
    getBarChartFiles: async () => { if (H.barchartsReject) throw new Error('EIO'); return H.barcharts },
    readBarChartFile: async () => H.barchartText,
    writeBarChartFile: vi.fn(async () => {}),
    deleteBarChartFile: vi.fn(async () => {}),
  },
}))
vi.mock('../../lib/observationsCache', () => ({ loadEbirdObservations: async () => ({ headerLine: 'x', observations: H.obs }) }))
vi.mock('../../lib/mlExportCache', () => ({ loadMLExport: async () => H.ml }))
vi.mock('../../lib/transport', () => ({
  transport: { get: H.tGet, post: H.tPost },
  TransportError: class extends Error {},
}))
vi.mock('../../lib/openExternal', () => ({ openExternalUrl: H.open }))
vi.mock('../../lib/location', async importOriginal => ({
  ...(await importOriginal<typeof import('../../lib/location')>()),
  getCurrentLocation: () => H.locate(),
}))
vi.mock('../../lib/countyGeometry', () => ({
  loadCountyGeometry: async () => ({
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', bbox: [0, 0, 0, 0], properties: { name: 'Alameda', stusps: 'CA', geoid: '06001', statefp: '06' }, geometry: { type: 'Polygon', coordinates: [] } },
      // A county whose NAME is hostile: ids must never be built from it (QA-59).
      { type: 'Feature', bbox: [0, 0, 0, 0], properties: { name: 'Evil "x" <y> z', stusps: 'CA', geoid: '06013', statefp: '06' }, geometry: { type: 'Polygon', coordinates: [] } },
    ],
  }),
}))

import { Targets } from './Targets'
import { COMPLETENESS_STORE_KEY } from '../../lib/countyCompletenessCache'
import { _resetCountyCompletenessCacheForTests } from '../../lib/countyCompletenessCache'
import { _resetCountyDayObsCacheForTests } from '../../lib/countyDayObsCache'
import { EBIRD_BACKUP_LOAD_ERROR } from '../setupCopy'
import { CHIPS_GROUP_LABEL, THRESHOLD_GROUP_LABEL } from '../../lib/targets/targetsCopy'

function obs(commonName: string, over: Partial<ObservationEntry> = {}): ObservationEntry {
  return {
    submissionId: 'S1', commonName, scientificName: `${commonName} sci`, date: '2026-05-01',
    location: 'X', locationId: 'L1', latitude: 37.8, longitude: -122.2, county: 'Alameda', count: 1,
    breedingCode: null, speciesComments: '', catalogIds: [], stateProvince: 'US-CA', ...over,
  }
}

const HOSTILE_SPECIES = 'Evil "bird" <b> x'
const POOL = {
  regionCode: 'US-CA-001',
  speciesCount: 4,
  species: [
    { speciesCode: 'amerob', commonName: 'American Robin' },
    { speciesCode: 'sonspa', commonName: 'Song Sparrow' },
    { speciesCode: 'linspa', commonName: "Lincoln's Sparrow" },
    { speciesCode: 'evilbd', commonName: HOSTILE_SPECIES },
  ],
}

function seedPool(pool = POOL) {
  H.settings.set(COMPLETENESS_STORE_KEY, {
    version: 1,
    entries: { [pool.regionCode]: { data: pool, fetchedAt: Date.now(), bytes: 10 } },
    order: [pool.regionCode],
  })
}

const props = { onGoToSettings: () => {}, filesVersion: 0 }

beforeEach(() => {
  H.settings.clear()
  H.files = { ebird: { filename: 'MyEBirdData.csv', uploadedAt: '2026-09-01' }, ml: null }
  H.filesReject = false
  H.key = null
  H.barcharts = { version: 1, counties: {} }
  H.barchartsReject = false
  H.barchartText = null
  H.obs = [obs('American Robin', { breedingCode: 'NY' }), obs('Song Sparrow'), obs('Lincoln\'s Sparrow', { county: 'Evil "x" <y> z', submissionId: 'S2' })]
  H.ml = null
  H.tGet.mockReset().mockImplementation(async () => { throw new Error('no network in this test') })
  H.tPost.mockReset().mockImplementation(async () => ({ codes: { 'American Robin': 'amerob', 'Song Sparrow': 'sonspa' } }))
  H.open.mockReset()
  H.dayDoc = null
  H.writes = []
  H.locate.mockReset().mockImplementation(async () => { throw { code: 'permission-denied' } })
  _resetCountyCompletenessCacheForTests()
  _resetCountyDayObsCacheForTests()
})
afterEach(cleanup)

async function ready() {
  render(<Targets {...props} onOpenSpecies={openSpy} />)
  await screen.findByRole('combobox', { name: 'County' })
}
const openSpy = vi.fn()
/** The tab opens on Lifer only (targets-lifers-default); rows about recorded species press Breeding first. */
const breedingOn = () => fireEvent.click(screen.getByRole('button', { name: 'Breeding' }))

describe('the load gate (QA-09)', () => {
  it('no backup stored: the setup guidance, and no picker', async () => {
    H.files = { ebird: null, ml: null }
    render(<Targets {...props} />)
    expect(await screen.findByText('eBird Backup Required')).toBeTruthy()
    expect(screen.queryByRole('combobox', { name: 'County' })).toBeNull()
  })

  it('a rejected status lookup: the load error with Retry, never the setup guidance', async () => {
    H.filesReject = true
    render(<Targets {...props} />)
    expect(await screen.findByText(EBIRD_BACKUP_LOAD_ERROR)).toBeTruthy()
    expect(screen.queryByText('eBird Backup Required')).toBeNull()
    H.filesReject = false
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await screen.findByRole('combobox', { name: 'County' })
  })
})

describe('before any network call (QA-11, QA-12, FR-52)', () => {
  it('a cached county renders its pool and badges with no key, and no request is made', async () => {
    seedPool()
    await ready()
    expect(await screen.findByText('4 species all time in Alameda, CA, from eBird')).toBeTruthy()
    expect(screen.getByRole('table', { name: 'Target list' })).toBeTruthy()
    // Only the hostile-named species is unrecorded anywhere in the backup, so it
    // is the one lifer; the others are in the record by name.
    expect(H.tGet).not.toHaveBeenCalled()
    // Alphabetical and Taxonomic are available with no key, no file, offline.
    const sort = screen.getByRole('combobox', { name: 'Sort targets' }) as HTMLSelectElement
    const opts = [...sort.options]
    expect(opts.find(o => o.value === 'alpha')!.disabled).toBe(false)
    expect(opts.find(o => o.value === 'taxonomic')!.disabled).toBe(false)
    expect(opts.find(o => o.value === 'live-days')!.disabled).toBe(true)
    expect(opts.find(o => o.value === 'freq-month')!.textContent).toContain("needs Alameda, CA's bar-chart file")
  })

  it('the sweep status region exists, empty, before the species list arrives, and is the same node after', async () => {
    // A status region created along with its first message is never announced
    // (ui.md v1.0.15), so the band's region must already be in the tree while
    // the pool is still loading, and the first status must mutate THAT node.
    H.key = 'test-key'
    let releasePool: (v: unknown) => void = () => {}
    H.tGet.mockImplementation((path: string) => {
      if (path === '/map/county-species') return new Promise(r => { releasePool = r })
      return new Promise(() => {})   // the day sweep stays in flight
    })
    await ready()
    const before = document.querySelector('.sr-tg-sweep [role="status"]')
    expect(before).not.toBeNull()
    expect(before!.textContent).toBe('')
    expect(before!.closest('.sr-tg-sweep')!.classList.contains('sr-only')).toBe(true)
    releasePool(POOL)
    await screen.findByRole('table')
    const after = document.querySelector('.sr-tg-sweep [role="status"]')
    expect(after).toBe(before)
    await waitFor(() => expect(after!.textContent!.length).toBeGreaterThan(0))
    expect(after!.closest('.sr-tg-sweep')!.classList.contains('sr-only')).toBe(false)
  })

  it('an uncached county with no key says so in one line, with no spinner (QA-14)', async () => {
    await ready()
    expect((await screen.findAllByText("Add an eBird API key in Settings to load this county's species list")).length).toBeGreaterThan(0)
  })
})

describe('toggles and the summary (QA-25, QA-27)', () => {
  it('first open: Lifer only, Media and Breeding off with no chips or threshold; pressing each brings them back (targets-lifers-default)', async () => {
    seedPool()
    // The ML export loaded, so Media is off by the default and not by FR-20.
    H.files = { ...H.files, ml: { filename: 'ml.csv', uploadedAt: '2026-09-01' } }
    H.ml = { rows: [] }
    await ready()
    const table = await screen.findByRole('table')
    const pressed = (name: string) => screen.getByRole('button', { name }).getAttribute('aria-pressed')
    expect(pressed('Lifer')).toBe('true')
    expect(pressed('Media')).toBe('false')
    expect(screen.getByRole('button', { name: 'Media' }).getAttribute('aria-disabled')).toBeNull()
    expect(pressed('Breeding')).toBe('false')
    expect(screen.queryByRole('group', { name: CHIPS_GROUP_LABEL })).toBeNull()
    expect(screen.queryByRole('group', { name: THRESHOLD_GROUP_LABEL })).toBeNull()
    // Only the lifer: the recorded species wait for their toggles.
    expect(within(table).getAllByRole('row')).toHaveLength(3)   // two header rows + the lifer
    expect(within(table).getByText(HOSTILE_SPECIES)).toBeTruthy()
    expect(within(table).queryByRole('button', { name: 'Song Sparrow' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Media' }))
    expect(pressed('Media')).toBe('true')
    expect(screen.getByRole('group', { name: CHIPS_GROUP_LABEL })).toBeTruthy()
    expect(within(screen.getByRole('table')).getByRole('button', { name: 'Song Sparrow' })).toBeTruthy()
    breedingOn()
    expect(pressed('Breeding')).toBe('true')
    expect(screen.getByRole('group', { name: THRESHOLD_GROUP_LABEL })).toBeTruthy()
  })

  it('the announced summary matches the visible rows after each toggle', async () => {
    seedPool()
    await ready()
    await screen.findByRole('table')
    const status = () => document.querySelector('.sr-tg-strip [role="status"].sr-only')!.textContent
    const rows = () => within(screen.getByRole('table')).getAllByRole('row').length - 2   // two header rows
    await waitFor(() => expect(status()).toMatch(/^\d+ targets?: /))
    expect(status()).toMatch(new RegExp(`^${rows()} target`))
    breedingOn()
    await waitFor(() => expect(status()).toMatch(new RegExp(`^${rows()} target`)))
    expect(rows()).toBeGreaterThan(1)
    fireEvent.click(screen.getByRole('button', { name: 'Lifer' }))
    await waitFor(() => expect(status()).toMatch(new RegExp(`^${rows()} target`)))
    expect(screen.getByRole('button', { name: 'Lifer' }).getAttribute('aria-pressed')).toBe('false')
  })

  it('all toggles off: exactly "Turn on at least one target type"', async () => {
    seedPool()
    await ready()
    await screen.findByRole('table')
    // Media is unavailable (no ML export) and Breeding starts off, so Lifer is the last one on.
    expect(screen.getByRole('button', { name: 'Breeding' }).getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(screen.getByRole('button', { name: 'Lifer' }))
    expect(await screen.findByText('Turn on at least one target type')).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('no ML export: the Media toggle is disabled with its reason (QA-22)', async () => {
    seedPool()
    await ready()
    const media = screen.getByRole('button', { name: 'Media' })
    expect(media.getAttribute('aria-disabled')).toBe('true')
    expect(screen.getByText('Add your ML export in Settings to see media targets')).toBeTruthy()
  })

  it('an ML export stored but unreadable: its own state with a retry, not the add reason (QA-22)', async () => {
    seedPool()
    H.files = { ...H.files, ml: { filename: 'ml.csv', uploadedAt: '2026-09-01' } }
    await ready()
    expect(screen.getByText(/Couldn't read your ML export/)).toBeTruthy()
    expect(screen.queryByText('Add your ML export in Settings to see media targets')).toBeNull()
  })
})

describe('the two kinds are told apart in words (QA-38, QA-44, QA-58)', () => {
  it('no live header or cell ever carries "%", and every probability header does', async () => {
    seedPool()
    await ready()
    const table = await screen.findByRole('table')
    const heads = within(table).getAllByRole('columnheader').map(h => h.textContent ?? '')
    const prob = heads.filter(h => /Probability|eBird frequency|This month|Year-round/.test(h))
    const live = heads.filter(h => /Live|Reported|Last report|Distance/.test(h))
    expect(prob.length).toBeGreaterThan(0)
    expect(live.length).toBeGreaterThan(0)
    for (const h of prob.filter(h => /frequency|This month|Year-round/.test(h))) expect(h).toContain('%')
    for (const h of live) expect(h).not.toContain('%')
    for (const cell of table.querySelectorAll('td.sr-tg-k-live, td.sr-tg-last, td.sr-tg-distc')) {
      expect(cell.textContent).not.toContain('%')
    }
  })

  it('with no file, the probability column reads "No file for Alameda, CA" and the add prompt names the county', async () => {
    seedPool()
    await ready()
    expect((await screen.findAllByText('No file for Alameda, CA')).length).toBeGreaterThan(0)
    expect(screen.getByText("Add Alameda, CA's eBird bar-chart file to sort by eBird frequency")).toBeTruthy()
  })

  it('a rejected manifest read says so with a retry, never the add prompt (QA-42)', async () => {
    seedPool()
    H.barchartsReject = true
    await ready()
    const title = await screen.findByText("Couldn't check for a bar-chart file", { selector: '.sr-tg-file-title' })
    // The file section offers the retry beside the sentence.
    expect(within(title.closest('.sr-tg-file-line') as HTMLElement).getByRole('button', { name: 'Retry' })).toBeTruthy()
    // Every row's probability cell says the same thing, never "No file".
    const table = screen.getByRole('table')
    const bodyRows = within(table).getAllByRole('row').length - 2
    expect(bodyRows).toBeGreaterThan(0)
    expect(within(table).getAllByText("Couldn't check for a bar-chart file")).toHaveLength(bodyRows)
    expect(within(table).queryByText('No file for Alameda, CA')).toBeNull()
    expect(screen.queryByText("Add Alameda, CA's eBird bar-chart file to sort by eBird frequency")).toBeNull()
  })

  it('the bar-chart page opens through the external-open seam, never window.open (QA-40)', async () => {
    seedPool()
    const winOpen = vi.spyOn(window, 'open').mockImplementation(() => null)
    await ready()
    fireEvent.click(await screen.findByRole('button', { name: /Open Alameda, CA's bar chart on ebird.org/ }))
    expect(H.open).toHaveBeenCalledWith('https://ebird.org/barchart?r=US-CA-001')
    expect(winOpen).not.toHaveBeenCalled()
    winOpen.mockRestore()
  })
})

describe('rows (QA-58, QA-59, QA-60)', () => {
  it('a recorded species opens Species Detail on its backup name; a lifer is not a button', async () => {
    seedPool()
    openSpy.mockReset()
    await ready()
    await screen.findByRole('table')
    breedingOn()
    const table = screen.getByRole('table')
    fireEvent.click(within(table).getByRole('button', { name: 'Song Sparrow' }))
    expect(openSpy).toHaveBeenCalledWith('Song Sparrow')
    expect(within(table).queryByRole('button', { name: HOSTILE_SPECIES })).toBeNull()
    expect(within(table).getByText(HOSTILE_SPECIES)).toBeTruthy()
  })

  it('no cell is ever blank', async () => {
    seedPool()
    await ready()
    const table = await screen.findByRole('table')
    for (const td of table.querySelectorAll('td')) expect((td.textContent ?? '').trim().length).toBeGreaterThan(0)
  })

  it('no id or IDREF carries a species or county name (hostile names rendered)', async () => {
    seedPool()
    await ready()
    await screen.findByRole('table')
    fireEvent.focus(screen.getByRole('combobox', { name: 'County' }))
    await screen.findByRole('listbox')
    const idrefAttrs = ['id', 'aria-activedescendant', 'aria-controls', 'aria-labelledby', 'aria-describedby', 'for', 'htmlFor']
    for (const el of document.querySelectorAll('*')) {
      for (const a of idrefAttrs) {
        const v = el.getAttribute(a)
        if (!v) continue
        for (const needle of ['Evil', 'bird', 'Alameda', 'Sparrow', 'Robin', '"', '<']) {
          expect(v.includes(needle), `${a}="${v}"`).toBe(false)
        }
      }
    }
    // Non-vacuity: the hostile names really are on screen.
    expect(screen.getAllByText(HOSTILE_SPECIES).length).toBeGreaterThan(0)
    expect(screen.getByText('Evil "x" <y> z, CA')).toBeTruthy()
  })

  it('choosing a county remembers it through the storage seam (FR-08)', async () => {
    seedPool()
    await ready()
    fireEvent.focus(screen.getByRole('combobox', { name: 'County' }))
    const list = await screen.findByRole('listbox')
    fireEvent.mouseDown(within(list).getByText('Evil "x" <y> z, CA'))
    await waitFor(() => expect(H.settings.get('targetsCounty')).toBe('US-CA-013'))
  })
})

describe('color is tokens only (QA-68)', () => {
  it('no hex or rgb literal in any Targets component', () => {
    // process.cwd() (frontend/), never import.meta.url: in jsdom that is an
    // http: URL (the CommandPalette.test.tsx house shape).
    const dir = resolve(process.cwd(), 'src/components/targets')
    expect(existsSync(dir)).toBe(true)
    const files = readdirSync(dir).filter(f => f.endsWith('.tsx') && !f.endsWith('.test.tsx'))
    expect(files.length).toBeGreaterThanOrEqual(5)
    for (const f of files) {
      const src = readFileSync(resolve(dir, f), 'utf8')
      expect(src, f).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
      expect(src, f).not.toMatch(/\brgba?\(\s*[0-9]/)
    }
  })
})

// ── Where distances are measured from (FR-51a, QA-53a; design-spec 2a) ────────

// Today's answer names three places, one per recorded species; every other day
// is empty. Coordinates are real Alameda points, so the distances are real.
const PLACES = {
  'Lake Merritt': { lat: 37.8024, lng: -122.2566, code: 'sonspa' },
  'Arrowhead Marsh': { lat: 37.7466, lng: -122.2014, code: 'linspa' },
  'Coyote Hills': { lat: 37.5563, lng: -122.0936, code: 'amerob' },
} as const
const OAKLAND = { lat: 37.8044, lng: -122.2712, dist: 10 }
let today: string | null = null

function liveTransport(search: (q: string) => Promise<unknown> = async () => []) {
  today = null
  H.tGet.mockImplementation(async (path: string, params: Record<string, string>) => {
    if (path === '/map/county-day-obs') {
      // The sweep asks newest first, so the first date asked is today.
      today ??= params.date
      const species = params.date === today
        ? Object.entries(PLACES).map(([name, p]) => ({ speciesCode: p.code, obsDt: `${params.date} 08:00`, locId: 'L1', locName: name, lat: p.lat, lng: p.lng }))
        : []
      return { regionCode: params.regionCode, date: params.date, species }
    }
    if (path === '/nominatim/search') return search(params.q)
    throw new Error(`unexpected ${path}`)
  })
}
const nominatimCalls = () => H.tGet.mock.calls.filter(c => c[0] === '/nominatim/search')

async function liveReady() {
  H.key = 'test-key'
  seedPool()
  await ready()
  await screen.findByRole('table')
  await waitFor(() => expect(document.querySelector('.sr-tg-sweep [role="status"]')!.textContent).toMatch(/^Checked today at/), { timeout: 5000 })
}
const trigger = (name: RegExp) => screen.getByRole('button', { name })
const statusLine = () => document.querySelector('.sr-tg-anchor > .sr-tg-status')!.textContent
const slider = () => screen.getByRole('slider')
/** The dialog holds two always-mounted alert regions (a failed locate, a failed search). */
const alerts = () => within(screen.getByRole('dialog')).getAllByRole('alert').map(a => a.textContent).join('')
function distanceCell(species: string): string {
  const row = within(screen.getByRole('table')).getAllByRole('row').find(r => r.textContent!.startsWith(species))!
  // The figure, not the cell: the cell also carries its sr-only column label.
  return row.querySelector('.sr-tg-distc .sr-tg-dist, .sr-tg-distc .sr-tg-na')!.textContent!
}

describe('the measuring-point chooser (FR-51a, QA-53a)', () => {
  it('the anchor name in the status line opens the chooser with all four options, focus on the first', async () => {
    H.settings.set('map-defaults', OAKLAND)
    liveTransport()
    await liveReady()
    const t = trigger(/^Distances are measured from your Default Location\. Change$/)
    expect(statusLine()).toBe('Distances from your Default Location.')
    expect(t.getAttribute('aria-haspopup')).toBe('dialog')
    expect(t.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(t)
    const dialog = screen.getByRole('dialog', { name: 'Measure distances from' })
    expect(t.getAttribute('aria-expanded')).toBe('true')
    expect(t.getAttribute('aria-controls')).toBe(dialog.id)
    // Element identity, never text: <body>'s text contains every word on the page.
    await waitFor(() => expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: /^My location/ })))
    const d = within(dialog)
    expect(d.getByRole('button', { name: /^My location/ })).toBeTruthy()
    const def = d.getByRole('button', { name: /^Default Location/ })
    expect(def.textContent).toContain('Set in Settings')
    expect(def.getAttribute('aria-current')).toBe('true')
    expect(d.getByRole('textbox', { name: 'Search by place name' })).toBeTruthy()
    expect(d.getByText('A town, park or address, looked up on OpenStreetMap when you press Search.')).toBeTruthy()
    // Places in this list: alphabetical, each with its distance from Oakland.
    const list = d.getByRole('group', { name: 'Places in this list' })
    const items = within(list).getAllByRole('button').map(b => b.textContent)
    expect(items.map(x => x!.replace(/[0-9.]+ mi$/, ''))).toEqual(['Arrowhead Marsh', 'Coyote Hills', 'Lake Merritt'])
    for (const x of items) expect(x).toMatch(/[0-9]+\.[0-9] mi$/)
    // No request was made to build it.
    expect(nominatimCalls()).toHaveLength(0)
  })

  it('picking a place in this list re-measures every distance, the sort and the slider, and names it', async () => {
    H.settings.set('map-defaults', OAKLAND)
    liveTransport()
    await liveReady()
    breedingOn()
    // Coyote Hills is the robin's place: the robin is not a target even with
    // Breeding on (it has a breeding code), so the section is built from the
    // whole county's live data, not only the rows on screen.
    expect(within(screen.getByRole('table')).queryByText('American Robin')).toBeNull()
    const sparrowBefore = distanceCell('Song Sparrow')
    fireEvent.click(trigger(/Default Location\. Change$/))
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: /^Coyote Hills/ })).toBeTruthy()
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^Arrowhead Marsh/ }))
    expect(screen.queryByRole('dialog')).toBeNull()
    await waitFor(() => expect(statusLine()).toBe('Distances from Arrowhead Marsh, a place in this list.'))
    const t = trigger(/^Distances are measured from Arrowhead Marsh\. Change$/)
    await waitFor(() => expect(document.activeElement).toBe(t))
    // Lincoln's Sparrow was last reported AT Arrowhead Marsh; the Song Sparrow's
    // distance moved with the anchor.
    expect(distanceCell("Lincoln's Sparrow")).toBe('0.0 mi')
    expect(distanceCell('Song Sparrow')).not.toBe(sparrowBefore)
    expect(slider().getAttribute('aria-label')).toBe('Distance from Arrowhead Marsh to the last report')
    // The slider's description is the plain sentence, never the line's subtree,
    // which would splice the trigger's accessible name ("... Change") into it.
    const describedBy = (slider().getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean)
    expect(describedBy.map(id => document.getElementById(id)?.textContent).join(' ')).toBe('Distances from Arrowhead Marsh, a place in this list.')
    for (const id of describedBy) expect(document.getElementById(id)!.querySelector('button')).toBeNull()
    // The distance sort orders from the new point: Lincoln's Sparrow first.
    fireEvent.change(screen.getByRole('combobox', { name: 'Sort targets' }), { target: { value: 'distance' } })
    await waitFor(() => expect(within(screen.getByRole('table')).getAllByRole('row')[2].textContent).toMatch(/^Lincoln's Sparrow/))
    // The chosen place carries aria-current next time.
    fireEvent.click(t)
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: /^Arrowhead Marsh/ }).getAttribute('aria-current')).toBe('true')
  })

  it('Escape closes it and returns focus to the trigger', async () => {
    H.settings.set('map-defaults', OAKLAND)
    liveTransport()
    await liveReady()
    const t = trigger(/Default Location\. Change$/)
    fireEvent.click(t)
    const mine = within(screen.getByRole('dialog')).getByRole('button', { name: /^My location/ })
    await waitFor(() => expect(document.activeElement).toBe(mine))
    fireEvent.keyDown(mine, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(t))
    expect(t.getAttribute('aria-expanded')).toBe('false')
  })

  it('a click outside closes it, and a click on nothing leaves focus on the trigger', async () => {
    H.settings.set('map-defaults', OAKLAND)
    liveTransport()
    await liveReady()
    const t = trigger(/Default Location\. Change$/)
    fireEvent.click(t)
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('dialog')).toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(t))
  })

  it('with no Default Location the item is disabled, and the line offers the chooser', async () => {
    liveTransport()
    await liveReady()
    // Its accessible name is its visible text (WCAG 2.5.3 Label in Name).
    const t = trigger(/^Choose where to measure from$/)
    expect(statusLine()).toBe('No location set. Choose where to measure from (a place, your location, or a Default Location set in Settings).')
    expect(slider().getAttribute('aria-label')).toBe('Distance from the measuring point to the last report')
    const sort = screen.getByRole('combobox', { name: 'Sort targets' }) as HTMLSelectElement
    expect([...sort.options].find(o => o.value === 'distance')!.textContent).toBe('Distance to last report, choose where to measure from')
    fireEvent.click(t)
    const def = within(screen.getByRole('dialog')).getByRole('button', { name: /^Default Location/ }) as HTMLButtonElement
    expect(def.disabled).toBe(true)
    expect(def.textContent).toContain('Not set in Settings')
    // Places in this list carry no distance while nothing is set.
    const list = within(screen.getByRole('dialog')).getByRole('group', { name: 'Places in this list' })
    for (const b of within(list).getAllByRole('button')) expect(b.textContent).not.toMatch(/ mi$/)
  })

  it('a searched place is one request per press and none while typing; a miss keeps the anchor', async () => {
    H.settings.set('map-defaults', OAKLAND)
    let answer: unknown = []
    liveTransport(async () => answer)
    await liveReady()
    fireEvent.click(trigger(/Default Location\. Change$/))
    const field = within(screen.getByRole('dialog')).getByRole('textbox', { name: 'Search by place name' })
    for (const partial of ['L', 'Li', 'Liv', 'Livermor', 'Livermore']) fireEvent.change(field, { target: { value: partial } })
    expect(nominatimCalls()).toHaveLength(0)
    fireEvent.keyDown(field, { key: 'Enter' })
    await waitFor(() => expect(alerts()).toBe('No location found. Try a different search term.'))
    expect(nominatimCalls()).toHaveLength(1)
    expect(nominatimCalls()[0][1]).toEqual({ q: 'Livermore' })
    // The hint gave way to the miss, the dialog stayed open with focus in the
    // field, and the anchor is unchanged.
    expect(screen.queryByText('A town, park or address, looked up on OpenStreetMap when you press Search.')).toBeNull()
    expect(document.activeElement).toBe(field)
    expect(statusLine()).toBe('Distances from your Default Location.')
    // A hit on the next press: one more request, the anchor named as typed (trimmed).
    answer = [{ lat: '37.6819', lon: '-121.7681' }]
    fireEvent.change(field, { target: { value: '  Livermore ' } })
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Search' }))
    await waitFor(() => expect(statusLine()).toBe('Distances from Livermore, a place you searched.'))
    expect(nominatimCalls()).toHaveLength(2)
    expect(screen.queryByRole('dialog')).toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(trigger(/^Distances are measured from Livermore\. Change$/)))
  })

  it('My location: a failure keeps the previous anchor and says why; a success measures from the device', async () => {
    H.settings.set('map-defaults', OAKLAND)
    liveTransport()
    await liveReady()
    breedingOn()
    fireEvent.click(trigger(/Default Location\. Change$/))
    const mine = within(screen.getByRole('dialog')).getByRole('button', { name: /^My location/ })
    fireEvent.click(mine)
    await waitFor(() => expect(alerts().length).toBeGreaterThan(0))
    expect(statusLine()).toBe('Distances from your Default Location.')
    H.locate.mockImplementation(async () => ({ lat: 37.7466, lng: -122.2014 }))
    fireEvent.click(mine)
    await waitFor(() => expect(statusLine()).toBe('Distances from your location, found just now.'))
    expect(distanceCell("Lincoln's Sparrow")).toBe('0.0 mi')
    await waitFor(() => expect(document.activeElement).toBe(trigger(/^Distances are measured from your location\. Change$/)))
  })

  it('the choice survives a county change, is never written to storage, and a reload measures from the Default Location', async () => {
    H.settings.set('map-defaults', OAKLAND)
    // A device position no other value in this test can contain.
    H.locate.mockImplementation(async () => ({ lat: 37.123456, lng: -122.654321 }))
    liveTransport()
    await liveReady()
    fireEvent.click(trigger(/Default Location\. Change$/))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^My location/ }))
    await waitFor(() => expect(statusLine()).toBe('Distances from your location, found just now.'))
    // Switch county and back.
    fireEvent.focus(screen.getByRole('combobox', { name: 'County' }))
    fireEvent.mouseDown(within(await screen.findByRole('listbox')).getByText('Evil "x" <y> z, CA'))
    await waitFor(() => expect(H.settings.get('targetsCounty')).toBe('US-CA-013'))
    fireEvent.focus(screen.getByRole('combobox', { name: 'County' }))
    fireEvent.mouseDown(within(await screen.findByRole('listbox')).getByText('Alameda, CA'))
    await waitFor(() => expect(H.settings.get('targetsCounty')).toBe('US-CA-001'))
    await waitFor(() => expect(statusLine()).toBe('Distances from your location, found just now.'))
    // Let every debounced store write land, then look at everything written.
    await new Promise(r => setTimeout(r, 1_200))
    expect(H.writes.length).toBeGreaterThan(0)
    for (const w of H.writes) {
      expect(w.json, `${w.method} ${w.key}`).not.toContain('37.123456')
      expect(w.json, `${w.method} ${w.key}`).not.toContain('122.654321')
    }
    expect(new Set(H.writes.filter(w => w.method === 'setSetting').map(w => w.key))).toEqual(new Set(['targetsCounty']))
    // A relaunch (a fresh mount of the tab) measures from the Default Location.
    cleanup()
    _resetCountyDayObsCacheForTests()
    await liveReady()
    expect(statusLine()).toBe('Distances from your Default Location.')
  }, 15_000)
})

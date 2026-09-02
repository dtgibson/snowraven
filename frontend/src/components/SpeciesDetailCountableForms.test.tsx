// @vitest-environment jsdom
//
// THE WIRING GUARD FOR SPECIES DETAIL (report-as-countability). Sibling of
// `LifeListCountableForms.test.tsx`; the same defect, the same discriminating
// name, a different surface.
//
// Reverting `SpeciesDetail.tsx`'s filter to the pre-build narrow spuh/slash rule
// left ALL 2,538 tests green. This component had no test file at all, so its
// half of the widened toggle was shipped unguarded.
//
// Asserted together, because either alone certifies a half-fix: the options in
// the species selector, and the "{n} species" counter beside the toggle.
//
// `Brewster's Warbler (hybrid)` is the discriminating name: eBird publishes it
// and does not count it, and it carries no " sp.", no "/" and no " x ", so no
// rule reading the name can reject it. With "Show subspecies" OFF (the default)
// the selector key is the normalized base "Brewster's Warbler", which reads
// exactly like a species. That is why `countableKeys` is accumulated from the RAW
// observation names as a monotone OR rather than recomputed from the key.

import { describe, it, expect, vi, afterEach, afterAll } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'

// The maps are statically imported by SpeciesDetail and are heavy (maplibre);
// stub them. None of the assertions below involve a map.
vi.mock('./SnowMap', () => ({
  SnowMap: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}))
vi.mock('./SightingsMap', () => ({
  SightingsMap: () => <div data-testid="sightings-map-stub" />,
}))
vi.mock('react-map-gl/maplibre', () => ({
  Marker: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Popup: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  useMap: () => ({ current: undefined }),
}))

const OBSERVATIONS = [
  {
    submissionId: 'S1', commonName: 'American Robin', scientificName: 'Turdus migratorius',
    date: '2023-01-10', location: 'Park', locationId: 'L1', latitude: null, longitude: null,
    county: 'Hennepin', count: 1, breedingCode: null, speciesComments: '', catalogIds: [],
    stateProvince: 'US-MN', duration: 30, distance: 1, protocol: 'Traveling', numObservers: 1,
  },
  {
    submissionId: 'S2', commonName: 'Canada Goose (moffitti/maxima)', scientificName: 'Branta canadensis',
    date: '2023-02-15', location: 'Woods', locationId: 'L2', latitude: null, longitude: null,
    county: 'Ramsey', count: 1, breedingCode: null, speciesComments: '', catalogIds: [],
    stateProvince: 'US-MN', duration: 45, distance: 2, protocol: 'Traveling', numObservers: 1,
  },
  {
    submissionId: 'S3', commonName: "Brewster's Warbler (hybrid)", scientificName: 'Vermivora cyanoptera x chrysoptera',
    date: '2023-03-20', location: 'Yard', locationId: 'L3', latitude: null, longitude: null,
    county: 'Hennepin', count: 1, breedingCode: null, speciesComments: '', catalogIds: [],
    stateProvince: 'US-MN', duration: 15, distance: 0.5, protocol: 'Stationary', numObservers: 1,
  },
]

vi.mock('../lib/storage', () => ({
  storage: {
    getFilesStatus: vi.fn(async () => ({
      ebird: { filename: 'ebird.csv', uploadedAt: '2023-04-01' },
      ml: null,
    })),
    readFile: vi.fn(async () => null),
    getSetting: vi.fn(async () => null),
    setSetting: vi.fn(async () => {}),
    getApiKey: vi.fn(async () => null),
  },
}))
vi.mock('../lib/observationsCache', () => ({
  loadEbirdObservations: vi.fn(async () => ({ headerLine: '', observations: OBSERVATIONS })),
}))
vi.mock('../lib/mlExportCache', () => ({ loadMLExport: vi.fn(async () => null) }))
vi.mock('../lib/transport', () => ({
  transport: {
    get: vi.fn(async () => ({})),
    post: vi.fn(async (path: string) =>
      path === '/taxonomy/codes' ? { codes: {}, orders: {}, formCodes: {} } : {}),
  },
  TransportError: class extends Error {},
}))

import { SpeciesDetail } from './SpeciesDetail'

afterEach(cleanup)

// SpeciesDetail's sightings graph is recharts-backed. It only mounts once a
// species is selected, which these tests do not do, but the drain is kept per the
// standing rule: a toolkit autoBatch fallback timer that outlives this file's
// jsdom environment fails a LATER file with every test here green.
afterAll(() => new Promise((r) => setTimeout(r, 120)))

const props = { onGoToSettings: () => {}, filesVersion: 0, embedAllowed: false }

/** The "{n} species" counter beside the toggles, read off the DOM. */
function speciesFigure(): string {
  const el = [...document.querySelectorAll('*')]
    .filter(n => /^\d+ species$/.test((n.textContent ?? '').trim()))
    .sort((a, b) => (a.textContent ?? '').length - (b.textContent ?? '').length)[0]
  return (el?.textContent ?? '').trim()
}

/** The species selector's option names.
 *
 *  `SpeciesCombobox` is a custom combobox, not a native `<select>`: it renders
 *  `role="option"` divs and only while OPEN, so the listbox has to be opened
 *  first. Reading `document.querySelectorAll('option')` finds nothing here and
 *  would have made every assertion below vacuous. */
function selectorOptions(): string[] {
  const toggle = screen.getByRole('button', { name: 'Toggle species list' })
  fireEvent.click(toggle)
  // Scope to the combobox's own listbox. A bare `getAllByRole('option')` also
  // collects the County `<select>`'s native options ("All Counties", "Hennepin",
  // "Ramsey"), which would have made a `some(/Brewster/)` absence check pass for
  // the wrong reason.
  const listbox = screen.getByRole('listbox')
  const names = [...listbox.querySelectorAll('[role="option"]')]
    .map(o => (o.textContent ?? '').trim())
    .filter(t => t.length > 0)
  fireEvent.click(toggle)   // leave it closed, so a second call re-opens cleanly
  return names
}

/** Each option renders the common name and the scientific name in adjacent spans,
 *  so its textContent is "American RobinTurdus migratorius". Match the leading
 *  common name rather than the concatenation. */
function hasOption(options: string[], commonName: string): boolean {
  return options.some(o => o.startsWith(commonName))
}

async function renderReady() {
  render(<SpeciesDetail {...props} />)
  await waitFor(() => expect(screen.getByRole('switch', { name: /Show all forms/ })).toBeTruthy())
  await waitFor(() => expect(speciesFigure()).not.toBe(''))
}

describe('Species Detail: Show all forms governs the selector AND the counter', () => {
  it('with the toggle OFF, omits a form eBird does not count from both', async () => {
    await renderReady()

    expect(speciesFigure()).toBe('2 species')
    const options = selectorOptions()
    // Absent under its MERGED display name, which is the name a rule reading the
    // selector key would have to accept.
    expect(options.some(o => /Brewster/.test(o))).toBe(false)
    // Non-vacuity: the two eBird counts really are there.
    expect(hasOption(options, 'American Robin')).toBe(true)
    expect(hasOption(options, 'Canada Goose')).toBe(true)
  })

  it('with the toggle ON, includes it in both', async () => {
    await renderReady()
    fireEvent.click(screen.getByRole('switch', { name: /Show all forms/ }))

    await waitFor(() => expect(speciesFigure()).toBe('3 species'))
    expect(selectorOptions().some(o => /Brewster/.test(o))).toBe(true)
  })

  it('a subspecies-group slash counts as its parent either way (direction A)', async () => {
    // eBird counts "Canada Goose (moffitti/maxima)" as Canada Goose. The rule this
    // replaced saw the "/" and dropped it from the selector with the toggle off.
    await renderReady()
    expect(hasOption(selectorOptions(), 'Canada Goose')).toBe(true)

    fireEvent.click(screen.getByRole('switch', { name: /Show all forms/ }))
    await waitFor(() => expect(speciesFigure()).toBe('3 species'))
    expect(hasOption(selectorOptions(), 'Canada Goose')).toBe(true)
  })

  it('the toggle sits after Show subspecies, which governs a different axis', async () => {
    await renderReady()
    const switches = screen.getAllByRole('switch').map(s => s.textContent ?? '')
    const subspecies = switches.findIndex(t => /Show subspecies/.test(t))
    const forms = switches.findIndex(t => /Show all forms/.test(t))
    expect(subspecies).toBeGreaterThanOrEqual(0)
    expect(forms).toBeGreaterThan(subspecies)
  })
})

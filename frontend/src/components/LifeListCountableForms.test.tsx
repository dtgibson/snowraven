// @vitest-environment jsdom
//
// THE WIRING GUARD FOR MULTIMEDIA (report-as-countability).
//
// The predicate is guarded to death in `countableForms.test.ts`; the WIRING was
// not guarded at all. Reverting `LifeList.tsx`'s two filters to the pre-build
// narrow spuh/slash rule left every countability test green, and the only failure
// anywhere in the suite was an unrelated `WeatherBacklog` pagination test that
// happened to cross a 100-row page boundary. Re-fixturing that test would have
// silently removed this build's only tripwire on its most user-visible change.
//
// Two things are asserted together, because either alone certifies a half-fix:
// the ROWS the toggle governs, and the "X of N species" figure above them. The
// whole point of widening the toggle was that those two agree by construction.
//
// The discriminating name is `Brewster's Warbler (hybrid)`: eBird publishes it and
// does not count it, and it carries no " sp.", no "/" and no " x ", so the narrow
// rule this replaced cannot see it at all.
//
// It is ALSO the case that separates a display name from a raw one. "Show
// subspecies" defaults to OFF, so the row key is the NORMALIZED base
// "Brewster's Warbler", which reads exactly like a species. Judging the key would
// leave the row visible and counted; judging the raw names behind it does not.
// That is why `buildComprehensiveEntries` carries `nonCountable` on the entry
// rather than recomputing it from `commonName` at filter time.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'

const ML_CSV = [
  'Catalog Number,Common Name,Scientific Name,Format',
  '1,American Robin,Turdus migratorius,Photo',
].join('\n')

// Three recorded species. One eBird counts as its parent (direction A), one eBird
// does not count at all (direction B), one ordinary control.
const OBSERVATIONS = [
  {
    submissionId: 'S1', commonName: 'American Robin', scientificName: 'Turdus migratorius',
    date: '2023-01-10', location: 'Park', locationId: 'L1', latitude: null, longitude: null,
    county: 'Hennepin', count: 1, breedingCode: null, speciesComments: '', catalogIds: ['1'],
    stateProvince: 'US-MN', duration: 30, distance: 1, protocol: 'Traveling', numObservers: 1,
  },
  {
    submissionId: 'S2', commonName: 'Canada Goose (moffitti/maxima)', scientificName: 'Branta canadensis',
    date: '2023-02-15', location: 'Woods', locationId: 'L2', latitude: null, longitude: null,
    county: 'Ramsey', count: 1, breedingCode: null, speciesComments: '', catalogIds: [],
    stateProvince: 'US-MN', duration: 45, distance: 2, protocol: 'Traveling', numObservers: 1,
  },
  // A merged pair that MIXES countability under one display key, to pin the
  // monotone OR. Both normalize to "Fakebird"; the slash form is not a name eBird
  // publishes, so it falls to the naming convention and is not countable, while
  // the plain name is.
  //
  // Deliberately synthetic, and that is stated rather than hidden: measured over
  // the snapshot, NONE of the 13,758 merged groups mixes a countable and a
  // non-countable raw name, so no real eBird name can discriminate this. The
  // property is still worth pinning, because a user's CSV is uncapped and can
  // carry a name from a retired revision, and because a future Clements revision
  // could introduce a mixed group with nothing failing.
  {
    submissionId: 'S4', commonName: 'Fakebird', scientificName: 'Fakus birdus',
    date: '2023-04-01', location: 'Field', locationId: 'L4', latitude: null, longitude: null,
    county: 'Hennepin', count: 1, breedingCode: null, speciesComments: '', catalogIds: [],
    stateProvince: 'US-MN', duration: 10, distance: 0, protocol: 'Stationary', numObservers: 1,
  },
  {
    submissionId: 'S5', commonName: 'Fakebird (alpha/beta)', scientificName: 'Fakus birdus',
    date: '2023-04-02', location: 'Field', locationId: 'L4', latitude: null, longitude: null,
    county: 'Hennepin', count: 1, breedingCode: null, speciesComments: '', catalogIds: [],
    stateProvince: 'US-MN', duration: 10, distance: 0, protocol: 'Stationary', numObservers: 1,
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
      ml: { filename: 'ML__x_123.csv', uploadedAt: '2023-04-01' },
    })),
    readFile: vi.fn(async () => ML_CSV),
    getSetting: vi.fn(async () => null),
    setSetting: vi.fn(async () => {}),
  },
}))
vi.mock('../lib/observationsCache', () => ({
  loadEbirdObservations: vi.fn(async () => ({ text: '', observations: OBSERVATIONS })),
}))
vi.mock('../lib/transport', () => ({
  transport: {
    get: vi.fn(async () => ({})),
    post: vi.fn(async (path: string) =>
      path === '/taxonomy/codes' ? { codes: {}, orders: {}, formCodes: {} } : { results: [] }),
  },
  TransportError: class extends Error {},
}))

import { LifeList } from './LifeList'

afterEach(cleanup)

const props = { onGoToSettings: () => {}, filesVersion: 0 }

/** The tab's own "N species" figure, read off the DOM rather than recomputed. */
function speciesFigure(): string {
  const el = [...document.querySelectorAll('*')]
    .filter(n => /^\d+ species$/.test((n.textContent ?? '').trim()))
    .sort((a, b) => (a.textContent ?? '').length - (b.textContent ?? '').length)[0]
  return (el?.textContent ?? '').trim()
}

async function renderReady() {
  render(<LifeList {...props} />)
  // Wait for the tab to reach its ready state before asserting anything, so an
  // absence can never pass merely because nothing had rendered yet.
  await waitFor(() => expect(screen.getByRole('switch', { name: /Show all forms/ })).toBeTruthy())
  await waitFor(() => expect(speciesFigure()).not.toBe(''))
}

describe('Multimedia: Show all forms governs the rows AND the count', () => {
  it('with the toggle OFF, hides a form eBird does not count and leaves it out of the figure', async () => {
    await renderReady()

    // The rows: Brewster's Warbler is gone, under its MERGED display name, which
    // is the name a narrow rule reading the row key would have to accept.
    expect(screen.queryByText(/Brewster/)).toBeNull()
    // The controls: the two birds eBird counts are both present, so the absence
    // above is about countability and not about the tab failing to render.
    expect(screen.getByText('American Robin')).toBeTruthy()
    expect(screen.getByText('Canada Goose')).toBeTruthy()

    // The figure agrees with the rows. This is the number that used to disagree.
    expect(speciesFigure()).toBe('3 species')
  })

  it('with the toggle ON, shows it and counts it', async () => {
    await renderReady()
    fireEvent.click(screen.getByRole('switch', { name: /Show all forms/ }))

    await waitFor(() => expect(speciesFigure()).toBe('4 species'))
    expect(screen.getByText(/Brewster/)).toBeTruthy()
  })

  it('a subspecies-group slash counts as its parent either way (direction A)', async () => {
    // The other direction, and the one most birders notice. eBird counts
    // "Canada Goose (moffitti/maxima)" as Canada Goose; the rule this replaced saw
    // the "/" and dropped the row entirely with the toggle off.
    await renderReady()
    expect(screen.getByText('Canada Goose')).toBeTruthy()

    fireEvent.click(screen.getByRole('switch', { name: /Show all forms/ }))
    await waitFor(() => expect(speciesFigure()).toBe('4 species'))
    expect(screen.getByText('Canada Goose')).toBeTruthy()
  })

  it('a merged entry counts when AT LEAST ONE of its raw names counts', async () => {
    // The monotone OR. "Fakebird" and "Fakebird (alpha/beta)" merge to one row
    // under "Show subspecies" off; the second is not countable on its own. The
    // entry must survive on the strength of the first, exactly as the escapee rule
    // keeps a species that has one counting observation.
    //
    // Reducing the OR to last-write-wins hides the row and drops the figure to 2.
    await renderReady()
    expect(screen.getByText('Fakebird')).toBeTruthy()
    expect(speciesFigure()).toBe('3 species')
  })

  it('the toggle sits after Show subspecies, which governs a different axis', async () => {
    // The design's watch item: the two are adjacent and independent, and the more
    // specific one is read first. Renaming one into the other's territory is the
    // failure this pins.
    await renderReady()
    const switches = screen.getAllByRole('switch').map(s => s.textContent ?? '')
    const subspecies = switches.findIndex(t => /Show subspecies/.test(t))
    const forms = switches.findIndex(t => /Show all forms/.test(t))
    expect(subspecies).toBeGreaterThanOrEqual(0)
    expect(forms).toBeGreaterThan(subspecies)
  })
})

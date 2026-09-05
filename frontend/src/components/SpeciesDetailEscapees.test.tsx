// @vitest-environment jsdom
//
// THE WIRING GUARD FOR SPECIES DETAIL (the escapee half of the countable rule).
// Sibling of `SpeciesDetailCountableForms.test.tsx`: the same surface, the same
// two assertions, the OTHER exclusion class (species-detail-escapee-toggle).
//
// Asserted together, because either alone certifies a half-fix: the options in
// the species selector, and the "{n} species" counter beside the toggles. The
// idea this build ships is that the counter reads the same as the Statistics
// headline at both tabs' defaults, and the headline is `countableLifeList`
// over the confirmed escapee set; the selector is what the user sees.
//
// The provenance store is MOCKED at the seam the passive hook reads
// (`getSnapshot` / `loadSnapshot` / `subscribe`), publishing `excludedNames`
// with the carrying checklists present in the ledger. A name whose carrier is
// absent from the ledger must stay visible: that is the confirmation step
// (`confirmExcludedNames`), driven here through the real hook and the real
// model, not re-implemented.
//
// `Muscovy Duck (Domestic type)` is the discriminating raw name for the
// "Show subspecies" case: eBird counts a domestic type as its parent, so it is
// a countable form that hides only because its PARENT is an escapee, and only
// a layer keyed on the normalized name can hide it.

import { useState } from 'react'
import { describe, it, expect, vi, afterEach, afterAll, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import type { ProvenanceSnapshot } from '../lib/exoticProvenance'

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

function obs(submissionId: string, commonName: string, scientificName: string, date: string) {
  return {
    submissionId, commonName, scientificName,
    date, location: 'Park', locationId: 'L1', latitude: null, longitude: null,
    county: 'Hennepin', count: 1, breedingCode: null, speciesComments: '', catalogIds: [],
    stateProvince: 'US-MN', duration: 30, distance: 1, protocol: 'Traveling', numObservers: 1,
  }
}

// Four checklists. Muscovy Duck is carried by S1 (species level) AND S2 (as a
// domestic-type form); Graylag Goose by S3 alone. The hybrid on S4 is the
// "Show all forms" case, so the two layers can be shown to compose.
const OBSERVATIONS = [
  obs('S1', 'American Robin', 'Turdus migratorius', '2023-01-10'),
  obs('S1', 'Muscovy Duck', 'Cairina moschata', '2023-01-10'),
  obs('S2', 'Muscovy Duck (Domestic type)', 'Cairina moschata (Domestic type)', '2023-02-15'),
  obs('S3', 'Graylag Goose', 'Anser anser', '2023-03-20'),
  obs('S4', 'Canada Goose', 'Branta canadensis', '2023-04-01'),
  obs('S4', 'Mallard x American Black Duck (hybrid)', 'Anas platyrhynchos x rubripes', '2023-04-01'),
]

function snapshot(checklists: string[], excludedNames: string[]): ProvenanceSnapshot {
  return { checklists: new Set(checklists), species: new Map(), excludedNames }
}

const EMPTY = snapshot([], [])
/** Every carrier in the ledger: both published names are confirmed. */
const ALL_CARRIERS = snapshot(['S1', 'S2', 'S3', 'S4'], ['Graylag Goose', 'Muscovy Duck'])
/** S3 absent: Graylag Goose's only carrier is unconsulted, so it stays visible. */
const GRAYLAG_OPEN = snapshot(['S1', 'S2', 'S4'], ['Graylag Goose', 'Muscovy Duck'])

// One holder the mock closes over. `getSnapshot` must return the SAME object
// until it changes (useSyncExternalStore re-renders on identity), which a
// per-call literal would break.
const published: { current: ProvenanceSnapshot } = { current: EMPTY }

vi.mock('../lib/exoticProvenanceCache', () => ({
  getSnapshot: () => published.current,
  loadSnapshot: async () => published.current,
  subscribe: () => () => {},
}))

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
import { SHOW_ESCAPEES_TOGGLE_LABEL } from '../lib/exoticCopy'

// jsdom has no scrollIntoView; selecting a species scrolls the detail to the
// top through `smoothScrollIntoView`, inside a requestAnimationFrame callback.
Element.prototype.scrollIntoView = vi.fn()

beforeEach(() => { published.current = ALL_CARRIERS })
afterEach(cleanup)

// The sightings graph is recharts-backed and mounts once a species is selected,
// which several tests here do: drain toolkit's 100 ms autoBatch fallback timer
// before this file's jsdom environment is torn down (the standing rule).
afterAll(() => new Promise((r) => setTimeout(r, 120)))

const props = { onGoToSettings: () => {}, filesVersion: 0, embedAllowed: false }

/** The "{n} species" counter beside the toggles, read off the DOM. */
function speciesFigure(): string {
  const el = [...document.querySelectorAll('*')]
    .filter(n => /^\d+ species$/.test((n.textContent ?? '').trim()))
    .sort((a, b) => (a.textContent ?? '').length - (b.textContent ?? '').length)[0]
  return (el?.textContent ?? '').trim()
}

/** The species selector's option names, read by opening the custom combobox's
 *  listbox (it renders `role="option"` rows only while open) and scoped to it,
 *  so the County `<select>`'s native options never satisfy an absence check. */
function selectorOptions(): string[] {
  const toggle = screen.getByRole('button', { name: 'Toggle species list' })
  fireEvent.click(toggle)
  const listbox = screen.getByRole('listbox')
  const names = [...listbox.querySelectorAll('[role="option"]')]
    .map(o => (o.textContent ?? '').trim())
    .filter(t => t.length > 0)
  fireEvent.click(toggle)
  return names
}

/** Each option's textContent is the common name followed by the scientific name
 *  in adjacent spans ("American RobinTurdus migratorius"), so match the leading
 *  common name exactly up to the scientific name that follows it. */
function hasOption(options: string[], commonName: string, sciName: string): boolean {
  return options.some(o => o === `${commonName}${sciName}`)
}

/** Pick an option through the real listbox, as a user would. */
function chooseOption(commonName: string, sciName: string) {
  fireEvent.click(screen.getByRole('button', { name: 'Toggle species list' }))
  const listbox = screen.getByRole('listbox')
  const option = [...listbox.querySelectorAll('[role="option"]')]
    .find(o => (o.textContent ?? '').trim() === `${commonName}${sciName}`)
  expect(option, `option ${commonName}`).toBeTruthy()
  fireEvent.click(option!)
}

function selectorValue(): string {
  return (screen.getByRole('combobox', { name: 'Select species' }) as HTMLInputElement).value
}

function escapeesSwitch(): HTMLElement {
  return screen.getByRole('switch', { name: SHOW_ESCAPEES_TOGGLE_LABEL })
}

async function renderReady() {
  render(<SpeciesDetail {...props} />)
  await waitFor(() => expect(escapeesSwitch()).toBeTruthy())
  await waitFor(() => expect(speciesFigure()).not.toBe(''))
}

/** App's contract for an external "open this species" request, mirrored: the
 *  request is SINGLE-USE and App clears it in `onRequestedSpeciesConsumed`. The
 *  consume effect re-runs whenever `openSpeciesInTab` changes identity (a
 *  reveal changes the display list, so it does), and it is the cleared prop,
 *  not the effect, that makes the request fire once. */
function Host({ requested, onConsumed }: { requested: string; onConsumed: () => void }) {
  const [requestedSpecies, setRequestedSpecies] = useState<string | undefined>(requested)
  return (
    <SpeciesDetail
      {...props}
      requestedSpecies={requestedSpecies}
      onRequestedSpeciesConsumed={() => { onConsumed(); setRequestedSpecies(undefined) }}
    />
  )
}

async function renderReadyRequesting(requested: string): Promise<ReturnType<typeof vi.fn>> {
  const consumed = vi.fn()
  render(<Host requested={requested} onConsumed={consumed} />)
  await waitFor(() => expect(escapeesSwitch()).toBeTruthy())
  await waitFor(() => expect(speciesFigure()).not.toBe(''))
  return consumed
}

describe('Species Detail: Show escapees governs the selector AND the counter', () => {
  it('with the switch OFF (the default), omits every confirmed escapee from both', async () => {
    await renderReady()

    expect(escapeesSwitch().getAttribute('aria-checked')).toBe('false')
    // American Robin and Canada Goose: the Statistics headline for this export.
    expect(speciesFigure()).toBe('2 species')
    const options = selectorOptions()
    expect(hasOption(options, 'Muscovy Duck', 'Cairina moschata')).toBe(false)
    expect(hasOption(options, 'Graylag Goose', 'Anser anser')).toBe(false)
    // Non-vacuity: the species that count really are there, and the hybrid is
    // still governed by its own switch, not by this one.
    expect(hasOption(options, 'American Robin', 'Turdus migratorius')).toBe(true)
    expect(hasOption(options, 'Canada Goose', 'Branta canadensis')).toBe(true)
    expect(options.some(o => /Mallard x/.test(o))).toBe(false)
  })

  it('with the switch ON, restores them in both', async () => {
    await renderReady()
    fireEvent.click(escapeesSwitch())

    expect(escapeesSwitch().getAttribute('aria-checked')).toBe('true')
    await waitFor(() => expect(speciesFigure()).toBe('4 species'))
    const options = selectorOptions()
    expect(hasOption(options, 'Muscovy Duck', 'Cairina moschata')).toBe(true)
    expect(hasOption(options, 'Graylag Goose', 'Anser anser')).toBe(true)
  })

  it('the two reveal switches compose: all forms AND escapees on shows every key', async () => {
    await renderReady()
    fireEvent.click(escapeesSwitch())
    fireEvent.click(screen.getByRole('switch', { name: /Show all forms/ }))

    await waitFor(() => expect(speciesFigure()).toBe('5 species'))
    expect(selectorOptions().some(o => /Mallard x/.test(o))).toBe(true)
  })

  it('a published name whose carrying checklist is NOT in the ledger stays visible', async () => {
    // The confirmation step, through the real hook and the real model. S3 is
    // Graylag Goose's only carrier and has not been consulted, so the published
    // verdict for it is not honoured; Muscovy Duck's carriers are all present.
    published.current = GRAYLAG_OPEN
    await renderReady()

    expect(speciesFigure()).toBe('3 species')
    const options = selectorOptions()
    expect(hasOption(options, 'Graylag Goose', 'Anser anser')).toBe(true)
    expect(hasOption(options, 'Muscovy Duck', 'Cairina moschata')).toBe(false)
  })

  it('with an empty cache, every number and option is what it was before the switch existed', async () => {
    published.current = EMPTY
    await renderReady()

    // The switch still renders, from first paint: never gated on the set's size.
    expect(escapeesSwitch().getAttribute('aria-checked')).toBe('false')
    expect(speciesFigure()).toBe('4 species')
    const before = selectorOptions()
    expect(hasOption(before, 'Muscovy Duck', 'Cairina moschata')).toBe(true)
    expect(hasOption(before, 'Graylag Goose', 'Anser anser')).toBe(true)

    // And pressing it is a no-op: same figure, same options.
    fireEvent.click(escapeesSwitch())
    expect(speciesFigure()).toBe('4 species')
    expect(selectorOptions()).toEqual(before)
  })

  it('under Show subspecies, a domestic-type form hides with its escapee parent', async () => {
    await renderReady()
    fireEvent.click(screen.getByRole('switch', { name: /Show subspecies/ }))

    // Raw keys now: the form is its own row, and it is a COUNTABLE form (eBird
    // counts a domestic type as its parent), so only the escapee layer can hide
    // it, and only by normalizing the key first.
    await waitFor(() => expect(speciesFigure()).toBe('2 species'))
    let options = selectorOptions()
    expect(options.some(o => /Muscovy Duck \(Domestic type\)/.test(o))).toBe(false)
    expect(hasOption(options, 'Muscovy Duck', 'Cairina moschata')).toBe(false)

    // On: the parent AND its form come back as separate raw keys (five keys,
    // with the hybrid still hidden by its own switch).
    fireEvent.click(escapeesSwitch())
    await waitFor(() => expect(speciesFigure()).toBe('5 species'))
    options = selectorOptions()
    expect(options.some(o => /Muscovy Duck \(Domestic type\)/.test(o))).toBe(true)
    expect(hasOption(options, 'Muscovy Duck', 'Cairina moschata')).toBe(true)
  })

  it('switching OFF while an escapee is selected deselects it; a non-escapee keeps its selection', async () => {
    await renderReady()
    fireEvent.click(escapeesSwitch())
    await waitFor(() => expect(speciesFigure()).toBe('4 species'))
    chooseOption('Muscovy Duck', 'Cairina moschata')
    await waitFor(() => expect(selectorValue()).toBe('Muscovy Duck'))

    fireEvent.click(escapeesSwitch())
    await waitFor(() => expect(selectorValue()).toBe(''))
    expect(speciesFigure()).toBe('2 species')

    // The mirror image (guard-the-guard for the deselect condition): a species
    // the switch does not govern survives the same press.
    fireEvent.click(escapeesSwitch())
    chooseOption('American Robin', 'Turdus migratorius')
    await waitFor(() => expect(selectorValue()).toBe('American Robin'))
    fireEvent.click(escapeesSwitch())
    await waitFor(() => expect(speciesFigure()).toBe('2 species'))
    expect(selectorValue()).toBe('American Robin')
  })

  it('the switch sits after Show all forms, and the counter is a polite live region', async () => {
    await renderReady()
    const switches = screen.getAllByRole('switch').map(s => s.textContent ?? '')
    const subspecies = switches.findIndex(t => /Show subspecies/.test(t))
    const forms = switches.findIndex(t => /Show all forms/.test(t))
    const escapees = switches.findIndex(t => t === SHOW_ESCAPEES_TOGGLE_LABEL)
    expect(subspecies).toBeGreaterThanOrEqual(0)
    expect(forms).toBeGreaterThan(subspecies)
    expect(escapees).toBeGreaterThan(forms)

    const counter = [...document.querySelectorAll('[aria-live="polite"]')]
      .find(n => /^\d+ species$/.test((n.textContent ?? '').trim()))
    expect(counter).toBeTruthy()
  })
})

describe('Species Detail: a request for a hidden species is revealed, never dropped', () => {
  it('an escapee requested from another tab turns Show escapees on and selects it', async () => {
    // The Statistics escapee list links each name here; before this build the
    // request returned silently and the tab opened with nothing selected.
    const consumed = await renderReadyRequesting('Muscovy Duck')

    await waitFor(() => expect(selectorValue()).toBe('Muscovy Duck'))
    expect(escapeesSwitch().getAttribute('aria-checked')).toBe('true')
    expect(speciesFigure()).toBe('4 species')
    expect(consumed).toHaveBeenCalledTimes(1)
    // The other switch was not touched: the reveal flips only what hides the target.
    expect(screen.getByRole('switch', { name: /Show all forms/ }).getAttribute('aria-checked')).toBe('false')
  })

  it('the same one condition reveals a name hidden by Show all forms', async () => {
    await renderReadyRequesting('Mallard x American Black Duck (hybrid)')

    // The selector key is the MERGED name (Show subspecies is off), so that is
    // what the request resolves to and what the field shows.
    await waitFor(() => expect(selectorValue()).toBe('Mallard x American Black Duck'))
    expect(screen.getByRole('switch', { name: /Show all forms/ }).getAttribute('aria-checked')).toBe('true')
    expect(escapeesSwitch().getAttribute('aria-checked')).toBe('false')
    expect(speciesFigure()).toBe('3 species')
  })

  it('a request for a VISIBLE species flips nothing', async () => {
    await renderReadyRequesting('Canada Goose')

    await waitFor(() => expect(selectorValue()).toBe('Canada Goose'))
    expect(escapeesSwitch().getAttribute('aria-checked')).toBe('false')
    expect(screen.getByRole('switch', { name: /Show all forms/ }).getAttribute('aria-checked')).toBe('false')
    expect(speciesFigure()).toBe('2 species')
  })

  it('a request for a name not in the export still does nothing', async () => {
    const consumed = await renderReadyRequesting('Ivory-billed Woodpecker')

    // The request is consumed (single-use, as App expects) and nothing moved.
    await waitFor(() => expect(consumed).toHaveBeenCalledTimes(1))
    expect(speciesFigure()).toBe('2 species')
    expect(selectorValue()).toBe('')
    expect(escapeesSwitch().getAttribute('aria-checked')).toBe('false')
  })

  it('picking an escapee in the Subspecies and forms control reveals it too', async () => {
    // Muscovy Duck carries a domestic-type form, so the explorer lists it even
    // while the selector hides it; the second in-tab route to a hidden name.
    await renderReady()
    fireEvent.click(screen.getByRole('button', { name: /Subspecies and forms/ }))
    const row = screen.getAllByRole('button').find(b => /^Muscovy Duck/.test((b.textContent ?? '').trim()))
    expect(row, 'explorer row for Muscovy Duck').toBeTruthy()
    fireEvent.click(row!)

    await waitFor(() => expect(selectorValue()).toBe('Muscovy Duck'))
    expect(escapeesSwitch().getAttribute('aria-checked')).toBe('true')
    expect(speciesFigure()).toBe('4 species')
  })
})

// @vitest-environment jsdom
/// <reference types="node" />
//
// FR-11 / QA-13: switching species must not reset the Pins/Heatmap mode.
//
// This shipped WRONG for the whole life of the tab and the comment beside it
// claimed the opposite: `selectSpecies` called `setMapMode('pins')` while the
// `countiesOn` comment three lines above said the mode was deliberately not
// reset. County shading rides on that mode, so a silent snap back to Pins now
// takes the user's heatmap and its shading with it, which is what turned a
// pre-existing quirk into something this build had to decide about.
//
// The mode toggle is a pair of `aria-pressed` buttons, so the assertion is made
// against the pressed state of the real control rather than against a state
// variable, and the branch it governs (`HeatmapLayer` vs `SightingsMap`) is
// asserted alongside it — either alone certifies a half-fix.

import { describe, it, expect, vi, afterEach, afterAll } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'

vi.mock('./SnowMap', () => ({
  SnowMap: ({ children }: { children?: React.ReactNode }) => <div data-testid="snowmap">{children}</div>,
}))
vi.mock('./SightingsMap', () => ({
  SightingsMap: () => <div data-testid="pins-map" />,
}))
vi.mock('./speciesDetail/HeatmapLayer', () => ({
  HeatmapLayer: () => <div data-testid="heat-layer" />,
}))
vi.mock('react-map-gl/maplibre', () => ({
  Marker: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Popup: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Source: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Layer: () => null,
  useMap: () => ({ current: undefined }),
}))

// Two species, both with coordinates, so the map mounts in either mode.
const OBSERVATIONS = [
  {
    submissionId: 'S1', commonName: 'American Robin', scientificName: 'Turdus migratorius',
    date: '2023-01-10', location: 'Park', locationId: 'L1', latitude: 37.8, longitude: -122.3,
    county: 'Alameda', count: 1, breedingCode: null, speciesComments: '', catalogIds: [],
    stateProvince: 'US-CA', duration: 30, distance: 1, protocol: 'Traveling', numObservers: 1,
  },
  {
    submissionId: 'S2', commonName: "Anna's Hummingbird", scientificName: 'Calypte anna',
    date: '2023-02-15', location: 'Yard', locationId: 'L2', latitude: 37.9, longitude: -122.2,
    county: 'Alameda', count: 2, breedingCode: null, speciesComments: '', catalogIds: [],
    stateProvince: 'US-CA', duration: 45, distance: 2, protocol: 'Traveling', numObservers: 1,
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
// Recharts mounts once a species is selected; drain toolkit's 100 ms autoBatch
// fallback timer so it cannot fire in a later file's torn-down environment.
afterAll(() => new Promise((r) => setTimeout(r, 120)))

const props = { onGoToSettings: () => {}, filesVersion: 0, embedAllowed: false }

/** Pick a species through the real combobox. */
async function pick(commonName: string) {
  const toggle = screen.getByRole('button', { name: 'Toggle species list' })
  fireEvent.click(toggle)
  const listbox = screen.getByRole('listbox')
  const option = [...listbox.querySelectorAll('[role="option"]')]
    .find(o => (o.textContent ?? '').startsWith(commonName))
  expect(option, commonName).toBeTruthy()
  fireEvent.click(option!)
  await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull())
}

const modeButton = (label: 'Pins' | 'Heatmap') => screen.getByRole('button', { name: label })

describe('a species switch keeps the map mode (FR-11, QA-13)', () => {
  it('stays on Heatmap when a different species is selected', async () => {
    render(<SpeciesDetail {...props} />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Toggle species list' })).toBeTruthy())

    await pick('American Robin')
    await waitFor(() => expect(modeButton('Heatmap')).toBeTruthy())

    // Non-vacuity: it really starts on Pins, and the toggle really moves.
    expect(modeButton('Pins').getAttribute('aria-pressed')).toBe('true')
    expect(screen.queryByTestId('pins-map')).toBeTruthy()

    fireEvent.click(modeButton('Heatmap'))
    await waitFor(() => expect(modeButton('Heatmap').getAttribute('aria-pressed')).toBe('true'))
    expect(screen.queryByTestId('heat-layer')).toBeTruthy()

    await pick("Anna's Hummingbird")

    // The criterion. Both halves: the control's pressed state AND the branch it
    // governs, because either on its own passes a half-fix.
    await waitFor(() => expect(screen.getByText("Anna's Hummingbird")).toBeTruthy())
    expect(modeButton('Heatmap').getAttribute('aria-pressed')).toBe('true')
    expect(modeButton('Pins').getAttribute('aria-pressed')).toBe('false')
    expect(screen.queryByTestId('heat-layer')).toBeTruthy()
    expect(screen.queryByTestId('pins-map')).toBeNull()
  })

  it('the source still carries no mode reset in selectSpecies', async () => {
    // A belt-and-braces read of the call site, because the behavioural test
    // above depends on the combobox, the map branch and three mocks all staying
    // wired; this one fails for exactly one reason.
    // A path from the vite root, not `import.meta.url`: this file runs under
    // jsdom, where `import.meta.url` is an http URL that `readFileSync` rejects.
    const { readFileSync } = await import('node:fs')
    const raw = readFileSync('src/components/SpeciesDetail.tsx', 'utf8')
    expect(raw.length).toBeGreaterThan(1000)                 // the file was read
    // Comments first: the call site's own comment NAMES the line it removed.
    const src = raw
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
    const body = src.slice(src.indexOf('const selectSpecies'))
    const fnBody = body.slice(0, body.indexOf('\n  }'))
    expect(fnBody).toContain('setSelectedSpecies(name)')     // non-vacuity
    expect(fnBody).not.toContain('setMapMode(')
  })
})

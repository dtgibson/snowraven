// @vitest-environment jsdom
//
// The Statistics taxonomy batch must carry each observed name AND its
// normalized parent. The codes lookup is species-only on both transports, so a
// bird recorded ONLY as a form ("Swan Goose (Domestic type)") can resolve to
// its parent species code no other way — and a species that resolves nowhere
// is invisible to the escapee cover index: it classified 'unknown' and
// silently counted, which is the v1.0.1 zero-escapees defect. This file pins
// the REQUEST; the cover-side healing is pinned in exoticProvenance.test.ts
// and useExoticProvenance.test.tsx.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, waitFor } from '@testing-library/react'

const FIXTURE_OBS = [
  {
    submissionId: 'S1', commonName: 'Swan Goose (Domestic type)',
    scientificName: 'Anser cygnoides (Domestic type)',
    date: '2023-01-15', location: 'Lake', locationId: 'L1', latitude: 45.0, longitude: -93.2,
    county: 'Hennepin', count: 2, breedingCode: null, speciesComments: '', catalogIds: [],
    stateProvince: 'US-MN', duration: 30, distance: 1, protocol: 'Traveling', numObservers: 1,
  },
  {
    submissionId: 'S1', commonName: 'Mallard', scientificName: 'Anas platyrhynchos',
    date: '2023-01-15', location: 'Lake', locationId: 'L1', latitude: 45.0, longitude: -93.2,
    county: 'Hennepin', count: 5, breedingCode: null, speciesComments: '', catalogIds: [],
    stateProvince: 'US-MN', duration: 30, distance: 1, protocol: 'Traveling', numObservers: 1,
  },
]

vi.mock('../lib/observationsCache', () => ({
  loadEbirdObservations: vi.fn(async () => ({ text: '', observations: FIXTURE_OBS })),
}))

vi.mock('../lib/mlExportCache', () => ({
  loadMLExport: vi.fn(async () => null),
}))

vi.mock('../lib/storage', () => ({
  storage: {
    getFilesStatus: vi.fn(async () => ({
      ebird: { filename: 'ebird.csv', uploadedAt: '2023-04-01' },
      ml: null,
    })),
    getSetting: vi.fn(async () => null),
    setSetting: vi.fn(async () => {}),
    readFile: vi.fn(async () => null),
    getApiKey: vi.fn(async () => null),
  },
}))

vi.mock('../lib/transport', () => ({
  transport: {
    post: vi.fn(async (path: string) => {
      if (path === '/taxonomy/codes') return { codes: {} }
      return {}
    }),
    get: vi.fn(async () => ({ species: [] })),
  },
}))

let BirdingStats: typeof import('./BirdingStats').BirdingStats
let transportModule: typeof import('../lib/transport')

beforeEach(async () => {
  ;({ BirdingStats } = await import('./BirdingStats'))
  transportModule = await import('../lib/transport')
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('the taxonomy codes batch (form names resolve through their parent)', () => {
  it('sends the raw form name AND its normalized parent name', async () => {
    render(<BirdingStats onGoToSettings={() => {}} onOpenSpecies={() => {}} />)
    const post = vi.mocked(transportModule.transport.post)
    await waitFor(() => {
      expect(post.mock.calls.some(c => c[0] === '/taxonomy/codes')).toBe(true)
    })
    const call = post.mock.calls.find(c => c[0] === '/taxonomy/codes')!
    const names = (call[1] as { species: Array<{ commonName: string }> }).species.map(s => s.commonName)
    // The raw name stays (formCodes consumers need it)...
    expect(names).toContain('Swan Goose (Domestic type)')
    // ...and the parent joins it, so the species-only lookup can answer.
    expect(names).toContain('Swan Goose')
    // A name that IS its own parent is not duplicated.
    expect(names.filter(n => n === 'Mallard')).toHaveLength(1)
  })
})

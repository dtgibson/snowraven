// @vitest-environment jsdom
// QA-07 (written by the Tester at QA round 1): a superseded load and an unmounted
// load write no state. Red with both post-load `cancelled` checks removed.
import { it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, act, waitFor } from '@testing-library/react'
import type { ObservationEntry } from '../../types'

const SNAP = vi.hoisted(() => ({ checklists: new Set(), species: new Map(), excludedNames: [], exoticNames: null }))
const H = vi.hoisted(() => ({ parked: [] as Array<(v: unknown) => void>, park: true, now: [] as unknown[] }))
vi.mock('../../lib/storage', () => ({ storage: {
  getFilesStatus: vi.fn(async () => ({ ebird: { filename: 'x.csv' }, ml: null })),
  getSetting: vi.fn(async () => null), setSetting: vi.fn(async () => {}),
} }))
vi.mock('../../lib/observationsCache', () => ({
  loadEbirdObservations: vi.fn(() => H.park
    ? new Promise(r => { H.parked.push(r) })
    : Promise.resolve({ headerLine: '', observations: H.now })),
}))
vi.mock('../../lib/mlExportCache', () => ({ loadMLExport: vi.fn(async () => null) }))
vi.mock('../../lib/transport', () => ({ transport: { post: vi.fn(async () => ({ codes: {} })), get: vi.fn() } }))
vi.mock('../../lib/exoticProvenanceCache', () => ({ getSnapshot: () => SNAP, subscribe: () => () => {}, loadSnapshot: vi.fn(async () => null) }))

import { LifeListsTab } from './LifeListsTab'
import { loadEbirdObservations } from '../../lib/observationsCache'
import { notifyFilesChanged } from '../../lib/filesChanged'

const o = (commonName: string, submissionId: string): ObservationEntry => ({
  submissionId, commonName, scientificName: '', date: '2020-01-01', location: 'L', locationId: 'L1', latitude: null, longitude: null,
  county: null, count: 1, breedingCode: null, speciesComments: '', catalogIds: [], time: null, stateProvince: null,
} as ObservationEntry)
const count = () => document.querySelector('.sr-lfl-count')?.textContent ?? ''
afterEach(() => { cleanup(); H.parked.length = 0; H.park = true; vi.clearAllMocks() })

it('a superseded load (parked past its early checks) never paints over the newer one', async () => {
  render(<LifeListsTab onGoToSettings={() => {}} />)
  await waitFor(() => expect(loadEbirdObservations).toHaveBeenCalledTimes(1))   // run 1 parked on the backup read
  H.park = false; H.now = [o('Snowy Owl', 'S9')]
  await act(async () => { notifyFilesChanged() })
  await waitFor(() => expect(count()).toMatch(/^1 species/))
  await act(async () => { H.parked[0]({ headerLine: '', observations: [o('A', 'S1'), o('B', 'S2'), o('C', 'S3')] }); await new Promise(r => setTimeout(r, 30)) })
  expect(count()).toMatch(/^1 species/)
})

it('unmounting mid-load writes no state and logs nothing', async () => {
  const err = vi.spyOn(console, 'error').mockImplementation(() => {})
  const r = render(<LifeListsTab onGoToSettings={() => {}} />)
  await waitFor(() => expect(loadEbirdObservations).toHaveBeenCalledTimes(1))
  r.unmount()
  await act(async () => { H.parked[0]({ headerLine: '', observations: [o('A', 'S1')] }); await new Promise(r => setTimeout(r, 30)) })
  expect(err).not.toHaveBeenCalled()
  err.mockRestore()
})

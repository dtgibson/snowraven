// @vitest-environment jsdom
//
// Guard for fix: cache-read-throw-containment — the TAB-LEVEL half.
//
// `honestLoadFailures.test.tsx` mocks `../lib/observationsCache` wholesale, so it
// proves the caller guards and structurally cannot see what the cache module does
// with a failing read. This file does the opposite and is the reason the two
// coexist: `observationsCache` is REAL here, and only `storage` is mocked, so the
// rejection starts exactly where it starts in production — inside
// `WebStorage.readFile`'s bare `fetch` — and travels the real seam into the tab.
//
// Before the fix the read sat outside `loadFresh`'s try, so the rejection escaped
// the cache, landed in each tab loader's outer `catch`, and rendered the
// SetupRequired guidance panel: "eBird Backup Required" with the Download My Data
// step list, over a backup `getFilesStatus` had just reported as stored. Both
// rows below assert BOTH halves — the honest message present AND the steps absent
// — because the two phases are deliberately distinct (DECISIONS.md 2026-05-22),
// and each row carries its absent case so it cannot pass by rendering nothing.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import type { ReactNode } from 'react'

const H = vi.hoisted(() => ({
  getFilesStatus: vi.fn(),
  readFile: vi.fn(),
  getSetting: vi.fn(),
  setSetting: vi.fn(),
  deleteSetting: vi.fn(),
  getApiKey: vi.fn(),
  tGet: vi.fn(),
  tPost: vi.fn(),
}))

// The ONLY seam mocked. `../lib/observationsCache` is deliberately real.
vi.mock('../lib/storage', () => ({
  storage: {
    getFilesStatus: H.getFilesStatus,
    readFile: H.readFile,
    getSetting: H.getSetting,
    setSetting: H.setSetting,
    deleteSetting: H.deleteSetting,
    getApiKey: H.getApiKey,
  },
}))
vi.mock('../lib/transport', () => ({
  transport: { get: H.tGet, post: H.tPost },
  TransportError: class extends Error {},
}))

import { EBIRD_BACKUP_LOAD_ERROR } from './setupCopy'
import { clearEbirdObservationsCache } from '../lib/observationsCache'
import { BreedingCodeList } from './BreedingCodeList'
import { Calendar } from './Calendar'

// A Breeding Code column so BreedingCodeList reaches `ready` rather than its OTHER
// error branch (the wrong-file message), and a date so the Calendar finds a year.
const EBIRD_CSV = [
  'Submission ID,Common Name,Scientific Name,County,Date,Breeding Code',
  'S1,American Robin,Turdus migratorius,Marin,2024-05-01,NB',
].join('\n') + '\n'

const EBIRD_STORED = { ebird: { filename: 'MyEBirdData.csv', uploadedAt: '2024-06-01' }, ml: null }
const NO_FILES = { ebird: null, ml: null }

/** Present only inside the SetupRequired guidance panel — the lie being removed. */
const EBIRD_STEPS_MARKER = /Download My Data/

const settingsProps = { onGoToSettings: () => {} }

/** One row per tab whose loader maps a THROWN load to `setup-required`. Two of the
 *  eight is the sample, not the roster: `honestLoadFailures.test.tsx` owns the
 *  full eight-surface roster for the falsy branch these now reach. */
const TABS: { name: string; element: ReactNode; ready: () => Promise<unknown> }[] = [
  {
    name: 'Breeding Codes',
    element: <BreedingCodeList {...settingsProps} filesVersion={0} />,
    ready: () => screen.findByRole('button', { name: 'Pin code labels' }),
  },
  {
    name: 'Calendar',
    element: <Calendar {...settingsProps} filesVersion={0} />,
    ready: () => screen.findByRole('button', { name: 'Total count' }),
  },
]

beforeEach(() => {
  for (const fn of Object.values(H)) { fn.mockReset() }
  clearEbirdObservationsCache()
  H.getFilesStatus.mockImplementation(async () => EBIRD_STORED)
  H.readFile.mockImplementation(async () => EBIRD_CSV)
  H.getSetting.mockImplementation(async () => null)
  H.setSetting.mockImplementation(async () => {})
  H.deleteSetting.mockImplementation(async () => {})
  H.getApiKey.mockImplementation(async () => null)
  H.tGet.mockImplementation(async () => ({}))
  H.tPost.mockImplementation(async () => ({ codes: {}, orders: {}, formCodes: {} }))
})
afterEach(cleanup)

describe('a stored backup whose read throws reaches the honest error, not the setup panel', () => {
  it.each(TABS.map(t => [t.name, t] as const))(
    '%s names the file and the Settings path instead of asking for an upload',
    async (_name, tab) => {
      // The exact web/Pi failure: the backend is unreachable, so the bare fetch in
      // WebStorage.readFile rejects. getFilesStatus is a DIFFERENT route and still
      // resolves "a backup is stored", which is what makes the setup panel a lie.
      H.readFile.mockImplementation(async () => { throw new TypeError('Failed to fetch') })
      render(tab.element)

      expect(await screen.findByText(EBIRD_BACKUP_LOAD_ERROR)).toBeTruthy()
      // The two halves of the lie, both gone.
      expect(screen.queryByText(EBIRD_STEPS_MARKER)).toBeNull()
      expect(screen.queryByText(/eBird Backup Required/)).toBeNull()
      expect(screen.getByRole('button', { name: /Go to Settings/ })).toBeTruthy()
    },
  )

  it.each(TABS.map(t => [t.name, t] as const))(
    '%s still shows the setup panel when no file is stored (the split holds)',
    async (_name, tab) => {
      H.getFilesStatus.mockImplementation(async () => NO_FILES)
      render(tab.element)

      expect(await screen.findByText(EBIRD_STEPS_MARKER)).toBeTruthy()
      expect(screen.queryByText(EBIRD_BACKUP_LOAD_ERROR)).toBeNull()
    },
  )

  it.each(TABS.map(t => [t.name, t] as const))(
    '%s still renders normally when the read succeeds (the absent case)',
    async (_name, tab) => {
      render(tab.element)

      expect(await tab.ready()).toBeTruthy()
      expect(screen.queryByText(EBIRD_BACKUP_LOAD_ERROR)).toBeNull()
      expect(screen.queryByText(EBIRD_STEPS_MARKER)).toBeNull()
    },
  )
})

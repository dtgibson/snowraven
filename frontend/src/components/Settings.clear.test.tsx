// @vitest-environment jsdom
// clear-means-clear, the local Settings clear path (the third of the three).
//
// Two things this file exists to hold, both of which the shipped handler got
// wrong: `handleDeleteFile` must run the shared derived-store teardown, and it
// must bump the files epoch. The epoch is not cosmetic — tabs are hidden with
// display:none rather than unmounted, and every observations loader keys on
// `filesVersion`, so without a bump a mounted tab keeps rendering the cleared
// backup until a relaunch.
//
// And the negative: the UPLOAD path shares almost all of this handler's shape
// and must purge nothing.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react'

const filesStatus = vi.hoisted(() => ({
  current: { ebird: null, ml: null } as {
    ebird: { filename: string; uploadedAt: string } | null
    ml: { filename: string; uploadedAt: string } | null
  },
}))

const deleteFile = vi.hoisted(() => vi.fn<() => Promise<void>>().mockResolvedValue(undefined))
const writeFile = vi.hoisted(() => vi.fn<() => Promise<void>>().mockResolvedValue(undefined))

vi.mock('../lib/storage', () => ({
  storage: {
    getFilesStatus: vi.fn(async () => filesStatus.current),
    getApiKey: vi.fn().mockResolvedValue(null),
    getSetting: vi.fn().mockResolvedValue(null),
    setApiKey: vi.fn().mockResolvedValue(undefined),
    deleteApiKey: vi.fn().mockResolvedValue(undefined),
    writeFile,
    deleteFile,
    setSetting: vi.fn().mockResolvedValue(undefined),
    deleteSetting: vi.fn().mockResolvedValue(undefined),
  },
}))
vi.mock('../lib/platform', () => ({
  isTauri: vi.fn(() => false),
  isIOS: vi.fn(() => false),
  isWindows: vi.fn(() => false),
  isMacOS: vi.fn(() => false),
}))
vi.mock('../lib/observationsCache', () => ({ clearEbirdObservationsCache: vi.fn() }))
vi.mock('../lib/mlExportCache', () => ({ clearMLExportCache: vi.fn() }))
vi.mock('../lib/networkCache', () => ({ clearNetworkCache: vi.fn() }))
vi.mock('../lib/hotspotSet', () => ({ invalidateHotspotSet: vi.fn() }))
vi.mock('../lib/iosImport', () => ({
  IOS_IMPORT_MECHANISM: 'input',
  pickCsvViaDialog: vi.fn(),
}))

// The unit under test at this level: WHICH paths reach the shared teardown.
// What the teardown then does to each document is proven end to end against a
// fake storage seam in lib/clearDerived.test.ts.
const purgeDerivedOnClear = vi.hoisted(() => vi.fn<(slot: 'ebird' | 'ml') => Promise<readonly string[]>>().mockResolvedValue([]))
vi.mock('../lib/clearDerived', () => ({ purgeDerivedOnClear }))

import { Settings } from './Settings'
import { DEFAULT_TAB_ORDER } from '../lib/tabLayout'
import type { ConfigurableTab } from '../lib/tabLayout'

const SAVED = { filename: 'MyEBirdData.csv', uploadedAt: '2026-08-20T10:00:00.000Z' }

function renderSettings(overrides: Partial<React.ComponentProps<typeof Settings>> = {}) {
  const onFilesSaved = vi.fn()
  const props: React.ComponentProps<typeof Settings> = {
    onOpenHelp: vi.fn(),
    textScale: 1,
    onTextScaleChange: vi.fn(),
    tabOrder: [...DEFAULT_TAB_ORDER],
    tabHidden: new Set<ConfigurableTab>(),
    onReorder: vi.fn(),
    onToggleVisibility: vi.fn(),
    onRestoreDefaults: vi.fn(),
    disableEmbeddedMedia: false,
    embeddedMediaPreferenceSaving: false,
    embeddedMediaPreferenceError: null,
    onDisableEmbeddedMediaChange: vi.fn(),
    onFilesSaved,
    ...overrides,
  }
  const utils = render(<Settings {...props} />)
  return { ...utils, onFilesSaved }
}

/** The Clear button belonging to one file row (the API-key rows have their own). */
function clearButtonFor(label: string): HTMLElement {
  const row = screen.getByText(label).closest('.sr-action-row')
  if (!row) throw new Error(`no file row for ${label}`)
  return within(row as HTMLElement).getByRole('button', { name: 'Clear' })
}

beforeEach(() => {
  filesStatus.current = { ebird: { ...SAVED }, ml: { filename: 'ML.csv', uploadedAt: SAVED.uploadedAt } }
  deleteFile.mockClear().mockResolvedValue(undefined)
  writeFile.mockClear().mockResolvedValue(undefined)
  purgeDerivedOnClear.mockClear().mockResolvedValue([])
})

afterEach(cleanup)

describe('the local Settings clear (clear-means-clear)', () => {
  it('purges the derived stores for the slot it cleared, and only that slot', async () => {
    renderSettings()
    fireEvent.click(await waitFor(() => clearButtonFor('eBird Backup')))

    await waitFor(() => expect(purgeDerivedOnClear).toHaveBeenCalledWith('ebird'))
    expect(purgeDerivedOnClear).toHaveBeenCalledTimes(1)
    expect(deleteFile).toHaveBeenCalledWith('ebird')
  })

  it('bumps the files epoch, so the seven still-mounted tabs notice without a relaunch', async () => {
    const { onFilesSaved } = renderSettings()
    fireEvent.click(await waitFor(() => clearButtonFor('eBird Backup')))

    await waitFor(() => expect(onFilesSaved).toHaveBeenCalledTimes(1))
  })

  it('runs the ML slot through the same shared teardown', async () => {
    // Nothing is registered for 'ml' today, but the CALL is what keeps the
    // handler slot-driven: the first ML-derived store must not need a new
    // wiring here, only a registry row.
    renderSettings()
    fireEvent.click(await waitFor(() => clearButtonFor('ML Export')))

    await waitFor(() => expect(purgeDerivedOnClear).toHaveBeenCalledWith('ml'))
  })

  it('a store that would not purge is REPORTED, not reported as a completed clear', async () => {
    // The teardown is best-effort per store and does not reject, so an empty
    // resolve used to be indistinguishable from a clean sweep: a Clear that
    // left a derived document on disk told the user it had finished. The file
    // itself IS gone, so this is not a failed delete and must not claim to be
    // one; the row still clears and the epoch still bumps.
    purgeDerivedOnClear.mockResolvedValueOnce(['exotic-provenance-v1'])
    const { onFilesSaved } = renderSettings()
    fireEvent.click(await waitFor(() => clearButtonFor('eBird Backup')))

    await waitFor(() => expect(screen.getByText(
      'File removed, but some data worked out from it could not be deleted. Clearing again after your next upload will remove it.',
    )).toBeTruthy())
    expect(screen.queryByText('Delete failed. Please try again.')).toBeNull()
    expect(onFilesSaved).toHaveBeenCalledTimes(1)
  })

  it('says nothing extra when every store purged', async () => {
    renderSettings()
    fireEvent.click(await waitFor(() => clearButtonFor('eBird Backup')))

    await waitFor(() => expect(purgeDerivedOnClear).toHaveBeenCalled())
    expect(screen.queryByText(/could not be deleted/)).toBeNull()
  })

  it('a failed delete purges nothing and does not bump the epoch', async () => {
    deleteFile.mockRejectedValueOnce(new Error('EIO'))
    const { onFilesSaved } = renderSettings()
    fireEvent.click(await waitFor(() => clearButtonFor('eBird Backup')))

    await waitFor(() => expect(screen.getByText('Delete failed. Please try again.')).toBeTruthy())
    expect(purgeDerivedOnClear).not.toHaveBeenCalled()
    expect(onFilesSaved).not.toHaveBeenCalled()
  })
})

describe('the upload path is a REPLACE and purges nothing', () => {
  it('a new export bumps the epoch but leaves every derived answer in place', async () => {
    const { container, onFilesSaved } = renderSettings()
    await waitFor(() => clearButtonFor('eBird Backup'))

    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    // A real eBird header: since ml-export-hardening the import chokepoint refuses
    // a file whose content does not match the slot, so a placeholder CSV would be
    // turned away here and never reach the replace path this test is about.
    const file = new File(
      ['Submission ID,Common Name,Date\nS1,American Robin,2024-05-01\n'],
      'NewExport.csv', { type: 'text/csv' })
    Object.defineProperty(input, 'files', { value: [file] })
    fireEvent.change(input)

    await waitFor(() => expect(onFilesSaved).toHaveBeenCalled())
    expect(writeFile).toHaveBeenCalled()
    // The published promise in PRIVACY_POLICY.md: a newer export re-asks only
    // the checklists that have not been answered yet.
    expect(purgeDerivedOnClear).not.toHaveBeenCalled()
  })
})

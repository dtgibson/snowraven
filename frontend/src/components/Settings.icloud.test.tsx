// @vitest-environment jsdom
//
// Settings → iCloud Sync (icloud-sync; QA-01, QA-02, QA-08, QA-22, QA-23,
// QA-24, QA-28, QA-31, QA-38 where unit-testable, QA-40). The component reads
// the REAL entry-safe state store (lib/icloud/icloudState.ts), driven here by
// setICloudState/setSlotView, with fake actions installed in place of the
// controller. jsdom has no layout engine, so the geometric claims (320px /
// 200%, AA contrast, the animations) stay with the browser QA pass; what is
// pinned here is gating, structure, semantics, copy, and wiring.

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react'

const storageMock = vi.hoisted(() => ({
  getFilesStatus: vi.fn(),
  getApiKey: vi.fn().mockResolvedValue(null),
  getSetting: vi.fn().mockResolvedValue(null),
  setApiKey: vi.fn().mockResolvedValue(undefined),
  deleteApiKey: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  deleteFile: vi.fn().mockResolvedValue(undefined),
  setSetting: vi.fn().mockResolvedValue(undefined),
  deleteSetting: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('../lib/storage', () => ({ storage: storageMock }))
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
vi.mock('../lib/iosImport', () => ({ IOS_IMPORT_MECHANISM: 'input', pickCsvViaDialog: vi.fn() }))
vi.mock('@tauri-apps/plugin-process', () => ({ relaunch: vi.fn() }))

import { Settings } from './Settings'
import { isTauri, isIOS, isMacOS } from '../lib/platform'
import { DEFAULT_TAB_ORDER } from '../lib/tabLayout'
import type { ConfigurableTab } from '../lib/tabLayout'
import {
  installICloudActions, resetICloudState, setICloudState, setSlotView,
  type ICloudActions, type SlotView, type SlotState,
} from '../lib/icloud/icloudState'
import type { Slot } from '../lib/icloud/icloudRecord'
import type { KeySlot } from '../lib/icloud/keyRecord'
import * as copy from '../lib/icloud/icloudCopy'

const FILES = {
  ebird: { filename: 'MyEBirdData.csv', uploadedAt: '2026-08-24T22:12:00.000Z' },
  ml: { filename: 'ML_2026-08-24_dave.csv', uploadedAt: '2026-08-24T22:20:00.000Z' },
}

function fakeActions(): ICloudActions {
  return {
    enable: vi.fn(async () => {}),
    disable: vi.fn(async () => {}),
    checkNow: vi.fn(async () => ({ ok: true, transferred: false, at: '2026-09-01T16:14:00.000Z' })),
    downloadNow: vi.fn<(slot: Slot) => Promise<void>>(async () => {}),
    retry: vi.fn<(slot: Slot) => Promise<void>>(async () => {}),
    removeFromICloud: vi.fn(async () => {}),
    clearWithSync: vi.fn<(slot: Slot) => Promise<readonly string[]>>(async () => []),
    fileSaved: vi.fn<(slot: Slot) => void>(() => {}),
    // icloud-api-key-sync (the key tests live in Settings.icloudKeys.test.tsx)
    enableKeys: vi.fn(async () => {}),
    disableKeys: vi.fn(async () => {}),
    removeKeysFromICloud: vi.fn(async () => {}),
    clearKeyWithSync: vi.fn<(slot: KeySlot) => Promise<void>>(async () => {}),
    retryKey: vi.fn<(slot: KeySlot) => Promise<void>>(async () => {}),
    keySaved: vi.fn<(slot: KeySlot) => void>(() => {}),
  }
}

let actions = fakeActions()

function gate(on: boolean) {
  vi.mocked(isTauri).mockReturnValue(on)
  vi.mocked(isMacOS).mockReturnValue(on)
  vi.mocked(isIOS).mockReturnValue(false)
}

function renderSettings() {
  return render(
    <Settings
      onOpenHelp={vi.fn()}
      textScale={1}
      onTextScaleChange={vi.fn()}
      tabOrder={[...DEFAULT_TAB_ORDER]}
      tabHidden={new Set<ConfigurableTab>()}
      onReorder={vi.fn()}
      onToggleVisibility={vi.fn()}
      onRestoreDefaults={vi.fn()}
      disableEmbeddedMedia={false}
      embeddedMediaPreferenceSaving={false}
      embeddedMediaPreferenceError={null}
      onDisableEmbeddedMediaChange={vi.fn()}
    />,
  )
}

/** The Clear button of the Default Files row showing `filename` (the API key rows have Clear buttons too). */
function fileRowClear(filename: string): HTMLButtonElement {
  const row = screen.getByText(filename).closest('.sr-action-row') as HTMLElement
  return within(row).getByRole('button', { name: 'Clear' }) as HTMLButtonElement
}

/** The eBird BACKUP row's status region. Since icloud-api-key-sync the two
 *  API Keys rows (which render above Default Files) carry a region each too,
 *  so there are four in all and the file rows are the third and fourth. */
function ebirdSyncLine(): HTMLElement {
  const lines = document.querySelectorAll<HTMLElement>('.sr-sync-line')
  expect(lines.length).toBe(4)
  return lines[2]
}

beforeEach(() => {
  resetICloudState()
  actions = fakeActions()
  installICloudActions(actions)
  storageMock.getFilesStatus.mockResolvedValue({ ebird: FILES.ebird, ml: FILES.ml })
})

afterEach(() => {
  cleanup()
  installICloudActions(null)
  gate(false)
})

describe('platform gate (FR-01, QA-01)', () => {
  it('with the gate false there is no iCloud markup, toggle, copy, or sync status region', async () => {
    gate(false)
    renderSettings()
    await screen.findByText('MyEBirdData.csv')
    expect(screen.queryByText(copy.ICS_HEADER)).toBeNull()
    expect(screen.queryByRole('switch', { name: copy.ICS_HEADER })).toBeNull()
    expect(screen.queryByText(copy.ICS_DESCRIPTION)).toBeNull()
    expect(document.querySelector('.sr-sync-line')).toBeNull()
    expect(document.body.textContent).not.toContain('iCloud')
  })

  it('with the gate true the section renders below Default Files, and the switch is named by the header', async () => {
    gate(true)
    setICloudState({ availability: 'available', platform: 'mac', deviceLabel: "Dave's Mac" })
    renderSettings()
    await screen.findByText('MyEBirdData.csv')
    const sw = screen.getByRole('switch', { name: copy.ICS_HEADER })
    expect(sw.getAttribute('aria-checked')).toBe('false')
    expect((sw as HTMLButtonElement).disabled).toBe(false)
    expect(screen.getByText(copy.ICS_DESCRIPTION)).toBeTruthy()
    // Order: Default Files header, then the iCloud Sync header (the span the
    // switch is labelled by), then Default Location. Hidden label spans are
    // excluded so only section headers are compared.
    const texts = Array.from(document.querySelectorAll('span:not(.sr-only)')).map(s => s.textContent)
    const headerId = sw.getAttribute('aria-labelledby') ?? ''
    expect(document.getElementById(headerId)?.textContent).toBe(copy.ICS_HEADER)
    const iFiles = texts.indexOf('Default Files')
    const iSync = texts.indexOf(copy.ICS_HEADER)
    const iLoc = texts.indexOf('Default Location')
    expect(iFiles).toBeGreaterThanOrEqual(0)
    expect(iSync).toBeGreaterThan(iFiles)
    expect(iLoc).toBeGreaterThan(iSync)
    // Both file rows carry a mounted, empty status region (children replaced,
    // never remounted); since icloud-api-key-sync the two key rows do too.
    expect(document.querySelectorAll('.sr-sync-line').length).toBe(4)
    expect(ebirdSyncLine().getAttribute('role')).toBe('status')
    expect(ebirdSyncLine().textContent).toBe('')
  })
})

describe('availability (FR-03, QA-02)', () => {
  it.each([
    ['not-signed-in', copy.AVAILABILITY_NOTES['not-signed-in']],
    ['drive-off-or-unauthorized', copy.AVAILABILITY_NOTES['drive-off-or-unauthorized']],
    ['build-cannot-use-icloud', copy.AVAILABILITY_NOTES['build-cannot-use-icloud']],
  ] as const)('%s: the switch stays visible, is not operable, and the note is wired through aria-describedby', async (state, note) => {
    gate(true)
    setICloudState({ availability: state, platform: 'mac' })
    renderSettings()
    const sw = await screen.findByRole('switch', { name: copy.ICS_HEADER })
    expect((sw as HTMLButtonElement).disabled).toBe(true)
    const noteEl = screen.getByText(note)
    const described = (sw.getAttribute('aria-describedby') ?? '').split(' ')
    expect(described).toContain(noteEl.id)
    fireEvent.click(sw)
    expect(actions.enable).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('before the controller loads (unknown) the switch is disabled with no note', async () => {
    gate(true)
    renderSettings()
    const sw = await screen.findByRole('switch', { name: copy.ICS_HEADER })
    expect((sw as HTMLButtonElement).disabled).toBe(true)
    for (const n of Object.values(copy.AVAILABILITY_NOTES)) expect(screen.queryByText(n)).toBeNull()
  })

  it('with sync on and iCloud unavailable, the switch stays ON and disabled (FR-04)', async () => {
    gate(true)
    setICloudState({ availability: 'not-signed-in', syncEnabled: true, platform: 'mac' })
    renderSettings()
    const sw = await screen.findByRole('switch', { name: copy.ICS_HEADER })
    expect(sw.getAttribute('aria-checked')).toBe('true')
    expect((sw as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('enable note (FR-08, QA-08) and turning off (FR-32)', () => {
  it('switching on opens the note with its four elements; Cancel leaves sync off and calls nothing', async () => {
    gate(true)
    setICloudState({ availability: 'available', platform: 'mac' })
    renderSettings()
    const sw = await screen.findByRole('switch', { name: copy.ICS_HEADER })
    fireEvent.click(sw)
    const dialog = await screen.findByRole('dialog', { name: copy.ENABLE_TITLE })
    for (const item of copy.enableNoteItems('this Mac')) {
      expect(within(dialog).getByText(item.lead)).toBeTruthy()
      expect(within(dialog).getByText(item.text)).toBeTruthy()
    }
    expect(within(dialog).getByText(/stay on this Mac, and so do your API keys unless you also turn on Sync API keys\./)).toBeTruthy()
    expect(sw.getAttribute('aria-checked')).toBe('false')
    fireEvent.click(within(dialog).getByRole('button', { name: copy.BUTTONS.cancel }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(actions.enable).not.toHaveBeenCalled()
    expect(sw.getAttribute('aria-checked')).toBe('false')
  })

  it('Escape cancels the note and focus returns to the switch', async () => {
    gate(true)
    setICloudState({ availability: 'available', platform: 'mac' })
    renderSettings()
    const sw = await screen.findByRole('switch', { name: copy.ICS_HEADER })
    fireEvent.click(sw)
    await screen.findByRole('dialog', { name: copy.ENABLE_TITLE })
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.activeElement).toBe(sw)
    expect(actions.enable).not.toHaveBeenCalled()
  })

  it('Turn on calls enable; the note names the device word for iPhone', async () => {
    gate(true)
    setICloudState({ availability: 'available', platform: 'iphone' })
    renderSettings()
    fireEvent.click(await screen.findByRole('switch', { name: copy.ICS_HEADER }))
    const dialog = await screen.findByRole('dialog', { name: copy.ENABLE_TITLE })
    expect(within(dialog).getByText(/stay on this iPhone, and so do your API keys unless you also turn on Sync API keys\./)).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: copy.BUTTONS.turnOn }))
    expect(actions.enable).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('switching off needs no confirmation', async () => {
    gate(true)
    setICloudState({ availability: 'available', syncEnabled: true, platform: 'mac' })
    renderSettings()
    fireEvent.click(await screen.findByRole('switch', { name: copy.ICS_HEADER }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(actions.disable).toHaveBeenCalledTimes(1)
  })
})

describe('the eight row states as text (FR-24, QA-23) and provenance (FR-23, FR-25, QA-22)', () => {
  const origin = { label: "Dave's Mac", platform: 'mac' as const }
  const peer = { label: 'iPhone', platform: 'iphone' as const }
  const T = '2026-09-01T15:02:00.000Z'
  const views: Array<[SlotState, SlotView, RegExp]> = [
    ['up-to-date', { state: 'up-to-date', fromThisDevice: true }, /From this device/],
    ['uploading', { state: 'uploading', fromThisDevice: true }, /From this device/],
    ['downloading', { state: 'downloading', fromThisDevice: false, origin: peer, uploadedAt: T }, /From iPhone, uploaded /],
    ['in-icloud-not-downloaded', { state: 'in-icloud-not-downloaded', fromThisDevice: false, origin, uploadedAt: T }, /From Dave's Mac \(Mac\), uploaded /],
    ['waiting-to-upload', { state: 'waiting-to-upload', fromThisDevice: true }, /From this device/],
    ['unavailable', { state: 'unavailable', fromThisDevice: false, origin }, /From Dave's Mac \(Mac\)/],
    ['off', { state: 'off', fromThisDevice: false }, /^Sync off$/],
    ['error', { state: 'error', fromThisDevice: false, origin: peer, reason: copy.REASONS.mismatch }, /did not download completely/],
  ]

  it.each(views)('%s renders its exact label as text inside the row status region', async (state, view, detail) => {
    gate(true)
    setICloudState({ availability: 'available', syncEnabled: true, platform: 'mac' })
    setSlotView('ebird', view)
    renderSettings()
    await screen.findByText('MyEBirdData.csv')
    await waitFor(() => expect(ebirdSyncLine().textContent).toContain(copy.STATE_LABELS[state]))
    expect(ebirdSyncLine().textContent).toMatch(detail)
    // The label is a text node, never colour alone: the glyph is aria-hidden.
    const svg = ebirdSyncLine().querySelector('svg')
    expect(svg?.getAttribute('aria-hidden')).toBe('true')
  })

  it('the region is the SAME element across a state change (children replaced, never remounted)', async () => {
    gate(true)
    setICloudState({ availability: 'available', syncEnabled: true, platform: 'mac' })
    setSlotView('ebird', { state: 'uploading', fromThisDevice: true })
    renderSettings()
    await screen.findByText('MyEBirdData.csv')
    await waitFor(() => expect(ebirdSyncLine().textContent).toContain('Syncing, uploading'))
    const el = ebirdSyncLine()
    setSlotView('ebird', { state: 'up-to-date', fromThisDevice: true })
    await waitFor(() => expect(el.textContent).toContain('Up to date'))
    expect(ebirdSyncLine()).toBe(el)
  })

  it('the FR-25 line takes the place of the provenance while set', async () => {
    gate(true)
    setICloudState({ availability: 'available', syncEnabled: true, platform: 'mac' })
    setSlotView('ebird', { state: 'up-to-date', fromThisDevice: false, origin: peer, replacedAt: T })
    renderSettings()
    await screen.findByText('MyEBirdData.csv')
    await waitFor(() => expect(ebirdSyncLine().textContent).toMatch(/Replaced by the file from iPhone, uploaded /))
    expect(ebirdSyncLine().textContent).not.toContain('From iPhone')
  })

  it('peer naming collapses when the label is the platform word (devName)', () => {
    expect(copy.devName({ label: 'iPhone', platform: 'iphone' })).toBe('iPhone')
    expect(copy.devName({ label: 'iPad', platform: 'ipad' })).toBe('iPad')
    expect(copy.devName({ label: "Dave's Mac", platform: 'mac' })).toBe("Dave's Mac (Mac)")
    expect(copy.devName({ label: 'Kestrel', platform: 'iphone' })).toBe('Kestrel (iPhone)')
  })

  it('Download now and Retry are real buttons wired to the actions', async () => {
    gate(true)
    setICloudState({ availability: 'available', syncEnabled: true, platform: 'mac' })
    setSlotView('ebird', { state: 'in-icloud-not-downloaded', fromThisDevice: false, origin: peer, uploadedAt: T })
    setSlotView('ml', { state: 'error', fromThisDevice: false, reason: copy.REASONS.timeout })
    renderSettings()
    const dl = await screen.findByRole('button', { name: copy.BUTTONS.downloadNow })
    fireEvent.click(dl)
    expect(actions.downloadNow).toHaveBeenCalledWith('ebird')
    fireEvent.click(await screen.findByRole('button', { name: copy.BUTTONS.retry }))
    expect(actions.retry).toHaveBeenCalledWith('ml')
  })

  it('a row with no local copy but a file in iCloud keeps "No file saved" and shows the sync line', async () => {
    gate(true)
    storageMock.getFilesStatus.mockResolvedValue({ ebird: null, ml: FILES.ml })
    setICloudState({ availability: 'available', syncEnabled: true, platform: 'mac' })
    setSlotView('ebird', { state: 'in-icloud-not-downloaded', fromThisDevice: false, origin: peer, uploadedAt: T })
    renderSettings()
    await screen.findByText('No file saved')
    await waitFor(() => expect(ebirdSyncLine().textContent).toContain('In iCloud, not downloaded here'))
  })
})

describe('status row, Check now and the announcer (FR-26, QA-24)', () => {
  it('reads Never checked with sync on and no check yet; Check now announces once per press, sequence-keyed', async () => {
    gate(true)
    setICloudState({ availability: 'available', syncEnabled: true, platform: 'mac' })
    renderSettings()
    await screen.findByText(copy.STATUS_NEVER)
    const btn = screen.getByRole('button', { name: copy.BUTTONS.checkNow })
    const region = document.querySelector('.sr-ics-status-row [role="status"]') as HTMLElement
    expect(region).toBeTruthy()
    expect(region.textContent).toBe('')
    const mutations: number[] = []
    const observer = new MutationObserver(records => mutations.push(records.length))
    observer.observe(region, { childList: true, subtree: true, characterData: true })
    fireEvent.click(btn)
    await waitFor(() => expect(region.textContent).toMatch(/^Checked .*\. Nothing to transfer\.$/))
    expect(actions.checkNow).toHaveBeenCalledTimes(1)
    const afterFirst = mutations.length
    fireEvent.click(btn)
    await waitFor(() => expect(actions.checkNow).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(mutations.length).toBeGreaterThan(afterFirst))
    observer.disconnect()
  })

  it('shows Last checked with the time and the failure suffix after an unreachable check', async () => {
    gate(true)
    setICloudState({ availability: 'available', syncEnabled: true, platform: 'mac', lastCheckAt: '2026-09-01T16:14:00.000Z', checkFailed: true })
    renderSettings()
    const status = await screen.findByText(/^Last checked .* Could not reach iCloud\.$/)
    expect(status.className).toContain('sr-ics-status')
    expect(status.getAttribute('aria-live')).toBeNull()
    expect(status.getAttribute('role')).toBeNull()
  })

  it('Check now is absent with sync off, and the status row collapses (elements still mounted)', async () => {
    gate(true)
    setICloudState({ availability: 'available', syncEnabled: false, platform: 'mac' })
    renderSettings()
    await screen.findByRole('switch', { name: copy.ICS_HEADER })
    expect(screen.queryByRole('button', { name: copy.BUTTONS.checkNow })).toBeNull()
    const row = document.querySelector('.sr-ics-status-row') as HTMLElement
    expect(row.className).toContain('sr-ics-status-row--empty')
    expect(row.querySelector('[role="status"]')).toBeTruthy()
  })
})

describe('Remove synced files from iCloud (FR-33, QA-31)', () => {
  it('appears only when available and something is shared, regardless of the toggle; confirms with the filenames', async () => {
    gate(true)
    setICloudState({ availability: 'available', syncEnabled: false, platform: 'mac', sharedExists: true, sharedFilenames: ['MyEBirdData.csv', 'ML_2026-08-24_dave.csv'] })
    renderSettings()
    const btn = await screen.findByRole('button', { name: copy.BUTTONS.remove })
    fireEvent.click(btn)
    const dialog = await screen.findByRole('dialog', { name: copy.REMOVE_TITLE })
    const items = within(dialog).getAllByRole('listitem').map(li => li.textContent)
    expect(items).toEqual(['MyEBirdData.csv', 'ML_2026-08-24_dave.csv'])
    expect(within(dialog).getByText(copy.removeOutro('this Mac'))).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: copy.BUTTONS.removeConfirm }))
    expect(actions.removeFromICloud).toHaveBeenCalledTimes(1)
  })

  it('is absent when nothing is shared, and when iCloud is unavailable', async () => {
    gate(true)
    setICloudState({ availability: 'available', syncEnabled: true, platform: 'mac', sharedExists: false })
    const { unmount } = renderSettings()
    await screen.findByRole('switch', { name: copy.ICS_HEADER })
    expect(screen.queryByRole('button', { name: copy.BUTTONS.remove })).toBeNull()
    unmount()
    setICloudState({ availability: 'not-signed-in', syncEnabled: true, platform: 'mac', sharedExists: true, sharedFilenames: ['x.csv'] })
    renderSettings()
    await screen.findByRole('switch', { name: copy.ICS_HEADER })
    expect(screen.queryByRole('button', { name: copy.BUTTONS.remove })).toBeNull()
  })
})

describe('Clear with sync on and off (FR-30, QA-28)', () => {
  it('with sync on, Clear asks first, names the file, and routes through the controller', async () => {
    gate(true)
    setICloudState({ availability: 'available', syncEnabled: true, platform: 'mac' })
    renderSettings()
    await screen.findByText('MyEBirdData.csv')
    fireEvent.click(fileRowClear('MyEBirdData.csv'))
    const dialog = await screen.findByRole('dialog', { name: 'Clear eBird Backup?' })
    expect(within(dialog).getByText('MyEBirdData.csv')).toBeTruthy()
    expect(dialog.textContent).toContain('removed from this Mac and from iCloud')
    expect(storageMock.deleteFile).not.toHaveBeenCalled()
    fireEvent.click(within(dialog).getByRole('button', { name: copy.BUTTONS.clearConfirm }))
    expect(actions.clearWithSync).toHaveBeenCalledWith('ebird')
    expect(storageMock.deleteFile).not.toHaveBeenCalled()
    // A clean sweep (the default: it resolves []) says nothing extra.
    expect(screen.queryByText(/could not be deleted/)).toBeNull()
  })

  it('a store that would not purge is surfaced on the SYNCED clear path too', async () => {
    // The same sentence as the local path, one path over. The two paths were
    // symmetric in the CODE and asymmetric in the EVIDENCE: deleting the
    // surfacing from the synced path left every test in this build green, which
    // is the same shape of gap as the missing fourth race row and the untested
    // composed seam. `clearWithSync` resolves with the stores that failed; the
    // sync itself succeeded, so this must not read as a failed clear.
    gate(true)
    setICloudState({ availability: 'available', syncEnabled: true, platform: 'mac' })
    // `actions` is typed as the real ICloudActions, so reach the double
    // through its mock type rather than widening the interface for a test.
    vi.mocked(actions.clearWithSync).mockResolvedValueOnce(['exotic-provenance-v1'])
    renderSettings()
    await screen.findByText('MyEBirdData.csv')
    fireEvent.click(fileRowClear('MyEBirdData.csv'))
    const dialog = await screen.findByRole('dialog', { name: 'Clear eBird Backup?' })
    fireEvent.click(within(dialog).getByRole('button', { name: copy.BUTTONS.clearConfirm }))

    expect(await screen.findByText(
      'File removed, but some data worked out from it could not be deleted. Clearing again after your next upload will remove it.',
    )).toBeTruthy()
    expect(screen.queryByText('Delete failed. Please try again.')).toBeNull()
  })

  it('with sync off, Clear is today\'s instant local clear with no dialog and no iCloud mention', async () => {
    gate(true)
    setICloudState({ availability: 'available', syncEnabled: false, platform: 'mac' })
    renderSettings()
    await screen.findByText('MyEBirdData.csv')
    fireEvent.click(fileRowClear('MyEBirdData.csv'))
    expect(screen.queryByRole('dialog')).toBeNull()
    await waitFor(() => expect(storageMock.deleteFile).toHaveBeenCalledWith('ebird'))
    expect(actions.clearWithSync).not.toHaveBeenCalled()
  })

  it('an upload with sync on records this device as the origin and tells the controller', async () => {
    gate(true)
    setICloudState({ availability: 'available', syncEnabled: true, platform: 'mac', deviceId: 'a'.repeat(32), deviceLabel: "Dave's Mac" })
    renderSettings()
    await screen.findByText('MyEBirdData.csv')
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    // A real eBird header: since ml-export-hardening the import chokepoint refuses
    // a file whose content does not match the slot (lib/uploadGuard).
    const CSV = 'Submission ID,Common Name,Date\nS1,American Robin,2024-05-01\n'
    const file = new File([CSV], 'MyEBirdData.csv', { type: 'text/csv' })
    fireEvent.change(input, { target: { files: [file] } })
    await waitFor(() => expect(storageMock.writeFile).toHaveBeenCalled())
    expect(storageMock.writeFile).toHaveBeenCalledWith('ebird', CSV, 'MyEBirdData.csv', { deviceId: 'a'.repeat(32), label: "Dave's Mac", platform: 'mac' })
    await waitFor(() => expect(actions.fileSaved).toHaveBeenCalledWith('ebird'))
  })
})

describe('copy (NFR-03, QA-40)', () => {
  it('no em dash in any iCloud Sync string or rendered text', async () => {
    const strings: string[] = [
      copy.ICS_HEADER, copy.ICS_DESCRIPTION, copy.STATUS_NEVER, copy.CHECK_FAILED_SUFFIX,
      copy.ENABLE_TITLE, copy.REMOVE_TITLE, copy.REMOVE_INTRO, copy.removeOutro('this Mac'),
      copy.clearTitle('eBird Backup'), copy.clearBody('this iPad'),
      ...Object.values(copy.AVAILABILITY_NOTES), ...Object.values(copy.STATE_LABELS),
      ...Object.values(copy.REASONS), ...Object.values(copy.BUTTONS),
      ...copy.enableNoteItems('this Mac').flatMap(i => [i.lead, i.text]),
      copy.announcerText({ ok: true, transferred: false }, 'now'), copy.announcerText({ ok: false, transferred: false }, null),
    ]
    for (const s of strings) expect(s).not.toContain('—')
    gate(true)
    setICloudState({ availability: 'available', syncEnabled: true, platform: 'mac', sharedExists: true, sharedFilenames: ['a.csv'] })
    setSlotView('ebird', { state: 'error', fromThisDevice: false, reason: copy.REASONS.unavailable })
    renderSettings()
    await screen.findByText('MyEBirdData.csv')
    expect(document.body.textContent).not.toContain('—')
  })

  it('iOS keeps the Import wording on the rows with the section present', async () => {
    vi.mocked(isTauri).mockReturnValue(true)
    vi.mocked(isIOS).mockReturnValue(true)
    vi.mocked(isMacOS).mockReturnValue(false)
    setICloudState({ availability: 'available', syncEnabled: true, platform: 'iphone' })
    renderSettings()
    await screen.findByRole('switch', { name: copy.ICS_HEADER })
    expect(screen.getAllByRole('button', { name: 'Import new…' }).length).toBe(2)
  })
})

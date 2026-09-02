// @vitest-environment jsdom
//
// Settings, the iCloud API key sync surface (icloud-api-key-sync; QA-01,
// QA-02, QA-04, QA-22, QA-23, QA-26, QA-29 to QA-32, QA-43 where
// unit-testable, QA-45). The component reads the REAL entry-safe state store
// (lib/icloud/icloudState.ts), driven here by setICloudState / setKeySlotView,
// with fake actions installed in place of the controller. jsdom has no layout
// engine, so the geometric claims (320px / 200%, AA contrast, the animations)
// stay with the browser QA pass; what is pinned here is gating, structure,
// semantics, copy, and wiring. A sentinel stands in for a key value and is
// asserted never to appear in the note, a confirmation, or a sync line.

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor, within, act } from '@testing-library/react'

const storageMock = vi.hoisted(() => ({
  getFilesStatus: vi.fn(),
  getApiKey: vi.fn(),
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
  installICloudActions, resetICloudState, setICloudState, setKeySlotView,
  type ICloudActions, type KeySlotView, type KeySlotState,
} from '../lib/icloud/icloudState'
import type { Slot } from '../lib/icloud/icloudRecord'
import type { KeySlot } from '../lib/icloud/keyRecord'
import { notifyKeysChanged } from '../lib/keysChanged'
import * as copy from '../lib/icloud/icloudCopy'

const FILES = {
  ebird: { filename: 'MyEBirdData.csv', uploadedAt: '2026-08-24T22:12:00.000Z' },
  ml: { filename: 'ML_2026-08-24_dave.csv', uploadedAt: '2026-08-24T22:20:00.000Z' },
}
const SENTINEL = 'SENTINELkey0xA1B2C3'
const T = '2026-09-01T15:02:00.000Z'
const ME = 'a'.repeat(32)

function fakeActions(): ICloudActions {
  return {
    enable: vi.fn(async () => {}),
    disable: vi.fn(async () => {}),
    checkNow: vi.fn(async () => ({ ok: true, transferred: false, at: '2026-09-01T16:14:00.000Z' })),
    downloadNow: vi.fn<(slot: Slot) => Promise<void>>(async () => {}),
    retry: vi.fn<(slot: Slot) => Promise<void>>(async () => {}),
    removeFromICloud: vi.fn(async () => {}),
    clearWithSync: vi.fn<(slot: Slot) => Promise<void>>(async () => {}),
    fileSaved: vi.fn<(slot: Slot) => void>(() => {}),
    enableKeys: vi.fn(async () => {}),
    disableKeys: vi.fn(async () => {}),
    removeKeysFromICloud: vi.fn(async () => {}),
    clearKeyWithSync: vi.fn<(slot: KeySlot) => Promise<void>>(async () => {}),
    retryKey: vi.fn<(slot: KeySlot) => Promise<void>>(async () => {}),
    keySaved: vi.fn<(slot: KeySlot) => void>(() => {}),
  }
}

let actions = fakeActions()
const onKeysSaved = vi.fn()

function gate(on: boolean) {
  vi.mocked(isTauri).mockReturnValue(on)
  vi.mocked(isMacOS).mockReturnValue(on)
  vi.mocked(isIOS).mockReturnValue(false)
}

function keys(ebird: string | null, openweather: string | null = null) {
  storageMock.getApiKey.mockImplementation(async (slot: string) => (slot === 'ebird' ? ebird : openweather))
}

function renderSettings() {
  return render(
    <Settings
      onKeysSaved={onKeysSaved}
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

const fileSwitch = () => screen.getByRole('switch', { name: copy.ICS_HEADER })
/** The eBird API KEY row's status region (the first `.sr-sync-line`; the key rows render above Default Files). */
function ebirdKeyLine(): HTMLElement {
  const lines = document.querySelectorAll<HTMLElement>('.sr-sync-line')
  expect(lines.length).toBe(4)
  return lines[0]
}
function keyRow(title: string): HTMLElement {
  return screen.getByText(title).closest('.sr-action-row') as HTMLElement
}
/** The whole KeyRow (the row plus its editor beneath it while editing). */
function keyEditor(title: string): HTMLElement {
  return keyRow(title).parentElement as HTMLElement
}

beforeEach(() => {
  resetICloudState()
  actions = fakeActions()
  installICloudActions(actions)
  onKeysSaved.mockClear()
  storageMock.getFilesStatus.mockResolvedValue({ ebird: FILES.ebird, ml: FILES.ml })
  storageMock.setApiKey.mockClear()
  storageMock.deleteApiKey.mockClear()
  keys(null)
})

afterEach(() => {
  cleanup()
  installICloudActions(null)
  gate(false)
})

describe('platform gate (FR-01, FR-45, QA-01)', () => {
  it('with the gate false there is no key switch, note, control, or key-row sync markup, and the key rows render exactly as before', async () => {
    gate(false)
    keys(SENTINEL)
    setICloudState({ availability: 'available', syncEnabled: true, keySyncEnabled: true, keyRecordExists: true, platform: 'mac' })
    setKeySlotView('ebird', { state: 'up-to-date', fromThisDevice: true, changedAt: T })
    renderSettings()
    await screen.findByText('MyEBirdData.csv')
    expect(screen.queryByRole('switch', { name: copy.KEY_SWITCH_LABEL })).toBeNull()
    expect(screen.queryByText(copy.KEY_SWITCH_DESCRIPTION)).toBeNull()
    expect(screen.queryByRole('button', { name: copy.BUTTONS.removeKeys })).toBeNull()
    expect(document.querySelector('.sr-sync-line')).toBeNull()
    expect(document.body.textContent).not.toContain('Sync API keys')
    expect(document.body.textContent).not.toContain('Up to date')
    // The value line still wraps through the class, and the masked value and Show are as before.
    expect(document.querySelector('.sr-key-line')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Show API key' })).toBeTruthy()
    expect(document.body.textContent).not.toContain(SENTINEL)
  })
})

describe('the key switch and its gating (FR-02, QA-02)', () => {
  it('iCloud available, file switch off: visible, off, aria-disabled (still focusable), reason "Turn on iCloud Sync first." associated; a click does nothing', async () => {
    gate(true)
    setICloudState({ availability: 'available', syncEnabled: false, platform: 'mac' })
    renderSettings()
    const sw = await screen.findByRole('switch', { name: copy.KEY_SWITCH_LABEL })
    expect(sw.getAttribute('aria-checked')).toBe('false')
    expect(sw.getAttribute('aria-disabled')).toBe('true')
    expect((sw as HTMLButtonElement).disabled).toBe(false)
    sw.focus()
    expect(document.activeElement).toBe(sw)
    const reason = screen.getByText(copy.KEY_SWITCH_REASON_FILE_SYNC_OFF)
    expect(reason.className).toContain('sr-ics-note')
    const described = (sw.getAttribute('aria-describedby') ?? '').split(' ')
    expect(described).toContain(reason.id)
    expect(document.getElementById(described[0])?.textContent).toBe(copy.KEY_SWITCH_DESCRIPTION)
    fireEvent.click(sw)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(actions.enableKeys).not.toHaveBeenCalled()
    // The label is its own element, in the sub-option register, above the
    // helper (the switch also carries an sr-only copy of the name, so locate
    // the visible one by its class).
    const label = document.querySelector<HTMLElement>('.sr-ics-key-label')!
    expect(label.textContent).toBe(copy.KEY_SWITCH_LABEL)
    expect(sw.getAttribute('aria-labelledby')).toBe(label.id)
    // The file switch is still named by the header and operable.
    expect((fileSwitch() as HTMLButtonElement).disabled).toBe(false)
  })

  it.each([
    ['not-signed-in'],
    ['drive-off-or-unauthorized'],
    ['build-cannot-use-icloud'],
  ] as const)('%s: the key switch is aria-disabled with NO second note; it is described by the file switch\'s availability note', async (state) => {
    gate(true)
    setICloudState({ availability: state, syncEnabled: true, keySyncEnabled: true, platform: 'mac' })
    renderSettings()
    const sw = await screen.findByRole('switch', { name: copy.KEY_SWITCH_LABEL })
    expect(sw.getAttribute('aria-disabled')).toBe('true')
    expect(sw.getAttribute('aria-checked')).toBe('true') // keeps its checked state while unavailable, like the file switch
    expect(screen.queryByText(copy.KEY_SWITCH_REASON_FILE_SYNC_OFF)).toBeNull()
    const noteEl = screen.getByText(copy.AVAILABILITY_NOTES[state])
    expect(screen.getAllByText(copy.AVAILABILITY_NOTES[state]).length).toBe(1) // said once
    const described = (sw.getAttribute('aria-describedby') ?? '').split(' ')
    expect(described).toContain(noteEl.id)
    fireEvent.click(sw)
    expect(actions.disableKeys).not.toHaveBeenCalled()
    expect(actions.enableKeys).not.toHaveBeenCalled()
  })

  it('before the controller loads (unknown) the key switch is aria-disabled with no reason', async () => {
    gate(true)
    renderSettings()
    const sw = await screen.findByRole('switch', { name: copy.KEY_SWITCH_LABEL })
    expect(sw.getAttribute('aria-disabled')).toBe('true')
    expect(screen.queryByText(copy.KEY_SWITCH_REASON_FILE_SYNC_OFF)).toBeNull()
  })

  it('file switch on and iCloud available: operable, no aria-disabled, described by its helper only', async () => {
    gate(true)
    setICloudState({ availability: 'available', syncEnabled: true, platform: 'mac' })
    renderSettings()
    const sw = await screen.findByRole('switch', { name: copy.KEY_SWITCH_LABEL })
    expect(sw.hasAttribute('aria-disabled')).toBe(false)
    expect(sw.getAttribute('aria-checked')).toBe('false')
    const described = (sw.getAttribute('aria-describedby') ?? '').split(' ')
    expect(described.length).toBe(1)
    expect(document.getElementById(described[0])?.textContent).toBe(copy.KEY_SWITCH_DESCRIPTION)
  })
})

describe('the enable note for keys (FR-04, QA-04) and turning off (FR-32)', () => {
  it('switching on opens the note with its six elements and the closing line; Cancel leaves the switch off and calls nothing; the sentinel never appears', async () => {
    gate(true)
    keys(SENTINEL, SENTINEL)
    setICloudState({ availability: 'available', syncEnabled: true, platform: 'mac' })
    renderSettings()
    const sw = await screen.findByRole('switch', { name: copy.KEY_SWITCH_LABEL })
    await screen.findAllByRole('button', { name: 'Show API key' })
    fireEvent.click(sw)
    const dialog = await screen.findByRole('dialog', { name: copy.ENABLE_KEYS_TITLE })
    const items = copy.enableKeysNoteItems('this Mac')
    expect(items.map(i => i.lead)).toEqual(['What goes to iCloud', 'Whose account', 'How Apple protects it', 'Which devices', 'What happens next', 'How to stop'])
    for (const item of items) {
      expect(within(dialog).getByText(item.lead)).toBeTruthy()
      expect(within(dialog).getByText(item.text)).toBeTruthy()
    }
    expect(within(dialog).getByText(copy.ENABLE_KEYS_FINE).className).toContain('sr-dlg-fine')
    expect(dialog.textContent).toContain('end-to-end encrypted only if Advanced Data Protection')
    expect(dialog.textContent).not.toContain(SENTINEL)
    expect(sw.getAttribute('aria-checked')).toBe('false')
    // Actions: Cancel then Turn on (the only accent fill).
    const buttons = within(dialog).getAllByRole('button')
    expect(buttons.map(b => b.textContent)).toEqual([copy.BUTTONS.cancel, copy.BUTTONS.turnOn])
    expect(buttons[1].className).toContain('sr-btn-accent')
    fireEvent.click(buttons[0])
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(actions.enableKeys).not.toHaveBeenCalled()
    expect(sw.getAttribute('aria-checked')).toBe('false')
  })

  it('Escape cancels the note and focus returns to the key switch; Turn on calls enableKeys exactly once and names the device word', async () => {
    gate(true)
    setICloudState({ availability: 'available', syncEnabled: true, platform: 'ipad' })
    renderSettings()
    const sw = await screen.findByRole('switch', { name: copy.KEY_SWITCH_LABEL })
    fireEvent.click(sw)
    await screen.findByRole('dialog', { name: copy.ENABLE_KEYS_TITLE })
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.activeElement).toBe(sw)
    expect(actions.enableKeys).not.toHaveBeenCalled()
    fireEvent.click(sw)
    const dialog = await screen.findByRole('dialog', { name: copy.ENABLE_KEYS_TITLE })
    expect(dialog.textContent).toContain('Settings and caches stay on this iPad.')
    expect(dialog.textContent).toContain('the keys on this iPad stay put')
    fireEvent.click(within(dialog).getByRole('button', { name: copy.BUTTONS.turnOn }))
    expect(actions.enableKeys).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('switching the key switch off needs no confirmation and never touches the file switch', async () => {
    gate(true)
    setICloudState({ availability: 'available', syncEnabled: true, keySyncEnabled: true, platform: 'mac' })
    renderSettings()
    const sw = await screen.findByRole('switch', { name: copy.KEY_SWITCH_LABEL })
    expect(sw.getAttribute('aria-checked')).toBe('true')
    fireEvent.click(sw)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(actions.disableKeys).toHaveBeenCalledTimes(1)
    expect(actions.disable).not.toHaveBeenCalled()
  })

  it('the file switch still turns off on its own (the cascade lives in the controller), and the file note carries the amended sentence', async () => {
    gate(true)
    setICloudState({ availability: 'available', syncEnabled: false, platform: 'mac' })
    renderSettings()
    fireEvent.click(await screen.findByRole('switch', { name: copy.ICS_HEADER }))
    const dialog = await screen.findByRole('dialog', { name: copy.ENABLE_TITLE })
    expect(dialog.textContent).toContain('and so do your API keys unless you also turn on Sync API keys.')
    expect(dialog.textContent).not.toContain('your API keys, settings and caches stay')
  })
})

describe('Remove synced keys from iCloud (FR-33, FR-34, FR-35, QA-28, QA-29)', () => {
  it('appears whenever iCloud holds a key record, switch on or off, beside the files control in one wrapping container; confirms by service and never by value', async () => {
    gate(true)
    keys(SENTINEL, SENTINEL)
    setICloudState({ availability: 'available', syncEnabled: true, keySyncEnabled: false, keyRecordExists: true, sharedExists: true, sharedFilenames: ['a.csv'], platform: 'mac' })
    renderSettings()
    const btn = await screen.findByRole('button', { name: copy.BUTTONS.removeKeys })
    const filesBtn = screen.getByRole('button', { name: copy.BUTTONS.remove })
    expect(btn.parentElement).toBe(filesBtn.parentElement)
    expect(btn.parentElement?.className).toContain('sr-ics-remove-actions')
    expect(btn.hasAttribute('aria-describedby')).toBe(false)
    expect(screen.queryByText(copy.KEY_REMOVAL_PENDING_TEXT)).toBeNull()
    fireEvent.click(btn)
    const dialog = await screen.findByRole('dialog', { name: copy.REMOVE_KEYS_TITLE })
    expect(within(dialog).getByText(copy.removeKeysBody('this Mac'))).toBeTruthy()
    expect(within(dialog).getByText(copy.REMOVE_KEYS_OUTRO)).toBeTruthy()
    expect(dialog.textContent).toContain('eBird key')
    expect(dialog.textContent).toContain('OpenWeather key')
    expect(dialog.textContent).not.toContain(SENTINEL)
    expect(within(dialog).queryByRole('listitem')).toBeNull() // no filenames: that is the files dialog
    fireEvent.click(within(dialog).getByRole('button', { name: copy.BUTTONS.removeConfirm }))
    expect(actions.removeKeysFromICloud).toHaveBeenCalledTimes(1)
    expect(actions.removeFromICloud).not.toHaveBeenCalled()
  })

  it('stays with the pending line, wired by aria-describedby, while a removal is pending; is absent with no record, no pending, or iCloud unavailable', async () => {
    gate(true)
    setICloudState({ availability: 'available', syncEnabled: true, keySyncEnabled: false, keyRecordExists: false, keyRemovalPending: true, platform: 'mac' })
    const { unmount } = renderSettings()
    const btn = await screen.findByRole('button', { name: copy.BUTTONS.removeKeys })
    const pending = screen.getByText(copy.KEY_REMOVAL_PENDING_TEXT)
    expect(pending.className).toContain('sr-ics-pending')
    expect(btn.getAttribute('aria-describedby')).toBe(pending.id)
    expect(screen.queryByRole('button', { name: copy.BUTTONS.remove })).toBeNull()
    unmount()
    setICloudState({ availability: 'available', syncEnabled: true, keySyncEnabled: true, keyRecordExists: false, keyRemovalPending: false, platform: 'mac' })
    const r2 = renderSettings()
    await screen.findByRole('switch', { name: copy.KEY_SWITCH_LABEL })
    expect(screen.queryByRole('button', { name: copy.BUTTONS.removeKeys })).toBeNull()
    r2.unmount()
    setICloudState({ availability: 'not-signed-in', syncEnabled: true, keySyncEnabled: true, keyRecordExists: true, platform: 'mac' })
    renderSettings()
    await screen.findByRole('switch', { name: copy.KEY_SWITCH_LABEL })
    expect(screen.queryByRole('button', { name: copy.BUTTONS.removeKeys })).toBeNull()
  })
})

describe('the key rows (FR-38 to FR-42, QA-30 to QA-32)', () => {
  const peer = { label: 'iPad', platform: 'ipad' as const }
  const named = { label: "Dave's MacBook Pro", platform: 'mac' as const }
  const views: Array<[KeySlotState, KeySlotView, RegExp]> = [
    ['up-to-date', { state: 'up-to-date', fromThisDevice: true, changedAt: T }, /From this device, changed /],
    ['syncing', { state: 'syncing', fromThisDevice: false, origin: peer, changedAt: T }, /From iPad, changed /],
    ['waiting-to-upload', { state: 'waiting-to-upload', fromThisDevice: true, changedAt: T }, /From this device, changed /],
    ['unavailable', { state: 'unavailable', fromThisDevice: false, origin: named, changedAt: T }, /From Dave's MacBook Pro \(Mac\), changed /],
    ['off', { state: 'off', fromThisDevice: false }, /^Sync off$/],
    ['error', { state: 'error', fromThisDevice: true, changedAt: T, reason: copy.KEY_REASONS['key-shape'] }, /characters iCloud sync cannot carry/],
  ]

  it.each(views)('%s renders its exact label as text in the row status region, with the glyph hidden', async (state, view, detail) => {
    gate(true)
    keys(SENTINEL)
    setICloudState({ availability: 'available', syncEnabled: true, keySyncEnabled: true, platform: 'mac' })
    setKeySlotView('ebird', view)
    renderSettings()
    await screen.findByRole('button', { name: 'Show API key' })
    await waitFor(() => expect(ebirdKeyLine().textContent).toContain(copy.KEY_STATE_LABELS[state]))
    expect(ebirdKeyLine().textContent).toMatch(detail)
    expect(ebirdKeyLine().querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    expect(ebirdKeyLine().textContent).not.toContain(SENTINEL)
    expect(ebirdKeyLine().getAttribute('role')).toBe('status')
  })

  it('never renders the file-only states on a key row, and a null view leaves the region mounted and empty', async () => {
    gate(true)
    keys(SENTINEL)
    setICloudState({ availability: 'available', syncEnabled: true, keySyncEnabled: true, platform: 'mac' })
    renderSettings()
    await screen.findByRole('button', { name: 'Show API key' })
    expect(ebirdKeyLine().textContent).toBe('')
    expect(document.body.textContent).not.toContain('In iCloud, not downloaded here')
    expect(screen.queryByRole('button', { name: copy.BUTTONS.downloadNow })).toBeNull()
    expect(Object.keys(copy.KEY_STATE_LABELS)).not.toContain('in-icloud-not-downloaded')
  })

  it('the FR-41 line takes the place of the provenance while set; the FR-42 line rides under Up to date on an empty row; the FR-30 sentence rides under Waiting to upload', async () => {
    gate(true)
    keys(SENTINEL, null)
    setICloudState({ availability: 'available', syncEnabled: true, keySyncEnabled: true, platform: 'mac' })
    setKeySlotView('ebird', { state: 'up-to-date', fromThisDevice: false, origin: peer, changedAt: T, replacedAt: T })
    setKeySlotView('openweather', { state: 'up-to-date', fromThisDevice: false, origin: { label: 'iPhone', platform: 'iphone' }, clearedAt: T })
    renderSettings()
    await screen.findByRole('button', { name: 'Show API key' })
    await waitFor(() => expect(ebirdKeyLine().textContent).toMatch(/Replaced by the key from iPad, changed /))
    expect(ebirdKeyLine().textContent).not.toContain('From iPad')
    const ow = document.querySelectorAll<HTMLElement>('.sr-sync-line')[1]
    await waitFor(() => expect(ow.textContent).toMatch(/Up to date.*Cleared from iPhone, /))
    // The empty row keeps "Not configured" and "No key saved".
    expect(within(keyRow('OpenWeather API Key')).getByText('Not configured')).toBeTruthy()
    expect(within(keyRow('OpenWeather API Key')).getByText('No key saved')).toBeTruthy()
    act(() => { setKeySlotView('openweather', { state: 'waiting-to-upload', fromThisDevice: true, clearPending: true }) })
    await waitFor(() => expect(ow.textContent).toContain(copy.CLEAR_PENDING_TEXT))
    expect(ow.textContent).toContain('Waiting to upload')
  })

  it('Retry is a real button wired to retryKey, and the region is the SAME element across a state change', async () => {
    gate(true)
    keys(SENTINEL)
    setICloudState({ availability: 'available', syncEnabled: true, keySyncEnabled: true, platform: 'mac' })
    setKeySlotView('ebird', { state: 'error', fromThisDevice: true, reason: copy.KEY_REASONS.timeout })
    renderSettings()
    const retry = await screen.findByRole('button', { name: copy.BUTTONS.retry })
    expect(retry.tabIndex).toBe(0)
    fireEvent.click(retry)
    expect(actions.retryKey).toHaveBeenCalledWith('ebird')
    const el = ebirdKeyLine()
    act(() => { setKeySlotView('ebird', { state: 'syncing', fromThisDevice: true, changedAt: T }) })
    await waitFor(() => expect(el.textContent).toContain('Syncing'))
    expect(ebirdKeyLine()).toBe(el)
  })

  it('a received key renders masked; Show reveals it and Hide re-masks it (FR-27, QA-22)', async () => {
    gate(true)
    keys(SENTINEL)
    setICloudState({ availability: 'available', syncEnabled: true, keySyncEnabled: true, platform: 'mac' })
    setKeySlotView('ebird', { state: 'up-to-date', fromThisDevice: false, origin: peer, changedAt: T })
    renderSettings()
    const show = await screen.findByRole('button', { name: 'Show API key' })
    expect(keyRow('eBird API Key').textContent).not.toContain(SENTINEL)
    fireEvent.click(show)
    expect(keyRow('eBird API Key').textContent).toContain(SENTINEL)
    fireEvent.click(screen.getByRole('button', { name: 'Hide API key' }))
    expect(keyRow('eBird API Key').textContent).not.toContain(SENTINEL)
    // The sync line itself never carries the value in either state.
    expect(ebirdKeyLine().textContent).not.toContain(SENTINEL)
  })

  it('re-reads the keys on the keys epoch, so a synced key shows without leaving the tab (FR-23)', async () => {
    gate(true)
    keys(null)
    setICloudState({ availability: 'available', syncEnabled: true, keySyncEnabled: true, platform: 'mac' })
    renderSettings()
    await screen.findAllByText('Not configured')
    keys(SENTINEL)
    act(() => { notifyKeysChanged() })
    await screen.findByRole('button', { name: 'Show API key' })
  })
})

describe('Clear and Save with the key switch on and off (FR-12, FR-28, FR-31, QA-23, QA-26)', () => {
  it('with the key switch on, Clear asks first, names the service and reach and no value, and routes through clearKeyWithSync', async () => {
    gate(true)
    keys(SENTINEL)
    setICloudState({ availability: 'available', syncEnabled: true, keySyncEnabled: true, platform: 'mac' })
    renderSettings()
    await screen.findByRole('button', { name: 'Show API key' })
    fireEvent.click(within(keyRow('eBird API Key')).getByRole('button', { name: 'Clear' }))
    const dialog = await screen.findByRole('dialog', { name: 'Clear eBird API Key?' })
    expect(within(dialog).getByText(copy.keyClearBody('ebird', 'this Mac'))).toBeTruthy()
    expect(dialog.textContent).toContain('Your eBird key will be removed from this Mac, from iCloud, and from every device sharing keys at its next check.')
    expect(dialog.textContent).not.toContain(SENTINEL)
    expect(storageMock.deleteApiKey).not.toHaveBeenCalled()
    fireEvent.click(within(dialog).getByRole('button', { name: copy.BUTTONS.cancel }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(actions.clearKeyWithSync).not.toHaveBeenCalled()
    fireEvent.click(within(keyRow('eBird API Key')).getByRole('button', { name: 'Clear' }))
    const again = await screen.findByRole('dialog', { name: 'Clear eBird API Key?' })
    fireEvent.click(within(again).getByRole('button', { name: copy.BUTTONS.clearConfirm }))
    expect(actions.clearKeyWithSync).toHaveBeenCalledWith('ebird')
    expect(storageMock.deleteApiKey).not.toHaveBeenCalled()
    // After the confirmed clear the row is empty and focus lands on Add key (Clear is now disabled).
    await waitFor(() => expect(within(keyRow('eBird API Key')).getByText('No key saved')).toBeTruthy())
    await waitFor(() => expect(document.activeElement).toBe(within(keyRow('eBird API Key')).getByRole('button', { name: 'Add key' })))
  })

  it('with the key switch off, Clear is today\'s instant local clear: no dialog, no marker, deleteApiKey', async () => {
    gate(true)
    keys(SENTINEL)
    setICloudState({ availability: 'available', syncEnabled: true, keySyncEnabled: false, platform: 'mac' })
    renderSettings()
    await screen.findByRole('button', { name: 'Show API key' })
    fireEvent.click(within(keyRow('eBird API Key')).getByRole('button', { name: 'Clear' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    await waitFor(() => expect(storageMock.deleteApiKey).toHaveBeenCalledWith('ebird'))
    expect(actions.clearKeyWithSync).not.toHaveBeenCalled()
    expect(onKeysSaved).toHaveBeenCalled()
  })

  it('a save stamps this device as the origin whenever a device id exists, and tells the controller only with the key switch on', async () => {
    gate(true)
    keys(null)
    setICloudState({ availability: 'available', syncEnabled: true, keySyncEnabled: true, deviceId: ME, deviceLabel: "Dave's Mac", platform: 'mac' })
    renderSettings()
    fireEvent.click((await screen.findAllByRole('button', { name: 'Add key' }))[0])
    const input = screen.getByLabelText('eBird API Key value')
    fireEvent.change(input, { target: { value: ` ${SENTINEL} ` } })
    fireEvent.click(within(keyEditor('eBird API Key')).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(storageMock.setApiKey).toHaveBeenCalledWith('ebird', SENTINEL, { deviceId: ME, label: "Dave's Mac", platform: 'mac' }))
    await waitFor(() => expect(actions.keySaved).toHaveBeenCalledWith('ebird'))
    expect(onKeysSaved).toHaveBeenCalled()
  })

  it('a save with the key switch OFF still stamps the origin (FR-12) but never calls keySaved', async () => {
    gate(true)
    keys(null)
    setICloudState({ availability: 'available', syncEnabled: true, keySyncEnabled: false, deviceId: ME, deviceLabel: '', platform: 'iphone' })
    renderSettings()
    fireEvent.click((await screen.findAllByRole('button', { name: 'Add key' }))[1])
    fireEvent.change(screen.getByLabelText('OpenWeather API Key value'), { target: { value: SENTINEL } })
    fireEvent.click(within(keyEditor('OpenWeather API Key')).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(storageMock.setApiKey).toHaveBeenCalledWith('openweather', SENTINEL, { deviceId: ME, label: 'iPhone', platform: 'iphone' }))
    expect(actions.keySaved).not.toHaveBeenCalled()
  })

  it('a save with no device id yet passes no origin', async () => {
    gate(true)
    keys(null)
    setICloudState({ availability: 'available', syncEnabled: false, deviceId: null, platform: 'mac' })
    renderSettings()
    fireEvent.click((await screen.findAllByRole('button', { name: 'Add key' }))[0])
    fireEvent.change(screen.getByLabelText('eBird API Key value'), { target: { value: SENTINEL } })
    fireEvent.click(within(keyEditor('eBird API Key')).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(storageMock.setApiKey).toHaveBeenCalledWith('ebird', SENTINEL, undefined))
  })
})

describe('copy (NFR-05, QA-45)', () => {
  it('no em dash in any key string or the rendered surface, and the reasons are a closed table', async () => {
    const strings: string[] = [
      copy.KEY_SWITCH_LABEL, copy.KEY_SWITCH_DESCRIPTION, copy.KEY_SWITCH_REASON_FILE_SYNC_OFF,
      copy.ENABLE_KEYS_TITLE, copy.ENABLE_KEYS_FINE, copy.REMOVE_KEYS_TITLE, copy.REMOVE_KEYS_OUTRO, copy.removeKeysBody('this Mac'),
      copy.CLEAR_PENDING_TEXT, copy.KEY_REMOVAL_PENDING_TEXT, copy.BUTTONS.removeKeys,
      copy.keyClearTitle('ebird'), copy.keyClearTitle('openweather'), copy.keyClearBody('openweather', 'this iPhone'),
      copy.fromChangedText(true, undefined, 'now'), copy.fromChangedText(false, { label: 'iPad', platform: 'ipad' }, 'now'),
      copy.keyReplacedText({ label: 'x', platform: 'mac' }, 'now'), copy.keyClearedText(undefined, 'now'),
      ...Object.values(copy.KEY_STATE_LABELS), ...Object.values(copy.KEY_REASONS),
      ...copy.enableKeysNoteItems('this Mac').flatMap(i => [i.lead, i.text]),
      ...copy.enableNoteItems('this Mac').flatMap(i => [i.lead, i.text]),
    ]
    for (const s of strings) expect(s).not.toContain('—')
    expect(copy.keyReasonFor('key-shape')).toBe('This key has characters iCloud sync cannot carry.')
    expect(copy.keyReasonFor('timeout')).toBe('iCloud did not respond in time.')
    expect(copy.keyReasonFor('unavailable')).toBe('iCloud could not be read.')
    expect(copy.keyReasonFor('mismatch')).toBe('iCloud could not be read.')
    gate(true)
    keys(SENTINEL)
    setICloudState({ availability: 'available', syncEnabled: true, keySyncEnabled: true, keyRecordExists: true, keyRemovalPending: true, platform: 'mac' })
    setKeySlotView('ebird', { state: 'error', fromThisDevice: true, reason: copy.KEY_REASONS.unknown })
    renderSettings()
    await screen.findByRole('button', { name: copy.BUTTONS.removeKeys })
    expect(document.body.textContent).not.toContain('—')
  })
})

// @vitest-environment jsdom
// The Targets tab's EBIRD BAR CHART section under icloud-bar-chart-sync
// (design-spec section 1; PRD FR-07, FR-10, FR-16; QA-08, QA-13, QA-14,
// QA-34). Off Apple and with sync off the section is what it was: Remove is
// instant and no sync line is drawn. With sync on, Remove confirms first and
// the confirmed removal hands the county to the controller; the sync line is
// ONE stable region fed by the controller's view of this county; a file in
// iCloud and not here says so in the title and offers Download now.
//
// WHAT THIS CANNOT SEE: the controller's pass itself (countySync.test.ts owns
// it) and layout (jsdom has none).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor, within, act } from '@testing-library/react'

const H = vi.hoisted(() => ({
  importBarChartFile: vi.fn(),
  removeBarChartFile: vi.fn(),
}))
vi.mock('../../lib/barChart/barChartImport', () => H)
vi.mock('../../lib/platform', () => ({
  isTauri: vi.fn(() => false),
  isIOS: vi.fn(() => false),
  isWindows: vi.fn(() => false),
  isMacOS: vi.fn(() => false),
}))
vi.mock('../../lib/openExternal', () => ({ openExternalUrl: vi.fn() }))

import { TargetsBarChartFile } from './TargetsBarChartFile'
import { isTauri, isMacOS } from '../../lib/platform'
import {
  installICloudActions, resetICloudState, setICloudState, setBarChartView, type ICloudActions,
} from '../../lib/icloud/icloudState'
import { BUTTONS, STATE_LABELS, removeCountyBody, removeCountyTitle } from '../../lib/icloud/icloudCopy'
import { ADD_FILE, ADD_FILE_SYNC_NOTE, REMOVE_FILE, addFileTitle, inICloudTitle } from '../../lib/targets/targetsCopy'
import type { BarChartState } from '../../lib/targets/useBarChartFile'

const R = 'US-CA-001'
const COUNTY = 'Alameda'
const DEVICE = 'a'.repeat(32)

const barChartsCleared = vi.fn<(codes: readonly string[], at: string) => Promise<void>>(async () => {})
const downloadBarChartNow = vi.fn<(code: string) => Promise<void>>(async () => {})
const retryBarChart = vi.fn<(code: string) => Promise<void>>(async () => {})
function actions(): ICloudActions {
  const noop = async () => {}
  return {
    enable: noop, disable: noop, checkNow: async () => ({ ok: true, transferred: false, at: null }),
    downloadNow: noop, retry: noop, removeFromICloud: noop, clearWithSync: async () => [], fileSaved: () => {},
    downloadBarChartNow, retryBarChart, barChartSaved: () => {}, barChartsCleared,
    enableKeys: noop, disableKeys: noop, removeKeysFromICloud: noop, clearKeyWithSync: noop, retryKey: noop, keySaved: () => {},
  }
}

const unreadable: BarChartState = { status: 'unreadable', meta: { filename: 'ebird_US-CA-001__2016_2026_1_12_barchart.txt', uploadedAt: '2026-09-20T12:00:00.000Z' } }
const absent: BarChartState = { status: 'absent' }

function mount(state: BarChartState) {
  return render(<TargetsBarChartFile regionCode={R} county={COUNTY} state={state} join={null} onRetry={vi.fn()} />)
}
function appleSyncOn() {
  vi.mocked(isTauri).mockReturnValue(true)
  vi.mocked(isMacOS).mockReturnValue(true)
  setICloudState({ availability: 'available', syncEnabled: true, platform: 'mac', deviceLabel: "Dave's Mac", deviceId: DEVICE })
}

beforeEach(() => {
  H.importBarChartFile.mockReset().mockResolvedValue({ ok: true })
  H.removeBarChartFile.mockReset().mockResolvedValue(undefined)
  barChartsCleared.mockClear()
  downloadBarChartNow.mockClear()
  retryBarChart.mockClear()
  resetICloudState()
  installICloudActions(actions())
})
afterEach(() => {
  cleanup()
  installICloudActions(null)
  vi.mocked(isTauri).mockReturnValue(false)
  vi.mocked(isMacOS).mockReturnValue(false)
})

describe('off Apple, and with sync off, the section is what it was (QA-08, QA-34)', () => {
  it('draws no sync line, no sync note, and Remove removes at once with no dialog and no marker', async () => {
    mount(unreadable)
    expect(document.querySelector('.sr-sync-line')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: REMOVE_FILE }))
    expect(screen.queryByRole('dialog')).toBeNull()
    await waitFor(() => expect(H.removeBarChartFile).toHaveBeenCalledWith(R))
    expect(barChartsCleared).not.toHaveBeenCalled()
  })

  it('on a Mac with sync OFF: the line region is mounted empty, Remove is still instant', async () => {
    vi.mocked(isTauri).mockReturnValue(true)
    vi.mocked(isMacOS).mockReturnValue(true)
    setICloudState({ availability: 'available', syncEnabled: false, platform: 'mac' })
    mount(absent)
    expect(screen.queryByText(ADD_FILE_SYNC_NOTE, { exact: false })).toBeNull()
    cleanup()
    mount(unreadable)
    const line = document.querySelector('.sr-sync-line')!
    expect(line.getAttribute('role')).toBe('status')
    expect(line.textContent).toBe('')
    fireEvent.click(screen.getByRole('button', { name: REMOVE_FILE }))
    expect(screen.queryByRole('dialog')).toBeNull()
    await waitFor(() => expect(H.removeBarChartFile).toHaveBeenCalledTimes(1))
    expect(barChartsCleared).not.toHaveBeenCalled()
  })

  it('an add with sync off records no origin', async () => {
    mount(absent)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['x'], 'ebird_US-CA-001__2016_2026_1_12_barchart.txt', { type: 'text/plain' })
    fireEvent.change(input, { target: { files: [file] } })
    await waitFor(() => expect(H.importBarChartFile).toHaveBeenCalledTimes(1))
    expect(H.importBarChartFile.mock.calls[0][4]).toBeUndefined()
  })
})

describe('with sync on, Remove confirms first (FR-10, QA-13)', () => {
  it('asks with the approved title and body, and Cancel removes nothing', async () => {
    appleSyncOn()
    mount(unreadable)
    fireEvent.click(screen.getByRole('button', { name: REMOVE_FILE }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(removeCountyTitle(COUNTY))).toBeTruthy()
    expect(within(dialog).getByText(removeCountyBody(COUNTY, 'this Mac'))).toBeTruthy()
    expect(removeCountyBody(COUNTY, 'this Mac')).toBe(
      'The file for Alameda will be removed from this Mac and from iCloud. Every Mac, iPhone and iPad with iCloud Sync on removes its copy at its next check. Devices with sync off keep theirs.',
    )
    fireEvent.click(within(dialog).getByRole('button', { name: BUTTONS.cancel }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(H.removeBarChartFile).not.toHaveBeenCalled()
    expect(barChartsCleared).not.toHaveBeenCalled()
  })

  it('confirmed: removes locally, THEN hands the county to barChartsCleared with one ISO time', async () => {
    appleSyncOn()
    mount(unreadable)
    fireEvent.click(screen.getByRole('button', { name: REMOVE_FILE }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: BUTTONS.removeAllSynced }))
    await waitFor(() => expect(barChartsCleared).toHaveBeenCalledTimes(1))
    expect(H.removeBarChartFile).toHaveBeenCalledWith(R)
    const [codes, at] = barChartsCleared.mock.calls[0]
    expect(codes).toEqual([R])
    expect(new Date(at).toISOString()).toBe(at)
    expect(H.removeBarChartFile.mock.invocationCallOrder[0]).toBeLessThan(barChartsCleared.mock.invocationCallOrder[0])
  })

  it('a local removal that fails asks for no marker, and says so in the alert', async () => {
    appleSyncOn()
    H.removeBarChartFile.mockRejectedValue(new Error('EIO'))
    mount(unreadable)
    fireEvent.click(screen.getByRole('button', { name: REMOVE_FILE }))
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: BUTTONS.removeAllSynced }))
    await waitFor(() => expect(document.querySelector('.sr-tg-alert')!.textContent).not.toBe(''))
    expect(barChartsCleared).not.toHaveBeenCalled()
  })

  // FOCUS AFTER A CONFIRMED REMOVE lands on Add file (design-spec section 1,
  // "focus returns to the Add file button"), in every order the three things
  // that follow the confirm can land in: the local removal settling, the card
  // re-rendering to absent (the parent's manifest re-read), and the dialog's
  // close transition ending, which is when ModalDialog picks where focus goes.
  // Build 1's QA recorded the second row as a Known Limitation: the dialog
  // found Remove still mounted and enabled, focused it, and focus fell to
  // <body> when the card then went absent; it is the row that fails without
  // the fix. The third is the same defect one step earlier (mid-removal,
  // Remove and its fallback are both disabled) and passes here without the
  // fix only because jsdom leaves focus on the Replace button while it is
  // disabled, where a browser drops it, and React reuses that element as Add
  // file; it is kept so the fix is held to that order too.
  const ORDERS = [
    { order: 'removal, then absent, then the dialog closes (the usual order)', closeFirst: false, holdRemoval: false },
    { order: 'removal, then the dialog closes, then absent', closeFirst: true, holdRemoval: false },
    { order: 'the dialog closes mid-removal, then removal, then absent', closeFirst: true, holdRemoval: true },
  ]
  it.each(ORDERS)('focus lands on Add file when $order', async ({ closeFirst, holdRemoval }) => {
    appleSyncOn()
    let settle: () => void = () => {}
    if (holdRemoval) H.removeBarChartFile.mockImplementation(() => new Promise<void>(r => { settle = r }))
    const view = mount(unreadable)
    const remove = screen.getByRole('button', { name: REMOVE_FILE })
    remove.focus()
    fireEvent.click(remove)
    const dialog = await screen.findByRole('dialog')
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true))
    fireEvent.click(within(dialog).getByRole('button', { name: BUTTONS.removeAllSynced }))
    await waitFor(() => expect(H.removeBarChartFile).toHaveBeenCalledTimes(1))
    const toAbsent = () => view.rerender(<TargetsBarChartFile regionCode={R} county={COUNTY} state={absent} join={null} onRetry={vi.fn()} />)
    if (closeFirst) {
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
      // The window: the dialog is gone and the card still shows the file.
      expect(screen.getByRole('button', { name: REMOVE_FILE })).toBeTruthy()
      if (holdRemoval) {
        await act(async () => { settle() })
        await waitFor(() => expect((screen.getByRole('button', { name: REMOVE_FILE }) as HTMLButtonElement).disabled).toBe(false))
      }
      toAbsent()
    } else {
      await waitFor(() => expect(barChartsCleared).toHaveBeenCalledTimes(1))
      expect(screen.getByRole('dialog')).toBeTruthy()
      toAbsent()
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    }
    const add = screen.getByRole('button', { name: ADD_FILE })
    await waitFor(() => expect(document.activeElement).toBe(add))
  })

  it('the late move never takes focus from somewhere the user went before the card went absent', async () => {
    appleSyncOn()
    const elsewhere = document.createElement('button')
    elsewhere.textContent = 'elsewhere'
    document.body.appendChild(elsewhere)
    try {
      const view = mount(unreadable)
      fireEvent.click(screen.getByRole('button', { name: REMOVE_FILE }))
      const dialog = await screen.findByRole('dialog')
      await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true))
      fireEvent.click(within(dialog).getByRole('button', { name: BUTTONS.removeAllSynced }))
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
      elsewhere.focus()
      view.rerender(<TargetsBarChartFile regionCode={R} county={COUNTY} state={absent} join={null} onRetry={vi.fn()} />)
      await screen.findByRole('button', { name: ADD_FILE })
      await act(async () => {})
      expect(document.activeElement).toBe(elsewhere)
    } finally {
      elsewhere.remove()
    }
  })

  it('an add with sync on records this device as the origin (FR-07)', async () => {
    appleSyncOn()
    mount(absent)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [new File(['x'], 'ebird_US-CA-001__2016_2026_1_12_barchart.txt')] } })
    await waitFor(() => expect(H.importBarChartFile).toHaveBeenCalledTimes(1))
    expect(H.importBarChartFile.mock.calls[0][4]).toEqual({ deviceId: DEVICE, label: "Dave's Mac", platform: 'mac' })
  })
})

describe('the sync line and the in-iCloud title (FR-16, QA-14)', () => {
  it('with sync on and nothing here: the add title with the sync note', () => {
    appleSyncOn()
    mount(absent)
    expect(screen.getByText(addFileTitle(COUNTY))).toBeTruthy()
    expect(screen.getByText(ADD_FILE_SYNC_NOTE, { exact: false })).toBeTruthy()
    expect(screen.getByRole('button', { name: ADD_FILE })).toBeTruthy()
  })

  it('in iCloud and not here: the in-iCloud title, no sync note, Download now calls the controller, and adding stays offered', async () => {
    appleSyncOn()
    setBarChartView(R, { state: 'in-icloud-not-downloaded', fromThisDevice: false, origin: { label: 'iPhone', platform: 'iphone' }, uploadedAt: '2026-09-20T12:00:00.000Z' })
    mount(absent)
    expect(screen.getByText(inICloudTitle(COUNTY))).toBeTruthy()
    expect(inICloudTitle(COUNTY)).toBe('A bar-chart file for Alameda is in iCloud')
    expect(screen.queryByText(ADD_FILE_SYNC_NOTE, { exact: false })).toBeNull()
    await screen.findByText(STATE_LABELS['in-icloud-not-downloaded'])
    fireEvent.click(screen.getByRole('button', { name: BUTTONS.downloadNow }))
    expect(downloadBarChartNow).toHaveBeenCalledWith(R)
    expect(screen.getByRole('button', { name: ADD_FILE })).toBeTruthy()
  })

  it('the line keeps ONE element across state changes (never remounted), and an error offers Retry', async () => {
    appleSyncOn()
    setBarChartView(R, { state: 'uploading', fromThisDevice: true })
    const { rerender } = mount(unreadable)
    await screen.findByText(STATE_LABELS.uploading)
    const line = document.querySelector('.sr-sync-line')!
    act(() => setBarChartView(R, { state: 'error', fromThisDevice: true, reason: 'The file in iCloud is too large to sync.' }))
    await screen.findByText(STATE_LABELS.error)
    expect(document.querySelector('.sr-sync-line')).toBe(line)
    // A state change of the section itself (unreadable -> absent) keeps it too.
    rerender(<TargetsBarChartFile regionCode={R} county={COUNTY} state={absent} join={null} onRetry={vi.fn()} />)
    expect(document.querySelector('.sr-sync-line')).toBe(line)
    fireEvent.click(screen.getByRole('button', { name: BUTTONS.retry }))
    expect(retryBarChart).toHaveBeenCalledWith(R)
    expect(screen.getByText('The file in iCloud is too large to sync.')).toBeTruthy()
  })

  it('reads another county\'s view never, and a prototype-chain region code reads no view', () => {
    appleSyncOn()
    setBarChartView('US-NY-005', { state: 'up-to-date', fromThisDevice: true })
    mount(unreadable)
    expect(document.querySelector('.sr-sync-line')!.textContent).toBe('')
    cleanup()
    render(<TargetsBarChartFile regionCode="constructor" county={COUNTY} state={absent} join={null} onRetry={vi.fn()} />)
    expect(document.querySelector('.sr-sync-line')!.textContent).toBe('')
    expect(screen.getByText(addFileTitle(COUNTY))).toBeTruthy()
  })
})

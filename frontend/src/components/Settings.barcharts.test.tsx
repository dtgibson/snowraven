// @vitest-environment jsdom
// Settings -> Bar-chart files (icloud-bar-chart-sync FR-19 to FR-23; PRD
// QA-17, QA-18, QA-19, QA-34) and the Remove synced files confirmation's new
// lines (FR-13, FR-27; QA-11). Every sentence is asserted against the approved
// copy builders (design-spec Copy table, items 3 and 12 to 23), and the
// always-mounted live regions are asserted present, empty, from first paint.
//
// WHAT THIS CANNOT SEE: layout (jsdom has none), the accessibility tree, and
// WebKit's tab order; the 320px / 200% claims belong to the browser-verified
// stage. The section's position among the others is settingsSectionOrder.test.tsx's.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react'

const H = vi.hoisted(() => ({
  counties: {} as Record<string, { filename: string; uploadedAt: string }>,
  reject: false,
  clearAll: vi.fn(),
}))
const storageMock = vi.hoisted(() => ({
  getBarChartFiles: vi.fn(),
  getFilesStatus: vi.fn().mockResolvedValue({ ebird: null, ml: null }),
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
vi.mock('../lib/barChart/barChartImport', () => ({ clearAllBarChartFiles: H.clearAll }))

import { Settings } from './Settings'
import { isTauri, isMacOS } from '../lib/platform'
import { DEFAULT_TAB_ORDER } from '../lib/tabLayout'
import type { ConfigurableTab } from '../lib/tabLayout'
import { installICloudActions, resetICloudState, setICloudState, icloudActions, type ICloudActions } from '../lib/icloud/icloudState'
import * as copy from '../lib/icloud/icloudCopy'

const barChartsCleared = vi.fn<(codes: readonly string[], at: string) => Promise<void>>(async () => {})
function actions(): ICloudActions {
  const noop = async () => {}
  return {
    enable: noop, disable: noop, checkNow: async () => ({ ok: true, transferred: false, at: null }),
    downloadNow: noop, retry: noop, removeFromICloud: noop, clearWithSync: async () => [], fileSaved: () => {},
    downloadBarChartNow: noop, retryBarChart: noop, barChartSaved: () => {}, barChartsCleared,
    enableKeys: noop, disableKeys: noop, removeKeysFromICloud: noop, clearKeyWithSync: noop, retryKey: noop, keySaved: () => {},
  }
}

function renderSettings() {
  return render(
    <Settings
      onOpenHelp={vi.fn()} textScale={1} onTextScaleChange={vi.fn()}
      tabOrder={[...DEFAULT_TAB_ORDER]} tabHidden={new Set<ConfigurableTab>()}
      onReorder={vi.fn()} onToggleVisibility={vi.fn()} onRestoreDefaults={vi.fn()}
      disableEmbeddedMedia={false} embeddedMediaPreferenceSaving={false} embeddedMediaPreferenceError={null}
      onDisableEmbeddedMediaChange={vi.fn()}
    />,
  )
}

const THREE = {
  'US-CA-001': { filename: 'a.txt', uploadedAt: '2026-09-20T12:05:00.000Z' },
  'US-CA-013': { filename: 'b.txt', uploadedAt: '2026-09-20T12:05:00.000Z' },
  'US-NY-005': { filename: 'c.txt', uploadedAt: '2026-09-20T12:05:00.000Z' },
}

beforeEach(() => {
  H.counties = {}
  H.reject = false
  H.clearAll.mockReset()
  barChartsCleared.mockClear()
  storageMock.getBarChartFiles.mockReset().mockImplementation(async () => {
    if (H.reject) throw new Error('EIO')
    return { version: 1, counties: { ...H.counties } }
  })
  resetICloudState()
  installICloudActions(actions())
})
afterEach(() => {
  cleanup()
  installICloudActions(null)
  vi.mocked(isTauri).mockReturnValue(false)
  vi.mocked(isMacOS).mockReturnValue(false)
})

const button = () => screen.getByRole('button', { name: copy.REMOVE_ALL_BAR_CHARTS })

describe('the control and its status (FR-19, FR-21, QA-18)', () => {
  it('names how many counties have a file on this device, as the button\'s description, and the live regions are mounted empty', async () => {
    H.counties = { ...THREE }
    renderSettings()
    await screen.findByText(copy.barChartsSavedText(3, 'this device'))
    expect(screen.getByText(copy.BAR_CHART_FILES_HEADER)).toBeTruthy()
    expect(screen.getByText(copy.BAR_CHART_FILES_DESCRIPTION)).toBeTruthy()
    const b = button()
    expect(b.getAttribute('aria-disabled')).toBeNull()
    expect(b.hasAttribute('disabled')).toBe(false)
    expect(document.getElementById(b.getAttribute('aria-describedby')!)!.textContent).toBe('Saved for 3 counties on this device.')
    const alert = document.querySelector('.sr-chartfiles-alert')!
    const done = document.querySelector('.sr-chartfiles-done')!
    expect(alert.getAttribute('role')).toBe('alert')
    expect(done.getAttribute('role')).toBe('status')
    expect(alert.textContent).toBe('')
    expect(done.textContent).toBe('')
  })

  it('with no saved files the button stays focusable, is aria-disabled with its reason, and cannot be activated by click or key', async () => {
    renderSettings()
    await screen.findByText(copy.barChartsNoneText('this device'))
    const b = button()
    expect(b.getAttribute('aria-disabled')).toBe('true')
    expect(b.hasAttribute('disabled')).toBe(false)
    expect(b.getAttribute('tabindex')).toBe('0')
    expect(document.getElementById(b.getAttribute('aria-describedby')!)!.textContent).toBe('No bar-chart files are saved on this device.')
    fireEvent.click(b)
    fireEvent.keyDown(b, { key: 'Enter' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('a manifest the seam cannot read is UNKNOWN, never "none saved": the reason and Retry, and the button cannot act', async () => {
    H.reject = true
    renderSettings()
    await screen.findByText(copy.barChartsUnknownText('this device'))
    expect(screen.queryByText(copy.barChartsNoneText('this device'))).toBeNull()
    expect(button().getAttribute('aria-disabled')).toBe('true')
    H.reject = false
    H.counties = { 'US-CA-001': THREE['US-CA-001'] }
    fireEvent.click(screen.getByRole('button', { name: copy.BUTTONS.retry }))
    await screen.findByText(copy.barChartsSavedText(1, 'this device'))
    expect(screen.getByText('Saved for 1 county on this device.')).toBeTruthy()
  })
})

describe('it always confirms, and says what goes and from where (FR-20, D2, QA-17)', () => {
  it('sync off (every non-Apple platform): the local body, "Remove all", and Cancel removes nothing', async () => {
    H.counties = { ...THREE }
    renderSettings()
    await screen.findByText(copy.barChartsSavedText(3, 'this device'))
    fireEvent.click(button())
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(copy.REMOVE_ALL_BAR_CHARTS_TITLE)).toBeTruthy()
    expect(within(dialog).getByText('Bar-chart files for 3 counties will be removed from this device. Your eBird backup, ML export and API keys are not touched.')).toBeTruthy()
    expect(within(dialog).getByRole('button', { name: copy.REMOVE_ALL_CONFIRM })).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: copy.BUTTONS.cancel }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(H.clearAll).not.toHaveBeenCalled()
  })

  it('Escape closes it with nothing removed', async () => {
    H.counties = { ...THREE }
    renderSettings()
    await screen.findByText(copy.barChartsSavedText(3, 'this device'))
    fireEvent.click(button())
    await screen.findByRole('dialog')
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(H.clearAll).not.toHaveBeenCalled()
  })

  it('one county takes the singular subject', async () => {
    H.counties = { 'US-CA-001': THREE['US-CA-001'] }
    renderSettings()
    await screen.findByText('Saved for 1 county on this device.')
    fireEvent.click(button())
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('The bar-chart file for 1 county will be removed from this device. Your eBird backup, ML export and API keys are not touched.')).toBeTruthy()
  })

  it('sync on and available: the body names iCloud and the other devices, and the button says so', async () => {
    vi.mocked(isTauri).mockReturnValue(true)
    vi.mocked(isMacOS).mockReturnValue(true)
    setICloudState({ availability: 'available', syncEnabled: true, platform: 'mac', deviceLabel: "Dave's Mac", deviceId: 'a'.repeat(32) })
    H.counties = { ...THREE }
    renderSettings()
    await screen.findByText(copy.barChartsSavedText(3, 'this Mac'))
    fireEvent.click(button())
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(copy.removeAllBarChartsBody(3, 'this Mac', true))).toBeTruthy()
    expect(copy.removeAllBarChartsBody(3, 'this Mac', true)).toBe(
      'Bar-chart files for 3 counties will be removed from this Mac and from iCloud. Every Mac, iPhone and iPad with iCloud Sync on removes its copies at its next check. Devices with sync off keep theirs. Your eBird backup, ML export and API keys are not touched.',
    )
    expect(within(dialog).getByRole('button', { name: copy.BUTTONS.removeAllSynced })).toBeTruthy()
  })
})

describe('the effect (FR-21, FR-22, FR-23, QA-18, QA-19, QA-34)', () => {
  it('confirmed: removes every file, says so once, re-reads to the cannot-act state, and returns focus to the button', async () => {
    H.counties = { ...THREE }
    H.clearAll.mockImplementation(async () => {
      H.counties = {}
      return { removed: Object.keys(THREE), failed: [] }
    })
    renderSettings()
    await screen.findByText(copy.barChartsSavedText(3, 'this device'))
    fireEvent.click(button())
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: copy.REMOVE_ALL_CONFIRM }))
    await screen.findByText(copy.removeAllDoneText(3))
    expect(copy.removeAllDoneText(3)).toBe('Removed bar-chart files for 3 counties.')
    expect(document.querySelector('.sr-chartfiles-done')!.textContent).toBe('Removed bar-chart files for 3 counties.')
    await screen.findByText(copy.barChartsNoneText('this device'))
    expect(button().getAttribute('aria-disabled')).toBe('true')
    await waitFor(() => expect(document.activeElement).toBe(button()))
    // Sync off: no marker is asked for.
    expect(barChartsCleared).not.toHaveBeenCalled()
    expect(H.clearAll).toHaveBeenCalledTimes(1)
  })

  it('with sync on the removed counties go to barChartsCleared, the survivors do not', async () => {
    vi.mocked(isTauri).mockReturnValue(true)
    vi.mocked(isMacOS).mockReturnValue(true)
    setICloudState({ availability: 'available', syncEnabled: true, platform: 'mac', deviceLabel: "Dave's Mac", deviceId: 'a'.repeat(32) })
    H.counties = { ...THREE }
    H.clearAll.mockImplementation(async () => ({ removed: ['US-CA-001', 'US-NY-005'], failed: ['US-CA-013'] }))
    renderSettings()
    await screen.findByText(copy.barChartsSavedText(3, 'this Mac'))
    fireEvent.click(button())
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: copy.BUTTONS.removeAllSynced }))
    await screen.findByText(copy.removeAllPartialText(1, 'this Mac'))
    expect(barChartsCleared).toHaveBeenCalledTimes(1)
    expect(barChartsCleared.mock.calls[0][0]).toEqual(['US-CA-001', 'US-NY-005'])
  })

  it('a partial failure says how many remain, in the alert region, singular at one', async () => {
    H.counties = { ...THREE }
    H.clearAll.mockImplementation(async () => {
      H.counties = { 'US-CA-013': THREE['US-CA-013'] }
      return { removed: ['US-CA-001', 'US-NY-005'], failed: ['US-CA-013'] }
    })
    renderSettings()
    await screen.findByText(copy.barChartsSavedText(3, 'this device'))
    fireEvent.click(button())
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: copy.REMOVE_ALL_CONFIRM }))
    await screen.findByText('The bar-chart file for 1 county could not be removed and remains on this device. Try again.')
    expect(document.querySelector('.sr-chartfiles-alert')!.textContent).toBe('The bar-chart file for 1 county could not be removed and remains on this device. Try again.')
    // The status re-read describes exactly the survivor, and the button can act again.
    await screen.findByText('Saved for 1 county on this device.')
    expect(button().getAttribute('aria-disabled')).toBeNull()
    expect(copy.removeAllPartialText(2, 'this device')).toBe('Bar-chart files for 2 counties could not be removed and remain on this device. Try again.')
  })

  it('a refused removal reports what the manifest still lists, never a success', async () => {
    H.counties = { ...THREE }
    H.clearAll.mockImplementation(async () => { throw new Error('File delete failed (500)') })
    renderSettings()
    await screen.findByText(copy.barChartsSavedText(3, 'this device'))
    fireEvent.click(button())
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: copy.REMOVE_ALL_CONFIRM }))
    await screen.findByText(copy.removeAllPartialText(3, 'this device'))
    expect(document.querySelector('.sr-chartfiles-done')!.textContent).toBe('')
  })

  it('the section touches bar-chart files only: no data file, key or setting is written or removed', async () => {
    H.counties = { ...THREE }
    H.clearAll.mockImplementation(async () => ({ removed: Object.keys(THREE), failed: [] }))
    renderSettings()
    await screen.findByText(copy.barChartsSavedText(3, 'this device'))
    fireEvent.click(button())
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: copy.REMOVE_ALL_CONFIRM }))
    await screen.findByText(copy.removeAllDoneText(3))
    for (const m of [storageMock.deleteFile, storageMock.writeFile, storageMock.deleteApiKey, storageMock.setApiKey, storageMock.deleteSetting]) {
      expect(m).not.toHaveBeenCalled()
    }
    expect(icloudActions).toBeTruthy()
  })
})

describe('Remove synced files from iCloud counts the county files and names the day answers (FR-13, FR-27, item 3)', () => {
  it('lists the two filenames, then one counted county line, then the day answers', async () => {
    vi.mocked(isTauri).mockReturnValue(true)
    vi.mocked(isMacOS).mockReturnValue(true)
    setICloudState({
      availability: 'available', syncEnabled: true, platform: 'mac', deviceLabel: "Dave's Mac",
      sharedExists: true, sharedFilenames: ['MyEBirdData.csv'], sharedCountyCodes: ['US-CA-001', 'US-CA-013', 'US-NY-005'], sharedDayObsExists: true,
    })
    renderSettings()
    fireEvent.click(await screen.findByRole('button', { name: copy.BUTTONS.remove }))
    const dialog = await screen.findByRole('dialog')
    const items = [...dialog.querySelectorAll('.sr-dlg-files li')].map(li => li.textContent)
    expect(items).toEqual(['MyEBirdData.csv', 'Bar-chart files for 3 counties', "The Targets tab's saved day-by-day eBird answers"])
    expect(copy.removeCountiesLine(1)).toBe('The bar-chart file for 1 county')
  })

  it('with no county files and no day answers the list is the filenames alone, as before', async () => {
    vi.mocked(isTauri).mockReturnValue(true)
    vi.mocked(isMacOS).mockReturnValue(true)
    setICloudState({ availability: 'available', syncEnabled: true, platform: 'mac', sharedExists: true, sharedFilenames: ['MyEBirdData.csv'] })
    renderSettings()
    fireEvent.click(await screen.findByRole('button', { name: copy.BUTTONS.remove }))
    const dialog = await screen.findByRole('dialog')
    expect([...dialog.querySelectorAll('.sr-dlg-files li')].map(li => li.textContent)).toEqual(['MyEBirdData.csv'])
  })
})

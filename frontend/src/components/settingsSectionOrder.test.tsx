// @vitest-environment jsdom
//
// Settings → section order (settings-section-order).
//
// The property: the two sections the tab exists for lead it (API Keys, then
// Default Files), iCloud Sync travels directly below Default Files where the
// platform gate renders it, and everything below that pair keeps its previous
// relative sequence, ending with Acknowledgments on every platform.
//
// Why a file of its own rather than rows added to the two guards that already
// touch order: `Settings.icloud.test.tsx` pins Default Files < iCloud Sync <
// Default Location and `SettingsAcknowledgments.test.tsx` pins Acknowledgments
// last, and both had to pass UNMODIFIED through this reorder — that was the
// evidence the reorder was right. Neither states the whole sequence, and
// "directly below Default Files" (the sentence docs/HELP.md publishes) is
// strictly stronger than the `<` chain, which stays satisfied with sections
// inserted between. This file asserts the full sequence, so a later edit that
// moves a section has to say so here.
//
// jsdom has no layout engine; the brief's spacing claim (every block is a
// self-contained unit ending in a 24px bottom margin, so the order is
// spacing-neutral) is a stylesheet/browser matter and is not asserted here.

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

const storageMock = vi.hoisted(() => ({
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

import { Settings } from './Settings'
import { isTauri, isIOS, isMacOS } from '../lib/platform'
import { DEFAULT_TAB_ORDER } from '../lib/tabLayout'
import type { ConfigurableTab } from '../lib/tabLayout'
import {
  installICloudActions, resetICloudState, setICloudState, type ICloudActions,
} from '../lib/icloud/icloudState'
import type { Slot } from '../lib/icloud/icloudRecord'
import type { KeySlot } from '../lib/icloud/keyRecord'
import { ICS_HEADER } from '../lib/icloud/icloudCopy'

function fakeActions(): ICloudActions {
  return {
    enable: vi.fn(async () => {}),
    disable: vi.fn(async () => {}),
    checkNow: vi.fn(async () => ({ ok: true, transferred: false, at: null })),
    downloadNow: vi.fn<(slot: Slot) => Promise<void>>(async () => {}),
    retry: vi.fn<(slot: Slot) => Promise<void>>(async () => {}),
    removeFromICloud: vi.fn(async () => {}),
    clearWithSync: vi.fn<(slot: Slot) => Promise<readonly string[]>>(async () => []),
    fileSaved: vi.fn<(slot: Slot) => void>(() => {}),
    enableKeys: vi.fn(async () => {}),
    disableKeys: vi.fn(async () => {}),
    removeKeysFromICloud: vi.fn(async () => {}),
    clearKeyWithSync: vi.fn<(slot: KeySlot) => Promise<void>>(async () => {}),
    retryKey: vi.fn<(slot: KeySlot) => Promise<void>>(async () => {}),
    keySaved: vi.fn<(slot: KeySlot) => void>(() => {}),
  }
}

beforeEach(() => {
  resetICloudState()
  installICloudActions(fakeActions())
})

afterEach(() => {
  cleanup()
  installICloudActions(null)
  vi.mocked(isTauri).mockReturnValue(false)
  vi.mocked(isIOS).mockReturnValue(false)
  vi.mocked(isMacOS).mockReturnValue(false)
})

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

/** Every section header in the panel, in document order.
 *
 *  Section headers are the only spans in Settings carrying the uppercase +
 *  0.07em letter-spacing signature — the shared `SectionHeader` plus the three
 *  inline copies of it (Tab Layout, Default Location, Troubleshooting) — so one
 *  selector finds all of them regardless of which component drew them. If a
 *  future header stops matching, this list goes SHORT rather than wrong, which
 *  the explicit sequences below turn red; the length assertions are there so a
 *  header that silently drops out cannot pass as a reorder. */
function sectionHeaders(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll<HTMLElement>('span'))
    .filter(s => s.style.textTransform === 'uppercase' && s.style.letterSpacing === '0.07em')
    .map(s => (s.textContent ?? '').trim())
}

const BELOW_THE_PAIR = ['Help & Documentation', 'Appearance', 'Sharing', 'Default Location', 'Tab Layout'] as const

describe('Settings section order (settings-section-order)', () => {
  it('web/Pi: API Keys and Default Files lead the tab, Acknowledgments closes it', async () => {
    const { container } = renderSettings()
    await screen.findByText('eBird API Key')
    expect(sectionHeaders(container)).toEqual([
      'API Keys', 'Default Files', ...BELOW_THE_PAIR, 'Acknowledgments',
    ])
    // Gated markup, never hidden markup: neither platform-gated section exists.
    expect(screen.queryByText(ICS_HEADER)).toBeNull()
    expect(screen.queryByText('Troubleshooting')).toBeNull()
  })

  it('Windows desktop: the same order with Troubleshooting inserted above Acknowledgments', async () => {
    vi.mocked(isTauri).mockReturnValue(true)
    const { container } = renderSettings()
    await screen.findByText('eBird API Key')
    expect(sectionHeaders(container)).toEqual([
      'API Keys', 'Default Files', ...BELOW_THE_PAIR, 'Troubleshooting', 'Acknowledgments',
    ])
    expect(screen.queryByText(ICS_HEADER)).toBeNull()
  })

  it('Mac/iPhone/iPad: iCloud Sync sits DIRECTLY below Default Files, above everything else', async () => {
    vi.mocked(isTauri).mockReturnValue(true)
    vi.mocked(isMacOS).mockReturnValue(true)
    setICloudState({ availability: 'available', platform: 'mac', deviceLabel: "Dave's Mac" })
    const { container } = renderSettings()
    await screen.findByText('eBird API Key')
    // The published claim in docs/HELP.md is "directly below Default Files",
    // which is what an adjacency assertion pins and a `<` chain does not.
    expect(sectionHeaders(container)).toEqual([
      'API Keys', 'Default Files', ICS_HEADER, ...BELOW_THE_PAIR, 'Troubleshooting', 'Acknowledgments',
    ])
  })

  it('API Keys is the first section on every platform shape', async () => {
    for (const platform of [
      { tauri: false, mac: false },
      { tauri: true, mac: false },
      { tauri: true, mac: true },
    ]) {
      vi.mocked(isTauri).mockReturnValue(platform.tauri)
      vi.mocked(isMacOS).mockReturnValue(platform.mac)
      const { container } = renderSettings()
      await screen.findByText('eBird API Key')
      expect(sectionHeaders(container)[0]).toBe('API Keys')
      cleanup()
    }
  })
})

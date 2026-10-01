// @vitest-environment jsdom
/// <reference types="node" />
//
// ios-alerts, QA-01 / FR-01 / NFR-06: on web/Pi, Windows and the Mac the
// Settings tab is BYTE-IDENTICAL to what it was before this feature. The
// fixture `settingsOffIos.fixture.json` was captured from the unedited base
// commit, before any source edit (testing.md v1.0.38: an additive feature's
// "unchanged while off" claim is a markup fixture captured at base), and was
// measured twice there to prove the capture deterministic. It holds the claim
// against both halves of this build's Settings change: the lazy Alerts section
// (gated markup, never hidden markup) and the lift of `SectionHeader` and
// `RadioGroup` into `components/settingsSections/`.
//
// On these three platforms the gate is false, so the section and its lazy
// chunk are never reached; the section's own iOS rendering is covered by
// AlertsSection.test.tsx and settingsSectionOrder.test.tsx.

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { readFileSync } from 'node:fs'

const storageMock = vi.hoisted(() => ({
  getBarChartFiles: vi.fn().mockResolvedValue({ version: 1, counties: {} }),
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
vi.mock('../../lib/storage', () => ({ storage: storageMock }))
vi.mock('../../lib/platform', () => ({
  isTauri: vi.fn(() => false), isIOS: vi.fn(() => false), isWindows: vi.fn(() => false), isMacOS: vi.fn(() => false),
}))
vi.mock('../../lib/observationsCache', () => ({ clearEbirdObservationsCache: vi.fn(), loadEbirdObservations: vi.fn(async () => []) }))
vi.mock('../../lib/mlExportCache', () => ({ clearMLExportCache: vi.fn() }))
vi.mock('../../lib/networkCache', () => ({ clearNetworkCache: vi.fn() }))
vi.mock('../../lib/hotspotSet', () => ({ invalidateHotspotSet: vi.fn() }))
vi.mock('../../lib/iosImport', () => ({ IOS_IMPORT_MECHANISM: 'input', pickCsvViaDialog: vi.fn() }))
vi.mock('@tauri-apps/plugin-process', () => ({ relaunch: vi.fn() }))

import { Settings } from '../Settings'
import { AlertsInboxBell, AlertsInboxNavItem } from '../AlertsInboxEntry'
import { CommandPalette } from '../CommandPalette'
import { resetAlertsState, setAlertsState, type AlertsSnapshot } from '../../lib/alerts/alertsState'
import { isTauri, isMacOS } from '../../lib/platform'
import { DEFAULT_TAB_ORDER, type ConfigurableTab } from '../../lib/tabLayout'
import { resetICloudState, setICloudState } from '../../lib/icloud/icloudState'

const fixture = JSON.parse(
  readFileSync(process.cwd() + '/src/components/settingsSections/settingsOffIos.fixture.json', 'utf8'),
) as Record<'web' | 'windows' | 'mac', string>

// The fixture holds the CAPTURE DAY: the Date format choice shows today's date
// as its example ("Sep 30, 2026"), so on any other day the markup differs by
// that one string and the rows fail for a reason that has nothing to do with
// Alerts. So only Date is faked (timers stay real, so the awaits below still
// run), pinned to the capture day at LOCAL noon, which is that same calendar
// day in every timezone from UTC-12 to UTC+14. The fixture stays as captured.
const CAPTURE_DAY_LOCAL_NOON = new Date(2026, 8, 30, 12)

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(CAPTURE_DAY_LOCAL_NOON)
  resetICloudState()
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.mocked(isTauri).mockReturnValue(false)
  vi.mocked(isMacOS).mockReturnValue(false)
})

async function markup(): Promise<string> {
  const { container } = render(
    <Settings onOpenHelp={vi.fn()} textScale={1} onTextScaleChange={vi.fn()} tabOrder={[...DEFAULT_TAB_ORDER]}
      tabHidden={new Set<ConfigurableTab>()} onReorder={vi.fn()} onToggleVisibility={vi.fn()} onRestoreDefaults={vi.fn()}
      disableEmbeddedMedia={false} embeddedMediaPreferenceSaving={false} embeddedMediaPreferenceError={null}
      onDisableEmbeddedMediaChange={vi.fn()} />,
  )
  await screen.findByText('eBird API Key')
  await new Promise(r => setTimeout(r, 50))
  return container.innerHTML
}

describe('Settings is unchanged where Alerts does not exist (ios-alerts QA-01)', () => {
  it('web/Pi: byte-identical to the base-commit markup, with no Alerts string anywhere', async () => {
    const html = await markup()
    expect(html).toBe(fixture.web)
    expect(html).not.toContain('Alerts')
  })

  it('Windows desktop: byte-identical to the base-commit markup', async () => {
    vi.mocked(isTauri).mockReturnValue(true)
    const html = await markup()
    expect(html).toBe(fixture.windows)
    expect(html).not.toContain('Alerts')
  })

  it('Mac: byte-identical to the base-commit markup (iCloud Sync shown, Alerts absent)', async () => {
    vi.mocked(isTauri).mockReturnValue(true)
    vi.mocked(isMacOS).mockReturnValue(true)
    setICloudState({ availability: 'available', platform: 'mac', deviceLabel: "Dave's Mac" })
    const html = await markup()
    expect(html).toBe(fixture.mac)
    expect(html).not.toContain('Alerts')
  })

  // The inbox revision (design-spec 7.2): the bell, the sidebar item and the
  // palette row read the same gate, which is false on all three platforms even
  // with a snapshot that would open it, so they render nothing at all.
  it('and the inbox entry points are absent on all three: no bell, no sidebar item, no palette row', async () => {
    const open: AlertsSnapshot = {
      settings: {
        version: 1, enabled: true, cadence: 'hourly', quietHours: { on: false, startMin: 1320, endMin: 420 },
        model: 'fixed', fixedPlace: null, radiusMi: 25, updatedAt: '2026-09-30T16:00:00Z',
      },
      state: { version: 1, lastCheck: null, holdUntil: null, position: null, pending: null, scheduledEarliest: null, backgroundRefresh: 'available' },
      inbox: [], blocked: null, permissions: { notifications: 'granted', location: 'granted' }, defaultLocation: null,
      now: '2026-09-30T16:00:00Z',
    }
    for (const platform of ['web', 'windows', 'mac'] as const) {
      vi.mocked(isTauri).mockReturnValue(platform !== 'web')
      vi.mocked(isMacOS).mockReturnValue(platform === 'mac')
      setAlertsState({ loaded: true, snapshot: open })
      const entries = render(<><AlertsInboxBell /><AlertsInboxNavItem glyph={{ size: 16, strokeWidth: 2 }} /></>)
      expect(entries.container.innerHTML, platform).toBe('')
      entries.unmount()
      const palette = render(
        <CommandPalette items={[]} onSelectTab={vi.fn()} onOpenSpecies={vi.fn()} onClose={vi.fn()} onOpenInbox={vi.fn()} />,
      )
      expect(screen.queryByRole('option', { name: /Alerts inbox/ }), platform).toBeNull()
      expect(palette.container.textContent, platform).not.toContain('Alerts')
      await new Promise(r => setTimeout(r, 20))
      palette.unmount()
    }
    resetAlertsState()
  })

  it('the fixture is non-vacuous: it holds the whole tab on each platform', () => {
    for (const k of ['web', 'windows', 'mac'] as const) {
      expect(fixture[k]).toContain('API Keys')
      expect(fixture[k]).toContain('Default Location')
      expect(fixture[k]).toContain('Acknowledgments')
    }
    expect(fixture.mac).not.toBe(fixture.web)
  })
})

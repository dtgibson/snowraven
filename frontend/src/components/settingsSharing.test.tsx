// @vitest-environment jsdom
//
// Settings → Sharing → "Copying a location" (FR-31 to FR-34, QA-37 / QA-38 /
// QA-40 / QA-36). The exact option labels are fixed by FR-31 and the live
// example is the argument for the preview existing at all, so both are asserted
// verbatim: "Copy coordinates and map links" describes a payload, the example
// IS the payload.
//
// Settings.tsx reaches into several seams on mount; they are stubbed here the
// same way Settings.test.tsx stubs them, which is left untouched.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'

const getSetting = vi.hoisted(() => vi.fn())
const setSetting = vi.hoisted(() => vi.fn())

vi.mock('../lib/storage', () => ({
  storage: {
    getFilesStatus: vi.fn().mockResolvedValue({ ebird: null, ml: null }),
    getApiKey: vi.fn().mockResolvedValue(null),
    getSetting,
    setApiKey: vi.fn().mockResolvedValue(undefined),
    deleteApiKey: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    deleteFile: vi.fn().mockResolvedValue(undefined),
    setSetting,
    deleteSetting: vi.fn().mockResolvedValue(undefined),
  },
}))
vi.mock('../lib/platform', () => ({
  isTauri: vi.fn(() => false),
  isIOS: vi.fn(() => false),
  isWindows: vi.fn(() => false),
}))
vi.mock('../lib/observationsCache', () => ({ clearEbirdObservationsCache: vi.fn() }))
vi.mock('../lib/mlExportCache', () => ({ clearMLExportCache: vi.fn() }))
vi.mock('../lib/networkCache', () => ({ clearNetworkCache: vi.fn() }))
vi.mock('../lib/hotspotSet', () => ({ invalidateHotspotSet: vi.fn() }))
vi.mock('../lib/iosImport', () => ({ IOS_IMPORT_MECHANISM: 'input', pickCsvViaDialog: vi.fn() }))
vi.mock('@tauri-apps/plugin-process', () => ({ relaunch: vi.fn() }))

import { Settings } from './Settings'
import { DEFAULT_TAB_ORDER } from '../lib/tabLayout'
import type { ConfigurableTab } from '../lib/tabLayout'
import { setShareCopyMode, SHARE_COPY_SETTING_KEY } from '../lib/shareCopyPreference'

const LINKS_LABEL = 'Copy coordinates and map links'
const ONLY_LABEL = 'Copy coordinates only'

const EXAMPLE_THREE_LINE =
  '38.54321, -121.98765\n'
  + 'Google Maps: https://maps.google.com/?q=38.54321,-121.98765\n'
  + 'Apple Maps: https://maps.apple.com/?q=38.54321,-121.98765'

function renderSettings() {
  getSetting.mockResolvedValue(null)
  setSetting.mockResolvedValue(undefined)
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

const group = () => screen.getByRole('radiogroup', { name: 'Copying a location' })
const radio = (label: string) => screen.getByRole('radio', { name: new RegExp(`^${label}\\.`) })

afterEach(() => {
  cleanup()
  getSetting.mockReset().mockResolvedValue(null)
  setSetting.mockReset().mockResolvedValue(undefined)
  // The preference store is module-level, so reset it AFTER the mocks are
  // usable again — it writes through the (mocked) storage seam.
  setShareCopyMode('coords-and-links')
})

describe('the control shape (FR-31, QA-37)', () => {
  it('is a two-option radio group with EXACTLY the required labels, not a switch', () => {
    renderSettings()
    const radios = screen.getAllByRole('radio', { name: /^Copy coordinates/ })
    expect(radios).toHaveLength(2)
    expect(group()).toBeTruthy()
    expect(radio(LINKS_LABEL)).toBeTruthy()
    expect(radio(ONLY_LABEL)).toBeTruthy()
    // The visible label leads the accessible name (WCAG 2.5.3).
    expect(radio(LINKS_LABEL).getAttribute('aria-label'))
      .toBe(`${LINKS_LABEL}. Three lines, with Google Maps and Apple Maps`)
    expect(radio(ONLY_LABEL).getAttribute('aria-label'))
      .toBe(`${ONLY_LABEL}. One line, nothing else`)
  })

  it('keeps only the checked option in the tab order (roving tabindex)', () => {
    renderSettings()
    expect(radio(LINKS_LABEL).getAttribute('tabindex')).toBe('0')
    expect(radio(ONLY_LABEL).getAttribute('tabindex')).toBe('-1')
  })

  it('moves the checked option with the arrow keys, and with Home / End', () => {
    renderSettings()
    fireEvent.keyDown(group(), { key: 'ArrowRight' })
    expect(radio(ONLY_LABEL).getAttribute('aria-checked')).toBe('true')
    fireEvent.keyDown(group(), { key: 'Home' })
    expect(radio(LINKS_LABEL).getAttribute('aria-checked')).toBe('true')
    fireEvent.keyDown(group(), { key: 'End' })
    expect(radio(ONLY_LABEL).getAttribute('aria-checked')).toBe('true')
  })
})

describe('the default and the live example (FR-32 / FR-34, QA-38 / QA-40)', () => {
  it('selects "Copy coordinates and map links" on a profile with no saved value', () => {
    renderSettings()
    expect(radio(LINKS_LABEL).getAttribute('aria-checked')).toBe('true')
    expect(radio(ONLY_LABEL).getAttribute('aria-checked')).toBe('false')
  })

  it('renders immediately with no spinner or disabled state, even before the read resolves', () => {
    getSetting.mockReturnValue(new Promise(() => {})) // never resolves
    renderSettings()
    const checked = radio(LINKS_LABEL)
    expect(checked.getAttribute('aria-checked')).toBe('true')
    expect(checked.hasAttribute('disabled')).toBe(false)
  })

  it('shows the EXACT payload the current mode produces, and re-renders it on a change', () => {
    const { container } = renderSettings()
    const example = () => container.querySelector('pre.sr-share-example')!.textContent
    expect(example()).toBe(EXAMPLE_THREE_LINE)

    fireEvent.click(radio(ONLY_LABEL))

    expect(example()).toBe('38.54321, -121.98765')
  })
})

describe('persistence (FR-33, QA-39)', () => {
  it('writes the semantic, label-agnostic value through the storage seam', async () => {
    renderSettings()
    fireEvent.click(radio(ONLY_LABEL))
    await waitFor(() => expect(setSetting).toHaveBeenCalledWith(SHARE_COPY_SETTING_KEY, 'coords-only'))

    fireEvent.click(radio(LINKS_LABEL))
    await waitFor(() => expect(setSetting).toHaveBeenCalledWith(SHARE_COPY_SETTING_KEY, 'coords-and-links'))
  })
})

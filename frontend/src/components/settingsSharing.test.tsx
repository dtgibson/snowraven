// @vitest-environment jsdom
//
// Settings → Sharing → "Copying a location" (FR-31 to FR-34, QA-37 / QA-38 /
// QA-40 / QA-36). Three independent switches in place of the v0.5.80 two-way
// radio group, so all eight combinations are reachable.
//
// The live example is the argument for the preview existing at all, and with all
// three off it is also the SAFETY argument for permitting that state, so both it
// and the sentence that replaces it are asserted verbatim.
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
import {
  setShareCopySelection, normalizeShareCopySelection, SHARE_COPY_SETTING_KEY,
} from '../lib/shareCopyPreference'

const ALL_ON = { coords: true, google: true, apple: true }

const COORD_LINE = '38.54321, -121.98765'
const GOOGLE_LINE = 'Google Maps: https://maps.google.com/?q=38.54321,-121.98765'
const APPLE_LINE = 'Apple Maps: https://maps.apple.com/?q=38.54321,-121.98765'
const EXAMPLE_THREE_LINE = [COORD_LINE, GOOGLE_LINE, APPLE_LINE].join('\n')

const EMPTY_SENTENCE = 'Nothing to copy. The share pin will still show the coordinates on the map.'

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

/** Each switch by the visible string its accessible name leads with. */
const sw = (label: string) => screen.getByRole('switch', { name: new RegExp(`^${label}\\.`) })
const COORDS = 'Coordinates'
const GOOGLE = 'Google Maps link'
const APPLE = 'Apple Maps link'

afterEach(() => {
  cleanup()
  getSetting.mockReset().mockResolvedValue(null)
  setSetting.mockReset().mockResolvedValue(undefined)
  // The preference store is module-level, so reset it AFTER the mocks are
  // usable again — it writes through the (mocked) storage seam.
  setShareCopySelection(ALL_ON)
})

describe('the control shape (FR-31, QA-37)', () => {
  it('is THREE independent switches, not a radio group', () => {
    // The v0.5.80 shape was a two-option radiogroup, which cannot express seven
    // of the eight combinations. Rejects leaving it in place.
    renderSettings()
    expect(screen.queryByRole('radiogroup', { name: 'Copying a location' })).toBeNull()
    expect(sw(COORDS)).toBeTruthy()
    expect(sw(GOOGLE)).toBeTruthy()
    expect(sw(APPLE)).toBeTruthy()
  })

  it('leads each accessible name with the visible label, then says what it does', () => {
    // WCAG 2.5.3 Label in Name. "Coordinates" heard alone is ambiguous, so the
    // name carries the consequence too.
    renderSettings()
    expect(sw(COORDS).getAttribute('aria-label') ?? sw(COORDS).textContent)
      .toContain('Coordinates. Include the coordinate pair when copying a location.')
    expect(sw(GOOGLE).textContent)
      .toContain('Google Maps link. Include a Google Maps link when copying a location.')
    expect(sw(APPLE).textContent)
      .toContain('Apple Maps link. Include an Apple Maps link when copying a location.')
  })

  it('shows each switch label once as visible row text', () => {
    const { container } = renderSettings()
    const labels = [...container.querySelectorAll('.sr-share-part-label')].map(n => n.textContent)
    expect(labels).toEqual([COORDS, GOOGLE, APPLE])
  })

  it('flips ONE switch without disturbing the others', () => {
    renderSettings()
    fireEvent.click(sw(GOOGLE))
    expect(sw(COORDS).getAttribute('aria-checked')).toBe('true')
    expect(sw(GOOGLE).getAttribute('aria-checked')).toBe('false')
    expect(sw(APPLE).getAttribute('aria-checked')).toBe('true')
  })

  it('reaches all eight combinations, all three off included', () => {
    renderSettings()
    const states = () => [COORDS, GOOGLE, APPLE].map(l => sw(l).getAttribute('aria-checked') === 'true')

    fireEvent.click(sw(COORDS))
    expect(states()).toEqual([false, true, true])
    fireEvent.click(sw(GOOGLE))
    expect(states()).toEqual([false, false, true])
    fireEvent.click(sw(APPLE))
    expect(states()).toEqual([false, false, false])
    fireEvent.click(sw(APPLE))
    expect(states()).toEqual([false, false, true])
  })
})

describe('the default and the live example (FR-32 / FR-34, QA-38 / QA-40)', () => {
  it('has all three on for a profile with no saved value', () => {
    renderSettings()
    for (const label of [COORDS, GOOGLE, APPLE]) {
      expect(sw(label).getAttribute('aria-checked')).toBe('true')
    }
  })

  it('renders immediately with no spinner or disabled state, even before the read resolves', () => {
    getSetting.mockReturnValue(new Promise(() => {})) // never resolves
    renderSettings()
    expect(sw(COORDS).getAttribute('aria-checked')).toBe('true')
    expect(sw(COORDS).hasAttribute('disabled')).toBe(false)
  })

  it('shows the EXACT payload the current selection produces, and re-renders it on a flip', () => {
    const { container } = renderSettings()
    const example = () => container.querySelector('pre.sr-share-example')!.textContent
    expect(example()).toBe(EXAMPLE_THREE_LINE)

    fireEvent.click(sw(GOOGLE))
    expect(example()).toBe([COORD_LINE, APPLE_LINE].join('\n'))

    fireEvent.click(sw(COORDS))
    expect(example()).toBe(APPLE_LINE)
  })

  it('leaves no blank line in the example when a MIDDLE part is off', () => {
    const { container } = renderSettings()
    fireEvent.click(sw(GOOGLE))
    expect(container.querySelector('pre.sr-share-example')!.textContent).not.toContain('\n\n')
  })

  it('captions the example with the manifest, naming every part in full', () => {
    const { container } = renderSettings()
    const manifest = () => container.querySelector('.sr-share-manifest')!.textContent
    expect(manifest()).toBe('Three lines: coordinates, Google Maps link, Apple Maps link.')

    fireEvent.click(sw(COORDS))
    expect(manifest()).toBe('Two lines: Google Maps link, Apple Maps link.')

    fireEvent.click(sw(APPLE))
    expect(manifest()).toBe('One line: Google Maps link.')
  })
})

describe('the all-off state (structural, not a ninth string)', () => {
  function turnEverythingOff() {
    fireEvent.click(sw(COORDS))
    fireEvent.click(sw(GOOGLE))
    fireEvent.click(sw(APPLE))
  }

  it('REPLACES the example block with a sentence, rather than showing an empty <pre>', () => {
    // Rejects rendering buildSharePayload's empty string into the existing <pre>,
    // which would leave a blank grey box explaining nothing.
    const { container } = renderSettings()
    turnEverythingOff()
    expect(container.querySelector('pre.sr-share-example')).toBeNull()
    expect(container.querySelector('.sr-share-manifest')).toBeNull()
    expect(container.querySelector('.sr-share-empty')!.textContent).toBe(EMPTY_SENTENCE)
  })

  it('reads as a consequence of a deliberate choice, with no warning or scolding register', () => {
    const { container } = renderSettings()
    turnEverythingOff()
    // The visible sentence specifically: the live region carries the same string,
    // so a text query would match both.
    const text = container.querySelector('.sr-share-empty')!.textContent!
    expect(text).not.toMatch(/error|warning|invalid|must|should|please/i)
    // States the outcome, then hands back the thing that still works.
    expect(text).toContain('will still show the coordinates')
  })

  it('comes straight back when a switch is turned on again', () => {
    const { container } = renderSettings()
    turnEverythingOff()
    fireEvent.click(sw(COORDS))
    expect(container.querySelector('.sr-share-empty')).toBeNull()
    expect(container.querySelector('pre.sr-share-example')!.textContent).toBe(COORD_LINE)
  })

  it('carries no em dash in either the empty sentence or the manifest', () => {
    const { container } = renderSettings()
    expect(container.querySelector('.sr-share-manifest')!.textContent).not.toContain('—')
    turnEverythingOff()
    expect(container.querySelector('.sr-share-empty')!.textContent).not.toContain('—')
  })
})

describe('the live region announces the CONSEQUENCE, not the payload', () => {
  const region = (container: HTMLElement) => container.querySelector('[role="status"]')!

  it('is silent on mount', () => {
    // It renders from the start so its later text is an announced addition, but
    // it must not speak just because Settings opened.
    const { container } = renderSettings()
    expect(region(container)).toBeTruthy()
    expect(region(container).textContent).toBe('')
  })

  it('announces the manifest sentence after a flip, never the <pre> payload', () => {
    // Reading a coordinate pair and two full URLs aloud on every flip would be
    // punishing. Rejects making the example block itself the live region.
    const { container } = renderSettings()
    fireEvent.click(sw(GOOGLE))
    expect(region(container).textContent).toBe('Two lines: coordinates, Apple Maps link.')
    expect(region(container).textContent).not.toContain('https://')
  })

  it('announces the all-off sentence at the instant the last switch flips', () => {
    // The whole safety argument for permitting all three off, for someone who
    // cannot see the example change.
    const { container } = renderSettings()
    fireEvent.click(sw(COORDS))
    fireEvent.click(sw(GOOGLE))
    fireEvent.click(sw(APPLE))
    expect(region(container).textContent).toBe(EMPTY_SENTENCE)
  })

  it('carries each announcement in a NEW keyed child, so a repeat would still announce', async () => {
    // Measured as DOM mutations rather than reasoned about (MutationObserver
    // delivers on a microtask, hence the waits). With three switches every flip
    // changes the string, so today this guards the mechanism rather than a
    // reachable repeat; a fourth destination makes it reachable, and this repo
    // has shipped the identical-string bail-out bug once already.
    const { container } = renderSettings()
    const live = region(container)

    let mutations = 0
    const observer = new MutationObserver(records => { mutations += records.length })
    observer.observe(live, { childList: true, characterData: true, subtree: true })

    fireEvent.click(sw(GOOGLE))
    await waitFor(() => expect(mutations).toBeGreaterThan(0))
    const afterFirst = mutations
    const firstChild = live.firstElementChild
    expect(firstChild).toBeTruthy()

    fireEvent.click(sw(GOOGLE))
    await waitFor(() => expect(mutations).toBeGreaterThan(afterFirst))
    // A real node replacement, not a text edit smuggling in a spacer character.
    expect(live.firstElementChild).not.toBe(firstChild)
    expect(live.textContent).toBe('Three lines: coordinates, Google Maps link, Apple Maps link.')

    observer.disconnect()
  })
})

describe('persistence (FR-33, QA-39)', () => {
  it('writes the widened OBJECT through the storage seam, under the unchanged key', async () => {
    renderSettings()
    fireEvent.click(sw(GOOGLE))
    await waitFor(() => expect(setSetting).toHaveBeenCalledWith(
      SHARE_COPY_SETTING_KEY, { coords: true, google: false, apple: true },
    ))

    fireEvent.click(sw(COORDS))
    await waitFor(() => expect(setSetting).toHaveBeenCalledWith(
      SHARE_COPY_SETTING_KEY, { coords: false, google: false, apple: true },
    ))
  })

  it('persists all three off rather than skipping the write', async () => {
    renderSettings()
    fireEvent.click(sw(COORDS))
    fireEvent.click(sw(GOOGLE))
    fireEvent.click(sw(APPLE))
    await waitFor(() => expect(setSetting).toHaveBeenCalledWith(
      SHARE_COPY_SETTING_KEY, { coords: false, google: false, apple: false },
    ))
  })

  it('renders the MIGRATED v0.5.80 "coords-only" profile as its switch positions', () => {
    // The migration seen from the surface the user actually looks at: switch
    // positions that already match the prior choice, no notice, no dialog.
    //
    // The store hydrates once per session and this file shares one module
    // instance across its cases, so the read cannot be re-armed here; the
    // storage-to-selection half is locked end to end in
    // shareCopyPreference.test.ts ("hydrates an UPGRADING profile through the
    // store"). This case owns the selection-to-switches half, over the same
    // normalizer the hydrate path uses.
    setShareCopySelection(normalizeShareCopySelection('coords-only'))
    renderSettings()
    expect(sw(COORDS).getAttribute('aria-checked')).toBe('true')
    expect(sw(GOOGLE).getAttribute('aria-checked')).toBe('false')
    expect(sw(APPLE).getAttribute('aria-checked')).toBe('false')
    expect(screen.getByRole('switch', { name: /^Coordinates\./ })).toBeTruthy()
  })

  it('shows a migrated "coords-only" profile the single line it will copy', () => {
    setShareCopySelection(normalizeShareCopySelection('coords-only'))
    const { container } = renderSettings()
    expect(container.querySelector('pre.sr-share-example')!.textContent).toBe(COORD_LINE)
    expect(container.querySelector('.sr-share-manifest')!.textContent).toBe('One line: coordinates.')
  })
})

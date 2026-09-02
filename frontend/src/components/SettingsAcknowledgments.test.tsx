// @vitest-environment jsdom
//
// Settings → Acknowledgments (settings-acknowledgments; PRD QA-01/02/03/04/05/
// 07/09/12/14 where unit-testable). The section is the last one in the tab: a
// SectionHeader plus a card holding one quiet toggle that opens an inline
// grid-rows disclosure with exactly two fixed entries. jsdom has no layout
// engine, so the geometric claims (320px/200%, AA contrast, touch target) stay
// with the browser QA pass; what is pinned here is structure, semantics, copy,
// and state behavior.
//
// Settings.tsx reaches into several seams on mount; they are stubbed here the
// same way settingsSharing.test.tsx stubs them, which is left untouched.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

const setSetting = vi.hoisted(() => vi.fn())

vi.mock('../lib/storage', () => ({
  storage: {
    getFilesStatus: vi.fn().mockResolvedValue({ ebird: null, ml: null }),
    getApiKey: vi.fn().mockResolvedValue(null),
    getSetting: vi.fn().mockResolvedValue(null),
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
  isMacOS: vi.fn(() => false),
}))
vi.mock('../lib/observationsCache', () => ({ clearEbirdObservationsCache: vi.fn() }))
vi.mock('../lib/mlExportCache', () => ({ clearMLExportCache: vi.fn() }))
vi.mock('../lib/networkCache', () => ({ clearNetworkCache: vi.fn() }))
vi.mock('../lib/hotspotSet', () => ({ invalidateHotspotSet: vi.fn() }))
vi.mock('../lib/iosImport', () => ({ IOS_IMPORT_MECHANISM: 'input', pickCsvViaDialog: vi.fn() }))
vi.mock('@tauri-apps/plugin-process', () => ({ relaunch: vi.fn() }))

import { Settings } from './Settings'
import { isTauri } from '../lib/platform'
import { DEFAULT_TAB_ORDER } from '../lib/tabLayout'
import type { ConfigurableTab } from '../lib/tabLayout'

afterEach(() => {
  cleanup()
  vi.mocked(isTauri).mockReturnValue(false)
  setSetting.mockClear()
})

// The exact approved strings (design-spec.md Content Notes) — the complete set.
const ENTRY_1_NAME = 'The Cornell Lab of Ornithology and the Macaulay Library'
const ENTRY_1_BODY = 'For creating a wonderful platform for tracking birding data, and for making it freely available.'
const ENTRY_2_NAME = 'Deven Simonson'
const ENTRY_2_BODY = 'For providing early access to Weft to help build the SnowRaven app.'

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

function getToggle(name: string) {
  return screen.getByRole('button', { name }) as HTMLButtonElement
}

/** The clipped inner element that carries `inert` while closed: the first
 *  element child of the wrapper the toggle's aria-controls names. Resolved
 *  through the ARIA wiring rather than a class query so the test also proves
 *  aria-controls points at a real element. */
function getClipped(toggle: HTMLButtonElement): HTMLElement {
  const panelId = toggle.getAttribute('aria-controls')
  expect(panelId).toBeTruthy()
  const wrapper = document.getElementById(panelId!)
  expect(wrapper).toBeTruthy()
  return wrapper!.firstElementChild as HTMLElement
}

describe('Settings — Acknowledgments entry point (QA-01)', () => {
  it('renders the section header and one real toggle button, collapsed by default', () => {
    renderSettings()
    expect(screen.getByText('Acknowledgments')).toBeTruthy()
    const toggle = getToggle('View acknowledgments')
    // A real <button type="button"> with an explicit tab stop: Enter and Space
    // activation is native button behavior, so the structural facts are what a
    // unit test can pin (the keyboard walkthrough itself is QA-06, browser).
    expect(toggle.tagName).toBe('BUTTON')
    expect(toggle.getAttribute('type')).toBe('button')
    expect(toggle.tabIndex).toBe(0)
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
  })

  it('is the LAST section of the tab in web mode (after Tab Layout; Troubleshooting absent)', () => {
    const { container } = renderSettings()
    const toggle = getToggle('View acknowledgments')
    // The section wrapper is the last element child of the Settings panel div.
    const panel = container.firstElementChild as HTMLElement
    const last = panel.lastElementChild as HTMLElement
    expect(last.contains(toggle)).toBe(true)
    // Web mode: no Troubleshooting section renders at all.
    expect(screen.queryByText('Troubleshooting')).toBeNull()
  })

  it('is still the LAST section on desktop, after the Troubleshooting block (QA-01, placement)', () => {
    vi.mocked(isTauri).mockReturnValue(true)
    const { container } = renderSettings()
    const toggle = getToggle('View acknowledgments')
    const trouble = screen.getByText('Troubleshooting')
    const panel = container.firstElementChild as HTMLElement
    const last = panel.lastElementChild as HTMLElement
    expect(last.contains(toggle)).toBe(true)
    expect(last.contains(trouble)).toBe(false)
    // Troubleshooting precedes Acknowledgments in document order.
    expect(trouble.compareDocumentPosition(toggle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})

describe('Settings — Acknowledgments reveal and content (QA-02/QA-03/QA-07)', () => {
  it('opening reveals exactly two entries, in order, with the approved copy verbatim', () => {
    renderSettings()
    const toggle = getToggle('View acknowledgments')
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')

    const clipped = getClipped(toggle)
    const entries = clipped.querySelectorAll('.sr-ack-entry')
    expect(entries).toHaveLength(2)
    expect(entries[0].textContent).toBe(ENTRY_1_NAME + ENTRY_1_BODY)
    expect(entries[1].textContent).toBe(ENTRY_2_NAME + ENTRY_2_BODY)
    // Nothing else in the panel: no lead-in, no heading, no links, no other
    // credits (FR-07), and no live region (FR-16 — the state change is carried
    // by aria-expanded; reference material is not an event).
    expect(clipped.querySelectorAll('a')).toHaveLength(0)
    expect(clipped.querySelector('[aria-live], [role="status"], [role="alert"]')).toBeNull()
  })

  it('the accessible name IS the visible label in both states (QA-07)', () => {
    renderSettings()
    const toggle = getToggle('View acknowledgments')
    expect(toggle.textContent).toBe('View acknowledgments')
    fireEvent.click(toggle)
    // Same element, renamed by its visible text alone.
    expect(getToggle('Hide acknowledgments')).toBe(toggle)
    expect(toggle.textContent).toBe('Hide acknowledgments')
    fireEvent.click(toggle)
    expect(getToggle('View acknowledgments')).toBe(toggle)
  })
})

describe('Settings — Acknowledgments collapsed state and focus (QA-04)', () => {
  it('the clipped content carries the LITERAL inert attribute while closed, and drops it while open', () => {
    renderSettings()
    const toggle = getToggle('View acknowledgments')
    const clipped = getClipped(toggle)
    // Literal attribute in BOTH states (the React-19 inert={false} rule): a
    // truthy string would pin the panel permanently inert, and a missing
    // attribute while closed leaves clipped content in the tab order.
    expect(clipped.hasAttribute('inert')).toBe(true)
    fireEvent.click(toggle)
    expect(clipped.hasAttribute('inert')).toBe(false)
    fireEvent.click(toggle)
    expect(clipped.hasAttribute('inert')).toBe(true)
  })

  it('collapse keeps focus on the toggle', () => {
    renderSettings()
    const toggle = getToggle('View acknowledgments')
    toggle.focus()
    fireEvent.click(toggle)
    expect(document.activeElement).toBe(toggle)
    fireEvent.click(toggle)
    // The button never unmounts, so focus never moves and nothing is restored.
    expect(document.activeElement).toBe(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
  })
})

describe('Settings — Acknowledgments idempotence and no persisted state (QA-05/QA-09)', () => {
  it('five open/close cycles: no duplicated content, no console errors, identical view each open', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      renderSettings()
      const toggle = getToggle('View acknowledgments')
      const clipped = getClipped(toggle)
      for (let i = 0; i < 5; i += 1) {
        fireEvent.click(toggle)
        expect(toggle.getAttribute('aria-expanded')).toBe('true')
        const entries = clipped.querySelectorAll('.sr-ack-entry')
        expect(entries).toHaveLength(2)
        expect(entries[0].textContent).toBe(ENTRY_1_NAME + ENTRY_1_BODY)
        expect(entries[1].textContent).toBe(ENTRY_2_NAME + ENTRY_2_BODY)
        fireEvent.click(toggle)
        expect(toggle.getAttribute('aria-expanded')).toBe('false')
        expect(clipped.hasAttribute('inert')).toBe(true)
      }
      expect(errorSpy).not.toHaveBeenCalled()
    } finally {
      errorSpy.mockRestore()
    }
  })

  it('opening and closing writes nothing through the storage seam (FR-13)', () => {
    renderSettings()
    const toggle = getToggle('View acknowledgments')
    fireEvent.click(toggle)
    fireEvent.click(toggle)
    expect(setSetting).not.toHaveBeenCalled()
  })
})

describe('Settings — Acknowledgments copy rules (QA-12)', () => {
  it('no em dash (U+2014) appears anywhere in the section, open state included', () => {
    renderSettings()
    const toggle = getToggle('View acknowledgments')
    fireEvent.click(toggle)
    const clipped = getClipped(toggle)
    // Both button labels plus the whole revealed subtree and the header label.
    for (const text of [
      screen.getByText('Acknowledgments').textContent ?? '',
      'View acknowledgments',
      toggle.textContent ?? '', // "Hide acknowledgments" while open
      clipped.textContent ?? '',
    ]) {
      expect(text.includes('—')).toBe(false)
    }
    // And the exact expected constants, so a copy edit here cannot smuggle one
    // into the very strings the content assertions compare against.
    for (const s of [ENTRY_1_NAME, ENTRY_1_BODY, ENTRY_2_NAME, ENTRY_2_BODY]) {
      expect(s.includes('—')).toBe(false)
    }
  })
})

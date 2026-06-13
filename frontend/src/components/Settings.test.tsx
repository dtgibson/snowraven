// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'

// Settings reaches into the storage and theme seams on mount; stub them so the
// component renders synchronously in jsdom without a real backend/localStorage.
vi.mock('../lib/storage', () => ({
  storage: {
    getFilesStatus: vi.fn().mockResolvedValue({ ebird: null, ml: null }),
    getApiKey: vi.fn().mockResolvedValue(null),
    getSetting: vi.fn().mockResolvedValue(null),
    setApiKey: vi.fn().mockResolvedValue(undefined),
    deleteApiKey: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    deleteFile: vi.fn().mockResolvedValue(undefined),
    setSetting: vi.fn().mockResolvedValue(undefined),
    deleteSetting: vi.fn().mockResolvedValue(undefined),
  },
}))
vi.mock('../lib/platform', () => ({ isTauri: () => false }))
vi.mock('../lib/observationsCache', () => ({ clearEbirdObservationsCache: vi.fn() }))
vi.mock('../lib/mlExportCache', () => ({ clearMLExportCache: vi.fn() }))
vi.mock('../lib/networkCache', () => ({ clearNetworkCache: vi.fn() }))

import { Settings } from './Settings'
import { DEFAULT_TAB_ORDER, TAB_LABELS } from '../lib/tabLayout'
import type { ConfigurableTab } from '../lib/tabLayout'

afterEach(cleanup)

function renderSettings(overrides: Partial<React.ComponentProps<typeof Settings>> = {}) {
  const onReorder = vi.fn()
  const onToggleVisibility = vi.fn()
  const props: React.ComponentProps<typeof Settings> = {
    onOpenHelp: vi.fn(),
    textScale: 1,
    onTextScaleChange: vi.fn(),
    tabOrder: [...DEFAULT_TAB_ORDER],
    tabHidden: new Set<ConfigurableTab>(),
    onReorder,
    onToggleVisibility,
    onRestoreDefaults: vi.fn(),
    ...overrides,
  }
  const utils = render(<Settings {...props} />)
  return { ...utils, onReorder, onToggleVisibility }
}

describe('Settings — Tab Layout keyboard reorder (F013/F054/F093)', () => {
  beforeEach(() => { window.requestAnimationFrame = (cb: FrameRequestCallback) => { cb(0); return 0 } })

  it('renders Move up / Move down buttons for every tab', () => {
    renderSettings()
    for (const tab of DEFAULT_TAB_ORDER) {
      expect(screen.getByRole('button', { name: `Move ${TAB_LABELS[tab]} tab up` })).toBeTruthy()
      expect(screen.getByRole('button', { name: `Move ${TAB_LABELS[tab]} tab down` })).toBeTruthy()
    }
  })

  it('Move down calls onReorder with the row swapped one position later', () => {
    const { onReorder } = renderSettings()
    const firstTab = DEFAULT_TAB_ORDER[0]
    fireEvent.click(screen.getByRole('button', { name: `Move ${TAB_LABELS[firstTab]} tab down` }))
    const expected = [...DEFAULT_TAB_ORDER]
    const [moved] = expected.splice(0, 1)
    expected.splice(1, 0, moved)
    expect(onReorder).toHaveBeenCalledWith(expected)
  })

  it('disables Move up on the first row and Move down on the last row', () => {
    renderSettings()
    const first = DEFAULT_TAB_ORDER[0]
    const last = DEFAULT_TAB_ORDER[DEFAULT_TAB_ORDER.length - 1]
    expect(screen.getByRole('button', { name: `Move ${TAB_LABELS[first]} tab up` })).toHaveProperty('disabled', true)
    expect(screen.getByRole('button', { name: `Move ${TAB_LABELS[last]} tab down` })).toHaveProperty('disabled', true)
  })

  it('no longer claims keyboard reordering is unsupported, and the drag handle carries no prohibited aria-label', () => {
    const { container } = renderSettings()
    expect(screen.queryByText(/Keyboard reordering is not supported/i)).toBeNull()
    // The handle is a decorative div; it must not carry an aria-label (axe
    // aria-prohibited-attr) nor a "Drag to reorder" name.
    expect(container.querySelector('[aria-label^="Drag to reorder"]')).toBeNull()
  })
})

describe('Settings — radiogroup arrow keys + roving tabindex (F053/F092)', () => {
  it('Color theme group exposes a single tab stop and moves checked on ArrowRight', () => {
    const { container } = renderSettings()
    const group = container.querySelector('[role="radiogroup"][aria-label="Color theme"]') as HTMLElement
    expect(group).toBeTruthy()
    const radios = Array.from(group.querySelectorAll<HTMLButtonElement>('[role="radio"]'))
    expect(radios).toHaveLength(3)
    // Roving tabindex: exactly one radio is a tab stop.
    expect(radios.filter(r => r.tabIndex === 0)).toHaveLength(1)
    const checked = radios.find(r => r.getAttribute('aria-checked') === 'true')!
    fireEvent.keyDown(group, { key: 'ArrowRight' })
    // The checked state advanced (default is "system" -> "light").
    const newChecked = group.querySelector('[role="radio"][aria-checked="true"]')
    expect(newChecked).not.toBe(checked)
  })

  it('Text size group moves checked with ArrowDown via onTextScaleChange', () => {
    const onTextScaleChange = vi.fn()
    const { container } = renderSettings({ onTextScaleChange })
    const group = container.querySelector('[role="radiogroup"][aria-label="Text size"]') as HTMLElement
    fireEvent.keyDown(group, { key: 'ArrowDown' })
    expect(onTextScaleChange).toHaveBeenCalledWith(1.25)
  })
})

describe('Settings — form labels and error roles (F007/F048/F010)', () => {
  it('associates Latitude/Longitude/Radius labels with their inputs', () => {
    renderSettings()
    expect(screen.getByLabelText('Latitude')).toBeTruthy()
    expect(screen.getByLabelText('Longitude')).toBeTruthy()
    expect(screen.getByLabelText('Radius (mi)')).toBeTruthy()
  })

  it('names the offending field with role=alert when map defaults validation fails', async () => {
    renderSettings()
    fireEvent.change(screen.getByLabelText('Latitude'), { target: { value: '999' } })
    fireEvent.change(screen.getByLabelText('Longitude'), { target: { value: '0' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => {
      const alert = screen.getByRole('alert')
      expect(alert.textContent).toMatch(/Latitude must be a number between -90 and 90/i)
    })
  })
})

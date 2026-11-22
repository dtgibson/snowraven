// @vitest-environment jsdom
//
// The Family Tree's full screen, still and opener (family-rollups-and-tree
// schema 11.9 and 11.10; design-spec 10; D-48), through the REAL shared hook
// (`lib/useMapFullscreen.ts`), its tab-showing provider and the real
// `FsOpenRow`: only the tier (`useIsPhone`) and the data seams are mocked. The
// tree's lazy chunk is held behind a gate for the rows that need it pending, so
// the Exit the tab draws is shown to exist before the chunk has drawn. jsdom has
// no layout: the tree box reports a size and a ResizeObserver reports once, as
// in the tab suite; geometric claims belong to the real-engine probe.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor, act, within, renderHook } from '@testing-library/react'
import { readFileSync } from 'node:fs'
// The suite runs from frontend/ (vitest's root), so source paths resolve from there.
import { resolve } from 'node:path'
import { createRef } from 'react'
import type { ObservationEntry } from '../../types'

const H = vi.hoisted(() => {
  let release: () => void = () => {}
  const gate = new Promise<void>(r => { release = r })
  return {
    files: { ebird: { filename: 'MyEBirdData.csv' }, ml: null } as { ebird: unknown; ml: unknown },
    observations: [] as unknown[],
    ebirdNull: false,
    post: vi.fn(),
    getSetting: vi.fn<(key: string) => Promise<unknown>>(async () => null),
    setSetting: vi.fn<(key: string, value: unknown) => Promise<void>>(async () => {}),
    getFilesStatus: vi.fn(),
    phone: true,
    gate,
    release: () => release(),
  }
})

vi.mock('../../lib/storage', () => ({
  storage: { getFilesStatus: H.getFilesStatus, getSetting: H.getSetting, setSetting: H.setSetting, deleteSetting: vi.fn(async () => {}) },
}))
vi.mock('../../lib/observationsCache', () => ({
  loadEbirdObservations: vi.fn(async () => (H.ebirdNull ? null : { headerLine: '', observations: H.observations })),
}))
vi.mock('../../lib/mlExportCache', () => ({ loadMLExport: vi.fn(async () => null) }))
vi.mock('../../lib/transport', () => ({ transport: { post: H.post, get: vi.fn() } }))
// One stable snapshot: the reader subscribes through useSyncExternalStore.
const SNAPSHOT = { checklists: new Set(), species: new Map(), excludedNames: [], exoticNames: null }
vi.mock('../../lib/exoticProvenanceCache', () => ({
  getSnapshot: () => SNAPSHOT,
  subscribe: () => () => {},
  loadSnapshot: vi.fn(async () => null),
}))
// The tier, read by the shared hook itself (and by the rotate note).
vi.mock('../../lib/useIsPhone', () => ({ useIsPhone: () => H.phone }))
// The tree's chunk, held until a row releases it.
vi.mock('./FamilyTreeDiagram', async importOriginal => {
  await H.gate
  return importOriginal()
})

import { FamilyTreeTab } from './FamilyTreeTab'
import { MapTabShowingProvider, useMapFullscreen, FS_OPEN_ATTR, MAP_FS_PANEL_CLASS } from '../../lib/useMapFullscreen'
import { notifyFilesChanged } from '../../lib/filesChanged'
import { FAMILY_TREE_VIEW_SETTING } from '../../lib/familyTreeSettings'
import { EXIT_FULLSCREEN_LABEL, EXIT_WORD } from '../../lib/mapStillCopy'
import { ENTER_FULLSCREEN_LABEL, OPEN_TREE_LABEL, OPEN_TREE_NOTE, stillName } from '../../lib/familyTreeCopy'

function obs(commonName: string, date: string, submissionId: string): ObservationEntry {
  return {
    submissionId, commonName, scientificName: '', date, location: 'Lake Park', locationId: 'L1',
    latitude: null, longitude: null, county: 'Marin', count: 1, breedingCode: null, speciesComments: '',
    catalogIds: [], time: '7:05 AM', stateProvince: 'US-CA',
  }
}
const BASE = [
  obs('Snow Goose', '2019-05-02', 'S1'), obs("Ross's Goose", '2021-03-09', 'S2'),
  obs('Canada Goose', '2021-03-09', 'S2'), obs('American Robin', '2020-01-01', 'S3'),
]

function layoutShims() {
  const size = (el: Element, wide: boolean) => (el.classList.contains('sr-ft-box') ? (wide ? 360 : 300) : 0)
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) { return size(this, true) })
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function (this: HTMLElement) { return size(this, false) })
  vi.stubGlobal('ResizeObserver', class {
    private cb: () => void
    constructor(cb: () => void) { this.cb = cb }
    observe() { queueMicrotask(() => this.cb()) }
    disconnect() {}
  })
}

beforeEach(() => {
  H.files = { ebird: { filename: 'MyEBirdData.csv' }, ml: null }
  H.observations = BASE
  H.ebirdNull = false
  H.phone = true
  H.getFilesStatus.mockImplementation(async () => H.files)
  // The tree view is the stored choice, so the still tier opens on it.
  H.getSetting.mockImplementation(async key => (key === FAMILY_TREE_VIEW_SETTING ? 'diagram' : null))
  H.post.mockImplementation(async () => ({ codes: {} }))
  layoutShims()
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  document.documentElement.removeAttribute(FS_OPEN_ATTR)
  document.body.style.overflow = ''
})

function Tab({ showing = true }: { showing?: boolean }) {
  return (
    <MapTabShowingProvider value={showing}>
      <FamilyTreeTab onGoToSettings={() => {}} showing={showing} />
    </MapTabShowingProvider>
  )
}
async function readyTab(showing = true) {
  const r = render(<Tab showing={showing} />)
  await waitFor(() => expect(document.querySelector('.sr-ft-glance')).not.toBeNull())
  return r
}
const host = () => document.querySelector<HTMLElement>('.sr-ft-host')!
const exits = () => screen.queryAllByRole('button', { name: EXIT_FULLSCREEN_LABEL })
const expanded = () => host()?.classList.contains(MAP_FS_PANEL_CLASS) ?? false
const barHidden = () => document.documentElement.hasAttribute(FS_OPEN_ATTR)

describe('the hook as consumed (schema 11.9 contract row)', () => {
  it('returns every member the tree uses', () => {
    const ref = createRef<HTMLElement>()
    const { result } = renderHook(() => useMapFullscreen({ containerRef: ref, baseClass: 'sr-ft-host' }))
    for (const k of ['expanded', 'toggle', 'className', 'registerToggle', 'stillTier', 'still', 'open', 'registerOpener'] as const) {
      expect(result.current[k], k).toBeDefined()
    }
    expect(result.current.className).toBe('sr-ft-host')
  })
})

describe('the Exit is drawn by the tab, outside the lazy chunk (D-48)', () => {
  // This row runs first in the file: the chunk's gate is still closed.
  it('(a) expanded on the still tier while the tree chunk is pending: one Exit, focused, and the trap holds', async () => {
    await readyTab()
    expect(document.querySelector('[role="tree"]')).toBeNull()
    expect(document.querySelector('.sr-ft-treeview')).not.toBeNull()   // the Suspense fallback
    const opener = screen.getByRole('button', { name: OPEN_TREE_LABEL })
    opener.focus()
    fireEvent.click(opener)
    await waitFor(() => expect(expanded()).toBe(true))
    expect(barHidden()).toBe(true)
    expect(exits()).toHaveLength(1)
    await waitFor(() => expect(document.activeElement).toBe(exits()[0]))
    expect(exits()[0].textContent).toContain(EXIT_WORD)
    // The trap: focus sent outside the panel comes back inside.
    screen.getByRole('button', { name: 'Table' }).focus()
    await waitFor(() => expect(host().contains(document.activeElement)).toBe(true))
    fireEvent.click(exits()[0])
    await waitFor(() => expect(expanded()).toBe(false))
  })
  it('(b) after the chunk has drawn: still one Exit, focused, and the trap holds', async () => {
    H.release()
    await readyTab()
    fireEvent.click(screen.getByRole('button', { name: OPEN_TREE_LABEL }))
    await waitFor(() => expect(expanded()).toBe(true))
    await screen.findByRole('tree')
    expect(exits()).toHaveLength(1)
    await waitFor(() => expect(document.activeElement).toBe(exits()[0]))
    screen.getByRole('button', { name: 'Table' }).focus()
    await waitFor(() => expect(host().contains(document.activeElement)).toBe(true))
  })
})

describe('every way the tree stops being ready collapses and releases (D-48 c)', () => {
  beforeEach(() => H.release())
  async function open() {
    await readyTab()
    fireEvent.click(screen.getByRole('button', { name: OPEN_TREE_LABEL }))
    await waitFor(() => expect(expanded()).toBe(true))
    expect(barHidden()).toBe(true)
    expect(document.body.style.overflow).toBe('hidden')
  }
  const released = async () => {
    await waitFor(() => expect(barHidden()).toBe(false))
    expect(document.querySelector(`.${MAP_FS_PANEL_CLASS}`)).toBeNull()
    expect(document.body.style.overflow).toBe('')
  }
  it('a view switch', async () => {
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'Table' }))
    await released()
  })
  it('a reload of the backup', async () => {
    await open()
    act(() => notifyFilesChanged())
    await released()
  })
  it('an error loading the backup', async () => {
    await open()
    H.ebirdNull = true
    act(() => notifyFilesChanged())
    await released()
    await waitFor(() => expect(screen.getByRole('alert').textContent).not.toBe(''))
  })
  it('the tab stops showing, with no document listener left', async () => {
    const r = await readyTab()
    fireEvent.click(screen.getByRole('button', { name: OPEN_TREE_LABEL }))
    await waitFor(() => expect(expanded()).toBe(true))
    const removed = vi.spyOn(document, 'removeEventListener')
    r.rerender(<Tab showing={false} />)
    await released()
    expect(removed.mock.calls.some(c => c[0] === 'keydown')).toBe(true)
  })
})

describe('the still and the opener (schema 11.10; design-spec 10.1, 10.2)', () => {
  beforeEach(() => H.release())
  it('the still is a named image over an inert box, with no tools, toggle or readout; the opener is after the host', async () => {
    await readyTab()
    const tree = await waitFor(() => {
      const t = document.querySelector<HTMLElement>('.sr-ft-box')
      expect(t?.hasAttribute('inert')).toBe(true)
      return t!
    })
    const wrap = tree.closest('.sr-ft-boxwrap')!
    expect(wrap.getAttribute('role')).toBe('img')
    expect(wrap.getAttribute('aria-label')).toMatch(/^Your family tree: 4 species in \d+ famil(y|ies) and \d+ orders?$/)
    expect(stillName(1, 1, 1)).toBe('Your family tree: 1 species in 1 family and 1 order')
    expect(tree.hasAttribute('tabindex')).toBe(false)
    expect(tree.hasAttribute('aria-activedescendant')).toBe(false)
    expect(screen.queryByRole('toolbar', { name: 'View tools' })).toBeNull()
    expect(screen.queryByRole('button', { name: ENTER_FULLSCREEN_LABEL })).toBeNull()
    expect(screen.queryByRole('region', { name: 'Selected' })).toBeNull()
    const opener = screen.getByRole('button', { name: OPEN_TREE_LABEL })
    expect(document.getElementById(opener.getAttribute('aria-describedby')!)?.textContent).toBe(OPEN_TREE_NOTE)
    // Directly after the host, outside the box that expands.
    expect(host().nextElementSibling?.contains(opener)).toBe(true)
  })
  it('a press anywhere on the still opens full screen; Escape returns focus to the opener', async () => {
    await readyTab()
    const wrap = await waitFor(() => {
      const w = document.querySelector<HTMLElement>('.sr-ft-boxwrap[role="img"]')
      expect(w).not.toBeNull()
      return w!
    })
    fireEvent.click(wrap)
    await waitFor(() => expect(expanded()).toBe(true))
    expect(await screen.findByRole('region', { name: 'Selected' })).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(expanded()).toBe(false))
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: OPEN_TREE_LABEL })))
  })
  it('the selection, expansion and zoom made in full screen are there on the next open', async () => {
    await readyTab()
    fireEvent.click(screen.getByRole('button', { name: OPEN_TREE_LABEL }))
    const t = await screen.findByRole('tree')
    await waitFor(() => expect(t.querySelectorAll('[role="treeitem"]').length).toBeGreaterThan(0))
    const tools = screen.getByRole('toolbar', { name: 'View tools' })
    fireEvent.click(within(tools).getByRole('button', { name: 'Zoom out' }))
    fireEvent.keyDown(t, { key: 'ArrowDown' })
    await waitFor(() => expect(t.getAttribute('aria-activedescendant')).not.toBeNull())
    const activeLabel = document.getElementById(t.getAttribute('aria-activedescendant')!)!.getAttribute('aria-label')
    const zoom = document.querySelector('.sr-ft-zoomval')!.textContent
    fireEvent.click(exits()[0])
    await waitFor(() => expect(expanded()).toBe(false))
    fireEvent.click(screen.getByRole('button', { name: OPEN_TREE_LABEL }))
    await waitFor(() => expect(expanded()).toBe(true))
    const t2 = await screen.findByRole('tree')
    await waitFor(() => expect(t2.getAttribute('aria-activedescendant')).not.toBeNull())
    expect(document.getElementById(t2.getAttribute('aria-activedescendant')!)!.getAttribute('aria-label')).toBe(activeLabel)
    expect(document.querySelector('.sr-ft-zoomval')!.textContent).toBe(zoom)
  })
})

describe('the toolbar toggle above the still tier (design-spec 10.3)', () => {
  beforeEach(() => { H.release(); H.phone = false })
  it('enters and leaves full screen with the maps\' own names, last in the toolbar, and focus stays on it', async () => {
    await readyTab()
    await screen.findByRole('tree')
    expect(screen.queryByRole('button', { name: OPEN_TREE_LABEL })).toBeNull()
    const toggle = screen.getByRole('button', { name: ENTER_FULLSCREEN_LABEL })
    expect(toggle.getAttribute('aria-pressed')).toBe('false')
    expect(toggle.parentElement?.lastElementChild).toBe(toggle)
    toggle.focus()
    fireEvent.click(toggle)
    await waitFor(() => expect(expanded()).toBe(true))
    const exit = screen.getByRole('button', { name: EXIT_FULLSCREEN_LABEL })
    expect(exit.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(exit)
    await waitFor(() => expect(expanded()).toBe(false))
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: ENTER_FULLSCREEN_LABEL })))
  })
  it('its two names are the maps\' toggle\'s names', () => {
    const src = readFileSync(resolve('src/components/map/MapCornerControls.tsx'), 'utf8')
    expect(src).toContain(`expanded ? EXIT_FULLSCREEN_LABEL : '${ENTER_FULLSCREEN_LABEL}'`)
  })
})

describe('what this build does not do (QA-99)', () => {
  it('no tree rule or source line names the bar or its root attribute, and no tree rule in full screen sets a level', () => {
    const css = readFileSync(resolve('src/globals.css'), 'utf8')
    const ftRules = css.split('}').filter(b => b.includes('.sr-ft-'))
    for (const b of ftRules) {
      expect(b.includes('sr-navbar'), b.slice(0, 80)).toBe(false)
      expect(b.includes(FS_OPEN_ATTR), b.slice(0, 80)).toBe(false)
      if (b.includes(MAP_FS_PANEL_CLASS)) expect(/z-index/.test(b), b.slice(0, 80)).toBe(false)
    }
    // Comments stripped: the source explains in prose why it uses neither.
    const tab = readFileSync(resolve('src/components/familyTree/FamilyTreeTab.tsx'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map(l => l.replace(/^\s*\/\/.*$/, '').replace(/\s\/\/ .*$/, '')).join('\n')
    expect(tab.includes('sr-navbar') || tab.includes(FS_OPEN_ATTR)).toBe(false)
    expect(tab).toContain("baseClass: 'sr-ft-host'")
    expect(tab).not.toContain('hostClassName')
  })
})

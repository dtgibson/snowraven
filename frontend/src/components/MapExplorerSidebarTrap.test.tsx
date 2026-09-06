// @vitest-environment jsdom
//
// improve: focusable-selector-single-source — the mobile filters sidebar's focus
// trap, after it moved off its own hand-rolled copy of the focusable selector
// and onto the shared `useFocusTrap` with `containOutsideFocus` and its own
// visibility filter layered on top.
//
// WHAT THIS FILE PROVES, and why each half needs the other:
//  - CONTAINMENT (the opt-in): focus that lands outside the open sidebar is
//    pulled back with no keydown at all — the v1.0.15 property that makes the
//    engine's tab order irrelevant. It is NOT armed while the sidebar is closed.
//  - THE FILTER (the thing the opt-in would otherwise break): `focusablesIn` is
//    a selector query with no visibility filtering, so handing its raw list to
//    the trap would admit the CSS-collapsed filter panel's controls — content
//    clipped to zero height with `inert` on its wrapper, which no selector can
//    see. The trap would then park focus on something invisible. The sidebar's
//    predicate is what keeps that out, and this file measures the SHIPPED
//    predicate (imported, not copied) against the real collapsed panel.
//
//  - THE TIER (what keeps the opt-in honest): the sidebar is an overlay only in
//    the ≤640 phone tier and under `.sr-map-ios-fullscreen`, and `sidebarOpen` is
//    plain state that would otherwise survive a phone→landscape rotation and
//    leave the trap armed on an in-flow, non-modal column with its Close button
//    hidden. The last block measures the TRANSITION in both directions.
//
// WHAT IT CANNOT PROVE, stated rather than implied: that WebKit's real tab order
// reaches these controls, and that the sidebar is visually an overlay at the
// widths where this trap arms. jsdom has neither a tab order nor a layout
// engine, and it loads no stylesheet — which is also why BOTH the width and the
// `offsetParent` half of the shipped predicate have to be supplied here (the two
// stubs below).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor, within, act } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { ObservationEntry } from '../types'
import { focusablesIn } from '../lib/useFocusTrap'

// ── Mocks: everything below the sidebar (maplibre, network, disk) ────────────
vi.mock('react-map-gl/maplibre', () => ({
  useMap: () => ({ current: null }),
  Marker: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Popup: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Source: ({ children }: { children?: ReactNode }) => <>{children}</>,
  Layer: () => null,
}))
vi.mock('./SnowMap', () => ({ SnowMap: ({ children }: { children?: ReactNode }) => <div>{children}</div> }))
vi.mock('./AtlasLayer', () => ({ AtlasLayer: () => null }))
vi.mock('./map/CountyLayer', () => ({ CountyLayer: () => null }))
vi.mock('./map/SightingMarkers', () => ({ SightingMarkers: () => null }))
vi.mock('./map/HotspotMarkers', () => ({ HotspotMarkers: () => null }))
vi.mock('./map/TargetMarkers', () => ({ TargetMarkers: () => null }))
vi.mock('./map/NearbyLiferMarkers', () => ({ NearbyLiferMarkers: () => null }))
vi.mock('./map/BasemapDesaturation', () => ({ BasemapDesaturation: () => null }))
vi.mock('./map/SharePin', () => ({ SharePin: () => null }))
vi.mock('./map/SharePopup', () => ({ SharePopup: () => null }))
vi.mock('./map/MapControls', () => ({
  MapEffects: () => null, BoundsTracker: () => null, DetectedLocationPin: () => null,
  CenterPinDropper: () => null, CenterPin: () => null,
}))
vi.mock('../lib/useHotspotSet', () => ({ useHotspotSet: () => ({ isPublicHotspot: () => false }) }))
vi.mock('../lib/useCountyCompleteness', () => ({
  useCountyCompleteness: () => ({
    summaryFor: () => null, resultFor: () => null,
    onViewportCounties: () => {}, requestCounty: () => {},
  }),
  EBIRD_NO_KEY_MESSAGE: 'no key',
}))
vi.mock('../lib/transport', () => ({
  transport: { get: vi.fn().mockResolvedValue([]), post: vi.fn().mockResolvedValue({ codes: {} }) },
  TransportError: class extends Error {},
}))
vi.mock('../lib/storage', () => ({
  storage: {
    getApiKey: vi.fn().mockResolvedValue('k'),
    getSetting: vi.fn().mockResolvedValue(null),
    setSetting: vi.fn().mockResolvedValue(undefined),
    getFilesStatus: vi.fn(async () => ({ ebird: true, ml: false })),
  },
}))

const OBS: ObservationEntry[] = [
  {
    submissionId: 'S1', commonName: "Steller's Jay", scientificName: 'Cyanocitta stelleri',
    date: '2026-05-01', location: 'Tilden Park', locationId: 'L1',
    latitude: 37.9, longitude: -122.24, county: 'Alameda',
    count: 2, breedingCode: null, speciesComments: '', catalogIds: [], stateProvince: 'US-CA',
  },
]

vi.mock('../lib/observationsCache', () => ({
  loadEbirdObservations: vi.fn(async () => ({ observations: OBS })),
}))
vi.mock('../lib/mlExportCache', () => ({
  loadMLExport: vi.fn(async () => ({ rows: [], mediaMap: {} })),
}))

import { MapExplorer, SIDEBAR_VISIBLE } from './MapExplorer'

// THE ONE PRIMITIVE JSDOM DOES NOT HAVE, and it is supplied rather than designed
// around. `HTMLElement.offsetParent` is null on EVERY element in jsdom — measured,
// not assumed — because jsdom implements no layout. The shipped predicate reads
// it, so without a stub the sidebar's trap list is empty in every test here and
// every row below would pass vacuously against a trap doing nothing at all.
//
// The stub answers the question jsdom cannot: "is this element rendered?" — for
// a connected element, yes. That is deliberately WEAKER than a browser's
// offsetParent (it knows nothing about `display: none`, which is the other thing
// the real predicate rejects), and that weakness is safe HERE because the
// exclusion these rows measure is the `[inert]` half, which is an attribute and
// therefore real in jsdom. The `display: none` half is a browser claim and is
// left as one.
// THE SECOND PRIMITIVE JSDOM DOES NOT HAVE: `window.matchMedia` does not exist
// there at all, so `useIsPhone()` falls back to its `false` snapshot and the
// component correctly treats every test as a desktop width. Without this stub the
// sidebar could not be opened at all — which is itself the fix working, and would
// make every row below vacuous. `setViewport` also NOTIFIES its listeners, which
// is what lets the transition rows move the viewport under a mounted component
// the way a rotation does.
const mqlListeners = new Set<() => void>()
let phoneWidth = true
function stubMatchMedia() {
  phoneWidth = true
  mqlListeners.clear()
  window.matchMedia = ((query: string) => ({
    get matches() { return query.includes('max-width') ? phoneWidth : false },
    media: query,
    onchange: null,
    addEventListener: (_t: string, cb: () => void) => { mqlListeners.add(cb) },
    removeEventListener: (_t: string, cb: () => void) => { mqlListeners.delete(cb) },
    addListener: (cb: () => void) => { mqlListeners.add(cb) },
    removeListener: (cb: () => void) => { mqlListeners.delete(cb) },
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}
/** Move the viewport across the tier boundary, the way a rotation does. */
function setViewport(phone: boolean) {
  phoneWidth = phone
  act(() => { for (const cb of mqlListeners) cb() })
}

let restoreOffsetParent: (() => void) | null = null
function stubOffsetParent() {
  const proto = HTMLElement.prototype
  const original = Object.getOwnPropertyDescriptor(proto, 'offsetParent')
  Object.defineProperty(proto, 'offsetParent', {
    configurable: true,
    get(this: HTMLElement) { return this.isConnected ? this.parentElement : null },
  })
  restoreOffsetParent = () => {
    if (original) Object.defineProperty(proto, 'offsetParent', original)
    else Reflect.deleteProperty(proto, 'offsetParent')
  }
}

beforeEach(() => { vi.clearAllMocks(); stubOffsetParent(); stubMatchMedia() })
afterEach(() => {
  cleanup()
  restoreOffsetParent?.(); restoreOffsetParent = null
  mqlListeners.clear()
  // matchMedia does not exist in jsdom natively; drop the stub between tests.
  delete (window as { matchMedia?: unknown }).matchMedia
})

function renderMap() {
  return render(
    <MapExplorer
      onGoToSettings={() => {}}
      onNavigateToMediaList={() => {}}
      keysVersion={0}
      isFullscreen={false}
      onToggleFullscreen={() => {}}
      onOpenSpecies={() => {}}
    />,
  )
}

/** The phone FAB that opens the overlay. Named unambiguously; the in-panel
 *  disclosure toggle beside it is also labelled "Filters". */
const openFab = () => screen.getByRole('button', { name: 'Open map filters' })

/** The panel disclosure toggle, resolved by what it controls. */
const panelToggle = () =>
  screen.getAllByRole('button', { name: 'Filters' })
    .find(b => b.getAttribute('aria-controls') === 'sr-map-filter-panel')!

const sidebar = () => document.querySelector('.sr-map-sidebar-overlay') as HTMLElement

/** A real control on the page BEHIND the overlay — the surface the opt-in exists
 *  to stop a keyboard user walking into. Resolved as "the first button outside
 *  the sidebar" rather than by name on purpose: the Filters FAB cannot be used
 *  for this, because its whole cluster unmounts while the sidebar is open (that
 *  is why the opener-restore needs `restoreFiltersFocusRef` in the first place),
 *  and pinning any other single label here would couple this file to map chrome
 *  it is not testing. */
function outsideControl(): HTMLElement {
  const root = sidebar()
  const found = Array.from(document.querySelectorAll<HTMLElement>('button'))
    .find(b => !root.contains(b))
  expect(found).toBeTruthy()
  return found!
}

/** Open the overlay and WAIT ON A REAL OBSERVABLE OF `sidebarOpen`.
 *
 *  Not the "Close filters" button: `.sr-map-sidebar-close` is hidden by CSS
 *  rather than conditionally rendered, and jsdom loads no stylesheet, so that
 *  button is in the DOM in every state and waiting on it waits for nothing. The
 *  Filters FAB is the honest signal — its whole cluster is gated on
 *  `!sidebarOpen`, so its DISAPPEARANCE is the flag going true and its return is
 *  the flag going false. */
async function openSidebar() {
  renderMap()
  await screen.findByRole('button', { name: 'Open map filters' })
  fireEvent.click(openFab())
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Open map filters' })).toBeNull())
  return { root: sidebar() }
}

describe('the filters sidebar contains focus on focusin (the opt-in)', () => {
  // MUTATION CHECK, both directions, run rather than cited, counts recorded over
  // the whole file (7 rows):
  //   * GATE OFF — `useFocusTrap(sidebarOpen, sidebarRef, { filter: SIDEBAR_VISIBLE })`
  //     (containment dropped, the shipped keydown-only behaviour): 3 red — the 2
  //     rows below plus the backward-escape row in the filter block, which needs
  //     containment to observe the narrowing at all.
  //   * ARMED UNCONDITIONALLY — `useFocusTrap(true, ...)`: 1 red, the "not armed
  //     while closed" row, and nothing else.
  // Neither subsumes the other, which is what the option being a per-call-site
  // decision requires.

  it('pulls focus back the instant it lands outside, with no keydown at all', async () => {
    const { root } = await openSidebar()
    const away = outsideControl()
    away.focus()
    expect(document.activeElement).not.toBe(away)
    expect(root.contains(document.activeElement)).toBe(true)
  })

  it('and the control it comes back to is one the user can actually reach', async () => {
    // The two halves composed: containment picks from the FILTERED list, so an
    // escape can never be answered by focusing collapsed-panel content.
    const { root } = await openSidebar()
    fireEvent.click(panelToggle())                       // collapse the filter panel
    await waitFor(() => expect(document.getElementById('sr-map-filter-panel')!
      .firstElementChild!.hasAttribute('inert')).toBe(true))
    outsideControl().focus()
    const landed = document.activeElement as HTMLElement
    expect(root.contains(landed)).toBe(true)
    expect(landed.closest('[inert]')).toBeNull()
  })

  it('is NOT armed while the sidebar is closed, so the page keeps its own focus', async () => {
    renderMap()
    const fab = await screen.findByRole('button', { name: 'Open map filters' })
    fab.focus()
    expect(document.activeElement).toBe(fab)
  })
})

describe('the visibility filter is load-bearing, not decoration', () => {
  // THE REGRESSION THIS BLOCK EXISTS TO REJECT. `.claude/rules/ui.md` requires
  // FOCUSABLE_SELECTOR to live in one module, and the naive way to satisfy that
  // here is to hand `focusablesIn(sidebar)` straight to the trap. That would
  // admit the sidebar's CSS-collapsed content: a collapsed disclosure here is
  // clipped with `grid-template-rows: 0fr` and marked `inert`, NOT unmounted, so
  // its controls still match the selector. They include real form controls — the
  // species combobox, both date inputs, the county select — which WebKit visits
  // whatever their tabIndex.
  //
  // THE STATE THESE ROWS SET UP, and why it is not incidental. `useFocusTrap`
  // reads only the FIRST and LAST entries of its list, so a filter that removes
  // only middle entries changes nothing the trap does. Collapsing the FILTER
  // panel alone produces exactly that (measured: raw indices 2-10 go inert, the
  // ends do not move) and every row in this file stayed green with the filter
  // deleted. So these rows also collapse the in-view list at the BOTTOM, which
  // is what puts collapsed content on an END of the raw list and makes the
  // difference reachable. A guard for a filter has to be built in a state where
  // the filter's output can differ from its input AT AN EDGE.
  //
  // MUTATION CHECK: deleting `filter: SIDEBAR_VISIBLE` from the trap options
  // (the naive consolidation) turns exactly the 2 behavioural rows below red,
  // 5 green — the containment block is untouched by it, which is the point:
  // that block measures the opt-in and this one measures the narrowing, and
  // neither substitutes for the other. Note the third row here stays GREEN under
  // that mutation, because it checks the predicate rather than the wiring; that
  // is stated at the row and is why it is not the only one.

  /** Collapse both disclosures, so the raw list's LAST entry is inert content
   *  and the filtered list's last is the disclosure toggle above it. */
  async function collapseBoth(root: HTMLElement) {
    fireEvent.click(panelToggle())
    const clip = document.getElementById('sr-map-filter-panel')!.firstElementChild as HTMLElement
    await waitFor(() => expect(clip.hasAttribute('inert')).toBe(true))
    fireEvent.click(screen.getByRole('button', { name: /Sightings in view/ }))
    const raw = focusablesIn(root)
    // The precondition, asserted rather than assumed: without it every row below
    // would pass on a trap with no filter at all.
    await waitFor(() => expect(raw[raw.length - 1].closest('[inert]')).not.toBeNull())
    return { raw, visible: raw.filter(SIDEBAR_VISIBLE), clip }
  }

  it('a backward escape comes back to a control the user can see, not to collapsed content', async () => {
    const { root } = await openSidebar()
    const { raw, visible } = await collapseBoth(root)
    expect(visible[visible.length - 1]).not.toBe(raw[raw.length - 1])

    // Shift+Tab records the direction; the escape itself is a focus move with no
    // further keydown, which is the v1.0.15 property.
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    outsideControl().focus()
    const landed = document.activeElement as HTMLElement
    expect(landed.closest('[inert]')).toBeNull()
    expect(landed).toBe(visible[visible.length - 1])
  })

  it('the end-wrap ends at the last VISIBLE control, not at the last matching one', async () => {
    const { root } = await openSidebar()
    const { visible } = await collapseBoth(root)
    visible[visible.length - 1].focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(document.activeElement).toBe(visible[0])
  })

  it('the shipped predicate drops collapsed-panel controls and keeps the rest', async () => {
    // The mechanism behind the two rows above, stated directly. This one is a
    // unit check on the imported predicate and CANNOT catch the trap being wired
    // without it — which is why it is third and not alone.
    const { root } = await openSidebar()
    const { raw, visible, clip } = await collapseBoth(root)
    const dropped = raw.filter(el => !visible.includes(el))

    expect(dropped.length).toBeGreaterThan(0)
    expect(visible.length).toBeGreaterThan(0)
    for (const el of dropped) expect(el.closest('[inert]')).not.toBeNull()
    for (const el of visible) expect(el.closest('[inert]')).toBeNull()
    // Named individually so a future change that moves them out reads as a moved
    // control rather than as a number that drifted.
    expect(within(clip).getByRole('combobox', { name: 'Species' })).toBeTruthy()
    expect(clip.querySelectorAll('input[type="date"]').length).toBe(2)
  })
})

describe('opening the sidebar puts focus on its first VISIBLE control', () => {
  it('lands inside the sidebar and outside any collapsed panel', async () => {
    const { root } = await openSidebar()
    await waitFor(() => expect(root.contains(document.activeElement)).toBe(true))
    expect((document.activeElement as HTMLElement).closest('[inert]')).toBeNull()
  })
})


describe('the trap cannot outlive the tier the opt-in was argued for (security finding 1)', () => {
  // THE DEFECT THESE ROWS REJECT, and it was introduced by this build's own
  // opt-in. `sidebarOpen` is plain state with no width awareness, so it survives
  // a phone→landscape rotation, an iPad resize or a widened desktop window. Above
  // the tier the sidebar reverts to an in-flow column: no absolute positioning,
  // no backdrop, and `.sr-map-sidebar-close` goes `display: none` — so
  // `SIDEBAR_VISIBLE` filters the "Close filters" button out of the trap's OWN
  // list, removing the one always-present exit from the set the trap will land on.
  //
  // THE HONEST SPLIT, preserved from the Auditor's reading: the keydown cycle was
  // already armed on a stale `sidebarOpen` BEFORE this build, so Tab already
  // cycled once focus was inside. What the `focusin` arm added is the removal of
  // the release — a click outside used to escape the cycle, and would now be
  // undone in the same event-loop turn. This build converted an escapable-by-mouse
  // cycle into a hard capture on a non-modal region. That increase is what these
  // rows close.
  //
  // WHY THE TRANSITION IS MEASURED RATHER THAN THE END STATE. Asserting "no trap
  // at desktop width" from a fresh desktop render proves nothing: the sidebar
  // cannot be opened there, so there would be no trap either way and the row
  // would pass against the unfixed build. The defect is reachable ONLY by opening
  // inside the tier and then leaving it, so that is the sequence.
  //
  // MUTATION CHECK, run rather than cited, counts recorded over this file's 11
  // rows. TWO mutations, because two separate decisions are being pinned:
  //   * ADJUSTMENT DELETED — `if (sidebarOpen && !sidebarIsOverlay)
  //     setSidebarOpen(false)` removed: 3 red, 8 green. The fourth row here stays
  //     green, correctly — with nothing closing the sidebar, focus simply never
  //     moves, so that row is not written against this mutation.
  //   * ROUTED THROUGH `closeSidebar()` instead — the obvious alternative: 1 red,
  //     10 green, and the red one is the fourth row. (Running that mutation meant
  //     MOVING the line, because `closeSidebar` is declared below the point where
  //     the adjustment sits — the alternative is not even reachable where the
  //     real code lives, which is a happy accident rather than the defence.)

  it('leaving the phone tier releases containment: focus outside STAYS outside', async () => {
    const { root } = await openSidebar()
    // Contained while the sidebar is genuinely an overlay — the precondition,
    // asserted so a rotation that changed nothing could not pass this row.
    const away = outsideControl()
    away.focus()
    expect(root.contains(document.activeElement)).toBe(true)

    setViewport(false)   // rotate to landscape / widen past 640

    const stillThere = Array.from(document.querySelectorAll<HTMLElement>('button'))
      .find(b => !root.contains(b))!
    stillThere.focus()
    expect(document.activeElement).toBe(stillThere)
  })

  it('and the sidebar is no longer in its open state, so nothing stale is left behind', async () => {
    // `openSidebar` has already asserted the FAB is gone, i.e. the flag is true.
    await openSidebar()
    setViewport(false)
    // The FAB's RETURN is what says the flag was actually cleared. It is the only
    // honest observable here: the overlay's own chrome is hidden by CSS rather
    // than unmounted, and jsdom loads no stylesheet.
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Open map filters' })).toBeTruthy())
  })

  it('the tier close does NOT run the opener-restore, so focus is not dropped to <body>', async () => {
    // Why this is its own row: the obvious fix is to call `closeSidebar()`, which
    // arms the restore ref — and that restore targets `filtersButtonRef`, whose
    // `.sr-map-filters-btn` is `display: none` above the tier. `.focus()` on a
    // hidden button no-ops and focus falls to <body>, which is the very outcome
    // the F061 rule exists to prevent. The adjustment deliberately routes around
    // that path, so focus is left exactly where it was: on a sidebar control that
    // is still on screen and still in flow.
    const { root } = await openSidebar()
    const inside = focusablesIn(root).filter(SIDEBAR_VISIBLE)[0]
    inside.focus()
    expect(document.activeElement).toBe(inside)

    setViewport(false)

    expect(document.activeElement).toBe(inside)
    expect(document.activeElement).not.toBe(document.body)
  })

  it('returning to the phone tier does not re-open it on its own', async () => {
    // Guard-the-guard on the shape of the fix: closing the flag is a state reset,
    // not a derived value that would spring the overlay back over the map on the
    // rotation home. The user presses Filters again, which is what every other
    // close in this component leaves them to do.
    await openSidebar()
    setViewport(false)
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Open map filters' })).toBeTruthy())
    setViewport(true)
    // Still closed: the FAB is still on screen back at phone width. A derived
    // value would have consumed it again here.
    expect(screen.queryByRole('button', { name: 'Open map filters' })).toBeTruthy()
  })
})

// @vitest-environment jsdom
//
// feature: uniform-map-fabs — the centre-share FAB, the third disc on Hotspots,
// Nearby Lifers and Media Targets.
//
// WHAT THIS TEST PROVES: that the button appears on the three centre views and
// nowhere else; that it opens the SAME popup the existing search-centre pin
// opens and creates no second pin; that the tint is carried by aria-expanded and
// tracks the popup rather than the raw state flag; that pressing it while open
// closes through the one close path; that focus lands on whichever control the
// user actually pressed, across both openers; that the no-centre state is
// present, reachable, and cannot set a centre; that an off-screen centre pans
// first and an on-screen one does not; and that the row's glyphs stay three
// distinct silhouettes. feature: center-share-latch then adds one section: that
// clearing a coordinate does not leave the popup latched open behind it.
//
// That section lives here rather than in a second file beside it because the
// popup's open flag lives in MapExplorer, so the mocks below are exactly the
// ones it needs, and because this file already carried the two assertions the
// fix makes stale (both amended in place, neither weakened).
//
// WHAT IT CANNOT PROVE (per CLAUDE.md, and NOT evidence for): anything
// geometric or cascade-dependent. jsdom has no layout engine, no media queries,
// and does not resolve the cascade against React inline styles, so it cannot
// show that the three discs fit 320px at 200% text scale, that the glyph tracks
// the box, that the dashed border renders, or that the hover rule loses to the
// tint. Those are a stylesheet guard (lib/mapFabClusterCss.test.ts) plus browser
// measurements, written up in pipeline/uniform-map-fabs/pr-description.md.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor, fireEvent, act } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { ObservationEntry } from '../types'

// ── Mocks: everything below the component (maplibre, network, disk) ──────────
vi.mock('react-map-gl/maplibre', () => ({
  useMap: () => ({ current: null }),
  Marker: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Popup: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}))
vi.mock('./SnowMap', () => ({ SnowMap: ({ children }: { children?: ReactNode }) => <div data-testid="snowmap">{children}</div> }))
vi.mock('./AtlasLayer', () => ({ AtlasLayer: () => null }))
vi.mock('./map/CountyLayer', () => ({ CountyLayer: () => null }))
vi.mock('./map/SightingMarkers', () => ({ SightingMarkers: () => null }))
vi.mock('./map/HotspotMarkers', () => ({ HotspotMarkers: () => null }))
vi.mock('./map/TargetMarkers', () => ({ TargetMarkers: () => null }))
vi.mock('./map/NearbyLiferMarkers', () => ({ NearbyLiferMarkers: () => null }))
vi.mock('./map/BasemapDesaturation', () => ({ BasemapDesaturation: () => null }))

// SharePopup is stubbed to a marker div rather than mocked away: what matters
// here is WHICH popup opens and with which coordinates, not its body. The stub
// records its props so "the FAB opens the same popup the pin opens, at the same
// coordinates, with the same close path" is observable.
const popupProps = vi.hoisted(() => ({ last: null as null | Record<string, unknown> }))
vi.mock('./map/SharePopup', () => ({
  SharePopup: (props: Record<string, unknown>) => {
    popupProps.last = props
    return (
      <div data-testid="share-popup" data-lat={String(props.lat)} data-lng={String(props.lng)}>
        <button type="button" onClick={props.onClose as () => void}>stub close</button>
      </div>
    )
  },
}))

// MapEffects is the panTarget consumer. Stubbed to record what it is handed, so
// the pan decision is observable without a map instance.
const pans = vi.hoisted(() => ({ seen: [] as Array<{ lat: number; lng: number } | null> }))
// BoundsTracker is stubbed to report a viewport the test chooses. The value is
// the PADDED box the real tracker reports (it grows the viewport by
// VIEWPORT_PAD_FRAC), because that is what the component receives and has to
// un-pad before deciding.
const bounds = vi.hoisted(() => ({ value: null as null | [number, number, number, number] }))
// CenterPinDropper still renders nothing; it just hands its onDrop out so the
// right-click / long-press route into applyCenter is reachable from a test.
const drop = vi.hoisted(() => ({ onDrop: null as null | ((lat: number, lng: number) => void) }))
vi.mock('./map/MapControls', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./map/MapControls')>()
  const { useEffect } = await import('react')
  return {
    ...actual,
    MapEffects: (props: { panTarget: { lat: number; lng: number } | null }) => {
      pans.seen.push(props.panTarget)
      return null
    },
    BoundsTracker: ({ onBounds }: { onBounds: (b: [number, number, number, number]) => void }) => {
      useEffect(() => { if (bounds.value) onBounds(bounds.value) }, [onBounds])
      return null
    },
    DetectedLocationPin: () => null,
    CenterPinDropper: (props: { onDrop: (lat: number, lng: number) => void }) => {
      drop.onDrop = props.onDrop
      return null
    },
  }
})

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
    getFilesStatus: vi.fn(async () => ({ ebird: true, ml: true })),
  },
}))

const OBS: ObservationEntry[] = [{
  submissionId: 'S1', commonName: "Steller's Jay", scientificName: 'Cyanocitta stelleri',
  date: '2026-05-01', location: 'Tilden Park', locationId: 'L1',
  latitude: 37.9, longitude: -122.24,
  county: 'Alameda',
  count: 2, breedingCode: null, speciesComments: '', catalogIds: [],
  stateProvince: 'US-CA',
}]
vi.mock('../lib/observationsCache', () => ({
  loadEbirdObservations: vi.fn(async () => ({ observations: OBS })),
}))
vi.mock('../lib/mlExportCache', () => ({
  loadMLExport: vi.fn(async () => ({ rows: [], mediaMap: {} })),
}))

import { MapExplorer } from './MapExplorer'

const READY = 'Copy the search center location'
const OPEN = 'Close the location popup'
const EMPTY = 'Set a search center to copy its location'

const CENTRE_VIEWS = ['Hotspots', 'Media Targets', 'Nearby Lifers'] as const

const cluster = () => document.querySelector('.sr-map-fab-cluster') as HTMLElement
const fab = () => document.querySelector('.sr-map-center-share-btn') as HTMLButtonElement | null
const popup = () => screen.queryByTestId('share-popup')
const pin = () => screen.queryByRole('button', { name: /Copy this location$/ })

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

async function ready() {
  await waitFor(() => expect(cluster()).toBeTruthy())
}

/** Switch to a centre view and type a centre in, which is what mounts the pin. */
async function centreView(mode: string = 'Hotspots', lat = '37.90000', lng = '-122.24000') {
  fireEvent.click(screen.getByRole('button', { name: mode }))
  await waitFor(() => expect(fab()).toBeTruthy())
  if (lat) {
    fireEvent.change(screen.getByLabelText('Latitude'), { target: { value: lat } })
    fireEvent.change(screen.getByLabelText('Longitude'), { target: { value: lng } })
    await waitFor(() => expect(fab()!.getAttribute('aria-disabled')).toBe('false'))
  }
}

beforeEach(() => { popupProps.last = null; pans.seen = []; bounds.value = null; drop.onDrop = null })
afterEach(() => { cleanup(); vi.clearAllMocks() })

// ── Presence ─────────────────────────────────────────────────────────────────

describe('where the centre-share FAB appears', () => {
  it('is on all three centre views, in the share slot position', async () => {
    renderMap()
    await ready()
    for (const mode of CENTRE_VIEWS) {
      fireEvent.click(screen.getByRole('button', { name: mode }))
      await waitFor(() => expect(fab()).toBeTruthy())
      const kids = Array.from(cluster().children) as HTMLElement[]
      // Message row, then the (empty) share slot, then this button, then locate,
      // fullscreen, Filters. DOM order is visual order is tab order.
      expect(kids[0].className).toBe('sr-map-geo-error')
      expect(kids[1].className).toBe('sr-map-fab-slot')
      expect(kids[1].children.length).toBe(0)
      expect(kids[2]).toBe(fab())
      expect(kids[3].className).toContain('sr-map-locate-btn')
      expect(kids[4].className).toContain('sr-map-fullscreen-btn')
      for (const el of kids) expect(el.style.order).toBe('')
    }
  })

  it('is absent on My Sightings, where SharePin owns the slot instead', async () => {
    renderMap()
    await ready()
    expect(fab()).toBeNull()
    // The two are mutually exclusive, so exactly one share-family disc exists on
    // every view — which is what lets both wear the same green without the same
    // green ever meaning two things at once.
    expect(cluster().querySelector('.sr-share-drop-btn')).toBeTruthy()
    await centreView()
    expect(cluster().querySelector('.sr-share-drop-btn')).toBeNull()
  })

  it('carries the shared base and exactly one size modifier', async () => {
    renderMap()
    await ready()
    await centreView()
    const cls = fab()!.className.split(/\s+/)
    expect(cls).toContain('sr-map-fab')
    expect(cls.filter(c => c.startsWith('sr-map-fab--'))).toEqual(['sr-map-fab--std'])
  })
})

// ── The three designed states ────────────────────────────────────────────────

describe('states', () => {
  it('is aria-disabled with a how-to name when no centre is set', async () => {
    renderMap()
    await ready()
    await centreView('Hotspots', '')       // no coordinates typed
    const b = fab()!
    expect(b.getAttribute('aria-disabled')).toBe('true')
    expect(b.getAttribute('aria-label')).toBe(EMPTY)
    expect(b.getAttribute('title')).toBe(EMPTY)
    // aria-disabled, never the native attribute: a natively disabled button
    // drops out of the tab order and loses focus.
    expect(b.hasAttribute('disabled')).toBe(false)
    // It discloses nothing, so it claims no expanded state at all.
    expect(b.hasAttribute('aria-expanded')).toBe(false)
    // Reachable, so a keyboard user can read the name that says what to do.
    b.focus()
    expect(document.activeElement).toBe(b)
  })

  it('does nothing at all when pressed with no centre (it must not set one)', async () => {
    // A real viewport, so the pan path is LIVE. Without this the handler's early
    // return is unobservable: with null bounds nothing arms a pan either way,
    // and the test passes on a build that has dropped the guard. With bounds in
    // hand, dropping the guard reaches pointNeedsPan(NaN, NaN, …) — every NaN
    // comparison is false, so the point reads as out of view and the map is
    // asked to fly to NaN.
    bounds.value = [-123, 37, -121, 39]
    renderMap()
    await ready()
    await centreView('Hotspots', '')
    fireEvent.click(fab()!)
    expect(popup()).toBeNull()
    expect(pin()).toBeNull()
    expect(pans.seen.filter(Boolean)).toEqual([])
    expect(fab()!.getAttribute('aria-label')).toBe(EMPTY)

    // The second observable: the press must not LATCH. Setting a centre here
    // would re-run the view's search, and a latched open flag would pop the
    // popup the instant a centre arrived from any other route.
    //
    // As of center-share-latch this half no longer discriminates on its own —
    // the cleared-centre adjustment would clear a flag set here anyway, in the
    // same render pass — and it is kept rather than deleted because the pan
    // assertion above still rejects dropping the early return, which is the
    // mutation both halves were written against. The latch itself is rejected
    // by the cleared-centre describe block below.
    fireEvent.change(screen.getByLabelText('Latitude'), { target: { value: '37.90000' } })
    fireEvent.change(screen.getByLabelText('Longitude'), { target: { value: '-122.24000' } })
    await waitFor(() => expect(fab()!.getAttribute('aria-disabled')).toBe('false'))
    expect(popup()).toBeNull()
    expect(fab()!.getAttribute('aria-expanded')).toBe('false')
  })

  it('names and marks itself by whether the popup is on screen', async () => {
    renderMap()
    await ready()
    await centreView()
    expect(fab()!.getAttribute('aria-label')).toBe(READY)
    expect(fab()!.getAttribute('aria-expanded')).toBe('false')
    expect(fab()!.getAttribute('aria-disabled')).toBe('false')

    fireEvent.click(fab()!)
    await waitFor(() => expect(popup()).toBeTruthy())
    expect(fab()!.getAttribute('aria-expanded')).toBe('true')
    expect(fab()!.getAttribute('aria-label')).toBe(OPEN)
    // aria-EXPANDED, not aria-pressed: this button holds nothing, it discloses a
    // popup. Its neighbour's aria-pressed means "this map is holding a pin".
    expect(fab()!.hasAttribute('aria-pressed')).toBe(false)
  })

  /**
   * Clearing a coordinate field unmounts the popup. As of center-share-latch
   * the open flag is cleared on that same edge, so the two flags now agree in
   * every state — but what this button renders when it discloses nothing is
   * still a live choice, and the uniform-map-fabs decision settled it as no
   * aria-expanded AT ALL rather than aria-expanded="false".
   *
   * WHAT THIS REJECTS, stated precisely, because the obvious reading is wrong.
   * It does NOT reject `aria-expanded={hasValidCenter ? centerShareOpen : …}`:
   * inside that gate the two flags are equal in every state this button can
   * observe (`centerShareShown` is `isCenterView && hasValidCenter &&
   * centerShareOpen`, and the first two are already true wherever the button
   * renders), so those two spellings are genuinely equivalent and swapping them
   * leaves the whole suite green. Verified by mutation during uniform-map-fabs,
   * and recorded rather than papered over.
   *
   * What it DOES reject is dropping the `hasValidCenter` gate — which is the
   * part that carries the property — leaving the button asserting an expanded
   * state on a press that can disclose nothing.
   */
  it('drops the expanded state when the popup unmounts because the centre was cleared', async () => {
    renderMap()
    await ready()
    await centreView()
    fireEvent.click(fab()!)
    await waitFor(() => expect(fab()!.getAttribute('aria-expanded')).toBe('true'))

    fireEvent.change(screen.getByLabelText('Latitude'), { target: { value: '' } })
    await waitFor(() => expect(popup()).toBeNull())
    expect(fab()!.getAttribute('aria-expanded')).toBeNull()
    expect(fab()!.getAttribute('aria-disabled')).toBe('true')
    expect(fab()!.getAttribute('aria-label')).toBe(EMPTY)
  })
})

// ── The cleared-centre latch ─────────────────────────────────────────────────

/**
 * feature: center-share-latch.
 *
 * Clearing a coordinate while the popup is open unmounts it (the popup is gated
 * on `centerShareShown`) without routing through closeCenterShare, so the open
 * flag was left set with nothing on screen and the NEXT centre to arrive
 * re-opened the popup on its own, by any route.
 *
 * These three fail on the pre-change component. Verified by mutation, not
 * assumed: removing the one-line render adjustment in MapExplorer.tsx turns the
 * first two red, and swapping it for the remediation the v0.5.84 security
 * report recommended (route the cleared path through closeCenterShare) turns
 * the third red. All 89 tests that existed across the four share suites before
 * this build are green either way, so none of them rejected any of it.
 *
 * Two routes are exercised rather than all four, and that is the whole range on
 * purpose: every way of setting a centre lands in the same `lat`/`lng` state,
 * which is what the guard reads, so the retyped case and the dropped case are
 * the two ends of one path. The drop is here by name because applyCenter's own
 * comment promises a drop-to-search stays visually identical to today, and with
 * the flag latched that promise did not hold.
 */
describe('a cleared centre does not leave the popup latched open', () => {
  it('stays closed when the centre is typed back in', async () => {
    renderMap()
    await ready()
    await centreView()
    fireEvent.click(fab()!)
    await waitFor(() => expect(popup()).toBeTruthy())

    fireEvent.change(screen.getByLabelText('Latitude'), { target: { value: '' } })
    await waitFor(() => expect(popup()).toBeNull())

    fireEvent.change(screen.getByLabelText('Latitude'), { target: { value: '37.90000' } })
    await waitFor(() => expect(fab()!.getAttribute('aria-disabled')).toBe('false'))
    expect(popup()).toBeNull()
    // The button agrees: nothing is disclosed, and it offers to open rather
    // than to close.
    expect(fab()!.getAttribute('aria-expanded')).toBe('false')
    expect(fab()!.getAttribute('aria-label')).toBe(READY)
    // Still one press away, so closing the latch has not disabled the control.
    fireEvent.click(fab()!)
    await waitFor(() => expect(popup()).toBeTruthy())
  })

  it('stays closed when a right-click drop sets the centre', async () => {
    renderMap()
    await ready()
    await centreView()
    fireEvent.click(pin()!)                       // opened from the pin this time
    await waitFor(() => expect(popup()).toBeTruthy())

    fireEvent.change(screen.getByLabelText('Longitude'), { target: { value: '' } })
    await waitFor(() => expect(popup()).toBeNull())

    expect(drop.onDrop).toBeTruthy()
    await act(async () => { drop.onDrop!(38.20000, -122.50000) })
    // The drop did set the centre — otherwise "no popup" would prove nothing.
    await waitFor(() => expect((screen.getByLabelText('Longitude') as HTMLInputElement).value).toBe('-122.50000'))
    expect(popup()).toBeNull()
    expect(fab()!.getAttribute('aria-expanded')).toBe('false')
  })

  /**
   * The guard against the remediation the security report recommended, named
   * here so the next person to read that report does not "fix" it back.
   * closeCenterShare arms restoreCenterPinFocusRef, and the effect keyed on the
   * open flag then moves focus to the opener. On this edge the opener has
   * unmounted with the pin, so focus falls through to the centre-share FAB:
   * backspacing a coordinate field would throw the caret out of the field
   * mid-edit. The fix is a bare setState that leaves the focus path alone.
   */
  it('leaves focus in the field being edited when the centre is cleared', async () => {
    renderMap()
    await ready()
    await centreView()
    fireEvent.click(pin()!)
    await waitFor(() => expect(popup()).toBeTruthy())

    const latInput = screen.getByLabelText('Latitude') as HTMLInputElement
    latInput.focus()
    fireEvent.change(latInput, { target: { value: '' } })
    await waitFor(() => expect(popup()).toBeNull())

    expect(document.activeElement).toBe(latInput)
    // Named rather than left to the negation above: this exact button is where
    // the wrong remediation puts the caret.
    expect((document.activeElement as HTMLElement).getAttribute('aria-label')).not.toBe(EMPTY)
  })
})

// ── One popup, one pin, one close path ───────────────────────────────────────

describe('it is a second route to the existing pin\'s popup', () => {
  it('opens the same popup at the same coordinates, and creates no second pin', async () => {
    renderMap()
    await ready()
    await centreView()
    // One pin before...
    expect(screen.getAllByRole('button', { name: /Copy this location$/ })).toHaveLength(1)

    fireEvent.click(fab()!)
    await waitFor(() => expect(popup()).toBeTruthy())

    // ...and one pin after. The FAB plants nothing.
    expect(screen.getAllByRole('button', { name: /Copy this location$/ })).toHaveLength(1)
    expect(document.querySelectorAll('.sr-share-pin')).toHaveLength(0)
    // Exactly one popup, carrying the centre's own coordinates and the shipped
    // non-compact / offset-32 props the pin already passed.
    expect(screen.getAllByTestId('share-popup')).toHaveLength(1)
    expect(popup()!.getAttribute('data-lat')).toBe('37.9')
    expect(popup()!.getAttribute('data-lng')).toBe('-122.24')
    expect(popupProps.last!.compact).toBe(false)
    expect(popupProps.last!.offset).toBe(32)
  })

  it('routes a second press through the one close path', async () => {
    renderMap()
    await ready()
    await centreView()
    fireEvent.click(fab()!)
    await waitFor(() => expect(popup()).toBeTruthy())
    const onClose = popupProps.last!.onClose

    fireEvent.click(fab()!)
    await waitFor(() => expect(popup()).toBeNull())
    expect(fab()!.getAttribute('aria-expanded')).toBe('false')
    // The FAB's close is the popup's own close: same function identity, so
    // there is no second teardown path that could diverge from it.
    expect(onClose).toBe(popupProps.last!.onClose)
  })

  it('reads the same open state as the pin, so either control closes it', async () => {
    renderMap()
    await ready()
    await centreView()
    fireEvent.click(pin()!)                       // opened from the PIN
    await waitFor(() => expect(popup()).toBeTruthy())
    // The tint tells you the popup is open even when the pin is off screen.
    expect(fab()!.getAttribute('aria-expanded')).toBe('true')

    fireEvent.click(fab()!)                       // closed from the FAB
    await waitFor(() => expect(popup()).toBeNull())
  })
})

// ── Focus ────────────────────────────────────────────────────────────────────

/**
 * The popup now has TWO openers, so "restore focus to the opener" has to
 * actually mean it. The pre-change component focused the centre pin
 * unconditionally; both halves below are written so that reverting to that
 * behaviour fails the FAB case while the pin case stays green — a single case
 * would not discriminate.
 */
describe('focus restoration', () => {
  it('returns focus to the FAB when the FAB opened it', async () => {
    renderMap()
    await ready()
    await centreView()
    fab()!.focus()
    fireEvent.click(fab()!)
    await waitFor(() => expect(popup()).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: 'stub close' }))
    await waitFor(() => expect(popup()).toBeNull())
    expect(document.activeElement).toBe(fab())
  })

  it('still returns focus to the pin when the pin opened it', async () => {
    renderMap()
    await ready()
    await centreView()
    pin()!.focus()
    fireEvent.click(pin()!)
    await waitFor(() => expect(popup()).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: 'stub close' }))
    await waitFor(() => expect(popup()).toBeNull())
    expect(document.activeElement).toBe(pin())
  })

  it('keeps focus on the FAB when the FAB closes a pin-opened popup', async () => {
    // Pressing a button must never move focus off that button. The recorded
    // opener is the PIN here, so a naive "restore to the opener" would jump.
    renderMap()
    await ready()
    await centreView()
    fireEvent.click(pin()!)
    await waitFor(() => expect(popup()).toBeTruthy())

    fab()!.focus()
    fireEvent.click(fab()!)
    await waitFor(() => expect(popup()).toBeNull())
    expect(document.activeElement).toBe(fab())
  })
})

// ── Pan to an off-screen centre ──────────────────────────────────────────────

/**
 * A popup that opens off screen is a press that looks dead, so an off-screen
 * centre is flown to first. Written as a PAIR: the negative case alone passes on
 * an implementation that never pans at all, and the positive case alone passes
 * on one that always pans (600ms of motion on an unchanged view, which the
 * motion doctrine forbids). The arithmetic itself is unit-tested in
 * lib/markersInView.test.ts; what these two prove is the WIRING.
 */
describe('pan to the centre', () => {
  /** panTargets actually armed, in order (MapEffects also sees the null resets). */
  const armed = () => pans.seen.filter(Boolean) as Array<{ lat: number; lng: number }>

  it('does not pan when the centre is inside the visible view', async () => {
    // A padded box whose VISIBLE half (the padded span shrunk by 0.15/1.3 a
    // side) still contains 37.9 / -122.24, comfortably.
    bounds.value = [-123, 37, -121, 39]
    renderMap()
    await ready()
    await centreView()
    fireEvent.click(fab()!)
    await waitFor(() => expect(popup()).toBeTruthy())
    expect(armed()).toEqual([])
  })

  it('pans to the centre, and only the centre, when it is off screen', async () => {
    bounds.value = [-70, 40, -68, 42]                  // the map is over Maine
    renderMap()
    await ready()
    await centreView()
    fireEvent.click(fab()!)
    await waitFor(() => expect(popup()).toBeTruthy())
    // A camera move only: the coordinate armed is the centre the popup shows,
    // the fields are untouched, and the pin has not moved.
    expect(armed()).toEqual([{ lat: 37.9, lng: -122.24 }])
    expect((screen.getByLabelText('Latitude') as HTMLInputElement).value).toBe('37.90000')
    expect(popup()!.getAttribute('data-lat')).toBe('37.9')
  })

  it('does not pan when the map has not reported a viewport yet', async () => {
    // bounds stay null: nothing has moved from the centre the map was framed on,
    // so an unnecessary 600ms flight would be motion for its own sake.
    renderMap()
    await ready()
    await centreView('Nearby Lifers')
    fireEvent.click(fab()!)
    await waitFor(() => expect(popup()).toBeTruthy())
    expect(armed()).toEqual([])
  })
})

// ── The glyph row ────────────────────────────────────────────────────────────

describe('the glyphs on a centre view', () => {
  it('are a teardrop centre pin against a crosshair, each naming its object', async () => {
    renderMap()
    await ready()
    await centreView()
    // MapPin is the same teardrop-with-a-dot CenterPin draws: the button is a
    // picture of the pin whose popup it opens.
    expect(fab()!.querySelector('svg.lucide-map-pin')).toBeTruthy()
    expect(fab()!.querySelector('svg.lucide-flag-triangle-right')).toBeNull()
    const locate = screen.getByRole('button', { name: 'Center the map on my location' })
    expect(locate.querySelector('svg.lucide-locate-fixed')).toBeTruthy()
    // Different silhouettes, so the pair survives grayscale.
    expect(locate.querySelector('svg.lucide-map-pin')).toBeNull()
  })

  it('gives the fullscreen glyph the family size and weight', async () => {
    renderMap()
    await ready()
    const svg = screen.getByRole('button', { name: 'Enter fullscreen' }).querySelector('svg')!
    // The px attributes are the no-CSS fallback; .sr-map-fab svg sizes the glyph
    // in rem so it tracks the box at 200% text scale (a browser measurement, in
    // the PR description). What is checked here is that the fallback and the
    // stroke weight now match the rest of the row rather than 16 / 2.5.
    expect(svg.getAttribute('width')).toBe('17')
    expect(svg.getAttribute('stroke-width')).toBe('2.2')
  })
})

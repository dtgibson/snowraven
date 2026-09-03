// @vitest-environment jsdom
//
// feature: map-fullscreen-toggle — the promises that make this "the same map,
// enlarged" rather than a second map: no remount (FR-09, QA-10), no re-frame
// (FR-14, QA-20), no portal (FR-11, QA-17), and an open popup and a dropped
// share pin still there after a round trip (QA-12, QA-13).
//
// Driven through the REAL SightingsMap and the REAL MapBoundsFitter, because the
// re-frame defect this feature had to fix lives in the seam between them. Only
// the outermost seams are faked: the maplibre bindings, SnowMap (which is where
// a remount would create a WebGL context), storage and the clipboard.
//
// A SOURCE-LEVEL ROSTER at the bottom covers the three hosts, one row each. The
// behavioural cases above exercise M1 and M3's shared path; the roster is what
// keeps a host that was never wired from reading as nothing at all.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
/// <reference types="node" />
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { useRef, useEffect, type ReactNode } from 'react'

type Handler = (e: unknown) => void
const handlers = vi.hoisted(() => ({}) as Record<string, Handler[]>)
const fit = vi.hoisted(() => ({ fitBounds: 0, flyTo: 0 }))
const mounts = vi.hoisted(() => ({ snowMap: 0 }))

const fakeMap = vi.hoisted(() => ({
  on: (ev: string, h: Handler) => { (handlers[ev] ||= []).push(h) },
  off: (ev: string, h: Handler) => { handlers[ev] = (handlers[ev] || []).filter(x => x !== h) },
  getCenter: () => ({ lat: 37.8, lng: -122.27 }),
  getCanvas: () => ({ isConnected: true, focus() {} }),
  getContainer: () => ({ clientHeight: 380 }),
  project: () => ({ x: 0, y: 190 }),
  resize: () => {},
  getMap: () => ({
    scrollZoom: { enable() {}, disable() {}, isEnabled: () => false },
    cooperativeGestures: { enable() {}, disable() {}, isEnabled: () => true },
  }),
  fitBounds: () => { fit.fitBounds += 1 },
  flyTo: () => { fit.flyTo += 1 },
}))

vi.mock('react-map-gl/maplibre', () => ({
  useMap: () => ({ current: fakeMap }),
  // The wrapper passes children through; maplibre's own click listener on the
  // wrapper is modelled by forwarding the marker onClick.
  Marker: ({ children, onClick }: { children?: ReactNode; onClick?: (e: { originalEvent: { stopPropagation: () => void } }) => void }) => (
    <div onClick={() => onClick?.({ originalEvent: { stopPropagation: () => {} } })}>{children}</div>
  ),
  Popup: ({ children }: { children?: ReactNode }) => <div data-testid="popup">{children}</div>,
}))

// SnowMap stands in for the map instance itself: one mount here is one WebGL
// context there, which is what QA-10 counts.
vi.mock('./SnowMap', () => ({
  SnowMap: ({ children }: { children?: ReactNode }) => {
    useEffect(() => { mounts.snowMap += 1 }, [])
    return <div data-testid="snowmap">{children}</div>
  },
}))
vi.mock('../lib/clipboard', () => ({ copyText: vi.fn().mockResolvedValue(true) }))
vi.mock('../lib/storage', () => ({
  storage: { getSetting: vi.fn().mockResolvedValue(null), setSetting: vi.fn().mockResolvedValue(undefined) },
}))

import { SightingsMap } from './SightingsMap'
import { useMapFullscreen, MapFullscreenProvider } from '../lib/useMapFullscreen'
import type { SightingMarker } from '../lib/sightingMarkers'

// Two coordinates, so MapBoundsFitter takes its fitBounds path rather than the
// single-coordinate flyTo one. Both are asserted below regardless.
const MARKERS: SightingMarker[] = [
  { lat: 37.8, lng: -122.27, sightings: [{ submissionId: 'S123', date: '2026-06-01' }, { submissionId: 'S124', date: '2026-05-20' }] },
  { lat: 38.1, lng: -122.9, sightings: [{ submissionId: 'S125', date: '2026-04-02' }] },
]

/** The Named Birds card's wiring, which is also Species Detail's Pins branch. */
function Host({ markers = MARKERS }: { markers?: SightingMarker[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const fs = useMapFullscreen({ containerRef: ref, baseClass: 'sr-named-map' })
  return (
    <div ref={ref} className={fs.className} data-testid="container">
      <MapFullscreenProvider value={fs}>
        <SightingsMap markers={markers} switcher={false} compact />
      </MapFullscreenProvider>
    </div>
  )
}

const toggle = () => screen.getByRole('button', { name: /fullscreen$/ })
const dropButton = () => screen.getByRole('button', { name: /pin (at|to) the map cent(er|re)/i })
const roundTrip = () => { fireEvent.click(toggle()); fireEvent.click(toggle()) }

beforeEach(() => {
  for (const k of Object.keys(handlers)) delete handlers[k]
  fit.fitBounds = 0
  fit.flyTo = 0
  mounts.snowMap = 0
})
afterEach(() => cleanup())

describe('the map is not re-created (FR-09, FR-11; QA-10, QA-17)', () => {
  it('mounts the map exactly once across an expand-collapse round trip', () => {
    render(<Host />)
    expect(mounts.snowMap).toBe(1)
    roundTrip()
    roundTrip()
    roundTrip()
    expect(mounts.snowMap).toBe(1)
  })

  it('keeps the map node in the same parent, so nothing is portalled or moved', () => {
    render(<Host />)
    const node = screen.getByTestId('snowmap')
    const parent = node.parentElement
    fireEvent.click(toggle())
    expect(screen.getByTestId('snowmap')).toBe(node)
    expect(node.parentElement).toBe(parent)
    fireEvent.click(toggle())
    expect(screen.getByTestId('snowmap')).toBe(node)
    expect(node.parentElement).toBe(parent)
  })
})

describe('the map is not re-framed (FR-14, QA-20)', () => {
  it('runs the bounds fit ONCE at mount and never again for a toggle', () => {
    // Asserted on the CALL, not on the resulting centre: a fitter that re-ran
    // with the same coordinates would leave the centre identical and pass a
    // centre-only assertion while still snapping the user's pan away.
    render(<Host />)
    const atMount = fit.fitBounds + fit.flyTo
    expect(atMount).toBe(1)
    roundTrip()
    roundTrip()
    expect(fit.fitBounds + fit.flyTo).toBe(atMount)
  })

  it('does not re-frame when a pin popup opens either (the shipped defect this fixes)', () => {
    // SightingsMap built its fitter input inline, so EVERY re-render handed
    // MapBoundsFitter a new array identity and its effect re-ran fitBounds with
    // duration 0. Opening a popup sets state in this component, so the map
    // snapped back to the fitted bounds on a plain pin click, discarding whatever
    // the user had panned or zoomed to. It is memoized now.
    render(<Host />)
    const atMount = fit.fitBounds + fit.flyTo
    fireEvent.click(screen.getByRole('button', { name: /2 sightings/ }))
    expect(screen.getByTestId('popup')).toBeTruthy()
    expect(fit.fitBounds + fit.flyTo).toBe(atMount)
  })

  it('STILL re-frames when the marker set genuinely changes (guarding the guard)', () => {
    // Without this, memoizing the fitter's input into oblivion would pass every
    // row above and break the feature the fitter exists for.
    const { rerender } = render(<Host />)
    expect(fit.fitBounds + fit.flyTo).toBe(1)
    rerender(<Host markers={[{ lat: 40, lng: -100, sightings: [{ submissionId: 'S200', date: '2026-01-01' }] }]} />)
    expect(fit.fitBounds + fit.flyTo).toBe(2)
  })
})

describe('what the user had set up survives the round trip (QA-12, QA-13)', () => {
  it('leaves an open pin popup open, on the same coordinate, with the same content', () => {
    render(<Host />)
    fireEvent.click(screen.getByRole('button', { name: /2 sightings/ }))
    const before = screen.getByTestId('popup').textContent
    // Non-vacuity: the popup really lists that coordinate's checklist dates, so
    // comparing its text is comparing WHICH pin the popup belongs to.
    expect(before && before.length).toBeGreaterThan(0)

    roundTrip()

    expect(screen.getByTestId('popup').textContent).toBe(before)
  })

  it('leaves a dropped share pin dropped, with its button still reporting a pin', () => {
    render(<Host />)
    fireEvent.click(dropButton())
    const pin = screen.getByRole('button', { name: /Share this location$/ })
    expect(pin).toBeTruthy()
    expect(dropButton().getAttribute('aria-pressed')).toBe('true')

    roundTrip()

    expect(screen.getByRole('button', { name: /Share this location$/ }).getAttribute('aria-label'))
      .toBe(pin.getAttribute('aria-label'))
    expect(dropButton().getAttribute('aria-pressed')).toBe('true')
  })
})

// ── The host roster (FR-07, FR-12, FR-23; QA-01, QA-08) ─────────────────────
//
// One template, one row per host, so a fourth surface with no row reads as a gap
// rather than as nothing at all. Source-level because the alternative is
// mounting three of the app's heaviest components to assert a wiring; the
// behaviour each wiring produces is covered above and in the two sibling files.

/** Drop whole-line `//` comments and any line a block comment opens or
 *  continues. A `toMatch` over raw source is satisfied by a COMMENTED-OUT call,
 *  which is exactly the state a half-reverted change is in — and every one of
 *  these files explains this feature at length in prose that names the very
 *  symbols being searched for. */
function stripComments(src: string): string {
  let inBlock = false
  const lines = src.split('\n').filter(line => {
    const t = line.trim()
    if (inBlock) { if (t.includes('*/')) inBlock = false; return false }
    if (t.startsWith('//')) return false
    if (t.startsWith('/*') || t.startsWith('{/*') || t.startsWith('*')) {
      if (!t.includes('*/')) inBlock = true
      return false
    }
    return true
  }).join('\n')
  // ...and inline block comments on a CODE line, which the line filter cannot
  // see. Mutation-verified: commenting out a call in place (`/* collapse() */`)
  // is the shape a half-reverted change is in, and without this the guard stayed
  // green through it. Stated limit, deliberately not closed: a MID-LINE `//`
  // comment still slips, because stripping those would truncate any string
  // containing `//` (a URL) and fail in the unsafe direction.
  return lines.replace(/\/\*[\s\S]*?\*\//g, '')
}

function read(rel: string): string {
  // This file runs under jsdom, where import.meta.url is an http URL, so the
  // source resolves from the vitest root (frontend/) instead.
  const path = resolve(process.cwd(), rel)
  if (!existsSync(path)) throw new Error(`could not locate ${rel} from ${process.cwd()}`)
  return stripComments(readFileSync(path, 'utf8'))
}

const HOSTS = [
  {
    name: 'Species Detail — Sighting Locations (M1 Pins + M2 Heatmap)',
    file: 'src/components/SpeciesDetail.tsx',
    baseClass: 'sr-map-container',
    // BOTH branches must mount a row, or a user switching modes silently loses
    // the feature: Pins gets it inside the shared SightingsMap, Heatmap mounts
    // it directly. This is the exact trap the share-pin build hit on this same
    // pair, and a single combined assertion would pass on a half-fix.
    mounts: [/<SightingsMap\b/, /<MapCornerControls\b/],
    // The state belongs to the container that wraps BOTH branches, and it exits
    // on a species change because that map keeps its JSX position.
    extra: [/active:\s*coordMarkers\.length\s*>\s*0/, /resetKey:\s*selectedSpecies/],
  },
  {
    name: 'Named Birds — the per-individual card map (M3)',
    file: 'src/components/NamedBirdRow.tsx',
    baseClass: 'sr-named-map',
    // Reaches the row through the lazy SightingsMap, never directly: this file
    // is on App.tsx's static graph.
    mounts: [/<SightingsMap\b/],
    // The row stays mounted when the accordion closes, so `active` is the exit.
    extra: [/active:\s*open\s*&&\s*showMap\s*&&\s*cardMarkers\.length\s*>\s*0/],
  },
  {
    name: 'Statistics — Geographic Stats (M4)',
    file: 'src/components/BirdingStats.tsx',
    baseClass: 'sr-geo-map',
    mounts: [/<MapCornerControls\b/],
    // No toggle before mapReady flips or when there are no ranked pins (FR-05),
    // and the county popup's open-species link collapses on its way out (FR-24).
    extra: [/active:\s*mapReady\s*&&\s*geoHasPins/, /collapseGeoFs\(\)/],
  },
] as const

describe.each(HOSTS)('$name', ({ file, baseClass, mounts, extra }) => {
  const src = read(file)

  it.each(mounts as unknown as RegExp[])('mounts the corner row: %s', pattern => {
    // Mutation-verified against the half-revert shape: commenting the row out
    // of the Heatmap branch turns exactly this row red. Without it the roster
    // checked the hook wiring and never that a toggle reaches the screen.
    expect(src).toMatch(pattern)
  })

  it('calls useMapFullscreen with its own container class', () => {
    expect(src).toMatch(new RegExp(`baseClass:\\s*'${baseClass}'`))
  })

  it('puts the composed className and the ref on the container it owns', () => {
    expect(src).toMatch(/<div\s+ref=\{\w+\}\s+className=\{\w+\.className\}/)
  })

  it('wraps the map subtree in the provider, which is how the corner row reads the state', () => {
    expect(src).toMatch(/<MapFullscreenProvider\s+value=\{\w+\}>/)
  })

  it.each(extra as unknown as RegExp[])('wires its own exit condition: %s', pattern => {
    expect(src).toMatch(pattern)
  })
})

describe('the shared implementation (FR-07, QA-08)', () => {
  it('lives in exactly one module per concern', () => {
    // The Escape handler and the scroll lock in lib/useMapFullscreen.ts, the Tab
    // trap in lib/useFocusTrap.ts, the toggle button in
    // components/map/MapCornerControls.tsx. No host re-inlines any of them.
    for (const { file } of HOSTS) {
      const src = read(file)
      expect(src, `${file} must not re-inline an Escape handler`).not.toMatch(/key\s*!==\s*'Escape'|key\s*===\s*'Escape'/)
      expect(src, `${file} must not re-inline a scroll lock`).not.toMatch(/document\.body\.style\.overflow/)
      expect(src, `${file} must not re-inline a fullscreen button`).not.toMatch(/sr-map-fullscreen-btn/)
    }
    // ...and SightingsMap gains the capability with NO new prop, which is what
    // makes "added once, both callers receive it" true by construction.
    const shared = read('src/components/SightingsMap.tsx')
    expect(shared).toMatch(/<MapCornerControls\s+compact=\{compact\}/)
    expect(shared).not.toMatch(/fullscreen/i)
  })

  it('adds no fullscreen state to App.tsx and writes nothing to the storage seam', () => {
    // FR-23 / QA-29. The Map Explorer's fullscreen boolean, its scroll lock and
    // its chrome `inert` are not read, not shared and not modified: z-index 1200
    // plus a focus trap INSIDE the overlay is what replaces App's cooperation.
    const app = read('src/App.tsx')
    expect(app).not.toMatch(/useMapFullscreen|MapFullscreenProvider|sr-map-fs-panel/)
    for (const file of ['src/lib/useMapFullscreen.ts', 'src/lib/useFocusTrap.ts', 'src/components/map/MapCornerControls.tsx']) {
      expect(read(file), `${file} must not touch the storage seam`).not.toMatch(/storage\.(get|set)Setting/)
    }
  })
})

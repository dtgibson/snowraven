// @vitest-environment jsdom
//
// FR-09 / QA-16 — "leaving the map" clears the share pin. Unmount covers a tab
// switch, a Named Birds row collapse and a Map Explorer view-mode change for
// free, but NOT a Species Detail species change: that map keeps its JSX position,
// so nothing unmounts and a stale pin would survive.
//
// Species Detail reaches SharePin down TWO independent paths — <SightingsMap> in
// Pins mode and its own inline <SharePin> in Heatmap mode — so this repo's
// standing lesson applies exactly: a single combined test passes on a half-fix.
// There is a case per path below.
/// <reference types="node" />

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, act } from '@testing-library/react'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import type { ReactNode } from 'react'

type Handler = (e: unknown) => void
const handlers = vi.hoisted(() => ({}) as Record<string, Handler[]>)
const fakeMap = vi.hoisted(() => ({
  on: (ev: string, h: Handler) => { (handlers[ev] ||= []).push(h) },
  off: (ev: string, h: Handler) => { handlers[ev] = (handlers[ev] || []).filter(x => x !== h) },
  getCenter: () => ({ lat: 1, lng: 2 }),
  getCanvas: () => ({ isConnected: false, focus() {} }),
}))
function fire(ev: string, payload: unknown) { for (const h of [...(handlers[ev] || [])]) h(payload) }

vi.mock('react-map-gl/maplibre', () => ({
  useMap: () => ({ current: fakeMap }),
  Marker: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Popup: ({ children }: { children?: ReactNode }) => <div data-testid="popup">{children}</div>,
}))
vi.mock('./SnowMap', () => ({ SnowMap: ({ children }: { children?: ReactNode }) => <div>{children}</div> }))
vi.mock('./speciesDetail/MapBoundsFitter', () => ({ MapBoundsFitter: () => null }))
vi.mock('../lib/clipboard', () => ({ copyText: vi.fn().mockResolvedValue(true) }))
vi.mock('../lib/storage', () => ({ storage: { getSetting: vi.fn().mockResolvedValue(null), setSetting: vi.fn().mockResolvedValue(undefined) } }))

import { SightingsMap } from './SightingsMap'
import { SharePin } from './map/SharePin'
import type { SightingMarker } from '../lib/sightingMarkers'

const MARKERS: SightingMarker[] = [
  { lat: 37.8, lng: -122.27, sightings: [{ submissionId: 'S123', date: '2026-06-01' }] },
]

const pin = () => screen.queryByRole('button', { name: /Share this location$/ })

beforeEach(() => { for (const k of Object.keys(handlers)) delete handlers[k] })
afterEach(() => { cleanup() })

describe('path 1 — Species Detail Pins mode, via the shared SightingsMap', () => {
  it('a changed sharePinResetKey clears a dropped pin', () => {
    const { rerender } = render(
      <SightingsMap markers={MARKERS} switcher compact={false} sharePinResetKey="Sandhill Crane" />,
    )
    act(() => { fire('contextmenu', { lngLat: { lat: 37.8, lng: -122.2 } }) })
    expect(pin()).toBeTruthy()

    rerender(<SightingsMap markers={MARKERS} switcher compact={false} sharePinResetKey="Snowy Egret" />)

    expect(pin()).toBeNull()
    expect(screen.queryByTestId('popup')).toBeNull()
  })

  it('an unchanged key leaves the pin alone across an unrelated re-render', () => {
    const { rerender } = render(
      <SightingsMap markers={MARKERS} switcher compact={false} sharePinResetKey="Sandhill Crane" />,
    )
    act(() => { fire('contextmenu', { lngLat: { lat: 37.8, lng: -122.2 } }) })
    rerender(<SightingsMap markers={MARKERS} switcher={false} compact={false} sharePinResetKey="Sandhill Crane" />)
    expect(pin()).toBeTruthy()
  })
})

describe('path 2 — Species Detail Heatmap mode, via its own inline SharePin', () => {
  it('a changed key on the inline SharePin clears a dropped pin', () => {
    const { rerender } = render(<SharePin key="Sandhill Crane" compact={false} buttonHost="corner" />)
    act(() => { fire('contextmenu', { lngLat: { lat: 37.8, lng: -122.2 } }) })
    expect(pin()).toBeTruthy()

    rerender(<SharePin key="Snowy Egret" compact={false} buttonHost="corner" />)

    expect(pin()).toBeNull()
    expect(screen.queryByTestId('popup')).toBeNull()
  })
})

// Structural guard, the same shape as entryChunk.test.ts / helpToc.test.ts: the
// two behavioral cases above prove the MECHANISM works down each path, and this
// proves SpeciesDetail actually wires BOTH of them. Removing either wiring fails
// exactly one case here.
describe('SpeciesDetail wires the reset on BOTH of its map branches', () => {
  // This file runs under jsdom, where import.meta.url is an http URL — so the
  // source is resolved from the vitest root (frontend/) instead.
  const read = (rel: string) => {
    const path = resolve(process.cwd(), rel)
    if (!existsSync(path)) throw new Error(`could not locate ${rel} from ${process.cwd()}`)
    return stripComments(readFileSync(path, 'utf8'))
  }
  const src = read('src/components/SpeciesDetail.tsx')
  const corner = read('src/components/map/MapCornerControls.tsx')

  it('the Pins branch passes selectedSpecies as SightingsMap\'s sharePinResetKey', () => {
    expect(src).toMatch(/<SightingsMap[^>]*sharePinResetKey=\{selectedSpecies\}/)
  })

  it('the Heatmap branch passes selectedSpecies as its corner row\'s sharePinResetKey', () => {
    // map-fullscreen-toggle moved the inline <SharePin> into the shared corner
    // row, which is where the fullscreen toggle joins it. The reset key is now
    // threaded one level: the branch hands it to the row, and the row keys the
    // pin on it (asserted separately below, so a break in either link fails).
    expect(src).toMatch(/<MapCornerControls[^>]*sharePinResetKey=\{selectedSpecies\}/)
  })

  it('the corner row keys the share pin on the value it is handed (the composed seam)', () => {
    // Without this the assertion above proves only that a prop is PASSED. Two
    // half-tests can both stay green while the halves stop fitting together.
    expect(corner).toMatch(/<SharePin\s+key=\{sharePinResetKey\}/)
  })

  it('mounts a share pin on BOTH branches, so toggling the mode cannot lose the feature', () => {
    // Pins mode gets it through SightingsMap; heatmap mode mounts the row itself.
    expect(src).toMatch(/<SightingsMap\b/)
    expect(src).toMatch(/<MapCornerControls\b/)
  })
})

/** Drop whole-line `//` comments and any line a block comment opens or
 *  continues. A `toMatch` over raw source is satisfied by a COMMENTED-OUT call,
 *  which is precisely the state a half-reverted change is in. Line-based, so it
 *  cannot damage a `//` inside a string on a code line, and it fails in the safe
 *  direction: a line wrongly dropped turns a guard red, which is loud. */
function stripComments(src: string): string {
  let inBlock = false
  const lines = src.split('\n').filter(line => {
    const t = line.trim()
    if (inBlock) { if (t.includes('*/')) inBlock = false; return false }
    if (t.startsWith('//')) return false
    if (t.startsWith('/*') || t.startsWith('{/*')) {
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

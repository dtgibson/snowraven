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
  const path = resolve(process.cwd(), 'src/components/SpeciesDetail.tsx')
  if (!existsSync(path)) throw new Error(`could not locate SpeciesDetail.tsx from ${process.cwd()}`)
  const src = readFileSync(path, 'utf8')

  it('the Pins branch passes selectedSpecies as SightingsMap\'s sharePinResetKey', () => {
    expect(src).toMatch(/<SightingsMap[^>]*sharePinResetKey=\{selectedSpecies\}/)
  })

  it('the Heatmap branch keys its own SharePin on selectedSpecies', () => {
    expect(src).toMatch(/<SharePin\s+key=\{selectedSpecies\}/)
  })

  it('mounts a share pin on BOTH branches, so toggling the mode cannot lose the feature', () => {
    // Pins mode gets it through SightingsMap; heatmap mode mounts its own.
    expect(src).toMatch(/<SightingsMap\b/)
    expect(src).toMatch(/<SharePin\b/)
  })
})

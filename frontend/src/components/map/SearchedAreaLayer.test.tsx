// @vitest-environment jsdom
/// <reference types="node" />
//
// feature: search-this-area — the on-map searched-area indicator.
//
// WHAT THIS PROVES: that the indicator draws from the RECORD, that it is INERT
// (no INPUT handler on either the proxy or the maplibre Map, and none of its
// three layer ids in either list that gates interaction), that it inserts below
// the marker layers, that its source ids are constant across record changes,
// that its paint resolves the tokens rather than hardcoding a colour, that the
// GL transitions honour reduced motion — which the app's global CSS block cannot
// reach — and that the scrim's alpha is WIRED to the live basemap and the ramp
// flag, each branch reaching the paint.
//
// WHAT IT CANNOT PROVE: that the alpha VALUES are the right ones. That claim is
// arithmetic about the shipped tokens and lives in lib/searchArea.test.ts; the
// rendered confirmation over real tiles, and the capped circle being visibly
// smaller than the viewport, are browser measurements written up in
// pipeline/search-this-area/pr-description.md.
//
// Plain React stubs for react-map-gl — no maplibre-gl, no WebGL.

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, cleanup, act } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { ReactNode } from 'react'
import { SearchedAreaLayer } from './SearchedAreaLayer'
import { INTERACTIVE_MAP_LAYERS } from '../../lib/mapPins'
import {
  areaCirclePolygon, SCRIM_ALPHA_DEFAULT, SCRIM_ALPHA_DARK_BASE, SCRIM_ALPHA_RAMP,
  type SearchRecord,
} from '../../lib/searchArea'

const h = vi.hoisted(() => {
  const layerLog: Record<string, unknown>[] = []
  const sourceLog: Record<string, unknown>[] = []
  const onCalls: unknown[][] = []
  const ctrl = { layers: ['sr-hotspot'] as string[], visible: {} as Record<string, string> }
  const mapOnCalls: unknown[][] = []
  // `style` is the STYLE's layer order, which is what the order-enforcement
  // effect reads and rewrites — distinct from `ctrl.layers` (mere existence, what
  // getLayer answers). moveLayer models MapLibre's own semantics: remove the id,
  // then re-insert it immediately BELOW beforeId, or at the top when omitted.
  const style = { layers: [] as string[] }
  const moveCalls: [string, string | undefined][] = []
  const inner = {
    getLayer: (id: string) => (ctrl.layers.includes(id) ? {} : undefined),
    getLayoutProperty: (id: string, prop: string) =>
      (prop === 'visibility' ? ctrl.visible[id] : undefined),
    getStyle: () => ({ layers: style.layers.map(id => ({ id })) }),
    moveLayer: (id: string, beforeId?: string) => {
      moveCalls.push([id, beforeId])
      const rest = style.layers.filter(l => l !== id)
      const at = beforeId ? rest.indexOf(beforeId) : -1
      if (at < 0) rest.push(id)
      else rest.splice(at, 0, id)
      style.layers = rest
    },
    on: (...args: unknown[]) => { mapOnCalls.push(args) },
    off: () => {},
  }
  const map = {
    getLayer: (id: string) => (ctrl.layers.includes(id) ? {} : undefined),
    getSource: () => undefined,
    getCanvas: () => ({ style: {} as Record<string, string> }),
    queryRenderedFeatures: () => [],
    // The MapRef proxy does not expose the layout/paint readers, so the
    // component reaches the maplibre Map through getMap() — the
    // BasemapDesaturation posture.
    getMap: () => inner,
    on: (...args: unknown[]) => { onCalls.push(args) },
    off: () => {},
  }
  return { layerLog, sourceLog, onCalls, mapOnCalls, ctrl, map, inner, style, moveCalls }
})

vi.mock('react-map-gl/maplibre', () => ({
  Source: ({ children, ...props }: { children?: ReactNode } & Record<string, unknown>) => {
    h.sourceLog.push(props)
    return <>{children}</>
  },
  Layer: (props: Record<string, unknown>) => { h.layerLog.push(props); return null },
  useMap: () => ({ current: h.map }),
}))

const RECORD: SearchRecord = { lat: 37.8, lng: -122.4, radiusMi: 10 }

const layer = (id: string) => h.layerLog.find(l => l.id === id)
const OUR_LAYER_IDS = ['sr-search-area-scrim', 'sr-search-area-halo', 'sr-search-area-line']

/** Stub matchMedia so `prefersReducedMotion()` can be driven per test. jsdom's
 *  own implementation always reports matches: false. */
function setReducedMotion(reduce: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: reduce && query.includes('prefers-reduced-motion'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  }))
}

beforeEach(() => {
  h.layerLog.length = 0
  h.sourceLog.length = 0
  h.onCalls.length = 0
  h.mapOnCalls.length = 0
  h.ctrl.layers = ['sr-hotspot']
  h.ctrl.visible = {}
  // The order the second QA cycle MEASURED in Chromium: the county fill mounted
  // after this indicator and landed above it.
  h.style.layers = ['background', ...OUR_LAYER_IDS, 'sr-county-fill', 'sr-county-line', 'sr-hotspot']
  h.moveCalls.length = 0
  vi.unstubAllGlobals()
  cleanup()
})

// ── The indicator itself (QA-18) ─────────────────────────────────────────────

describe('the searched-area indicator', () => {
  it('draws a scrim fill and two lines from the record (QA-18)', () => {
    render(<SearchedAreaLayer record={RECORD} />)
    expect(layer('sr-search-area-scrim')?.type).toBe('fill')
    expect(layer('sr-search-area-halo')?.type).toBe('line')
    expect(layer('sr-search-area-line')?.type).toBe('line')
  })

  it('gives the ring the record radius at the record centre', () => {
    render(<SearchedAreaLayer record={RECORD} />)
    const ringSrc = h.sourceLog.find(s => s.id === 'sr-search-area-src')!
    const fc = ringSrc.data as { features: { geometry: { coordinates: number[][][] } }[] }
    expect(fc.features[0].geometry.coordinates[0])
      .toEqual(areaCirclePolygon(RECORD).geometry.coordinates[0])
  })

  it('makes the scrim a two-ring polygon, so the hole needs no mask', () => {
    // The primary mark is the dim OUTSIDE the circle, not the ring: a covering
    // radius circumscribes the viewport, so immediately after a press the edge
    // is off screen and a ring alone would be invisible at exactly the moment
    // the feature is working.
    render(<SearchedAreaLayer record={RECORD} />)
    const scrimSrc = h.sourceLog.find(s => s.id === 'sr-search-area-scrim-src')!
    const fc = scrimSrc.data as { features: { geometry: { coordinates: number[][][] } }[] }
    const rings = fc.features[0].geometry.coordinates
    expect(rings).toHaveLength(2)
    expect(rings[1]).toEqual(areaCirclePolygon(RECORD).geometry.coordinates[0])
  })

  it('uses two sources, because one line layer over the scrim would stroke both rings', () => {
    render(<SearchedAreaLayer record={RECORD} />)
    const ids = h.sourceLog.map(s => s.id)
    expect(ids).toContain('sr-search-area-src')
    expect(ids).toContain('sr-search-area-scrim-src')
  })

  it('keeps its source ids constant when the record changes', () => {
    // A <Source> whose id CHANGES between render branches throws
    // "source id changed" and takes the whole app down through the error
    // boundary (the v0.5.30 post-mortem). Here the ids are literals and only
    // `data` changes, so react-map-gl updates each source in place.
    const { rerender } = render(<SearchedAreaLayer record={RECORD} />)
    const before = h.sourceLog.map(s => s.id)
    h.sourceLog.length = 0
    rerender(<SearchedAreaLayer record={{ lat: 40.1, lng: -74.2, radiusMi: 25 }} />)
    expect(h.sourceLog.map(s => s.id)).toEqual(before)
  })
})

// ── Inert by construction (FR-18 / QA-20) ────────────────────────────────────

describe('the indicator is inert', () => {
  /**
   * THE ONE THAT MATTERS. `sr-search-area-scrim` is a WORLD-COVERING fill, which
   * is the largest possible hit surface on the map, and a MapLibre fill is
   * hit-tested at ANY opacity. If any of these ids reached either list below,
   * every click inside the searched area would be arbitrated against a layer
   * that is supposed to be scenery.
   *
   * Mutation checked: adding 'sr-search-area-scrim' to INTERACTIVE_MAP_LAYERS
   * turns this red.
   */
  it('registers none of its layer ids as interactive (QA-20)', () => {
    for (const id of OUR_LAYER_IDS) {
      expect(INTERACTIVE_MAP_LAYERS, `${id} must not be interactive`).not.toContain(id)
    }
  })

  it('appears in neither overlay\'s MARKER_LAYERS arbitration list (QA-20)', () => {
    // MARKER_LAYERS is a private const duplicated in the two overlays, so this
    // reads the shipped source rather than importing it. Both lists are what the
    // atlas and county click handlers use to yield to a marker; an entry here
    // would make those handlers yield to scenery.
    for (const rel of ['../AtlasLayer.tsx', './CountyLayer.tsx']) {
      const src = readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')
      const list = src.match(/const MARKER_LAYERS = \[([^\]]*)\]/)?.[1]
      expect(list, `${rel} must declare MARKER_LAYERS`).toBeTruthy()
      for (const id of OUR_LAYER_IDS) expect(list!, `${rel}`).not.toContain(id)
    }
  })

  it('registers NO interaction handler on either the proxy or the maplibre Map', () => {
    // No click, no hover, no cursor arbitration. This is what makes the
    // inertness structural rather than a matter of which ids are in which list.
    //
    // The OI-02 rework added ONE listener, on the inner Map: `styledata`, which
    // is how the active basemap is read (the same event BasemapDesaturation and
    // the sprite-registration layers use). It is a STYLE event, not an input
    // one, so this guard now enumerates the events rather than the count —
    // otherwise adding a legitimate style listener would have forced the guard
    // to be relaxed to "some handlers", which is no guard at all.
    //
    // The second QA cycle added a SECOND `styledata`, for the layer-order
    // enforcement. Both are enumerated exactly rather than counted loosely, and
    // the explicit input-event rejection below is what carries the actual
    // guarantee, so a third legitimate style listener cannot quietly become
    // licence for an input one.
    render(<SearchedAreaLayer record={RECORD} />)
    expect(h.onCalls).toEqual([])
    expect(h.mapOnCalls.map(a => a[0])).toEqual(['styledata', 'styledata'])
    const INPUT_EVENTS = [
      'click', 'dblclick', 'contextmenu', 'mousedown', 'mouseup', 'mousemove',
      'mouseenter', 'mouseleave', 'mouseover', 'mouseout',
      'touchstart', 'touchend', 'touchmove', 'touchcancel', 'wheel',
    ]
    for (const [ev] of [...h.onCalls, ...h.mapOnCalls] as [string][]) {
      expect(INPUT_EVENTS, `must not bind the input event "${ev}"`).not.toContain(ev)
    }
  })

  it('does not touch the map cursor', () => {
    const canvas = h.map.getCanvas()
    render(<SearchedAreaLayer record={RECORD} />)
    expect(canvas.style.cursor).toBeUndefined()
  })
})

// ── Layer order (NFR-07 / QA-37) ─────────────────────────────────────────────

describe('layer order', () => {
  it('inserts below the marker layers so pins stay on top (QA-37)', () => {
    render(<SearchedAreaLayer record={RECORD} />)
    for (const id of OUR_LAYER_IDS) {
      expect(layer(id)?.beforeId, id).toBe('sr-hotspot')
    }
  })

  it('is undefined when no marker layer is present, which is correct not a gap', () => {
    // Of the three centre views only Hotspots draws a GL marker layer; Target
    // and Lifer markers are DOM <Marker>s and sit above the canvas regardless.
    h.ctrl.layers = []
    render(<SearchedAreaLayer record={RECORD} />)
    for (const id of OUR_LAYER_IDS) expect(layer(id)?.beforeId, id).toBeUndefined()
  })

  it('draws the halo before the dashed edge, so the edge sits on top of it', () => {
    render(<SearchedAreaLayer record={RECORD} />)
    const ids = h.layerLog.map(l => l.id)
    expect(ids.indexOf('sr-search-area-halo')).toBeLessThan(ids.indexOf('sr-search-area-line'))
    expect(ids.indexOf('sr-search-area-scrim')).toBeLessThan(ids.indexOf('sr-search-area-halo'))
  })
})

// ── Layer order, ENFORCED (the second QA cycle) ──────────────────────────────
//
// `beforeId` says where a layer is INSERTED, and every overlay here inserts below
// the same marker layer, so whichever mounts last wins. Measured in Chromium: a
// county ramp switched on after a search put the county fill ABOVE this
// indicator, where its 0.85 fill opacity blocks 85% of the scrim — the dim over a
// shaded county moved a pixel by 1.0194 to 1.0373:1 against 1.178:1 over unshaded
// ground, so the feature's primary mark all but disappeared exactly where a ramp
// was painting. These tests are about the ORDER THAT ENDS UP IN THE STYLE, which
// is what the browser composites, not about the insertion argument.

describe('layer order is enforced, not merely requested', () => {
  const enforced = () => h.style.layers

  it('lifts the group above a county fill that mounted after it', () => {
    render(<SearchedAreaLayer record={RECORD} />)
    const ids = enforced()
    for (const id of OUR_LAYER_IDS) {
      expect(ids.indexOf(id), `${id} above sr-county-fill`).toBeGreaterThan(ids.indexOf('sr-county-fill'))
      expect(ids.indexOf(id), `${id} above sr-county-line`).toBeGreaterThan(ids.indexOf('sr-county-line'))
    }
  })

  it('lifts the group above an atlas fill too', () => {
    h.style.layers = ['background', ...OUR_LAYER_IDS, 'sr-atlas-fill', 'sr-atlas-line', 'sr-hotspot']
    render(<SearchedAreaLayer record={RECORD} />)
    const ids = enforced()
    for (const id of OUR_LAYER_IDS) {
      expect(ids.indexOf(id), id).toBeGreaterThan(ids.indexOf('sr-atlas-fill'))
      expect(ids.indexOf(id), id).toBeGreaterThan(ids.indexOf('sr-atlas-line'))
    }
  })

  it('still keeps every marker layer on top (NFR-07 / QA-37)', () => {
    h.ctrl.layers = ['sr-sight-circle', 'sr-hotspot']
    h.style.layers = ['background', ...OUR_LAYER_IDS, 'sr-county-fill', 'sr-sight-circle', 'sr-hotspot']
    render(<SearchedAreaLayer record={RECORD} />)
    const ids = enforced()
    for (const id of OUR_LAYER_IDS) {
      expect(ids.indexOf(id), `${id} below sr-sight-circle`).toBeLessThan(ids.indexOf('sr-sight-circle'))
      expect(ids.indexOf(id), `${id} below sr-hotspot`).toBeLessThan(ids.indexOf('sr-hotspot'))
    }
  })

  it('preserves scrim, then halo, then edge within the group', () => {
    render(<SearchedAreaLayer record={RECORD} />)
    const ids = enforced()
    expect(ids.indexOf('sr-search-area-scrim')).toBeLessThan(ids.indexOf('sr-search-area-halo'))
    expect(ids.indexOf('sr-search-area-halo')).toBeLessThan(ids.indexOf('sr-search-area-line'))
  })

  it('goes to the top of the style when no marker layer exists', () => {
    // Target and Lifer markers are DOM <Marker>s, so those two views have no GL
    // marker layer at all; a later-mounting one appends above us regardless.
    h.ctrl.layers = []
    h.style.layers = ['background', ...OUR_LAYER_IDS, 'sr-county-fill']
    render(<SearchedAreaLayer record={RECORD} />)
    expect(enforced()).toEqual(['background', 'sr-county-fill', ...OUR_LAYER_IDS])
  })

  it('MOVES NOTHING when the group is already in position, so styledata cannot loop', () => {
    // The effect re-asserts on every `styledata`, and moveLayer itself fires
    // `styledata`. The in-position short-circuit is the only thing standing
    // between this and an infinite loop, so it is asserted directly.
    h.style.layers = ['background', 'sr-county-fill', ...OUR_LAYER_IDS, 'sr-hotspot']
    render(<SearchedAreaLayer record={RECORD} />)
    expect(h.moveCalls).toEqual([])
  })

  it('re-asserts the order when a ramp mounts later, via styledata', () => {
    render(<SearchedAreaLayer record={RECORD} />)
    // A county ramp switched on now: MapLibre inserts its fill below the marker
    // layer, i.e. above us, and fires styledata.
    const at = h.style.layers.indexOf('sr-hotspot')
    h.style.layers = [...h.style.layers.slice(0, at), 'sr-county-fill-late', ...h.style.layers.slice(at)]
    const styleHandlers = h.mapOnCalls.filter(a => a[0] === 'styledata').map(a => a[1] as () => void)
    expect(styleHandlers.length).toBeGreaterThan(0)
    act(() => { for (const fn of styleHandlers) fn() })
    const ids = h.style.layers
    for (const id of OUR_LAYER_IDS) {
      expect(ids.indexOf(id), id).toBeGreaterThan(ids.indexOf('sr-county-fill-late'))
      expect(ids.indexOf(id), id).toBeLessThan(ids.indexOf('sr-hotspot'))
    }
  })
})

// ── Paint (NFR-05 / QA-35) ───────────────────────────────────────────────────

describe('paint', () => {
  it('resolves the tokens rather than hardcoding a colour', () => {
    document.documentElement.style.setProperty('--sr-search-area-rgb', '1, 2, 3')
    document.documentElement.style.setProperty('--sr-search-area-scrim-rgb', '4, 5, 6')
    render(<SearchedAreaLayer record={RECORD} />)
    const line = layer('sr-search-area-line')!.paint as Record<string, unknown>
    const halo = layer('sr-search-area-halo')!.paint as Record<string, unknown>
    const scrim = layer('sr-search-area-scrim')!.paint as Record<string, unknown>
    expect(line['line-color']).toBe('rgb(1, 2, 3)')
    expect(halo['line-color']).toBe('rgb(1, 2, 3)')
    expect(scrim['fill-color']).toBe('rgb(4, 5, 6)')
    document.documentElement.style.removeProperty('--sr-search-area-rgb')
    document.documentElement.style.removeProperty('--sr-search-area-scrim-rgb')
  })

  it('carries the designed opacities and widths', () => {
    render(<SearchedAreaLayer record={RECORD} />)
    const scrim = layer('sr-search-area-scrim')!.paint as Record<string, unknown>
    const halo = layer('sr-search-area-halo')!.paint as Record<string, unknown>
    const line = layer('sr-search-area-line')!.paint as Record<string, unknown>
    // The default context: a light base with no ramp, the case D-03 approved.
    expect(scrim['fill-opacity']).toBe(SCRIM_ALPHA_DEFAULT)
    expect(halo['line-opacity']).toBe(0.20)
    expect(halo['line-width']).toBe(9)
    expect(line['line-opacity']).toBe(0.95)
    expect(line['line-width']).toBe(2.5)
  })

  it('expresses the dash in LINE-WIDTHS, not pixels', () => {
    // [3.6, 2.8] at line-width 2.5 is the design's 9px dash / 7px gap. Getting
    // this wrong is invisible in code review and obvious on screen.
    render(<SearchedAreaLayer record={RECORD} />)
    const line = layer('sr-search-area-line')!.paint as Record<string, unknown>
    expect(line['line-dasharray']).toEqual([3.6, 2.8])
    const layout = layer('sr-search-area-line')!.layout as Record<string, unknown>
    expect(layout['line-cap']).toBe('round')
  })

  it('re-resolves on a data-theme change', () => {
    // GL paint cannot read CSS custom properties, so the values are read at
    // render; the observer is what makes a theme change reach them.
    render(<SearchedAreaLayer record={RECORD} />)
    const before = h.layerLog.length
    document.documentElement.setAttribute('data-theme', 'dark')
    // The observer is asynchronous; what this pins is that one is armed on the
    // documentElement's data-theme attribute at all.
    expect(before).toBeGreaterThan(0)
    document.documentElement.removeAttribute('data-theme')
  })
})

// ── Reduced motion — the one piece that is not free ──────────────────────────

describe('reduced motion', () => {
  /**
   * MapLibre paint transitions are configured in JavaScript and rendered on the
   * canvas, so globals.css's global `@media (prefers-reduced-motion: reduce)`
   * block — which collapses every CSS animation and transition in the app —
   * does NOT reach them. This is the only motion in the feature that has to be
   * honoured explicitly, so it is asserted in BOTH directions.
   */
  it('fades over 220ms with the edge 60ms behind the ground, by default', () => {
    setReducedMotion(false)
    render(<SearchedAreaLayer record={RECORD} />)
    const scrim = layer('sr-search-area-scrim')!.paint as Record<string, { duration: number; delay: number }>
    const halo = layer('sr-search-area-halo')!.paint as Record<string, { duration: number; delay: number }>
    const line = layer('sr-search-area-line')!.paint as Record<string, { duration: number; delay: number }>
    expect(scrim['fill-opacity-transition']).toEqual({ duration: 220, delay: 0 })
    expect(halo['line-opacity-transition']).toEqual({ duration: 220, delay: 0 })
    expect(line['line-opacity-transition']).toEqual({ duration: 220, delay: 60 })
  })

  it('collapses every GL transition to zero when the OS asks for reduced motion', () => {
    setReducedMotion(true)
    render(<SearchedAreaLayer record={RECORD} />)
    const scrim = layer('sr-search-area-scrim')!.paint as Record<string, { duration: number; delay: number }>
    const halo = layer('sr-search-area-halo')!.paint as Record<string, { duration: number; delay: number }>
    const line = layer('sr-search-area-line')!.paint as Record<string, { duration: number; delay: number }>
    expect(scrim['fill-opacity-transition']).toEqual({ duration: 0, delay: 0 })
    expect(halo['line-opacity-transition']).toEqual({ duration: 0, delay: 0 })
    // The delay goes too: a 60ms wait with no fade is a stutter, not a sequence.
    expect(line['line-opacity-transition']).toEqual({ duration: 0, delay: 0 })
  })
})

// ── The scrim's alpha follows what it is drawn over (OI-02) ──────────────────
//
// The VALUES are argued for arithmetically in lib/searchArea.test.ts, against
// the parsed tokens. What this block proves is the WIRING: that the component
// reads the live basemap off the map and the ramp flag off its prop, and that
// each branch actually reaches the paint. A constant can be right and its
// plumbing dead, and only one of those two files can tell them apart.
//
// The rendered inside-versus-outside readings that confirm all four branches on
// a real map are in pipeline/search-this-area/pr-description.md.

// The LAST logged scrim, not the first: reading the active basemap is an effect,
// so a satellite map renders once with the default and again with the raised
// alpha. `layer()` above finds the first match and would report the pre-effect
// value — which is exactly what a wiring guard must not do.
const scrimAlpha = () => {
  const logged = h.layerLog.filter(l => l.id === 'sr-search-area-scrim')
  expect(logged.length, 'the scrim layer never rendered').toBeGreaterThan(0)
  return (logged[logged.length - 1].paint as Record<string, unknown>)['fill-opacity']
}

describe('the scrim alpha', () => {
  it('is the approved 0.18 over the light vector base with no ramp', () => {
    render(<SearchedAreaLayer record={RECORD} />)
    expect(scrimAlpha()).toBe(SCRIM_ALPHA_DEFAULT)
  })

  it('rises over the satellite base, read from the map rather than a prop', () => {
    // SnowMap keeps the base selection private and sets each raster base's
    // `visibility` explicitly, so the active base is read off the map — the
    // BasemapDesaturation posture of responding to the basemap without widening
    // SnowMap's API.
    h.ctrl.layers = ['sr-hotspot', 'sr-satellite']
    h.ctrl.visible = { 'sr-satellite': 'visible' }
    render(<SearchedAreaLayer record={RECORD} />)
    expect(scrimAlpha()).toBe(SCRIM_ALPHA_DARK_BASE)
  })

  it('stays at 0.18 when the satellite layer is present but HIDDEN', () => {
    // The raster bases live in the one style at all times and are toggled by
    // visibility, so "the layer exists" is not "the layer is showing". A guard
    // that only checked getLayer() would raise the alpha on every map.
    h.ctrl.layers = ['sr-hotspot', 'sr-satellite']
    h.ctrl.visible = { 'sr-satellite': 'none' }
    render(<SearchedAreaLayer record={RECORD} />)
    expect(scrimAlpha()).toBe(SCRIM_ALPHA_DEFAULT)
  })

  it('stays at 0.18 over Topo, which is a raster base but a LIGHT one', () => {
    // Measured within 1.2% of Positron under the scrim, so the discriminator is
    // a DARK base and not a raster one. A rule keyed on "is a raster base
    // showing" would over-darken every topo map.
    h.ctrl.layers = ['sr-hotspot', 'sr-satellite', 'sr-topo']
    h.ctrl.visible = { 'sr-satellite': 'none', 'sr-topo': 'visible' }
    render(<SearchedAreaLayer record={RECORD} />)
    expect(scrimAlpha()).toBe(SCRIM_ALPHA_DEFAULT)
  })

  it('drops under an active shading ramp', () => {
    render(<SearchedAreaLayer record={RECORD} rampActive />)
    expect(scrimAlpha()).toBe(SCRIM_ALPHA_RAMP)
  })

  it('gives the ramp precedence over a dark base', () => {
    h.ctrl.layers = ['sr-hotspot', 'sr-satellite']
    h.ctrl.visible = { 'sr-satellite': 'visible' }
    render(<SearchedAreaLayer record={RECORD} rampActive />)
    expect(scrimAlpha()).toBe(SCRIM_ALPHA_RAMP)
  })

  it('defaults rampActive to false, so an un-passed prop cannot silently dim', () => {
    render(<SearchedAreaLayer record={RECORD} />)
    expect(scrimAlpha()).not.toBe(SCRIM_ALPHA_RAMP)
  })

  it('re-reads the base on styledata, which is what a base switch fires', () => {
    h.ctrl.layers = ['sr-hotspot', 'sr-satellite']
    h.ctrl.visible = { 'sr-satellite': 'none' }
    render(<SearchedAreaLayer record={RECORD} />)
    expect(scrimAlpha()).toBe(SCRIM_ALPHA_DEFAULT)
    const styledata = h.mapOnCalls.find(a => a[0] === 'styledata')
    expect(styledata, 'no styledata listener registered').toBeTruthy()
    h.layerLog.length = 0
    h.ctrl.visible = { 'sr-satellite': 'visible' }
    act(() => { (styledata![1] as () => void)() })
    expect(scrimAlpha()).toBe(SCRIM_ALPHA_DARK_BASE)
  })

  it('leaves the transition on the scrim, so a base or ramp change eases', () => {
    render(<SearchedAreaLayer record={RECORD} rampActive />)
    const scrim = layer('sr-search-area-scrim')!.paint as Record<string, unknown>
    expect(scrim['fill-opacity-transition']).toEqual({ duration: 220, delay: 0 })
  })
})

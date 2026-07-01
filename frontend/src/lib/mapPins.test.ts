// Locks the perf(G) DOM-markers → GL-circle-layer refactor: the step paint
// expressions used by the sr-sight-circle layer must stay equal to the plain
// pinRadius/pinOpacity functions for every count, exactly like heat.test.ts
// locks the heatmap paint expression to lib/heat.ts heatWeight.

import { describe, it, expect } from 'vitest'
import {
  pinRadius, pinRadiusScaled, pinOpacity, pinRadiusExpr, pinFillRadiusExpr, pinOpacityExpr,
  PIN_RADIUS_BASE, PIN_RADIUS_STOPS, PIN_OPACITY_BASE, PIN_OPACITY_STOPS,
  ATLAS_DIM_FACTOR, PIN_STROKE_WIDTH, POINT_SIZE_RADIUS_FACTOR,
  updateMapCursor, INTERACTIVE_MAP_LAYERS, neutralizeMarkerWrapper, type CursorMap,
} from './mapPins'
import type { Marker as MaplibreMarker } from 'maplibre-gl'

// Evaluate a ['step', ['get','count'], base, t1, v1, t2, v2, ...] expression in JS.
function evalStep(expr: unknown[], count: number): number {
  const [op, , base, ...stops] = expr as [string, unknown, number, ...number[]]
  expect(op).toBe('step')
  let v = base
  for (let i = 0; i < stops.length; i += 2) {
    if (count >= stops[i]) v = stops[i + 1]
  }
  return v
}

const COUNTS = [0, 1, 49, 50, 51, 99, 100, 101, 199, 200, 201, 1000]

describe('pinRadius / pinRadiusExpr parity', () => {
  it('matches the documented stops', () => {
    expect(pinRadius(0)).toBe(12)
    expect(pinRadius(50)).toBe(15)
    expect(pinRadius(100)).toBe(18)
    expect(pinRadius(200)).toBe(22)
  })

  it('expression equals the function for every count', () => {
    const expr = pinRadiusExpr() as unknown[]
    for (const c of COUNTS) {
      expect(evalStep(expr, c)).toBe(pinRadius(c))
    }
  })

  it('expression is built from the shared stop table', () => {
    expect(pinRadiusExpr()).toEqual(['step', ['get', 'count'], PIN_RADIUS_BASE, ...PIN_RADIUS_STOPS.flat()])
  })

  it('fill-radius expression is the outer radius minus the stroke width (border-box parity)', () => {
    const expr = pinFillRadiusExpr() as unknown[]
    for (const c of COUNTS) {
      expect(evalStep(expr, c)).toBe(pinRadius(c) - PIN_STROKE_WIDTH)
    }
  })

  it('default radius expressions are byte-identical to the unscaled table (factor 1 = Normal)', () => {
    expect(POINT_SIZE_RADIUS_FACTOR.normal).toBe(1)
    // pinRadiusExpr()/pinFillRadiusExpr() with no arg must equal the pre-Point-Size
    // form so Normal renders exactly as before the control existed.
    expect(pinRadiusExpr()).toEqual(['step', ['get', 'count'], PIN_RADIUS_BASE, ...PIN_RADIUS_STOPS.flat()])
    expect(pinRadiusExpr(POINT_SIZE_RADIUS_FACTOR.normal)).toEqual(pinRadiusExpr())
    expect(pinFillRadiusExpr(POINT_SIZE_RADIUS_FACTOR.normal)).toEqual(pinFillRadiusExpr())
  })
})

describe('Point Size radius factor (pinRadius* scaled)', () => {
  it('exposes a normal (1×) and small (<1×) factor, small strictly smaller', () => {
    expect(POINT_SIZE_RADIUS_FACTOR.normal).toBe(1)
    expect(POINT_SIZE_RADIUS_FACTOR.small).toBeGreaterThan(0)
    expect(POINT_SIZE_RADIUS_FACTOR.small).toBeLessThan(1)
  })

  it('pinRadiusScaled applies the factor to the outer radius', () => {
    for (const c of COUNTS) {
      expect(pinRadiusScaled(c)).toBe(pinRadius(c)) // default factor 1
      expect(pinRadiusScaled(c, POINT_SIZE_RADIUS_FACTOR.small))
        .toBeCloseTo(pinRadius(c) * POINT_SIZE_RADIUS_FACTOR.small, 4)
    }
  })

  it('scaled radius expression equals pinRadiusScaled for every count (function ↔ expression parity)', () => {
    for (const factor of [POINT_SIZE_RADIUS_FACTOR.normal, POINT_SIZE_RADIUS_FACTOR.small]) {
      const expr = pinRadiusExpr(factor) as unknown[]
      for (const c of COUNTS) {
        expect(evalStep(expr, c)).toBeCloseTo(pinRadiusScaled(c, factor), 4)
      }
    }
  })

  it('scaled fill-radius expression = (outer radius − stroke) × factor for every count', () => {
    for (const factor of [POINT_SIZE_RADIUS_FACTOR.normal, POINT_SIZE_RADIUS_FACTOR.small]) {
      const expr = pinFillRadiusExpr(factor) as unknown[]
      for (const c of COUNTS) {
        const expected = Number(((pinRadius(c) - PIN_STROKE_WIDTH) * factor).toFixed(4))
        expect(evalStep(expr, c)).toBeCloseTo(expected, 4)
      }
    }
  })

  it('Small produces a strictly smaller footprint than Normal at every count', () => {
    const small = pinFillRadiusExpr(POINT_SIZE_RADIUS_FACTOR.small) as unknown[]
    const normal = pinFillRadiusExpr(POINT_SIZE_RADIUS_FACTOR.normal) as unknown[]
    for (const c of COUNTS) {
      expect(evalStep(small, c)).toBeLessThan(evalStep(normal, c))
    }
  })
})

describe('pinOpacity / pinOpacityExpr parity', () => {
  it('matches the documented stops', () => {
    expect(pinOpacity(0)).toBe(0.78)
    expect(pinOpacity(50)).toBe(0.82)
    expect(pinOpacity(100)).toBe(0.88)
    expect(pinOpacity(200)).toBe(0.95)
  })

  it('expression equals the function for every count (factor 1)', () => {
    const expr = pinOpacityExpr() as unknown[]
    for (const c of COUNTS) {
      expect(evalStep(expr, c)).toBeCloseTo(pinOpacity(c), 10)
    }
  })

  it('atlas-dimmed expression equals function × ATLAS_DIM_FACTOR (the DOM 0.25 fade)', () => {
    expect(ATLAS_DIM_FACTOR).toBe(0.25)
    const expr = pinOpacityExpr(ATLAS_DIM_FACTOR) as unknown[]
    for (const c of COUNTS) {
      expect(evalStep(expr, c)).toBeCloseTo(pinOpacity(c) * ATLAS_DIM_FACTOR, 4)
    }
  })

  it('expression is built from the shared stop table', () => {
    expect(pinOpacityExpr()).toEqual(['step', ['get', 'count'], PIN_OPACITY_BASE, ...PIN_OPACITY_STOPS.flat()])
  })
})

describe('updateMapCursor (shared canvas-cursor arbiter)', () => {
  function fakeMap(presentLayers: string[], hitCount: number) {
    const canvas = { style: { cursor: 'unset' } } as unknown as HTMLCanvasElement
    const queried: string[][] = []
    const map: CursorMap = {
      getLayer: (id: string) => (presentLayers.includes(id) ? {} : undefined),
      queryRenderedFeatures: (_point, options) => {
        queried.push(options?.layers ?? [])
        return new Array(hitCount).fill({})
      },
      getCanvas: () => canvas,
    }
    return { map, canvas, queried }
  }

  it('sets pointer when an interactive layer is hit', () => {
    const { map, canvas } = fakeMap(['sr-sight-circle', 'sr-atlas-fill'], 1)
    updateMapCursor(map, [0, 0])
    expect(canvas.style.cursor).toBe('pointer')
  })

  it('clears the cursor when nothing interactive is under the point', () => {
    const { map, canvas } = fakeMap(['sr-sight-circle'], 0)
    updateMapCursor(map, [0, 0])
    expect(canvas.style.cursor).toBe('')
  })

  it('queries only the layers that exist, and skips the query when none do', () => {
    const present = ['sr-hotspot', 'sr-atlas-fill']
    const { map, queried } = fakeMap(present, 1)
    updateMapCursor(map, [0, 0])
    expect(queried).toEqual([present])

    const none = fakeMap([], 1)
    updateMapCursor(none.map, [0, 0])
    expect(none.queried).toEqual([]) // querying with an empty layers list would throw in MapLibre
    expect(none.canvas.style.cursor).toBe('')
  })

  it('covers every interactive layer id used by the map components', () => {
    expect(INTERACTIVE_MAP_LAYERS).toEqual(['sr-sight-circle', 'sr-hotspot', 'sr-atlas-fill'])
  })
})

// DOM markers render a real <button> child for keyboard access; maplibre stamps
// the wrapper with role='button' + aria-label='Map marker', so the wrapper must
// be demoted to avoid a button-in-button announcement (F014/F055).
describe('neutralizeMarkerWrapper', () => {
  // A fake wrapper element recording attribute ops — no DOM needed (node env).
  function fakeMarker() {
    const attrs = new Map<string, string>([['role', 'button'], ['aria-label', 'Map marker']])
    const el = {
      setAttribute: (k: string, v: string) => { attrs.set(k, v) },
      removeAttribute: (k: string) => { attrs.delete(k) },
    } as unknown as HTMLElement
    const marker = { getElement: () => el } as unknown as MaplibreMarker
    return { marker, attrs }
  }

  it('demotes the wrapper to presentation and strips its generic label/tabindex', () => {
    const { marker, attrs } = fakeMarker()
    attrs.set('tabindex', '0')
    neutralizeMarkerWrapper(marker)
    expect(attrs.get('role')).toBe('presentation')
    expect(attrs.has('aria-label')).toBe(false)
    expect(attrs.has('tabindex')).toBe(false)
  })

  it('is null-safe (the ref fires with null on unmount)', () => {
    expect(() => neutralizeMarkerWrapper(null)).not.toThrow()
  })
})

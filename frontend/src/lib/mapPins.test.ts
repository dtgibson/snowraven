// Locks the perf(G) DOM-markers → GL-circle-layer refactor: the step paint
// expressions used by the sr-sight-circle layer must stay equal to the plain
// pinRadius/pinOpacity functions for every count, exactly like heat.test.ts
// locks the heatmap paint expression to lib/heat.ts heatWeight.

import { describe, it, expect } from 'vitest'
import {
  pinRadius, pinOpacity, pinRadiusExpr, pinFillRadiusExpr, pinOpacityExpr,
  PIN_RADIUS_BASE, PIN_RADIUS_STOPS, PIN_OPACITY_BASE, PIN_OPACITY_STOPS,
  ATLAS_DIM_FACTOR, PIN_STROKE_WIDTH,
} from './mapPins'

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

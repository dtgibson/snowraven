// @vitest-environment jsdom
//
// Structural-monotonicity guard for the opt-in hotspot tier ring
// (colorblind-accessible-hotspot-pins) — the countyTextures.test.ts analogue
// for the pin-scale cue. Three concerns, one file:
//
// 1. The HOTSPOT_TIER_ARC spec itself: the approved geometry pinned as
//    literals (the shipped contract, not derived from the code under test),
//    filled-segment count = tier and strictly monotonic, and the ring fitting
//    the free annulus between the glyph extents (~r 8) and the teardrop
//    outline's inner edge (r 13.25) — it never touches either.
//
// 2. The sprite bake (modeTeardropImageData): rings OFF is the shipped path
//    op for op (flag omitted and flag false draw the identical stream — the
//    same operations on the same 2D context are the same pixels); rings ON
//    leaves every non-value state identical and inserts EXACTLY the ring
//    block between the teardrop stroke and the glyph on ramp sprites. jsdom
//    has no real canvas, so the context is a RECORDER, which localizes any
//    drift to the exact operation rather than a pixel diff. (Red-first:
//    demonstrated red against an unconditional-ring mutation of the bake.)
//
// 3. The SVG surfaces (legend mini, popup badge): every rendered ring path is
//    string-equal to the spec-derived tierArcSegmentPath output, so the
//    legend and popup cannot drift from the sprites (NFR-10 — if the spec
//    moves and a surface does not, this fails).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { createElement } from 'react'
import {
  HOTSPOT_TIER_ARC, HOTSPOT_TIER_BADGE, HOTSPOT_TIER_RING_COLOR,
  tierArcSegments, tierArcSegmentPath, rampTierOf,
  modeTeardropImageData, HOTSPOT_MODE_SPRITE_KEYS, TEARDROP,
  type HotspotModeSpriteKey,
} from './mapPins'
import { HotspotModeMiniPin, HotspotTierBadge } from '../components/map/MapSidebarUI'

// ── The recording 2D context ─────────────────────────────────────────────────

type Op = ['set', string, unknown] | ['call', string, unknown[]]

class FakePath2D {
  d?: string
  constructor(d?: string) { this.d = d }
}

let ops: Op[] = []

const serialize = (a: unknown): unknown => (a instanceof FakePath2D ? `Path2D(${a.d})` : a)

function makeCtx(): CanvasRenderingContext2D {
  const ctx = {} as Record<string, unknown>
  for (const p of ['fillStyle', 'strokeStyle', 'lineWidth', 'lineCap', 'lineJoin', 'globalAlpha']) {
    let v: unknown
    Object.defineProperty(ctx, p, {
      get: () => v,
      set: (nv: unknown) => { v = nv; ops.push(['set', p, nv]) },
    })
  }
  for (const m of ['scale', 'fill', 'stroke', 'setLineDash', 'beginPath', 'arc', 'moveTo', 'lineTo', 'getImageData']) {
    ctx[m] = (...args: unknown[]) => {
      ops.push(['call', m, args.map(serialize)])
      if (m === 'getImageData') return { width: 28, height: 40, data: new Uint8ClampedArray(4) }
      return undefined
    }
  }
  return ctx as unknown as CanvasRenderingContext2D
}

beforeEach(() => {
  vi.stubGlobal('Path2D', FakePath2D)
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockImplementation((() => makeCtx()) as never)
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function bake(key: HotspotModeSpriteKey, rings?: boolean): Op[] {
  ops = []
  if (rings === undefined) modeTeardropImageData(key, 1)
  else modeTeardropImageData(key, 1, rings)
  return ops
}

const RAMP_KEYS = HOTSPOT_MODE_SPRITE_KEYS.filter(k => rampTierOf(k) !== null)
const NON_RAMP_KEYS = HOTSPOT_MODE_SPRITE_KEYS.filter(k => rampTierOf(k) === null)

const isRingArc = (o: Op): boolean =>
  o[0] === 'call' && o[1] === 'arc' && (o[2] as unknown[])[2] === HOTSPOT_TIER_ARC.r

// ── 1. The spec ──────────────────────────────────────────────────────────────

describe('HOTSPOT_TIER_ARC spec (the ONE geometry source, NFR-10)', () => {
  it('pins the approved literals', () => {
    expect(HOTSPOT_TIER_ARC).toEqual({
      cx: 14, cy: 14, r: 11.1, width: 2.4,
      segments: 5, gapDeg: 16, startDeg: -90, trackAlpha: 0.28,
    })
    expect(HOTSPOT_TIER_RING_COLOR).toBe('#fff')
  })

  it('filled-segment count = tier, strictly monotonic t1→t5, always 5 drawn segments', () => {
    let prev = 0
    for (let t = 1; t <= 5; t++) {
      const segs = tierArcSegments(t)
      expect(segs.length).toBe(HOTSPOT_TIER_ARC.segments)
      const filled = segs.filter(s => s.filled).length
      expect(filled).toBe(t)
      expect(filled).toBeGreaterThan(prev)
      prev = filled
    }
    expect(prev).toBe(HOTSPOT_TIER_ARC.segments) // t5 closes the ring
  })

  it('segments run clockwise from 12 o\'clock with the gap split evenly', () => {
    const segs = tierArcSegments(5)
    const per = 360 / HOTSPOT_TIER_ARC.segments
    for (let i = 0; i < segs.length; i++) {
      const startDeg = HOTSPOT_TIER_ARC.startDeg + i * per + HOTSPOT_TIER_ARC.gapDeg / 2
      const endDeg = HOTSPOT_TIER_ARC.startDeg + (i + 1) * per - HOTSPOT_TIER_ARC.gapDeg / 2
      expect(segs[i].startRad).toBeCloseTo((startDeg * Math.PI) / 180, 10)
      expect(segs[i].endRad).toBeCloseTo((endDeg * Math.PI) / 180, 10)
    }
  })

  it('the ring fits the free annulus: clears the glyph extents and the outline inner edge', () => {
    // Glyph extents reach ~r 8 from the bulb center; the teardrop outline
    // (lineWidth 1.5 centered on the r-14 bulb) has its inner edge at 13.25.
    expect(HOTSPOT_TIER_ARC.r - HOTSPOT_TIER_ARC.width / 2).toBeGreaterThan(8)
    expect(HOTSPOT_TIER_ARC.r + HOTSPOT_TIER_ARC.width / 2).toBeLessThan(13.25)
  })

  it('the popup badge ring sits fully inside the badge bulb', () => {
    expect(HOTSPOT_TIER_BADGE.ringR + HOTSPOT_TIER_BADGE.ringWidth / 2)
      .toBeLessThan(HOTSPOT_TIER_BADGE.r)
  })

  it('rampTierOf answers ramp keys only (and both partitions are non-empty)', () => {
    expect(RAMP_KEYS.length).toBe(10)
    expect(NON_RAMP_KEYS.length).toBe(6)
    for (const kind of ['visited', 'unvisited'] as const) {
      for (let t = 1; t <= 5; t++) {
        expect(rampTierOf(`t${t}-${kind}` as HotspotModeSpriteKey)).toBe(t)
      }
    }
    for (const key of NON_RAMP_KEYS) expect(rampTierOf(key)).toBeNull()
  })
})

// ── 2. The sprite bake ───────────────────────────────────────────────────────

describe('sprite bake: rings off = shipped, rings on = surgical insertion', () => {
  it('flag omitted and flag false draw the identical op stream for EVERY sprite (default off = shipped)', () => {
    for (const key of HOTSPOT_MODE_SPRITE_KEYS) {
      expect(bake(key, false), key).toEqual(bake(key))
    }
  })

  it('rings-off ramps never draw an arc at the ring radius', () => {
    for (const key of RAMP_KEYS) {
      expect(bake(key, false).filter(isRingArc), key).toEqual([])
    }
  })

  it('rings ON leaves every non-value state identical (rings render on ramp sprites only)', () => {
    for (const key of NON_RAMP_KEYS) {
      expect(bake(key, true), key).toEqual(bake(key, false))
    }
  })

  it('rings ON inserts exactly the ring block between the teardrop stroke and the glyph', () => {
    for (const key of RAMP_KEYS) {
      const off = bake(key, false)
      const on = bake(key, true)
      // The block opens with the ring's lineWidth (2.4 is unique — the
      // teardrop stroke uses 1.5, the visited glyph 2.5) and closes with the
      // trailing globalAlpha reset (nothing after the ring touches alpha).
      const start = on.findIndex(o => o[0] === 'set' && o[1] === 'lineWidth' && o[2] === HOTSPOT_TIER_ARC.width)
      expect(start, key).toBeGreaterThan(0)
      const alphaSets = on.map((o, i) => (o[0] === 'set' && o[1] === 'globalAlpha' ? i : -1)).filter(i => i >= 0)
      const end = alphaSets[alphaSets.length - 1]
      expect(end, key).toBeGreaterThan(start)
      // Splicing the block out restores the shipped stream, op for op — the
      // rings-off path is untouched and the insertion point is exact.
      expect([...on.slice(0, start), ...on.slice(end + 1)], key).toEqual(off)
      // The op immediately before the block is the teardrop outline stroke.
      expect(on[start - 1], key).toEqual(['call', 'stroke', [`Path2D(${TEARDROP})`]])
    }
  })

  it('baked filled-arc count = tier, strictly monotonic per kind; track at trackAlpha; glyph-white stroke', () => {
    for (const kind of ['visited', 'unvisited'] as const) {
      let prev = 0
      for (let t = 1; t <= 5; t++) {
        const key = `t${t}-${kind}` as HotspotModeSpriteKey
        const on = bake(key, true)
        const arcIdx = on.map((o, i) => (isRingArc(o) ? i : -1)).filter(i => i >= 0)
        expect(arcIdx.length, key).toBe(HOTSPOT_TIER_ARC.segments)
        // An arc is FILLED iff the nearest preceding globalAlpha set is 1.
        const alphaBefore = (i: number): unknown => {
          for (let j = i; j >= 0; j--) {
            const o = on[j]
            if (o[0] === 'set' && o[1] === 'globalAlpha') return o[2]
          }
          return undefined
        }
        const filled = arcIdx.filter(i => alphaBefore(i) === 1).length
        const track = arcIdx.filter(i => alphaBefore(i) === HOTSPOT_TIER_ARC.trackAlpha).length
        expect(filled, key).toBe(t)
        expect(track, key).toBe(HOTSPOT_TIER_ARC.segments - t)
        expect(filled, key).toBeGreaterThan(prev)
        prev = filled
        // The ring strokes the glyph white (the HOTSPOT_GLYPH_* family).
        const start = on.findIndex(o => o[0] === 'set' && o[1] === 'lineWidth' && o[2] === HOTSPOT_TIER_ARC.width)
        expect(on.slice(start, arcIdx[0]), key).toContainEqual(['set', 'strokeStyle', HOTSPOT_TIER_RING_COLOR])
      }
    }
  })
})

// ── 3. The SVG surfaces derive from the shared spec (NFR-10) ─────────────────

describe('legend mini + popup badge render the spec-derived geometry', () => {
  it('the ramp mini (rings on) renders exactly the spec-derived segment paths at the sprite radius', () => {
    for (const tier of [1, 3, 5]) {
      const { container, unmount } = render(createElement(HotspotModeMiniPin, { variant: 'ramp', tier, rings: true }))
      const ringPaths = [...container.querySelectorAll('path')].filter(p => p.getAttribute('fill') === 'none')
      const segs = tierArcSegments(tier)
      expect(ringPaths.map(p => p.getAttribute('d'))).toEqual(segs.map(s => tierArcSegmentPath(s)))
      expect(ringPaths.map(p => p.getAttribute('stroke-opacity')))
        .toEqual(segs.map(s => (s.filled ? '1' : String(HOTSPOT_TIER_ARC.trackAlpha))))
      for (const p of ringPaths) {
        expect(p.getAttribute('stroke')).toBe(HOTSPOT_TIER_RING_COLOR)
        expect(p.getAttribute('stroke-width')).toBe(String(HOTSPOT_TIER_ARC.width))
        expect(p.getAttribute('stroke-linecap')).toBe('butt')
      }
      unmount()
    }
  })

  it('the ramp mini (rings off) is the shipped drawing: the teardrop path only', () => {
    const { container } = render(createElement(HotspotModeMiniPin, { variant: 'ramp', tier: 3 }))
    expect(container.querySelectorAll('path').length).toBe(1)
  })

  it('state and personal minis are byte-identical in both toggle states', () => {
    for (const variant of ['hollow', 'nodata', 'unanswered', 'personal'] as const) {
      const off = render(createElement(HotspotModeMiniPin, { variant })).container.innerHTML
      cleanup()
      const on = render(createElement(HotspotModeMiniPin, { variant, rings: true })).container.innerHTML
      cleanup()
      expect(on, variant).toBe(off)
    }
  })

  it('the popup badge draws the same segment angles at the badge radius, ring inside the bulb', () => {
    const { container } = render(createElement(HotspotTierBadge, { tier: 3 }))
    const circle = container.querySelector('circle')!
    expect(circle.getAttribute('r')).toBe(String(HOTSPOT_TIER_BADGE.r))
    expect(circle.getAttribute('stroke-width')).toBe(String(HOTSPOT_TIER_BADGE.stroke))
    const ringPaths = [...container.querySelectorAll('path')]
    const segs = tierArcSegments(3)
    expect(ringPaths.map(p => p.getAttribute('d')))
      .toEqual(segs.map(s => tierArcSegmentPath(s, HOTSPOT_TIER_BADGE.ringR)))
    expect(ringPaths.map(p => p.getAttribute('stroke-opacity')))
      .toEqual(segs.map(s => (s.filled ? '1' : String(HOTSPOT_TIER_ARC.trackAlpha))))
    for (const p of ringPaths) {
      expect(p.getAttribute('stroke-width')).toBe(String(HOTSPOT_TIER_BADGE.ringWidth))
    }
    // The badge SVG is decorative; the mode line's text carries the reading.
    expect(container.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true')
  })
})

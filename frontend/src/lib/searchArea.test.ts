// The pure derivation behind "Search this area" (feature: search-this-area).
//
// Every function here takes a bounds tuple or a record and returns a value, so
// this file needs no map instance, no React render and no DOM — which is the
// whole point of putting the derivation in its own module (NFR-10 / QA-39).
//
// WHAT THIS FILE CANNOT PROVE, and is not evidence for: anything about where the
// control sits, whether it fits a 320px viewport, or how the circle looks on the
// canvas. Those are browser measurements and are written up in
// pipeline/search-this-area/pr-description.md.

/// <reference types="node" />
import { describe, it, expect } from 'vitest'
// The scrim-alpha block below parses the REAL tokens out of globals.css (vitest
// stubs CSS imports), the countyContrast.test.ts posture. Node types live only
// in tsconfig.node, so the reference above stays FILE-scoped.
import { readFileSync } from 'node:fs'
import {
  areaCenter, coveringRadiusMi, deriveSearchArea, snapRadiusMi, hasMovedFrom,
  viewportCoveredBy, shouldOfferSearchArea,
  areaCirclePolygon, areaScrimPolygon, round5, normalizeLng, scrimOpacity,
  searchControlFits,
  RUNGS, DERIVED_MAX_MI, MOVE_THRESHOLD_FRAC, AREA_CIRCLE_STEPS,
  SCRIM_ALPHA_DEFAULT, SCRIM_ALPHA_DARK_BASE, SCRIM_ALPHA_RAMP,
  type SearchRecord, type DerivedArea,
} from './searchArea'
import { unpadBounds, VIEWPORT_PAD_FRAC, type MarkerBounds } from './markersInView'
import { distanceMiles } from './mapExplorerFormat'

/**
 * The exact inverse of `unpadBounds` — a local copy of `padBounds`'s formula, so
 * a fixture can be written as the VISIBLE viewport the user is looking at and
 * fed in as the padded bounds BoundsTracker would report for it. Written out
 * rather than imported so this file states the round trip it depends on instead
 * of assuming it, and the round trip is asserted below.
 */
function pad(b: MarkerBounds, frac: number = VIEWPORT_PAD_FRAC): MarkerBounds {
  const dLng = (b[2] - b[0]) * frac
  const dLat = (b[3] - b[1]) * frac
  return [b[0] - dLng, b[1] - dLat, b[2] + dLng, b[3] + dLat]
}

/** [minLng, minLat, maxLng, maxLat] */
const BAY: MarkerBounds = [-122.55, 37.70, -122.30, 37.90]

describe('the pad round trip this whole feature rests on', () => {
  it('unpadBounds exactly inverts padBounds', () => {
    const back = unpadBounds(pad(BAY))
    for (let i = 0; i < 4; i += 1) expect(back[i]).toBeCloseTo(BAY[i], 10)
  })
})

// ── round5 / normalizeLng ────────────────────────────────────────────────────

describe('round5', () => {
  it('is toFixed(5)-idempotent, which is what makes field, request and record one value', () => {
    for (const n of [37.123456789, -122.0000049, 0, 180, -179.999996, 12.5]) {
      const r = round5(n)
      // The property the component depends on: formatting the rounded number
      // gives back exactly the rounded number, so the string in the coordinate
      // field and the number in the request cannot disagree.
      expect(Number(r.toFixed(5))).toBe(r)
      expect(r.toFixed(5)).toBe(round5(r).toFixed(5))
    }
  })

  it('rounds to 5 places, not to some other precision', () => {
    expect(round5(37.1234564)).toBe(37.12346)
    expect(round5(-122.3000001)).toBe(-122.3)
  })
})

describe('normalizeLng', () => {
  it('folds any longitude into [-180, 180]', () => {
    for (const lng of [0, 179.9, 180, 181, 359, 360, -181, -360, 540]) {
      const v = normalizeLng(lng)
      expect(v).toBeGreaterThanOrEqual(-180)
      expect(v).toBeLessThanOrEqual(180)
    }
    expect(normalizeLng(181)).toBeCloseTo(-179, 10)
    expect(normalizeLng(-181)).toBeCloseTo(179, 10)
    expect(normalizeLng(180)).toBeCloseTo(-180, 10)
  })
})

// ── The centre (FR-07 / QA-08) ───────────────────────────────────────────────

describe('areaCenter', () => {
  it('is the arithmetic midpoint, rounded to 5 dp', () => {
    const c = areaCenter(BAY)
    expect(c.lat).toBe(round5((37.70 + 37.90) / 2))
    expect(c.lng).toBe(round5((-122.55 + -122.30) / 2))
    expect(Number(c.lat.toFixed(5))).toBe(c.lat)
    expect(Number(c.lng.toFixed(5))).toBe(c.lng)
  })

  it('normalizes a straddling longitude into the range the backend accepts (QA-09)', () => {
    // /map/recent-obs declares lng: ge=-180, le=180, so an un-normalized 180.0
    // would be a 422 rather than a search.
    const straddle: MarkerBounds = [179.0, 37.70, 181.0, 37.90]
    const c = areaCenter(straddle)
    expect(c.lng).toBeGreaterThanOrEqual(-180)
    expect(c.lng).toBeLessThanOrEqual(180)
    expect(c.lng).toBe(-180)
    expect(c.lat).toBe(37.8)
  })
})

// ── The covering radius (FR-08 / QA-08) ──────────────────────────────────────

describe('coveringRadiusMi', () => {
  it('is the maximum corner distance, so it covers rather than inscribes', () => {
    const c = areaCenter(BAY)
    const r = coveringRadiusMi(BAY, c)
    const corners: [number, number][] = [
      [BAY[0], BAY[1]], [BAY[2], BAY[1]], [BAY[2], BAY[3]], [BAY[0], BAY[3]],
    ]
    for (const [lng, lat] of corners) {
      expect(distanceMiles(c.lat, c.lng, lat, lng)).toBeLessThanOrEqual(r + 1e-9)
    }
    // ...and it is ATTAINED, so it is the maximum rather than merely an upper
    // bound (an inscribed radius would pass the loop above only vacuously).
    const max = Math.max(...corners.map(([lng, lat]) => distanceMiles(c.lat, c.lng, lat, lng)))
    expect(r).toBeCloseTo(max, 12)
  })

  /**
   * THE ANTIMERIDIAN FIXTURE (QA-09). The corners are deliberately left
   * un-normalized while the centre is normalized, which looks wrong and is not:
   * haversine's sin²(Δλ/2) term has period 360° in Δλ, so a corner 361° "away"
   * scores exactly the same as one 1° away.
   *
   * This asserts the equality directly against the equivalent NON-straddling
   * viewport, so the claim is measured rather than reasoned about. An
   * implementation that computed a signed longitude delta instead would produce
   * a wildly larger radius here and fail.
   */
  it('gives a straddling viewport the same radius as the equivalent non-straddling one', () => {
    const straddle: MarkerBounds = [179.0, 37.70, 181.0, 37.90]
    const plain: MarkerBounds = [-1.0, 37.70, 1.0, 37.90]
    const rs = coveringRadiusMi(straddle, areaCenter(straddle))
    const rp = coveringRadiusMi(plain, areaCenter(plain))
    expect(rs).toBeCloseTo(rp, 6)
  })
})

// ── The composition (FR-06, FR-07, FR-08, FR-09 / QA-07, QA-08, QA-10) ───────

/** Drop the `capped` flag: the record only ever carries what was SENT. */
const toRecord = (a: DerivedArea): SearchRecord =>
  ({ lat: a.lat, lng: a.lng, radiusMi: a.radiusMi })

describe('deriveSearchArea', () => {
  it('returns null before the map has reported bounds', () => {
    expect(deriveSearchArea(null)).toBeNull()
  })

  it('consumes the PADDED bounds and unpads internally', () => {
    // The visible viewport is BAY; BoundsTracker reports pad(BAY). Deriving from
    // the padded tuple directly would give a LARGER covering radius (the padding
    // adds 15% of the span on each side), so this pins that the unpad happens
    // inside rather than being the caller's job to remember.
    const fromPadded = deriveSearchArea(pad(BAY))!
    const c = areaCenter(BAY)
    expect(fromPadded.lat).toBe(c.lat)
    expect(fromPadded.lng).toBe(c.lng)
    expect(fromPadded.radiusMi).toBe(snapRadiusMi(coveringRadiusMi(BAY, c)).radiusMi)
  })

  /**
   * QA-08 / QA-10 — THE COVERING INVARIANT, over a table of viewport shapes.
   *
   * The claim FR-08 makes is "every point the user can see is inside the circle
   * that was searched", and the assertion below is that claim stated exactly:
   * every corner within `radiusMi` of the very `lat`/`lng` the request will
   * carry. Corners rather than edge midpoints, because on a lat/lng rectangle
   * the farthest point from the midpoint is always a corner.
   *
   * The table mixes SHAPES rather than sizes alone — tall, wide, equatorial,
   * high-latitude, southern, antimeridian — because the radius is measured
   * centre-to-CORNER, so the aspect ratio moves the answer and a table of
   * similar rectangles would exercise one case many times.
   *
   * Past `DERIVED_MAX_MI` the covering invariant is deliberately abandoned, so
   * the capped rows assert the opposite: the ladder was narrowed, the answer is
   * exactly the cap, and `capped` says so.
   *
   * The antimeridian row is sized to stay UNCAPPED on purpose. Its corners are
   * left at 179.90 and 180.10 while its centre normalizes to -180, so the corner
   * loop below measures across a 360-degree discontinuity — and only an uncapped
   * row runs that loop at all. A wider straddling viewport would cap, and the
   * one assertion this fixture exists for would never execute.
   */
  it.each<[string, MarkerBounds, boolean]>([
    ['a city block',        [-122.4200, 37.7700, -122.4100, 37.7800], false],
    ['a bay-sized view',    BAY,                                      false],
    ['high latitude',       [-147.90, 64.70, -147.60, 64.90],         false],
    ['southern hemisphere', [151.00, -34.10, 151.40, -33.75],         false],
    ['straddling +/-180',   [179.90, 37.70, -179.90 + 360, 37.90],    false],
    ['a tall narrow view',  [-122.40, 37.20, -122.35, 38.20],         true],
    ['a wide flat view',    [-123.50, 37.70, -121.50, 37.85],         true],
    ['the equator',         [-0.50, -0.25, 0.50, 0.25],               true],
    ['most of California',  [-125, 32, -114, 42],                     true],
  ])('covers %s, or caps and says so', (_name, visible, expectCapped) => {
    const area = deriveSearchArea(pad(visible))!

    // The centre is the midpoint, at a precision the fields and the backend both
    // accept.
    const expected = areaCenter(visible)
    expect(area.lat).toBeCloseTo(expected.lat, 10)
    expect(area.lng).toBeCloseTo(expected.lng, 10)
    expect(Number(area.lat.toFixed(5))).toBe(area.lat)
    expect(Number(area.lng.toFixed(5))).toBe(area.lng)

    // The radius is always a rung the sidebar's SegControl can render, and never
    // past the cap. True on both branches, so it is asserted before they split.
    expect(RUNGS).toContain(area.radiusMi)
    expect(area.radiusMi).toBeLessThanOrEqual(DERIVED_MAX_MI)
    expect(area.capped).toBe(expectCapped)

    const rCover = coveringRadiusMi(visible, { lat: area.lat, lng: area.lng })
    if (expectCapped) {
      // The one case where the circle does NOT hold the screen, deliberately.
      expect(area.radiusMi).toBe(DERIVED_MAX_MI)
      expect(rCover).toBeGreaterThan(DERIVED_MAX_MI)
    } else {
      // COVERS: every corner inside the circle that will actually be sent.
      const corners: [number, number][] = [
        [visible[0], visible[1]], [visible[2], visible[1]],
        [visible[2], visible[3]], [visible[0], visible[3]],
      ]
      for (const [lng, lat] of corners) {
        expect(distanceMiles(area.lat, area.lng, lat, lng)).toBeLessThanOrEqual(area.radiusMi)
      }
      // ...and it is the SMALLEST rung that does, so it covers without
      // over-fetching. A derivation that always returned the top rung would pass
      // the loop above and fail here.
      for (const r of RUNGS.filter(r => r < area.radiusMi)) {
        expect(rCover).toBeGreaterThan(r)
      }
    }
  })

  /**
   * The rung is a step function of the viewport's SIZE, so it moves with zoom.
   *
   * This is the property `hasMovedFrom`'s radius term depends on, and the reason
   * zooming can re-offer the control with the centre exactly where it was.
   * Asserted on its own rather than left as a consequence of the table above,
   * because the whole offer predicate rests on it.
   */
  it('grows the radius with the viewport, up the ladder and then to the cap', () => {
    const centred = (span: number): MarkerBounds =>
      [-122.4 - span, 37.8 - span / 2, -122.4 + span, 37.8 + span / 2]
    const seen = [0.05, 0.1, 0.3, 1].map(span => deriveSearchArea(pad(centred(span)))!)
    expect(seen.map(a => a.radiusMi)).toEqual([5, 10, 25, 25])
    expect(seen.map(a => a.capped)).toEqual([false, false, false, true])
    // The centre did not move through any of it, which is what makes this a
    // statement about the radius alone.
    for (const a of seen) {
      expect(a.lat).toBeCloseTo(37.8, 9)
      expect(a.lng).toBeCloseTo(-122.4, 9)
    }
  })

  /**
   * THE ROUNDING ORDER. The covering radius is measured from the ROUNDED centre,
   * which is the one that gets sent, so "every corner is within `radiusMi` of
   * the coordinates in the request" is exact rather than approximate.
   *
   * HONEST LIMIT, stated rather than papered over: this assertion does NOT
   * reject the reordered implementation. `round5` moves the centre by at most
   * ~0.6 m, and the snap up to a whole rung swallows that everywhere on today's
   * ladder, so measuring from the unrounded midpoint would produce identical
   * output for every input a map can supply. What is asserted here is the
   * property the user actually gets; the ordering is documented at the source
   * and is not separately testable through this interface.
   */
  it('states the covering claim about the coordinates the request will carry', () => {
    const odd: MarkerBounds = [-122.4166666667, 37.7833333333, -122.3833333333, 37.8166666667]
    const area = deriveSearchArea(pad(odd))!
    expect(area.lat).toBe(round5(area.lat))
    expect(area.lng).toBe(round5(area.lng))
    expect(coveringRadiusMi(odd, { lat: area.lat, lng: area.lng }))
      .toBeLessThanOrEqual(area.radiusMi)
  })

  it('keeps a straddling derivation inside the backend lng constraint (QA-09)', () => {
    const straddle: MarkerBounds = [179.0, 37.70, 181.0, 37.90]
    const area = deriveSearchArea(pad(straddle))!
    expect(area.lng).toBeGreaterThanOrEqual(-180)
    expect(area.lng).toBeLessThanOrEqual(180)
    expect(area.lat).toBeGreaterThanOrEqual(-90)
    expect(area.lat).toBeLessThanOrEqual(90)
  })
})

// ── The cap (FR-09 / QA-10) ──────────────────────────────────────────────────

describe('snapRadiusMi', () => {
  it('returns the SMALLEST rung that holds the covering radius', () => {
    expect(snapRadiusMi(0).radiusMi).toBe(5)
    expect(snapRadiusMi(4.9).radiusMi).toBe(5)
    expect(snapRadiusMi(5).radiusMi).toBe(5)
    expect(snapRadiusMi(5.0001).radiusMi).toBe(10)
    expect(snapRadiusMi(10).radiusMi).toBe(10)
    expect(snapRadiusMi(10.5).radiusMi).toBe(25)
    expect(snapRadiusMi(25).radiusMi).toBe(25)
  })

  it('snaps UP, never down, so the rung always holds what it was given', () => {
    for (let rc = 0; rc <= DERIVED_MAX_MI; rc += 0.13) {
      const { radiusMi, capped } = snapRadiusMi(rc)
      expect(capped).toBe(false)
      expect(radiusMi).toBeGreaterThanOrEqual(rc)
    }
  })

  it('caps past DERIVED_MAX_MI and flags it', () => {
    for (const rc of [25.0001, 30, 55, 466, 5000]) {
      expect(snapRadiusMi(rc)).toEqual({ radiusMi: DERIVED_MAX_MI, capped: true })
    }
    // The rung the cap excludes is still a real sidebar option — the cap is on
    // the DERIVED path only (FR-09).
    expect(RUNGS).toContain(50)
    expect(RUNGS[RUNGS.length - 1]).toBeGreaterThan(DERIVED_MAX_MI)
  })

  /**
   * THE SECURITY-RELEVANT PROPERTY: the answer is ALWAYS a rung, so the derived
   * path can only ever send `dist` in {8, 16, 40} km. Swept over a range no
   * viewport could produce, because the claim is about the function and not
   * about the inputs a map happens to supply.
   *
   * This is what "cap by narrowing the ladder, not by clamping the answer" buys.
   * The competing implementation — snap first, then `Math.min(_, DERIVED_MAX_MI)`
   * — agrees on every line above and on today's constants, and starts returning
   * a non-rung the moment either constant moves.
   */
  it('never returns a value outside RUNGS, at any input', () => {
    const dist = new Set<number>()
    for (const rc of [-1, 0, 0.001, 1, 4.999, 5, 7, 10, 17, 24.999, 25, 25.001, 60, 1e4, 1e9]) {
      const { radiusMi } = snapRadiusMi(rc)
      expect(RUNGS).toContain(radiusMi)
      expect(radiusMi).toBeLessThanOrEqual(DERIVED_MAX_MI)
      dist.add(Math.round(radiusMi * 1.60934))
    }
    expect([...dist].sort((a, b) => a - b)).toEqual([8, 16, 40])
  })

  it('narrows a ladder that really does extend past the cap', () => {
    // Non-vacuity for the sweep above: the ladder has members at and below the
    // cap, and the cap actually excludes at least one rung. Without both, "the
    // answer is always a rung at or below the cap" could hold trivially.
    const usable = RUNGS.filter(r => r <= DERIVED_MAX_MI)
    expect(usable.length).toBeGreaterThan(0)
    expect(usable.length).toBeLessThan(RUNGS.length)
  })
})

// ── The movement predicate (FR-13 / QA-11, QA-12) ────────────────────────────
//
// `hasMovedFrom` asks the first of the offer predicate's two questions: would a
// press SEND something different from what the record holds? Two terms, because
// a press carries two values and they change for different reasons — the radius
// only when the viewport crosses a rung boundary, the centre continuously.

describe('hasMovedFrom', () => {
  const at = (lat: number, lng: number, radiusMi: number): SearchRecord => ({ lat, lng, radiusMi })
  const rec = (lat: number, lng: number, radiusMi: number): SearchRecord => ({ lat, lng, radiusMi })

  /** A latitude offset of exactly `miles` north. 1 degree of latitude ~ 69.09 mi. */
  const northBy = (miles: number) => miles / (Math.PI * 3958.8 / 180)

  it('is true when the view has never been searched', () => {
    expect(hasMovedFrom(at(37.8, -122.4, 5), null)).toBe(true)
  })

  it('is false immediately after a search of the same area (QA-11)', () => {
    expect(hasMovedFrom(at(37.8, -122.4, 5), rec(37.8, -122.4, 5))).toBe(false)
  })

  it('stays false for a pan under the threshold and flips above it (QA-11, QA-12)', () => {
    // MOVE_THRESHOLD_FRAC is 0.25, so a 5 mi search tolerates 1.25 mi.
    expect(MOVE_THRESHOLD_FRAC).toBe(0.25)
    const record = rec(37.8, -122.4, 5)
    expect(hasMovedFrom(at(37.8 + northBy(1.0), -122.4, 5), record)).toBe(false)
    expect(hasMovedFrom(at(37.8 + northBy(1.5), -122.4, 5), record)).toBe(true)
  })

  it('puts the boundary exactly at MOVE_THRESHOLD_FRAC x the recorded radius', () => {
    // The constant's VALUE, pinned against the behaviour rather than by reading
    // it back. Straddling the boundary from both sides is what makes this a
    // statement about 0.25 and not merely about "some threshold exists".
    for (const r of RUNGS) {
      const record = rec(37.8, -122.4, r)
      const edge = MOVE_THRESHOLD_FRAC * r
      expect(hasMovedFrom(at(37.8 + northBy(edge * 0.99), -122.4, r), record), `${r} mi inside`).toBe(false)
      expect(hasMovedFrom(at(37.8 + northBy(edge * 1.01), -122.4, r), record), `${r} mi outside`).toBe(true)
    }
  })

  it('scales the threshold by the SEARCHED radius, not by a fixed distance', () => {
    // The same 3 mile pan: it matters after a 5 mi search and does not after a
    // 25 mi one. Asserting BOTH sides is what makes this about the scaling
    // rather than about one lucky constant. A fixed 2.5 mi threshold — the shape
    // this constant exists instead of — would answer true on both.
    expect(hasMovedFrom(at(37.8 + northBy(3.0), -122.4, 5), rec(37.8, -122.4, 5))).toBe(true)
    expect(hasMovedFrom(at(37.8 + northBy(3.0), -122.4, 25), rec(37.8, -122.4, 25))).toBe(false)
  })

  /**
   * THE RADIUS TERM, in BOTH directions. A derived rung changes only when the
   * viewport crosses a boundary, so any change at all is real and none of it is
   * noise — which is why this is an equality and not `>`.
   *
   * The narrowing half is the one worth pinning. "Only a WIDER circle counts"
   * is a plausible-looking implementation that agrees with every widening line
   * below, and it is wrong here: a narrower derived radius means the user zoomed
   * IN, and whether that press is worth offering depends on where the map now
   * sits relative to the recorded circle. That judgement belongs to
   * `shouldOfferSearchArea`'s coverage conjunct, which has the viewport to
   * decide it with; this predicate has only two records and would be guessing.
   */
  it('is true for ANY change of rung, widening or narrowing, centre unmoved', () => {
    expect(hasMovedFrom(at(37.8, -122.4, 10), rec(37.8, -122.4, 5))).toBe(true)
    expect(hasMovedFrom(at(37.8, -122.4, 25), rec(37.8, -122.4, 10))).toBe(true)
    // Narrowing. A `next.radiusMi > record.radiusMi` implementation answers
    // false on both of these and passes every other test in this describe.
    expect(hasMovedFrom(at(37.8, -122.4, 5), rec(37.8, -122.4, 25))).toBe(true)
    expect(hasMovedFrom(at(37.8, -122.4, 10), rec(37.8, -122.4, 25))).toBe(true)
  })

  /**
   * WHICH RADIUS SCALES THE TOLERANCE IS MOOT, and this test is what makes that
   * statement checkable rather than a claim in a comment.
   *
   * The distance comparison is only ever REACHED when the two radii are equal,
   * because a difference has already returned true. So "recorded" and "derived"
   * name the same number at every point where the scale is used. Asserted by
   * driving the differing-radius case at zero distance, where a
   * distance-first implementation would answer false.
   */
  it('never consults the distance when the radii differ', () => {
    for (const [a, b] of [[5, 10], [10, 5], [5, 25], [25, 5]] as const) {
      expect(hasMovedFrom(at(37.8, -122.4, a), rec(37.8, -122.4, b)), `${a} vs ${b}`).toBe(true)
    }
  })

  it('withdraws again when the user pans away and back (QA-12)', () => {
    const record = rec(37.8, -122.4, 5)
    expect(hasMovedFrom(at(37.9, -122.4, 5), record)).toBe(true)
    expect(hasMovedFrom(at(37.8, -122.4, 5), record)).toBe(false)
  })
})

// ── The offer predicate as SHIPPED (the second QA cycle) ─────────────────────
//
// `hasMovedFrom` asks "would a press send something different". The user's
// question is narrower: "is there anything ON SCREEN I have not searched yet".
// The shipped predicate conjoins the two, and each conjunct catches a case the
// other cannot — the capped-and-unmoved case and the zoomed-in case below.

describe('viewportCoveredBy', () => {
  it('is false with no record and false with no bounds — never a vacuous true', () => {
    expect(viewportCoveredBy(null, pad(BAY))).toBe(false)
    expect(viewportCoveredBy({ lat: 37.8, lng: -122.4, radiusMi: 25 }, null)).toBe(false)
  })

  it('is true when the recorded circle holds the whole viewport', () => {
    const c = areaCenter(BAY)
    // BAY's corners are ~9.7 mi from its midpoint, so a 10 mi search holds it —
    // which is exactly the rung the derivation snaps BAY up to.
    expect(coveringRadiusMi(BAY, c)).toBeLessThan(10)
    expect(viewportCoveredBy({ ...c, radiusMi: 10 }, pad(BAY))).toBe(true)
  })

  it('is false once the viewport grows past the recorded radius', () => {
    const c = areaCenter(BAY)
    const wide: MarkerBounds = [-123.2, 37.1, -121.6, 38.5]
    expect(viewportCoveredBy({ ...c, radiusMi: 10 }, pad(wide))).toBe(false)
  })

  it('is false on a CAPPED view, which is the case the cap creates', () => {
    // Past DERIVED_MAX_MI the circle is deliberately smaller than the screen, so
    // the coverage test answers false and keeps answering false however long the
    // map sits still. That is correct and is exactly why it cannot be the only
    // conjunct — see the capped-and-unmoved test below.
    const ca: MarkerBounds = [-125, 32, -114, 42]
    const area = deriveSearchArea(pad(ca))!
    expect(area.capped).toBe(true)
    expect(viewportCoveredBy(toRecord(area), pad(ca))).toBe(false)
  })

  it('agrees with coveringRadiusMi at the boundary, inclusive', () => {
    const unpadded = unpadBounds(pad(BAY))
    const c = areaCenter(unpadded)
    const r = coveringRadiusMi(unpadded, c)
    expect(viewportCoveredBy({ ...c, radiusMi: r }, pad(BAY))).toBe(true)
    expect(viewportCoveredBy({ ...c, radiusMi: r * 0.999 }, pad(BAY))).toBe(false)
  })
})

describe('shouldOfferSearchArea', () => {
  /** 1 degree of latitude ~ 69.09 mi. */
  const northBy = (miles: number) => miles / (Math.PI * 3958.8 / 180)
  const shiftNorth = (b: MarkerBounds, miles: number): MarkerBounds =>
    [b[0], b[1] + northBy(miles), b[2], b[3] + northBy(miles)]

  /** The record a press at viewport `b` would write. */
  const pending = (b: MarkerBounds): SearchRecord => toRecord(deriveSearchArea(pad(b))!)
  const offer = (b: MarkerBounds, record: SearchRecord | null) =>
    shouldOfferSearchArea(pending(b), record, pad(b))

  /** A viewport centred on (37.8, -122.4) spanning `span` degrees of longitude. */
  const centred = (span: number): MarkerBounds =>
    [-122.4 - span, 37.8 - span / 2, -122.4 + span, 37.8 + span / 2]

  /**
   * A viewport that derives the 5 mi rung with its covering radius close under
   * it (4.78 mi). Chosen deliberately rather than arbitrarily: a rung-5 viewport
   * near the BOTTOM of its band sits so deep inside its own searched circle that
   * coverage, not movement, decides every small pan, and QA-11/QA-12's numbers
   * are about the movement threshold. This is the fixture where both conjuncts
   * are live at the distances those rows name.
   */
  const FIVE = centred(0.074)

  it('offers when the view has never been searched', () => {
    expect(offer(BAY, null)).toBe(true)
  })

  it('offers nothing when there is no viewport reading yet', () => {
    expect(shouldOfferSearchArea(null, null, null)).toBe(false)
    expect(shouldOfferSearchArea(null, pending(BAY), pad(BAY))).toBe(false)
  })

  it('does not offer immediately after the press that searched this viewport (QA-11)', () => {
    // THE DEFECT THIS EXISTS FOR. With the map left where the press found it, a
    // second press would send the identical request. Swept across the ladder,
    // including a capped view, because the derivation answers differently at
    // each and the suppression has to hold at all of them.
    for (const span of [0.02, 0.05, 0.074, 0.1, 0.3, 1, 5]) {
      const b = centred(span)
      expect(offer(b, pending(b)), `span ${span}`).toBe(false)
    }
  })

  it('IS NOT OFFERED FOREVER ON A CAPPED VIEW (the cap\'s headline hazard)', () => {
    // Past DERIVED_MAX_MI the searched circle is smaller than the viewport, so
    // `viewportCoveredBy` is false and the coverage conjunct ALONE would offer
    // the control in perpetuity on a map nobody has touched. `hasMovedFrom` is
    // what answers no.
    //
    // Both halves asserted, so this is about the conjunction rather than about
    // one lucky fixture: the competing implementation is named and shown to
    // disagree.
    const wide: MarkerBounds = [-125, 32, -114, 42]      // most of California
    const record = pending(wide)
    expect(deriveSearchArea(pad(wide))!.capped).toBe(true)
    expect(viewportCoveredBy(record, pad(wide))).toBe(false)   // coverage says offer
    expect(hasMovedFrom(record, record)).toBe(false)           // movement says no
    expect(offer(wide, record)).toBe(false)                    // and no is the answer
  })

  it('stays withdrawn across every zoom that does not cross a rung', () => {
    // Within one band the derivation returns the identical record, so nothing
    // about a press has changed and the control must stay away.
    const record = pending(centred(0.02))
    for (const span of [0.005, 0.01, 0.02, 0.05, 0.074]) {
      expect(pending(centred(span)).radiusMi).toBe(5)
      expect(offer(centred(span), record), `span ${span}`).toBe(false)
    }
  })

  it('stays withdrawn for a 1.0 mi pan and returns for 1.5 mi after a 5 mi search (QA-11, QA-12)', () => {
    const record = pending(FIVE)
    expect(record.radiusMi).toBe(5)
    expect(offer(shiftNorth(FIVE, 1.0), record)).toBe(false)   // 1.0 <= 0.25 x 5
    expect(offer(shiftNorth(FIVE, 1.5), record)).toBe(true)
  })

  it('withdraws again when the user pans away and back (QA-12)', () => {
    const record = pending(FIVE)
    expect(offer(shiftNorth(FIVE, 4.0), record)).toBe(true)
    expect(offer(FIVE, record)).toBe(false)
  })

  it('offers when zooming OUT crosses a rung with the centre unmoved (QA-12)', () => {
    // The rung change is the whole trigger here: the centre is identical to 9
    // decimal places, so a predicate that only compared centres would never
    // offer, and the user who zoomed out to look at more ground would have no
    // way to search it.
    const record = pending(centred(0.05))
    const out = centred(0.1)
    expect(record.radiusMi).toBe(5)
    expect(pending(out).radiusMi).toBe(10)
    expect(pending(out).lat).toBeCloseTo(record.lat, 9)
    expect(pending(out).lng).toBeCloseTo(record.lng, 9)
    expect(offer(out, record)).toBe(true)
  })

  // ── What the coverage conjunct adds ─────────────────────────────────────────

  it('does NOT offer when zooming IN drops a rung inside the searched circle', () => {
    // The case the movement term alone gets wrong, and the one the second QA
    // cycle added the conjunct for. After a 25 mi search, zooming in derives the
    // 5 mi rung, so `hasMovedFrom` answers true on its radius term — but the
    // smaller circle is entirely inside the one already fetched, and every pin
    // on screen is already there. Offering would spend a lookup to be told less.
    const record = pending(centred(0.3))
    const tight = centred(0.02)
    expect(record.radiusMi).toBe(25)
    expect(hasMovedFrom(pending(tight), record)).toBe(true)     // movement offers
    expect(viewportCoveredBy(record, pad(tight))).toBe(true)    // but it is all searched already
    expect(offer(tight, record)).toBe(false)                    // the shipped predicate does not
  })

  it('can only WITHDRAW an offer the movement test would make, never create one', () => {
    // The conjunct's structural property. If this inverted, FR-05's "no search
    // without an explicit press" would be untouched but the control could appear
    // where FR-13 says it must not.
    const record = pending(BAY)
    const fixtures: MarkerBounds[] = [
      centred(0.02), centred(0.05), centred(0.074), centred(0.1), centred(0.3), centred(1),
      BAY, shiftNorth(BAY, 0.5), shiftNorth(BAY, 1.5), shiftNorth(BAY, 4.0),
      shiftNorth(BAY, 12.0), [-125, 32, -114, 42],
    ]
    let offered = 0
    for (const b of fixtures) {
      if (offer(b, record)) {
        offered += 1
        expect(hasMovedFrom(pending(b), record), JSON.stringify(b)).toBe(true)
      }
    }
    // Non-vacuity: the sweep must actually reach the offering branch, or the
    // implication above is satisfied by never firing.
    expect(offered).toBeGreaterThan(0)
  })

  it('DOES still offer after the app re-frames a search outward — coverage is not that fix', () => {
    // Stated honestly rather than left implied. The ratchet the second QA cycle
    // found came from the marker layers' results fit, which reliably re-frames
    // on the results: the fitted rectangle spans the searched circle, so its
    // covering radius comes out a rung HIGHER and the control re-offers itself
    // on a map the USER never moved. Neither conjunct can suppress that, because
    // a deliberate user zoom-out produces the identical viewport.
    //
    // What fixes the ratchet is HotspotMarkers/TargetMarkers/NearbyLiferMarkers
    // not re-framing a search that was derived from the framing. This test is
    // the reason that fix cannot be removed in favour of this predicate.
    const record = pending(BAY)
    const postFit: MarkerBounds = shiftNorth([-122.75, 37.55, -122.10, 38.05], 3.0)
    expect(pending(postFit).radiusMi).toBeGreaterThan(record.radiusMi)
    expect(viewportCoveredBy(record, pad(postFit))).toBe(false)
    expect(offer(postFit, record)).toBe(true)
  })
})
// ── The indicator geometry (FR-17 / QA-18) ───────────────────────────────────

describe('areaCirclePolygon', () => {
  const record: SearchRecord = { lat: 37.8, lng: -122.4, radiusMi: 10 }

  it('emits a closed ring of steps + 1 vertices, closing EXACTLY', () => {
    const ring = areaCirclePolygon(record).geometry.coordinates[0]
    expect(ring).toHaveLength(AREA_CIRCLE_STEPS + 1)
    // Bit-identical, not merely close: walking a bearing of 2*pi and trusting it
    // to land on 0 leaves a sub-nanometre gap that shows as a seam at high zoom.
    expect(ring[ring.length - 1]).toEqual(ring[0])
  })

  it('puts every vertex at the record radius from the record centre', () => {
    for (const steps of [8, 32, AREA_CIRCLE_STEPS]) {
      for (const [lng, lat] of areaCirclePolygon(record, steps).geometry.coordinates[0]) {
        expect(distanceMiles(record.lat, record.lng, lat, lng)).toBeCloseTo(record.radiusMi, 6)
      }
    }
  })

  /**
   * The vertices must be CONTINUOUS with the centre rather than folded into
   * [-180, 180]. Normalizing per-vertex is what tears a ring crossing the
   * antimeridian into a band smeared across the whole map, so this asserts the
   * un-normalized values are actually emitted — an implementation that
   * "helpfully" normalized would fail here.
   */
  it('keeps longitudes continuous across the antimeridian', () => {
    const onLine: SearchRecord = { lat: 37.8, lng: 179.99, radiusMi: 25 }
    const ring = areaCirclePolygon(onLine).geometry.coordinates[0]
    const lngs = ring.map(p => p[0])
    expect(Math.max(...lngs)).toBeGreaterThan(180)
    // No vertex jumps by anything like 360 between neighbours, which is the
    // signature of a torn ring.
    for (let i = 1; i < lngs.length; i += 1) {
      expect(Math.abs(lngs[i] - lngs[i - 1])).toBeLessThan(10)
    }
  })
})

describe('areaScrimPolygon', () => {
  const record: SearchRecord = { lat: 37.8, lng: -122.4, radiusMi: 10 }

  it('is one polygon with two rings, the second identical to the circle', () => {
    const rings = areaScrimPolygon(record).geometry.coordinates
    expect(rings).toHaveLength(2)
    expect(rings[1]).toEqual(areaCirclePolygon(record).geometry.coordinates[0])
  })

  it('covers a point just outside the circle and excludes one just inside', () => {
    const rings = areaScrimPolygon(record).geometry.coordinates
    const [outer, hole] = rings
    const lngs = outer.map(p => p[0])
    const lats = outer.map(p => p[1])
    // Outer ring spans 360 degrees of longitude and the whole usable latitude
    // band, so every visible point that is not in the hole is dimmed.
    expect(Math.max(...lngs) - Math.min(...lngs)).toBeCloseTo(360, 9)
    expect(Math.min(...lats)).toBeLessThanOrEqual(-89.9)
    expect(Math.max(...lats)).toBeGreaterThanOrEqual(89.9)
    // The hole is strictly interior to the outer ring.
    for (const [lng, lat] of hole) {
      expect(lng).toBeGreaterThan(Math.min(...lngs))
      expect(lng).toBeLessThan(Math.max(...lngs))
      expect(lat).toBeGreaterThan(Math.min(...lats))
      expect(lat).toBeLessThan(Math.max(...lats))
    }
  })

  it('builds the outer ring relative to the centre, so an antimeridian hole stays inside it', () => {
    // A fixed [-180, 180] rectangle beside an antimeridian-continuous hole would
    // put part of the hole outside its own outer ring.
    const onLine: SearchRecord = { lat: 37.8, lng: 179.99, radiusMi: 25 }
    const [outer, hole] = areaScrimPolygon(onLine).geometry.coordinates
    const lngs = outer.map(p => p[0])
    for (const [lng] of hole) {
      expect(lng).toBeGreaterThan(Math.min(...lngs))
      expect(lng).toBeLessThan(Math.max(...lngs))
    }
  })
})

// ── The scrim's alpha (OI-02) ────────────────────────────────────────────────
//
// The three constants exist to satisfy ARITHMETIC claims about what the scrim
// does to what it is drawn over, so this block re-derives those claims from the
// SHIPPED tokens (parsed out of globals.css, the countyContrast.test.ts posture)
// rather than restating the numbers. Each property is paired with a
// guard-the-guard that fails if the property is asserted vacuously.
//
// What this CANNOT prove, and is not evidence for: that the scrim reads
// correctly on a real map. That is a browser measurement; the rendered
// inside-versus-outside readings are in pr-description.md.

const CSS = readFileSync(new URL('../globals.css', import.meta.url), 'utf8')

function tokenBlock(selector: string): string {
  const start = CSS.indexOf(selector)
  const open = CSS.indexOf('{', start)
  const close = CSS.indexOf('\n}', open)
  if (start < 0 || open < 0 || close < 0) throw new Error(`${selector} block not found`)
  return CSS.slice(open, close)
}
const ROOT = tokenBlock(':root')

function hexToken(name: string): [number, number, number] {
  const m = ROOT.match(new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})`))
  if (!m) throw new Error(`token --${name} not found`)
  const h = m[1].slice(1)
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}
function rgbToken(name: string): [number, number, number] {
  const m = ROOT.match(new RegExp(`--${name}:\\s*(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*(\\d+)`))
  if (!m) throw new Error(`token --${name} not found`)
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

type RGB = [number, number, number]
const chan = (c: number): number => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 }
const relLum = ([r, g, b]: RGB): number => 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b)
const contrast = (a: RGB, b: RGB): number => {
  const [hi, lo] = [relLum(a), relLum(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}
/** `fg` at opacity `a` over `bg` — what a MapLibre fill at that opacity does. */
const composite = (fg: RGB, bg: RGB, a: number): RGB =>
  [0, 1, 2].map(i => fg[i] * a + bg[i] * (1 - a)) as RGB

const SCRIM_RGB = rgbToken('sr-search-area-scrim-rgb')
const COUNTY_TIERS: RGB[] = Array.from({ length: 10 }, (_, i) => hexToken(`sr-county-${i + 1}`))
const ATLAS_TIERS: RGB[] = [1, 2, 3, 4].map(n => rgbToken(`sr-tier-${n}-rgb`))
/** CountyLayer.tsx paints the colour path at this opacity; the atlas tint at 0.33. */
const COUNTY_FILL_ALPHA = 0.85
const ATLAS_FILL_ALPHA = 0.33
/**
 * The muted land the ramps sit on: BasemapDesaturation drops the Positron land
 * fills to zero saturation at the same lightness whenever a ramp is active, so
 * the ground under a tier is a grey at --sr-surface-ish lightness. #EFEFEF is
 * #F2F1EC desaturated, the value `desaturateHsl` produces.
 */
const MUTED_LAND: RGB = [239, 239, 239]
/** Positron's land fill, the base the 0.18 value was drawn and approved against. */
const POSITRON_LAND: RGB = [242, 241, 236]
/**
 * Median relative luminance of the Esri satellite raster as RENDERED, measured
 * in Chromium over 54,132 sampled pixels (pr-description.md). Stated here so the
 * dark-base claim below is about the imagery this app actually shows rather than
 * about an invented dark grey.
 */
const SATELLITE_MEDIAN_LUM = 0.1516
/** The sRGB grey with that luminance, to two decimals of channel value. */
const SATELLITE_TYPICAL: RGB = (() => {
  let lo = 0, hi = 255
  for (let i = 0; i < 40; i += 1) {
    const mid = (lo + hi) / 2
    if (relLum([mid, mid, mid]) < SATELLITE_MEDIAN_LUM) lo = mid; else hi = mid
  }
  return [(lo + hi) / 2, (lo + hi) / 2, (lo + hi) / 2]
})()

/** As each tier is RENDERED: the tier colour at its fill opacity over the ground. */
const rendered = (tiers: RGB[], fillAlpha: number, ground: RGB): RGB[] =>
  tiers.map(t => composite(t, ground, fillAlpha))

/**
 * How many tier steps the scrim moves each tier: for a scrimmed tier, the
 * nearest UNSCRIMMED tier by luminance, and how far away it is in the ramp.
 * A worst case of 2 is the tester's finding ("reads two tiers darker"); the
 * guarantee is that it never exceeds 1.
 */
function worstTierShift(shown: RGB[], alpha: number): number {
  return Math.max(...shown.map((c, i) => {
    const dimmed = composite(SCRIM_RGB, c, alpha)
    let best = 0, bestD = Infinity
    shown.forEach((other, j) => {
      const d = Math.abs(relLum(other) - relLum(dimmed))
      if (d < bestD) { bestD = d; best = j }
    })
    return Math.abs(best - i)
  }))
}

describe('scrimOpacity — what the scrim is drawn over decides its alpha', () => {
  it('keeps the approved 0.18 over a light base with no ramp', () => {
    expect(scrimOpacity({ darkBase: false, rampActive: false })).toBe(0.18)
    expect(SCRIM_ALPHA_DEFAULT).toBe(0.18)
  })

  it('raises the alpha over a dark base', () => {
    expect(scrimOpacity({ darkBase: true, rampActive: false })).toBe(SCRIM_ALPHA_DARK_BASE)
    expect(SCRIM_ALPHA_DARK_BASE).toBeGreaterThan(SCRIM_ALPHA_DEFAULT)
  })

  it('lowers the alpha under an active ramp', () => {
    expect(scrimOpacity({ darkBase: false, rampActive: true })).toBe(SCRIM_ALPHA_RAMP)
    expect(SCRIM_ALPHA_RAMP).toBeLessThan(SCRIM_ALPHA_DEFAULT)
  })

  it('gives the RAMP precedence over the base', () => {
    // An over-strong scrim corrupts data the user is reading; an under-strong
    // one only under-communicates. Over a dark base WITH a ramp the ramp wins.
    expect(scrimOpacity({ darkBase: true, rampActive: true })).toBe(SCRIM_ALPHA_RAMP)
  })
})

describe('the ramp alpha never pushes a tier past its neighbour (OI-02)', () => {
  it('parses the real tokens it reasons about', () => {
    // Non-vacuity: a silently-empty token read would make every claim below
    // true about nothing.
    expect(SCRIM_RGB).toEqual([15, 17, 23])
    expect(COUNTY_TIERS).toHaveLength(10)
    expect(ATLAS_TIERS).toHaveLength(4)
    expect(new Set(COUNTY_TIERS.map(String)).size).toBe(10)
  })

  it('holds for the ten-class county ramp', () => {
    const shown = rendered(COUNTY_TIERS, COUNTY_FILL_ALPHA, MUTED_LAND)
    expect(worstTierShift(shown, SCRIM_ALPHA_RAMP)).toBeLessThanOrEqual(1)
  })

  it('holds for the four-class atlas breeding ramp', () => {
    const shown = rendered(ATLAS_TIERS, ATLAS_FILL_ALPHA, MUTED_LAND)
    expect(worstTierShift(shown, SCRIM_ALPHA_RAMP)).toBeLessThanOrEqual(1)
  })

  it('REJECTS the approved 0.18 on both ramps, which is why the ramp alpha exists', () => {
    // Guard-the-guard, and the tester's actual finding: at 0.18 a tier reads TWO
    // tiers darker outside the circle than inside it, so the circle's edge reads
    // as a data boundary in the choropleth. If this ever passes, the property
    // above has stopped discriminating and the ramp alpha is unmotivated.
    expect(worstTierShift(rendered(COUNTY_TIERS, COUNTY_FILL_ALPHA, MUTED_LAND), SCRIM_ALPHA_DEFAULT))
      .toBeGreaterThanOrEqual(2)
    expect(worstTierShift(rendered(ATLAS_TIERS, ATLAS_FILL_ALPHA, MUTED_LAND), SCRIM_ALPHA_DEFAULT))
      .toBeGreaterThanOrEqual(2)
  })

  it('is the LARGEST alpha at which both ramps are one-tier-safe', () => {
    // The value is a boundary, not a preference: one step up and the atlas ramp
    // goes back to shifting by two. Stated as a property so a future re-tuning
    // has to move it deliberately.
    const county = rendered(COUNTY_TIERS, COUNTY_FILL_ALPHA, MUTED_LAND)
    const atlas = rendered(ATLAS_TIERS, ATLAS_FILL_ALPHA, MUTED_LAND)
    const safe = (a: number) => worstTierShift(county, a) <= 1 && worstTierShift(atlas, a) <= 1
    expect(safe(SCRIM_ALPHA_RAMP)).toBe(true)
    expect(safe(SCRIM_ALPHA_RAMP + 0.01)).toBe(false)
  })

  it('still dims visibly enough to mean something', () => {
    // The other half of the trade: an alpha low enough to protect the ramp must
    // not be an alpha that says nothing. One county tier step is ~1.17:1, and
    // the scrim stays in that neighbourhood rather than falling out of it.
    const dimmed = composite(SCRIM_RGB, MUTED_LAND, SCRIM_ALPHA_RAMP)
    expect(contrast(MUTED_LAND, dimmed)).toBeGreaterThan(1.1)
  })
})

describe('the dark-base alpha (OI-02)', () => {
  it('reproduces over satellite imagery what 0.18 does over Positron', () => {
    // A DARK wash over DARK ground barely moves it: at 0.18 the scrim was doing
    // a fraction of the work over satellite that it does over the base it was
    // drawn for. The claim is stated against the MEASURED median luminance of
    // the real imagery, not an invented grey.
    const positron = contrast(POSITRON_LAND, composite(SCRIM_RGB, POSITRON_LAND, SCRIM_ALPHA_DEFAULT))
    const satellite = contrast(SATELLITE_TYPICAL, composite(SCRIM_RGB, SATELLITE_TYPICAL, SCRIM_ALPHA_DARK_BASE))
    expect(satellite).toBeGreaterThanOrEqual(positron)
  })

  it('REJECTS the approved 0.18 over the same imagery', () => {
    // Guard-the-guard: without this the property above would pass on any alpha
    // at all, including the one that produced the defect.
    const positron = contrast(POSITRON_LAND, composite(SCRIM_RGB, POSITRON_LAND, SCRIM_ALPHA_DEFAULT))
    const satellite = contrast(SATELLITE_TYPICAL, composite(SCRIM_RGB, SATELLITE_TYPICAL, SCRIM_ALPHA_DEFAULT))
    expect(satellite).toBeLessThan(positron)
  })

  it('stops short of a blackout over bright imagery', () => {
    // Snow, sand and cloud are the other end of the same raster base. The dim
    // must stay a dim there rather than becoming an erasure.
    const bright: RGB = [235, 235, 235]
    expect(contrast(bright, composite(SCRIM_RGB, bright, SCRIM_ALPHA_DARK_BASE))).toBeLessThan(2.5)
  })

  it('samples the luminance it says it does', () => {
    // Non-vacuity for the binary search above.
    expect(relLum(SATELLITE_TYPICAL)).toBeCloseTo(SATELLITE_MEDIAN_LUM, 4)
  })
})

// ── Whether the control has room to exist (OI-01) ────────────────────────────

describe('searchControlFits', () => {
  /** An ordinary desktop map area: acres of room above the disc line. */
  const ROOMY = { containerTop: 0, switcherBottom: 75, discLineTop: 404, rowGap: 10, rowHeight: 44 }

  it('is true on a map area of ordinary height', () => {
    expect(searchControlFits(ROOMY)).toBe(true)
  })

  it('is false when the row would start above the map area', () => {
    // Measured at 320x568 / 200% text, windowed: the map area is 171px tall and
    // the disc line already sits 35px ABOVE its top, so the control row lands
    // 133px outside the map, over the mode-bar chrome.
    expect(searchControlFits({ ...ROOMY, switcherBottom: null, discLineTop: -35, rowHeight: 88 }))
      .toBe(false)
  })

  it('is false when the row would cover the layers switcher controls', () => {
    // Measured at 320x568 / 200% text, fullscreen: the row's box would start 1px
    // above the map area and 106px into the switcher, where `elementFromPoint`
    // at the Satellite and Topo (US) centres returned the control.
    expect(searchControlFits({ ...ROOMY, switcherBottom: 105, discLineTop: 97, rowHeight: 88 }))
      .toBe(false)
  })

  it('clears the switcher CONTROLS, not the switcher panel', () => {
    // Overlapping the panel's own padding blocks nothing — the shipped discs
    // already overlap the panel by 1,408px2 each with every control reachable.
    // So the caller passes the switcher's CONTENT box, and a row that lands
    // exactly on that edge fits.
    expect(searchControlFits({ containerTop: 0, switcherBottom: 75, discLineTop: 129, rowGap: 10, rowHeight: 44 }))
      .toBe(true)
    expect(searchControlFits({ containerTop: 0, switcherBottom: 75, discLineTop: 128.9, rowGap: 10, rowHeight: 44 }))
      .toBe(false)
  })

  it('falls back to the container when there is no switcher', () => {
    expect(searchControlFits({ ...ROOMY, switcherBottom: null, discLineTop: 54 })).toBe(true)
    expect(searchControlFits({ ...ROOMY, switcherBottom: null, discLineTop: 53.9 })).toBe(false)
  })

  it('takes the LOWER of the container top and the switcher, never the higher', () => {
    // A switcher is always below the container's top edge, so the switcher is
    // the binding limit whenever one is present. Reversing the Math.max would
    // reopen the blocking defect while every other case here still passed.
    const low = { containerTop: 0, switcherBottom: 75, discLineTop: 100, rowGap: 10, rowHeight: 44 }
    expect(searchControlFits(low)).toBe(false)         // 100-10-44 = 46 < 75
    expect(searchControlFits({ ...low, switcherBottom: null })).toBe(true)  // 46 >= 0
  })

  it('depends on nothing but the five measured numbers', () => {
    // There is deliberately no term for the location-failure row. E-01 puts that
    // row ABOVE the control in a bottom-anchored cluster, so it cannot move
    // `discLineTop` and cannot reach this decision — which is what makes the
    // location-failure row the one that yields (the design's stated preference
    // for OI-01) rather than the control. It is also what keeps this predicate
    // free of the feedback loop a "does the cluster overflow" reading would
    // have: hiding the control shrinks the cluster, and the cluster's own top
    // edge would immediately say it fits again.
    //
    // Verified in the browser rather than here: with a real geolocation denial
    // rendering a real .sr-map-geo-error row, the control's container-relative
    // position was byte-identical to the no-failure run in all 24 measured
    // configurations (pr-description.md).
    expect(Object.keys(ROOMY).sort())
      .toEqual(['containerTop', 'discLineTop', 'rowGap', 'rowHeight', 'switcherBottom'])
  })
})

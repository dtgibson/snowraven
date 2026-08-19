// "Search this area" — the pure derivation behind the Map Explorer's one-press
// re-search (feature: search-this-area).
//
// Everything here is a pure function of its arguments: no React, no map
// instance, no clock, no I/O. That is what makes NFR-10 / QA-39 structural
// rather than a matter of discipline — every rule below can be exercised
// directly, with a bounds tuple and nothing else.
//
// The shape of the problem: the two eBird endpoints behind these views take a
// POINT and a RADIUS, and the user is looking at a RECTANGLE. So a press has to
// turn "what is on screen" into a circle, and the honest direction to round is
// OUTWARD — the circle CIRCUMSCRIBES the viewport rather than fitting inside it,
// so everything the user can see is inside the answer and a little ground beyond
// the edges comes along with it.
//
// Two consequences run through everything below:
//
//   The covering radius is measured CENTRE-TO-CORNER, so the shape of the
//   viewport matters and not just its width. A wide desktop map and a tall phone
//   one reach any given radius at different widths.
//
//   The covering radius is snapped UP to a rung of the sidebar's own ladder and
//   capped at DERIVED_MAX_MI, so a press can only ever send a value the sidebar
//   could also have sent. Past the cap the circle deliberately UNDER-covers the
//   viewport, which is the one case where "everything on screen was searched"
//   stops being true — and it is exactly the case FR-17's drawn indicator exists
//   to make visible rather than to paper over.

import { unpadBounds, type MarkerBounds } from './markersInView'
import { distanceMiles } from './mapExplorerFormat'
import type { Feature, Polygon } from 'geojson'

// ── Types ────────────────────────────────────────────────────────────────────

/**
 * A viewport midpoint on its own. Not what a press sends — that is `DerivedArea`
 * below — but the intermediate every covering computation is measured FROM, so
 * it is worth its own name rather than an inline `{ lat, lng }`.
 */
export interface SearchCenter {
  /** Midpoint latitude, rounded to 5 dp. */
  lat: number
  /** Midpoint longitude, rounded to 5 dp and normalized into [-180, 180]. */
  lng: number
}

/**
 * FR-07 / FR-08 / FR-09 — everything a press DERIVES from the viewport, which
 * is everything it sends.
 */
export interface DerivedArea {
  /** Midpoint latitude, rounded to 5 dp. */
  lat: number
  /** Midpoint longitude, rounded to 5 dp and normalized into [-180, 180]. */
  lng: number
  /**
   * The rung the covering radius snapped up to, in miles. Always a member of
   * `RUNGS` at or below `DERIVED_MAX_MI`, so the request can only ever carry a
   * `dist` the sidebar could also have sent (FR-09). Note that it is not itself
   * written into the sidebar's Radius control: a press leaves that setting alone.
   */
  radiusMi: number
  /**
   * True when the viewport wanted MORE than `DERIVED_MAX_MI` and the ladder was
   * narrowed to fit — i.e. the circle does not cover the screen.
   *
   * FR-09 / QA-19. This drives NO COPY, deliberately (see the design spec's
   * Content Notes: a capped search announces the ordinary sentence for its
   * view). The capped case is carried entirely by geometry, because the circle
   * is drawn visibly smaller than the viewport and the scrim greys the ground
   * outside it. The flag exists so a test can assert the cap fired without
   * reaching for a sentence that does not exist.
   */
  capped: boolean
}

/**
 * FR-12 — exactly the three values that were SENT. Nothing else.
 *
 * It doubles as the description of a press that has not happened yet: the
 * component composes the derived centre with the live radius to get the record
 * a press WOULD write, and `shouldOfferSearchArea` compares that against the
 * record already there. One shape for "what we searched" and "what we would
 * search" is what keeps the offer predicate honest — it compares the whole
 * payload rather than a proxy for part of it.
 */
export interface SearchRecord {
  lat: number
  lng: number
  radiusMi: number
}

// ── Constants ────────────────────────────────────────────────────────────────

/**
 * The existing radius options, ascending — and the SINGLE source of truth for
 * them. MapExplorer's `RadiusControl` derives its four SegControl options from
 * this array rather than holding a second copy of the same ladder.
 *
 * Extracted precisely because `snapRadiusMi` snaps ONTO this ladder: two copies
 * of it in two files would let what the derivation snaps to drift away from what
 * the control offers, and FR-09's promise is that a press sends only a distance
 * the user could have picked from that control themselves.
 */
export const RUNGS: readonly number[] = [5, 10, 25, 50]

/**
 * FR-09 / OQ-01. The largest radius a PRESS may derive, in miles. The sidebar
 * still offers all four rungs; this caps only the derived path.
 *
 * 25 mi is 40 km. The app converts miles to kilometres, so the shipped 50 mi
 * rung sends `dist=80` while eBird documents 50 km as the maximum for
 * `ref/hotspot/geo` and `data/obs/geo/recent`, and nothing in this repo clamps
 * it. Whether eBird clamps, errors, or silently truncates above that is not
 * established (OQ-01, open). Capping the DERIVED path at 40 km keeps this
 * feature comfortably inside the documented ceiling.
 *
 * The reason is honesty rather than exposure: FR-17 draws a circle CLAIMING
 * coverage, and a radius the provider might silently truncate is a claim this
 * feature cannot vouch for. A user who picks 50 mi in the sidebar is making
 * their own request, unchanged by this feature; a user who presses this control
 * is being handed a number they never chose, so it has to be one that holds.
 *
 * CONDITIONS FOR LIFTING IT: measure eBird's actual behaviour above 50 km. If it
 * honours the request, this becomes 50 and the derived path gains the top rung;
 * if it clamps, the app-wide 50 mi rung is the thing to revisit, not this
 * constant. Either way it is a one-constant change.
 */
export const DERIVED_MAX_MI = 25

/**
 * FR-13 / OQ-02. How far the centre must move before the control is offered
 * again, as a fraction of the SEARCHED radius: 1.25 mi after a 5 mi search,
 * 6.25 mi after a 25 mi one.
 *
 * Scaled rather than absolute, deliberately: a fixed 2.5 mi threshold would be
 * half of a 5 mile search and a rounding error in a 25 mile one. The same pan
 * cannot mean the same thing at both ends.
 *
 * Scaled by the RECORDED radius rather than the derived one, because the
 * recorded radius is the size of the thing being escaped. The two only differ
 * when the radius itself changed, and in that case `hasMovedFrom` has already
 * answered true on its first term and never reaches this comparison.
 */
export const MOVE_THRESHOLD_FRAC = 0.25

/** Vertices in the indicator ring. 96 keeps the chord error under ~0.06% of r. */
export const AREA_CIRCLE_STEPS = 96

/** Mean earth radius in miles — the same value `distanceMiles` uses, so the ring
 *  drawn on the map and the distances compared here agree. */
const EARTH_RADIUS_MI = 3958.8

const DEG = Math.PI / 180

// ── Primitives ───────────────────────────────────────────────────────────────

/**
 * Round to 5 decimal places THROUGH `toFixed`, not through `Math.round(n * 1e5) / 1e5`.
 *
 * Load-bearing, not a style preference. The component writes the coordinate
 * field with `center.lat.toFixed(5)` (the format `applyCenter` already uses) and
 * sends `center.lat` as a number. Defining the rounding through `toFixed` makes
 * `.toFixed(5)` idempotent on an already-rounded value, so the string in the
 * field, the number in the request and the number in the record are provably the
 * same value rather than three values that agree to within a rounding error.
 * That is FR-10's centre adoption at the arithmetic level: the coordinate boxes
 * show the very number that was sent and recorded, not a near neighbour of it.
 */
export function round5(n: number): number {
  return Number(n.toFixed(5))
}

/** Fold a longitude into [-180, 180], so a viewport straddling the antimeridian
 *  cannot produce a value `/map/recent-obs` rejects (`lng: ge=-180, le=180`). */
export function normalizeLng(lng: number): number {
  return ((((lng + 180) % 360) + 360) % 360) - 180
}

// ── Derivation ───────────────────────────────────────────────────────────────

/**
 * FR-07. The arithmetic midpoint of UNPADDED bounds, rounded to 5 dp, with the
 * longitude normalized into [-180, 180].
 *
 * The trailing `round5` after `normalizeLng` is not a second rounding decision:
 * the modulo arithmetic can reintroduce float noise below the 5th decimal, and
 * `round5` is idempotent on a value that is already at 5 dp, so this simply
 * keeps the "toFixed(5) is idempotent" guarantee above true on both branches.
 */
export function areaCenter(unpadded: MarkerBounds): SearchCenter {
  const [minLng, minLat, maxLng, maxLat] = unpadded
  return {
    lat: round5((minLat + maxLat) / 2),
    lng: round5(normalizeLng(round5((minLng + maxLng) / 2))),
  }
}

/**
 * The maximum great-circle distance in miles from `center` to the four corners
 * of `unpadded` — "how big a circle at `center` would have to be to hold
 * everything on screen".
 *
 * FR-08. This is what makes the circle COVER the viewport rather than fit inside
 * it: taking the MAXIMUM over the corners (not the minimum, and not the distance
 * to an edge midpoint) is exactly the statement "every point on screen is within
 * this distance of the centre", because on a lat/lng rectangle the farthest
 * point from the midpoint is always a corner.
 *
 * It has two callers pulling in opposite directions, which is why it is its own
 * function: `deriveSearchArea` asks it how big a circle a press must send, and
 * `viewportCoveredBy` asks the converse question of an ALREADY-SEARCHED circle.
 * One implementation means the radius a press sends and the coverage test that
 * later withdraws the offer can never disagree about what "covered" means.
 *
 * THE CORNERS ARE DELIBERATELY LEFT UN-NORMALIZED, and this must not be
 * "fixed". A viewport straddling ±180 has a midpoint that normalizes (180 ->
 * -180) while its corners are still 179 and 181. That is safe, because
 * haversine's `sin²(Δλ/2)` term has period 360° in Δλ: a corner 361° "away"
 * scores exactly the same as one 1° away. Normalizing every corner would buy
 * nothing, and computing a signed longitude delta instead is what would actually
 * break. `searchArea.test.ts` carries a fixture proving the straddling radius
 * equals the equivalent non-straddling one.
 */
export function coveringRadiusMi(
  unpadded: MarkerBounds,
  center: SearchCenter,
): number {
  const [minLng, minLat, maxLng, maxLat] = unpadded
  const corners: [number, number][] = [
    [minLng, minLat], [maxLng, minLat], [maxLng, maxLat], [minLng, maxLat],
  ]
  let max = 0
  for (const [lng, lat] of corners) {
    const d = distanceMiles(center.lat, center.lng, lat, lng)
    if (d > max) max = d
  }
  return max
}

/**
 * FR-08 / FR-09. The smallest rung that HOLDS `rCover`, and whether the cap bit.
 *
 * THE CAP IS APPLIED BY NARROWING THE LADDER, NOT BY CLAMPING THE ANSWER, and
 * that distinction is the whole point of this function. Snapping first and then
 * clamping (`Math.min(snapped, DERIVED_MAX_MI)`) would give the identical number
 * for today's `RUNGS` and `DERIVED_MAX_MI`, and would silently start returning a
 * NON-RUNG the moment either changed. That matters because of FR-09: the promise
 * is that a press can only ever send a distance the user could have picked from
 * the sidebar themselves, which is what makes the derived radius explicable even
 * though it is never shown in the Radius control. A clamped non-rung would be a
 * size with no name. Filtering the ladder first makes "the result is always a
 * rung" true by construction rather than by coincidence, at every value of both
 * constants.
 *
 * The security consequence is worth stating where the code is: the derived path
 * can therefore only ever send `dist` ∈ {8, 16, 40} km. No viewport, however
 * large or however malformed, can push a value past the cap into the request.
 */
export function snapRadiusMi(rCover: number): { radiusMi: number; capped: boolean } {
  const ladder = RUNGS.filter(r => r <= DERIVED_MAX_MI)
  const top = ladder[ladder.length - 1]
  const fits = ladder.find(r => r >= rCover)
  return fits !== undefined
    ? { radiusMi: fits, capped: false }
    : { radiusMi: top, capped: true }
}

/**
 * FR-07 / FR-08 / FR-09, and the ONE function the component calls to read the
 * map.
 *
 * It takes the PADDED bounds `BoundsTracker` reports and unpads internally, so
 * FR-06's "one reading, one unpad" is structural rather than remembered — there
 * is no way to hand this the wrong bounds and no second reading of
 * `map.getBounds()` anywhere in the feature.
 *
 * THE CENTRE IS ROUNDED BEFORE THE COVERING RADIUS IS MEASURED FROM IT, and the
 * order is load-bearing. `round5` moves the centre by up to ~0.6 m, so a radius
 * measured from the UNROUNDED midpoint and then paired with the ROUNDED one
 * describes a circle nobody computed: the corner that set the maximum can end up
 * a hair outside the circle that actually gets sent. Measuring from the value
 * that is sent makes "every corner is within `radiusMi` of (`lat`, `lng`)" an
 * exact statement about the request rather than one that holds to within a
 * rounding error. The snap up the ladder swallows the difference in practice,
 * which is precisely why getting this backwards would never show up on screen —
 * so it is stated here rather than left to be rediscovered.
 *
 * `null` in (no map load yet) -> `null` out.
 */
export function deriveSearchArea(padded: MarkerBounds | null): DerivedArea | null {
  if (!padded) return null
  const unpadded = unpadBounds(padded)
  const center = areaCenter(unpadded)
  const rCover = coveringRadiusMi(unpadded, center)
  const { radiusMi, capped } = snapRadiusMi(rCover)
  return { lat: center.lat, lng: center.lng, radiusMi, capped }
}

/**
 * FR-13, first conjunct. Would a press SEND something different from what the
 * record holds?
 *
 * Two terms, because there are two ways the payload can differ and they are not
 * the same question:
 *
 *   THE RADIUS CHANGED. Any difference at all counts, with no tolerance. The
 *   derived radius is a rung, so it changes only in whole steps, and a step is
 *   never noise: 5 -> 10 doubles the ground a press would cover. This is the
 *   term that makes ZOOMING work. The centre can sit still through a zoom while
 *   the covering radius crosses a rung boundary, and that press really would
 *   fetch something the last one did not.
 *
 *   THE CENTRE MOVED far enough to matter, judged against `MOVE_THRESHOLD_FRAC`
 *   times the RECORDED radius. This is the term that stops a metre of drift, a
 *   trackpad nudge or a hand resting on a phone from re-offering the control on
 *   a map the user considers stationary.
 *
 * The radius test is an equality rather than an inequality ON PURPOSE. "Is it
 * bigger" would be the right question if a narrower circle could never be worth
 * fetching, but the derived radius is not a user preference the press inherits —
 * it is a fresh reading of the viewport, and a SMALLER one means the user zoomed
 * IN, where the record's wider circle was fetched around a centre that has since
 * moved. Whether that narrower search is worth offering is settled by the second
 * conjunct of `shouldOfferSearchArea`, which withdraws the offer whenever the
 * screen really is already covered. Deciding it here as well would be the same
 * judgement made twice, in two places, on less information.
 *
 * No record means nothing has been searched on this view, so anything is new.
 */
export function hasMovedFrom(next: SearchRecord, record: SearchRecord | null): boolean {
  if (!record) return true
  if (next.radiusMi !== record.radiusMi) return true
  const d = distanceMiles(next.lat, next.lng, record.lat, record.lng)
  return d > record.radiusMi * MOVE_THRESHOLD_FRAC
}

/**
 * "Is everything on screen already inside the area we searched?" — every corner
 * of the live viewport within the RECORDED radius of the RECORDED centre.
 *
 * Asked against the RECORD, never the live midpoint, so it answers whether the
 * coverage the last search bought still holds over what is on screen now.
 * Reusing `coveringRadiusMi` rather than re-deriving a corner loop is what keeps
 * the two in agreement, and it inherits that function's un-normalized-corners
 * note verbatim (haversine is 360°-periodic in Δλ, so a straddling viewport
 * needs no special case).
 *
 * Known limit: the four corners stand in for the whole rectangle. For a lat/lng
 * rectangle of any size a real viewport takes, the farthest point from a centre
 * is a corner; a rectangle spanning a pathological longitude range near a pole
 * is not handled.
 */
export function viewportCoveredBy(
  record: SearchRecord | null,
  padded: MarkerBounds | null,
): boolean {
  if (!record || !padded) return false
  const unpadded = unpadBounds(padded)
  return coveringRadiusMi(unpadded, { lat: record.lat, lng: record.lng }) <= record.radiusMi
}

/**
 * FR-13, as shipped: whether the control should be offered at all.
 *
 * `next` is the record a press WOULD write — the derived centre carrying the
 * derived radius. Comparing whole payloads is what makes this the real question
 * rather than a proxy for it.
 *
 * WHY THIS IS NOT JUST `hasMovedFrom`. That asks "would a press send something
 * different". The user's question is narrower: "is there anything ON SCREEN I
 * have not searched yet". The two come apart when the user ZOOMS IN after a
 * search: the covering radius drops a rung, so `hasMovedFrom` answers true on
 * its radius term, but the smaller circle a press would send is entirely inside
 * the one already fetched and every pin on screen is already there. Offering
 * would spend a lookup to be told strictly less. So the offer is CONJOINED with
 * "and the viewport is not already covered". Being a conjunction it can only
 * ever withdraw an offer; it can never create one, which is why FR-05's "no
 * search without an explicit press" and the no-record case below are untouched.
 *
 * `hasMovedFrom` BEING A CONJUNCT AT ALL is what keeps the CAPPED case correct.
 * Past `DERIVED_MAX_MI` the circle is deliberately SMALLER than the viewport, so
 * `viewportCoveredBy` is false and stays false however long the map sits still —
 * the coverage test ALONE would offer the control permanently, on a map nobody
 * has moved, and every press would send the identical centre and the identical
 * capped radius and get back the identical answer. `hasMovedFrom` answers false
 * there and withholds it. The capped-and-unmoved test below is that property's
 * tripwire.
 *
 * Their ORDER is NOT load-bearing, and nothing should be built on it. Both are
 * pure and total, so `A && B` and `B && A` agree on every input; the only thing
 * order decides is which one short-circuiting skips, and neither can throw or
 * mutate. What IS load-bearing is that both are PRESENT, which is the paragraph
 * above and the one before it.
 *
 * The record and the viewport are compared in the ORIGINAL viewport's own terms:
 * `next.lat`/`next.lng` are derived from `padded`, so both arguments describe one
 * reading of the bounds (FR-06's "one reading, one unpad" holds through both
 * branches).
 */
export function shouldOfferSearchArea(
  next: SearchRecord | null,
  record: SearchRecord | null,
  padded: MarkerBounds | null,
): boolean {
  if (!next) return false
  if (!record) return true
  return hasMovedFrom(next, record) && !viewportCoveredBy(record, padded)
}

// ── Indicator geometry ───────────────────────────────────────────────────────

/** One point `radiusMi` from (lat, lng) along `bearingRad`, on a sphere of
 *  radius EARTH_RADIUS_MI. Longitudes come back CONTINUOUS with the centre —
 *  see the note on `areaCirclePolygon`. */
function destination(
  lat: number, lng: number, radiusMi: number, bearingRad: number,
): [number, number] {
  const d = radiusMi / EARTH_RADIUS_MI
  const lat1 = lat * DEG
  const lng1 = lng * DEG
  const sinLat1 = Math.sin(lat1)
  const cosLat1 = Math.cos(lat1)
  const sinD = Math.sin(d)
  const cosD = Math.cos(d)
  const lat2 = Math.asin(sinLat1 * cosD + cosLat1 * sinD * Math.cos(bearingRad))
  const lng2 = lng1 + Math.atan2(
    Math.sin(bearingRad) * sinD * cosLat1,
    cosD - sinLat1 * Math.sin(lat2),
  )
  return [lng2 / DEG, lat2 / DEG]
}

/**
 * FR-17. A closed geodesic ring for the searched area, as a GeoJSON Feature.
 *
 * `steps` distinct vertices plus a repeat of the first, so the ring closes
 * EXACTLY (walking a bearing of 2π and trusting it to land on 0 leaves a
 * sub-nanometre gap, which is the kind of thing that shows up as a hairline
 * seam at high zoom).
 *
 * THE VERTEX LONGITUDES ARE NOT NORMALIZED INTO [-180, 180], deliberately.
 * `atan2` returns an offset in [-π, π] which is ADDED to the centre's longitude,
 * so every vertex comes out continuous with the centre. Normalizing per-vertex
 * is precisely what tears a ring crossing the antimeridian into a band smeared
 * across the whole map. MapLibre renders a continuous ring correctly. Stated as
 * a known limit rather than hidden: a search centred within `radiusMi` of ±180
 * draws a ring whose vertices run past ±180, which is cosmetically correct in
 * MapLibre and is not otherwise handled.
 */
export function areaCirclePolygon(
  record: SearchRecord,
  steps: number = AREA_CIRCLE_STEPS,
): Feature<Polygon> {
  const ring: [number, number][] = []
  for (let i = 0; i < steps; i += 1) {
    ring.push(destination(record.lat, record.lng, record.radiusMi, (2 * Math.PI * i) / steps))
  }
  ring.push(ring[0])
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'Polygon', coordinates: [ring] },
  }
}

/**
 * The scrim geometry: ONE Polygon with TWO rings — a world-covering outer
 * rectangle and the searched circle as a hole — so the dim over unsearched
 * ground needs no mask and no second source.
 *
 * The outer ring is built RELATIVE TO THE RECORD CENTRE in longitude
 * (`lng ± 180`) for the same reason the circle's vertices are not normalized:
 * a fixed [-180, 180] rectangle beside an antimeridian-continuous hole would
 * put the hole outside its own outer ring. The latitude band is the full valid
 * range rather than `lat ± 89.9`, which would run past the pole for any real
 * search centre; the `Math.min`/`Math.max` keep the hole strictly interior even
 * for a centre pathologically close to a pole.
 */
export function areaScrimPolygon(
  record: SearchRecord,
  steps: number = AREA_CIRCLE_STEPS,
): Feature<Polygon> {
  const hole = areaCirclePolygon(record, steps).geometry.coordinates[0]
  const west = record.lng - 180
  const east = record.lng + 180
  const south = Math.min(-89.9, record.lat - 1)
  const north = Math.max(89.9, record.lat + 1)
  // Counter-clockwise outer ring; the circle ring runs clockwise (bearing
  // increases eastward from north), which is the correct winding for a hole.
  const outer: [number, number][] = [
    [west, south], [east, south], [east, north], [west, north], [west, south],
  ]
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'Polygon', coordinates: [outer, hole] },
  }
}

// ── The scrim's alpha (OI-02, settled by measurement) ────────────────────────
//
// D-03's 18% scrim was designed and measured over the light Positron basemap.
// Two of the six configurations OI-02 asked about eat it from opposite ends,
// and both were measured in Chromium over the real tiles and against the
// shipped tokens rather than reasoned about:
//
//   SATELLITE — the raster base is dark, so a DARK wash barely moves it. At
//   0.18 over the real Esri imagery the median rendered contrast between
//   searched and unsearched ground is 1.2828 (median dL 0.0444) against 1.4483
//   (dL 0.2194) over Positron. The scrim is doing roughly a third of the work
//   it does over the base it was drawn for, and the tester's darker sample put
//   it near a twentieth. Topo is a raster base too and needs NOTHING: it is a
//   LIGHT map and measured 1.4308 at 0.18, within 1.2% of Positron. So the
//   discriminator is a DARK base, not a raster one.
//
//   AN ACTIVE COUNTY OR ATLAS SHADING RAMP — the opposite problem, and the one
//   that is a correctness bug rather than a legibility one. The ramps encode
//   data in LIGHTNESS and the scrim is a lightness wash, so they are competing
//   for the same channel. At 0.18 the scrim moves a county tier by 1.4596:1
//   while the step between ADJACENT tiers is only ~1.17:1, so the same tier
//   reads TWO TIERS DARKER outside the circle than inside it and the circle's
//   edge reads as a data boundary in the choropleth.
//
// The design's sanctioned remedy is a basemap-conditional ALPHA, never a change
// to the token's colour (the token is audited and shared with --sr-share-pin).
// This extends that to the ramps, because the ramp is where the real harm is.
//
// Precedence is RAMP over BASE, deliberately: an over-strong scrim corrupts data
// the user is reading, an under-strong one only under-communicates. Over a dark
// base WITH a ramp the scrim will be close to imperceptible; that is the
// accepted cost of not lying about the choropleth.

/** The approved value (D-03). Light vector/raster base, no ramp. */
export const SCRIM_ALPHA_DEFAULT = 0.18

/**
 * Over a dark raster base. Measured over the real Esri imagery: 0.30 gives a
 * median contrast of 1.5227 (dL 0.0692) against Positron's 1.4483 at 0.18, so
 * the wash does the same job it was drawn to do. Deliberately not higher — over
 * bright imagery (snow, sand, cloud) the same alpha reaches ~1.9:1, and past
 * that a "dim" becomes a blackout.
 */
export const SCRIM_ALPHA_DARK_BASE = 0.30

/**
 * Over an active shading ramp. The highest alpha at which the scrim moves NO
 * tier of EITHER ramp past its own neighbour: at 0.12 the county ramp is
 * one-tier-safe but the atlas ramp still shifts by two, and 0.08 is the value
 * that holds for both. A one-tier shift is the irreducible floor — any wash
 * visible at all is about the size of one step on a ten-class single-hue ramp —
 * so the guarantee is "never past the neighbour", not "no shift".
 * Asserted against the parsed tokens in searchArea.test.ts.
 *
 * THIS VALUE IS ONLY LOAD-BEARING BECAUSE THE INDICATOR PAINTS ABOVE THE RAMP.
 * The model above — and the unit test that pins this constant — composites the
 * scrim OVER the rendered tier. At the layer order that first shipped, the scrim
 * went UNDER the county fill (`fill-opacity` 0.85) and the atlas fill (0.45),
 * where it is 85% / 55% blocked. Measured in Chromium over the real basemap, as a
 * build A/B: under the fills, 0.08 moved a shaded county tier by 1.027 to 1.037:1
 * and even 0.18 only reached 1.058 to 1.128:1, against a rendered adjacent-tier
 * step of 1.1425:1 — so NEITHER alpha could shift a tier there, and the backoff
 * was buying nothing while all but erasing the dim. `SearchedAreaLayer` now keeps
 * the group above both fills, which is the order this constant was chosen for;
 * the full table and the reasoning are on the effect that enforces it.
 */
export const SCRIM_ALPHA_RAMP = 0.08

/** What the scrim is being drawn over. Both flags are live map state. */
export interface ScrimContext {
  /** A dark raster base is showing (satellite). Topo is light and is not one. */
  darkBase: boolean
  /** A county or atlas shading ramp is painting tiers under the scrim. */
  rampActive: boolean
}

/**
 * The scrim's `fill-opacity` for what it is currently drawn over. Pure, total,
 * and the single source of the three constants above.
 */
export function scrimOpacity({ darkBase, rampActive }: ScrimContext): number {
  if (rampActive) return SCRIM_ALPHA_RAMP
  if (darkBase) return SCRIM_ALPHA_DARK_BASE
  return SCRIM_ALPHA_DEFAULT
}

// ── Whether the control has room to exist (OI-01, settled by measurement) ────
//
// D-02 placed the control as a full-width row in the bottom FAB cluster and
// claimed zero overlap with the top-right layers switcher at every scale. That
// claim holds on a map area of ordinary height and fails on a short one, and
// the failure is not cosmetic: measured in Chromium at 320x568, the control's
// box covered the Satellite and Topo (US) controls so `elementFromPoint` at
// their centres returned the control (5,943px2 at 150% text, 19,167px2 at 200%
// fullscreen), and at 200% windowed the whole control sat 133px ABOVE the map
// area, over the mode-bar chrome.
//
// The arithmetic is forced. The cluster is bottom-anchored and grows UPWARD, so
// on a 320x568 phone at 200% text the map area is 171px tall while the SHIPPED
// cluster alone already needs 196px — it overflows its container by 45px before
// this feature adds anything. There is no arrangement of an 88px row that fits
// in a space that is already negative, and shortening the location-failure row
// (the design's stated preference for OI-01) cannot help, because the control
// row alone does not fit either.
//
// So the control YIELDS when it has no room, which is the app's own established
// answer to "this does not fit" (TabNav collapses the tab strip to a dropdown
// by measuring rather than at a fixed breakpoint). A control drawn outside the
// map, or one that makes another control unusable, is worse than one that is
// not offered; the shipped route through the Filters panel is untouched.
//
// Note what is NOT in this predicate: the location-failure row. It sits ABOVE
// the control in a bottom-anchored cluster (E-01), so it cannot move the
// control at all — it grows past the top of the map area on its own, exactly
// the pre-existing behaviour, and exactly the yielding the design asked for.

/** Everything the fit question depends on, in one measured tuple (px). */
export interface SearchControlFitMetrics {
  /** Top of the map area's CONTENT box. */
  containerTop: number
  /**
   * Bottom of the layers switcher's CONTENT box — its controls' extent, not the
   * panel's border box. Overlapping the panel's 7px padding blocks nothing (the
   * shipped discs already overlap the panel by 1,408px2 each and every control
   * stays reachable); overlapping the controls is what makes it inoperable.
   * `null` when no switcher is present.
   */
  switcherBottom: number | null
  /**
   * Top of the shipped disc line. INVARIANT to whether this control or a
   * location-failure message is rendered, because the cluster is bottom
   * anchored — which is what makes this predicate free of the feedback loop a
   * "does the cluster overflow" measurement would have.
   */
  discLineTop: number
  /** The cluster's own computed `row-gap`, read from the stylesheet. */
  rowGap: number
  /** The control row's natural height. */
  rowHeight: number
}

/**
 * True when the control row fits between the shipped discs and whichever of the
 * map area's top edge or the layers switcher's controls comes lower down.
 */
export function searchControlFits({
  containerTop, switcherBottom, discLineTop, rowGap, rowHeight,
}: SearchControlFitMetrics): boolean {
  const limit = Math.max(containerTop, switcherBottom ?? containerTop)
  return discLineTop - rowGap - rowHeight >= limit
}

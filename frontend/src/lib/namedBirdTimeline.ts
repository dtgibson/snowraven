// Geometry for the Named Birds sighting timelines. Pure: no React, no I/O, no
// clock read, so every decision here is unit-testable without rendering and the
// NFR-04 budget has a function to time.
//
// ENTRY-CHUNK SAFE BY CONSTRUCTION, and it has to be: `NamedBirds` is a STATIC
// import in App.tsx (App.tsx:29) while every other heavy tab is `lazy`, so
// everything this feature adds is paid for on first paint by every user on every
// platform. The only VALUE import here is `./formatDate`, which is already on
// that graph and is itself dependency-free; `NamedBird` / `NamedSighting` arrive
// as `import type` and are erased at build. Nothing in this feature may import
// `lib/statsFormat.ts` (the eventual convergence with `formatSpanLength` runs the
// other way), `components/ProjectsSection.tsx`, `components/map/MapSidebarUI.tsx`,
// `lib/transport.ts` or any `lib/tauri/*Service` module. `entryChunk.test.ts`
// walks this module's graph and asserts exactly that.

import { civilDaysFrom, elapsedDays } from './formatDate'
import type { NamedBird, NamedSighting } from './namedBirds'

/**
 * Which endpoint the tab-wide switch moves. Label-agnostic on purpose: the
 * visible labels live only in `namedBirdTimelineCopy.ts`, so a relabel touches
 * one file and never a state value or its consumers.
 */
export type SpanRange = 'last-sighting' | 'today'

export interface TimelineAxis {
  /** YYYY-MM-DD, the left edge. */
  start: string
  /** YYYY-MM-DD, the right edge. */
  end: string
  /** elapsedDays(start, end) ?? 0. Zero means "no axis" — render a sentence. */
  spanDays: number
}

/** One distinct sighting DATE on a lane: two checklists on one date are one mark. */
export interface TimelineMark {
  date: string
  /** Percent position along the axis, 0 to 100. */
  pct: number
  /** The distinct location names recorded on that date, EARLIEST CHECKLIST FIRST.
   *  Not input order: `computeNamedBirds` hands its sightings over newest-first,
   *  so a two-checklist morning arrives backwards. See `distinctDates`. */
  places: string[]
}

/** One bird's row on a strip. The per-bird strip is a one-lane case of this. */
export interface TimelineLane {
  /** NamedBird.key */
  key: string
  /** Display name. */
  name: string
  /** Display species. */
  commonName: string
  marks: TimelineMark[]
}

/**
 * The right-hand endpoint under the active range.
 *
 * FR-15's clamp lives HERE and nowhere else: with the range on `today` and a
 * mis-dated export whose lastSeen is in the future, the end stays lastSeen, so
 * the axis can never run backwards. A lexical max on `YYYY-MM-DD` — the same
 * comparison `computeNamedBirds` already uses to pick firstSeen/lastSeen, which
 * is why `isoDateFromMs` zero-pads.
 *
 * A null `today` forces `last-sighting`. That is the Species Detail instance,
 * which carries no session date, so its figure runs firstSeen to lastSeen
 * BECAUSE THERE IS NO OTHER VALUE IT COULD TAKE rather than because a branch
 * remembers to.
 */
export function rangeEnd(lastSeen: string, range: SpanRange, today: string | null): string {
  if (range !== 'today' || !today) return lastSeen
  return lastSeen > today ? lastSeen : today
}

/** One bird's axis: firstSeen on the left, the active range's end on the right. */
export function birdAxis(
  bird: Pick<NamedBird, 'firstSeen' | 'lastSeen'>,
  range: SpanRange,
  today: string | null,
): TimelineAxis {
  const start = bird.firstSeen
  const end = rangeEnd(bird.lastSeen, range, today)
  return { start, end, spanDays: elapsedDays(start, end) ?? 0 }
}

/**
 * The shared axis across every named bird: the earliest firstSeen to the latest
 * lastSeen, or to today. Order-independent, which is what lets the caller
 * memoize it on `birds` rather than on the sorted array, so a Sort change moves
 * lanes without recomputing the axis.
 */
export function masterAxis(birds: NamedBird[], range: SpanRange, today: string | null): TimelineAxis {
  if (birds.length === 0) return { start: '', end: '', spanDays: 0 }
  let start = birds[0].firstSeen
  let last = birds[0].lastSeen
  for (const b of birds) {
    if (b.firstSeen < start) start = b.firstSeen
    if (b.lastSeen > last) last = b.lastSeen
  }
  const end = rangeEnd(last, range, today)
  return { start, end, spanDays: elapsedDays(start, end) ?? 0 }
}

/**
 * The distinct sighting DATES of one bird, ascending, each carrying the distinct
 * location names recorded on it (FR-20, FR-32).
 *
 * Two sightings on the same date produce ONE entry with both places, which is
 * exactly why the readout's second line counts dates rather than sightings.
 * A sighting whose export carries no location name contributes no place, the
 * same omission the report row above it already makes.
 *
 * PLACES WITHIN A DATE READ CHRONOLOGICALLY, EARLIEST CHECKLIST FIRST, and that
 * is a sort rather than the input order. `computeNamedBirds` hands its sightings
 * over NEWEST FIRST with the submission id breaking ties DESCENDING, so a bird
 * seen at two places on one morning arrives afternoon-first and "first written
 * first" would read the day backwards. The submission id is the only ordering
 * signal a `NamedSighting` carries (it holds no time), and it is the same proxy
 * `computeNamedBirds` already uses to order its own ties, so this reuses it
 * rather than inventing a second one. Compared by LENGTH then lexically, which
 * orders `S99` before `S100` where a plain string compare would not.
 *
 * DEVIATION FROM schema.md, recorded rather than silent: the Architect specified
 * `distinctDates(sightings): string[]`, written before the second design pass
 * made the marks selectable. FR-54 now requires each option's accessible name to
 * be `{date}, {places}`, so the places have to travel with the date; returning
 * them here keeps that derivation at ONE chokepoint instead of leaving every
 * caller to re-group the sightings.
 */
export function distinctDates(sightings: NamedSighting[]): Array<{ date: string; places: string[] }> {
  const byDate = new Map<string, Array<{ id: string; place: string }>>()
  const dates: string[] = []
  for (const s of sightings) {
    let entries = byDate.get(s.date)
    if (entries === undefined) {
      entries = []
      byDate.set(s.date, entries)
      dates.push(s.date)
    }
    if (s.location !== '') {
      const place = s.location.trim()
      if (place !== '') entries.push({ id: s.submissionId, place })
    }
  }
  // The DEFAULT sort, with no comparator. These are zero-padded YYYY-MM-DD, so
  // the engine's own string ordering IS chronological order, and it runs native
  // rather than calling back into JS 20,000 times — `localeCompare` here was a
  // measurable share of the whole build at the NFR-04 fixture.
  dates.sort()
  const out = new Array<{ date: string; places: string[] }>(dates.length)
  for (let i = 0; i < dates.length; i += 1) {
    const entries = byDate.get(dates[i])!
    // Only a multi-checklist date needs sorting at all, and a de-duplication
    // that ran before it would fix the wrong occurrence in place.
    if (entries.length > 1) entries.sort((a, b) => compareSubmissionIds(a.id, b.id))
    // MEMBERSHIP THROUGH A SET, NEVER `Array.includes`. This runs on the main
    // thread over untrusted export text, and an export is bounded only by the
    // 50 MB upload cap -- roughly 660,000 rows, every one of which may carry the
    // same name tag on the same date, which is one `entries` array that long.
    // The `includes` form is O(k^2) and was measured at 115 / 360 / 1,698 ms for
    // 10k / 20k / 40k rows while everything upstream stayed linear and summed to
    // 59 ms; extrapolated to the cap it is minutes of blocked main thread on a
    // file the app accepts. The Set form is 5 / 16 / 14 ms and linear.
    //
    // A `Set` rather than an object used as a lookup: a bare object would answer
    // membership for a dozen inherited `Object.prototype` names, and a location
    // string is external file content. This is `computeNamedBirdLocations`' own
    // shape two functions away, in its minimal form -- that one keys a `Map`
    // because it accumulates a count, this one only asks whether it has seen a
    // place before.
    //
    // The de-duplication stays AFTER the sort: it keeps each place's earliest
    // occurrence, which is what makes a two-checklist morning read
    // chronologically. Making it faster must not make it earlier.
    //
    // The Set is built ONLY when there is something to de-duplicate, and that is
    // measured rather than assumed. Almost every date carries one checklist, and
    // for a one-entry array a `Set` is pure overhead. Measured at the 200-birds
    // fixture over six interleaved rounds with rotating start order and
    // non-overlapping distributions, the ordering is
    // `includes` < this form < always-Set: medians 3.854 / 4.029 / 4.471 ms.
    //
    // So the fast paths are worth ~9% against always-Set, and this form still
    // costs the ordinary case ~4.5% against the `includes` form it replaces.
    // That cost is the honest figure and it is the right trade: 0.17 ms on a
    // 4 ms operation, deep inside a 50 ms budget, to remove a worst case
    // measured at 10,717 ms on a 40,000-row export the app accepts.
    //
    // An earlier revision of this comment claimed the fast paths made this form
    // 7% FASTER than `includes`, so the linearity fix cost the common case
    // nothing. That did not reproduce under the more careful protocol above and
    // is corrected here rather than left standing.
    let places: string[]
    if (entries.length === 0) places = []
    else if (entries.length === 1) places = [entries[0].place]
    else {
      places = []
      const seen = new Set<string>()
      for (const e of entries) {
        if (seen.has(e.place)) continue
        seen.add(e.place)
        places.push(e.place)
      }
    }
    out[i] = { date: dates[i], places }
  }
  return out
}

/**
 * Submission ids in ascending (earliest-first) order: by LENGTH, then lexically.
 *
 * eBird ids are `S` plus a run of digits of no fixed width, so a plain string
 * compare puts `S100` before `S99`. Length-first makes the comparison numeric for
 * every well-formed id without parsing one, and it degrades to a stable
 * alphabetical order for a junk value rather than to `NaN`.
 */
function compareSubmissionIds(a: string, b: string): number {
  if (a.length !== b.length) return a.length - b.length
  return a < b ? -1 : a > b ? 1 : 0
}

/**
 * Percent positions on an axis, one per date.
 *
 * Two properties are built in rather than left to call sites:
 *
 *  - a zero-span axis returns `[]` rather than dividing by zero. A NaN in a
 *    `left:` style is a silent visual break with no error anywhere.
 *  - positions are clamped to [0, 100]. `rangeEnd`'s clamp and `masterAxis`'s
 *    minimum start already make an out-of-range value unreachable, which is
 *    exactly why the clamp belongs here: it makes "no negative or inverted mark
 *    positions" a property of this module rather than a consequence of two other
 *    functions being right.
 */
export function markPositions(dates: string[], axis: TimelineAxis): number[] {
  if (axis.spanDays <= 0) return []
  // The axis start is parsed ONCE for the whole call rather than once per date.
  const start = civilDaysFrom(axis.start)
  const out = new Array<number>(dates.length)
  for (let i = 0; i < dates.length; i += 1) out[i] = positionOf(dates[i], start, axis.spanDays)
  return out
}

/**
 * THE ONE POSITIONING RULE, shared by `markPositions` and `buildLanes` so a lane
 * built through the chokepoint and a position computed directly cannot disagree.
 *
 * The offset is SIGNED. `elapsedDays` returns a magnitude, so a date before the
 * axis start would come back positive and clamp to the WRONG END — 100% rather
 * than 0%. Both axis builders make that unreachable, which is precisely why the
 * arithmetic has to be right here rather than lean on them: it is what makes the
 * [0, 100] bound a property of this module.
 */
function positionOf(date: string, startDay: number | null, spanDays: number): number {
  if (startDay === null || spanDays <= 0) return 0
  const day = civilDaysFrom(date)
  if (day === null) return 0
  const pct = ((day - startDay) / spanDays) * 100
  return pct < 0 ? 0 : pct > 100 ? 100 : pct
}

/**
 * Every bird's lane, IN THE ORDER GIVEN (FR-27, FR-28) — no cap, no truncation,
 * no reordering. Lane order equals card order because the caller passes the
 * already-sorted array.
 *
 * One chokepoint: every lane's marks are computed here, so every lane is
 * fixed-shape by a single write path rather than by each call site's discipline
 * (the house rule for derived fields, applied to a render-time derivation).
 */
export function buildLanes(birds: NamedBird[], axis: TimelineAxis): TimelineLane[] {
  // Parsed once for the whole strip, not once per bird and not once per mark:
  // at the NFR-04 fixture this loop runs 20,000 times.
  const start = axis.spanDays > 0 ? civilDaysFrom(axis.start) : null
  const lanes = new Array<TimelineLane>(birds.length)
  for (let b = 0; b < birds.length; b += 1) {
    const bird = birds[b]
    const dates = distinctDates(bird.sightings)
    const marks = new Array<TimelineMark>(dates.length)
    for (let i = 0; i < dates.length; i += 1) {
      const d = dates[i]
      marks[i] = { date: d.date, pct: positionOf(d.date, start, axis.spanDays), places: d.places }
    }
    lanes[b] = { key: bird.key, name: bird.name, commonName: bird.commonName, marks }
  }
  return lanes
}

/**
 * The extent of one lane's own sightings on the shared axis: first mark to last.
 * Null for an empty lane.
 *
 * This is the span line, a Designer addition no requirement asked for (FR-65).
 * It replaces colour as the carrier of a bird's extent on the monochrome master
 * and costs one `min` and one `max` over positions already computed. It may be
 * cut with nothing else changing.
 */
export function laneSpan(marks: readonly TimelineMark[]): { from: number; to: number } | null {
  if (marks.length === 0) return null
  let from = marks[0].pct
  let to = marks[0].pct
  for (const m of marks) {
    if (m.pct < from) from = m.pct
    if (m.pct > to) to = m.pct
  }
  return { from, to }
}

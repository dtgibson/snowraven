# Schema: Plan readout, sun track and moon phase

**Feature:** plan-sun-moon-readout
**Date:** 2026-09-12
**Stage:** 3, The Architect
**Source:** strategic-brief.md, prd.md (both approved); extends `pipeline/tide-weather-planner/schema.md` (1.0.29)
**Ships as:** 1.0.30 (one patch, the four-file set)

## Path

Incremental (extending the existing plan document contract and its seams).

## Assessment

SnowRaven has no database. Its data layer for this feature is the plan document contract in `frontend/src/lib/plan.ts`, the two stored halves that the twinned producers write (`WeatherPlan` from `lib/weatherPlan.ts` / `services/plan_weather.py`, `TidePlanResponse` from `lib/tidePlan.ts` / `services/plan_tide.py`), the replay envelope those halves ride in `data/replay.json`, and the pure `lib/` modules that derive what the UI draws. A prior `schema.md` exists for the Planner, so the question is whether this feature touches any of that or is a pure render-time derivation over fields `composePlan` already validates.

It touches it, in one place, and that one place is why this is Incremental rather than Frontend Only. `composePlan` brackets every event's tide against the UNTRIMMED turning points (the `hilo` request is widened a day each side so every event has a bracket on both sides), but the `Plan` it returns carries only the turning points TRIMMED to the window, because those are what the chart draws and the list prints. FR-08 requires a pick at a listed sunrise's minute to read exactly that event's height and trend, and FR-42 requires the readout to be a derivation over the document. Deriving it from the trimmed points would give a different bracket, and for a subordinate station a different height, whenever the bracketing turning point lies outside the window (the first hours after the axis start on every plan, and the last hours of every plan). So the composer's output gains one field, `tide.bracketPoints`, the untrimmed points the events were bracketed with, and the readout's tide rule becomes the SAME function over the SAME inputs as the event's, which makes QA-08 an identity rather than a coincidence.

Everything else the brief asked for holds as derive-not-store. The two STORED halves are byte-unchanged: no producer changes, no parity fixture row, no replay key, no migration of any stored document, and a plan stored by 1.0.29 gains all three layers on replay because `Plan` is recomputed from the halves on every load. The place's latitude and longitude are already in the weather half (`WeatherPlan.lat` / `.lng`, the validated inputs echoed by both producers since 1.0.29), each day's listed sunrise and sunset are in `days[]`, the window and the day boundaries are in the document, and the tide curve, turning points and weather cells are all there. No field is added to a stored document.

Two further things make this the data layer's business rather than the UI's alone, and each is settled below: the feature adds new scans over replayed-document content (per pick over the tide arrays and the cells, per plan over the days for the sun and the moon), which `.claude/rules/security.md` says a build declares in the schema up front with its linearity argument; and one entry-chunk assertion flips (`lib/tzClock.ts` joins the entry graph, section 5), which `entryChunk.test.ts` polices and the schema must state.

## Current Schema State

This section is the cumulative contract after this feature, the source of truth for the next Architect run. Sections of the 1.0.29 schema that still hold unchanged are cited by their number there rather than restated: the routes and services (its section 4), the time axis (5), caching and replay (6), errors and honest states (7), the 1.0.29 scans (9) and its reuse map (11). Everything restated here is restated because it is either changed or load-bearing for this feature.

### 1. The two stored halves (unchanged, produced by the twins, replayed as stored)

```
type EpochS = number            // integer seconds since 1970-01-01T00:00:00Z; never fractional
type LocalClock = string        // 'YYYY-MM-DD HH:MM' in the location's timezone; display only
type LocalDate = string         // 'YYYY-MM-DD' in the location's timezone
type Resolution = 'hourly' | 'daily'

interface PlanWeather {
  resolution: Resolution
  emoji: string; description: string
  tempF: number; highF: number | null; lowF: number | null
  windDesc: string; windDir: string
  cloudsPct: number; humidityPct: number; dewPointF: number
}
// PlanWeather still carries NO moon, isNight, sunrise or sunset field (1.0.29 D7).
// The plan's moon is a render-time derivation (section 4), never a provider
// field: One Call's daily moon_phase is not read by either producer, and a
// value present in a response is ignored by construction (FR-36).

interface PlanWindow { startTs; startLocal; endTs; endLocal; axisStartTs; axisStartLocal }
interface PlanDay {
  date: LocalDate
  startTs: EpochS               // local midnight
  endTs: EpochS                 // next local midnight - 1 (82,799 / 86,399 / 89,999 seconds long)
  sunrise: { t: EpochS; local: LocalClock } | null   // null when the daily entry carries none
  sunset:  { t: EpochS; local: LocalClock } | null
}
interface SpineEvent { kind: 'sunrise' | 'sunset'; t: EpochS; local: LocalClock; date: LocalDate; weather: PlanWeather }
interface PlanCell   { resolution: Resolution; startTs: EpochS; endTs: EpochS; local: LocalClock; weather: PlanWeather }
interface NightSpan  { startTs: EpochS; endTs: EpochS }

interface WeatherPlan {          // stored under replayKey('/weather/plan', { lat, lng })
  tz: string; lat: number; lng: number
  fetchedAt: EpochS
  window: PlanWindow
  hourlyEndTs: EpochS
  days: PlanDay[]                // 1..PLAN_DAYS_MAX (16)
  events: SpineEvent[]           // 0..PLAN_EVENTS_MAX (32)
  cells: PlanCell[]              // 0..PLAN_CELLS_MAX (112), contiguous, non-overlapping, ascending
  nightSpans: NightSpan[]        // 0..PLAN_NIGHT_SPANS_MAX (17)
}

interface TideSample   { t: EpochS; v: number; hilo: boolean }
interface TurningPoint { kind: 'high' | 'low'; t: EpochS; v: number; local: LocalClock }
type TidePlanResponse =          // stored under replayKey('/tide/plan', { lat, lng }); force stripped
  | { status: 'unavailable' }
  | { status: 'too-far' | 'outside-us'; station: { id: string; name: string }; distanceMi: number }
  | { status: 'ok'; source: 'predicted'; station; distanceMi: number; tz: string; continuous: boolean
      range: { startTs: EpochS; endTs: EpochS }
      curve: TideSample[]          // 0..PLAN_CURVE_MAX (448), every t a multiple of 1800
      turningPoints: TurningPoint[] }  // 0..PLAN_HILO_MAX (64), the widened span, in and out of window
```

Caps, producers, the GMT axis, the replay envelope and the 300,000-code-unit bound are exactly as 1.0.29 sections 3 to 6: each array is capped at the parse boundary by its producer, the maximal fixture family asserts the bound, and `replayStore` is unchanged (its stated exceptions, no per-entry validation on load and a `bytes` guard that admits negatives, are neither widened nor closed here).

### 2. `Plan`, the in-memory document the UI renders (MODIFIED: one field)

`composePlan(weather, tide)` in `lib/plan.ts` still returns this and is still the only producer of it, on every platform, for a live pair, a replayed pair and a forced override. It is never stored.

```
interface Bracket   { kind: 'high' | 'low'; heightFt: number; t: EpochS; local: LocalClock }
interface EventTide { heightFt: number | null; heightSource: 'continuous' | 'interpolated' | null
                      trend: 'rising' | 'falling' | null; prev: Bracket | null; next: Bracket | null }
type PlanEvent = SpineEvent & { tide: EventTide | null }

type PlanTide =
  | { status: 'ok'; source: 'predicted'; station; distanceMi: number; continuous: boolean
      curve: TideSample[]              // trimmed to [window.axisStartTs, window.endTs]; what the chart draws
      turningPoints: TurningPoint[]    // trimmed to the same; the markers and the listed turning points
      bracketPoints: TurningPoint[] }  // NEW: the half's points UNTRIMMED (0..64, ascending); what the events
                                       // were bracketed with and what the readout brackets with (FR-08)
  | { status: 'too-far' | 'outside-us'; station; distanceMi: number }
  | { status: 'unavailable' }
  | null

interface Plan {
  tz: string; lat: number; lng: number
  fetchedAt: EpochS
  window: PlanWindow; hourlyEndTs: EpochS
  days: PlanDay[]; events: PlanEvent[]; cells: PlanCell[]; nightSpans: NightSpan[]
  tide: PlanTide
}
```

`composePlan` rules, unchanged from 1.0.29 section 3.5 except the last:

- Every array access is guarded and every printed string and number is type-checked at the boundary (`asWeather`, `asEvents`, `asCells`, `asDays`, `asSamples`, `asTurningPoints`); a malformed half or entry yields `tide: null`, an absent moment, or a dropped entry, never a throw. `asDays` already reads a malformed sunrise or sunset as absent, which is the FR-28 rule for a malformed day's events.
- Tide comparisons use the instant's MINUTE, `m = t - (t % 60)`; `prev` is the latest bracket point with `t < m`, `next` the earliest with `t >= m`; `trend` is by the kind of `next`, null with no `next`; the height is linear between two continuous samples at most 1,800 s apart, else `interpAtEpoch(m, bracketPoints)`, else null.
- `tide.bracketPoints` is `asTurningPoints(tide.turningPoints)` as parsed and sorted by the producer, with no window filter; `tide.turningPoints` is the same array filtered to the window; `tide.curve` is the samples filtered to the window. Events are bracketed with `bracketPoints`, as they were in 1.0.29 (the composer used its local `allTps` for exactly this); the field only publishes what the composer already held.
- `lat` and `lng` remain `isNum(x) ? x : 0`. A document from either producer always carries them (the parity fixture asserts every family's echo), so the `0` default is the 1.0.29 posture for a document neither producer could have written, kept rather than widened; the sun module validates the range itself (section 4.1).

### 3. Seams and placement (the table the next run reads)

| Concern | Module | Entry graph | Twinned in Python | Notes |
|---|---|---|---|---|
| Document contract, merge, tide-at-minute rule | `lib/plan.ts` (`composePlan`, `tideAtEvent`, `interpAtEpoch`) | Yes | No (one merge, every platform; 1.0.29 D1) | closure stays size 1, no externals |
| Weather half producer | `lib/weatherPlan.ts` / `services/plan_weather.py` | No | Yes, fixture-locked | unchanged |
| Tide half producer | `lib/tidePlan.ts` / `services/plan_tide.py` | No | Yes, fixture-locked | unchanged |
| The location's clock | `lib/tzClock.ts` / `services/tz_clock.py` | **Yes (NEW: joins)** | Yes, fixture-locked | see section 5; dependency-free (Intl only) |
| Chart geometry, lanes, height, density, x/y and the new sun scale, pick geometry | `lib/planChartGeometry.ts` | Yes | No | the host sizes the Suspense box from `planChartHeight` |
| Sun altitude and the anchored curve | `lib/planSun.ts` (NEW) | Yes | **No** (section 4.1 says why) | Math only; no imports beyond `plan.ts` types |
| Moon phase glyph | `moonPhaseEmoji` in `lib/weatherFormatter.ts` | Yes (already) | Yes, byte-golden (`backend/formatters/weather.py`) | untouched |
| Moon names and the per-day moment | `lib/planMoon.ts` (NEW) | Yes | No (names are TS-only; the glyph is the twinned value) | imports the three moon exports of `weatherFormatter.ts` |
| Readout derivation, cell lookup, tide-at-instant | `lib/planReadout.ts` (NEW) | Yes | No | imports `plan.ts`, `planSun.ts`, `tzClock.ts` |
| Pick arithmetic: bounds, minute rounding, quarter marks, steps, the tap threshold | `lib/planPick.ts` (NEW) | Yes | No | imports `tzClock.ts`; the pointer state machine itself is in the chart component |
| Copy | `lib/planCopy.ts` | Yes | No | the Designer's new strings land here |
| Host: readout block, pick state, list (moon and sun-peak lines) | `components/PlanResult.tsx` | Yes | | pick state lives here (section 6.4) |
| Chart: sun track, pick marker, slider role, keys, pointer machine | `components/PlanChart.tsx` | No (lazy, `import('./PlanChart')`) | | the only module that imports recharts |

Request and storage seams: `CACHED_GET_PATHS`, `EBIRD_GATED_PATHS`, `replayStore` writers, `clearDerived.ts`, the two transport matches, the two routes and the two Tauri services are all unchanged (section 8).

## Changes in This Feature

### Added

**A. `PlanTide.bracketPoints`** (in-memory only; section 2). `composePlan` publishes the untrimmed turning points beside the trimmed ones. Bound: `PLAN_HILO_MAX = 64`, inherited from the producer.

**B. `lib/planSun.ts`, the sun-altitude derivation.** Pure, dependency-free, entry-safe, NOT twinned.

```
sunAltitudeDeg(lat: number, lng: number, ts: EpochS): number
  // Geometric altitude of the sun's centre in degrees, no refraction, no
  // semidiameter. The NOAA Solar Calculator equations (Meeus, Astronomical
  // Algorithms ch. 25, the low-precision series), in this order and no other:
  //   jc  = ((ts / 86400) + 2440587.5 - 2451545) / 36525
  //   L0  = (280.46646 + jc * (36000.76983 + jc * 0.0003032)) mod 360
  //   M   = 357.52911 + jc * (35999.05029 - 0.0001537 * jc)
  //   e   = 0.016708634 - jc * (0.000042037 + 0.0000001267 * jc)
  //   C   = sin M * (1.914602 - jc * (0.004817 + 0.000014 * jc)) + sin 2M * (0.019993 - 0.000101 * jc) + sin 3M * 0.000289
  //   lam = L0 + C;  omega = 125.04 - 1934.136 * jc;  lamApp = lam - 0.00569 - 0.00478 * sin omega
  //   eps0 = 23 + (26 + (21.448 - jc * (46.815 + jc * (0.00059 - jc * 0.001813))) / 60) / 60
  //   eps = eps0 + 0.00256 * cos omega
  //   decl = asin(sin eps * sin lamApp)
  //   y   = tan^2(eps / 2)
  //   eot = 4 * deg(y * sin 2L0 - 2e * sin M + 4e * y * sin M * cos 2L0 - 0.5 * y^2 * sin 4L0 - 1.25 * e^2 * sin 2M)   // minutes
  //   tst = (((ts mod 86400) / 60) + eot + 4 * lng) mod 1440                                                         // true solar time, minutes
  //   H   = tst / 4 - 180  (add 360 while < -180)                                                                    // hour angle, degrees
  //   alt = deg(asin(sin lat * sin decl + cos lat * cos decl * cos H))
  // Accuracy: within about 0.05 degrees of the apparent geometric altitude for
  // 1950 to 2050 (NOAA quotes sunrise times within a minute), which is far
  // inside the whole degree the readout prints and the pixel the chart draws.
  // DISPLAY ONLY. This function is never a source of a sunrise or sunset
  // TIME shown anywhere (1.0.29 FR-42 holds in substance; FR-27 here).

solarNoonTs(lat, lng, aroundTs: EpochS): EpochS
  // The instant of local solar noon nearest aroundTs: 720 - 4 * lng - eot
  // minutes after the UTC midnight nearest, shifted by a day when needed so it
  // lies within 12 hours of aroundTs.

interface SunAnchor { kind: 'sunrise' | 'sunset'; t: EpochS; tc: EpochS | null; dayIndex: number }
  // t  = the LISTED instant from PlanDay (never computed)
  // tc = the COMPUTED geometric crossing for that day, found by bisection on
  //      sunAltitudeDeg over [noon - 43200, noon] (sunrise) or [noon, noon + 43200]
  //      (sunset) to one-second precision, ONLY when the interval's ends have
  //      opposite signs; null otherwise (a polar day, a polar night, or a listed
  //      event the computed curve cannot reproduce). At most 20 iterations.

interface SunModel {
  lat: number; lng: number
  axisStartTs: EpochS; endTs: EpochS
  days: Array<{ startTs; endTs; side: (t) => '+' | '-' | 'free' }>   // per-day side rule, below
  anchors: SunAnchor[]                                               // ascending by t; 0..32
}

buildSunModel(plan: Plan): SunModel | null
  // null when lat/lng are not finite or out of range (|lat| > 90, |lng| > 180),
  // which no producer can emit and the composer does not range-check; the
  // caller then draws no track, prints no sun line and no sun peak (the
  // degraded state, NFR-07). Otherwise one model per plan, memoised by the
  // host on plan identity, never rebuilt on a pick or a density change.
  //
  // Anchor admission, per day: a listed sunrise or sunset is an anchor only
  // if startTs <= t <= endTs; when both are listed, only if sunrise.t <
  // sunset.t. A day failing either reads as listing NEITHER for the track
  // (FR-28's malformed-day rule; the list's own notes are the document's and
  // are unchanged).
  //
  // Per-day side (the FR-27 / FR-28 sign rule, the clamp in sunAltitudeAt):
  //   both listed:   t < sunrise: '-'   sunrise <= t <= sunset: '+'   t > sunset: '-'
  //   sunrise only:  t < sunrise: '-'   t >= sunrise: '+'
  //   sunset only:   t <= sunset: '+'   t > sunset: '-'
  //   neither:       'free'

sunAltitudeAt(model: SunModel, t: EpochS): number
  // The ANCHORED altitude, the one function the track samples and the readout
  // reads (FR-12, FR-27). Two steps:
  //   1. Shape: a time warp between consecutive anchors. For t in [a.t, b.t]
  //      where a and b are consecutive anchors both carrying tc with b.tc > a.tc,
  //      t' = a.tc + (t - a.t) * (b.tc - a.tc) / (b.t - a.t) and the value is
  //      sunAltitudeDeg(lat, lng, t'). Where either end lacks tc, or the pair is
  //      not monotone, the segment uses a constant shift from whichever end
  //      has one (t' = t + (tc - t) of that end), else no shift. Before the
  //      first anchor and after the last, the constant shift of the nearest
  //      anchor. A stretch factor of (b.tc - a.tc) / (b.t - a.t) is within a
  //      fraction of a percent of one for any provider that computes its
  //      events, so the shape follows the computed altitude and the day's
  //      peak is the computed maximum for the day to within the sampling
  //      error (well under one degree, FR-27), regardless of how far the
  //      listed instants sit from the geometric crossings. (An additive
  //      correction was rejected for exactly that reason, D3.)
  //   2. Sign: clamp by the day's side: '+' gives max(0, v), '-' gives min(0, v),
  //      'free' gives v. At an anchor's own t the result is exactly 0.
  // With the clamp, on a day listing both events the value is <= 0 before the
  // listed sunrise, exactly 0 at it, > 0 strictly between (the warped instant
  // lies strictly between the computed crossings), exactly 0 at the listed
  // sunset and <= 0 after: the sign changes at the listed minutes and nowhere
  // else (QA-27). A day listing one event crosses once, at it (QA-28). A day
  // listing neither is the unanchored computed curve (QA-28).

interface SunSample { t: EpochS; deg: number }
sunTrack(model: SunModel): SunSample[]
  // One sample at every 15-minute mark of the LOCATION's clock in
  // [axisStartTs, endTs] (axisStartTs is an hour start so it is a mark; endTs is
  // 23:59:59 so the last mark is 23:45), plus one sample at every anchor's t,
  // ascending, de-duplicated. Count <= hours * 4 + anchors (QA-33), computed
  // ONCE per plan and never resampled with density (FR-33). The quarter marks
  // are the pick's quarter marks (planPick.ts), so a keyboard step lands on a
  // drawn sample.

sunPeakByDay(model: SunModel): Array<{ dayIndex: number; t: EpochS; deg: number } | null>
  // Per day: the maximum of sunAltitudeAt over that day's samples plus the
  // warped solar noon, with its instant; null for a day the model could not
  // sample. The FR-34 list line ("Sun highest at {time}, {n} degrees") prints
  // Math.round(deg) and localClock(t, tz) (section 5). Within one sample of the
  // track's maximum by construction (QA-34).
```

The readout's sun figure (FR-12) is `Math.round(sunAltitudeAt(model, t))`, with the above / on / below wording decided by the ROUNDED value's sign (0 reads "on the horizon"). A real One Call event is second-resolved (the parity fixture's events happen to sit on :00, production ones do not), while every pick is a whole minute, so a pick "at the listed sunrise's minute" is at most 30 seconds from the anchor; the sun moves at most 0.25 degrees per minute at the horizon, so the anchored value there is within 0.125 degrees of zero and rounds to 0 (QA-12). The exact-zero statement is at the anchor's own `t`, which is where the track's sample sits and where `planSun.test.ts` asserts it. The tide identity of FR-08 is over the composer's minute, `m = e.t - (e.t % 60)`: a pick at `m` reads exactly the event's height and trend because it is the same function over the same inputs (section D below); the Tester's QA-08 row picks `m`, not a nearest-minute rounding of `e.t`.

**Why the sun is not twinned.** Parity exists in this repo where two producers could disagree about a stored or transported value: the halves are produced by the FastAPI routes for web/Pi and by the TypeScript services on desktop, so they are fixture-locked. The sun curve is produced by ONE runtime on every platform (the browser's JavaScript, on web/Pi as on desktop), enters no document, crosses no transport and is never stored; there is nothing for a Python twin to agree with. The moon is different only because the glyph must equal the one the checklist weather blocks write, and those blocks ARE produced by both runtimes; the plan reuses the already-twinned function and adds no Python.

**C. `lib/planMoon.ts`, the moon line.** Pure, entry-safe.

```
MOON_PHASE_NAMES = ['New moon', 'Waxing crescent', 'First quarter', 'Waxing gibbous',
                    'Full moon', 'Waning gibbous', 'Last quarter', 'Waning crescent']
  // Indexed by PHASE, the same eight bins as MOON_PHASE_BOUNDS in
  // weatherFormatter.ts. The name follows the phase and never mirrors (FR-38).

localNoonTs(day: PlanDay): EpochS
  // day.startTs + 43200 + ((day.endTs - day.startTs + 1) - 86400): the instant
  // the local clock reads 12:00, from the day's own boundaries (FR-37), exact
  // on every zone that changes its clock before noon (every US zone changes at
  // 02:00, which the axis lane's tick placement already relies on). A day of
  // 86,400 seconds gives midnight + 12 h; a 25-hour day + 13 h; a 23-hour day
  // + 11 h. Asserted over the dst-fall and dst-spring families through
  // tzClock.localClock reading 'YYYY-MM-DD 12:00'.

moonForDay(day: PlanDay, lat: number): { glyph: string; name: string } | null
  // glyph = moonPhaseEmoji(localNoonTs(day), lat)   (the shipped function, never a copy; FR-36, FR-39)
  // idx   = (lat < 0 ? MOON_SOUTH : MOON_NORTH).indexOf(glyph)   (the hemisphere's OWN ordering is the phase index)
  // name  = MOON_PHASE_NAMES[idx]
  // null only if idx < 0, which cannot happen (the glyph came from that array),
  // stated so a future ninth glyph degrades rather than throws.
```

`weatherFormatter.ts` and `backend/formatters/weather.py` are byte-untouched; the checklist blocks, the single-moment night glyph and the goldens stay byte-identical (FR-41, QA-38). Whether the timeline also shows the moon is the Designer's (OQ-06); if drawn, the chart calls `moonForDay` for each day exactly as the list does, and QA-49 compares them.

**D. `lib/planReadout.ts`, the pick's figures.** Pure, entry-safe.

```
cellAt(cells: ReadonlyArray<PlanCell>, t: EpochS): PlanCell | null
  // The document's own cell with startTs <= t <= endTs; linear over <= 112
  // cells (or a binary search: they are ascending and disjoint). Null in a
  // gap. Never the strip's collapsed block cell (FR-09): the strip's blocks
  // are a density view in planChartGeometry.planStripCells, not the document.

tideAtInstant(t: EpochS, tide: PlanTide): EventTide | null
  // null unless tide.status === 'ok'; else tideAtEvent(t, tide.curve, tide.bracketPoints),
  // the composer's own function over the composer's own inputs, so for any
  // event e, tideAtInstant(e.t, plan.tide) deep-equals e.tide (QA-08, tested
  // as an invariant over every event of every fixture family).

interface PlanReadout {
  t: EpochS                              // the picked minute
  local: LocalClock | ''                 // localClock(t, plan.tz), or '' when the zone is unusable (section 5)
  tide: { kind: 'none' } | { kind: 'reading'; reading: EventTide }    // 'none' when the plan has no tide (FR-11)
  weather: PlanCell | null               // null in a gap (FR-09)
  sunDeg: number | null                  // Math.round(sunAltitudeAt(model, t)); null with no model
}
planReadoutAt(plan: Plan, t: EpochS, model: SunModel | null): PlanReadout
  // One pure computation per pick, under 16 ms for an eight-day plan by an
  // order of magnitude (a few hundred comparisons and one Intl format).
readoutValueText(r: PlanReadout | null, copy): string
  // The four figures in one string for aria-valuetext (FR-23), or the rest
  // line when r is null; built from PLAN_COPY so the visible block and the
  // announced text cannot drift.
```

**E. `lib/planPick.ts`, the pick's arithmetic.** Pure, entry-safe (imports `tzClock`).

```
PLAN_TAP_PX = 5                          // OQ-09: total pointer movement below which a press-and-release is a pick
isTap(maxMovedPx: number): boolean       // maxMovedPx < PLAN_TAP_PX

pickBounds(plan): { min: EpochS; max: EpochS }
  // min = window.axisStartTs (an hour start, so a quarter mark);
  // max = window.endTs - (window.endTs % 60), the window's last whole minute
  // (23:59). Every pick and every step is clamped to [min, max]. These are the
  // slider's aria-valuemin / aria-valuemax.

toPickInstant(t: number, bounds): EpochS   // round to the nearest minute, then clamp

quarterMarkToward(t: EpochS, dir: -1 | 1, tz: string): EpochS
  // The nearest 15-minute mark of the LOCATION's clock strictly in direction
  // dir. Let off = utcOffsetSec(t, tz) and m = t - ((((t + off) % 900) + 900) % 900),
  // the mark at or before t on the local clock. Right (dir > 0) gives m + 900
  // whether or not t is on a mark (the next mark strictly after t). Left
  // (dir < 0) gives m when t is off a mark and m - 900 when t is on one (the
  // previous mark strictly before t). Every real zone offset is a multiple of
  // 900 s, so these coincide with UTC quarter marks; the test asserts that
  // over every fixture zone, and the rule is still stated in the location's
  // clock because that is the contract.
isOnQuarterMark(t, tz): boolean

stepPick(current: EpochS | null, key: PickKey, plan: Plan): EpochS
  // PickKey = 'quarter-left' | 'quarter-right' | 'hour-left' | 'hour-right' | 'day-left' | 'day-right' | 'home' | 'end'
  // With no pick (FR-21): the base is plan.fetchedAt (Now; on a replayed plan
  // the stored fetch instant): 'quarter-right' picks the first quarter mark AT
  // or after Now, 'quarter-left' the last at or before; 'hour-right' the first
  // HOUR mark at or after Now, 'hour-left' the last at or before; 'day-right'
  // the first quarter mark at or after Now plus 86,400, 'day-left' the last at
  // or before minus 86,400.
  // With a pick: 'quarter-*' = quarterMarkToward(current, dir) (from 6:07,
  // Right gives 6:15 and Left 6:00); 'hour-*' and 'day-*' first align an
  // unaligned instant with quarterMarkToward in the step's direction, then
  // add dir * 3600 or dir * 86400 of REAL time (from 6:15, Shift+Right gives
  // 7:15; Page Up gives the same clock tomorrow, an hour off across a clock
  // change, the ARIA slider convention FR-20 names). 'home' = bounds.min,
  // 'end' = bounds.max. Everything clamps to the bounds; a step at an end
  // stays at the end (QA-20).
```

**F. Chart geometry additions** (`lib/planChartGeometry.ts`, section 6.1).

**G. Copy** (`lib/planCopy.ts`): the rest line, the sun line variants, the no-tide and no-weather phrases, the estimate line, the moon line, the sun-peak line, the legend's Sun entry, the slider's name (with and without tide, stating the place, the window, that the arrow keys read any moment, that the details are in the list), the estimate description; the renamed action label and the caption and closing note naming Get specific forecast. The words are the Designer's (OQ-04, OQ-10); the keys are the Architect's so the tests can name them.

**H. Tokens**: at least one for the sun track and one for the pick marker, in both theme blocks, at 3:1 against both bands in both themes, asserted by `planContrast.test.ts` (NFR-02). Names are the Designer's (`--sr-plan-sunline`, `--sr-plan-pick` suggested).

### Modified

- `lib/plan.ts`: `PlanTide` ok variant gains `bracketPoints`; `composePlan` publishes `allTps` as it. No other line changes; `tideAtEvent` and `interpAtEpoch` are untouched and remain the rule.
- `lib/planChartGeometry.ts`: the no-tide plot constants may grow (Designer's numbers); the sun scale, `tAt`, `pickMarkerBox`, `revealScrollLeft` are added; `planChartHeight` keeps its form.
- `lib/planCopy.ts`: the strings above; `actionLabel`, `caption`, `closingNote`, `chartNameWithTide` / `chartNameNoTide` change words only.
- `components/PlanResult.tsx`: pick state, the readout block, the moon and sun-peak lines, the legend's Sun entry, memoised list and chart props (section 6.4).
- `components/PlanChart.tsx`: the sun track beneath the tide line, the pick marker overlay, the slider role and attributes, the key map, the pointer state machine, the keyboard-only reveal scroll, `focus()` on a pointer pick.
- `components/WeatherForecastPanel.tsx`: the entry button reads Plan with its accessible name beginning with Plan; the plan action's label; nothing else (FR-01 to FR-03).
- `lib/entryChunk.test.ts`: `has('lib/tzClock.ts')` flips to `true` with a dependency-light closure assertion; positives for the four new lib modules; the chart's closure still carries recharts and now also reaches `planSun.ts` and `planPick.ts`.
- `lib/weatherTidePlanPublishedClaims.test.ts`: the HELP anchor moves with the renamed heading; the rename claim and the four FR-45 claims are added (section 9).
- `lib/planPhoneRender.golden.html`: regenerated deliberately, its diff reviewed (the list gains two lines per day; the chart gains the track; NFR-08).
- `docs/HELP.md`, `README.md`, `website/index.html`, `ACCESSIBILITY.md`, `CHANGELOG.md`, `frontend/package.json`, `src-tauri/tauri.conf.json` (section 9).

### Unchanged

- Both stored halves and both producers on both transports; the parity fixture and both parity tests; `tzClock.ts` / `tz_clock.py` themselves.
- `GET /weather/plan`, `GET /tide/plan`, `getWeatherPlan`, `getTidePlan`, the two transport matches, `CACHED_GET_PATHS`, `EBIRD_GATED_PATHS`, `replayStore` (caps, writer, purge generation), `replayKey`, `isChecklistDerivedReplayKey`, `clearDerived.ts`, `cacheInventory.test.ts`.
- `weatherFormatter.ts`, `backend/formatters/weather.py`, `forecastSlice.ts`, `buildWeatherPayload`, `pickForecastSlice`, `computeTideReading`, `/weather/at`, `/tide/at`, Current, the checklist lookup, the copy block: byte-identical (FR-03, FR-41, NFR-08).
- `PRIVACY_POLICY.md` (FR-48): read against the change and left byte-identical; nothing new is requested, sent or stored.
- Every identifier: no component, function, route, DOM id, CSS class, storage or settings key (`planDaysInView` included), replay key or stored shape changes for the rename (FR-04).
- The Days in view control, the day buttons, the night bands, the strip, the tide curve, the drag (D4-12), the wheel and touch scrolling.

## Migration Plan

No stored document migrates. These are the Engineer's steps, in order; each is testable on its own before the next.

1. **`lib/plan.ts`**: add `bracketPoints` to the ok variant of `PlanTide` and publish `allTps` from `composePlan`. Extend `plan.test.ts`: for every event of every fixture family, `tideAtEvent(e.t, plan.tide.curve, plan.tide.bracketPoints)` deep-equals `e.tide`; `bracketPoints.length >= turningPoints.length`; a pick at the axis start on the subordinate family reads the same height it would with the untrimmed points and a different one with the trimmed points (the non-vacuity leg: the field exists because those differ).
2. **`lib/planSun.ts`** with `planSun.test.ts`: the formula against three published reference values (an equinox noon at the equator reads about 90 minus the declination; a known NOAA table row; a midnight in the southern hemisphere reads negative); `solarNoonTs` within two minutes of a NOAA table value; bisection finds both crossings on the reference family and none on the polar family's polar day; the anchoring invariant on every fixture day with both events (sign changes exactly at the listed minutes, value exactly 0 there, the sampled maximum within one degree of the computed maximum, no other sign change); the polar rows (neither: all one side; one event: one crossing at it and no sample below zero after a sunrise-only anchor that day); a malformed day (sunrise after sunset, or an event outside the day) is unanchored; out-of-range lat gives null; `sunTrack` count <= hours * 4 + anchors, unchanged by any density input (it takes none); `sunPeakByDay` within one sample of the track's maximum.
3. **`lib/planMoon.ts`** with `planMoon.test.ts`: the lunar-month sweep at one-hour steps in both hemispheres asserting the glyph and the name change at the same instants with exactly eight distinct pairs per hemisphere, the northern pair at phase i being `MOON_NORTH[i]` and the southern `MOON_SOUTH[i]` with the same name (QA-37); `localNoonTs` reading 12:00 through `localClock` over the dst-fall, dst-spring and reference families; the golden rows of step 4.
4. **The moon golden oracle**: extend `weatherFormatter.golden.py` with a section that reads `weatherTidePlan.fixture.json`, computes each family's days' local-noon instants from the expected days' boundaries, and prints `moon_phase_emoji(noon, lat)` per (family, date); paste the rows into `planMoon.test.ts` (the existing paste-the-golden shape) and add the same rows to `backend/tests/test_formatters.py` asserted against `moon_phase_emoji`, so a change on either side goes red on its own side (QA-36, and the security rule's each-side test).
5. **`lib/planPick.ts`** with `planPick.test.ts`: bounds; rounding; every `PickKey` from an aligned pick, an unaligned pick and no pick (QA-20, QA-21), on a plain day and across both DST families (Page Up lands an hour off in clock terms and exactly 86,400 s in real terms); clamping at both ends; `quarterMarkToward` over every fixture zone equals the UTC quarter mark; `isTap` at 4.99 and 5.
6. **`lib/planReadout.ts`** with `planReadout.test.ts`: the cell rule including the collapsed-block case (a pick at 7:20 on a 3-hour block reads the 7 AM cell), a gap, the daily tail (QA-09, QA-10); the tide rule over the reference, subordinate, gap and same-minute families, the no-tide plan, the no-bracket instant (QA-08, QA-11); the sun figure at a listed sunrise (0), at local noon (positive, equal to the peak within one degree), at 2 AM (negative) (QA-12); the value text contains every figure once; a timing row (one readout over the maximal family under 16 ms, judged only with nothing else compiling, per the testing rule).
7. **`lib/planChartGeometry.ts`**: the sun scale, `tAt`, `pickMarkerBox`, `revealScrollLeft`, and the Designer's plot constants; extend `planChartGeometry.test.ts` (the tier numbers move if the no-tide plot grows; `ySun(0)` sits at the zero fraction, `ySun(PLAN_SUN_TOP_DEG)` at the plot's top, monotone; `tAt(x(t)) === t` on the grid and `tAt` clamps the gutter to the axis start; `revealScrollLeft` moves by the minimum and by nothing when the marker is visible).
8. **`lib/planCopy.ts`**: the Designer's strings; `planCopy.test.ts` sweeps the new count-bearing ones and the em-dash rule; the no-inference word list (best, good, golden, recommended) asserted absent across `PLAN_COPY` (QA-40).
9. **`components/PlanResult.tsx`**: the pick state, the readout block (stacked-variant grid, section 6.4), the memoised list and the memoised chart props, the moon and sun-peak lines, the Sun legend entry; extend `PlanResult.test.tsx` (readout present at rest before the chunk resolves; identical height across rest, full, no-tide and no-weather at 320 / 390 / 1200 and 100% / 200% through the house method; the list's DOM byte-identical across a pick; the corrupted-shape families still render with each degraded part's fallback).
10. **`components/PlanChart.tsx`**: the track beneath the tide line in SVG order, the marker overlay, the slider role and attributes, the key map, the pointer machine, the reveal scroll issued only from the key handler, focus on a pointer pick; extend `PlanChart.test.tsx` (the D4-12 drag rows stay green byte for byte; the pick-versus-drag rows of QA-15; the key rows of QA-20 to QA-22 including "a pointer pick never changes scrollLeft" and "no scroll after a drag"; the announcement rows of QA-23; the SVG-order row of QA-30; the bounded-samples row of QA-33; no live region in the region).
11. **`components/WeatherForecastPanel.tsx`**: the two labels and the entry's accessible name; extend `WeatherForecastPanel.plan.test.tsx` with QA-16 (a request spy armed after the plan renders: 50 pointer picks, 50 steps, three Days in view changes and one Escape make zero transport calls and zero `storage` reads; one plan still makes exactly its 1.0.29 requests) and QA-39 (a 1.0.29 plan document captured as a fixture replays with all three layers).
12. **Guards**: `entryChunk.test.ts` (section 7), `planContrast.test.ts` (the new tokens), `weatherTidePlanPublishedClaims.test.ts` (section 9), the phone render golden regenerated with its diff reviewed.
13. **Docs, version, changelog** in the same change (section 9); `npm run build` before push.

## Design Decisions

The numbered sections below carry the decisions the stage brief asked the schema to settle; the D-items at the end record the calls that diverge from a default or that a later run might otherwise re-litigate.

### 4. The derivation seams, one more time in one place

4.1 Sun: `lib/planSun.ts`, entry graph, not twinned, display only (B above). 4.2 Tide at an instant and the weather cell: `lib/planReadout.ts` over `plan.ts`'s own `tideAtEvent` (D above). 4.3 Moon: `moonPhaseEmoji` (entry, twinned, untouched) plus `lib/planMoon.ts` (C above). 4.4 Keys: `lib/planPick.ts` (E above), with the timezone from `plan.tz` through `tzClock.utcOffsetSec`. 4.5 The picked minute's clock: `tzClock.localClock(t, plan.tz)`.

### 5. `tzClock.ts` joins the entry graph, and the 1.0.29 rule is amended

1.0.29 section 13 item 1 says the components compute no local time because the document carries every local string. A pick at an arbitrary minute has no string in the document, so the readout's clock is a render-time conversion, and the honest way to do it is with the SAME twin helper the producers used (`localClock`), in a pure lib module, never in a component. The rule is therefore amended to: **the components compute nothing; `lib/planReadout.ts` and `lib/planSun.ts` may convert the picked minute and the sun-peak instant to the location's clock through `tzClock.localClock`, and `lib/planPick.ts` may read the zone offset through `tzClock.utcOffsetSec`; every other local string still comes from the document.** The entry cost is `tzClock.ts` itself: about a hundred lines, Intl only, no imports, memoised formatters. The panel already carries an Intl zone conversion on the entry graph (`nowInTz`), so this is no new class of thing on first paint. `entryChunk.test.ts` line 614 flips from `false` to `true`, with a closure assertion that the module reaches nothing (`files.size === 1`, no externals), the same shape `lib/plan.ts` is held to.

One consequence is owed a guard: `Intl.DateTimeFormat` THROWS on an unrecognised `timeZone`, and `composePlan` accepts `tz` as any string (a replayed document is unvalidated on load). `planReadoutAt` and `sunPeakByDay` therefore call a `safeLocalClock(t, tz)` that catches and returns `''`, and `planPick` a `safeOffset` that falls back to 0 (UTC quarter marks). The host memoises "is this zone usable" once per plan. The readout's time part then shows the Designer's unavailable wording rather than blanking, and the plan never throws (NFR-07). No producer can emit an unusable zone (both call the app's own resolver), so this is a resilience row, not a state a user reaches.

### 6. Chart geometry, the readout's box, and the control's structure

6.1 **Geometry** (`lib/planChartGeometry.ts`). OQ-08's default is taken as the structural recommendation: the sun track sits INSIDE the existing plot on its own scale, so no lane is added and `planLanes` keeps its shape. The module gains:

- `PLAN_SUN_ZERO_FRAC` (the fraction of the plot's height at which the sun's zero line sits, measured from the top; the Designer sets it, 0.6 suggested) and `PLAN_SUN_TOP_DEG = 90`; `planSunDomain(): [min, max]` with `max = 90` and `min = -90 * f / (1 - f)`, the domain of a second Recharts `YAxis` (`yAxisId="sun"`, hidden) so the track's y mapping is the same arithmetic the geometry's `ySun(deg)` returns for the HTML siblings and the tests. The zero line is a stated reference in the legend or readout (FR-30); a drawn sun scale is the Designer's option.
- The without-tide plot may grow to hold the track: `PLAN_PLOT_NO_TIDE_PX` and `PLAN_WIDE_PLOT_NO_TIDE_PX` are the Designer's numbers; `planChartHeight(withTide, wide)` follows them unchanged in form, so the Suspense fallback reserves the exact final height in both tiers with and without tide (FR-32, QA-32). The 242 / 154 and 340 / 176 figures in the module's comments and in `planChartGeometry.test.ts` move with them.
- `tAt(px)`: the inverse of `x(t)`, `axisStart + (px - PLAN_GUTTER_PX) * secPerPx`, clamped to `[axisStart, axisEnd - 1]`; a press in the gutter (px below `PLAN_GUTTER_PX`) therefore reads the axis start (FR-15).
- `pickMarkerBox(g, t)`: `{ left: x(t), top: lanes.dayHeader + lanes.labels, height: lanes.plot }`, the plot's full height (FR-14).
- `revealScrollLeft(markerX, scrollLeft, clientWidth)`: the minimum new `scrollLeft` that puts the marker inside `[scrollLeft + PLAN_GUTTER_PX, scrollLeft + clientWidth]`, or the current value when it already is (FR-22).
- Density rules the track must respect: none of the existing ones change, and the track has NO density rule of its own: it is always the model's samples (FR-33), exactly as the tide curve is always the document's 30-minute samples. The label lane, the markers and every text rule are unchanged; the track is drawn beneath them (FR-30).

6.2 **The readout block is outside the chart box and its height is a function of width and text scale only.** It is a fixed block in `PlanResult` at rem sizes, rendered at rest together with the list before the chunk lands (FR-17), `aria-hidden` (FR-23). The structural constraint the Designer must honour: its rendered height must be identical at rest, on a full pick, on a no-tide pick and on a no-weather pick, at any width and text scale, without JavaScript measurement. The house shape recommended for that is a **stacked-variant grid**: the rest line and the full readout (every part present, the longest phrases) are both rendered into the same grid cell (`grid-area: 1 / 1`), the inactive one `visibility: hidden`, so the cell takes the tallest variant's height and a pick changes nothing about layout (QA-17). The pick therefore never reflows the list, the legend or the chart box; the chart box's height is unchanged by a pick because the marker is an overlay inside it (6.4).

6.3 **The control's structure (OQ-01, settled with the Designer).** The recommendation is the PRD's default, made concrete:

- The existing scroll container (`.sr-plan-scroller`), already the one tab stop with `tabIndex={0}`, changes role from `img` to **`slider`**, with `aria-orientation="horizontal"`, `aria-valuemin={pickBounds.min}`, `aria-valuemax={pickBounds.max}`, `aria-valuenow={pick ?? plan.fetchedAt}` (epoch seconds, a number as the role requires), `aria-valuetext={readoutValueText(...)}` (the four figures on a pick, the rest line at rest), and `aria-label` from `PLAN_COPY` stating the place, the window, that the arrow keys read any moment and that the details are in the list, with the no-tide variant saying no tide is shown (FR-23). A visually hidden span carries the estimate statement once and is referenced by `aria-describedby`, so it is read on focus and not on every change; its id is `useId()`-based, keyed on nothing from the document (NFR-01).
- Everything inside stays `aria-hidden` and `inert` (the 1.0.29 rule for decorative recharts). The slider therefore has no focusable descendants and no live region; the readout block is `aria-hidden`; nothing double-speaks (FR-23, QA-23).
- The tab-order guard is unaffected: `tabOrderCoverage.test.ts` rosters Button and Link call sites and raw `button` / `a` tags; a `div` with `tabIndex={0}` is outside its roster today (the Named Birds listbox is the precedent ACCESSIBILITY.md already explains), and this change keeps the same element with the same literal.
- One tab stop however many days (FR-19): the slider is one element; the marker and the readout add none; the day buttons and Days in view keep theirs.
- Keyboard contract: the Named Birds contract reused (one tab stop; arrows step; Home and End; Escape consumed only while a pick exists, by `stopPropagation`; Enter and Space unbound), with two stated differences: `ArrowUp` / `ArrowDown` are not bound (one lane), and **blur does NOT clear the pick** (FR-14 lists Escape, a new plan and replacement as the only clears; Named Birds clears on blur and this control deliberately does not).
- The arrow keys no longer scroll the box natively (`preventDefault` on the bound keys); drag, wheel, touch and the day buttons remain the routes to scroll without picking (FR-20).
- DOM ids: none keyed on data; the describedby id is the only one added.
- Visual choices (the marker's shape, the track's style and fill, the readout's layout, the Sun legend swatch, the words) are the Designer's.

6.4 **Where the state lives and what a pick re-renders.** The committed pick (`EpochS | null`) is `useState` in `PlanResult` (static): the readout block is there, it must render at rest before the chunk lands, and the pick must survive the override (the panel replaces the composed `plan` but keeps `PlanResult` mounted). It resets when the plan's identity changes: `useEffect` keyed on `(plan.fetchedAt, plan.lat, plan.lng, plan.tz)`, which the override leaves identical (the weather half is reused, so `fetchedAt` is the same) and a fresh plan changes (a new `fetchedAt`); a new plan or a replaced result also unmounts the region through the panel's phase switch, so the pick clears either way (FR-14). `PlanResult` derives `sunModel = useMemo(buildSunModel(plan), [plan])` and `readout = useMemo(planReadoutAt(...), [plan, pick, sunModel])`, renders the block, and passes the chart `pick`, `onPick`, `sunModel` (the chart samples the track with `sunTrack(model)` memoised on the model) and `valueText`. NFR-03's "re-renders neither the list nor the strip" is met structurally: the per-day list is a `memo` component whose props are `plan`, `sunModel` and the moon rows (all stable across a pick); the chart's Recharts tree is a `memo` child keyed on `(plan, g, sunSamples)`, and the **pick marker is an HTML overlay sibling** in the canvas positioned by `pickMarkerBox`, not a `ReferenceLine`, so a pick re-renders the marker, the slider attributes and the readout block and nothing else. The strip stays a `memo` on `(plan, g, wide)`.

6.5 **Pick versus drag (OQ-09), confirmed at 5 CSS px, and where the machine lives.** The pointer state machine is in `PlanChart.tsx` on the scroller's handlers; the threshold and the decision are the pure `PLAN_TAP_PX` / `isTap` in `planPick.ts` so a test sweeps them. The machine: on `pointerdown` record `{ id, pointerType, x0, y0, maxMoved: 0, tAtPress: tAt(clientX - rect.left + scrollLeft) }`. Mouse, primary button: `setPointerCapture` and the shipped one-to-one drag from the first pixel, no threshold, no easing, no snapping, nothing after release (D4-12 is byte-unchanged in behaviour); on every move `maxMoved = max(maxMoved, hypot(dx, dy))`. On `pointerup`: if `isTap(maxMoved)` commit `toPickInstant(tAtPress)` (the instant under the PRESS point, computed before any scroll) and `focus({ preventScroll: true })`; else nothing (a drag neither picks nor clears). Touch and pen: no capture and no drag handling (native scrolling stays theirs); `pointercancel` discards the press (a swipe or flick never picks); `pointerup` with `isTap` commits. `lostpointercapture` ends a mouse drag as shipped. A hover preview, if the Designer adds one (OQ-02), reads `tAt` on `pointermove` with no buttons down and previews only: it never calls `onPick`, never changes an aria attribute and never scrolls.

6.6 **The keyboard step's scroll is issued by the key handler, never by an effect.** The handler computes the next instant with `stepPick`, calls `onPick`, and then, with the geometry in hand, sets `scrollLeft` to `revealScrollLeft(x(next), scrollLeft, clientWidth)` with `behavior: reducedMotion() ? 'auto' : 'smooth'`. There is no effect on the pick state that scrolls, so a pointer pick (which also changes the state) cannot scroll, and nothing runs after a drag (FR-22, the 1.0.29 live-look lesson). `scroll-behavior` on the scroller stays as shipped.

### 7. Request budget and offline parity, as checkable invariants

| Invariant | Where it is checked |
|---|---|
| No new transport path; `TauriTransport.get` and `WebTransport` gain no match | transport tests unchanged; a grep-shaped guard in the panel test that the only `transport.*` calls on the plan path are the 1.0.29 four |
| No new `EBIRD_GATED_PATHS` or `CACHED_GET_PATHS` entry | the existing tables' tests; asserted unchanged |
| No new `replayStore` writer, no new `storage` read or write; the pick is never persisted | QA-16's spy: zero `storage.*` calls and zero `replayStore.put` across 50 picks, 50 steps, three Days in view changes and one Escape |
| A pick, a step, a clear, the track and the moon perform zero requests | QA-16's request spy after render; QA-13, QA-26 |
| One plan still makes exactly one OpenWeather and at most two NOAA requests; an override at most two NOAA | the 1.0.29 budget tests, unchanged |
| A plan stored by 1.0.29 renders all three layers identically online and offline | QA-39: a captured 1.0.29 pair (`/weather/plan` + `/tide/plan` replay entries) as a fixture, composed and rendered with the network mocked offline |
| `PRIVACY_POLICY.md` byte-identical | QA-43 |

The 1.0.29 request table (its section 4.5) gains one row: **Any interaction on the plan: 0 OpenWeather, 0 NOAA, 0 storage.**

### 8. Security declarations

Per `.claude/rules/security.md`, every new scan over content read back from `replayStore` (an unvalidated-on-load store; the merge guards the shape) is declared here with its primitive, its bound and its linearity argument. All inputs below are numbers the composer has already type-checked; no scan below reads a provider string.

| Scan | Input | Primitive | Bound and argument |
|---|---|---|---|
| `cellAt` | `Plan.cells` | one forward pass (or binary search) over ascending disjoint cells | `<= 112` per pick; linear, no nesting |
| `tideAtInstant` | `Plan.tide.curve`, `Plan.tide.bracketPoints` | `tideAtEvent`: two forward passes | `<= 448 + 64` per pick; the composer's own function, already swept in 1.0.29 |
| `buildSunModel` | `Plan.days` | per day: two bisections of at most 20 evaluations of a closed-form function | `<= 16` days, `<= 640` evaluations per plan, once per plan |
| `sunTrack` | the model | one pass over the quarter marks with a running anchor index | `<= 16 * 24 * 4 + 32 = 1,568` samples per plan (the window is at most 16 days by `PLAN_DAYS_MAX`); each sample `O(1)` with the running index; once per plan, never per pick or per density |
| `sunAltitudeAt` | the model | a binary search over `<= 32` anchors plus one evaluation | `O(log 32)` per call |
| `moonForDay` | `Plan.days`, `Plan.lat` | `moonPhaseEmoji` (closed form) plus `indexOf` over a constant array of 8 whose needle is the function's own output | `<= 16` per plan |
| `safeLocalClock` | `Plan.tz` (a string) | `Intl.DateTimeFormat` construction and one format, in a try | one per pick; the zone string reaches `Intl` as an option, never a scan of its characters; an invalid one throws once and is caught |
| the keys and the pointer | integers from the keyboard and pointer events | arithmetic | `O(1)`; the coordinates never leave the component |

No new regular expression; no `includes`, `indexOf` or `find` over a provider-derived or document-derived string needle (the one `indexOf` is over a constant array with an in-house needle); no lookup table keyed by an external string. **No new value is interpolated into any URL**: the feature makes no request. The rename touches no identifier, storage key, replay key or route (FR-04). `Plan.lat` / `Plan.lng` reach `Math` functions only. The Auditor's doubling check is owed on `sunTrack` at 8 / 16 days (flat past `PLAN_DAYS_MAX` because the composer caps `days`) and on one readout at the maximal family.

### 9. Guards, tests and the docs surface the Engineer owes

Guards (in addition to the per-module tests in the Migration Plan):

- **`entryChunk.test.ts`**: `has('lib/tzClock.ts')` becomes `true`, closure size 1, no externals; `has('lib/planSun.ts')`, `has('lib/planMoon.ts')`, `has('lib/planReadout.ts')`, `has('lib/planPick.ts')` all `true`, each closure reaching no transport, no storage, no chart library, no builder; `has('components/PlanChart.tsx')`, `has('lib/weatherPlan.ts')`, `has('lib/tidePlan.ts')` stay `false`; the chart closure still contains `recharts`; `PlanResult`'s closure still reaches no recharts, no maplibre, no transport and not `PlanChart`; the built entry preloads no `PlanChart` chunk.
- **`weatherTidePlanPublishedClaims.test.ts`**: `helpPassage()`'s anchor moves from `### Current and Predict` to the renamed heading (`### Current and Plan` suggested; the Designer's heading, but it must contain Plan and not Predict), asserted to exist; a rename claim per file (the passage names the entry Plan and never names it Predict, asserted non-vacuously per file; the word Predicted as the tide label stays legal); the four FR-45 claims as rows in the existing shape (the tap-or-arrow-keys readout from the plan not a fresh lookup; the sun's altitude drawn with sunrise and sunset where the plan lists them; each day's moon phase from the same computation as the checklist weather blocks; nothing ranked or recommended), each scoped to the passage, existence asserted first, the three files compared against each other, mutation-verified in three directions and restored byte-identical (FR-46, QA-41); claim 1 keeps reading the closing note's first sentence, which the rename does not change; the `ACCESSIBILITY.md` sentence gets its own row (OQ-07, QA-43).
- **`planContrast.test.ts`**: the new tokens present in both theme blocks, 3:1 against both bands in both themes.
- **`planPhoneRender.test.tsx`**: the golden regenerated deliberately; its diff reviewed and named in the changelog's pipeline record.
- **The anchoring invariant** (`planSun.test.ts`): for every fixture day with both events, `sunAltitudeAt(model, sunrise.t) === 0`, `sunAltitudeAt(model, sunset.t) === 0`, the sampled sign changes only at those minutes, the day's sampled maximum within one degree of `max(sunAltitudeDeg)` over that day.
- **The tide identity** (`plan.test.ts`): `tideAtInstant(e.t, plan.tide)` deep-equals `e.tide` for every event of every family.
- **The moon bounds** (`planMoon.test.ts`) and the golden rows on both sides (Migration step 4).
- **Zero requests per pick** (`WeatherForecastPanel.plan.test.tsx`, QA-16) and the 1.0.29 replay fixture (QA-39).
- **The em-dash rule** over every new string and every touched published paragraph (`planCopy.test.ts` and the claims guard).

Docs surface, swept in the same change, at paragraph scope, no em dash character anywhere:

| File | What changes |
|---|---|
| `docs/HELP.md` | the `### Current and Predict` heading; the Predict bullet; the Planner paragraph (the rename, "Press ... beneath Get specific forecast", the three additions in FR-45's words); the Map Explorer sentence naming "the Weather tab's Predict mode" |
| `README.md` | the Weather & Tide Lookup bullet (Current and Plan; the Planner clause; the FR-45 properties) |
| `website/index.html` | the two Predict mentions in the Weather article and the Planner paragraph; the version pill text and its `aria-label`; the footer version |
| `ACCESSIBILITY.md` | one sentence under the assistive-technology paragraph (OQ-07 default) with its guard row |
| `CHANGELOG.md` | the 1.0.30 entry naming the rename, the readout, the sun track and the moon phase |
| `frontend/package.json`, `src-tauri/tauri.conf.json` | 1.0.30 |
| `PRIVACY_POLICY.md` | read and left byte-identical |

The in-app help renders `docs/HELP.md` directly, so it needs no separate edit (FR-49); nothing in `frontend/src` anchors on the heading text except the claims guard.

### D-items

**D1. Incremental, on one in-memory field.** `Plan.tide.bracketPoints` is the difference between "the readout brackets like an event" being a property and being a coincidence. It is not stored, needs no parity row and no migration, and costs nothing at the replay budget.

**D2. No field added to a stored half.** The place's coordinates, the day boundaries, the listed events, the curve and the cells are already in the document; deriving keeps a 1.0.29 plan whole on replay and keeps FR-04's identifier freeze trivially true. If a later feature needs a stored field, the 1.0.29 rules apply: both twins, a fixture family, `composePlan` validation, and a document lacking it renders degraded.

**D3. A time warp anchors the sun, not an additive correction.** Subtracting a linear correction through the anchors' computed altitudes is simpler but shifts the day's peak by about the correction's size, which is around 0.8 degrees for a provider using the standard refracted horizon and can exceed one degree at low latitudes or on a synthetic fixture whose listed times are minutes from the geometric ones. The warp maps the listed daytime onto the computed daytime, preserving the computed maximum exactly, and the per-day side clamp makes the sign property structural. The additive form survives only as the constant-shift fallback where a computed crossing does not exist.

**D4. Geometric altitude, no refraction.** The anchors absorb the horizon convention: whatever convention the provider used for its sunrise, the track crosses zero there. A refraction model would only move the computed crossings the warp already reconciles.

**D5. The sun module is not twinned; the moon reuses the twinned function.** Section B.

**D6. `tzClock.ts` joins the entry graph** and 1.0.29 rule 13.1 is amended (section 5). The alternative, computing the picked minute's clock in the lazy chart and passing it up, would split one derivation across the chunk boundary to save about a kilobyte that an Intl conversion on the entry graph already costs.

**D7. Local noon from the day's boundaries.** The PRD asks for it; it is exact on every zone whose clock change precedes noon, which is every zone in the fixture and every US zone; the assumption is the same one the axis lane's ticks already make and is stated in the module.

**D8. The pick's maximum is the window's last whole minute.** Minute resolution is the PRD's rule for every instant; `window.endTs` is 23:59:59, so End picks 23:59 and the slider's maximum is that value. A Left from there aligns to 23:45.

**D9. Hour and day steps align first, then move the full step of real time.** One rule for both: an unaligned instant aligns in the step's direction (the quarter rule), then adds 3,600 or 86,400 seconds. From aligned 6:15 that is 7:15 and the same clock tomorrow (QA-20); from unaligned 6:07 it is 7:15 and 6:15 tomorrow. Every landing is on a quarter mark, so every landing is a drawn sun sample.

**D10. The slider role on the existing scroller.** OQ-01's default, because the axis is continuous and a listbox of virtual minutes would be thousands of options; the value is the epoch second and the value text carries the figures. The Designer settles the words and the marker; the structure above is fixed.

**D11. Blur does not clear the pick.** FR-14 enumerates the clears; the Named Birds control clears on blur and this one departs from it, stated so the reuse is not "corrected" back.

**D12. The marker is an HTML overlay, not a Recharts reference line.** So a pick re-renders no Recharts tree and NFR-03's re-render claim is structural; it also makes "full plot height" a geometry value rather than a chart-library behaviour.

**D13. The readout's height is a CSS property, not a measurement.** The stacked-variant grid (6.2) makes QA-17 hold at every width and text scale without JavaScript, the way the Named Birds readout holds its box.

**D14. `lat` / `lng` stay `0`-defaulted in the composer; the sun module validates range.** A pure function over an unvalidated document must be total, and the place to say so is the function, not a widened composer contract that every existing test would have to follow.

**D15. The version is 1.0.30.** One patch, the four-file set, the changelog naming the rename and the three additions.

### What the Engineer must not do

The 1.0.29 list (its section 13) stands, with item 1 amended per section 5. Added:

1. Do not compute a sunrise or sunset TIME from `planSun.ts` for any purpose, and do not let the track's crossings come from anything but the listed anchors.
2. Do not read One Call's `moon_phase`, and do not copy `moonPhaseEmoji` or its bounds; import it.
3. Do not bracket the readout with `tide.turningPoints`; use `tide.bracketPoints`.
4. Do not scroll from an effect keyed on the pick, and do not scroll from any pointer path.
5. Do not clear the pick on blur, on a Days in view change, on a resize, on a tier change or on the override.
6. Do not resample the sun track with density, and do not build it per pick.
7. Do not draw the pick marker or the track through a live region, a `role="status"` or an `aria-live` attribute anywhere in the plan region.
8. Do not add a DOM id keyed on a date, a station name or any document value.
9. Do not change `weatherFormatter.ts`, `backend/formatters/weather.py`, either stored half, either producer, the parity fixture, `replayStore`, `clearDerived.ts`, `CACHED_GET_PATHS` or `EBIRD_GATED_PATHS`.
10. Do not rename any identifier, route, DOM id, CSS class, setting key or replay key for the rename.

### Data layer summary

| Question | Answer |
|---|---|
| New tables / collections / migrations | None |
| Stored documents | Unchanged; a 1.0.29 plan replays whole and gains every layer by derivation |
| In-memory contract | `Plan.tide.bracketPoints` added by `composePlan` |
| Producers and parity | Untouched; no fixture row |
| `storage` seam, `replayStore`, `clearDerived.ts`, caches, gated paths | Untouched; a pick performs zero requests and zero storage reads |
| Entry chunk | `tzClock.ts`, `planSun.ts`, `planMoon.ts`, `planReadout.ts`, `planPick.ts` join (all dependency-free); the chart and the builders stay off |
| Twinning | Moon glyph: the existing byte-golden twin, reused; sun and readout: one runtime, not twinned, by design |
| Network, providers, keys | No change; no new destination, no value in a URL |
| `PRIVACY_POLICY.md` | Byte-identical |

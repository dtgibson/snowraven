# Schema -- Weather/tide Planner

**Feature:** tide-weather-planner
**Date:** 2026-09-12
**Stage:** 3 -- The Architect
**Path:** Frontend Only (no data layer; an integration design, as every prior weather feature)
**Source:** strategic-brief.md, prd.md (both approved)

---

## Architect assessment -- Frontend only

SnowRaven has no database, no ORM, no migration directory and no server-side
persistence for user data. The two prior weather features on this tab
(`weather-current-predict`, `species-detail-weather`) were classified Frontend
Only with an integration design written in this file's place, and this one is
too. The conservative question the stage asks is whether the PRD's offline
replay of a fetched plan (FR-43 to FR-46, NFR-08) needs a new durable store,
and the answer is no, for three reasons that are structural rather than
convenient:

1. **The plan rides the existing replay seam with no new document on disk.**
   Predict already stores its two halves (`/weather/at`, `/tide/at`) in
   `data/replay.json` through `transport.getReplayable`; the plan stores its two
   halves (`/weather/plan`, `/tide/plan`) through the same call, under the same
   300-entry / 3,000,000-code-unit budget, the same FIFO eviction, the same
   debounced ordered writer and the same purge generation. Nothing about the
   store changes: no new cap, no new validator, no new write path.
2. **The keys are coordinates, not user file content, so no `clearDerived.ts`
   row is owed, and the registry needs no argument beyond the one it already
   records.** CLAUDE.md's rule registers a store on where its KEYS come from.
   A plan key is `/weather/plan?lat=..&lng=..` -- a place the user picked on a
   map, never a submission id out of the export. `isChecklistDerivedReplayKey`
   already returns `false` for it (the segment after the prefix is `plan`, which
   is not a submission id), exactly as it does for `at`, so a Clear leaves the
   plan alone by the same mechanism that leaves Predict's lookups alone.
   `cacheInventory.test.ts` and `clearDerived.ts` are unchanged by this work.
3. **The stored plan is bounded by its producer, not by a store rule.** NFR-08's
   300,000-code-unit ceiling is a property of the composer's output (every array
   in the document is capped at the parse boundary and the worst case is
   arithmetic, section 6), so it is verified by a maximal-fixture test rather
   than enforced by a new per-entry cap in `replayStore`.

**No migration is required. No schema file changes. No new persisted document.
No `PRIVACY_POLICY.md` change beyond the one clause FR-57 already specifies.**

What follows is the integration design: two range routes, two twinned
composers, one client-side merge, one lazy chart chunk, and the constraints they
place on Stage 5.

---

## 1. The decision, in one paragraph

**Two new range-shaped routes, `GET /weather/plan` and `GET /tide/plan`, each
returning one HALF of the plan, composed by twinned pure builders on both
transports and joined on the client by one pure, entry-safe merge
(`composePlan`) that runs identically on every platform.** The weather half is
the plan's spine (the window, the events, the weather strip cells, the
day/night spans); the tide half is the curve and the turning points over a span
derived from `now` alone. The merge fills each event's tide reading from the
tide half and is the same function whether the halves arrived from a live
fetch, from the replay store, or from a forced override. Every timestamp in
both halves is an integer epoch second on one real-elapsed-time axis; every
NOAA request for the plan is made in GMT; every local clock string is computed
once, by the composer, in the location's timezone, and is display-only. The
single-moment `/weather/at` and `/tide/at` routes, their services, and
Predict's rendering are byte-unchanged.

Three things about that shape deserve saying up front because each diverges
from a default somewhere in the brief or the stage instructions, and each is
argued in section 12:

- The tide span is derived from **now**, not from the forecast's daily entries
  (D2). It is the only rule the override can reproduce without the forecast,
  and it is what lets the two provider calls run concurrently (NFR-07).
- The composition is split at the half boundary rather than done once
  server-side over the raw bodies (D1). The override (FR-33) must fill tide
  into a plan whose weather it does not refetch, so a merge exists on the
  client regardless; making it THE merge means one implementation rather than
  a server one plus a client one.
- The tide-plan route refuses without an OpenWeather key (D6), even though
  NOAA is keyless, so FR-41 is a property of the route rather than of a
  pre-flight the panel has to remember.

---

## 2. Architecture at a glance

Three layers, each mirroring what the Predict feature already has:

1. **Backend (FastAPI).** Two new handlers, one in each existing router,
   declared before the `{checklist_id}` routes: `GET /weather/plan` (one One
   Call request, then `build_weather_plan`) and `GET /tide/plan` (station
   selection and classification as today, then at most two NOAA range requests
   in GMT, then `build_tide_plan`). Two new pure service modules
   (`services/plan_weather.py`, `services/plan_tide.py`) plus one shared
   timezone helper (`services/tz_clock.py`) and one new fetch in
   `services/noaa.py`. Nothing else in the backend changes.
2. **Desktop (Tauri TypeScript services).** `getWeatherPlan` in
   `lib/tauri/weatherService.ts` and `getTidePlan` in `lib/tauri/tideService.ts`,
   twins of the two handlers, calling the TS builders `lib/weatherPlan.ts` and
   `lib/tidePlan.ts` (twins of the Python modules). `lib/transport.ts` gains two
   exact-path matches placed before the `/weather/` and `/tide/` prefix checks.
3. **Frontend UI.** The Predict form gains a second action; the panel fetches
   both halves with `transport.getReplayable`, joins them with `composePlan`
   from `lib/plan.ts` (entry-safe), and renders `PlanResult` (the header, the
   notices, the accessible list -- a static import) with `PlanChart` (Recharts,
   `lazy(() => import(...))`, the `PredictMap` mechanism) beneath it.

The existing checklist routes, `/weather/at`, `/tide/at`, `computeTideReading`,
`buildWeatherPayload`, `pickForecastSlice`, the formatters, and every Predict
rendering path are reused unchanged or untouched.

---

## 3. The plan document contract

### 3.1 Shape: two halves and one merge

There are three document types. Both transports produce the first two; the
client produces the third.

| Document | Produced by | Where | Stored for replay |
|---|---|---|---|
| `WeatherPlan` | `buildWeatherPlan` / `build_weather_plan` | Tauri service / FastAPI handler | Yes, under `/weather/plan?lat&lng` |
| `TidePlanResponse` | `buildTidePlan` / `build_tide_plan` | Tauri service / FastAPI handler | Yes, under `/tide/plan?lat&lng` (`force` stripped by `replayKey`, as today) |
| `Plan` | `composePlan(weather, tide)` in `lib/plan.ts` | The panel, on every platform | No -- recomputed from the two stored halves on replay, deterministically |

The UI renders `Plan` and nothing else. It never calls `pickForecastSlice`,
never parses a NOAA body, never computes a sunrise, never converts a timezone,
and never rounds a figure the document has not already placed on the axis.
The only arithmetic the UI performs is display formatting through the shipped
`ft()` (one decimal) and `formatDate()` (the user's date preference and the
app's clock style, FR-51), and the chart's own pixel mapping of `t`.

### 3.2 Common types

```
type EpochS = number            // integer seconds since 1970-01-01T00:00:00Z; never fractional
type LocalClock = string        // 'YYYY-MM-DD HH:MM' in the location's timezone; display only
type LocalDate = string         // 'YYYY-MM-DD' in the location's timezone
type Resolution = 'hourly' | 'daily'

interface PlanWeather {         // the reading Predict returns for the same moment, minus what the plan must not show
  resolution: Resolution        // Predict's 'current' collapses to 'hourly' (FR-17)
  emoji: string                 // conditionEmoji(owm.id), as Predict
  description: string           // capitalized owm description, as Predict
  tempF: number                 // bankersRound, as Predict
  highF: number | null          // non-null iff resolution === 'daily'
  lowF: number | null           // non-null iff resolution === 'daily'
  windDesc: string              // Beaufort word, as Predict
  windDir: string               // cardinal, as Predict
  cloudsPct: number
  humidityPct: number
  dewPointF: number
}
```

`PlanWeather` deliberately has no `moon`, `isNight`, `sunrise` or `sunset`
field. FR-20 forbids the moon glyph on the plan, and the safest way to keep a
future reader from rendering it by copying `WeatherSummaryView` is for the
field not to exist. Sunrise and sunset are the plan's own events, not a
per-reading string.

### 3.3 `WeatherPlan` -- the spine

```
interface WeatherPlan {
  tz: string                    // IANA name from the app's own resolver (get_timezone), as Predict
  lat: number                   // the validated inputs, echoed
  lng: number
  fetchedAt: EpochS             // the anchor: the moment of the fetch, on the fetching clock
  window: {
    startTs: EpochS             // === fetchedAt (FR-07); the plan starts at now
    startLocal: LocalClock
    endTs: EpochS               // end of the last calendar day the daily entries cover: next midnight - 1
    endLocal: LocalClock
    axisStartTs: EpochS         // start of the current hour in the location's tz (FR-07, chart axis)
    axisStartLocal: LocalClock
  }
  hourlyEndTs: EpochS           // last hourly entry's dt + 1800, or axisStartTs when there are no hourly entries
  days: PlanDay[]               // one per calendar date the daily entries cover, ascending; 1..16
  events: SpineEvent[]          // every sunrise/sunset with t > fetchedAt, ascending; 0..32
  cells: PlanCell[]             // the weather strip, contiguous and non-overlapping; 0..112
  nightSpans: Array<{ startTs: EpochS; endTs: EpochS }>   // clipped to [axisStartTs, window.endTs]; 0..17
}

interface PlanDay {
  date: LocalDate
  startTs: EpochS               // local midnight
  endTs: EpochS                 // next local midnight - 1 (a 23- or 25-hour day is that long)
  sunrise: { t: EpochS; local: LocalClock } | null   // null when the daily entry carries none (FR-10)
  sunset:  { t: EpochS; local: LocalClock } | null
}

interface SpineEvent {
  kind: 'sunrise' | 'sunset'
  t: EpochS                     // the One Call value, second resolution (FR-42; never computed)
  local: LocalClock
  date: LocalDate               // the PlanDay it belongs to
  weather: PlanWeather          // pickForecastSlice(onecall, t) via buildWeatherPayload(...).summary (FR-18)
}

interface PlanCell {
  resolution: Resolution
  startTs: EpochS               // hourly: max(axisStartTs, dt - 1800); daily: max(day.startTs, hourlyEndTs)
  endTs: EpochS                 // hourly: min(dt + 1800, hourlyEndTs) - 1; daily: day.endTs
  local: LocalClock             // hourly: the entry's dt; daily: the day's date at 12:00
  weather: PlanWeather
}
```

**Rules the builder enforces, each tested:**

- A sunrise or sunset value is PRESENT iff it is a finite number greater than
  zero. One Call reports polar days with `0` (and a malformed body may omit the
  key); both read as absent. The builder never substitutes `dt` for a missing
  value the way `dailyToHour` does for the copy block -- that fallback is right
  for a night-detection heuristic and wrong for an event list.
- `days` is keyed on `localDate(daily.dt, tz)`; two entries mapping to one date
  keep the first. `window.endTs` is the end of the LAST date. Fewer entries
  make a shorter window (FR-09); zero entries make no plan (the builder returns
  `{ ok: false, reason: 'no-daily' }` and the route answers with Predict's
  provider-error status and words, FR-39/FR-40).
- `events` are the present sunrise/sunset values with `t > fetchedAt`, from
  every day in `days`, sorted by `t`. An event that has passed today is not
  listed (FR-08). The builder never adds one from any other source.
- Each event's weather is `buildWeatherPayload(onecall, t, tz, lat).summary`,
  the shipped Predict function called as it stands, mapped to `PlanWeather`. So
  every figure equals Predict's for the same fixture and moment by
  construction (QA-17), including the rule that an event inside `NOW_SLACK` of
  `current.dt` reads the `current` block; the plan labels that reading
  `hourly` (FR-17).
- `cells`: one per hourly entry whose `[dt - 1800, dt + 1800)` intersects the
  axis, spanning exactly the interval Predict's nearest-hour rule assigns to
  that entry, clipped at `axisStartTs` and at `hourlyEndTs`; then one daily
  cell per day whose `endTs > hourlyEndTs`, starting at `max(day.startTs,
  hourlyEndTs)`, so the boundary day carries a partial daily cell and no
  instant is covered twice. The transition is the first cell whose resolution
  is `daily` (FR-26). The `current` block is not an hourly entry and gets no
  cell; an event within an hour of now may therefore carry the `current`
  reading while its cell shows `hourly[0]`'s -- stated, not a defect.
- `nightSpans`: for consecutive days, `[sunset(i), sunrise(i+1))`; a leading
  span `[axisStartTs, sunrise(0))` when `axisStartTs < sunrise(0)`, and a
  leading span from `axisStartTs` when `now >= sunset(0)` (FR-24); a trailing
  span from the last present sunset to `window.endTs`; a missing sunrise
  extends the running night to the next present sunrise, a missing sunset
  starts none; all clipped to the axis, empties dropped. When today's sunrise
  and sunset are both absent the leading segment is left unshaded -- the day
  row's two notes carry the truth and the plan infers nothing (stated limit).

### 3.4 `TidePlanResponse` -- the curve and the turning points

```
type TidePlanResponse =
  | { status: 'unavailable' }
  | { status: 'too-far' | 'outside-us'; station: { id: string; name: string }; distanceMi: number }
  | {
      status: 'ok'
      source: 'predicted'               // a literal; the plan makes no water_level request (FR-38)
      station: { id: string; name: string }
      distanceMi: number
      tz: string                        // same resolver as the weather half; composePlan asserts equality
      continuous: boolean               // true: curve samples come from the 6-minute series; false: subordinate station
      range: { startTs: EpochS; endTs: EpochS }   // the span fetched: [axisStartTs, tideEndTs]
      curve: TideSample[]               // ascending; every t a multiple of 1800; 0..PLAN_CURVE_MAX (432)
      turningPoints: TurningPoint[]     // ascending; every hilo point parsed within the widened span; 0..PLAN_HILO_MAX (64)
    }

interface TideSample   { t: EpochS; v: number; hilo: boolean }   // hilo: this sample was interpolated on the H/L curve
interface TurningPoint { kind: 'high' | 'low'; t: EpochS; v: number; local: LocalClock }
```

**Rules the builder enforces, each tested:**

- Both NOAA bodies pass through the shipped linear parsers (`parsePredictions`,
  `parseHiLo` and their Python twins) unchanged; the only new step is the GMT
  clock string to epoch conversion at the parse boundary (section 9).
- Caps are applied BEFORE any per-sample work: continuous points beyond
  `PLAN_CONTINUOUS_MAX = 4096` (17 days at six minutes; the request asks for
  nine) and hilo points beyond `PLAN_HILO_MAX = 64` are dropped after sorting,
  so a body that is larger than the request could produce bounds the work
  rather than the work being bounded by trust in the provider.
- `curve` is sampled at every `t` in `[range.startTs, range.endTs]` with
  `t % 1800 === 0`. Where a continuous point exists at exactly `t` (NOAA's
  six-minute grid lands on :00 and :30), the sample is that point with
  `hilo: false`. Where none exists -- a gap in the series, or a subordinate
  station that serves no continuous product at all -- the sample is
  `interpAtEpoch(t, turningPoints)` with `hilo: true`, the epoch-domain twin of
  `interpLevel`'s rule (prev = latest turning point at or before, next =
  earliest at or after, linear on the time fraction, equal times give prev's
  value, one side missing gives that side's value). Where the H/L series
  cannot place `t` either, there is no sample at `t`. NFR-03's "at most one
  point per 30 minutes" therefore holds by construction, not by downsampling
  after the fact.
- `continuous` is `true` iff at least one parsed continuous point fell inside
  `range`. A subordinate station is not an error (FR-32).
- `status: 'unavailable'` iff, after parsing, both series are empty. A partial
  response never blocks (FR-36, FR-37).
- `turningPoints` carries every parsed H/L point in the widened span, in and
  out of the plan window alike, because the merge needs the out-of-window ones
  for bracketing (FR-15). The merge decides which are drawn.

### 3.5 `Plan` -- what the UI renders

```
interface Plan {
  tz: string
  lat: number; lng: number
  fetchedAt: EpochS
  window: WeatherPlan['window']
  hourlyEndTs: EpochS
  days: PlanDay[]
  events: PlanEvent[]                   // SpineEvent & { tide: EventTide | null }
  cells: PlanCell[]
  nightSpans: WeatherPlan['nightSpans']
  tide:
    | { status: 'ok'; source: 'predicted'; station; distanceMi: number; continuous: boolean
        curve: TideSample[]             // trimmed to [window.axisStartTs, window.endTs]
        turningPoints: TurningPoint[] } // trimmed to the same; these are the markers and the listed turning points
    | { status: 'too-far' | 'outside-us'; station; distanceMi: number }
    | { status: 'unavailable' }
    | null                              // the tide half itself failed at the transport (offline with no replay); the panel keeps the error kind
}

interface EventTide {
  heightFt: number | null               // raw float; the UI prints ft() to one decimal (FR-13)
  heightSource: 'continuous' | 'interpolated' | null
  trend: 'rising' | 'falling' | null    // FR-14: by the kind of `next`; null when there is no next turning point
  prev: Bracket | null                  // latest turning point strictly before the event's minute (FR-15)
  next: Bracket | null                  // earliest turning point at or after the event's minute
}
interface Bracket { kind: 'high' | 'low'; heightFt: number; t: EpochS; local: LocalClock }
```

**`composePlan` rules, each tested in `plan.test.ts`:**

- `tide.status !== 'ok'` or `tide === null` gives `event.tide = null` for every
  event (FR-21) and passes the status through for the one notice at the top.
- Tide comparisons use the event's MINUTE, `m = t - (t % 60)`, because NOAA's
  clock is minute-resolved and FR-15 says a turning point at the event's own
  minute is the next bracket sharing its time.
- `prev` = latest turning point with `t < m`; `next` = earliest with `t >= m`;
  `trend` = `'rising'` if `next.kind === 'high'`, `'falling'` if `'low'`, `null`
  if no `next`. This is the PRD's rule (FR-14) and it is NOT
  `computeTideReading`'s window-delta rule; the two agree except inside a
  flat or turning hour, which is why the PRD states its own (D5).
- `heightFt`: let `a` = latest curve sample with `t <= m`, `b` = earliest with
  `t >= m`. If both exist, neither is `hilo`, and `b.t - a.t <= 1800`, the
  height is linear between them (`a.t === b.t` gives `a.v`) with source
  `'continuous'`. Otherwise it is `interpAtEpoch(m, turningPoints)` with source
  `'interpolated'`, or `null` with source `null` when there are no turning
  points at all. A subordinate station therefore yields `'interpolated'` for
  every event, exactly Predict's posture; a reference station with a gap at
  the event yields `'interpolated'` for that event only (FR-36).
- `tide.curve` and `tide.turningPoints` in `Plan` are the half's arrays
  filtered to `[window.axisStartTs, window.endTs]`; nothing past the window is
  drawn or listed (FR-11). Brackets keep their own copies, which may lie
  outside the window.
- `weather.tz === tide.tz` is asserted in development and the weather's wins in
  production; both halves come from one transport and one resolver, so a
  mismatch is a bug, not a state.

---

## 4. Routes and services

### 4.1 OQ-05 settled: two new range routes, `/at` untouched

The PRD's default stands: `GET /weather/plan` and `GET /tide/plan`. Extending
`/at` was rejected because `/at` is a single-moment contract keyed on `dt`,
shared with Current, replayed under a `dt`-bearing key, and byte-frozen by
FR-53; a range mode on it would either overload `dt` or add a parameter that
changes the replay key's meaning. The new paths cost nothing at the proxy
(`/weather` and `/tide` are already forwarded, the v0.5.34 post-mortem's own
fix) and they pass every existing guard by the same mechanism `at` does.

### 4.2 `GET /weather/plan`

```
GET /weather/plan?lat=<float>&lng=<float>
  lat: Query(..., ge=-90, le=90)     lng: Query(..., ge=-180, le=180)
  no other parameter is read; a window parameter of any name is ignored (FR-49, QA-45)
```

Handler, in `routers/weather.py`, declared BEFORE `/weather/{checklist_id}`:

1. No `OPENWEATHER_API_KEY` -> 500 with the exact detail `/weather/at` uses
   (`isNoKeyError` matches it; the panel shows Predict's no-key words).
2. `tz = get_timezone(lat, lng)`; `now_ts = int(time.time())` through a
   module-level `_now()` the tests freeze.
3. `onecall = await fetch_forecast(lat, lng)` -- the shipped call, the same
   request Predict sends, the same 10 s timeout, `raise_for_status` inside.
   Any exception (429, 5xx, timeout, malformed JSON) -> 502 with the exact
   detail `/weather/at` uses (`"Weather data unavailable for this location."`).
4. `build_weather_plan(onecall, now_ts, tz, lat)`; `ok: False` -> the same
   502 and detail (an empty daily array is a provider error, FR-40).
5. Return the `WeatherPlan` dict.

Zero NOAA requests on this route, on every path.

Desktop twin `getWeatherPlan(lat, lng)` in `lib/tauri/weatherService.ts`:
range-check the inputs (throw `{ status: 400 }` -- the twin of the route's
422; the panel has already refused them, FR-02), the shipped no-key throw
(`"OpenWeather API key not configured. Add it in Settings."`), `invoke('get_timezone')`
(tzf-rs), `fetchForecast` (shipped), `buildWeatherPlan`, and the shipped
`{ status: 502 }` throw for a failed fetch or an empty daily array.

### 4.3 `GET /tide/plan` -- OQ-06 settled: GMT

```
GET /tide/plan?lat=<float>&lng=<float>&force=<bool>
  same bounds as above; force defaults false and is the existing flag
```

Handler, in `routers/tide.py`, declared BEFORE `/tide/{checklist_id}`:

1. **No `OPENWEATHER_API_KEY` -> 500 with the no-key detail, before anything
   else.** NOAA is keyless and `/tide/at` needs no key; this route refuses
   because a tide half without a spine is not a plan, and FR-41 asks that no
   NOAA request be made when the plan cannot be built for want of that key.
   The guard is one line, holds for every caller, and needs no client
   pre-flight (D6). Its docstring says why it exists so it is not "fixed".
2. `tz = get_timezone(lat, lng)`; `now_ts = _now()`.
3. `nearest = nearest_station(lat, lng)`; `None` -> `{ status: 'unavailable' }`.
   `status = classify(lat, lng, nearest)`; not `'ok'` and not forced ->
   `{ status, station, distanceMi }` with NO NOAA request. Same list, same
   25-mile rule, same US test as Predict (FR-31).
4. `span = plan_tide_range(now_ts, tz)` (section 4.6).
5. `pred_body, hilo_body = await fetch_tide_range(station_id, span)` -- a new
   function in `services/noaa.py` beside `fetch_tides`: exactly two `_get`
   calls on the shared pooled client, gathered concurrently, each with
   `time_zone: 'gmt'` in its params (the `{**_BASE, **params}` spread already
   lets a call override the base's `lst_ldt`; nothing in `_BASE` changes),
   `product: 'predictions'` with `interval: '6'` over
   `[span.axisStartTs, span.tideEndTs]` and `interval: 'hilo'` over
   `[span.axisStartTs - 86400, span.tideEndTs + 86400]`, dates rendered as
   `YYYYMMDD HH:MM` in GMT. No `water_level` product (FR-38, QA-30).
6. `build_tide_plan(pred_body, hilo_body, station, distance_mi, tz, span)`.

Desktop twin `getTidePlan(lat, lng, force)` in `lib/tauri/tideService.ts`:
the same steps with `storage.getApiKey('openweather')` for step 1,
`invoke('get_timezone')` for the tz, the shipped `nearestStation` and
`classifyTideLocation`, two `getJson(noaaUrl({ ..., time_zone: 'gmt' }))`
calls in a `Promise.all` (the `{ ...base, ...params }` spread in `noaaUrl`
already overrides `lst_ldt`), and `buildTidePlan`. `getJson` swallows a
transport failure into `null`, so a NOAA outage reads as `'unavailable'`
rather than as a thrown error, exactly as Predict's does.

The single-moment `/tide/at` and `getTideAt` keep `lst_ldt` and their three
products, byte-unchanged (FR-53).

### 4.4 Transport matching order and the Tauri mirrors

In `TauriTransport.get`, two exact matches go ABOVE the existing
`path.startsWith('/weather/')` and `path.startsWith('/tide/')` checks, in the
same block as the `/at` matches and under the same NOTE comment, which is
extended to name `plan`:

```
if (path === '/weather/plan') { const { getWeatherPlan } = await import('./tauri/weatherService'); ... }
if (path === '/tide/plan')    { const { getTidePlan }    = await import('./tauri/tideService');    ... }
```

Neither path joins `CACHED_GET_PATHS` (section 6) nor `EBIRD_GATED_PATHS`
(not eBird-backed; the Nominatim and eBird pacing contracts are not involved,
confirmed). A transport test asserts that `/tide/plan` reaches `getTidePlan`
and never `getTide('plan')`, and a route test asserts that
`GET /tide/plan` with no parameters answers 422 (validation) and not the
400 `"That doesn't look like a valid eBird checklist ID."` that capture by
the id route would produce -- the discriminating form of the `/at` trap.

`frontend/vite.config.ts` already proxies `/weather` and `/tide`; the route
test reads the config and asserts both prefixes are present, so the v0.5.34
failure cannot recur silently.

### 4.5 Request budget (FR-47, QA-30)

| Action | OpenWeather | NOAA | Notes |
|---|---|---|---|
| Plan, station ok | 1 | 2 | weather and tide routes dispatched concurrently by the panel |
| Plan, too-far / outside-US | 1 | 0 | notice + override rendered |
| Plan, no OpenWeather key | 0 | 0 | both routes refuse before any request |
| Override (force) | 0 | 2 | `transport.get`, never `getReplayable` |
| Replay (offline) | 0 | 0 | both halves from the store |
| Any failure path | as above | as above | no retries anywhere on the plan path (NFR-07) |

There is no per-event and no per-day request by construction: neither route
takes a time parameter.

### 4.6 The tide span rule, and why it is derived from `now`

`planTideRange(nowTs, tz)` (twinned; `lib/tidePlan.ts` and
`services/plan_tide.py`) returns:

```
axisStartTs = startOfLocalHour(nowTs, tz)
tideEndTs   = localMidnightTs(localDate(nowTs, tz) + PLAN_TIDE_DAYS_AHEAD days, tz) + 86400 - 1    // PLAN_TIDE_DAYS_AHEAD = 8
continuous  = [axisStartTs, tideEndTs]
hilo        = [axisStartTs - 86400, tideEndTs + 86400]
```

That is: from the start of the current hour through the end of the eighth
calendar day after today, in the location's timezone -- nine calendar days,
one more than One Call's eight daily entries can reach. The forecast's window
(section 3.3) is always inside it for a conforming response; the merge trims
the tide arrays to the window. If a provider ever returned more daily entries
than that, the events past `range.endTs` would read `heightSource: null` with
the one-sided bracket wording, and the plan would still render (FR-37).

The stage brief described the span as "derived server-side from the forecast's
daily entries". It is not, for four reasons that compound (D2):

- **FR-49 forbids a caller-supplied window and FR-33 requires an override that
  refetches tide without refetching weather.** An override route cannot know
  the forecast's end, so a span that depends on it cannot be reproduced by the
  override. A span that depends only on `now` can, and the override's tide is
  then the same data over the same span as the original plan's.
- **NFR-07 requires the two provider calls to run concurrently.** A NOAA span
  derived from the One Call response serializes NOAA after OpenWeather.
- **FR-19's "the same turning points" is easier to keep when the H/L request is
  independent of the weather.** The widened H/L span is a function of the
  clock and the location, never of a response.
- **The cost is one extra day of six-minute points, fetched and trimmed** --
  about 240 points, some 10 KB on the wire, none of it stored.

The 24-hour widening of the H/L span is Predict's own (`shiftLocal(start,
-24)` / `shiftLocal(end, 24)`), kept for the parity of turning points; it
brackets every event on both sides for any US tide regime (the longest
turning-point gap, a diurnal high-to-low, is under 13 hours).

### 4.7 Subordinate stations and gaps

A subordinate station's continuous request returns a NOAA error body (`200`
with `{ error }`), which `parsePredictions` turns into an empty list. The
builder then interpolates every curve sample on the H/L curve and marks the
half `continuous: false`; the merge interpolates every event height the same
way. This is the shipped `interpLevel` rule in the epoch domain, applied
sample by sample rather than at two window ends (FR-32, QA-22). Nothing is
reported as an error. A reference station with a gap gets `hilo: true` samples
across the gap and `'interpolated'` for any event inside it (FR-36, QA-34).
Only when both series are empty is the half `'unavailable'` (FR-35, QA-33).

---

## 5. Time axis

**One axis, real elapsed time, integer epoch seconds.** Every `t` in every
document is `EpochS`. Nothing is compared, sorted, bracketed, interpolated or
placed by a clock string.

| Source | Native form | Placed on the axis by |
|---|---|---|
| One Call `dt`, `sunrise`, `sunset` | epoch seconds | used as-is (integers) |
| NOAA `t` in the range responses | `'YYYY-MM-DD HH:MM'` in GMT (the requests say `time_zone=gmt`) | `epochMin(t) * 60` on TS (already UTC calendar math); `_gmt_epoch(t)` on Python, a new helper with the same anchored fixed-width regex and an explicit `timezone.utc` |
| "now" | the fetching clock | `int(time.time())` / `Math.floor(Date.now() / 1000)`, passed INTO the builders as `nowTs` so fixtures fix it |

**The location's clock is display-only, and it is computed once, by the
composer.** `lib/tzClock.ts` and `services/tz_clock.py` are a new twin pair
that both builders use for every local string and every day boundary:

```
utcOffsetSec(ts, tz)      // Intl en-CA parts -> Date.UTC(parts) - ts        | zoneinfo utcoffset()
localClock(ts, tz)        // 'YYYY-MM-DD HH:MM'; Intl hour '24' reads as '00' | strftime
localDate(ts, tz)         // the first ten characters of localClock
startOfLocalHour(ts, tz)  // ts - (((ts + off) % 3600) + 3600) % 3600, off = utcOffsetSec(ts, tz)
localMidnightTs(date, tz) // guess = Date.UTC(date 00:00) - utcOffsetSec(guess); re-check the local clock and
                          // adjust at most twice; a zone whose midnight does not exist settles on the first
                          // existing instant, which is what zoneinfo's fold=0 also gives
```

Consequences the design relies on, each a parity-fixture row:

- **DST inside the window (FR-22, QA-21).** A day that gains or loses an hour
  has `endTs - startTs + 1` of 90,000 or 82,800 seconds, and the chart draws it
  that long because the chart maps `t`, never a wall clock. The local strings
  of the two 01:30s on a fall-back night are identical; no event or turning
  point can fall inside that hour and ALSO be ambiguous in the list (turning
  points are hours apart, sunrises are not at 01:30 outside the poles), so the
  document carries no zone abbreviation, which would otherwise be an
  ICU-versus-tzdata parity risk for nothing.
- **A far station under the override (FR-34, QA-32).** The station's own clock
  never enters: its predictions are requested in GMT and land on the same
  epoch axis as the location's sunrise. Every tide time in the list and on the
  chart is `localClock(t, tz)` for the LOCATION's tz.
- **The hour rule is the location's, not UTC's.** `startOfLocalHour` subtracts
  the zone offset before taking the modulus, so a half-hour zone gets its own
  hour boundary; on every US zone it coincides with the UTC hour boundary.
- **Day boundaries come from the composer.** `days[].startTs` are the local
  midnights the chart uses for its day ticks and the list may use for headings
  (OQ-07); the UI computes none of them.

**Byte-identical output across the twins** rests on: integer arithmetic for
every `t`; IEEE 754 doubles for every `v` with the SAME operation order in
both languages (`a.v + (b.v - a.v) * f`, `f` computed as one division); no
rounding anywhere in the builders (the UI rounds); and canonical
(sorted-key) JSON in the byte comparison, with deep equality as the primary
assertion.

---

## 6. Caching and replay

**Layer choice, per CLAUDE.md's pick-by-lifetime rule:** a plan is a
last-loaded result the user wants back when the signal drops, which is
`replayStore`'s contract (live-first, replay only on a connection-level
failure). It is not a repeat-call coalescer (`CACHED_GET_PATHS`, 90 s) and it
is not a long-TTL network cache (`countyCompletenessCache`, days). So:

| Path | `CACHED_GET_PATHS` | `getReplayable` | `EBIRD_GATED_PATHS` |
|---|---|---|---|
| `/weather/plan` | No | Yes (the panel's plan action) | No |
| `/tide/plan` | No | Yes (the plan action); **No** for the override, which uses `transport.get` with `force: '1'` | No |

Never both: a replayed plan must be the one the user last loaded, not a 90 s
coalesced copy, and a short-TTL layer in front of `getReplayable` would hand
the replay seam a value it never fetched. The comment block above each new
transport match says so, as the county and activity paths do.

**What the seam already gives the plan, unchanged:**

- Keys `replayKey('/weather/plan', { lat, lng })` and
  `replayKey('/tide/plan', { lat, lng })`: `networkCacheKey` rounds the
  coordinates to five decimals, so "the same place" (FR-43) is the same place
  Predict means; `force` is stripped, so a forced override could not split the
  key -- and the override never writes anyway.
- One pair of entries per place, overwritten by every successful fetch
  (FR-44's re-anchoring is a property of `put`'s upsert); FIFO among the 300
  with everything else; the debounced, ordered whole-document writer; the purge
  generation captured at the fetch chokepoint.
- Failures are never stored: a 500/502 is a `TransportError` with a status,
  `isOfflineError` is false, `getReplayable` rethrows without a `put`
  (FR-40, QA-37). A `{ status: 'too-far' }` tide half IS a successful GET and
  IS stored, so an offline replay re-shows the notice and the override, and
  the override then fails honestly offline (FR-45, QA-42) -- Predict's exact
  behaviour.
- A Clear leaves both keys alone: `isChecklistDerivedReplayKey` tests the
  segment after the prefix against `SUBMISSION_KEY_RE`, and `plan` is not a
  submission id. `replayClearSeam.test.ts` gains the two plan keys beside its
  existing `/weather/at` coordinate key so that this stays a tested property.

**A replayed plan is shown exactly as fetched.** The panel composes the two
replayed halves with the same `composePlan`; `fetchedAt`, `window`, `events`
(including any that have since passed) and every figure are the stored ones
(FR-43). Only a fresh fetch produces a new `fetchedAt`. The staleness cue is
the existing `StalenessCue` fed the replay entry's `loadedAt` through
`replayedAt`, the weather half's preferred when both replayed, as the panel
already does for Predict.

**The bound (NFR-08), enforced at one chokepoint.** The builders are the only
producers of the two halves, and every array they emit is capped at the parse
boundary: `days <= 16`, `events <= 32`, `cells <= 112`, `nightSpans <= 17`,
`curve <= 432`, `turningPoints <= 64`. Each cap is at least twice the shape a
conforming response can produce, so real data is never trimmed, and the worst
case is arithmetic: roughly 20 KB for the weather half and 16 KB for the tide
half at the field widths in section 3. `weatherTidePlanBound.test.ts` builds
the maximal fixture (eight full days, 48 hourly entries, a nine-day six-minute
series with H/L points every six hours) and asserts each half and their sum
serialize under 300,000 code units with the same `JSON.stringify(...).length`
measure `replayStore.put` records -- an order of magnitude of headroom, which
is margin rather than 2x. Nothing raw from either provider is stored: the
halves carry no `hourly`, no `daily`, no NOAA body.

A stored plan half is validated on load exactly as much as any other replay
entry is, which is to say not at all -- `replayStore` is the one durable store
with no per-entry validation, a stated roadmap item that this work neither
widens nor closes. `composePlan` therefore treats both halves as untrusted
documents: every array access is guarded, a missing or malformed field yields
`tide: null` or an empty list rather than a throw, and the panel's `tide:
null` branch renders the plan without tide.

---

## 7. Errors and honest states

The classification is Predict's, through `classifyLiveError`, and the words
are Predict's, taken from the panel's existing branches. Nothing new is
worded here; the Designer owns any new sentence (the closing note, the
one-sided bracket, the polar-day note, the no-tide chart name).

| Condition | Where it surfaces | Contract | Panel treatment (existing words) |
|---|---|---|---|
| No OpenWeather key | both routes, before any request | HTTP 500, no-key detail | `NO_KEY_MESSAGE` via `OfflineMessage`; no plan; zero NOAA requests (FR-39, FR-41) |
| Offline, replay hit | `getReplayable` | both halves with `replayedAt` | plan rendered from the stored halves + `StalenessCue` (FR-43) |
| Offline, no replay | `getReplayable` rethrows | connection-level error | `OFFLINE_MESSAGE`, or `BACKEND_DOWN_MESSAGE` on web/Pi with the device online (FR-39, QA-36) |
| OpenWeather 429 / 5xx / timeout / malformed | weather route | HTTP 502, provider detail | `"Weather is unavailable right now."`; never stored (FR-40, NFR-07) |
| Empty daily array | `build_weather_plan` -> route | HTTP 502, same detail | same as above (FR-09) |
| Short daily array | builder | shorter `window`, fewer `days` | plan renders to the last covered day (FR-09) |
| Missing sunrise or sunset on a day | builder | `PlanDay.sunrise` / `.sunset` null, no event | the day row states it; no time shown (FR-10) |
| No hourly entries | builder | `hourlyEndTs = axisStartTs`, every event and cell `daily` | the transition label sits at the axis start (FR-17) |
| Station too far / outside US | tide route, no NOAA call | `{ status, station, distanceMi }` | `tideTooFarNotice` + `tideOverrideLabel` once at the top; events carry no tide (FR-33, FR-21) |
| Both NOAA bodies unusable | `build_tide_plan` | `{ status: 'unavailable' }` | `"Tide is unavailable for this spot."` once at the top (FR-35) |
| Continuous absent, H/L present | builder | `continuous: false`, curve and heights interpolated | rendered as a plan with tide; no notice (FR-32) |
| Continuous gap at an event | merge | that event `heightSource: 'interpolated'` | rendered; the list may say "interpolated" if the Designer wants, never an error (FR-36) |
| No turning point on one side | merge | `prev` or `next` null; `trend` null when `next` is | the one-sided wording (FR-15) |
| Tide half fails at the transport while weather succeeds | panel | `Plan.tide = null` + the error kind | the plan renders; the tide slot shows the offline / error words, as Predict's does (FR-37) |
| Override fails | panel, identity-guarded | tide unchanged, error kind set | override's slot shows the words; the plan stays (FR-33, QA-31) |
| Late response after the user replaced the result | panel | dropped | a request token captured at dispatch, plus Predict's coord identity guard on the override (FR-06, QA-06) |

The 429 question the stage asks: neither route is eBird-backed, so the shared
`throwEbirdHttpError` / `_raise_ebird_http_error` mapper does not apply. The
weather precedent applies instead -- any non-2xx from OpenWeather, 429
included, becomes the provider-error 502, is shown in Predict's words, and is
never stored. NOAA has no 429 handling in the shipped code and gains none: a
non-JSON body parses to `null`/`None` and reads as `'unavailable'`.

---

## 8. The chart

**Lazy chunk, the `PredictMap` mechanism.** `components/PlanChart.tsx` is the
only module in this feature that imports `recharts`. `WeatherForecastPanel.tsx`
(a static import in `App.tsx`) reaches it only through
`lazy(() => import('./PlanChart').then(m => ({ default: m.PlanChart })))`
inside a `Suspense` whose fallback is a fixed-height placeholder, exactly as
the map. The list (`PlanResult.tsx`, static) renders as soon as the plan
arrives; the chart chunk resolving later never delays the figures (NFR-03).

**What `entryChunk.test.ts` gains (QA-54).** Paired, per the file's own
convention:

- negative: `has('components/PlanChart.tsx')` is `false`, and the existing
  "no chart library is reachable from App.tsx" assertion stays green;
- positive: `closureFrom(resolve(SRC, 'components/PlanChart.tsx')).externals`
  contains `'recharts'`, and `WeatherForecastPanel.tsx`'s source contains the
  literal `import('./PlanChart')`, so the guard cannot pass on a build where
  the chart was never wired;
- the entry-safe half: `has('lib/plan.ts')` is `true` (the merge is static) and
  `closureFrom(lib/plan.ts)` reaches no transport, no storage, no recharts, no
  maplibre -- the "dependency-light" shape the timeline lib modules assert.
  `lib/weatherPlan.ts` and `lib/tidePlan.ts` are reached only through the
  dynamically imported services and are asserted absent from the entry graph.

**Series and geometry.** The chart draws from `Plan` only:

- X axis: numeric, `type="number"`, domain `[window.axisStartTs, window.endTs]`,
  ticks at `days[].startTs` labelled with `formatDate(day.date)`; the DST day
  is drawn at its true length because the axis is `t`.
- Night shading: one `ReferenceArea` per `nightSpans[]` entry.
- Tide curve: `tide.curve` as a `Line` on `t`/`v`; `hilo: true` samples may be
  drawn differently at the Designer's option, and are not required to be.
- Markers: `events[]` (sunrise and sunset, distinct SHAPES, e.g. an open
  upward and a filled downward triangle, plus a text label) and
  `tide.turningPoints[]` (high and low, distinct shapes, plus a label), each a
  `ReferenceDot` at (`t`, `heightFt` or `v`); when tide is absent the event
  markers sit on the axis line (FR-25, FR-30).
- Weather strip: an HTML row beneath the plot, one cell per `cells[]` entry,
  each cell's width proportional to `endTs - startTs + 1` over the axis span,
  the first `daily` cell carrying the visible transition label (FR-26). The
  `current` block has no cell (section 3.3).
- Width: with OQ-02's 16 px minimum per hourly cell the strip needs about
  900 px on an eight-day plan; the chart therefore sits in its own
  `overflow-x: auto` container with a visible affordance and keyboard-reachable
  scrolling (OQ-03 default), and the page never scrolls sideways at 320 px or
  200 % (FR-29). The list never scrolls sideways.

**Accessibility.** The chart's root carries `role="img"` and an `aria-label`
built from the document -- the place label, `window.startLocal` and
`window.endLocal` through `formatDate`, that it shows the tide curve with
sunrise, sunset, high and low markers and a weather strip, and that the
details are in the list; when `tide.status !== 'ok'` the name says no tide is
shown (FR-28, QA-27). The SVG and the strip are `aria-hidden`. The list is the
accessible form: real list or table semantics, one item per event carrying
every figure as text -- and, because FR-27 and QA-26 require every strip
cell's condition to be in the list too, `cells[]` carries `local` and
`weather` so the list can render the strip as text (per day, or in a
collapsed details block; the Designer's call, flagged below).
`ChartViewTip` does not mount (OQ-04 default; its `ChartTipPage` union is
`'statistics' | 'species-detail'` and gains no member).

**Colour.** Every colour is a `var(--sr-*)` token in both themes. The
existing `--sr-graph-*` and `--sr-chart-*` families do not include a night
shade or a tide line, so the feature adds tokens (names the Designer's; e.g.
`--sr-plan-night`, `--sr-plan-tide`, `--sr-plan-sunrise`, `--sr-plan-sunset`,
`--sr-plan-high`, `--sr-plan-low`) defined in both theme blocks of
`globals.css`, with a contrast test of the `calendarContrast.test.ts` /
`countyContrast.test.ts` shape asserting the shading and the curve clear 3:1
against the chart ground in both themes (NFR-02, QA-53). Markers are
distinguishable by shape and label as well as hue, so no marker token is
load-bearing for meaning.

---

## 9. Scans over untrusted text

Per `.claude/rules/security.md`, every new scan over external strings is
declared here, before the build, with its linearity argument. The claim is
scoped to the modules this feature adds; the existing parsers it calls are
already swept.

| Scan | Input | Primitive | Bound |
|---|---|---|---|
| `_gmt_epoch(t)` (Python, NEW) and `epochMin(t)` (TS, shipped, reused) | NOAA `t` strings from the two range bodies | one anchored regex, `^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})`, fixed-width quantifiers, no alternation, no lazy quantifier, nothing that can fail after consuming a run; non-matches yield 0 and the point is dropped at the cap | linear in the string; strings are 16 characters from NOAA, and a hostile body's longer strings match or fail in the first 16 |
| `capitalize(description)` | One Call `weather[0].description` | the shipped `toLowerCase` + slice inside `summaryFromHour`, reached through `buildWeatherPayload` | linear; unchanged code |
| curve sampling and per-event bracketing | numeric arrays | sorted-array walks; a two-pointer merge for the 30-minute samples, a linear scan per event for brackets | `O(P + S)` for the curve and `O(E * (S + H))` for the merge, with `P <= 4096`, `S <= 432`, `H <= 64`, `E <= 32` fixed by the caps applied BEFORE any of this work |
| sorting the parsed points | numeric `t` | the runtime's sort on `<= 4096 + 64` numbers | `n log n` on a capped `n` |

There is **no** `includes`, `indexOf` or `find` over a provider-derived
needle anywhere on the path; every lookup table the merge builds is keyed on
`t` (a number) or is an array indexed by position; the station name and id
that appear in the documents come from the bundled station list (a build-time
asset, the v0.5.89 trust boundary), not from a provider response; and no
provider string is ever interpolated into a URL (the only values that reach a
provider URL are the validated coordinates, the bundled station id, the
literal product/interval/time-zone tokens, and dates the app derived from its
own clock -- FR-49, NFR-05).

The Auditor should still run the doubling check on the one new textual
primitive, `_gmt_epoch`, with a body whose `t` values are long near-miss
strings (a 40,000-character run that fails at the last character), and on
`build_tide_plan` / `buildTidePlan` at 10k / 20k / 40k points to confirm the
cap makes the work flat past 4,096 rather than merely linear.

---

## 10. Tests owed

**Twin parity (NFR-04, QA-44).** One shared fixture,
`frontend/src/lib/weatherTidePlan.fixture.json`, holding named families, each
with the raw inputs (`onecall`, `predBody`, `hiloBody`, `nowTs`, `tz`, `lat`,
`lng`, `station`, `distanceMi`, `force`) and the expected `WeatherPlan` and
`TidePlanResponse`. `weatherTidePlan.parity.test.ts` and
`backend/tests/test_weather_tide_plan_parity.py` each drive their SHIPPED
builders (never a retyped rule) and assert deep equality with the expected
halves and canonical-JSON byte equality, plus per-family non-vacuity (the
family really contains the shape it is named for). Families, at minimum:

1. reference station, continuous series, eight daily entries, `now` mid-day;
2. subordinate station (continuous body is a NOAA error object);
3. a window crossing a US DST change in both directions
   (`America/Los_Angeles`, `2026-11-01` and `2026-03-08`), with a turning
   point inside the repeated hour;
4. a far-station override whose station clock differs from the location's
   (the GMT bodies are the same; the family proves placement does not depend
   on any station clock);
5. a continuous series with a one-hour gap around a sunrise;
6. no hourly entries;
7. five daily entries;
8. a polar day (a daily entry with `sunset: 0`) and a polar night (`sunrise: 0`);
9. an empty daily array (the builder's `no-daily`), and a missing `daily` key;
10. `now` inside the current hour so the first event reads the `current` block;
11. an event at the same minute as a high (the next-bracket-shares-the-time rule);
12. the maximal fixture used by the bound test.

**`tzClock` parity.** A fixture of (`ts`, `tz`) rows over UTC,
`America/Los_Angeles`, `America/New_York`, `America/Anchorage`,
`Pacific/Honolulu` and `Asia/Kolkata`, including both DST transitions, the
fall-back hour's second pass, and a half-hour zone, asserting `localClock`,
`startOfLocalHour`, `localMidnightTs` and day lengths of 82,800 / 86,400 /
90,000 seconds. Both twins are driven from the same JSON.

**`plan.test.ts` (the merge).** Height from two continuous samples; height
interpolated across a gap; height interpolated for a subordinate station;
`null` with no turning points; `prev`/`next`/`trend` including the same-minute
case and the one-sided case; `tide: null` for every event when the status is
not `ok`; curve and turning points trimmed to the window; events past the tide
range; a malformed half does not throw.

**Route tests (Python).** `test_weather_plan.py`: no key -> 500 and the
detail; a mocked 429, a 5xx and a timeout -> 502 with the detail; empty daily
-> 502; `lat=91` -> 422; `/weather/plan` with no parameters -> 422, not the
checklist-id 400; a `start=`/`end=`/`days=` parameter changes nothing; the
mocked `fetch_forecast` is called exactly once and no NOAA fetch is called.
`test_tide_plan.py`: no key -> 500 and zero NOAA calls; too-far and outside-US
without force -> the notice shape and zero NOAA calls; with force -> two
calls; both bodies error -> `unavailable`; the recorded NOAA params carry
`time_zone == 'gmt'`, no `water_level` product, and begin/end dates derived
from a frozen `_now()` (never from a request parameter); exactly two calls.
The vite proxy assertion lives beside these on the TS side.

**Service tests (TS).** `getWeatherPlan` / `getTidePlan` with a mocked
`tauriFetch`: the same budget, GMT and no-key assertions as the routes; the
range-check throw; and a `transport.test` row proving `/tide/plan` reaches
`getTidePlan` rather than `getTide('plan')`.

**Replay.** `replayClearSeam.test.ts` gains the two plan keys as survivors of
`purgeChecklistReplay`; `weatherTidePlanBound.test.ts` (section 6); a
`getReplayable` test that a 502 leaves no entry and a subsequent offline call
rethrows (QA-37); and `cacheInventory.test.ts` is asserted unchanged.

**Entry chunk.** Section 8's paired assertions.

**Published claims (FR-55, QA-50).** `weatherTidePlanPublishedClaims.test.ts`
in the `weatherStatsPublishedClaims.test.ts` shape: three extractors scoped to
each file's own planner passage (anchored on the literal name `Weather/tide
Planner`), an existence assertion before every claim, four claims held to the
code (the window ends where the forecast ends; every sunrise and sunset in the
window is listed with its tide and weather; the plan ranks and recommends
nothing; a plan loaded once re-shows offline with a cue), the three files
compared against each other on the claim sentences, and the em-dash check.
Mutation-verified in the four directions before its first green is trusted.

**Panel and accessibility (QA-01 to QA-06, QA-28, QA-53).** FR-02's zero
requests; the loading `role="status"` and the ready announcement through the
existing live region; the result region's accessible name; the request token
and the coord identity guard; the override busy state; `Button` primitives for
the two new controls; `scrollWidth === clientWidth` at 320 px and 200 % with a
plan on screen, by the house method.

**Contrast.** The new tokens in both themes, section 8.

**Predict parity (QA-17, QA-18).** QA-17 is exact by construction and is
asserted by calling `buildWeatherPayload` on the same fixture. QA-18's "within
the range Predict shows" is NOT strictly guaranteed for any point reading --
Predict's window starts at the event and the plan's reading is at the event,
so on a monotonic tide the plan's value sits just outside Predict's
`[levelMin, levelMax]` by up to one six-minute step. The Tester should assert
the plan's height within Predict's range widened by the fixture's largest
six-minute change, or place the fixture's events on the six-minute grid; the
PRD's own flag anticipates exactly this.

---

## 11. Reuse map

**Reused unchanged:** `fetch_forecast` / `fetchForecast` (the One Call call);
`pick_forecast_slice` / `pickForecastSlice` and `build_weather_payload` /
`buildWeatherPayload` (every event's weather); `condition_emoji`,
`wind_description`, `cardinal`, `bankers_round` through them;
`nearest_station` / `nearestStation`, `classify` / `classifyTideLocation`, the
bundled station list, `TIDE_MAX_MILES`; `parse_predictions` /
`parsePredictions`, `parse_hilo` / `parseHiLo`, `is_noaa_error` /
`isNoaaError`; `epochMin` (TS); `interpLevel`'s rule; `noaaUrl` and `_BASE`
with their params spread; `get_client`; `tauriFetch` and its 10 s budget;
`get_timezone` on both sides; `transport.getReplayable`, `replayStore`,
`replayKey`, `isChecklistDerivedReplayKey`, `purgeChecklistReplay`;
`classifyLiveError`, `OFFLINE_MESSAGE`, `BACKEND_DOWN_MESSAGE`,
`NO_KEY_MESSAGE`, `OfflineMessage`, `StalenessCue`; `tideTooFarNotice`,
`tideOverrideLabel`; `ft`; `formatDate`; the `Button` primitive; the Predict
place picker (`PredictMap`, `forwardGeocode`, the lat/lng fields) as it
stands; the panel's live region, loading row, result region and override
identity guard; `entryChunk.test.ts`'s `closureFrom` / `has` helpers; the
`PredictMap` lazy-chunk mechanism; `vendor-recharts` in `vite.config.ts`.

**New, additive:** `GET /weather/plan`, `GET /tide/plan`; `fetch_tide_range`
in `services/noaa.py`; `services/plan_weather.py`, `services/plan_tide.py`,
`services/tz_clock.py` (with `_gmt_epoch`); `lib/weatherPlan.ts`,
`lib/tidePlan.ts`, `lib/tzClock.ts`, `lib/plan.ts` (types, `composePlan`,
`tideAtEvent`, `interpAtEpoch`); `getWeatherPlan`, `getTidePlan`; two
transport matches; `PlanResult.tsx` (static) and `PlanChart.tsx` (lazy); a
`Phase` variant and a request token in the panel; the plan action in the
Predict form; the new colour tokens; a shared `lib/forecastLabels.ts` holding
Predict's daily-summary wording so the plan's daily label and Predict's read
one constant (extracted, not copied -- Predict's output stays byte-identical);
the tests in section 10; the docs, changelog, version set and the FR-57
clause.

**Deliberately not touched:** `/weather/at`, `/tide/at`, `getWeatherAt`,
`getTideAt`, `fetch_tides`, `compute_tide_reading` / `computeTideReading`,
`format_tide` / `formatTide`, the copy block, Current, the checklist lookup,
`replayStore`'s caps and writer, `clearDerived.ts`, `cacheInventory.test.ts`,
`CACHED_GET_PATHS`, `EBIRD_GATED_PATHS`, `ChartViewTip`, `PRIVACY_POLICY.md`
except FR-57's clause.

---

## 12. Design decisions

**D1. Two half routes and one client-side merge, not one composed route.**
FR-33's override must fill tide into a plan without refetching the weather,
so a merge on the client exists in any design; a server-side composer as well
would be a second implementation of the per-event tide rule (Python for the
first fetch, TS for the override on web/Pi). One merge, in `lib/plan.ts`,
runs on every platform for every path -- live, replay, override. FR-48's
parity requirement is met where the transports actually differ: the two
halves, twinned and fixture-locked. Cost: the per-event figures are computed
in the browser rather than on the server, a few hundred comparisons.

**D2. The tide span is derived from `now`, not from the forecast.** Section
4.6. This diverges from the stage brief's phrasing and is required by FR-49,
FR-33 and NFR-07 read together.

**D3. Six-minute continuous predictions, sampled to 30 minutes at the
builder.** `interval=6` is the product and interval Predict already fetches
(FR-19's "the same predictions"); the builder keeps the samples at multiples
of 1,800 s, which NOAA's grid lands on exactly, so the curve is real predicted
points, not resampled ones. An hourly request would need synthesized :30
points; `interval=30`, if NOAA accepts it, would be a one-token change that
makes the response the curve, and is worth a live check during the build,
but the design does not depend on it. The event height between two 30-minute
samples is linear (worst case about 0.02 ft on a six-foot semidiurnal tide,
under the 0.1 ft the list prints), which is both smaller and more accurate
than the nearest six-minute point.

**D4. GMT requests, epoch axis, display-only local strings.** OQ-06's default,
taken; section 5 is the mechanism. `lst_ldt` strings are monotonic only within
one fixed-offset clock, and the plan's axis crosses DST and may span two
clocks under the override.

**D5. Trend from the next turning point, as the PRD states, not Predict's
window delta.** FR-14 defines it; `computeTideReading`'s rule is for a window
and the plan reads a point. They agree except inside a flat or turning hour.
Stated so the Tester does not treat the difference as a parity failure.

**D6. The tide-plan route refuses without an OpenWeather key.** A client
pre-flight through the `storage` seam would be one more network call on
web/Pi, would have to fall through when the seam itself fails (or replay would
never run), and is the class of thing the v1.0.20 "no network call" rule
warns is where such claims go wrong. The route guard is one line on each
transport, holds for every caller, and makes QA-38 structural. Its docstring
names the reason so the coupling is not removed as a tidy-up.

**D7. `PlanWeather` has no `moon`, `isNight`, `sunrise` or `sunset`.** FR-20.
A field that does not exist cannot be rendered by imitation.

**D8. Documents carry raw floats, integer epochs and one local string;
formatting is the UI's.** JS and Python round differently (`Math.round(x*10)/10`
versus banker's `round(x, 1)` on a binary float), so a rounded height in the
document would be a parity trap; the shipped `ft()` already prints one decimal
and `formatDate` already honours the preference. The composer never rounds.

**D9. H/L widening of 24 hours each side, from Predict.** Parity of turning
points and enough for every US regime.

**D10. `getReplayable` for the plan action, `transport.get` for the override,
neither path in `CACHED_GET_PATHS`.** Section 6, and Predict's exact split.

**D11. The stored bound is a producer property, tested on a maximal fixture,
not a new store rule.** Section 6. Adding a per-entry cap to `replayStore`
would touch a store FR-46 says the plan must not change.

**D12. Frontend Only.** The assessment at the top.

**D13. Both new routes range-validate with `Query(ge=, le=)`; `/weather/at`
and `/tide/at` keep their bare floats.** FR-49 governs the new routes;
FR-53 freezes the old ones; the v0.5.91 security note already records the
sibling inconsistency as deliberate and on the roadmap.

**D14. One tz helper pair for both builders.** The day boundaries, the hour
start and every local string come from `tzClock` / `tz_clock`, so the two
halves cannot disagree about what day an instant belongs to, and the panel's
existing `nowInTz` and the weather service's private
`parseLocalDateTimeInZone` are left exactly where they are.

---

## 13. What the Engineer must not do

1. **Do not compute a sunrise, a sunset, a day boundary or a local time in
   `PlanResult.tsx` or `PlanChart.tsx`.** Everything is in the document;
   the UI formats and maps to pixels, nothing more.
2. **Do not run NOAA in `lst_ldt` for the plan, and do not convert NOAA
   strings to local clock strings before bracketing.** Section 5.
3. **Do not derive the tide span from the One Call response or accept it
   from the caller.** D2; the override depends on it.
4. **Do not add `/weather/plan` or `/tide/plan` to `CACHED_GET_PATHS`,
   `EBIRD_GATED_PATHS`, or `clearDerived.ts`.** Sections 6 and the assessment.
5. **Do not use `getReplayable` for the override.** FR-45.
6. **Do not call `Date.now()` or `time.time()` inside a builder.** `nowTs`
   is a parameter; the route or service supplies it.
7. **Do not copy `', forecast for that day'` or the `FORECAST · DAILY` pill
   text into the plan.** Extract Predict's daily wording to
   `lib/forecastLabels.ts`, import it in both, and keep Predict's rendered
   output byte-identical (FR-17, FR-53).
8. **Do not round in the builders or the merge.** D8.
9. **Do not put `recharts` anywhere but `PlanChart.tsx`, and do not import
   `PlanChart` statically anywhere.** Section 8.
10. **Do not change `replayStore`, `computeTideReading`, `pickForecastSlice`,
    `buildWeatherPayload`, `noaaUrl`'s base, `_BASE`, `fetch_tides` or either
    `/at` handler.** FR-46, FR-53, NFR-10. The two spreads that let a plan
    call say `time_zone: 'gmt'` already exist.
11. **Do not fetch `water_level` for the plan.** FR-38.
12. **Do not remove the OpenWeather-key guard from `/tide/plan` or
    `getTidePlan` on the grounds that NOAA is keyless.** D6.
13. **Do not build per-option DOM ids from a date or a station name.** The
    list's ids are index-keyed (`.claude/rules/ui.md`, v1.0.21).

---

## 14. Data layer summary

| Question | Answer |
|---|---|
| New tables / collections | None |
| New columns / fields | None |
| Migrations | None |
| Persisted documents | None new; two coordinate-keyed entries in the existing `data/replay.json`, under its existing caps |
| `storage` seam writes | None new (the existing `replayStore.put` through `getReplayable`) |
| Durable cache documents | None |
| `clearDerived.ts` rows | None -- keys are coordinates, not export content; `isChecklistDerivedReplayKey` already excludes them |
| `CACHED_GET_PATHS` / `EBIRD_GATED_PATHS` | Unchanged |
| Worker payload fields | None (`StatsBundle` untouched) |
| Network calls / providers / keys | Same two providers, same key; two new range routes; one OpenWeather + at most two NOAA requests per plan, two NOAA per override |
| Backend changes | Two handlers, three pure modules, one fetch function |
| `PRIVACY_POLICY.md` | The one NOAA clause FR-57 specifies; nothing else |
| Entry chunk | `lib/plan.ts` joins it (dependency-free); the chart and the builders stay off it |

The feature's entire data footprint is two replay entries per place, each a
bounded, computed document, written and evicted by a store this work does not
change.

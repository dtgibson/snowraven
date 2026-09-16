# Bug Brief — Tide At Bad Request

## What is broken

`GET /tide/at` has **no validation of the `dt` it is asked about**, where its
sibling `/weather/at` has had one since 0.5.34. Measured over 32 `dt` shapes at
HEAD: the backend answers a **plain-text HTTP 500** on 8 of them, a
mis-worded 502 on 1, and 200 on the rest -- several of those 200s carrying a
confident water level for a moment nobody asked about. The desktop twin
`getTideAt` never crashes and is worse for it: `Date.UTC` **rolls** an
impossible calendar value into a real instant where Python raises, so
`?dt=2024-05-01 99:00` renders `Water level: 0.4 - 5.6 ft · Rising (turned
during your checklist)` where the hour actually asked for reads `2.3 - 3.0 ft ·
Falling`. **And the reference the idea points at does not exist as stated:**
the two *weather* runtimes diverge on 26 of those same 32 shapes. The backend
half of `/weather/at` is the reference; the desktop half is a third instance of
this defect.

## Steps to reproduce

Deterministic, no user input, no network. Probe scripts ran from this session's
scratchpad and are not committed; every table below was measured at HEAD by
driving the real routes and the real services with the provider seams doubled.
NOAA's verbatim refusal text was captured once from the live keyless API.

- **Backend:** `TestClient(app, raise_server_exceptions=False)` +
  `patch("routers.tide.nearest_station")` + `patch("routers.tide.fetch_tides")`,
  then `GET /tide/at?lat=32.87&lng=-117.26&dt=<shape>`. Run twice: once with a
  NOAA double that answers regardless of the date (isolates the route), once
  with a double that rejects an implausible `begin_date` the way the live
  service does (models the shipped path).
- **Desktop:** vitest over the shipped `getTideAt` / `getWeatherAt` with only
  `tauri/http`, `storage` and `@tauri-apps/api/core` doubled -- the seam set
  `atRouteServices.test.ts` already uses.
- **Render:** `computeTideReading` + `formatTide` over a 5-day 30-minute
  predicted curve, which is what the copy block a user pastes into a public
  eBird checklist is built from.

Sharpest single row -- `GET /tide/at?lat=32.87&lng=-117.26&dt=2024-05-01 99:00`
answers **`500 Internal Server Error`**, plain text, before any NOAA request.
The same value on desktop answers **`200 ok`** with a four-day water-level range
presented as a one-hour reading.

## Expected behavior

A `dt` that is present but is not a readable `YYYY-MM-DD HH:MM` or `YYYY-MM-DD`
wall clock is **refused identically on both runtimes, before any NOAA request**:
HTTP **400** / `{ status: 400 }` carrying `/weather/at`'s existing sentence,
`"That doesn't look like a valid date and time."` An **absent or empty** `dt`
remains "now in the LOCATION's timezone" on both -- the backend already does
this and the desktop twin never has. An impossible calendar value is refused
rather than rolled over, so no window is ever derived from a moment the caller
did not name. Nothing crashes, and nothing answers a different moment than the
one it was asked about.

## Blast radius

Four functions, two per runtime, all on the request boundary:
`backend/routers/tide.py:171-180` (`get_tide_at`),
`frontend/src/lib/tauri/tideService.ts:122-124` (`getTideAt`),
plus the weather twin that must move with them --
`frontend/src/lib/tauri/weatherService.ts:244` (`parseLocalDateTimeInZone`, called
outside the try) against `backend/routers/weather.py:79-89` (the reference). One
transport line is implicated: `frontend/src/lib/transport.ts:118` passes
`params?.dt ?? ''` where the weather branch at `:97` passes `params?.dt`
through as `undefined`. **The divergence is at the route/parameter boundary,
not in parsing and not deeper** -- `parse_observed` / `parse_predictions` /
`parse_hilo` and their TS twins are sound, and `compute_tide_reading` renders
faithfully whatever window it is handed. The deeper helpers
(`shift_local` raising where `shiftLocal` rolls over) are the *mechanism* of the
two different wrong answers, not the missing thing.

Failure paths and one shipped-but-broken path (desktop Current tide) only. No
route signature, no new outbound host, no user-facing copy (see "the 400's
detail never reaches the screen" below), so `PRIVACY_POLICY.md` and the website
are unaffected. One build in a bundled Spool release -- no version bump, no
`CHANGELOG.md`.

## What done looks like

Checkable by automated tests on both runtimes, from one shared shape roster the
way `test_tide_epoch_parity.py` pins its twins. The agreed behaviour is:

1. **A present-but-unreadable `dt` is refused with a stated status and shape on
   both sides.** Backend `/tide/at` → **HTTP 400**, body
   `{"detail": "That doesn't look like a valid date and time."}`, byte-identical
   to `/weather/at`'s existing refusal and single-sourced from one constant so
   the two cannot drift. Desktop `getTideAt` → **rejects** with
   `{ status: 400, message: "That doesn't look like a valid date and time." }`,
   the `assertCoordinateRange` shape at `weatherService.ts:271-275`, so
   `isOfflineError(err)` is **false** (it is `true` today -- measured).
2. **Zero NOAA requests on the refusal path**, asserted as
   `fetch_tides.call_count == 0` and `seams.fetch` not called -- the
   `CHECKLIST_ID_RE` posture (`DECISIONS.md:800-810`): the guard is the
   handler's first act, before any outbound call.
3. **Every shape in the roster answers the same verdict on both runtimes**, and
   the impossible-calendar rows answer **400**, not 500 and not a rolled-over
   reading. Specifically: `2024-13-01 12:00`, `2024-05-45 12:00`,
   `2024-05-01 99:00`, `2024-05-01 12:99`, `2024-04-31 12:00`,
   `2024-02-30 12:00`, `0000-00-00 00:00` and `9999-12-31 23:59` are 400 on both,
   where they are 500 / 500 / 500 / 500 / 500 / 500 / 500 / 500 on the backend
   and `200 ok` on the desktop today.
4. **An absent or empty `dt` resolves "now" in the LOCATION's timezone on both
   runtimes**, asserted on the outbound `begin_date`: it matches
   `^[0-9]{8} [0-9]{2}:[0-9]{2}$` and is never the blank `" "` the desktop
   sends today. This preserves `DECISIONS.md:2216` and `PRODUCT_CONTEXT.md:384`
   ("`/tide/at`'s `dt` is optional, defaults to location-tz now").
5. **No malformed `dt` can produce a `status: "ok"` reading on either runtime.**
   A row asserting `?dt=2024-05-01 99:00` never yields a `formatted` string
   containing `Water level`, and a row asserting the copy block for a refused
   moment is never produced at all.
6. **The weather twin converges on its own backend half**: desktop
   `getWeatherAt` with each unreadable `dt` rejects with `{ status: 400 }` and
   `isOfflineError` false, where 17 of 32 shapes throw status-less today and are
   read as "you're offline" while the device is online.
7. `backend/.venv/bin/python -m pytest tests/ -q` green and `ruff check .`
   clean; `cd frontend && npm run build` green. `test_tide_at.py`,
   `test_at_route_containment.py`, `test_tide_epoch_parity.py`,
   `atRouteServices.test.ts`, `tide.test.ts` and `tideEpoch.parity.test.ts` stay
   green **unchanged** -- every one of them drives a conforming `dt`, so a
   refusal-only change cannot move them. If any moves, the change has altered a
   well-formed path and is wrong.

---

## This build is the REQUEST. The next build is the RESPONSE.

The two are adjacent and must not blur, so the line is drawn on **whose string
it is**:

| | This build (`tide-at-bad-request`) | The next queued idea |
|---|---|---|
| The string | `dt`, the **caller's** query parameter | `t`, a **NOAA** timestamp in the response body |
| Where it enters | `routers/tide.py get_tide_at` / `tideService.ts getTideAt` | `parse_observed` / `parse_predictions` / `parse_hilo` |
| The defect | no validation → a 500, or a window for a moment nobody asked about | `_epoch_min` / `epochMin` return **`0.0`** for an unreadable `t`, and `interp_level` builds a confident level from it |
| Where it is fixed | the route/parameter boundary, before any NOAA request | `backend/services/tide.py:113-120` and its TS twin, at the sentinel |

**In scope here:** the `dt` parameter, the two helpers it flows into
(`normalize_obs_dt` / `shift_local` and their twins) *as the mechanism to
describe*, and the outbound `begin_date` those produce.
**Out of scope here, explicitly:** the `0.0` sentinel, `interp_level`'s divisor,
and anything about what NOAA sends back. That is finding **F1** of
`pipeline/tide-timezone-parse/security-report.md`, and it is the next build's
subject -- whoever takes it should read F1 and
`at-route-try-containment`'s silently-wrong half first.

Neither build closes the other. Refusing a bad `dt` narrows *which* windows are
requested; it does nothing about a station that answers a good window with an
unreadable `t`. Conversely, treating an unreadable `t` as missing would not have
stopped the 500, which fires before NOAA is called at all.

## Is this a residue of the three predecessors? Yes -- of one, by name, with its reversal condition already written

- **`at-route-try-containment`: this is its decision 4, deferred verbatim.**
  That decision is titled "`GET /tide/at?dt=<malformed>` is a REAL, measured 500
  that this build deliberately does NOT fix", carries the same measured table,
  and sets the gate: *"Take it in the same build that decides whether the TS
  date helpers refuse, so both transports move together."* It names the fix and
  its location -- the guarded parse from `routers/weather.py:79-89`, plus the
  matching refusal in `getTideAt`. `ROADMAP.md:47` and `DECISIONS.md:23` both
  carry the item. **The reversal condition is met by this build's scope**: it
  moves both transports.
  The residue is visible in the diff. `677e550` wrapped
  `normalize_obs_dt` / `shift_local` in a `try` for `/tide/{checklist_id}`, with
  a comment naming the exact mechanism (*"shift_local (which raises on an
  impossible calendar value)"*) -- and left the identical two calls in
  `get_tide_at`, one function above in the same file, uncontained.
- **`tide-timezone-parse`: partly.** Its finding **F2** is open and is on a
  helper this build must touch: `shift_local` (`backend/services/tide.py:220`)
  still uses `\d`, which in Python matches every Unicode decimal digit, while
  the TS twin's `\d` is ASCII-only. Independently reproduced here:
  `٢٠٢٤-٠٥-٠١ 12:00` shifts to `2024-05-01 13:00` on Python and returns
  unchanged on TypeScript. Its explicit-UTC-axis pattern does **not** transfer
  (that is about the response `t`); what transfers is its fixture discipline --
  rows that SEPARATE the twins, not only rows they agree on.
- **`weather-at-malformed-parity`: not a residue, but its conventions bind.**
  Different string (a provider figure, not a request parameter) and different
  layer. `isFiniteFigure` / `is_finite_figure` are **numeric-only** by contract
  and cannot be reused for a wall-clock string -- do not invent a third spelling
  *of them*; do copy their **shape**: one twinned predicate, defined once per
  runtime, imported by both consumers.

## The reference, checked rather than assumed: it does not agree

The idea says "the matching weather lookup politely says the request was bad."
**That is true of the backend and false of the desktop.**

| | Backend | Desktop |
|---|---|---|
| Where | `backend/routers/weather.py:79-89` | `frontend/src/lib/tauri/weatherService.ts:244` → `:103-110` |
| What it does | two `strptime` formats, then `HTTPException(400, "That doesn't look like a valid date and time.")` | `parseLocalDateTimeInZone`, **no guard**, **outside the try** (the try starts at `:259` and covers the builder only) |
| Malformed `dt` | **400** | status-less `TypeError` / `RangeError` |

Over the same 32 shapes: **26 diverge.** Only the 6 well-formed / absent / empty
/ extreme-but-parseable rows agree.

| Direction | Rows | Meaning |
|---|---|---|
| Both accept | 6 | already agreed (all conforming or absent) |
| Backend **400**, desktop throws **status-less** | 17 | same verdict, wrong shape -- and `isOfflineError` returns **`true`** for both the `TypeError` and the `RangeError` (measured), so the panel says *you're offline* while the device is online and the request never left the machine |
| Backend **400**, desktop **silently accepts a wrong moment** | 9 | the verdict INVERTED -- `Date.UTC` rolls `month 13`, `day 45`, `hour 99`, `minute 99`, `Feb 30`, `0000-00-00`, a negative year and `year 99999` into real instants and answers a forecast for them |

That "you're offline" sentence is precisely the false statement
`at-route-try-containment` existed to remove, still live on the
*request-parameter* side of both `/at` routes because the parse sits outside the
`try` that build added. **So the spec is the backend half of `/weather/at`, and
the desktop half of `/weather/at` is a third site that must move with the two
tide sites** -- otherwise the Weather/tide panel shows *bad date* for the tide
half and *you're offline* for the weather half, from the same `dt`, on the same
screen.

## 1. What "crashes" means, per runtime -- the exact observable

**Backend** -- an uncaught `ValueError` / `OverflowError` out of
`shift_local`, surfacing as FastAPI's plain-text `500 Internal Server Error`
(no JSON, no `detail`, no traceback in the body). It fires at
`routers/tide.py:180` (`end = shift_local(start, 1)`), which sits **outside**
`_resolve_tide_at`'s `try`, so it happens before any NOAA request:

| `dt` | Raise | Route |
|---|---|---|
| `2024-13-01 12:00` | `ValueError: month must be in 1..12` | **500** |
| `2024-05-45 12:00`, `2024-02-30 12:00`, `2024-04-31 12:00` | `ValueError: day is out of range for month` | **500** |
| `2024-05-01 99:00` | `ValueError: hour must be in 0..23` | **500** |
| `2024-05-01 12:99` | `ValueError: minute must be in 0..59` | **500** |
| `0000-00-00 00:00` | `ValueError: year 0 is out of range` | **500** |
| `9999-12-31 23:59` | `OverflowError: date value out of range` | **500** |
| `0001-01-01 00:00` | `OverflowError` -- but from `shift_local(start, -24)`, which is *inside* the try | **502** `"Tide data unavailable for this location."` |

That last row is its own small defect: it blames NOAA, in NOAA's words, for a
value the caller supplied and that never reached NOAA.

**Desktop** -- **nothing throws.** `Date.UTC` accepts every out-of-range
component and rolls it over, so `shiftLocal` returns a real, valid, *different*
moment. The observable is a rendered wrong answer, not an error:

| `dt` | Window actually used | Rendered |
|---|---|---|
| `2024-05-01 12:00` (control) | `12:00` → `13:00` | `Water level: 2.3 - 3.0 ft` · `Tide: Falling` |
| `2024-05-01 99:00` | `99:00` → **`2024-05-05 04:00`** | `Water level: 0.4 - 5.6 ft` · `Tide: Rising (turned during your checklist)` |
| `2024-13-01 12:00` | → `2025-01-01 13:00` | `Water level: 5.6 ft` · `Tide: Falling` |
| `garbage`, `''` | `''` → `''` | `Water level: 5.6 ft` · `Tide: Rising` |

`hour 99` survives even a NOAA that rejects bad dates, because the high/low
request is built from `toNoaaDate(shiftLocal(start, -24))` -- a **valid**
rolled-over date -- so NOAA answers it and `computeTideReading` builds a reading
from the high/low alone: `Water level: 5.2 ft · Tide: Falling · Previous high:
5.2 ft at 3:00pm`. A confident, plausible, entirely wrong reading, and it reaches
the copy block a user pastes into a public eBird checklist.

**And one shape is broken on the everyday path, today, on desktop and iOS.**
`transport.ts:118` routes an absent `dt` as `getTideAt(lat, lng, params?.dt ?? '')`,
and `getTideAt` has **no "now" fallback at all** -- so `normalizeObsDt('')` is
`''` and `toNoaaDate('')` is `" "`, a single space, sent to NOAA as
`begin_date`. The live API answers
`{"error": {"message": " Wrong Date: The requested begin/end date or range are not valid. "}}`
(captured 2026-09-16), which parses to no points, so `computeTideReading` returns
`null` and the panel gets `{ status: "unavailable" }`. The backend does the
right thing here (`datetime.now(get_timezone(lat, lng))`). The reachable caller
is `WeatherForecastPanel.tsx:330`, whose own comment reads *"No dt for either
call: both resolve 'now' in the LOCATION's timezone"* -- true on web/Pi, false
on desktop since 0.5.34 (`a0cafa5`). This is not in any decision or ROADMAP
line.

## 2. The shapes of a badly formed moment, and who mishandles each

32 shapes, measured on both runtimes. `T` = tide, `W` = weather.

| Shape | `T` backend | `T` desktop | `W` backend | `W` desktop |
|---|---|---|---|---|
| conforming `YYYY-MM-DD HH:MM` | ok | ok | 200 | ok |
| conforming `YYYY-MM-DD` | ok | ok | 200 | ok |
| **absent** | ok (now) | **blank date → unavailable** | 200 | ok (now) |
| **empty string** | ok (now) | **blank date → unavailable** | 200 | ok (now) |
| whitespace only | unavailable | unavailable | **400** | throws |
| non-numeric word (`garbage`) | unavailable | **wrong reading** | **400** | throws |
| wrong separator (`2024/05/01`) | **wrong reading** | **wrong reading** | **400** | throws |
| ISO with `T` | **wrong reading** | **wrong reading** | **400** | throws |
| **month 13** | **500** | **wrong reading** | **400** | **accepts (rolled)** |
| **day 45** | **500** | **wrong reading** | **400** | **accepts (rolled)** |
| **hour 99** | **500** | **wrong reading** | **400** | **accepts (rolled)** |
| **minute 99** | **500** | **wrong reading** | **400** | **accepts (rolled)** |
| **day 31 of a 30-day month** | **500** | **wrong reading** | **400** | **accepts (rolled)** |
| **Feb 30** | **500** | **wrong reading** | **400** | **accepts (rolled)** |
| **all zeroes** | **500** | **wrong reading** | **400** | **accepts (rolled)** |
| year `0001` (min edge) | **502, wrong words** | **wrong reading** | 200 | accepts |
| **`9999-12-31 23:59`** (max edge) | **500** | **wrong reading** | 200 | accepts (out-of-range) |
| year `99999` | unavailable | **wrong reading** | **400** | **accepts (rolled)** |
| negative year | unavailable | **wrong reading** | **400** | **accepts (rolled)** |
| **epoch SECONDS** (wrong unit) | unavailable | **wrong reading** | **400** | throws |
| **epoch MILLISECONDS** (wrong unit) | unavailable | **wrong reading** | **400** | throws |
| `NaN` literal | unavailable | **wrong reading** | **400** | throws |
| `null` literal | unavailable | **wrong reading** | **400** | throws |
| non-numeric fields (`abcd-ef-gh ij:kl`) | unavailable | **wrong reading** | **400** | throws |
| **unicode digits (Arabic-Indic)** | **wrong reading** | **wrong reading** | **400** | throws |
| very long string (5 KB) | truncates to valid | truncates to valid | **400** | throws |
| trailing junk after a valid prefix | truncates to valid | truncates to valid | **400** | throws |
| leading whitespace + valid | trims to valid | trims to valid | **400** | throws |
| valid date, empty time half | ok | ok | **400** | throws |
| time only (`12:00`) | unavailable | **wrong reading** | **400** | throws |
| NUL byte appended | truncates to valid | truncates to valid | **400** | throws |
| newline appended | truncates to valid | truncates to valid | **400** | throws |

Counts, derived at the moment of writing rather than carried forward:
**tide backend** -- 8 shapes answer `500`, 1 answers a mis-worded `502`, 23
answer `200`; **tide desktop** -- 0 crash, 2 are the broken Current path, and 18
render a reading for a moment that was not asked for; **weather backend** -- 26
answer `400`; **weather desktop** -- 17 throw status-less, 9 silently accept a
rolled-over moment.

Note the four "truncates to valid" rows: `normalize_obs_dt` slices `[:16]`, so a
5 KB string, trailing junk, a NUL byte and a newline all collapse to the correct
16-character prefix and answer correctly. They are not defects today, but under
the new spec they become 400s -- matching `/weather/at`, whose `strptime` is
exact. That is a deliberate tightening, and it is safe: the only shipped callers
send `${toDateInput} ${toTimeInput}` or `nowInTz(tz)`
(`WeatherForecastPanel.tsx:45-46,50-58`), all of which produce exactly
`YYYY-MM-DD HH:MM`.

## 3. Where the divergence is: the route/parameter boundary

Not in parsing, not deeper. The evidence is that `/weather/at` and `/tide/at`
share the same shape everywhere *except* the boundary: both slice one moment,
both call one provider, both build from bodies that the v1.0.31 containment
already wraps. `/weather/at` refuses an unreadable `dt` at `routers/weather.py:79-89`
before `fetch_forecast`; `/tide/at` has nothing between the query parameter and
`normalize_obs_dt`.

The helper asymmetry beneath it is the *mechanism*, and it explains why the two
runtimes produce two different wrong answers rather than one shared one:

| | Python | TypeScript |
|---|---|---|
| `shift_local` / `shiftLocal` | `datetime(y, mo, d, h, mi)` -- **raises** on an impossible component | `Date.UTC(y, mo-1, d, h, mi)` -- **rolls over**, never throws |
| Non-matching string | returns the input unchanged | returns the input unchanged |
| Non-ASCII digits | `\d` **matches** (`services/tide.py:220`) → shifts | `\d` is ASCII-only → returns unchanged |

**A shared validator belongs at the boundary, not inside these helpers**, and
the argument is the fan-in: `normalize_obs_dt` / `shift_local` are also called
from `/tide/{checklist_id}`, whose input is eBird's `obs_dt` and whose honest
state is already the soft `{"status": "unavailable"}` that `at-route-try-containment`
decision 2 settled ("each route keeps the honest state it already has"). Teaching
the helpers to refuse would silently change that route's contract. The caller's
`dt` gets its own predicate at its own route; the checklist route keeps its
containment.

## Which existing tests catch this, and which must change

- **Catch it today: none.** The only `dt`-validation test in the repo is
  `backend/tests/test_weather_at.py:68` (`dt="not-a-date"` → 400, nothing else).
  No test on either runtime drives `/tide/at` or `getTideAt` with a malformed
  `dt`: `test_tide_at.py`, `test_at_route_containment.py` and
  `atRouteServices.test.ts` all use a valid one, and `tide.test.ts`'s window-helper
  block drives conforming inputs only. That property is the finding, and it is
  what a reader can grep.
- **Must change: none.** Every file above drives a conforming `dt`, so a
  refusal-only change cannot move them. This is the opposite of the predecessor,
  which had three rows pinned to go red -- there is no handover pin here, only a
  deferred decision and a ROADMAP line.
- **Must NOT change:** `test_tide_epoch_parity.py` / `tideEpoch.parity.test.ts`
  (the response-side `_epoch_min` axis, including its three deliberately pinned
  TS divergences) and the byte-golden formatter parity. If any moves, this build
  has crossed into the next one's territory.

## Flags for The Engineer

- **A 400 raised INSIDE the tide route's broad `except Exception` becomes
  `200 {"status": "unavailable"}`.** `at-route-try-containment` decision 13
  measured this. Put the refusal in `get_tide_at` **before** `_resolve_tide_at`,
  outside the try, exactly where `/weather/at` puts its own.
- **The fix is three-sided, not two.** Tide backend + tide desktop + the desktop
  weather half. Leaving the third open means one `dt` produces *bad date* and
  *you're offline* side by side on one screen.
- **Refusing `''` without adding the "now" fallback to `getTideAt` would turn a
  silent wrong window into a hard refusal of the shipped Current view.** The two
  changes are one change. `tideService.ts` already has the seam it needs --
  `getTidePlan` calls `invoke('get_timezone', { lat, lng })` at `:193`.
- **The 400's detail never reaches the screen.** `WeatherForecastPanel` takes
  `classifyLiveError(err).kind` and renders its own fixed copy
  (decision 8); a 400 classifies as `kind: 'error'` with the generic message.
  So **no new user-facing copy ships** -- which dissolves ground (2) of the
  original deferral ("a product decision rather than a failure-path repair").
  Whether the panel should distinguish a bad-date kind is a separate question;
  do not answer it here.
- **Sweep the `\d` siblings in `services/tide.py` and say which were checked.**
  F2 of `tide-timezone-parse` is open on `shift_local:220` and `_clock:144`;
  `_LST_RE:159` already uses `[0-9]` with the reason written above it. The
  standing rule (`.claude/rules/security.md`, v0.5.54) wants an explicit ASCII
  class on the Python side of any twinned guard **and a non-ASCII-digit row in
  the malformed-input test**.
- **Derive the symmetric difference in BOTH directions.** The predecessor's
  three QA fix items all lived in the second direction. Every shape the new
  predicate newly REFUSES needs an argument as much as every shape it newly
  ACCEPTS -- the four "truncates to valid" rows above are exactly that kind, and
  they change verdict.
- **A limit single-sourced across two languages needs a per-side deletion
  test.** Single-sourcing the refusal sentence stops the copies drifting; it does
  nothing to stop one side's enforcement being dropped. One test per runtime
  that fails when that runtime's guard is removed.
- **Neither `frontend/src/lib/tide.ts` nor `frontend/src/lib/tauri/tideService.ts`
  is covered by `.claude/rules/security.md`'s or `weather-tide.md`'s `paths`.**
  The backend half auto-loads both rules and the TS half loads neither, which is
  the same path-gating shape CLAUDE.md records as having shipped a stale version
  pill for five commits. Read both files in full before touching the TS side, and
  consider whether the frontmatter should gain these two paths in this build.

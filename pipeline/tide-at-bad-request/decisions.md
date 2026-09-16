# Decisions — Tide At Bad Request

Every table here was measured by driving the real routes and the real desktop
services with the provider seams doubled, before the repair was written and again
after it. Probe scripts ran from this session's scratchpad and are not committed;
the shipped equivalent is `frontend/src/lib/wallClock.fixture.json`, which both
new suites drive.

The brief's numbers reproduced on both runtimes, with **one correction** (§7).

---

## 0. The measurement, before and after

All four columns over the brief's 32-shape roster, provider seams doubled so the
route/service is isolated.

| | at v1.0.31 | after |
|---|---|---|
| **`GET /tide/at`** — plain-text HTTP 500 | **8** | 0 |
|  · mis-worded 502 blaming NOAA for the caller's value | 1 | 0 |
|  · HTTP 200 | 23 | 4 |
|  · HTTP 400 | 0 | **28** |
|  · rows answering `status: "ok"` | 23 | 4 |
|  · `fetch_tides` calls over the roster | 23 | **4** |
| **desktop `getTideAt`** — rejections | **0** | 28 |
|  · resolved `status: "ok"` | 32 | 4 |
|  · NOAA requests over the roster | 96 | **12** |
|  · accepted rows whose `begin_date` was malformed | 2 | **0** |
| **`GET /weather/at`** (the reference) — rows whose status moved | — | **0** |
| **desktop `getWeatherAt`** — status-less throws read as OFFLINE | **16** | 0 |
|  · silently accepted a rolled-over or mis-parsed moment | 10 | 0 |
|  · rejections carrying `{ status: 400 }`, `isOfflineError` false | 0 | **26** |

**Cross-runtime verdicts now agree on every row of the roster**: tide 28 refused
/ 4 accepted on both, weather 26 refused / 6 accepted on both.

**Red-first is recorded PER GUARD in §12's mutation table rather than as one
combined figure here, and that is a deliberate change of form.** This section
carried a combined count through three revisions — 34/84 and 92/116, then
37/88 and 97/149 — and it went stale each time, not because anything was
measured wrong but because two later rounds added rows to both suites. A
combined red-first number is a claim about a file's exact contents on the day it
was taken; a per-guard mutation figure is a claim about the guard, which is what
a reader actually needs and what survives the next row. §12's table is re-derived
against the final shipped suites and covers every guard this build added, on both
runtimes.

The headline pair, from that table: reverting the backend `dt` guard turns **36
of 95** backend rows red with the frontend untouched; reverting the desktop `dt`
guards turns **115 of 179** frontend rows red with the backend untouched.

Restores are verified against a snapshot taken at the INTENDED state — never the
one used to perform the restore — and behaviourally, by re-running the full
backend suite, `cargo test --lib`, and the frontend suites and build. §12 records
the round where that distinction stopped being a formality and caught a real
silent revert.

---

## 1. The refusal is a SHARED PREDICATE at the request boundary, not a fix in either handler (2026-09-16)

**Decision:** one predicate per runtime, defined once and imported by both
consumers on each side — `parse_wall_clock` / `is_blank_wall_clock` /
`wall_clock_text` in `backend/services/wall_clock.py`, and `parseWallClock` /
`isBlankWallClock` / `wallClockText` / `nowInZone` in
`frontend/src/lib/wallClock.ts`. `BAD_DT_DETAIL` / `BAD_DT_MESSAGE` is the one
definition of the sentence on each side, so `/tide/at` and `/weather/at` cannot
drift.

This is the SHAPE of `isFiniteFigure` / `is_finite_figure` from the preceding
build, deliberately not the predicate: the brief establishes those are
numeric-only by contract, and a third spelling *of them* would be wrong. What
carries over is "one twinned predicate, defined once per runtime, imported by
both consumers".

**Where it goes in the tide route, and both halves are load-bearing.** The guard
is `get_tide_at`'s FIRST act and sits OUTSIDE `_resolve_tide_at`:

- **OUTSIDE**, because a 400 raised inside that function's broad
  `except Exception` comes back as `200 {"status": "unavailable"}` — a deliberate
  error becoming a *success* status code. `at-route-try-containment` decision 13
  measured exactly this and named it the worse half of that pair.
- **FIRST**, because no NOAA request may be made for a moment we are about to
  refuse (the `CHECKLIST_ID_RE` posture, `DECISIONS.md:800-810`). Measured:
  `fetch_tides` is called 4 times over the roster where it was called 23, and
  the desktop twin makes 12 NOAA requests where it made 96.

It also precedes `get_timezone`, which is where an out-of-range coordinate still
raises (`at-route-try-containment` decision 11, still open and still out of
scope). A guard placed after it would have inherited that 500 for a request it
was about to refuse anyway. Pinned by
`test_a_refused_dt_never_reaches_the_timezone_lookup`.

**`wall_clock.py` imports nothing from `fastapi`, and says so at the module
docstring.** That is the F3 invariant of `at-route-try-containment` kept rather
than restated: the refusal is raised by the CALLER, outside the try, and the
module is free of anything that could be raised from inside one.

---

## 2. The MARGIN is a per-caller argument, and `/weather/at` deliberately does not take it (2026-09-16)

**Decision:** `parse_wall_clock(dt, margin_hours)` requires the moment to sit
`margin_hours` inside the calendar both runtimes can represent.
`/weather/at` passes **0**; `/tide/at` passes `TIDE_WINDOW_MARGIN_HOURS` = **25**.

**Why 25 and not a taste value.** It is the widest shift the tide route makes
from the moment it is given: `end = shift_local(start, 1)`, and the high/low
window runs from `shift_local(start, -24)` to `shift_local(end, 24)`. Derived
from the route at the moment the guard was written, and pinned to it by
`test_the_margin_is_the_widest_shift_the_tide_route_makes`, which greps the
three shift expressions out of the router — per the standing rule that a guard
naming a NUMBER is asserting that number.

**What it buys.** `9999-12-31 23:59` was an `OverflowError` 500 and
`0001-01-01 00:00` was a 502 in NOAA's own words for a value that never reached
NOAA. Both are now a stated 400. The `OverflowError` is unreachable by
construction rather than caught.

**Why NOT on `/weather/at`, which is the interesting half.** Folding 25 hours
into the predicate itself would have made one predicate for both routes and no
argument — and it would have turned `?dt=9999-12-31 23:59` from a truthful
`out-of-range` ("no weather reaches that far") into a bad-request error. That is
reachable, not theoretical: `<input type="date">` in Predict carries a `min` and
**no `max`** (`WeatherForecastPanel.tsx:545`), so a user can type a far-future
date, and today they get the honest answer. Replacing a correct sentence with a
generic error to buy a tidier predicate is a loss.

**The cost, stated rather than hidden.** The two ROUTES now answer differently
for exactly two of the 32 shapes — `0001-01-01 00:00` and `9999-12-31 23:59`
are 400 on `/tide/at` and 200 `out-of-range` on `/weather/at`. **Cross-RUNTIME
parity is the requirement and is total; cross-ROUTE parity is not, because the
two routes derive different things from the same string.** Both fixture rows
carry the asymmetry explicitly.

**One residual, named because a totality claim with an unnamed exception is
worse than an honest partial one.** For `9999-12-31 23:59` the sentence
"That doesn't look like a valid date and time." is a shade imprecise: that IS a
valid date and time, and what the route cannot do is build a window around it.
It is kept rather than given its own words because the brief rules out new
user-facing copy, the detail never reaches the screen (§5), and a second
sentence for a one-minute-wide band at the end of the representable calendar
would be worse than the imprecision. **Reversal condition:** if the panel ever
distinguishes a bad-date kind (explicitly a separate question the brief tells
this build not to answer), this band should get the honest wording with it.

---

## 3. The "now" fallback and the refusal are ONE change (2026-09-16)

**Decision:** `getTideAt` gains a "now in the LOCATION's timezone" fallback in
the same change as the refusal, and `transport.ts:118` stops coercing an absent
`dt` to `''`.

**Why they cannot be separated.** `transport.ts` routed an absent `dt` as
`getTideAt(lat, lng, params?.dt ?? '')` where the weather branch four lines above
passes `params?.dt` through as `undefined`, and Current asks for "now" by
OMITTING the key (`runLookup` sets it only `if (tideDt)`). `getTideAt` had no
fallback at all, so `toNoaaDate(normalizeObsDt(''))` produced `" "` — a single
space — as NOAA's `begin_date`. Measured at HEAD: both blank rows sent `" "` and
resolved `{ status: "unavailable" }`. **Refusing `''` without adding the
fallback would have converted a silent wrong window into a hard refusal of the
shipped Current view.**

**This is a shipped everyday path, broken on desktop and iOS since 0.5.34
(`a0cafa5`), in no decision and no ROADMAP line.** `WeatherForecastPanel.tsx:325`
asserts the opposite in its own comment ("No dt for either call: both resolve
'now' in the LOCATION's timezone"); that comment was true on web/Pi and false on
the majority platform, and this build makes it true everywhere rather than
editing it.

Measured after: the blank rows send `20260916 02:59` in the location's zone.
Asserted on the OUTBOUND `begin_date` rather than on the response, with a
two-zone row (Kiritimati UTC+14 against Niue UTC−11, 25 hours apart, so their
local dates ALWAYS differ) proving the route reads the LOCATION's clock with no
dependence on what time the suite runs at.

**`nowInZone` is single-sourced, and the panel's copy is deleted.**
`WeatherForecastPanel` carried a byte-identical `nowInTz` for the result LABEL.
Once the same function became load-bearing for what gets REQUESTED, two copies
of it is the drift this repo single-sources against, so the panel imports it.
`lib/wallClock.ts` has no imports at all, so nothing is added to any chunk's
dependency graph beyond the module itself; `entryChunk.test.ts` is green.

---

## 4. `shift_local`'s `\d` is FIXED here; `_clock`'s is not, and the line is the build's fence (2026-09-16)

**Decision:** `backend/services/tide.py:220` `shift_local` becomes explicit
ASCII `[0-9]`. `_clock` at `:144` keeps its `\d` and is handed to the next build.

**Why `shift_local` is in scope.** It is on the `dt` path, it is a helper this
build touches, and F2 of `pipeline/tide-timezone-parse/security-report.md` is
open on it. `.claude/rules/security.md` (v0.5.54) requires an explicit ASCII
class on the Python side of any twinned guard, and `_LST_RE` in the same file
already does it with the reason written above it.

**The argument is convergence, not hygiene, and it is measured.** After the
route guard, `/tide/at` cannot reach `shift_local` with a non-ASCII digit at
all. The remaining reachable path is `/tide/{checklist_id}`, whose input is
eBird's unvalidated `obs_dt`. On an Arabic-Indic-year `obs_dt`:

| | outbound NOAA window (begin, end, hilo_begin, hilo_end) |
|---|---|
| Python **before** | `('٢٠٢٤0501 12:00', '20240501 13:00', '20240430 12:00', '20240502 13:00')` |
| Python **after** | `('٢٠٢٤0501 12:00',) × 4` |
| TypeScript (unchanged) | `('٢٠٢٤0501 12:00',) × 4` |

Python silently *succeeded* at shifting a clock the TS twin returned unchanged,
so the two transports asked NOAA for **different windows** for the same
checklist. They now ask for the same one. What NOAA then does with a malformed
date is NOAA's business and is identical for both.

**Why `_clock` is left.** Its input is NOAA's response `t`, which the brief
fences off explicitly as the next build's subject ("the `0.0` sentinel in
`_epoch_min`/`epochMin` and `interp_level`'s divisor, i.e. a malformed timestamp
in NOAA's *response*"). Fixing it here would be drifting across that line for a
two-character change. **The sweep is on the record**: `services/tide.py` carries
three twinned patterns — `_LST_RE` (defined at `:83`, used at `:113`; already
`[0-9]`, with the reason written above it), `shift_local` (`:233` after this
change, `:221` before it — fixed here), and `_clock:144` (open, handed on). No
other `\d` remains in that module's twinned guards.

*(The line numbers in this paragraph were wrong in the first draft, which cited
`_LST_RE:159` — a line that holds nothing. The sweep itself was accurate and the
security review verified it independently; only the citation was off. Corrected
rather than quietly amended, because a wrong line number sends the next reader to
the wrong place in the very file the rule is about, and this repo's records are
load-bearing.)* Pinned by
`test_shift_local_uses_an_explicit_ascii_class_too`, which also asserts the
behaviour, not only the source text.

---

## 5. The refusal is a NEW ERROR PATH, and error paths are where keys leak (2026-09-16)

**Decision:** the sentence is a fixed module constant with no interpolation on
both runtimes, and the property is asserted at the wire rather than read off the
source.

Both `/tide/at` and `getTideAt` were driven with
`?dt=2026-01-01 12:00&station=EVIL#../../etc/passwd` and the response body /
rejection value asserted to contain none of: the hostile fragment, `passwd`, the
coordinates, `tidesandcurrents`, `openweathermap`, the station id, or the
OpenWeather key. The backend response is exactly `{"detail": "<the sentence>"}`.

Three properties ride with it and each is free rather than argued: **zero
outbound requests on the refusal path**, so no provider body exists to echo;
**no `except`/`catch` arm was added**, so no upstream exception text can reach a
detail; and the desktop throw carries `{ status: 400 }` on a plain `Error`, the
`assertCoordinateRange` shape, so `isOfflineError` is FALSE. That last one is the
build's user-visible point: 16 of 32 shapes previously threw status-less and the
panel said *you're offline* on an online device whose request had never left the
machine.

**No new user-facing copy ships.** `WeatherForecastPanel` takes
`classifyLiveError(err).kind` and renders its own fixed copy
(`at-route-try-containment` decision 8), so a 400 classifies as `kind: 'error'`
with the generic message and the detail never reaches the screen. Whether the
panel should distinguish a bad-date kind is a separate question and is
deliberately not answered here.

---

## 6. The symmetric difference of every predicate this build changed, in BOTH directions (2026-09-16)

The preceding build's convention flag, applied. For every predicate replaced or
added: what the new code ACCEPTS that the old refused, and what it REFUSES that
the old accepted.

| Predicate replaced / added | NEWLY ACCEPTS (old refused) | NEWLY REFUSES (old accepted) | Argued where |
|---|---|---|---|
| `/weather/at`'s two-format `strptime` loop → `parse_wall_clock(dt, 0)` | **nothing** — 0 of 80,504 swept strings, measured | **67 of 80,504**, in four categories: a non-ASCII decimal digit in the year/hour/minute, non-space whitespace as the date/time separator, a one-digit hour or minute, and a one-digit or space-padded month/day | **§7 — the finding of this build** |
| `/tide/at`'s `normalize_obs_dt(dt)` (no validation at all) → `parse_wall_clock(dt, 25)` | nothing | **28 of the 32 roster shapes**, of which 8 were 500s, 1 a mis-worded 502, and 19 were 200s carrying a reading for a moment nobody asked about | §1, §2, and the whole brief |
| desktop `getTideAt`: no guard → the same predicate | an absent or empty `dt`, which now produces a real window where it sent NOAA a single SPACE and resolved `unavailable` | the same 28 | §3 |
| desktop `getWeatherAt`: no guard → `parseWallClock(dt, 0)` | nothing | 26 of 32 — of which **16 already failed**, status-less and read as offline, so only **10** are a genuine new refusal, all of them shapes `Date` had ROLLED into a different real instant | §7, §8 |
| `if dt:` → `is_blank_wall_clock(dt)` (truthiness → explicit presence) | nothing reachable | nothing reachable | **§9 — the cross-runtime truthiness row** |
| TS `dtLocal ? … : undefined` → `isBlankWallClock(dtLocal)` | nothing reachable through the shipped type | a non-string falsy `dt` (`0`, `false`) reaching an untyped caller: was treated as "now", is now a 400 — **and this is a convergence**, since Python's old `if dt:` also treated `0` as "now" and its new form also refuses it | §9 |
| `shift_local`'s `\d` → `[0-9]` | nothing — a strictly smaller matched set | a wall clock written with non-ASCII decimal digits, on `/tide/{checklist_id}`, which now falls through to the passthrough branch exactly as the TS twin always has | §4 |
| desktop `Date.UTC(year, month-1, …)` → `wallClockUtcMs` (`setUTCFullYear`) | nothing | nothing — **no verdict moves in either direction**; what changes is the MOMENT computed for years 1–99 | **§8 — the agreeing-wrong row** |
| `transport.ts` `params?.dt ?? ''` → `params?.dt` | an absent `dt` now reaches the service as `undefined` rather than `''` | nothing | §3 |
| `parseLocalDateTimeInZone` (checklist path) | **unchanged, deliberately** | **unchanged, deliberately** | §10 |

The three rows worth reading twice are the ones where the inversion column is
where the work was: the `strptime` replacement, the `Date.UTC` coercion, and the
presence swap.

---

## 7. THE REFERENCE GUARD WAS LEAKY, AND THE 32-SHAPE ROSTER STRUCTURALLY COULD NOT SEE IT (2026-09-16)

**What happened.** "No roster row moved on `/weather/at`" is true — 0 of 32 —
and it is a claim about 32 strings. Writing the §6 row required a claim about
all strings, so the two predicates were swept differentially over **80,504**
generated strings (boundary-heavy component products, every single-position
substitution/insertion/deletion of a conforming clock over a 111-character
alphabet, affix products on both conforming forms, three non-ASCII digit
renderings, and 60,000 random draws):

```
accepted by BOTH                : 2,691
NEWLY ACCEPTS (old refused)     : 0
NEWLY REFUSES (old accepted)    : 67
both accept, DIFFERENT moment   : 0
```

**The 67, by category and by mechanism:**

| Count | Category | Why `strptime` accepted it |
|---|---|---|
| 34 | non-space whitespace as the date/time separator (NBSP, U+202F, VT, FS…) | a literal space in a `strptime` FORMAT matches any run of whitespace |
| 27 | a non-ASCII decimal digit in the **year**, hour or minute | `%Y` is `\d\d\d\d`, which is Unicode in Python, and `int()` parses the result |
| 3 | a one-digit hour or minute | `%M` is `[0-5]\d\|\d` |
| 3 | a one-digit or space-padded month/day | `%m`/`%d` accept the short forms |

**Why the roster could not see this.** Its Arabic-Indic row is
`٢٠٢٤-٠٥-٠١ 12:00`, with the non-ASCII digits in the **month and day** — and
`strptime`'s `%m` and `%d` are *literal ASCII alternations*, so it refused, both
transports agreed, and the row reads as clean. Put the same digits in the YEAR
alone and the old backend accepted it. **This is the v1.0.29 rule paying out
exactly as written: a twinned pair's fixture must contain a row that SEPARATES
the twins, or their agreement is unmeasured.**

**All 67 resolved to the CORRECT moment on the backend.** So this is a leniency
being closed, not a wrong answer being fixed — *on that runtime*. Every one of
them also threw status-less on the desktop twin (`Number('٢٠٢٤')` is `NaN`;
`split(' ')` does not split on NBSP) and was read as **"you're offline"**. They
were divergent rows all along, invisible to the roster, and this build converges
them.

**Decision: converge on REFUSAL, not on acceptance.** Three grounds:

1. **`.claude/rules/security.md` (v0.5.54) mandates it** — an explicit ASCII
   class on the Python side of any twinned guard, plus a non-ASCII-digit row in
   the malformed-input test. The reference guard was in violation of a standing
   rule this repo has carried since 0.5.54.
2. **Converging on acceptance means writing Python's accidents into JavaScript
   by hand** — a Unicode-digit parser (`Number()` returns `NaN` for them) and
   NBSP-tolerant splitting, several members deep, with no principle to check it
   against. That is precisely what `weather-at-malformed-parity` decision 10
   argues against, in the same words.
3. **No shipped caller can emit any of the 67.** `<input type="date">` and
   `<input type="time">` produce ASCII zero-padded values, and `nowInZone` reads
   `Intl` `en-CA` parts and zero-pads. Asserted as a test
   (`no shipped caller can emit any of the tightened shapes`) over three zones
   rather than left as a sentence.

**Reversal condition:** if a caller is ever added that emits a localized wall
clock, normalize at that CALLER. Do not loosen the shared predicate — the moment
it accepts a shape one runtime cannot parse, the pair diverges again.

**Guard.** `tighteningsOverTheReplacedWeatherGuard` in the fixture: **three
rows over the four categories above, covering 64 of the 67** — pinned by a
`len(rows) == 3` assertion that names the uncovered category, so the shortfall
is stated rather than looked-for. Each row asserts BOTH directions — that the
*replaced expression*
(spelled exactly as `routers/weather.py` carried it) really did accept the
string and resolve it to the named moment, and that the shipped predicate
refuses it on both routes and both runtimes. Kept **beside** the roster, never
in it, so every count in §0 stays a measurement over exactly the 32 shapes it
was measured on.

**The uncovered fourth category is a STATED gap, not an oversight (QA, this
build).** The guard covers 64 of the 67; the one-digit or space-padded month/day
tightening -- `2024-5-01 12:00`, which the replaced guard accepted -- is
asserted **nowhere**, so loosening the shipped predicate in that one direction
turns nothing red. An earlier draft of this paragraph said "one row per
category", which read as a totality claim over a four-row table and is exactly
the shape §2 of this document warns against. Practical risk is nil: ground 3
above holds for these shapes as much as for the other three categories, since
`<input type="date">` cannot emit an unpadded month. **Reversal condition:** the
first change that touches the predicate's month/day handling, or the first
caller that is not a native date input, owes a fourth row and a `len(rows) == 4`
assertion to match.

---

## 8. A COERCION THAT MOVES NO VERDICT STILL NEEDS ITS OWN ARGUMENT (2026-09-16)

**The defect, which no parity check could ever have found.**
`parseLocalDateTimeInZone` seeded its convergence loop with
`Date.UTC(year, month - 1, day, hour, minute)`, and **`Date.UTC` maps years 0–99
onto 1900–1999**. So `/weather/at?dt=0001-01-01 00:00` resolved to **1901** on
desktop and to **year 1** on the backend. Both then answered `out-of-range`, and
the roster shows the row as agreeing, before and after.

That is the `weather-at-malformed-parity` flag verbatim: *an AGREEING wrong
answer is invisible to parity checking by construction, so a shared coercion
needs its own argument, not just a parity fixture.* The fix is
`wallClockUtcMs`, which builds the instant with `setUTCFullYear` (no two-digit
mapping) — three lines, no verdict moved, recorded here because nothing else
would record it.

**The same round trip is what refuses the rollover**, and it is one comparison
where five range checks would still pass Feb 30: build the instant, then require
it to report back the components it was given. `Date.UTC(2024, 12, 1)` is
`2025-01-01`, `Date.UTC(2024, 4, 45)` is `2024-06-14`, `setUTCHours(24)` is the
next day — each comes back as a DIFFERENT component and is rejected. Asserted as
a measurement in the suite (`never rolls a component, where bare Date.UTC does`)
rather than as a claim about `Date`.

**The year floor is separate and is its own separator row.** Year 0 is a
perfectly good proleptic year to JavaScript — `setUTCFullYear(0)` round-trips
cleanly — and `datetime(0, …)` raises. The round trip cannot see it; only the
explicit `MIN_YEAR` bound can. Mutation-checked: dropping that one comparison
turns exactly the `year 0000` separator row red and nothing else.

**And the margin's two spellings have no gap between them.** Python overflows
against `datetime.max` = `9999-12-31 23:59:59.999999`; the TS ceiling is
`9999-12-31 23:59:00.000`. The 59.999999 s between them is unreachable, because
`marginHours` is a whole number of hours and every moment here carries zero
seconds, so a shifted moment is either at or before the ceiling or at or after
`10000-01-01 00:00`. Stated at the definition site and pinned by the two
upper-edge separator rows, one accepting and one refusing, one minute apart.

---

## 9. The presence test is `is None` / `== null` on both sides, and the empty string is named explicitly (2026-09-16)

**Decision:** `is_blank_wall_clock(dt)` is `dt is None or dt == ""`;
`isBlankWallClock(dt)` is `dt == null || dt === ''`. Neither side uses
truthiness, and neither side leaves the empty string to the validator.

**Why the empty string is named rather than validated.** The spec requires an
absent *or empty* `dt` to mean "now" on both runtimes. A pure `is not None`
presence test would send `''` to the validator, which would refuse it — turning
a shipped 200 into a 400 on `/weather/at` and breaking Current again on the tide
side. So the predicate has three outcomes, not two, and the blank case is part
of the contract rather than an accident of `if dt:`.

**Both directions, on the reachable domain.** A FastAPI `str | None` query
parameter can only be `None` or a `str`; `if dt:` is false exactly for `None`
and `""`, and so is `is_blank_wall_clock`. **Identical on the whole reachable
domain — nothing moves in either direction**, which the 0-rows-moved measurement
on `/weather/at` confirms.

**The unreachable half is stated anyway, because the SPELLING is what the twin
needs.** Python and JavaScript disagree about `{}`, `[]`, `0`, `false` and `""`
in two directions at once, and no single truthiness spelling is a twin of the
other's. The one value where the old and new forms actually differ is a
non-string falsy `dt` reaching an untyped JS caller: `dtLocal ?` treated `0` as
blank, `isBlankWallClock(0)` does not, and `parseWallClock(0)` refuses a
non-string. Python moves the same way (`if 0:` was blank; `parse_wall_clock(0)`
is `None`). **So the two runtimes agreed before and agree after, on a different
answer** — which is the honest way to state it, and is why the row is in §6's
table rather than dismissed as unreachable.

---

## 10. What this build did NOT touch, and why

- **`parseLocalDateTimeInZone` keeps `Date.UTC` and its rollover.** It is
  reachable from exactly one caller, `getWeather`, whose input is eBird's
  unvalidated `obsDt`, and whose rollover is a **pinned divergence** from the
  Python twin (`atRouteServices.test.ts` asserts `obs_dt` `'2024-13-40 25:61'`
  and `'0000-00-00 00:00'` still date the checklist here and answer 502 there).
  Routing it through the strict predicate would have flipped those two rows and
  turned that file red, which the brief names as the signal that the change has
  crossed into a well-formed path. The two entry points share one convergence
  routine (`convergeLocal`) and differ only in how the guess is built.
- **`_epoch_min` / `epochMin`'s `0.0` sentinel and `interp_level`'s divisor.**
  The next build's subject. `test_tide_epoch_parity.py` and
  `tideEpoch.parity.test.ts` are green **unchanged**, including their three
  deliberately pinned TS divergences — which is the brief's own check that this
  build has not crossed the line.
- **`_clock`'s `\d`** — §4.
- **The coordinate surface** (`at-route-try-containment` decision 11): both
  `/at` handlers still accept unbounded and NaN coordinates. Pre-existing, on
  ROADMAP, and the refusal now sits *before* the call that raises, which
  narrows it without closing it.
- **Whether the panel should distinguish a bad-date error kind** — the brief
  says do not answer it here.
- **`test_tide_at.py`, `test_at_route_containment.py`, `test_weather_at.py`,
  `atRouteServices.test.ts`, `tide.test.ts`** — all green, unchanged. Every one
  drives a conforming `dt`, so a refusal-only change cannot move them.
- **`docs/HELP.md`, `README.md`, `website/`, `PRIVACY_POLICY.md`,
  `ACCESSIBILITY.md`** — swept at paragraph scope, starting at the source.
  **Nothing needed changing, and one thing is worth recording:**
  `docs/HELP.md:138` says *"**Current** fetches the live weather and tide for
  where you are right now, in one tap"* and `README.md:11` says the same. That
  published claim has been **false on desktop and iOS since 0.5.34** for the
  tide half (§3) and is true as of this build. The prose described the intended
  behaviour all along; the code did not match it. No route signature moved, no
  new host, no new request, and no request moved between components — the
  refusal path makes strictly fewer — so `PRIVACY_POLICY.md:35` and `:41` are
  unaffected and remain accurate. No published prose quotes the refusal
  sentence.
- **No version bump, no `CHANGELOG.md`.** Build 4 of 5 in a bundled Spool
  release taking one four-file bump at the end; the changelog line this build is
  owed is in `pr-description.md`.
- **`ROADMAP.md`** — the Chronicler's at closeout. The deferrals this build
  hands it are listed explicitly in the PR description.

---

## 11. The gates that should have caught this, extended (2026-09-16)

**Decision:** `.claude/rules/security.md` gains `frontend/src/lib/tide*.ts`,
`wallClock*.ts`, `transport.ts` and `frontend/src/lib/tauri/**`;
`.claude/rules/weather-tide.md` gains `lib/tide.ts`, the two `lib/tauri`
services, and `backend/services/tide.py`. Each file carries a comment under its
frontmatter saying why.

**The argument for `security.md` is that its twinned-guard rules are claims
about a PAIR, and only one half of each pair was loading them.** The explicit
`[0-9]` rule (v0.5.54), the anchor/`fullmatch` rule (v0.5.87) and "a twinned
builder pair agrees on what a MALFORMED figure is" (v1.0.29) all govern both
runtimes; `backend/routers/tide.py` auto-loaded them and
`lib/tauri/tideService.ts` — the twin where `Date` rolls exactly where Python
raises — loaded neither this file nor `weather-tide.md`. `lib/tauri/**` is the
twin of `backend/services/**` and `backend/routers/**`, so gating it draws the
same line already drawn on the Python side rather than a new one. **It also
closes a gap that file had opened against itself:** `lib/tauri/taxonomyService.ts`
is CITED in its own lookup-table rule as the reference for the
`Object.create(null)` write side and was matched by no path there.

**The argument for `weather-tide.md` is the same shape one layer down.** It
gated `tideFormatter*` — the module that RENDERS the pasted block — while
`tide.ts`, which computes the reading the formatter renders, and the two desktop
services, which are the only producers of that block on the majority platform,
matched nothing. A change to what lands in a user's public eBird checklist could
be made with none of the marker-vocabulary or byte-golden parity rules loaded.

This is the same path-gating shape CLAUDE.md records as having shipped a stale
version pill for five commits, and the brief flagged it prospectively. Worth
noting that the gap was not hypothetical here: §7's finding is exactly a
v0.5.54 violation, in the reference guard, on a route whose Python half *did*
load the rule — so the extension is necessary and was not sufficient by itself.

---

## 12. A mutation that did not go red was a finding about the tests (2026-09-16)

The per-side deletion table (`.claude/rules/security.md`, v1.0.20 — single-sourcing
a sentence stops the copies drifting, not one side's enforcement being dropped):

**EVERY FIGURE BELOW WAS RE-DERIVED AGAINST THE FINAL SHIPPED SUITES, after the
last row landed.** The table was first written against an 84/116 suite, then two
rounds added rows to both files, so every number in it had gone stale without
changing — which is the same class as F-A below and is why re-running was the
answer rather than patching one cell. Backend denominator 95
(`test_tide_at_bad_request.py`); frontend denominator 179
(`tideAtBadRequest.test.ts` + `transport.test.ts`).

| Mutation | backend suite | frontend suites |
|---|---|---|
| baseline | 95 pass | 179 pass |
| M1 — backend tide `dt` guard reverted, TS intact | **36 fail** | 179 pass |
| M2 — desktop `dt` guards reverted, backend intact | 95 pass | **115 fail** |
| M3 — backend margin 25 → 0 | **6 fail** | 179 pass |
| M4 — TS margin 25 → 0 | 95 pass | **7 fail** |
| M5 — TS year floor dropped | 95 pass | **1 fail** (the year-0 separator, as designed) |
| M6 — Python `fullmatch` → `match` | **18 fail** | 179 pass |
| M7 — TS component round trip dropped | 95 pass | **23 fail** (was recorded 9 — see below) |
| M8 — `transport.ts` alone reverted | 95 pass | **2 fail** (was 0 — see below) |
| M9 — `locationZone`'s `try` removed | 95 pass | **5 fail** |
| M10 — `zoneOrUtc`'s non-string check removed | 95 pass | **3 fail** |
| M11 — `zoneOrUtc` neutered entirely | 95 pass | **14 fail** |
| M12 — Python `get_timezone` reverted | **2 fail** | 179 pass |
| M13 — Rust seam default reverted | 95 pass | 179 pass ← |

**M8 is the finding.** Reverting the one transport line — item 3 of the brief,
the shipped-but-broken Current path — left all 116 frontend rows green (the
denominator at the round it was found in; it is 179 now), because
`tideAtBadRequest.test.ts` drives `getTideAt` directly and never routes through
`transport.get('/tide/at')`. A mutation you expected to go red and which does
not is a finding about the TEST, not a clean bill
(`.claude/rules/testing.md`). Two rows were added to
`transport.test.ts` — one pinning that an absent `dt` forwards as `undefined`
with the force flag decoded, one asserting the tide and weather branches hand an
absent `dt` to their services the SAME way, expressed as a relationship rather
than twice as a literal, because the two branches sat four lines apart in one
file disagreeing. Re-run: M8 now turns exactly those two rows red.

**M13 is the second finding, and it arrived from QA (F-B): reverting the Rust
seam default turns NOTHING red, on either runtime.** That is not a hole — see
§13's corrected framing — but it means the symmetry this record originally
claimed for the two zone guards was wrong, and the mutation table is what settles
it: M11 (`zoneOrUtc` neutered) turns 14 rows red, M13 turns 0. The guard that
looks symmetric in the source is not the guard doing the work.

Every other mutation lands only on its own runtime, which is the split working:
one side pinning the constant, the other pinning the enforcement.

**M7 was wrong for a third and more insidious reason than either of the other
two, and the mechanism is worth more than the number.** QA measured 23 where this
table said 9. It diagnosed a carried-forward cell — a figure that had not moved
while its suite grew by thirty rows — which is a reasonable reading and is not
what happened. Measured both ways:

| what was actually mutated | frontend rows red |
|---|---|
| the harness's real edit: `getUTCDate` / `getUTCHours` / `getUTCMinutes` dropped, **`getUTCFullYear` and `getUTCMonth` kept** | **9** |
| the whole round-trip block removed, as the label says | **23** |

So 9 was a **faithful measurement of an unfaithful mutation**. The harness used a
string replace that matched only the last two lines of a five-comparison
condition, leaving the year and month checks live — which is why it reproduced
identically in rounds 1 and 3 and why re-running it, the remedy F-A prescribed,
could never have caught it. **A carried-forward cell is stale; this was stable,
reproducible and wrong, which is worse, because every check aimed at staleness
passes it.** The other four cells QA did not re-derive (M1, M2, M6, M8) were
re-run with an explicit applied-check asserting the file actually changed, and
all four reproduce: 36 / 115 / 18 / 2.

**The harness itself also failed once, in the way this repo already records, and
the figures above are the re-run.** The first re-derivation restored files from a
snapshot taken TWO rounds earlier, so from M2 onward it silently reinstated the
pre-chokepoint services and inflated M3, M4, M5 and M7 by ten rows each. Nothing
reported an error; the numbers were simply wrong and plausible. It was caught
because a SECOND snapshot, taken at the intended state, disagreed on three files
— which is exactly v0.5.88's rule (*a restore-verification must compare against
the INTENDED content, never against the snapshot used to perform the restore*)
paying out on the very table being used to satisfy F-A. The fix was one fresh
snapshot set at the intended state, and the final restore is verified against
that. **A stale snapshot is a silent revert, so a mutation harness that outlives
a round of changes re-snapshots before it re-runs.**

---

## 13. THE "NOW" FALLBACK REINTRODUCED THE FALSEHOOD THIS BUILD EXISTS TO REMOVE, FOUR LINES FROM THE GUARD THAT REMOVES IT (2026-09-16, security review F1)

**The defect, which this build introduced.** §3's blank-`dt` branch calls the
native timezone seam and hands the result straight to `nowInZone`:

```ts
const tzName: string = await invoke('get_timezone', { lat, lng })
start = nowInZone(tzName)
```

`tzf_rs::DefaultFinder::get_tz_name` returns the **empty string** for a point no
polygon covers — its own source calls that a limitation of the simplified data
rather than a bug, and it returns `""` only after an internal neighbourhood
sweep has also failed. `Intl.DateTimeFormat({ timeZone: '' })` throws a
`RangeError` carrying **no `status`**, and `isOfflineError` reads a status-less
throw as connection-level. So the panel said *you're offline* on an online
device whose request had never left the machine — **the exact sentence §5 names
as this build's user-visible point**, reappearing on the one path this build
added, four lines from the refusal that carries `status: 400` precisely so it
reads as false. Reproduced independently before fixing:

| service | seam returns | settled | `status` | `isOfflineError` | requests |
|---|---|---|---|---|---|
| `getTideAt(lat, lng, undefined)` | `''` | rejected `RangeError` | `undefined` | **true** | 0 |
| `getWeatherAt(lat, lng, '2024-05-01 12:00')` | `''` | rejected `RangeError` | `undefined` | **true** | 0 |
| either, with `'Ocean/Nowhere'` | non-empty | rejected `RangeError` | `undefined` | **true** | 0 |

**It is a twin divergence and the backend half was already right**:
`formatters/weather.py` has always read `_tf.timezone_at(...) or "UTC"`. The
roster could not see it — all 32 rows vary `dt` and supply a valid zone, because
that is the axis the roster is about. **Tide is a coastal and on-water feature,
so the coordinates most likely to be uncovered are disproportionately the ones
this feature is used at.** And it is *not* covered by deferral 4
(`at-route-try-containment` decision 11), which is about coordinate RANGE: an
entirely in-range point over open water reaches this.

**Decision: fix it at BOTH seams — but the two guards are NOT symmetric, and an
earlier version of this section said they were.** QA measured each direction
independently (F-B), and mutations M11/M13 re-derive it: `zoneOrUtc` neutered
turns **14** frontend rows red, the Rust seam default reverted turns **0** on
either runtime. So:

- **`zoneOrUtc` is load-bearing.** A name this finder knows and the webview's
  ICU does not is non-empty, sails through `is_empty()`, and throws identically
  — the third row above.
- **`zone_or_fallback` (Rust) is SUBSUMED**, because `zoneOrUtc('')` already
  returns `UTC` and `locationZone` is the command's only consumer. It is kept on
  **twin-parity** grounds, which is what its own doc comment leads with and is a
  legitimate reason — the command's contract should match its Python twin's
  long-standing `or "UTC"`, and a future non-`locationZone` caller should get a
  sane answer. It is not kept because it closes a case nothing else closes.

**Why that is more than a wording nit, and the reason it is corrected here rather
than quietly softened: the frontend suite mocks `invoke`, so it cannot exercise
the Rust guard at all.** The empty-string row in `zoneNames` drives `zoneOrUtc`,
never `zone_or_fallback`; that guard's only coverage is its four Rust unit tests.
A reader who believed the symmetry could delete `zoneOrUtc` thinking the seam
covered `''` — and would be deleting the half doing the work, with 14 rows going
red for a reason the comment mis-explained. The claim each file makes is now the
narrow, true one, and `src-tauri/src/lib.rs` carries the same correction.

The table below therefore reads as *what each guard closes*, not as a symmetry:

| Guard | Closes | Why the other cannot |
|---|---|---|
| `zone_or_fallback` in `src-tauri/src/lib.rs` | the **empty** name | this is the seam's contract, and the Python twin's `or "UTC"` IS that contract; fixing it here fixes every JS caller at once |
| `zoneOrUtc` in `lib/wallClock.ts` | a **non-empty name this runtime's ICU does not know** | the seam default tests `is_empty()`, so such a name passes straight through it. tzf-rs ships its own tzdb-derived data and the webview supplies ICU's; a zone present in one and absent from the other resolves natively and throws here (`America/Ciudad_Juarez`, tzdata 2022g, is the standing example of such a split) |

Neither is commented as redundant, because the repo forbids leaving a guard
whose necessity has not been measured — and both were measured.

**The JS side resolves at ONE chokepoint, which is the twin's own structure.**
`backend/formatters/weather.py` resolves once into a `ZoneInfo` and hands that
object down, so nothing downstream can receive a name that does not resolve.
This side passed a raw string down to **four** dereference sites — `nowInZone`,
`convergeLocal`, `formatLocalTime` (which builds the copy block a user pastes
into a public eBird checklist), and `tzClock.ts`'s `fmtFor`, reached through
`localClock` from `planTideRange` and `buildWeatherPlan`. **This record said
"three" until QA round 2 counted the fourth**, and the correction UNDERSTATES
rather than overstates what the chokepoint bought: before it, the two plan paths
called `invoke('get_timezone')` directly and fed the raw string into
`localClock` -> `Intl`, which is the identical F1 shape. The chokepoint closes
the class on **five** service paths, not three. Every other `Intl` dereference of
a zone in the app is either fed from `locationZone` or already guarded
(`planReadout`'s try, `PlanResult`'s `safeLocalClock`).

Guarding four call sites is the one-side's-enforcement-dropped shape;
`lib/tauri/locationZone.ts` resolves once, and every `invoke('get_timezone')` in
the app now goes through it (five call sites, zero remaining direct ones).
`convergeLocal`'s own guard was **removed again** once the chokepoint existed,
with the reason written at the site.

**The Python half moved too, and deliberately.** `get_timezone` now catches an
unknown zone name and falls back, because `ZoneInfo(tz_name)` on a name
`timezonefinder` knows and the system tzdb does not raises
`ZoneInfoNotFoundError` — and `get_timezone` sits OUTSIDE every route's try, so
that was a plain-text 500. **Closing only the desktop side would have opened a
fresh divergence of exactly the class this build exists to close, which is the
mistake this build had just made once already.**

**Stated cost.** Falling back means formatting a wall clock in UTC for a point
whose real zone is offset from it, so "now" can name a different hour than the
user's own clock. That is the answer the backend has always given, which is what
makes it the parity-preserving choice; the alternatives are a status-less throw
(the defect), a 400 (a false statement about a request that was fine), or
inventing an offset. For the uncovered-point case it is barely a cost — an
offshore point has no local civil clock, and NOAA's `lst_ldt` timestamps govern
the reading. **Reversal condition:** if the fallback ever fires for a LAND point
in normal use, the zone databases have drifted and the answer is to update them,
not to widen this.

**The guard, and where it lives.** A `zoneNames` block in the fixture, driven
from both runtimes — two fallback rows and two control rows, with a
non-vacuity assertion on each side that both kinds are present (a table of
controls would pass against the unrepaired code; a table of fallbacks would pass
against a seam that answered UTC for every coordinate on earth). Plus four Rust
unit tests on the extracted pure mapping, one of which pins the stated LIMIT —
that a non-empty unknown name passes through the seam untouched — so the next
reader cannot mistake it for the whole fix.

**Red-first: 2 backend rows and 7 frontend rows** (mutations M12 and M11). This
section said **3** backend rows and was wrong; `pr-description.md` said 2 and was
right. The empty-string row stays green when the Python half is reverted, because
the long-standing `or FALLBACK_ZONE` already covered it — which is the reasoning
this section's own table gives, so it was a slip rather than a misunderstanding.
Corrected as QA's F-A, and §12 re-derives every figure in this build rather than
patching the one cell, because a count that has not been re-measured since the
row it describes last moved is suspect by default.

**One assertion of mine was wrong in the first draft and is worth recording.**
`expect(isOfflineError(r.ok === false ? r.e : null)).toBe(false)` is wrong on the
SUCCESS path, because `isOfflineError(null)` is `true` by that function's own
contract (a primitive throw carrying no status is connection-level). It failed
loudly here; with the polarity reversed it would have passed vacuously on every
row. The shipped form asks the question about the rejection itself.

---

## 14. The linearity argument for the new scan, recorded because it was nowhere (2026-09-16, security review F4)

**Status:** accepted as-is; the code does not change. The review verified the
bound holds and recommended **against** a length refusal. That reasoning existed
only in the review, and `.claude/rules/security.md` (v1.0.21/v1.0.23) is explicit
that a build adding a scan over untrusted text owes its linearity argument up
front, with v1.0.30 adding that a declared bound names its own enforcement point.
It is now in the module docstring on **both** runtimes:

- **Structural.** `^([0-9]{4})-([0-9]{2})-([0-9]{2})(?: ([0-9]{2}):([0-9]{2}))?$`
  — exact-count quantifiers only, no unbounded quantifier, no nesting, one
  optional group. Backtracking states bounded at two; O(1) after the anchor.
- **Measured**, five hostile shapes across six sizes to 10 MB on both runtimes:
  Python `fullmatch` flat at ≤0.002 ms at every size; JS `exec` flat at
  0.28–0.36 ms at 10 MB and sub-linear from 1 MB→10 MB. `shift_local`'s new
  `[0-9]` form likewise flat.
- **Enforcement point, web/Pi:** uvicorn's h11 connection caps the request line
  at 16 KB (`DEFAULT_MAX_INCOMPLETE_EVENT_SIZE`), and `start.sh` launches plain
  `uvicorn main:app`, so that is the shipped configuration. **Desktop:** no HTTP
  layer; `dt` originates in the panel's native date and time inputs.
- **Why a length check would buy nothing, which is the half worth writing down.**
  The string is fully materialized by the framework before the predicate runs, so
  a refusal inside it cannot reduce peak retention by a byte. That is the exact
  opposite of `lib/uploadGuard.ts`'s bound (v1.0.20), which is a RETENTION bound
  on a cons-string copy that would otherwise be made. Both docstrings say **do
  not add one**, so the next reader does not "harden" this with a check that
  protects nothing and then reads as load-bearing.

---

## 15. A SEAM HAS TWO FAILURE MODES, AND §13 CLOSED ONE OF THEM (2026-09-16, QA round 2)

**The blind spot did not close; it moved one step out.** §13's `zoneNames` block
is a real guard — four rows, both runtimes, non-vacuity on each side, red-first
2/7 — and every one of its rows mocks the native command as **resolving**. No
test in this repo drove a *rejecting* `invoke`, on any command, and
`locationZone` had no `try`. Measured on both services, before any fix:

| seam behaviour | settled | `status` | `isOfflineError` | requests |
|---|---|---|---|---|
| rejects with an `Error` (IPC / command failure) | rejected | `undefined` | **true** | 0 |
| rejects with a bare string (the Tauri idiom) | rejected | `undefined` | **true** | 0 |
| resolves `undefined` | resolved — in the **device's** zone | — | — | 3 |

The first two are the F1 signature exactly, on the axis §13's fixture holds
constant. This build wrote the flag *"state the seam's failure return at the call
site, and give it a row"* and then gave it four rows that all supply an answer.

**Decision: the two modes get DIFFERENT answers, and that is the whole of it.**

- **An unusable RETURN** means the lookup succeeded and told us this point has
  no usable zone. UTC is the honest best effort and matches the backend; an
  offshore point has no civil clock anyway.
- **A REJECTION** means the lookup never happened, and the point probably *does*
  have a zone. Substituting UTC there would invent a moment up to ten hours off
  for a US coastal point — answering a different moment than the one asked
  about, which is the single thing this build exists to prevent. So it
  **refuses**, with `{ status: 500 }` so it can never read as offline.

**QA proposed a one-line UTC fallback; this takes the refusal instead, and the
argument is parity, measured.** The reachable trigger is a NaN or out-of-range
coordinate (open deferral 4). `GET /tide/at?lat=nan` answers **500** on the
backend today — `get_timezone` sits outside every route's try — and `lat=inf`
and `lat=999` likewise. A UTC fallback on desktop would make it **succeed where
web/Pi fails**, which is a fresh cross-runtime divergence in the direction of a
confidently wrong answer. A status-bearing refusal makes both runtimes produce
the one generic error sentence the panel renders either way. The status is 500
rather than 400 because the caller's request was fine; the platform's own
command did not answer.

**The caught value is discarded**, never re-messaged, so no platform path or
internal detail reaches a `detail` — the same posture as every other refusal
here, with a row asserting it over every surface of the thrown value including
`stack`, which the roster's own leak row does not read.

**And the one input `zoneOrUtc` did not treat as unusable.**
`new Intl.DateTimeFormat({ timeZone: undefined })` is **legal** and means "use
the runtime default", so `zoneOrUtc(undefined)` returned `undefined` and
`nowInZone(undefined)` silently formatted in the **device's** zone — measured
`04:15` in America/Los_Angeles where UTC read `11:15`. That is the precise wrong
answer this build exists to prevent, arriving through the one gap in the guard
written to prevent it. `null`, numbers and whitespace already fell back
correctly, by throwing; a `typeof !== 'string'` check closes the last one.
Unreachable while the Rust command returns `String`, and closed anyway because
the cost is one line and the failure is silent.

**Guards:** a `seamFailures` block driving both services over six modes (two
rejections, three unusable resolutions, one control), a leak row, a
both-verdicts-present assertion, and two unit rows for the `undefined` case.
Mutations **M9** (5 rows) and **M10** (3 rows) land independently. The service
rows compare date AND hour rather than date alone — UTC and the process zone
share a calendar day for part of every day — and the row that cannot be vacuous
is named in the file, because a date-granular comparison would discriminate only
some of the time and a comment claiming otherwise is the shape this repo already
records.

---

## Convention Flags

- **A DIFFERENTIAL SWEEP IS WHAT TURNS "NO FIXTURE ROW MOVED" INTO A CLAIM ABOUT
  THE PREDICATE, AND IT IS CHEAP ENOUGH THAT THERE IS NO EXCUSE.** The preceding
  build's flag says to derive a replaced predicate's symmetric difference in both
  directions and write both down. This build did, from the 32-row roster, and
  the answer was "nothing moved" — which was **true of those 32 strings and
  false of the predicate**. Eighty thousand generated strings, run in seconds,
  found 67 in the refuses column and 0 in the accepts column, in a guard the
  brief calls "the reference". The corpus that found them was not clever: the
  productive parts were every single-position edit of ONE conforming string over
  a wide character alphabet, and affix products. **When you replace a predicate,
  run the old one and the new one over a generated corpus and diff the verdicts
  — a fixture can only ever report on its own rows, and the rows a fixture has
  are the shapes someone already thought of.**
- **A LENIENCY IN A LIBRARY PRIMITIVE IS A TWIN-PARITY DEFECT EVEN WHEN IT
  RESOLVES THE RIGHT ANSWER.** All 67 of those strings parsed to the *correct*
  moment on the backend, so nothing was ever wrong on that runtime and no user
  ever saw a bad figure from them — and every one of them threw status-less on
  the desktop twin and was reported to the user as *"you're offline"*. The tell
  is not a wrong answer on either side; it is that `strptime`'s documented
  flexibility (whitespace runs, Unicode `\d`, one-digit fields) has no counterpart
  in `Number()` and `split(' ')`. **When one half of a twin is a library call,
  enumerate what that library accepts BEYOND the shape you had in mind, because
  the other half almost certainly does not.**
- **A GUARD THAT SCANS SOURCE FOR A PATTERN MUST STRIP COMMENTS FIRST, AND THE
  COMMENT THAT BREAKS IT IS YOUR OWN.** Both structural rows here scan for the
  string `\d`, and the comments explaining why it is absent necessarily contain
  it — so the first run failed a correct file. This repo already records the
  identical trap for `iosSceneManifest.test.ts` and `project.yml`, whose own
  comment names the keys it asserts are missing. The stripper is nine lines and
  quote-aware; write it before the assertion, not after watching it fail.
- **TWICE IN THIS BUNDLE A FIX INTRODUCED A NEW DIVERGENCE OF THE CLASS IT WAS
  CLOSING, AND BOTH TIMES IT WAS THE UNTESTED HALF OF A SEAM.** The preceding
  build swapped a truthiness test for `is not None` on one runtime and opened a
  three-shape divergence in the function it had just rewritten
  (`weather-at-malformed-parity` decision 10). This build gave its refusal
  `status: 400` so `isOfflineError` reads false, and then, four lines away in the
  other arm of the same `if`, called a native seam and handed its result straight
  to `Intl` — where an empty return throws status-less and the panel says
  *you're offline* on an online device (§13). **The two halves of one `if` had
  different error contracts.** The common shape is not carelessness: in both
  cases the fixture varied the axis the build was ABOUT (a figure, then a `dt`)
  and supplied a valid value on the other axis in every row, so the roster was
  structurally incapable of seeing the new defect. **So when a fix adds a call to
  a seam, write the row for the seam's own FAILURE RETURN before shipping —
  `""`, `None`, an unknown name — and if the twin runtime already carries a
  default for it (`or "UTC"` here), that default IS the contract and its absence
  on the other side is the divergence**, whether or not any existing row supplies
  the value that exposes it. Name the seam's failure return at the call site too;
  neither of these was.
- **A SEAM HAS TWO FAILURE MODES — RETURNING SOMETHING UNUSABLE, AND NOT
  RETURNING — AND A FIXTURE THAT VARIES THE RETURN VALUE HAS COVERED ONE.** This
  build wrote the flag *"write the row for the seam's failure return first"* and
  then wrote four rows that all mock the seam as RESOLVING, leaving the rejecting
  case to reproduce the identical status-less "you're offline" signature the flag
  was written about. **When a fixture row supplies a seam's answer, the row that
  supplies its ABSENCE belongs in the same block** — for a mocked seam that means
  at least one `mockRejectedValue` beside the `mockResolvedValue` rows, because
  those are two different code paths through the caller and only one is being
  driven. And **the two modes usually deserve different answers**: a bad answer
  means the lookup succeeded and said "nothing here", which a default can stand
  in for; no answer means you do not know, which a default silently fabricates.
- **"TWO GUARDS, DIFFERENT INPUTS" HAS TWO DIRECTIONS AND BOTH MUST BE MEASURED
  BEFORE IT IS WRITTEN DOWN — THE CHECK IS ONE MUTATION PER GUARD.** Direction A
  here was measured (`zoneOrUtc` is necessary) and direction B was *inferred from
  it* and was wrong: the outer guard subsumes the inner one, because the inner
  one's only consumer applies the outer. Neuter each guard ALONE and re-run; a
  guard whose removal turns nothing red is defensible on parity or contract
  grounds and must not be described as necessary. **Where a test double sits
  between two guards, say which guard the suite can actually see** — the frontend
  suite mocks `invoke`, so it cannot exercise the Rust guard at all, and the
  symmetry framing pointed a future reader at the wrong half as load-bearing.
- **A COUNT IN A SUMMARY TABLE IS STALE THE MOMENT THE ROW IT DESCRIBES MOVES,
  AND THIS BUILD PRODUCED THREE SUCH SLIPS BEFORE TREATING IT AS A PATTERN.**
  "28 tide" disagreements, "one row per category", and a red-first of 3 that was
  2 — none was a misunderstanding, all three were figures that had been true when
  written. The durable fix is not more care at the keyboard: it is to **prefer a
  form that does not decay** (a per-guard mutation figure over a combined
  red-first count; a property over a total), and, where a count is genuinely
  wanted, to **re-derive every one of them after the last row lands** rather than
  patching the cell someone happened to catch. §12 is that re-derivation.
- **A STRING-REPLACE MUTATION CAN BE WEAKER THAN ITS OWN LABEL, AND THAT PRODUCES
  A STABLE, REPRODUCIBLE, WRONG NUMBER — WHICH EVERY CHECK AIMED AT STALENESS
  PASSES.** M7 was labelled "TS component round trip dropped" and its replace
  matched only the last two lines of a five-comparison condition, leaving the
  year and month checks live: 9 rows red where the real mutation reddens 23. It
  reproduced identically in rounds 1 and 3, so re-running it — the remedy
  prescribed for the *other* wrong cells — could never have caught it, and the
  reviewer who found it reasonably diagnosed a carried-forward cell instead.
  **Two habits close it, both cheap.** Assert that the mutated file actually
  differs from the snapshot, so a no-op cannot masquerade as a measurement (M1,
  M2, M6 and M8 were re-confirmed that way here). And prefer **deleting a whole
  named block by its boundaries** over a multi-line literal replace, because the
  literal silently matches a suffix of what you meant while the boundaries
  cannot. The deeper form: a mutation's label is a claim about what was mutated,
  and it deserves the same scepticism as any other claim in the table.
- **A MUTATION HARNESS THAT OUTLIVES A ROUND OF CHANGES RE-SNAPSHOTS BEFORE IT
  RE-RUNS, OR IT PERFORMS A SILENT REVERT.** Re-deriving §12 with snapshots taken
  two rounds earlier reinstated the pre-chokepoint services from mutation 2
  onward and inflated four rows by ten each — no error, no red, just wrong and
  plausible numbers in the table being used to satisfy a finding about wrong
  numbers. It was caught only because a SECOND snapshot, taken at the intended
  state, disagreed on three files. That is v0.5.88's rule (*compare against the
  INTENDED content, never the snapshot used to perform the restore*) and it is
  worth restating as an operational habit rather than a verification step: the
  snapshot is an input to the harness, and an input that ages is an input to
  re-take.
- **WHERE A VALUE MUST BE MADE USABLE BEFORE IT IS PASSED AROUND, RESOLVE IT AT
  ONE CHOKEPOINT AND COPY THE TWIN'S STRUCTURE, RATHER THAN GUARDING EVERY
  DEREFERENCE.** The zone name had FOUR dereference sites on the desktop side
  and one on the backend, and that asymmetry is the whole finding: Python resolves
  once into a `ZoneInfo` and hands the object down, so nothing downstream can be
  given a name that does not resolve, while the TS side passed a raw string.
  Guarding all three call sites is the shape `.claude/rules/security.md` v1.0.20
  warns about (single-sourcing prevents copies drifting, not copies being
  dropped); one `locationZone()` is the twin's shape and leaves one place to
  guard. **Then remove the per-site guards you added on the way**, or you have
  left guards whose necessity is no longer measured — which this repo's own rule
  forbids, and which reads to the next author as a deletion notice.
- **A PREDICATE THAT TREATS A PLACEHOLDER AS A POSITIVE CANNOT BE ASKED ABOUT
  ONE.** `expect(isOfflineError(r.ok === false ? r.e : null)).toBe(false)` looks
  like "this did not read as offline" and is a different assertion on the success
  path, because `isOfflineError(null)` is `true` by contract — a primitive throw
  carrying no status is connection-level. It failed loudly here; reversed, it
  would have passed vacuously on every row. Ask the question about the thing
  itself, never about a stand-in for its absence.
- **WHERE TWO ROUTES SHARE A PREDICATE BUT DERIVE DIFFERENT THINGS FROM IT, THE
  DIFFERENCE BELONGS IN A PARAMETER WITH THE CALLER'S REASON ATTACHED — NOT IN
  THE PREDICATE, AND NOT IN A SECOND PREDICATE.** `/tide/at` needs 25 hours of
  room around the moment and `/weather/at` needs none, and folding the larger
  requirement into the shared definition would have silently replaced a truthful
  `out-of-range` on a reachable input with a bad-request error. State at the
  definition site which caller passes what and why, and say plainly that
  cross-RUNTIME parity is the requirement while cross-ROUTE parity is not —
  otherwise the next reader reads the asymmetry as a bug and "fixes" it.

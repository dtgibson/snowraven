# Bug Brief — Tide Unreadable Timestamp

## What is broken

`_epoch_min` / `epochMin` return **`0.0`** — the 1970 epoch — for a NOAA `t`
they cannot read, and `compute_tide_reading` then builds a confident water level
from that anchor. Measured over 24 `t` shapes across 4 window scenarios (100
rows per runtime): **a high/low whose `t` is unreadable does not drop out, it
moves to 1970**, and because 1970 is 56 years from the window the interpolation
fraction collapses to ~0.99999 and the reading becomes *the other bracket's
level*. A window whose true answer is `Water level: 2.4 – 2.8 ft` renders
`Water level: 1.5 – 1.5 ft` — the next low, two hours away, presented as now —
and the block a user pastes into a public eBird checklist carries the line
`Previous high: 3.6 ft at ` with nothing after the "at". **20 of 23 unreadable
shapes produce that same wrong reading on BOTH runtimes, byte for byte**, so no
cross-transport parity check can see it. The 14 rows that do diverge are worse:
four of them are a **`ZeroDivisionError` on web/Pi against `Water level:
-Infinity ft` on desktop**, from the same body.

## Steps to reproduce

Deterministic, no user input, no network. Probe scripts ran from this session's
scratchpad and are not committed; every table below was measured at HEAD by
driving the real parsers, the real builders and the real formatters. The NOAA
response shapes were captured live from the keyless API (station 9410230, La
Jolla, 2026-09-16) and the mutated bodies are those shapes with one `t` changed.

- **Backend:** `services.tide.parse_observed / parse_predictions / parse_hilo`
  → `compute_tide_reading` → `formatters.tide.format_tide_body`, wrapped in the
  same `try/except` `routers/tide.py:137-144` puts around them, so each row is
  what the ROUTE answers.
- **Desktop:** vitest over the shipped `parseObserved / parsePredictions /
  parseHiLo` → `computeTideReading` → `formatTideBody` in `lib/tide.ts` and
  `lib/tideFormatter.ts`, no seams doubled (these are pure).
- **Planner:** `services.plan_tide.build_tide_plan` against
  `lib/tidePlan.ts buildTidePlan`, one fixed span (`now` = 2026-05-05 05:00 UTC,
  `America/Los_Angeles`), same mutated hilo body.

Sharpest single row — a hilo body whose previous high carries `"t": ""`:

| | Backend | Desktop |
|---|---|---|
| true reading | `Water level: 2.4 – 2.8 ft` | same |
| rendered | `Water level: 1.5 – 1.5 ft`, `Previous high: 3.6 ft at ` | **byte-identical** |

Second sharpest — a hilo body whose two events carry `""` and `"zzz junk"`:
backend answers **`{"status": "unavailable"}`** (a caught `ZeroDivisionError`);
desktop answers **`status: "ok"`** with `Water level: -Infinity ft`.

## Expected behavior

A NOAA `t` that cannot be placed on the epoch axis means **that point is
missing** — it is dropped from the series before any level is derived from it,
on both runtimes, exactly as `build_tide_plan` / `buildTidePlan` already do
(`if t > 0`, `services/plan_tide.py:88,96` and `lib/tidePlan.ts:82,89`). It is
never anchored at 1970, never renders as an empty or nonsense clock, and never
contributes an interpolation weight. The two runtimes agree on **which** strings
are unplaceable, which they do not today: `2026-02-30 15:07` is refused by
Python and rolled into a real instant by `Date.UTC`. When dropping leaves no
usable series the reading degrades to the honest `{"status": "unavailable"}`
both routes already have — never to `-Infinity`, never to a 500, and never to a
confident figure.

## Blast radius

Two pure modules and their two twins, all below the transport layer:
`backend/services/tide.py` (`_epoch_min` :86-120, `interp_level` :123-140,
`_clock` :143-150, the nearest-point `min` :177, and the `str()` coercions in
the three parsers :47,58,70) against `frontend/src/lib/tide.ts` (`epochMin`
:131-136, `interpLevel` :141-155, `clockTime` :239-248, the nearest-point
`reduce` :198-199, the `String()` coercions :93,105,119). Four call sites
consume them, all already inside the `try` v1.0.31 and build 4 added:
`_resolve_tide_at` / `get_tide` (`routers/tide.py`) and `getTideAt` / `getTide`
(`lib/tauri/tideService.ts`). **Plus a third pair build 4's pointer does not
name: the Planner**, `backend/services/tz_clock.py gmt_epoch` against
`frontend/src/lib/tidePlan.ts gmtEpoch`, which share `epochMin`'s roll-over
divergence and whose document is persisted to `replay.json`.

Failure paths and provider-malformed bodies only. No route signature, no new
outbound host, no user-facing copy, so `PRIVACY_POLICY.md` and the website are
unaffected. One build in a bundled Spool release — no version bump, no
`CHANGELOG.md`.

## What done looks like

Checkable by automated tests on both runtimes from one shared fixture, the way
`test_tide_epoch_parity.py` and `tideEpoch.parity.test.ts` already share
`tideEpoch.fixture.json`. The agreed behaviour is:

1. **An unplaceable `t` removes its point from the series, on both runtimes.**
   For the hilo body whose previous high carries any of the 21 unreadable shapes
   in §2, both `compute_tide_reading` and `computeTideReading` return a reading
   built from the remaining points only: `prevHL` is `null`, no `Previous high:`
   line is emitted, and the level is the single bracket's own value rather than
   an interpolation against 1970. Asserted on the rendered `format_tide_body` /
   `formatTideBody` string, byte-equal across the two runtimes.
2. **No copy block ever contains a dangling clock.** A row asserting that for
   every shape in the roster the formatted body matches neither `/ at ?$/m` nor
   `/ at (?![0-9])/` — today `""` gives `at ` and `"not a date"` gives
   `at not a date`, on both runtimes.
3. **No reading carries a non-finite level, on either runtime.** A row asserting
   the divisor pairs in §3 never yield a `status: "ok"` whose `levelMin` /
   `levelMax` is not finite, and never a body containing `Infinity` or `NaN`.
   Today desktop answers `Water level: -Infinity ft` on three of four.
4. **The two runtimes place the same set of strings and refuse the same set.**
   The three rows currently pinned as divergent in
   `frontend/src/lib/tideEpoch.fixture.json` (`2026-13-40 25:61`,
   `2026-02-30 12:00`, `0001-01-01 00:00`) answer identically — which means
   `test_tide_epoch_parity.py::test_the_pinned_divergences_from_the_ts_twin_still_hold`
   and its TS twin **must be rewritten, not deleted** (see "Which existing
   tests" below). Every other row of that fixture stays byte-identical.
5. **The parsers produce the same `t` string from the same JSON on both
   runtimes** for a non-string `t`: `null`, `true`, `[]` and `{}` currently give
   `"None"/"", "True"/"true", "[]"/"", "{}"/"[object Object]"`. Whatever the
   agreed answer is (§7 argues for dropping the entry), one row per shape
   asserting the two parsers agree.
6. **The Planner pair agrees for a `t` that rolls INTO its span.** Rows for
   `2026-04-36 12:00`, `2026-05-05 25:00` and `2026-05-06 12:90` asserting the
   two `buildTidePlan` twins emit the same `turningPoints` and the same `curve`;
   today the desktop plan draws a turning point and a descending curve where
   web/Pi draws a flat line (curve sums 498.25 / 470.75 / 502 against 1477.0).
7. **A per-runtime deletion test.** One test on each side that fails when that
   side's placement guard is removed, per the v1.0.20 rule that single-sourcing
   a limit stops the copies drifting and does nothing to stop one being dropped.
8. `backend/.venv/bin/python -m pytest tests/ -q` green and `ruff check .`
   clean; `cd frontend && npm run build` green and `eslint` clean.
   `test_tide_at.py`, `test_tide_at_bad_request.py`,
   `test_at_route_containment.py`, `test_tide_router.py`, `test_tide_plan.py`,
   `test_weather_tide_plan_parity.py`, `tide.test.ts`, `tideAtBadRequest.test.ts`
   and `atRouteServices.test.ts` stay green **unchanged** — every one of them
   drives a conforming `t`, so a placement-only change cannot move them.

---

## Is build 4's pointer complete? It is right about WHERE and understates the radius three ways

Build 4 handed over *"the `0.0` sentinel in `_epoch_min`/`epochMin`, and
`interp_level`'s divisor."* Both are real and both are measured below. Three
things sit inside this build's subject that it does not name:

1. **`_clock` / `clockTime` render the unreadable string verbatim into the copy
   block.** `_clock` has no anchor and `re.search`es for `[ T]HH:MM` anywhere,
   so `"2026-13-40 25:61"` renders **`1:61pm`** — a clock reading sixty-one
   minutes past one — and `"not a date"` renders as itself, after the word "at".
   This is the `\d` fence build 4 explicitly deferred ("its input is NOAA's
   RESPONSE `t`, which is the next build's subject",
   `services/tide.py:230-231`), and it is a rendering defect as well as a
   character-class one.
2. **The parsers diverge BEFORE the sentinel is reached.** `str(p.get("t",""))`
   and `String(p.t ?? '')` are not twins for a non-string `t`. `"None"` sorts
   *after* every real timestamp and `""` sorts *before* every one, so the two
   runtimes bracket the window with different points and take different
   branches — the `null` row is the one measured A_prev divergence that has
   nothing to do with `epochMin` at all.
3. **The Planner is a third twin pair on the same axis**, and it is the one that
   already has the right answer. See §5.

The pointer's implicit fix — swap `0.0` for a sentinel the callers check — is
**necessary and not sufficient for the divisor**, and that is measured rather
than argued: `interp_level` brackets on the **string** (`h["t"] <= t`) and
divides on the **epoch**, so its `prev["t"] == nxt["t"]` guard does not
guarantee a non-zero divisor. Two *well-formed* strings that place to the same
instant (`2026-05-01 10:09` and `2026-05-01T10:09`, both accepted by the shared
`[ T]` class) give `ZeroDivisionError` on Python and `-Infinity` on TypeScript
today, and filtering unplaceable points out does nothing about them. The
equality guard has to move onto the placed epoch, which is exactly what
`interp_at_epoch` / `interpAtEpoch` already do.

## 1. What "unreadable" means in NOAA's actual response shape

Captured live, 2026-09-16. All three products return the timestamp as a
**string** under `t`, in `time_zone=lst_ldt`, `YYYY-MM-DD HH:MM`:

```
water_level  {"metadata":{...}, "data":[{"t":"2026-05-01 12:00","v":"3.137","s":"0.607","f":"0,0,0,0","q":"v"}, …]}
predictions  { "predictions" : [{"t":"2026-05-01 12:00", "v":"2.931"}, …]}
hilo         { "predictions" : [{"t":"2026-05-01 15:07", "v":"1.486", "type":"L"}, …]}
```

A NOAA *refusal* is `{"error":{"message":"…"}}` and is already handled —
`is_noaa_error` / `isNoaaError` make all three parsers return `[]`. **The
exposure is a 200 carrying a `data` / `predictions` array in which a `t` is
present but unreadable.** Reachability is honestly narrow: the only producer is
NOAA over HTTPS on both transports (`services/noaa.py`,
`tideService.ts getJson`), nothing user-supplied and nothing replayed reaches
this field. This is a robustness-and-parity repair, not a defect with a known
live trigger — the finding is that when it does happen the app states a figure
it has no basis for, identically on both transports, in a block that gets
published.

## 2. The 21 unreadable shapes, and the 3 readable ones that look unreadable

24 shapes driven. `place` = does the string reach a real instant on that
runtime.

| Shape | example | PY places | TS places | note |
|---|---|---|---|---|
| conforming | `2026-05-01 15:07` | ✓ | ✓ | control |
| ISO `T` separator | `2026-05-01T15:07` | ✓ | ✓ | the class admits it, deliberately |
| trailing newline | `2026-05-01 15:07\n` | ✓ | ✓ | both match a PREFIX, by contract |
| **key absent** | — | ✗ | ✗ | parser substitutes `""` |
| **`null`** | — | ✗ | ✗ | **`"None"` vs `""` — the strings differ** |
| **empty string** | `""` | ✗ | ✗ | |
| **whitespace** | `"   "` | ✗ | ✗ | |
| **wrong separator** | `2026/05/01 15:07` | ✗ | ✗ | but `_clock` still reads `3:07pm` off it |
| **date only** | `2026-05-01` | ✗ | ✗ | |
| **time only** | `15:07` | ✗ | ✗ | |
| **Feb 30** | `2026-02-30 15:07` | ✗ | **✓ (rolls to Mar 2)** | pinned divergence |
| **month 13 / min 61** | `2026-13-40 25:61` | ✗ | **✓ (rolls to 2027)** | pinned divergence; `_clock` renders `1:61pm` |
| **Arabic-Indic digits** | `٢٠٢٦-٠٥-٠١ ١٥:٠٧` | ✗ | ✗ | but `_clock` DIVERGES (§3) |
| **mixed ASCII/Arabic** | `2026-05-01 ١٥:٠٧` | ✗ | ✗ | same |
| **leading newline** | `\n2026-05-01 15:07` | ✗ | ✗ | both anchored |
| **year 1** | `0001-01-01 00:00` | ✓ (year 1) | **✓ (1901)** | pinned divergence |
| **the epoch itself** | `1970-01-01 00:00` | ✓ → `0.0` | ✓ → `0` | **indistinguishable from the sentinel** |
| **number** | `1777000000` | ✗ | ✗ | both coerce to `"1777000000"` |
| **boolean** | `true` | ✗ | ✗ | **`"True"` vs `"true"`** |
| **empty list** | `[]` | ✗ | ✗ | **`"[]"` vs `""`** |
| **empty object** | `{}` | ✗ | ✗ | **`"{}"` vs `"[object Object]"`** |
| **junk** | `not a date` | ✗ | ✗ | renders as itself after "at" |
| outside the window | `2027-01-01 15:07` | ✓ | ✓ | **not a defect — see below** |
| far before it | `1900-01-01 00:00` | ✓ | ✓ | **not a defect — see below** |

**Two items on the brief's own starting list turn out not to be defects, and
saying so is part of the finding.** A *well-formed timestamp outside the
requested window* is handled correctly on every path measured: `_in_window` is a
string comparison, so the point is excluded from the window samples, and where
it legitimately brackets the window the interpolation against it is the honest
answer the data supports (a next low eight months out flattens the curve, which
is true). It needs no change. And the **epoch itself** is a genuine collision —
`1970-01-01 00:00` is a placeable instant whose value is the no-match sentinel —
but it is unreachable for a tide station and it is already documented as such in
the shared fixture (`"whose 0 is indistinguishable from the no-match
sentinel"`). It matters only because it is the reason a fix must not be spelled
`if (epoch === 0) drop`.

## 3. Where the `0` comes from, and what it makes the user see

`_epoch_min` / `epochMin` have exactly **three** consumers per runtime, and the
rendered observable differs at each:

| Consumer | site | what the `0` becomes | what the user reads |
|---|---|---|---|
| **interpolation weight** | `tide.py:138` / `tide.ts:151` | `f` collapses to ~0.99999 because 1970 is 56 years from the window | **the wrong water level**: `1.5 – 1.5 ft` where the truth is `2.4 – 2.8 ft` |
| **the same weight's divisor** | same line | `0/0` or `x/0` | **`unavailable` (PY) vs `Water level: -Infinity ft` (TS)** |
| **nearest-point selection** | `tide.py:177` / `tide.ts:199` | every unplaceable point ties at distance-to-1970 | the *earliest* pooled point presented as the nearest |
| *(not the sentinel)* `_clock` | `tide.py:144` / `tide.ts:240` | the raw string is echoed | **the time axis**: `at `, `at not a date`, `at 1:61pm` |

The 1970 anchor is the mechanism, and it is worth stating precisely because it
is what makes the number *look ordinary*: a bad anchor 56 years away does not
produce a wild figure, it produces a fraction so close to 1 that the
interpolation silently degenerates into "return the other bracket". The reading
is plausible, in range, correctly rounded, and wrong by however far the window
sits from that bracket.

Exact rendered copy blocks, hilo previous-high carrying `"t": ""`, both
runtimes byte-identical:

```
 control                              t = ""
 🌊                                   🌊
 Predicted                            Predicted
 Water level: 2.4 – 2.8 ft            Water level: 1.5 – 1.5 ft
 Tide: Falling                        Tide: Falling
 Previous high: 3.6 ft at 10:09am     Previous high: 3.6 ft at
 Next low: 1.5 ft at 3:07pm           Next low: 1.5 ft at 3:07pm
```

`Water level: 1.5 – 1.5 ft` is a range of a value with itself — the two
interpolated endpoints differ in the seventh significant figure — which is a
second tell that the figure is not a measurement.

## 4. Do the two runtimes agree? Mostly yes, and that is the harder half

100 rows per runtime (24 shapes × 4 window scenarios, plus 4 divisor pairs),
plus the three helper-level sweeps:

| Sweep | rows | agree | diverge |
|---|---|---|---|
| `_epoch_min` / `epochMin` | 19 | 16 | **3** (Feb 30, month 13, year 1) |
| `_clock` / `clockTime` | 19 | 17 | **2** (both Arabic-Indic rows) |
| parser `t` coercion | 24 | 20 | **4** (`null`, `true`, `[]`, `{}`) |
| A — prev high unreadable | 24 | 21 | 3 |
| B — next low unreadable | 24 | 17 | **7** |
| D — observed point unreadable | 24 | **24** | 0 |
| E — nearest-point fallback | 24 | **24** | 0 |
| C — divisor pairs | 4 | **0** | **4** |
| **total** | **162** | **139** | **23** |

**The agreeing rows are the finding.** In scenario A, 20 of the 23 mutated
shapes produce a reading that both runtimes render identically and that is
**wrong in both** — the control reads `2.4 – 2.8 ft` and every one of the 23
reads `1.5 ft`. In scenario B, 14 more. That is 34 rows on which every existing
and every conceivable cross-transport parity fixture passes, over a figure the
app has no basis for. It is precisely the shape
`weather-at-malformed-parity/decisions.md` §4 named: *"An agreeing wrong number
is invisible to every cross-transport parity check by construction."* There the
instance was `temp: true` rendering `Temperature: 1°F` on both sides; here it is
a 1970 anchor rendering the wrong bracket's level on both sides.

**Scenario D is the one place the app already does the right thing, by
accident.** An unreadable `t` on an *observed* or *predicted* point is excluded
from the window by `_in_window`'s string comparison, so it never contributes a
level — the range narrows from `2.4 – 3.1 ft` to `2.4 – 2.8 ft` and no sentinel
is involved. All 24 rows agree and all 24 are defensible. The sentinel is
reachable only through the high/low series and the nearest-point pool, which is
why the fix belongs at those two consumers rather than in the parsers.

**Scenario C is the loudest divergence and the one build 4 half-closed.**
`routers/tide.py:134-136` states that its new `try` *"closes the
ZeroDivisionError half of F1 … where two sentinel epochs give `interp_level` a
zero divisor"* — true, and true on **one runtime only**. TypeScript does not
throw on division by zero, so the desktop twin's identically-placed `try` at
`tideService.ts:184-192` catches nothing and the reading reaches the formatter:

| hilo pair | backend | desktop |
|---|---|---|
| `""` and `"zzz junk"` | `{"status":"unavailable"}` | `ok`, `Water level: -Infinity ft` |
| `""` and `"not a date"` | `{"status":"unavailable"}` | `ok`, `Water level: -Infinity ft` |
| `2026-05-01 10:09` and `2026-05-01T10:09` | `{"status":"unavailable"}` | `ok`, `Water level: -Infinity ft` |
| `2026-02-30 09:00` and `2026-13-40 25:61` | `{"status":"unavailable"}` | `ok`, `Water level: 3.2 – 3.2 ft` |

That last row is the worst of the four: no error, no infinity, a perfectly
ordinary-looking `3.2 ft` computed between two dates that do not exist.

## 5. The copy block: yes, and on both routes

`tide.body` → `buildCombined(wf, tide.body)` → `copyText`
(`WeatherForecastPanel.tsx:195-202`) is the Weather tab's "Copy Weather and Tide
Together", and `WeatherTideSection.tsx:65-66` is the Checklists tab's, fed by
`/tide/{checklist_id}` through the same `compute_tide_reading`. **Both single-
moment routes reach the block a user pastes into a public eBird checklist**, so
every rendered string in §3 is publishable text, including `Previous high: 3.6
ft at ` and `Next low: 1.5 ft at 1:61pm`. As in build 3, this path matters more
than the in-app render: the panel's figure is transient, the checklist comment
is permanent and public, and `stripWeatherTideBlocks`' own reader
(`lib/weatherBlockParse.ts`) will later read those strings back out.

## 6. The Planner is a third site — and it already has the correct answer

`build_tide_plan` / `buildTidePlan` consume the **same** `parse_hilo` /
`parsePredictions` output through their own placement helper, and they **drop**
an unplaceable point rather than anchoring it:

```py
t = gmt_epoch(p["t"])
if t > 0:
    continuous.append({"t": t, "v": p["v"]})
```

That is the remedy the idea asks for, shipped, in this repo, for this provider
and this field — which is the strongest available argument that "missing" is the
right answer for the single-moment path too. Two things follow.

**First, the Planner pair diverges as well, and its span filter has been hiding
it.** Over the 24-shape roster the two plan documents agree on all 24, because
the impossible-calendar shapes roll to instants outside the fetched span and are
dropped for that reason on the TS side. Pick a shape that rolls *into* the span
and the agreement disappears:

| `t` | backend turning points | desktop turning points | curve sum |
|---|---|---|---|
| `2026-05-06 00:00` (control) | 2 | 2 | 468.25 / 468.25 |
| **`2026-04-36 12:00`** | **1** | **2** (a low at 2026-05-06 05:00) | **1477.0 / 498.25** |
| **`2026-05-05 25:00`** | **1** | **2** (a low at 2026-05-05 18:00) | **1477.0 / 470.75** |
| **`2026-05-06 12:90`** | **1** | **2** (a low at 2026-05-06 06:30) | **1477.0 / 502.0** |
| `2026-05-00 12:00` | 1 | 1 | 1477.0 / 1477.0 |

Web/Pi draws a flat line at 3.5 ft; desktop draws a labelled turning point and a
descending curve, from the same body. And the plan document is written to
`replay.json`, so the desktop's invented turning point persists and re-renders
offline.

**Second, `t > 0` is not quite the predicate to copy.** It also drops a
legitimately pre-1970 instant and the epoch itself. Harmless for a span that
always starts at "now", wrong as a general placement test — so state the
predicate as "placeable", not as "positive", wherever it is single-sourced.

## 7. Is "treat as missing instead of as zero" the right remedy? Yes — with one correction

Build 4 concluded that *refusal* rather than missing-vs-zero was the right axis
for its own case, and asked this build to check rather than inherit. The two
cases genuinely differ, and the difference is whose string it is:

- Build 4's `dt` is a **request parameter naming a moment the caller wants**. An
  unreadable one names no moment, so there is nothing to degrade to and refusal
  (HTTP 400) is the only honest answer.
- This build's `t` is **one datum inside a series the provider sent**. The other
  points are fine. Refusing the whole reading over one unplaceable row would
  throw away a working panel, and the repo's own sibling builder already
  declines to do that.

So "missing" is right. **The correction is that missing-vs-zero is not the whole
axis** — three of the measured defects are untouched by it:

1. The **divisor** needs the bracket's equality guard moved onto the placed
   epoch (§ "Is build 4's pointer complete?"). Dropping unplaceable points does
   not close it, measured.
2. **Placement must AGREE across the runtimes**, or "missing" means two different
   sets. Today `2026-02-30 15:07` is missing on one transport and a real March
   instant on the other.
3. **`_clock` renders a string that was never placed at all.** Dropping the
   point upstream removes its exposure on the high/low labels, but the `\d`
   divergence remains latent and should be closed in the same pass, since it is
   the deferral build 4 wrote into the source.

## 8. Symmetric difference, both directions, for each predicate this build would replace

Per `weather-at-malformed-parity/decisions.md` §12 and its Convention Flag —
every QA fix item in that build lived in the second column.

| Predicate replaced | NEWLY DROPS (was kept) | NEWLY KEEPS (was dropped/mangled) | argue at |
|---|---|---|---|
| `_epoch_min` → `0.0` sentinel → a placement that can say "unplaceable" | the 21 unreadable shapes of §2, as high/low events and as nearest-point candidates | **nothing on the backend**; on the TS side, `2026-02-30` and `2026-13-40` stop being kept as rolled-over instants — a *drop*, not a keep | §2, §7 |
| `interp_level`'s `prev["t"] == nxt["t"]` (string) → equality on the placed epoch | nothing | two distinct strings naming one instant now return `prev.v` instead of raising / `-Infinity` | §"pointer complete" |
| `_clock`'s `\d` → explicit `[0-9]` | Python stops rendering `3:٠٧pm` for an Arabic-Indic time | nothing — the TS twin already returns the string unchanged | §6.3 |
| `_clock`'s unanchored `re.search` → anchored/placed | `1:61pm` and `3:07pm`-from-`2026/05/01` stop being emitted | nothing | §3 |
| `str(t)` / `String(t)` in the three parsers → an agreed treatment of a non-string `t` | `null`/`true`/`[]`/`{}` entries, if the agreed answer is to drop them | nothing | §4 |
| Planner `t > 0` → the same shared placement predicate | on TS, the three roll-into-span shapes | a pre-1970 instant and `1970-01-01 00:00`, on both — today both drop them | §6 |

**The second column is nearly empty and that is itself worth checking in
review**, because it is exactly the shape build 3 was wrong about twice. The one
non-empty cell (the divisor now returning a value where Python used to raise) is
a widening of the SUCCESS path on the backend and should carry its own row.

## Which existing tests catch this, and which must change

- **Catch it today: none.** No test on either runtime drives a malformed `t`
  through `compute_tide_reading` / `computeTideReading`.
  `test_tide_epoch_parity.py` and `tide.test.ts` are the only files that touch
  the builder and both use conforming series; `test_tide_router.py`,
  `test_tide_at.py` and `test_tide_plan.py` drive well-formed NOAA bodies. That
  absence is greppable and is the finding.
- **Must change — and this is the handover pin build 4 wrote:**
  `backend/tests/test_tide_epoch_parity.py::test_the_pinned_divergences_from_the_ts_twin_still_hold`
  (with its `PY_DIVERGENT` table) and
  `frontend/src/lib/tideEpoch.parity.test.ts`'s `pinned divergence:` block.
  Those three rows exist *"so a change to EITHER side turns a row red and sends
  the next reader to pipeline/tide-timezone-parse/decisions.md"* — converging
  the twins is that change. **Rewrite them into agreement rows, do not delete
  them**, and regenerate `tideEpoch.fixture.json` through
  `SR_GEN_PLAN_FIXTURE`-style gating on `tideEpoch.fixtureGen.test.ts` rather
  than by hand (the file says so itself). Build 4's brief listed these as "must
  NOT change" *for that build*, with the explicit note that moving them means
  crossing into this one's territory — it is now this build's territory.
- **Must NOT change:** everything in item 8 of "What done looks like", plus the
  byte-golden formatter parity and `weatherTidePlan.fixture.json`'s conforming
  families. If a conforming family moves, the change has altered a well-formed
  path and is wrong.

## Flags for The Engineer

- **The `try` the backend already has is not a fix, and a matching `try` on the
  desktop side would not be one either.** `routers/tide.py:137-144` turns the
  `ZeroDivisionError` into `unavailable`; TypeScript has nothing to catch, and
  the honest state is not "unavailable" anyway — it is a reading built from the
  points that could be placed.
- **Do not spell the placement test `=== 0` or `> 0`.** `1970-01-01 00:00` is a
  placeable instant whose epoch is the sentinel, and a pre-1970 instant is
  placeable and negative. Return a distinguishable "unplaceable" (`None` /
  `null`) or a separate boolean, single-sourced per runtime the way
  `is_finite_figure` / `isFiniteFigure` and `parse_wall_clock` / `parseWallClock`
  are — and give each side its own deletion test (v1.0.20).
- **The divisor is a bracketing problem, not a sentinel problem.** Measured:
  filtering unplaceable points out still leaves `ZeroDivisionError` /
  `-Infinity` for two well-formed strings naming one instant. Move the equality
  guard onto the placed epoch, as `interp_at_epoch` / `interpAtEpoch` already do.
- **`_epoch_min`'s docstring and `test_tide_epoch_parity.py`'s header both
  explain why the prefix match and the UTC axis are the contract.** Neither is
  the defect; do not "fix" `re.match` to `re.fullmatch` (it would break parity by
  design) and do not re-read the string in the station's real zone (a separate,
  deliberately deferred decision in `tide-timezone-parse/decisions.md`).
- **Decide the non-string `t` question explicitly and write it down.** Dropping
  the entry in the parsers is the cleanest answer and matches `_num` already
  dropping a non-numeric `v`, but it is a *parser* change, which widens the blast
  radius to the Planner's inputs too. If the answer is instead "coerce
  identically", the twins need a shared spelling — Python's `str()` and
  JavaScript's `String()` agree on numbers and disagree on four other types.
- **The Planner change is optional for closing the idea and mandatory for
  closing the parity claim.** If it is deferred, say so in `decisions.md` with
  the measured table from §6 and a reversal condition — a silent non-action and
  an oversight leave the same evidence (CLAUDE.md, 2026-09-15).
- **Rule gates, checked:** `.claude/rules/security.md` covers
  `frontend/src/lib/tide*.ts` and `frontend/src/lib/tauri/**`, so `tide.ts`,
  `tidePlan.ts` and `tideService.ts` all auto-load it; `backend/services/**`
  covers `tide.py` and `tz_clock.py`. `.claude/rules/weather-tide.md` covers
  `tide.ts`, `tideFormatter*`, `tideService.ts`, `routers/tide.py` and
  `services/tide.py` — **but not `frontend/src/lib/tidePlan.ts`**, which this
  build would touch. Add it to that frontmatter in the same change.
- **A new placement predicate is a new scan over provider text**, so declare it
  with its linearity argument up front (`.claude/rules/security.md`, v1.0.23) —
  it is a twinned guard, so explicit ASCII `[0-9]` on the Python side, and a
  non-ASCII-digit row plus leading-, trailing- and embedded-newline rows in the
  shared fixture (v0.5.54, v0.5.87). `_LST_RE` and `_GMT_RE` already do this
  correctly; `_clock` at `services/tide.py:144` does not.

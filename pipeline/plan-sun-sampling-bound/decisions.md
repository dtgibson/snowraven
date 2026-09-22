# Decisions — plan-sun-sampling-bound

## Stage 1 — The Evaluator (2026-09-22)

Measured on the Spool bundle branch at `af15ed2`, via scratch vitest files under
`frontend/src/lib/` run with `npx vitest run --reporter=verbose` and deleted afterwards
(the tree is clean). Machine: the dev Mac, nothing else compiling. Every figure below is
a measurement, not a reading from ROADMAP.

---

### D1. What the four loops cost, measured

`sunTrack` over the window, one sample per 900 s plus anchors:

| window span | samples | wall | per sample |
|---|---|---|---|
| 16 d | 1,537 | 1.22 ms | 0.793 µs |
| 365 d | 35,041 | 13.02 ms | 0.372 µs |
| 5,840 d (16 y) | 560,641 | 199.07 ms | 0.355 µs |

Linear, and ROADMAP's 0.33 µs/sample reproduces. **But 16 years is an illustration, not a
ceiling.** `window.endTs` is `isNum`-checked only, so the honest statement is that the
loop has no bound: a 16-character `endTs` of `9007199254740991` asks for 1.001e13 samples,
which extrapolates to ~0.1 years of compute and OOMs on the sample array long before
that; `endTs: 1e12` asks for 1.109e9 samples, ~366 s. The whole hostile document is 83
code units against the replay store's 3,000,000-unit budget, so the budget bounds nothing
here. The failure mode is a hung or killed tab, not "a long moment before it draws".

`sunPeakByDay` is worse in two dimensions, **neither of which the ROADMAP item names**:

- per-day span: 16 days each spanning a year = **164.61 ms**. It iterates
  `d.startTs..d.endTs`, which the window clamp alone would not reach.
- day count: `asDays` has no length cap, and `sideAt` is a linear scan over
  `model.days` per evaluation, so the pair is quadratic. Measured 34.6 / 85.3 / 273.6 /
  1,011.5 ms at 500 / 1,000 / 2,000 / 4,000 days — ratio per doubling 2.46, 3.21, 3.70,
  climbing toward 4. `buildSunModel` itself is linear (23.74 ms at 2,000 days).
  This runs in a `useMemo` in `PlanResult.tsx:519`, i.e. in a render body on the thread
  that paints.

Gridlines and y ticks, `for (let v = Math.ceil(g.yMin); v <= Math.floor(g.yMax); v += 2)`,
twice (`PlanChart.tsx:377` and `:640`). `yMin`/`yMax` come from the tide curve's `v`
extremes. Measured **counter only** — the shipped code pushes each value to an array and
maps it to a React element, so the real cost is far above these:

| tide `v` | yMin / yMax | gridlines | bare loop |
|---|---|---|---|
| ±7 | -7.6 / 8.2 | 8 | 0.00 ms |
| ±1e3 | -1000.6 / 1001.2 | 1,001 | 0.03 ms |
| ±1e6 | -1000000.6 / 1000001.2 | 1,000,001 | 2.61 ms |
| ±1e8 | ±1e8 | 100,000,001 | 55.49 ms |

Incidental, same driver, no loop: `plotW` is the window span in pixels — 6,144 px at
16 d, 2,242,560 px at 16 y. The span clamp fixes it for free; no separate work.

---

### D2. Which inputs reach which loop, and from where

**The ROADMAP item's "No shipped path can produce such a document" is FALSE for the
window span, and this is the finding that reframes the build.** `buildWeatherPlan` caps
the day COUNT at `PLAN_DAYS_MAX` and then takes `endTs = days[days.length - 1].endTs`,
derived from the provider's own `dt`. The span is therefore uncapped on the live path.
Measured through the shipped builder over the real fixture's own daily entries, moving
only each entry's `dt`/`sunrise`/`sunset`:

| daily `dt` spacing | days | window span | samples | `sunTrack` |
|---|---|---|---|---|
| 1 d (conforming) | 16 | 15.4 d | 1,507 | 1.45 ms |
| 30 d | 16 | 450.4 d | 43,271 | 19.57 ms |
| 365 d | 16 | 5,475.4 d | 525,667 | 191.74 ms |

The Python twin has the same shape (`backend/services/plan_weather.py:119`,
`end_ts = days[-1]["endTs"]`), so this holds on both transports.

| loop | driven by | live provider? | hand-edited `replay.json`? |
|---|---|---|---|
| `sunTrack` | `window.endTs - window.axisStartTs` | **yes** (table above) | yes, unbounded |
| `sunPeakByDay` per-day marks | each `day.endTs - day.startTs` | no — producer derives both from `localMidnightTs` | yes (164.61 ms) |
| `sunPeakByDay` × `sideAt` | `days.length` | no — producer caps at 16 | yes, quadratic (1,011.5 ms at 4,000) |
| gridlines / y ticks | `curve[].v` extremes | **yes** — `parseFloat` + `Number.isFinite` only, `lib/tide.ts:107`, no magnitude bound | yes |
| `plotW` | window span | **yes** | yes |

So two of the five are live-reachable. Reaching them live requires OpenWeather or NOAA to
return a conforming-but-absurd body; that is a provider fault rather than an attacker with
a foothold, but it is not the "hand-edited file only" story the record currently tells.

---

### D3. Clamp shape — DECIDED: two chokepoints, not four clamps

**Rejected: `Math.min` inside `sunTrack` and the day loop.** It bounds those two functions
and leaves `sunPeakByDay`'s day-count quadratic, `plotW`, and any future reader of
`plan.window` unbounded; it puts the ceiling in the consumer rather than in the document,
so a fifth consumer added later is unbounded again by default.

**Chosen: clamp in `composePlan` (`lib/plan.ts`) + clamp the y-domain in `planGeometry`
(`lib/planChartGeometry.ts`).** This is the v1.0.5 "validate at the write/compose
chokepoint" precedent and the v1.0.14 "a registry, not a discipline" spirit: the bound
becomes a property of the *document* the merge emits, so every downstream module inherits
it without knowing it exists. Three specific consequences worth stating:

1. **`PlanChart.tsx` is not edited at all.** Both its loops read `g.yMin`/`g.yMax`, so a
   clamped domain bounds them, and a third loop over the same range added later is bounded
   for free. Clamp the DOMAIN, never the `v` values: rewriting a stored data value would
   distort the drawn curve, whereas an out-of-domain curve simply overflows, which the
   chart already permits (`allowDataOverflow` on both axes).
2. **Three edits, one governing number.** In `composePlan`: clamp `window.endTs` to
   `axisStartTs + PLAN_SPAN_MAX_S`; in `asDays`, drop a day whose `endTs - startTs` is
   outside `[0, PLAN_DAY_MAX_S]` (the existing "a malformed day reads as absent" rule,
   extended from shape to magnitude) and cap the array at `PLAN_DAYS_MAX`.
3. **Constants, all derived from one number except the tide one**, which is a different
   unit and cannot be:
   - `PLAN_DAY_MAX_S = 26 * 3600` — 26 h, because a real fall-back day measured
     **89,999 s (25 h)** in the `dst-fall` family. A 24 h clamp would refuse a conforming
     day; this is the symmetric-difference row that decides the value, and it came from a
     measurement, not from reasoning.
   - `PLAN_SPAN_MAX_S = PLAN_DAYS_MAX * PLAN_DAY_MAX_S` = 1,497,600 s (17.33 d).
   - `PLAN_Y_ABS_MAX_FT = 100` — the largest tidal range on Earth (Bay of Fundy) is about
     53 ft, so 100 ft is roughly 2x margin per side; yields ≤ 101 gridlines and ≤ 101 ticks.

Resulting declared bounds, replacing §8's numbers: `sunTrack` ≤ `1,497,600 / 900 + 32` =
**1,696** samples; `sunPeakByDay` ≤ `16 * (93,600 / 900 + 32 + 1)` = **2,192** evaluations;
`sideAt` ≤ 16 comparisons per evaluation; gridlines and ticks ≤ **101** each.

**Constraint the Engineer must honour, found in scoping:** `entryChunk.test.ts:656`
asserts `closureFrom('lib/plan.ts').files.size === 1`, and `lib/weatherPlan.ts` is on the
forbidden-reach list for the plan modules. So `plan.ts` **cannot import `PLAN_DAYS_MAX`
from `weatherPlan.ts`.** Declare the three constants in `plan.ts` and pin their relation to
`weatherPlan.ts`'s `PLAN_DAYS_MAX` with an equality assertion in the guard — the same
pattern `weatherTidePlanBound.test.ts` already uses for
`PLAN_MAX_CODE_UNITS * 10 === REPLAY_MAX_BYTES`. Moving `PLAN_DAYS_MAX` into `plan.ts`
instead is the alternative; it is a wider refactor (desktop services and tests import it
from `weatherPlan.ts`) and is not recommended for this build.

---

### D4. A clamped plan is truncated SILENTLY — decision, with its reversal condition

No notice, no badge, no copy. Three reasons: every input that trips a clamp is a provider
fault or a hand-edited file, never a user choice, so there is nothing for the reader to do
about it; the Planner's existing posture on this surface is already silent (`asDays` drops
a malformed day, every producer array is capped without comment); and a notice needs
user-facing copy, which pulls in a design pass and the docs/website surfaces — turning a
logic-only Improve into something else for no reader benefit.

**Reversal condition:** if a legitimate provider ever ships a plan whose window genuinely
exceeds `PLAN_SPAN_MAX_S` — OpenWeather extending its daily horizon past 16 entries, or
changing `dt` semantics — the clamp stops being a refusal of nonsense and becomes a silent
truncation of real data, at which point it owes a visible line naming what is shown. The
detector is cheap and should be stated at the clamp: the clamp firing at all on a live
(non-replayed) document is the signal. Per the v1.0.32 rule, this paragraph exists so a
silent non-action and an oversight do not leave the same evidence.

---

### D5. Scope

**Changes:** `frontend/src/lib/plan.ts` (the clamps, the constants, the header's
untrusted-document paragraph); `frontend/src/lib/planChartGeometry.ts`
(`PLAN_Y_ABS_MAX_FT`, the domain clamp in `planGeometry`); `frontend/src/lib/planSun.ts`
(comments only — the header's `<= 1,568` claim at lines 25–28, and the `sunTrack` /
`sunPeakByDay` / `sunAltitudeAt` doc comments, which must name the `sideAt` day scan);
`frontend/src/lib/weatherTidePlanBound.test.ts` (the new guard rows — it is already the
bound guard and the natural home); `pipeline/plan-sun-moon-readout/schema.md` §8 (the
table, plus the two false sentences: "the window is at most 16 days by `PLAN_DAYS_MAX`"
and "flat past `PLAN_DAYS_MAX` because the composer caps `days`" — the composer caps
nothing today and the producer caps the COUNT, not the SPAN); `ROADMAP.md` (both items
rewritten as DONE, carrying the live-path correction); `DECISIONS.md`; and the four-file
version set (`frontend/package.json`, `src-tauri/tauri.conf.json`, `CHANGELOG.md`,
`website/index.html` pill text + `aria-label` + footer).

**Does NOT change:** `PlanChart.tsx` (inherits the clamped domain — see D3.1);
`PlanResult.tsx`, `planMoon.ts`, `planPick.ts`, `planReadout.ts`, `planDaysInView.ts`,
`planCopy.ts`; any CSS, token, copy string or layout. **No backend or desktop-twin
change**: the clamp lives in `composePlan`, which is TypeScript-only and runs on every
platform for both transports, so there is no twin to keep in parity — the same reasoning
`planSun.ts` already records for itself (schema D5). `backend/services/plan_weather.py`,
`plan_tide.py` and the two `lib/tauri` services are untouched.

**Out of scope and left open:** the producer array-LENGTH caps that `composePlan` does not
re-apply (`cells`, `events`, `curve`) — its own ROADMAP line. Only `days` is capped here,
because only `days` drives a loop.

---

### D6. Verification shape owed to The Tester

1. **Sample-count bound.** Over a roster of hostile replayed documents — window spans of
   16 d / 1 y / 16 y / `Number.MAX_SAFE_INTEGER`, day counts of 16 / 2,000 / 20,000, and
   per-day spans of 1 d / 365 d — assert
   `sunTrack(buildSunModel(composePlan(doc, null))).length <= 1696` and
   `sunPeakByDay(...)` bounded, in every combination.
2. **Gridline bound.** Derive the count exactly as `PlanChart` derives it, from
   `planGeometry` over tide curves with `v` at ±1e3 / ±1e6 / ±1e9 / ±`Number.MAX_VALUE`;
   assert ≤ 101 for both the gridline and the y-tick loop.
3. **Growth check** with an **explicit `testTimeout`** (`frontend/vite.config.ts` sets
   none, so the silent default is 5,000 ms — the v1.0.32 note about
   `weatherStatsShared.test.ts` landing at 4,696 ms and then tipping over on the next
   runner). Assert a same-run RATIO (hostile vs. conforming) rather than a wall clock, and
   argue the absolute budget from the measured conforming cost (1.22 ms at 16 d) with
   stated headroom, not from the shipped number plus a margin.
4. **Red-first mutation per clamp, four of them, each named:** remove the window-span
   clamp → row 1 fails; remove the day-count cap → the 20,000-day row fails; remove the
   day-span drop → the 365-d-per-day row fails; remove the y-domain clamp → row 2 fails.
5. **Symmetric difference, both directions** (`.claude/rules/testing.md`, v1.0.32). This
   build REPLACES `asDays`'s admission predicate. Direction 1 (what the new predicate
   newly refuses) is the point of the build; **direction 2 — which days admitted today the
   new predicate would refuse — is where the defect lives**, and the 25-hour `dst-fall`
   day is the known row. Do not hand-roster it: sweep every DST transition in the fixture
   zones over several years and assert every resulting day span is admitted. A 32-row
   fixture can only report on its own 32 rows.
6. **Non-regression on conforming input.** Every fixture family was measured clearing every
   clamp (window span 4.37–7.75 d, day span ≤ 89,999 s, max |v| 5.08 ft, ≤ 760 samples);
   pin that as a headroom row so a later clamp tightening cannot silently start truncating
   real plans. Note for coverage: **no fixture family has more than 8 days**, so the 16-day
   producer cap is never exercised by the fixture and the 16-day figures above come from
   synthetic documents.

---

## Stage 2 — The Engineer (2026-09-22)

Built on the Spool bundle branch `weft-spool/20260922-052116`, on top of `af15ed2`.
No commit, no version bump (the bundle takes one bump at the flush). Every figure
below is a measurement on the dev Mac with nothing else compiling.

---

### E1. What was built, and where each clamp sits

Two chokepoints, exactly as D3 chose. Four loops inherit their ceiling.

| # | Clamp | File | Shape |
|---|---|---|---|
| 1 | window span | `lib/plan.ts`, `composePlan` | `const endTs = Math.min(w.endTs, w.axisStartTs + PLAN_SPAN_MAX_S)` |
| 2 | day count | `lib/plan.ts`, `asDays` | `if (out.length >= PLAN_COMPOSE_DAYS_MAX) break` |
| 3 | per-day span | `lib/plan.ts`, `asDays` | `const span = d.endTs - d.startTs; if (!(span >= 0 && span <= PLAN_DAY_MAX_S)) continue` |
| 4 | y domain | `lib/planChartGeometry.ts`, `planGeometry` | `Math.max(-PLAN_Y_ABS_MAX_FT, ...)` / `Math.min(PLAN_Y_ABS_MAX_FT, ...)` plus a degenerate fallback |

`components/PlanChart.tsx` is not edited, as D3.1 required.

Constants, as D3 fixed them: `PLAN_DAY_MAX_S = 26 * 3600`, `PLAN_COMPOSE_DAYS_MAX = 16`,
`PLAN_SPAN_MAX_S = PLAN_COMPOSE_DAYS_MAX * PLAN_DAY_MAX_S = 1,497,600` in `lib/plan.ts`;
`PLAN_Y_ABS_MAX_FT = 100` in `lib/planChartGeometry.ts`.

**Naming, one deviation worth stating.** D3 said "declare the three constants in
`plan.ts`". The day-count one is named `PLAN_COMPOSE_DAYS_MAX`, not `PLAN_DAYS_MAX`,
because the guard imports it in the same file as `weatherPlan.ts`'s `PLAN_DAYS_MAX` to
pin them equal, and two identically-named exports meaning the same thing is the drift the
pin exists to catch. The `entryChunk.test.ts:656` closure constraint is honoured: nothing
new is imported into `lib/plan.ts` (`closureFrom('lib/plan.ts').files.size === 1` still
passes), and `lib/planSun.ts` is comment-only so its own `files.size === 1` pin holds.

**Two decisions the brief did not specify.**

1. **The clamped window's end LABEL is blanked.** `window.endLocal` was computed by the
   producer for the UNCLAMPED instant, so after a clamp the document would otherwise
   print a "through <time>" label for a moment the chart no longer reaches
   (`PlanChart.tsx:489` and `PlanResult.tsx:507` both format it). `endLocal` reads as
   `''` when and only when the clamp fired. This introduces no copy and no new reachable
   value: `''` is already what the merge writes for a non-string `endLocal`, so both
   consumers already survive it. Still silent per D4.
2. **The y-domain clamp needs a degenerate fallback.** A curve lying WHOLLY beyond the
   ceiling on one side (every `v` above +100 ft, or every `v` below -100 ft) collapses
   `[yMin, yMax]` to a point, and `planGeometry`'s `y` divides by `yMax - yMin`, giving
   `Infinity`. Such a curve falls back to the default `[-1, 7]` domain and overflows it,
   which is what every other out-of-domain curve already does (`allowDataOverflow` on
   both axes). Two rows in the guard cover it.

---

### E2. The guard: a new file, and why

`frontend/src/lib/planSpanBound.test.ts` (54 rows) plus
`frontend/src/lib/planSpanBound.golden.json` (12 rows, 1.4 KB).

**D5 named `weatherTidePlanBound.test.ts` as "the natural home"; it is not, and the
reason is the timeout.** That suite is three rows about the SERIALIZED SIZE of the stored
halves through the SHIPPED PRODUCERS on one fixture family. This guard is about LOOP
COUNTS through the MERGE over documents no producer wrote, and it carries a deliberately
expensive growth row that must state its own `testTimeout` (v1.0.32). Merging the two
would hang that timeout question over three rows with no timing in them, and would triple
the size of a file whose subject is one sentence long. Both files now use the same pinning
pattern, which is the part worth sharing: `weatherTidePlanBound.test.ts` pins
`PLAN_MAX_CODE_UNITS * 10 === REPLAY_MAX_BYTES`, and this one pins
`PLAN_SPAN_MAX_S === PLAN_DAYS_MAX * PLAN_DAY_MAX_S`.

Rows, against the brief's list:

| Owed | Rows |
|---|---|
| (a) sample bound over hostile replayed documents | 24 combination rows: window span 16 d / 1 y / 16 y / `MAX_SAFE_INTEGER` x day count 16 / 2,000 / 20,000 x per-day span 1 d / 365 d. Each asserts the composed window span, the day count, every day's span, `sunTrack(...).length <= 1,697` and the counted `sunPeakByDay` evaluations |
| (a) the LIVE-reachable shape | one row: 24 daily entries 365 d apart through `buildWeatherPlan`, asserting the producer really does emit 16 days spanning over 5,000 d, then that the merge clamps it |
| (b) `sunPeakByDay` and the `asDays`/`sideAt` pair | `peakEvaluations(model)` counts the loop's own iterations from the model (not an estimate) and is bounded at 1,728; `model.days.length <= 16` on every hostile row |
| (c) gridline count from an extreme `v` | 4 magnitude rows (1e3 / 1e6 / 1e9 / `MAX_VALUE`) plus the two degenerate rows, each deriving the count exactly as `PlanChart.tsx:377` and `:640` derive it |
| (d) the two files cannot drift | three constants rows: the product relation, each constant pinned by VALUE, and the three declared ceilings (1,697 / 1,728 / 101) derived from the constants so `planSun.ts` and `schema.md` cannot drift from the code |
| (e) the `dst-fall` 89,999 s day | one fixture row plus the swept direction-2 row below |
| (f) growth with an explicit `testTimeout` | two rows, `TIMEOUT_MS = 20_000` |
| (g) conforming fixtures byte-identical | 12 per-family rows against a golden taken from HEAD's `plan.ts`, plus a non-vacuity row |

**The gridline counter carries a hard iteration cap, and that is not belt and braces.**
With clamp 4 mutated out and `v = Number.MAX_VALUE`, `Math.ceil(yMin)` is about -1.8e308
and `v += 2` does not advance it at all, so the shipped loop does not merely run long, it
never terminates. A red-first mutation has to FAIL, not hang.

**(g) is a real before/after, not a self-consistency check.** The golden was generated by
importing `git show HEAD:frontend/src/lib/plan.ts` and `...planChartGeometry.ts` as
scratch modules and hashing `JSON.stringify(composePlan(...))` per family, with the
scratch modules deleted afterwards (the tree is clean). Each row pins a SHA-256 and a
length, plus `yMin`/`yMax` from the pre-clamp geometry and the pre-clamp `sunTrack` /
`sunPeakByDay` counts. All 12 are byte-identical after the change.

---

### E3. Measured headroom: every conforming family clears every clamp

Through `composePlan` over each family's stored halves. `days` in equals `days` out for
all twelve; no family trips any clamp.

| family | days | window span | max day span | samples | max abs v | gridlines |
|---|---|---|---|---|---|---|
| reference | 8 | 7.37 d | 86,399 s | 723 | 4.61 ft | 4 |
| subordinate | 8 | 7.37 d | 86,399 s | 723 | 4.51 ft | 4 |
| **dst-fall** | 8 | 7.42 d | **89,999 s** | 725 | **5.08 ft** | 5 |
| dst-spring | 8 | 7.33 d | 86,399 s (min 82,799) | 717 | 4.57 ft | 4 |
| far-station | 8 | 7.25 d | 86,399 s | 711 | 4.61 ft | 4 |
| gap | 8 | 7.37 d | 86,399 s | 723 | 4.61 ft | 4 |
| no-hourly | 8 | 7.37 d | 86,399 s | 723 | 4.61 ft | 4 |
| five-daily | 5 | **4.37 d** | 86,399 s | 429 | 4.61 ft | 4 |
| polar | 8 | 7.46 d | 86,399 s | 722 | 5.02 ft | 5 |
| now-in-hour | 8 | **7.75 d** | 86,399 s | **760** | 4.61 ft | 4 |
| same-minute-high | 8 | 7.37 d | 86,399 s | 723 | 4.61 ft | 4 |
| maximal | 8 | 7.37 d | 86,399 s | 723 | 4.61 ft | 4 |

Against clamps of 17.33 d, 93,600 s, 1,697 samples, 100 ft and 101 gridlines. **No fixture
family failed to clear a clamp.** Stage 1's figures reproduce exactly (4.37 to 7.75 d,
89,999 s, 5.08 ft, at most 760 samples).

**Direction 2 of the symmetric difference is SWEPT, not rostered** (D6 item 5). Every
calendar day of 2024 through 2030 in the three fixture zones (`America/Los_Angeles`,
`America/New_York`, `America/Anchorage`), constructed through the producer's own
`localMidnightTs(date) .. localMidnightTs(date + 1) - 1`: **7,671 days scanned, 42 of them
DST days, longest 89,999 s, shortest 82,799 s, none refused.** The row asserts those four
figures so it cannot go vacuous. A second swept row takes 16 consecutive days from every
start in the same range and asserts the widest possible producer window is under
`PLAN_SPAN_MAX_S`.

---

### E4. Red-first: four mutations, four named failing rows

Each clamp removed alone, the discriminating row run with `-t`, then the file restored and
verified byte-identical by SHA-256 against a pre-mutation snapshot (both files `OK`).

| mutation | row run | failure |
|---|---|---|
| clamp 1: `const endTs = w.endTs` | `window 1 y, 16 days of 1 d` | `expected 31536000 to be less than or equal to 1497600` |
| clamp 2: the `break` deleted | `window 16 d, 20000 days of 1 d` | `expected 20000 to be less than or equal to 16` |
| clamp 3: the span `continue` deleted | `window 16 d, 16 days of 365 d` | `expected 31536000 to be less than or equal to 93600` |
| clamp 4: `Math.max`/`Math.min` removed | `tide v at +/- 1e3` | `expected -1000.6 to be greater than or equal to -100` |

Each run: `1 failed | 53 skipped`. Note that for clamps 1 and 3 the failing assertion is
the document-level one, which precedes the `sunTrack` / `peakEvaluations` assertions in
the same row; those would fail too, but the document assertion is the direct statement of
the clamp and is what is recorded. Clamps 1 and 4 were mutated only for rows that fail
FAST: with clamp 1 out, the `MAX_SAFE_INTEGER` rows do not finish, and with clamp 4 out
the `MAX_VALUE` row does not terminate at all (see E2).

---

### E5. Timing, and the absolute budget argued from it

Whole clamped chain (`composePlan` + `buildSunModel` + `sunTrack` + `sunPeakByDay`),
three runs of five repetitions, warmed:

| document | ms per chain |
|---|---|
| conforming `maximal` | 0.584 / 0.635 / 0.654 |
| hostile A: 16 y window, 2,000 days of 1 d | 0.963 / 1.008 / 1.012 |
| hostile B: 32 y window, 4,000 days of 1 d | 0.955 / 1.059 / 1.099 |
| 16 days each spanning 365 d (all dropped) | 0.397 / 0.501 / 0.515 |

`BUDGET_MS = 300`, about **270x** the worst measured row. `TIMEOUT_MS = 20_000`, stated
explicitly on both growth rows because `frontend/vite.config.ts` sets no `testTimeout` and
the silent default is 5,000 ms (the v1.0.32 `weatherStatsShared.test.ts` rule). The whole
file runs in 612 ms of test time, so even the inherited default would have had 8x headroom;
the explicit timeout is there so the next person does not have to re-derive that.

The ratio row asserts B < A * 2.5 + 1, i.e. **flat rather than doubling**: `asDays` breaks
at 16 admitted days, so doubling a 2,000-entry array to 4,000 costs nothing downstream,
and the window clamp holds both at the same sample ceiling. Unclamped, hostile A does not
finish at all (its window asks for 1.001e13 samples), so the budget is answering a
linear-versus-unbounded question with orders of magnitude between the answers.

---

### E6. Records corrected

- **`lib/planSun.ts` header.** The `<= 1,568 at PLAN_DAYS_MAX` claim is replaced with the
  four bounds the code has, each naming its constant and its derivation, plus a paragraph
  saying WHY the old figure was wrong (a day-COUNT cap at the producer never bounded a
  window SPAN, and the merge re-applied nothing). The `sunTrack`, `sunPeakByDay` and
  `sunAltitudeAt` doc comments are corrected too; `sunAltitudeAt`'s now names the `sideAt`
  walk over `model.days`, the term the schema's table omitted and the one that makes
  `sunPeakByDay` times `sideAt` quadratic in the day count.
- **`pipeline/plan-sun-moon-readout/schema.md` section 8.** A dated correction note at the
  top of the section; the `buildSunModel`, `sunTrack` and `sunAltitudeAt` rows rewritten;
  a new `sunPeakByDay` row and a new gridline/y-tick row (neither was declared at all);
  and the closing sentence's "flat past `PLAN_DAYS_MAX` because the composer caps `days`"
  corrected, with what was false in each half stated rather than quietly replaced.
- **`.claude/rules/security.md` frontmatter.** `frontend/src/lib/plan.ts`,
  `planSun.ts`, `planChartGeometry.ts` and `frontend/src/components/PlanChart.tsx` added
  to `paths`. Body untouched. This is the v1.0.32 obligation applied to the rule's own
  named instances: the linearity rule's two shipped examples are the gridline loops and
  the quarter-mark sun loops, and neither file loaded the rule that names it.
- **No guard reads rule frontmatter.** There is no `securityRulePaths`-style suite in this
  repo; every `.claude/rules/` reference in `frontend/src` is a comment. The
  citation-checking guard CLAUDE.md wants (a `cacheInventory.test.ts`-shaped test that
  extracts path-shaped citations from rule bodies and fails on one that matches nothing)
  remains a ROADMAP item and is out of scope here.

---

### E7. Verification run, exact counts

In `frontend/`, on the final tree:

| command | result |
|---|---|
| `vitest run src/lib/planSpanBound.test.ts` | **54 passed**, 612 ms of test time |
| the 19 plan / weatherPlan / replay / entryChunk lib suites | **492 passed, 1 skipped**, 18 files passed, 1 skipped |
| `PlanResult` + `PlanChart*` + `WeatherForecastPanel*` component suites | **121 passed**, 4 files |
| `npm run typecheck` | clean |
| `npm run lint` | clean |
| `npm run build` | built in 805 ms, no new chunk-size warning |
| `npx vitest run` (whole frontend suite) | **7,333 passed, 3 skipped**, 355 files passed, 2 skipped, 52.08 s |

The entry-chunk pins specifically: `closureFrom('lib/plan.ts').files.size === 1`,
`closureFrom('lib/planSun.ts').files.size === 1` and
`closureFrom('lib/planChartGeometry.ts').files.size === 2` all still pass, so no clamp
brought a new import onto the entry graph.

No em dash (U+2014) in any line this build added, checked per file.

---

### E8. Left open, deliberately

- `composePlan` still does not re-apply the producer's array-LENGTH caps for `cells`,
  `events` and `curve` (its own ROADMAP line). Only `days` is capped here, because only
  `days` drives a loop. Unchanged from D5.
- The backend and the desktop twins are untouched: the clamp lives in `composePlan`,
  which is TypeScript-only and runs on every platform for both transports, so there is no
  twin to keep in parity.
- `sunPeakByDay`'s `if (!(d.endTs >= d.startTs)) return null` branch is now unreachable
  through the merge (clamp 3 drops such a day). It stays, for a model built by hand, and
  the doc comment says so.

---

## Stage 4 ride-along: the Auditor's Medium, closed in place (2026-09-22)

The security report's one Medium: the span clamps bound the SPAN and not the loop
variable's MAGNITUDE, so from |t| >= 2^63 (about 9.223e18) one ulp of a double exceeds
the 900 s quarter step, `t += QUARTER` rounds back to `t`, and neither `sunTrack` nor
`sunPeakByDay` terminates. Closed in code, at the same chokepoint D3 chose, plus the two
Informational sentences. Not a version bump of its own; it rides the bundle.

### R1. The fix, and the one deviation from the brief, which is a UNIT

`PLAN_TS_ABS_MAX` joins the three constants in `lib/plan.ts`. `composePlan` refuses a
window (the same null an absent window already returns) and `asDays` drops a day (like any
other unusable day) whose own instants are not inside it.

**The brief specified 8.64e15. The shipped constant is 8.64e12, and the difference is not
a preference: it is the ECMAScript Date range converted into this document's unit.** Every
instant here is an epoch SECOND and reaches a `Date` as `t * 1000`; the Date range is
+/- 8.64e15 MILLISECONDS, so it is +/- 8.64e12 seconds. The unconverted figure was not a
harmless 1000x of headroom. It admits the band in which a SECOND, different loop hangs,
and the first draft of this guard found it the hard way: with the constant at 8.64e15 the
new boundary row ran a vitest worker at 96% CPU for minutes. `solarNoonTs`'s whole-day
normalization (`planSun.ts`, two `while` loops stepping 86,400 s) runs |eot| / 1440 times,
and `eot` is unbounded, because `eps0` carries a `jc^3` term that sends `tan(eps / 2)`
through a pole. Measured, closed form over the iteration count rather than by running it:

| |t| admitted | worst normalization iterations (sweep, 200,001 instants x 5 longitudes) |
|---|---|
| 1e10 / 1e11 / 5e11 / 1e12 | 1 |
| 2e12 | 8 |
| 4e12 | 1.92e17 |
| **8.64e12 (the shipped constant)** | **9.19e18 at ts = 4,979,577,600,000** |
| 8.64e15 (the brief's figure) | 7.78e20 |

`endTs` on the window deliberately keeps the weaker `isNum`: the span clamp already pins it
to `axisStartTs + PLAN_SPAN_MAX_S`, so a bounded anchor bounds the composed end for free,
and testing it would REFUSE the `MAX_SAFE_INTEGER`-ended documents this merge exists to
TRUNCATE. One row states that decision so it cannot be tidied away.

### R2. THE SECOND MECHANISM, CLOSED IN THE SAME BUILD

The magnitude guard closes the STEP: for every document the merge admits, both quarter-mark
loops advance, by an ulp argument rather than a sampled one. It did NOT close
`solarNoonTs`'s whole-day normalization, which lives one level down the call graph and
whose cost is driven by `eot` rather than by the instant's magnitude -- measured worst
inside the admitted range 9.19e18 iterations at `aroundTs = 4,979,577,600,000`, a hang.
That was first recorded here as a named residual with its one-line fix. **It is now
CLOSED rather than deferred**, because a residual inside the range the new guard admits
leaves the build's own totality declaration with an unnamed hang path.

`planSun.ts` gains `wholeDayNormalize(noon, aroundTs)`, one arithmetic step, and
`solarNoonTs` calls it. The cost is O(1) at every magnitude.

**The rounding is half-TOWARD-ZERO, not `Math.round`, and that is the whole subtlety.**
The loop's conditions are strict (`> 43200`), so an offset of exactly +43,200 s stays
where it is; `noon -= 86400 * Math.round(off / 86400)` -- the one-liner this file named
as the fix -- would move it a whole day, to -43,200. The tie is reachable and ordinary:
lng 0, `eot` 0, `aroundTs` at a UTC midnight. The shipped form is
`Math.sign(off) * Math.ceil(Math.abs(off) / 86400 - 0.5)`.

**What is claimed at the pathological instant, measured rather than assumed.** The old
code did not return for it at all. The closed form returns in one step -- but it does not
land within half a day, and no arithmetic could: `eot` there puts the un-normalized noon
about 7.9e23 s away, where one ulp of a double is about 1.3e8 s. It lands 34,326,528 s out
(397 days), which is the ulp floor rather than a loop remnant. The guard row asserts the
properties that are true and bounded (it terminates, it is finite, the residue is 16 orders
of magnitude under the offset it started from) and asserts the exact half-day postcondition
at magnitudes where half a day is representable (1.79e9, +/- 2e12). Writing the
unrepresentable assertion first is what surfaced this: it failed with
`expected 34326528 to be less than or equal to 43200`.

### R3. The rows, and why they walk a capped REPLICA before the real function

Ten rows added to `planSpanBound.test.ts` (54 -> 64).

| row | asserts |
|---|---|
| `the constant is the ECMAScript Date range IN THIS DOCUMENT'S UNIT, and the mechanism is real` | the value, `PLAN_TS_ABS_MAX * 1000 === 100,000,000 * 86,400,000`, that the step advances at the constant and does not at 2^63 / 1e19 / MAX_VALUE, and that the replica catches a non-advancing walk |
| `sunTrack: a window anchored at 1e19 is refused` | refusal |
| `sunTrack: a window anchored at -1e19 is refused` | refusal |
| `sunTrack: a window anchored at Number.MAX_VALUE is refused` | refusal |
| `sunTrack: a window anchored at -Number.MAX_VALUE is refused` | refusal |
| `sunTrack: the window boundary, inside admitted and at the constant refused` | both signs: inside admitted and its 96-sample track walked for real, at the constant refused |
| `an absurd endTs is still TRUNCATED rather than refused: the anchor test does not swallow the span clamp` | the `MAX_SAFE_INTEGER` window still composes and lands exactly on `PLAN_SPAN_MAX_S` |
| `sunPeakByDay: a zero-span day at 1e19 is dropped` | a span-0 day (which clamp 3 admits) is dropped on magnitude |
| `sunPeakByDay: a zero-span day at -1e19 is dropped` | the negative twin |
| `sunPeakByDay: the day boundary, inside admitted and at the constant refused` | both signs: inside kept with a real 86,399 s span and >90 peak evaluations, at the constant dropped |

Every row composes AND THEN WALKS BOTH LOOPS over what the merge admitted, because the
Auditor's third point was that the earlier corpus never drove them. **But it walks a
capped replica FIRST, and that shape is load-bearing rather than defensive: a `testTimeout`
CANNOT interrupt a synchronous loop.** The timer that would fire sits behind the same
blocked thread. Measured: the first draft stated `testTimeout` 5,000 ms and still ran a
worker at 96% CPU for minutes with nothing failing. So the brief's expectation ("vitest
kills at the timeout") does not hold for this defect class, and the rows use the
`GRID_SAFETY` device this file already carries for the identical reason on the gridline
loop -- `quarterMarkSteps`, the shipped walk verbatim with a `STEP_SAFETY` cap, asserted
before any real call. `MAGNITUDE_TIMEOUT_MS = 5_000` is still stated on each row, as the
brief asked, as the backstop for anything asynchronous.

### R4. Red-first, three mutations

**(a) The magnitude guard.** `isTs` mutated to `isNum` alone, the magnitude describe run
with `-t`: **8 failed | 2 passed | 54 skipped, in 14 ms of test time -- red, not hung.**
First assertions: `expected 10000000000000000000 to be less than 8640000000000` (the 1e19
window), `expected 1.7976931348623157e+308 to be less than 8640000000000` (MAX_VALUE),
`expected 8640000000000 to be less than 8640000000000` (both boundary rows). The 2 that
pass are the constant row and the truncation row, neither of which depends on the guard.

**(b) The normalization's rounding.** `wholeDayNormalize` mutated to
`Math.round(off / 86400)`: **2 failed | 2 passed | 64 skipped**, both with
`expected -43200 to be 43200`, one from the dedicated tie row and one from the corpus row
at `aroundTs 0 eot 0 lng 0`. The corpus row only caught it after UTC midnights were added
to the anchor list -- under the first corpus it passed, which is the 32-row lesson in
`.claude/rules/testing.md` arriving on schedule: the anchors were all mid-day, so the tie
was structurally unreachable. Recorded because the fix was to the CORPUS, not the code.

**(c) The loop itself.** Restored verbatim inside `solarNoonTs` and driven at
`aroundTs = 4,979,577,600,000` OUT OF THE SUITE, through a vite-SSR probe with a wall
clock: **no return after 35 s at 99% CPU**, against 0 ms for the closed form. It is out of
the suite on purpose and the reason is the same one the magnitude rows already turn on: a
synchronous loop cannot be interrupted by `testTimeout`, so this mutation HANGS a vitest
worker instead of turning a row red. That is the defect, and a suite cannot express it.
What the suite does express is the capped replica (`oldWholeDayLoop`, cap 100,000), which
states the same fact structurally: fed an offset of this size the old loop does not finish.

All three files restored and verified byte-identical by SHA-256 -- `lib/plan.ts`
`52f2add4908892f08fb5ff7faadc05dec6b9a375da084e14f83102c78e7b5b94`, `lib/planSun.ts`
`179ba84fa870d58673da6bacac4e046a491113ae192d6f6b5485fdc7a490a0fe`.

### R5. The two Informational items, and verification

- **`sunPeakByDay` scans ALL anchors per day**, filtered by `dayIndex`: <= 32 per day and
  <= 512 per plan, of which at most 2 are evaluated. The 1,728 figure is an EVALUATION
  ceiling and stays correct; the iteration count is the 512. Corrected in `planSun.ts`'s
  doc comment and in `schema.md` section 8's row.
- **`PLAN_Y_ABS_MAX_FT`'s effective no-change boundary is 98 ft up and 99 ft down**, not
  100, because the clamp lands on the PADDED domain. One sentence at the constant; the
  margin over the 53 ft record holds either way (1.85x and 1.87x).

| check | result |
|---|---|
| `planSpanBound.test.ts` | **68 passed** (was 54: 10 magnitude rows, 4 normalization rows), 809 ms of test time |
| `plan*` / `planSun*` / `planChart*` / `weatherPlan*` / `replayStore*` / `entryChunk` / `PlanChart` / `PlanResult` | **15 files, 495 passed** |
| `npm run typecheck`, `npm run lint` | clean |
| stray vitest workers after the hang probes | none (`pgrep -fl vitest` clear; the one probe process I started was killed) |
| residual list after this ride-along | **empty**: no iteration count in `planSun.ts` now depends on a magnitude the merge does not bound |
| the golden's 12 conforming families | byte-identical, SHA and length unchanged -- a magnitude guard touches no conforming document |

## Delta QA F1, closed as a Case 1 correction (2026-09-22)

The Tester's delta pass found the `PLAN_TS_ABS_MAX` comment in `plan.ts` citing
"1.3e11 loop iterations at 8.64e15" as the reason not to take the unconverted Date
figure. That number is the single-endpoint reading, appears nowhere in R1 (which
records 7.78e20 there and 9.19e18 inside the admitted range), and read as an argument
for the wider bound. It was also stale in a second way: once R2 replaced the
normalization loop with a closed form, no band of the range hangs, so the constant
no longer needs that justification at all. The sentence now states that the constant
stands on the Date-range provenance alone and that the loop was closed rather than
bounded, citing R1 and R2. Comment only; no code, test or golden changed.

## Delta audit, records correction (2026-09-22)

Three sentences in this build's records say "only `days` drives a loop". That is
inaccurate as a statement about the merge: `composePlan` also maps over `events`, and
`tideAtEvent` makes one pass over `turningPoints`, one over `curve` and a third through
`interpAtEpoch`, so the `events` x `curve` pair is quadratic over two uncapped untrusted
arrays, and `cells` and `nightSpans` carry no length cap either. What is true is that
only `days` drives a loop whose count depends on a MAGNITUDE, which is what this build
bounds. The array-length caps remain deliberately out of scope with their existing
ROADMAP line; the Chronicler carries the shape (quadratic `events` x `curve`, not just
"array-length caps") into that line. Two prose Informationals from the delta audit stay
open and are carried the same way: the mechanism is worded as `ulp > step` where the
firing condition is `step < ulp/2` (threshold and code are correct), and the
`PLAN_TS_ABS_MAX` comment's "no magnitude bound could close it" was corrected in place
to "no bound with a defensible provenance".

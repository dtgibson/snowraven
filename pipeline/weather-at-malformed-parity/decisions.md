# Decisions — Weather At Malformed Parity

Every table here was measured by driving the real builders, the real formatter
and the real routes over one conforming body from
`frontend/src/lib/weatherTidePlan.fixture.json` (families[0].onecall), before
the repair was written and again after it. Probe scripts ran from this session's
scratchpad and are not committed; the shipped equivalent is
`frontend/src/lib/weatherAtMalformed.fixture.json`, which both parity suites
drive.

**The brief's own numbers were measured over 82 shapes. This build widened the
matrix to 203 and the counts moved, so every figure below is the 203-row
figure** — the brief's 63/59/4 are a subset of the same finding, not a
disagreement. The direction and the inversion it names both reproduced exactly.

---

## 0. The measurement, before and after

| | at v1.0.31 | after |
|---|---|---|
| Builder pair (`buildWeatherPayload` ↔ `build_weather_payload`), 203 shapes | **124 diverge** | **0** |
|  · desktop answered where web/Pi refused | 107 | 0 |
|  · web/Pi answered where desktop refused (the INVERSION) | 8 | 0 |
|  · both answered, different figures | 9 | 0 |
| Accepting rows whose **copy block** contained `NaN` (desktop) | 31 | 0 |
| Rows where the backend answered `tempF: 0` | 5 | 0 |
| Rows where the backend invented a condition | 6 | 0 |
| Plan pair (`buildWeatherPlan` ↔ `build_weather_plan`), same 203 shapes | **58 diverge** | **0** |
| Formatter pair (`formatWeather` ↔ `format_weather`), 50 hour shapes | **28 disagree** | **0** |
|  · accepted by `format_weather` | 9 | 0 |
|  · accepted by `formatWeather` | 37 (8 with `NaN` in the text) | 0 |

Red-first, against the unfixed builders with the new suites in place:
**153 of 588** backend rows and **159 of 613** frontend rows fail. The six source
files were reverted with `git show HEAD:<path>`, measured, and restored, with
`shasum -a 256 -c` confirming all six byte-identical afterwards.

---

## 1. The refusal goes in the SHARED DEPENDENCY, not in either symptom (2026-09-16)

**Decision:** one predicate and one hour-validator per runtime, defined in the
formatter module and imported by the forecast module:
`isFiniteFigure` / `assertHourReading` in `frontend/src/lib/weatherFormatter.ts`,
`is_finite_figure` / `assert_hour_reading` in `backend/formatters/weather.py`.
`buildWeatherPayload` / `build_weather_payload` call the whole validator on the
one adapted hour they read; `formatWeather` / `format_weather` call it in its two
halves, per the fields each response they read actually contributes — see
decision 11, which corrected this line from "on every response they read".

**Why not `forecastSlice.ts` alone**, which is what the idea asked for. Measured:
that closes 107 of the 124 divergent rows and leaves 8 open **while removing the
only side that still refused them.** All 8 are bodies web/Pi answered `200` for:

| Shape (`daily` tier) | web/Pi at v1.0.31 | desktop at v1.0.31 |
|---|---|---|
| `temp` absent or null | 200, `tempF: 0`, `H 0° · L 0°`, "Clear sky" | refused |
| `weather` absent or null | 200, `☀️ "Clear sky"` — fabricated | refused |
| entry carrying only `dt` | 200, every figure `0`, "Clear sky", "Calm" | refused |
| `weather` null on the selected entry | 200, fabricated "Clear sky" | refused |

Plus two `current`-container shapes (`{}` and `[]`) where Python's truthiness
answered out-of-range and the TS side refused.

**Why the formatter too, rather than only the two builders.** `formatWeather` is
called directly by the desktop checklist lookup
(`lib/tauri/weatherService.ts` `getWeather`), so it is a strictly wider surface
than `/weather/at` — and it is the one whose output a user **pastes into a public
eBird checklist**. Measured over 50 hour shapes, it produced pasteable text for
37 of them: `Temperature: NaN - NaN°F`, `Temperature: 0°F` from a null,
`Wind: Calm` from a null speed, `Wind: Gale` from the string `"warm"`, and an
empty condition line. Its Python twin refused 41. Putting the guard in the
formatter closes `/weather/{checklist_id}` on both transports for free, which is
the scoping call the brief made and the reason it made it.

---

## 2. `weatherPlan.ts`'s v1.0.29 guards are DELETED, and that is measured (2026-09-16)

**Decision:** `assertNumericEntry`, the finite sweep in `toPlanWeather` and the
daily-`temp` checks in `dailyReading` are removed. `weatherPlan.ts` now refuses
nothing on its own; both plan builders rely solely on the delegate, which is the
symmetry `plan_weather.py` always had.

**The measurement.** With the delegate repaired, `buildWeatherPlan` was driven
over all 203 shapes with the guards present and then removed:
**0 of 203 rows differ** — same verdict, same document, byte for byte — and both
configurations match `build_weather_plan` on every row. The guarded file was
restored from a saved copy and verified by `shasum -a 256`.

**The structural argument, which is why that is not merely lucky.** Every
`PlanWeather` in the document comes from `toPlanWeather`, reachable only from
`weatherAt`, which always calls `buildWeatherPayload`. That sentence is the
load-bearing one and is sufficient by itself: whatever slice the delegate
selects, it validates.

**`weatherAt` has THREE call sites, not two — corrected in QA (F-10).** This
decision originally said "the two single-entry callers", which is accurate about
those two and is not the complete set of paths into the delegate:

| Call site | What it hands the delegate |
|---|---|
| `hourlyReading` (`weatherPlan.ts:113`) | `{hourly:[h]}` at `h.dt` — exactly the entry it is validating |
| `dailyReading` (`weatherPlan.ts:120`) | `{daily:[d]}` at `d.dt` — likewise |
| the sunrise/sunset event loop (`weatherPlan.ts:193`) | the **FULL** response at an arbitrary event instant; the delegate picks the tier |

Both single-entry callers are already past this file's finite-`dt` boundary
filter, so there the validated slice **is** that entry. The third weakens
nothing — the delegate validates whatever it selects — and it is in fact **what
shadows the three guard branches that never fired** when the deleted guards were
reinstated and instrumented (`toPlanWeather`'s figure sweep, its daily sweep,
`dailyReading`'s bounds check): the delegate had already refused, earlier, at
that call. Three unfired branches are the shadowing, not a hole, and the
field-by-field reading below covers them independently of the matrix. Worth one
clause because this comment is the durable argument for a deleted guard set.

**They were not redundant before this build**, and the same matrix says so: the
plan pair diverged on 58 of these 203 rows at v1.0.31. Deleting them is a
consequence of the repair, not a claim they never earned their keep.

**Reversal condition.** If a `PlanWeather` is ever built from anything other
than a `buildWeatherPayload` summary, this file owes its own refusal again.
Guarded from the plan's side: `weatherAtMalformedParity.test.ts` carries a
`planVerdict` column asserted over all 203 rows on both runtimes, so weakening
the delegate turns the plan suite red here rather than only on Predict.

---

## 3. `/weather/{checklist_id}` is IN scope (2026-09-16)

**Decision:** in, as the brief scoped it, and closed by the formatter guard
rather than by anything route-specific.

**Why.** It is the other single-moment weather lookup, one call away, sharing
`formatWeather`. The preceding build's own convention flag is the reason: *a rule
applied only where a brief points leaves its neighbours one call away.* Measured,
the desktop twin accepted 37 of 50 malformed hour shapes where the Python twin
accepted 9.

**What this adds on the backend: nothing behavioural.** `/weather/{checklist_id}`
already answered 502 for 41 of the 50; the explicit guard makes that reachable
for the other 9 and gives the desktop twin a target. 50 route-level rows assert
it, and the conforming hour still answers 200 with its block unchanged.

---

## 4. A BOOLEAN figure is refused, and it is the one row no parity check could have found (2026-09-16)

**Decision:** `is_finite_figure` / `isFiniteFigure` exclude `bool` explicitly
rather than resting on `isinstance(v, int)` / `typeof v === 'number'`.

**Evidence.** `round(True)` is `1` in Python and `Math.round(true)` is `1` in
JavaScript, so `temp: true` rendered **`Temperature: 1°F` on BOTH runtimes** —
the 9 boolean rows were the only 9 of 50 hour shapes the Python side accepted,
and the two transports produced byte-identical text for every one of them. **An
agreeing wrong number is invisible to every cross-transport parity check by
construction**, which is why this exclusion is load-bearing rather than
defensive, and why it is recorded here rather than left as a `not isinstance`
call a later reader might tidy away. `services/plan_weather._finite` already
excluded bools; this build made that the single definition instead of a copy.

---

## 5. Sunrise and sunset keep their `dt` fallback, because One Call OMITS them at polar latitudes (2026-09-16)

**Decision:** an absent **or null** `sunrise`/`sunset` still falls back to the
reading's own `dt`, on both runtimes and **on either tier** — the daily entry's
own fallback in `_hour_from_daily` / `dailyToHour`, and the matching daily
entry's value injected into a `current`/`hourly` point by `_hour_from_point` /
`hourData`. Only a present-but-unusable value (a string, an absurd number)
refuses.

**The scope of that deferral was wrong in the first draft of this decision, and
it is corrected here (F-6).** It said "on a **daily** entry", which reads as a
daily-tier-only residual. Measured on one body, both runtimes, all three cases
agreeing:

| Body | Reported |
|---|---|
| `current` missing sun times only | `Sunrise=6:48am Sunset=7:19pm` — injected from the matching daily entry, **correct**, and this is the case fix 6 exists for |
| **TRUE POLAR**: missing on `current` AND every `daily` entry | `Sunrise=3:31pm Sunset=3:31pm` — both equal to the reading's own timestamp |
| `daily` tier, missing (or `null`) on every daily entry | `Sunrise=12:00pm Sunset=12:00pm` — the entry's noon `dt` |

**The consequence that is NEW on web/Pi, which the original sentence also did
not name.** In the genuine polar case — which decision 6 itself asserts is a
*well-formed* One Call body — the pasteable block carries two wrong clock times,
and fix 6 converts a web/Pi **502** into a web/Pi **reading that carries them**.
That is still the right trade: refusing means a 502 for every high-latitude
user, which is what web/Pi did before and is strictly worse, and desktop has
always behaved this way. It is a wrong figure that now *agrees*, which is the
honest way to state it.

**Why not refuse it, which "no figure is defaulted" would suggest.** One Call
omits `sunrise` and `sunset` for polar day and polar night. Refusing an absent
sunrise would turn well-formed high-latitude bodies into 502s, and the
dt-fallback is pre-existing and already agreed across both runtimes for an absent
key. `weatherPlan.ts`'s own `presentTs` comment records the same provider fact.

**What did change.** Python's `.get(key, default)` fires only on an absent KEY,
so `"sunrise": null` reached `datetime.fromtimestamp(None)` and refused on
web/Pi while the TS `??` rendered a dt-derived time. `_or_dt` makes null behave
as absent, matching `??`. Measured as a real divergence on four rows.

**Stated cost, and it is a real one.** A dt-derived "Sunrise" is itself a wrong
figure — just an *agreeing* one now. That is narrower than this build's brief and
is out of its scope rather than half-changed in it; it is handed to The
Chronicler as a ROADMAP.md candidate at closeout, and nothing in ROADMAP.md
names it yet (F-3). **Reversal condition:** if One Call
ever documents an explicit polar marker, the fallback should become a refusal and
the surface should say "no sunrise today" instead of a time.

---

## 6. `_hour_from_current` is gone: ONE adapter for `current` and `hourly`, as the TS twin always had (2026-09-16)

**Decision:** `_hour_from_point` replaces `_hour_from_current` and
`_hour_from_hourly`, mirroring the single `hourData`.

**Why, and this one is a live user-facing fix nobody asked for.** The deleted
function returned the block untouched on the comment *"current already carries
every field format_weather reads (incl. sunrise/sunset)."* That is **not true of
a well-formed body**: One Call omits both on the `current` tier too, at polar
latitudes, and the TS twin has always injected them from the matching daily
entry. Measured: a `current` block with `sunrise` absent answered **502 on
web/Pi and rendered on desktop**. Found only because the shared matrix carried
the row; it is outside the brief's three tables.

A conforming body takes the injection `if` false and comes back `dict(point)`,
so the byte-golden output is untouched — confirmed by `test_formatters.py` and
`weatherTidePlan.parity.test.ts` staying green unchanged.

---

## 7. The tier SELECTOR converges on a shared candidate filter, not on a new refusal (2026-09-16)

**Decision:** `pickForecastSlice` / `pick_forecast_slice` filter each tier to
entries that are objects carrying a usable `dt` (`usableEntries` / `_usable`),
take the horizon from the last candidate, and search only candidates. The
`current` branch reads its `dt` through the same predicate and tests presence
with `is not None` rather than truthiness.

> **This decision derived the presence swap in ONE direction only, and that
> shipped a new divergence. See decision 10**, which carries the inversion half
> (`0` / `false` / `""`), the direction the two runtimes now agree in, and the
> argument for it. Everything below is unchanged and still holds; the paragraphs
> on the CANDIDATE FILTER were derived in both directions correctly, because a
> filter can only ever remove candidates.

**Why a filter rather than a refusal.** Two accidents of the two languages made
this asymmetric, and neither was designed:

| Shape | desktop at v1.0.31 | web/Pi at v1.0.31 |
|---|---|---|
| every hourly entry carries `"dt": null` | falls through to a real DAILY reading | 502 (`None + 1800` raised) |
| ONE hourly entry's `dt` is null or a string | a valid neighbouring hour | 502 (`min` key raised) |
| hourly array holds non-objects | falls through to daily | 502 |
| `current.dt` is a string | falls through | 502 (`abs(t - "warm")` raised) |
| `current` is `{}` | refused as malformed | out-of-range (Python `{}` is falsy) |

For an **absent** `dt` the two already agreed on falling through, so
fall-through is the behaviour kept and no new refusal class is invented. The
single-bad-entry row is the one that matters in practice — a provider hiccup on
one hour of 48 is far likelier than all 48 being malformed — and the answer it
now gives on both transports is a real entry at the right resolution, with the
response's own `resolution` field naming the tier that answered. An entry that
IS selected is still refused by `assertHourReading` if any other figure of it is
malformed.

**What this is not:** it is not a figure being defaulted. It retires two `0`
sentinels (`.get("dt", 0)`), which were exactly that.

**Scope note, stated because the selector is outside the brief's blast radius.**
The brief named `summaryFromHour`, `dailyToHour`, `_hour_from_daily` and
`formatWeather`. The selector shapes were found by widening the matrix past the
brief's 82; they are reported and fixed rather than pinned, because the fix is
the same boundary filter `buildWeatherPlan` has applied since v1.0.29 and it
introduces no verdict the twins did not already agree on somewhere.

---

## 8. A malformed DAILY array answers `out-of-range`, not 502 — recorded, not changed (2026-09-16)

**Decision:** left as it is, on both runtimes, and written down here because a
silent non-action and an oversight leave the same evidence.

**What happens.** `daily` is the last tier, so when every daily entry is
unusable (`dt` absent, entries non-objects, the array replaced) both runtimes
return `{resolution: "out-of-range", formatted: null, summary: null}` — 11 of the
203 rows. The surface then shows its existing "no weather reaches that far"
state rather than a provider error.

**Why that is acceptable.** Nothing is fabricated, no `NaN` and no figure
reaches the panel or the copy block, and the two transports agree. It is the
shipped behaviour of both sides for an empty `daily` array and has been since
the route existed.

**Why it is worth naming anyway.** `/weather/plan` maps an empty `daily` to a
**502** (`no-daily`, FR-09/FR-40) while `/weather/at` returns out-of-range, so
the two routes read the same body differently. That asymmetry is pre-existing,
is not a parity defect between transports, and changing it would alter a
well-formed path's honest state on a route this brief scopes only for failure
paths. **Reversal condition:** if a user ever reports "no weather forecast
reaches that far" over a location the forecast plainly covers, this is the
sentence to read first. Handed to The Chronicler as a ROADMAP.md candidate at
closeout; nothing in ROADMAP.md names it yet (F-3).

---

## 9. What this build did NOT touch, and why

- **The byte-golden formatter parity** (`weatherFormatter.golden.py`,
  `weatherTidePlan.parity.test.ts`, `test_formatters.py`) drives conforming
  bodies only, so a refusal-only change cannot move it. It did not: all green,
  unchanged. The brief names this as the check that the change has not altered a
  well-formed path, and it is the strongest single piece of evidence here.
  **One thing in it DID need correcting, and it is prose rather than code
  (F-5):** `weatherFormatter.golden.py`'s own docstring described its functions
  as "an exact copy of the relevant parts of `backend/formatters/weather.py`"
  and instructed the reader to "update both this script and the TypeScript
  tests" whenever the Python formatter changed. The Python formatter gained
  `is_finite_figure`, `HOUR_FIGURES` and the three `assert_hour_*` functions
  plus a per-response check at the top of `format_weather`, and the oracle has
  none of it. Nothing behavioural is wrong — the oracle drives conforming
  bodies only, so it cannot see a refusal, and every golden row is green and
  unchanged — but its standing instruction was not followed, so the sentence is
  narrowed to what the script actually mirrors (the output-producing half) with
  the refusal layer named as a deliberate omission and the reason attached.
  Note that `.claude/rules/weather-tide.md`'s obligation is specifically about
  the moon-phase port, which is untouched: `git diff -- backend/formatters/weather.py`
  greps to 0 for `moon`, `julian` and `LUNAR`.
- **`docs/HELP.md`, `README.md`, `website/`** — swept at paragraph scope,
  starting at the source. Nothing published describes what happens when the
  provider returns a malformed body, the two failure sentences are unchanged
  word for word, no route signature moved, no new outbound request, no host
  change, so `PRIVACY_POLICY.md` and `ACCESSIBILITY.md` are unaffected. One
  source comment DID stop being true and was corrected:
  `lib/tauri/weatherService.ts`'s claim that four of twelve malformed
  timemachine shapes were "the known non-numeric-figure divergence".
- **The tide half.** Out of scope by the brief; it is the two ideas queued next.
  What transfers to them is recorded in the PR description.
- **No version bump, no `CHANGELOG.md`.** Build 3 of 5 in a bundled Spool
  release taking one bump at the end.

---

## 10. The `current` PRESENCE test is `not null` on BOTH runtimes, never truthiness (2026-09-16, QA round 1)

**The defect, which this build introduced.** Decision 7 swapped Python's
`if current` for `current is not None` and derived only the **widening** half of
that swap. The **inversion** half opened a fresh divergence of exactly the class
this build exists to close, in the function it had just rewritten. Measured, no
`dt` (the "now" lookup):

| Shape | web/Pi at v1.0.31 | desktop at v1.0.31 | web/Pi as first shipped | desktop as first shipped |
|---|---|---|---|---|
| `"current": 0` | out-of-range 200 | out-of-range 200 | **502** | out-of-range 200 |
| `"current": false` | out-of-range 200 | out-of-range 200 | **502** | out-of-range 200 |
| `"current": ""` | out-of-range 200 | out-of-range 200 | **502** | out-of-range 200 |

All three **agreed** before the change. `current = onecall.get("current") or {}`
mapped every falsy value to `{}`, which the following `if current` then treated
as absent — the same answer JS truthiness gives. `is not None` breaks that for
`0` / `false` / `""` while fixing it for `{}` / `[]`.

Reachable: `GET /weather/at?lat=..&lng=..` with no `dt` sets `target_ts = None`,
and `getWeatherAt(lat, lng)` is called without a dt on the desktop side.

**Decision: take truthiness out of BOTH sides rather than emulate one
language's accidents in the other.** `pick_forecast_slice` keeps
`current is not None`; `pickForecastSlice` gets `isPresent(current)`
(`v !== undefined && v !== null`) in place of `current ?`. Presence means "the
provider sent something under this key"; whether what it sent is USABLE is the
shared validator's question. That is decision 1 applied to the presence test
itself, and the two spellings are now genuine twins rather than two
coincidences.

**Why the two agree in THIS direction rather than the other, argued from the
runtimes' existing contracts.** The alternative was a JS-truthiness helper on
the Python side, so all five shapes answered `out-of-range`. Three reasons
against it:

1. **`out-of-range` is a FALSE STATEMENT for these bodies.** That resolution
   renders the surface's "no weather reaches that far" state — a claim about the
   forecast horizon. A body whose `current` block is the number `0` is not out
   of range; it is malformed, and `502 "Weather data unavailable for this
   location."` is the true statement. Decision 8's `out-of-range` is a different
   case and stays: there the LAST tier's entries are all unplaceable, which is
   genuinely "no weather for this moment".
2. **A JS-truthiness helper in Python would be the very thing this build
   removes.** It would have to call `{}` and `[]` truthy while calling `0`,
   `False`, `""`, `NaN` and `-0` falsy — an accident of one language
   re-implemented by hand in the other, five members deep, with no principle to
   check it against.
3. **The fixed points are preserved.** Absent and explicit `null` still answer
   `out-of-range` on both runtimes, unchanged and pre-existing: One Call
   legitimately omits `current` via `exclude`, and with no `dt` target there is
   no other tier to answer from. `{}` and `[]` still refuse, which is what
   desktop has always done. Only the three F-1 shapes move, and they move on the
   **desktop** side, so web/Pi gains no behaviour this build had not already
   given it.

**Two riders, both taken while the predicate was open.** The TS horizon test
became `isFiniteFigure(now)`, the literal twin of `is_finite_figure(now)`:
`null !== undefined` is true, so the looser form computed
`Math.abs(targetTs - null)` and would have taken the `current` branch for a null
`dt` at any target within an hour of the epoch. No shipped target is near 1970,
so nothing observable moved — a latent divergence removed, stated rather than
silently fixed. And both adapters now refuse a non-object slice **explicitly**
(`_hour_from_point`, `hourData`) rather than relying on `dict(0)` raising on one
side and `{ ...0 }` being `{}` on the other: two different accidents agreeing on
a verdict is the shape decision 1 exists to replace. Neither rider moves any
verdict in the 203-row matrix, which is green against the committed fixture
before and after.

**The guard, and where it lives.** A hand-written `PRESENCE_ROWS` table in each
parity suite, pinned to the same length on both sides by a row-count assertion
so neither half can grow alone (an earlier draft of this sentence said "Twelve";
both suites assert eleven -- stated as the property here, since the count is
what the assertion is for), plus a conforming control and a non-vacuity row
naming the three falsy-not-null shapes. They are **hand-written on purpose**:
the 203-row matrix's verdict columns are produced by the shipped builders, which
can only ever pin AGREEMENT, and what this class needed was a DIRECTION argued
from the contract. They sit **beside** the matrix rather than in it because every
figure recorded against those 203 shapes is a measurement over exactly that
population, and growing it would silently restate all of them over a different
one. Watched red-first: reverting the TS presence test alone turns exactly the
three rows `current 0`, `current false` and `current empty string` red, and
nothing else.

---

## 11. The copy block validates the fields each response CONTRIBUTES, not every response wholly (2026-09-16, QA round 1)

**The defect, which this build also introduced, and which contradicted decision
7 in the same breath.** `format_weather` / `formatWeatherBody` ran the whole
`assert_hour_reading` over **every** response's `data[0]`, while `weather[0]` is
read from `first` alone. So a malformed `weather` on a non-first sampled hour of
`/weather/{checklist_id}` was **accepted on both runtimes at v1.0.31 and 502'd
on both** as first shipped. Measured on a three-hour checklist body, hour 2
mutated, with two controls:

| Mutation on hour 2 of 3 | at v1.0.31 | as first shipped |
|---|---|---|
| `weather` → `[{}]` | ACCEPT, condition `"Scattered clouds"` | **REFUSE → 502** |
| `weather` → `null` | ACCEPT, condition `"Scattered clouds"` | **REFUSE → 502** |
| `weather` key removed | ACCEPT, condition `"Scattered clouds"` | **REFUSE → 502** |
| `weather[0].description` → `null` | ACCEPT | **REFUSE → 502** |
| CONTROL: `temp` → `"warm"` (read from every hour) | REFUSE | REFUSE |
| CONTROL: all three hours conforming | ACCEPT | ACCEPT, block unchanged |

Both runtimes over-refused identically, so it was never a parity defect — which
is precisely why no parity row could see it. It is an internal contradiction:
decision 7 fixes the tier selector *because* "a provider hiccup on ONE hour of
48 is far likelier than all 48 being malformed", and this guard reintroduced
that failure mode on the copy block for any checklist spanning more than an hour.

**Decision: narrow the guard to the fields each input actually contributes.**
`assert_hour_reading` / `assertHourReading` split into `assert_hour_figures` +
`assert_hour_condition` (twins `assertHourFigures` / `assertHourCondition`), with
`assert_hour_reading` defined as both. A single-moment caller keeps the whole
validator on its one adapted hour. `format_weather` calls the **figures** half on
every response and the **condition** half on `first` only.

**The split is derived from what the formatter READS, which is not the obvious
line.** Nine figures are aggregated from every response — the six the
Temperature, Wind, Wind Direction, Cloud Cover, Humidity and Dew-point lines
range over, **plus `dt`, `sunrise` and `sunset`**, because `_is_night_hour` /
`isNightHour` runs over every sampled hour to decide whether the block carries a
moon emoji. A reader who sees only `first["sunrise"]` a few lines below would
conclude the clock fields were first-only; they are not. So the figures half is
all nine and is checked per response, and only `weather[0]` narrows to `first`.

**Why narrowing is right rather than "stricter is safer".** The module already
states the rule one level down: `weather[1]` is deliberately unchecked because
nothing dereferences it, and both runtimes ignore it identically. Validating a
`weather[0]` on a response that never reaches it is the same principle violated
one level up. And the cost of the strict version is asymmetric — refusing the
entire pasteable block buys nothing, because the block is byte-identical whether
hour 2's `weather` is good or junk. §7 needed no correction; the build needed to
stop contradicting it.

**The guard.** Twenty-two multi-hour rows in each parity suite over a three-hour
body whose later hours carry a DIFFERENT condition on purpose: six `weather`
mutations at a later hour (accept), the same six at hour 0 (refuse), one row per
`HOUR_FIGURES` member at a later hour (refuse), and the conforming control. Three
property assertions carry the argument rather than the behaviour: the block
reports hour 0's condition and not the later hours' (which is what makes
`weather` first-only a measured fact about this formatter rather than a reading
of its source); the aggregated Temperature really does span all three hours, so
the accepting rows cannot pass by later hours being ignored wholesale; and the
refusing figure rows are asserted to cover **all nine** `HOUR_FIGURES` members,
derived from the exported list rather than enumerated by hand. An ACCEPT row
asserts the produced block is **byte-identical** to the all-conforming one, not
merely that it does not throw. Watched red-first: reverting the split turns
exactly the six later-hour `weather` rows red, on both runtimes, and nothing
else.

---

## 12. The symmetric difference of every predicate this build changed, in BOTH directions (2026-09-16, QA round 1)

F-1, F-2 and F-4 were each the *second half* of a widening whose difference was
derived in one direction only, so this table exists rather than the intention to
be more careful. For every predicate or validator this build replaced: what the
new code ACCEPTS that the old refused, and what it REFUSES that the old
accepted. `.claude/rules/testing.md` already requires this ("state the symmetric
difference and argue each half"); the cross-runtime truthiness case is the
instance that needed it written out.

| Predicate replaced | NEWLY ACCEPTS (old refused) | NEWLY REFUSES (old accepted) | Argued where |
|---|---|---|---|
| `_finite` / `finite` → `is_finite_figure` / `isFiniteFigure` | nothing — the bodies were byte-identical copies | nothing on the plan path; on the single-moment path a **boolean** figure, which both runtimes rendered as `1°F` | decision 4 |
| daily field `.get(field, 0)` / `?? 0` → no default | nothing | every absent daily figure, and an absent `weather` (was `_FALLBACK_WEATHER`) — the fabricated `tempF: 0` / "Clear sky" | decision 1, the whole brief |
| `.get(key, default)` → `_or_dt` for sun times | an explicit `"sunrise": null` (was a web/Pi 502; now the dt fallback, matching `??`) | nothing | decision 5 |
| `_hour_from_current` (identity) → `_hour_from_point` (inject sun times) | a polar `current` block with no sun times (was a web/Pi 502) | nothing — **but it COUPLES the tiers**: a daily-tier mutation can now decide a current-tier answer, which is the F-4 comment fix | decisions 5, 6; F-4 |
| tier horizon `.get("dt", 0)` / raw index → `_usable` / `usableEntries` candidate filter | every shape where one tier is unplaceable and the next answers: a null `dt` on all entries, one bad `dt` among 48, non-object entries, a string `current.dt` | nothing — the filter only ever removes candidates, and a selected entry still faces `assert_hour_reading` | decision 7 |
| `if current` → `current is not None`, with `current ?` → `isPresent` | `{}` and `[]` are present on both sides (Python answered out-of-range, and now refuses as the TS side always did) | `0`, `false`, `""` and every other non-null value — **on the DESKTOP side, which is the half F-1 caught**; web/Pi had already changed | decision 10 |
| `now !== undefined` → `isFiniteFigure(now)` (TS horizon) | a `null`, `false` or `true` `current.dt` at a target within an hour of the epoch: the old spelling took the `current` branch and then refused it, the new one falls through to the hourly reading Python always gave — latent, unreachable with any shipped target | nothing (a STRING `dt` never participated: `targetTs - 'x'` was already `NaN`, so both spellings agreed) | decision 10 |
| implicit non-object slice → explicit refusal in both adapters | nothing | nothing; it restates an existing refusal as a stated one, verified by the matrix being green before and after | decision 10 |
| `assert_hour_reading` per response → `assert_hour_figures` per response + `assert_hour_condition` on `first` | a malformed `weather` on a NON-FIRST sampled hour, on both runtimes — restoring the v1.0.31 behaviour the first cut had taken away | nothing | decision 11 |

Two rows in that table are the ones worth reading twice, because in both the
inversion column is where the defect was: the presence swap, and the formatter
fan-in.

**Correction (QA round 1 re-run).** Row 7's two direction columns were written
the wrong way round, and a string `dt` was listed as participating when it never
did. Measured: the OLD spelling refused those bodies and the SHIPPED one accepts
them. Recorded here rather than silently amended, because a table whose entire
purpose is directional correctness is exactly the artifact that gets copied
forward and believed -- the same failure this table exists to prevent, arriving
through the table itself.

---

## Convention Flags

- **DERIVE A REPLACED PREDICATE'S SYMMETRIC DIFFERENCE IN BOTH DIRECTIONS AND
  WRITE BOTH DOWN — the second direction is where all three of this build's QA
  fix items lived.** `.claude/rules/testing.md` already states the rule for
  selectors and predicates in the abstract. What this build adds is that a
  one-directional derivation is not a partial answer but a reliable defect
  generator: the tier-selector presence swap was argued for `{}`/`[]` and not
  for `0`/`false`/`""`; the formatter guard was argued for the fields it reads
  and not for the fields it newly validates; the `_hour_from_point` unification
  was argued for the polar body and not for the cross-tier coupling it creates.
  Three for three. The concrete artifact is decision 12's table — one row per
  predicate, one column per direction — and the cost of filling it in is
  minutes. **The CROSS-RUNTIME TRUTHINESS case deserves naming as its own
  instance**, because Python and JavaScript disagree about `{}`, `[]`, `0`,
  `false` and `""` in two directions at once and **no single truthiness spelling
  is a twin of the other's**: a twinned presence test is spelled `is not None` /
  `!= null` on both sides, and validity is left to the shared validator.
- **A SHARED VALIDATOR APPLIED AT A FAN-IN POINT IS ARGUED AGAINST THE FIELDS
  EACH INPUT CONTRIBUTES, NOT AGAINST THE FIELDS THE FIRST INPUT CONTRIBUTES.**
  `format_weather` reads `weather[0]` from `first` alone and was validating it on
  every response, which turned a one-bad-hour provider hiccup into a total
  refusal of the checklist copy block. Where a module already states
  "validate what is dereferenced" one level down (here `weather[1]` is
  deliberately unchecked), check that the level above obeys it too. And derive
  the contributed set by READING the aggregator, not by reading its obvious
  lines: `dt`, `sunrise` and `sunset` look first-only next to `first["sunrise"]`
  and are in fact read from every response, through the night test.
- **A SOURCE COMMENT THAT CITES `ROADMAP.md`, `DECISIONS.md` OR A NAMED GUARD IS
  A CLAIM ABOUT THAT FILE, AND THE PRESENT TENSE IS THE TRAP.** Four shipped
  comments in this build said an item "is named in ROADMAP.md" when the
  Chronicler's stage had not run, which is a false statement about what has
  already happened, not a deferral. Where a builder defers an item to a later
  stage, the comment says so in the tense that is true ("out of scope here,
  handed to the Chronicler at closeout, nothing in ROADMAP.md names it yet") and
  the deferral goes in the completion note as an explicit hand-off. Same family
  as v1.0.21's rule that a requirement resting on a named guard is a claim about
  that guard.
- **WHEN A GUARD FOR A NEW CLASS NEEDS A DIRECTION RATHER THAN AGREEMENT, IT
  BELONGS BESIDE A GENERATED MATRIX, NOT IN IT.** A generated verdict column is
  the right tool for a wide matrix and is what makes the cross-runtime claim
  real, but it records whatever the code does; it cannot say which of two
  disagreeing answers is correct. Hand-write the property rows, state in the
  file that they are hand-written and why, and keep them out of the generated
  population so that every figure already measured against that population stays
  a measurement of it.
  **Then give the twin tables a ROW COUNT on each side, so neither can grow
  alone** -- the discipline v1.0.12 put on the iCloud time-parity fixture, and
  the thing that makes a hand-written twin table safe: a row added in one
  language and not the other leaves that runtime unmeasured with both files
  green. It paid for itself inside the same hour: the first count was written
  from memory as 12 and both halves went red at once against the true 11, which
  is v1.0.14's rule (*a guard that names a COUNT is asserting that count, so
  derive it from the code at the moment the guard is written*) arriving cheaply
  rather than expensively.

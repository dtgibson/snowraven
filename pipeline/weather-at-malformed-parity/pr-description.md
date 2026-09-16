## Weather At Malformed Parity

### What this does

The two single-moment weather builders disagreed about what a malformed provider
figure is, and neither one was right. Measured over one conforming One Call body
and 203 mutated shapes, `buildWeatherPayload` (desktop/iOS) and
`build_weather_payload` (web/Pi) answered **differently on 124 of them**:

- **107** where the desktop twin answered while web/Pi refused — the summary
  printing `NaN°F` / `Humidity NaN%`, or a confident wrong word (`Wind: Calm`
  for a null speed, `Wind: Gale` for the string `"warm"`). **31** of those put
  the substring `NaN` into the copy block a user pastes into an eBird checklist.
- **8** where the roles **inverted**, six of them on the `daily` tier, where
  `_hour_from_daily`'s `.get(field, 0)` defaults and `_FALLBACK_WEATHER`
  substitution answered **HTTP 200** with `tempF: 0`, `H 0° · L 0°` and a
  fabricated `"Clear sky"` for a body the provider sent no weather in at all —
  while the desktop twin refused it.
- **9** where both answered with different figures (`0` on one side, `NaN` on
  the other).

The wrong number was the dangerous half, not the blank: `0°F` and `Clear sky`
are indistinguishable from a real reading.

The repair puts one finite-figure predicate and one hour-validator in the shared
dependency on each runtime — `isFiniteFigure` / `assertHourReading` in
`weatherFormatter.ts`, `is_finite_figure` / `assert_hour_reading` in
`backend/formatters/weather.py` — and calls them from both builders and from
both copy-block formatters. A single-moment reading whose figure is not finite,
whose `weather` is not a non-empty list of condition objects, or whose daily
`temp` is not an object of finite `day`/`min`/`max` is now **refused on both
runtimes**, mapped to the 502 + `"Weather data unavailable for this location."`
that `/weather/at` already carried on both transports since v1.0.31.

After: **0 of 203** rows diverge. No accepted payload carries a non-finite
figure, no copy block contains `NaN`, no condition is invented, and the replay
round-trip cannot produce a null figure because no payload is produced at all.

Three things fall out of it:

1. **The v1.0.29 twinned-builder rule becomes true for the first time.** It was
   applied to the plan builders only, and it had not finished the job even there:
   the plan pair diverged on **58** of these same 203 rows, because both plan
   builders delegate to this builder and Python's half of that agreement rested
   on `build_weather_payload` happening to raise — which on the `daily` tier it
   did not. Now 0 of 203.
2. **`weatherPlan.ts`'s own v1.0.29 guards are deleted**, measured redundant
   rather than assumed so: 0 of 203 rows differ with them present or removed,
   byte for byte. Decision 2 in `decisions.md` carries the structural argument
   and the reversal condition.
3. **`/weather/{checklist_id}` converges too**, because it shares
   `formatWeather`. Over 50 malformed hour shapes that formatter produced
   pasteable text for **37** where its Python twin refused 41.

Two live defects were found by widening the matrix past the brief's 82 shapes and
are fixed here, both outside the brief's tables:

- **A `current` block with `sunrise` absent answered 502 on web/Pi and rendered
  on desktop.** One Call omits `sunrise`/`sunset` at polar latitudes, so that is
  a *well-formed* body — `_hour_from_current` returned the block untouched on a
  comment asserting otherwise. One adapter now serves both tiers, as the TS
  twin's single `hourData` always has.
- **A single malformed `dt` among 48 hourly entries was a 502 on web/Pi** and a
  valid neighbouring hour on desktop. Both now filter the tier to usable entries
  — the same boundary filter `buildWeatherPlan` has applied since v1.0.29 — so
  one bad hour no longer costs the whole lookup, and two `.get("dt", 0)`
  sentinels are retired.

And one class worth naming because no parity check could ever have caught it: a
**boolean** figure. `round(True)` is 1 and `Math.round(true)` is 1, so
`temp: true` rendered `Temperature: 1°F` on *both* runtimes — an agreeing wrong
number, and the only 9 of 50 hour shapes the Python side accepted. Both
predicates exclude `bool` explicitly.

### Two things this build got wrong on its first pass, and how

QA found that three of its items were each the *second half* of a widening whose
symmetric difference had been derived in one direction only. Both behavioural
ones are closed here, and the pattern is written up as a convention flag with a
per-predicate both-directions table (decision 12).

1. **The `current` presence swap opened a fresh divergence, in the function this
   build rewrote, of exactly the class it exists to close.** Decision 7 replaced
   Python's `if current` with `current is not None`, which fixed `{}` and `[]`
   (falsy in Python, truthy in JS) and broke `0`, `false` and `""` (falsy in JS,
   not-None in Python): those three **agreed on `out-of-range` at v1.0.31** and
   became a 502 on web/Pi against an out-of-range 200 on desktop. Fixed by
   taking truthiness out of **both** sides — `is not None` twinned with a real
   `isPresent`, with validity left to the shared validator — so the two agree by
   construction. They agree on **refusing**, argued from the runtimes' own
   contracts: `out-of-range` renders "no weather reaches that far", a claim about
   the forecast horizon that is simply false of a body whose `current` block is
   the number `0`. Absent and explicit `null` still answer `out-of-range` on both
   runtimes, unchanged. Decision 10.
2. **The copy-block guard over-refused, and contradicted this build's own tier
   fix.** `format_weather` / `formatWeatherBody` ran the *whole* hour validator
   on every response although `weather[0]` is read from `first` alone, so a
   malformed `weather` on hour 2 of a 3-hour checklist was accepted on both
   runtimes at v1.0.31 and 502'd on both here. That is the same failure mode
   decision 7 fixes the tier selector to prevent ("a provider hiccup on ONE hour
   of 48"). The validator now splits into a **figures** half, checked on every
   response (all nine, because `dt`/`sunrise`/`sunset` are read from every hour
   through the night test), and a **condition** half, checked on `first` only.
   Decision 11.

Plus a shipped comment that had become measurably false: `/weather/at` is
tier-SENSITIVE but is no longer tier-ISOLATED, because `_hour_from_point` reads
sun times from the `daily` tier when the selected point omits them — so a
daily-only mutation can decide a current-tier answer. Corrected in
`routers/weather.py` and in `test_at_route_containment.py`'s header, with the
three-way measurement attached.

### How to test

```sh
# Both new parity halves, driving ONE shared fixture (203 builder shapes +
# 50 formatter shapes, both verdict columns, on both runtimes) plus the two
# hand-written property families the QA round added: the `current` presence
# boundary and the multi-hour copy block.
cd backend && .venv/bin/python -m pytest tests/test_weather_at_malformed_parity.py -q
cd frontend && npx vitest run src/lib/weatherAtMalformedParity.test.ts

# The two QA fixes on their own, if you want them in isolation.
cd backend && .venv/bin/python -m pytest tests/test_weather_at_malformed_parity.py -q \
  -k "presence or each_hour_contributes or first_hours_condition or nine_aggregated"
cd frontend && npx vitest run src/lib/weatherAtMalformedParity.test.ts \
  -t "presence"; cd frontend && npx vitest run src/lib/weatherAtMalformedParity.test.ts \
  -t "contributes"

# The service-level half, including the three formerly-pinned rows.
cd frontend && npx vitest run src/lib/atRouteServices.test.ts

# The well-formed paths that must NOT have moved: byte-golden formatter parity
# and the plan twins.
cd backend && .venv/bin/python -m pytest tests/test_formatters.py tests/test_weather_tide_plan_parity.py tests/test_forecast.py tests/test_weather_at.py tests/test_at_route_containment.py -q
cd frontend && npx vitest run src/lib/weatherTidePlan.parity.test.ts src/lib/weatherFormatter.test.ts src/lib/forecastSlice.test.ts

# The gates.
cd backend && .venv/bin/ruff check .
cd frontend && npm run build
```

The sharpest single before/after, if you want one command. Against the shipped
code this answers 502; against v1.0.31 it answered 200 with a fabricated
`"Clear sky"`:

```sh
cd backend && .venv/bin/python -m pytest \
  "tests/test_weather_at_malformed_parity.py::test_the_sharpest_single_row_from_the_brief" -v
```

### Notes for reviewer

**Red-first, watched failing.** The six source files were reverted with
`git show HEAD:<path>`, both new suites run against them, then restored and
confirmed byte-identical by `shasum -a 256 -c`:

| Against the unfixed builders | Result |
|---|---|
| `test_weather_at_malformed_parity.py` | **153 failed**, 435 passed |
| `weatherAtMalformedParity.test.ts` | **159 failed**, 485 passed |
| `atRouteServices.test.ts` | passed (its three pinned rows assert v1.0.31 behaviour) |

**The two QA fixes were watched red-first too, each reverted in ISOLATION so the
failing set localizes to one change.** Restored from a saved copy, verified by
`shasum -a 256 -c` **and** by an independent behavioural re-run, because
comparing a restored file against the snapshot used to restore it is circular:

| Revert | Rows red | Anything else |
|---|---|---|
| the TS presence test back to `current ?` | exactly `current 0`, `current false`, `current empty string` | none (3 failed, 647 passed) |
| the formatter split back to one per-response call, BOTH runtimes | exactly the six later-hour `weather` rows, on each runtime | none (TS 6 failed / 644 passed; Python 6 failed / 619 passed) |

Neither QA fix moves any verdict in the 203-row matrix: the suites are green
against the **committed** fixture before and after, and a regeneration differs
only in five reworded `why` strings, with every structural field byte-identical
under a `why`-stripped canonical-JSON diff.

**The three pinned rows at `atRouteServices.test.ts:66-81` went red exactly as
the v1.0.31 build designed them to, and nothing else moved.** They are rewritten,
not deleted; the comment above them records what each used to produce
(`tempF: NaN`, `windDesc: "Calm"`, `cloudsPct: NaN`). Three `daily`-tier rows
were added beside them so the inverted half of the convergence has service-level
coverage too, and six rows were added to the checklist twin's list for the
shapes that used to come back as pasteable text. That file is now 40 tests, up
from 31. **No other existing test needed editing.**

**The fixture is generated, never hand-written** (v1.0.29):
`SR_GEN_WEATHER_AT_MALFORMED_FIXTURE=1 npx vitest run src/lib/weatherAtMalformedParity.test.ts`
writes both verdict columns from the shipped TS builders, and the Python half
reproducing both of them from the same body is the parity claim. The generator
lives in the gate file rather than beside it, deliberately: generation and
assertion must apply the same shape DSL, and a second TS copy of `applyShape` is
a place for the two to drift. The Python half re-implements the DSL
independently, which is what the cross-transport claim consists of — and the
conforming CONTROL rows per tier are what would catch a mis-implementation of it.

**Every row that does not refuse states a reason, and a test asserts that.** A
matrix whose every row refuses proves nothing about whether the guard is too
strict, so the 61 accepting and out-of-range rows each carry a `why` and
`test_every_row_that_does_not_refuse_states_a_reason` fails if a new one appears
without one. Worth reading: the polar-latitude rows, and the single-bad-entry
rows where the answer is a real neighbouring hour rather than an error.

**The well-formed path is untouched, measured rather than asserted.** The
byte-golden formatter parity and the plan-pair document equality both drive
conforming bodies only, so a refusal-only change cannot move them — and if
either had moved, the change would have been wrong. Both green, unchanged:
764 backend tests across the eight weather/plan suites, 2,123 frontend tests
across 68 affected files including `entryChunk.test.ts`.

**Bundle A/B, because new files landed under `frontend/`** (Tailwind scans test
files, and a rare utility word in a comment emits a rule). Built CSS is
**byte-identical**: `md5 56be6e6b27694c92aee0617a375db00c`, 112,637 bytes, with
and without the two new frontend files genuinely moved aside, plus a passing
determinism control (HEAD built twice, same hash).

**Docs swept at paragraph scope, starting at the source; no published prose
changed.** Nothing in `docs/HELP.md`, `README.md` or `website/` describes what
happens when the provider returns a malformed body, and both failure sentences
are unchanged word for word. No route signature, no new outbound request, no
host, so `PRIVACY_POLICY.md` and `ACCESSIBILITY.md` are unaffected. **Six source
and record claims stopped being true and are corrected in place** — one found by
the Engineer, five by QA, none of them behavioural:

| Where | What was wrong |
|---|---|
| `lib/tauri/weatherService.ts` | claimed four of twelve malformed timemachine shapes were a known divergence from the Python twin, which this build closes |
| `routers/weather.py`, `test_at_route_containment.py` | "a shape mutating another tier answers 200 untouched" — false since the polar fix; corrected with the three-way measurement |
| `weatherFormatter.golden.py` | "an exact copy of the relevant parts of `backend/formatters/weather.py`" — narrowed to the output-producing half, with the refusal layer named as a deliberate omission |
| `.claude/rules/security.md` | the v1.0.29 twinned-builder rule's instance was `weatherPlan.ts`'s deleted guards; repointed at the single-moment pair and its shared fixture, with the delegate lesson stated |
| `test_weather_plan.py` | "`current` carrying only dt is tolerated by the slicer" — the conclusion holds, the reason does not: the plan path never reads the `current` block, and `/weather/at`'s Current tier answers 502 for that shape |
| `decisions.md` §2, §5; `bug-brief.md` | the deleted-guard argument omitted a third `weatherAt` call site; decision 5's deferral was scoped daily-tier-only when the dt fallback fires on either tier; the brief carried a wrong per-file test count, now stated as the property instead |

**Four comments deferring an item to `ROADMAP.md` said it "is named" there, in
the present tense, before the Chronicler's stage has run.** Nothing in
`ROADMAP.md` names either deferred item (`grep -iE "dt-derived|range plausib|polar day|polar night"`
returns nothing). Each now says what is true — out of scope here, handed to the
Chronicler at closeout, not yet in `ROADMAP.md` — and the two items appear in
this PR's hand-off below rather than resting on a code comment written in the
future tense.

**Numbers corrected at source.** The brief measured 82 shapes; this build widened
to 203 and several counts moved (93→124 builder divergences, 27→58 plan
divergences, and `format_weather` turned out to accept 9 shapes rather than 0 —
the boolean rows). Every figure in every file comment was rewritten to the
203-row measurement rather than left at the narrower one.

**What transfers to the two queued tide ideas** (stated, not built, as the brief
asked): the **verdict** (refuse, never default), the **place** (the shared
builder, not the route — route containment cannot catch a body that does not
throw), the **test shape** (one shared fixture carrying rows that SEPARATE the
twins, with a `why` on every row that does not refuse), and the discovery that
**widening the matrix past the brief's is where the live defects were** — two of
the three user-visible fixes here are shapes the brief's 82 did not contain. What
does **not** transfer is the honest state: tide has a soft
`{"status": "unavailable"}` where weather raises a 502, exactly as
`at-route-try-containment` decision 2 settled.

**Two things deliberately left alone, recorded with their reversal conditions**
(decisions 5 and 8): the `dt`-derived `Sunrise` for a polar body, which is a
wrong figure but now an agreeing one, **on either tier rather than only the
daily one** — decision 5's deferral was scoped too narrowly in its first draft
and is corrected there with the measured three-row table, including the
consequence that is new on web/Pi (a 502 for a well-formed high-latitude body
becomes a reading that carries two wrong clock times, which is still the right
trade); and `/weather/at` answering `out-of-range`
rather than 502 for an unusable `daily` array, where `/weather/plan` answers 502
for the same body. Both are handed to The Chronicler as ROADMAP.md candidates
at closeout -- nothing in ROADMAP.md names either yet, which is QA finding F-3
and is a hand-off rather than a claim.

**Explicit hand-off to The Chronicler, so it does not rest on a code comment.**
Four shipped source comments and two record sections defer an item to
`ROADMAP.md`; none of these three items is in `ROADMAP.md` today, and the
comments now say so rather than claiming otherwise:

1. **A dt-derived `Sunrise`/`Sunset` for a TRUE polar body** -- sun times absent
   on the selected point and on every daily entry, so both clock lines read the
   reading's own timestamp, on either tier and on both runtimes. Cited from
   `forecastSlice.ts` `dailyToHour` and `services/forecast.py`
   `_hour_from_daily`; decision 5 carries the measured table and the reversal
   condition (One Call documenting an explicit polar marker).
2. **Range plausibility is unmeasured** -- `assert_hour_reading` /
   `assertHourReading` check that a figure is finite, not that it is plausible,
   so `dt: 1e20` passes and both runtimes agree on the wrong night reading it
   produces. Cited from both validators' docstrings.
3. **`/weather/at` answers `out-of-range` where `/weather/plan` answers 502**
   for the same unusable `daily` array. Pre-existing, symmetric across
   transports, nothing fabricated; decision 8 carries the reversal condition.

### Changelog line

- Weather lookups now refuse a malformed forecast from the provider instead of
  showing a made-up reading. A missing temperature could appear as `0°F` with a
  fabricated "Clear sky" on the web and Pi builds, or as `NaN°F` on Mac, iPhone
  and iPad, and either could reach the copy-ready block you paste into an eBird
  checklist. Both now say the weather is unavailable, identically. Also fixes a
  forecast at high latitudes failing on the web and Pi builds, and a single bad
  hour in the provider's response costing the whole lookup.

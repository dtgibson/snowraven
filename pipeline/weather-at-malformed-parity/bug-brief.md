# Bug Brief — Weather At Malformed Parity

## What is broken

The two single-moment weather builders disagree about what a malformed provider figure is, and **neither one is right**. Measured over one shared fixture body (`frontend/src/lib/weatherTidePlan.fixture.json` families[0].onecall), 82 mutated shapes through `build_weather_payload` on both sides: **63 diverge**. The idea's framing — desktop tolerates, backend refuses — holds for 59 of them; **4 invert**, and on the `daily` tier the backend is the one that quietly fabricates a figure. The v1.0.29 rule this should converge on (`.claude/rules/security.md`: "A TWINNED BUILDER PAIR AGREES ON WHAT A MALFORMED FIGURE IS") was applied to the plan builders only, and **it did not finish the job even there** — the plan pair still diverges on 12 of 50 shapes, 11 of them on the `daily` tier, because the reference delegates to this very builder.

## Steps to reproduce

Deterministic, no user input, no network. Probe scripts ran from this session's scratchpad and are not committed; every table below was measured at HEAD by driving the real builders and the real routes with `fetch_forecast` doubled.

- **Backend, route level:** `TestClient(app)` + `patch("routers.weather.fetch_forecast")`, then drop one field from every `daily` entry and `GET /weather/at?lat=36.603&lng=-121.876&dt=2026-09-17 12:00`.
- **Backend, builder level:** `services.forecast.build_weather_payload(oc, ts, ZoneInfo("America/Los_Angeles"), 36.603)`.
- **Desktop:** vitest over `lib/forecastSlice.ts`'s `buildWeatherPayload` with the identical mutation and target, and `lib/weatherFormatter.ts`'s `formatWeather` for the copy block.
- **Render:** the exact JSX from `WeatherForecastPanel.tsx:110,123-126` under jsdom, for each figure shape.

Sharpest single row — `GET /weather/at` with `daily[*].weather` absent answers **HTTP 200** carrying `description: "Clear sky"`, `☀️`, and a copy block reading `☀️ | Clear sky | Temperature: 55 - 74°F`. The provider sent no weather at all.

## Expected behavior

A single-moment weather reading whose numeric figure is not finite, whose `weather` is not a non-empty list of objects, or whose daily `temp` is not an object of finite `day`/`min`/`max`, is **REFUSED on both runtimes** — mapped to the 502 + `"Weather data unavailable for this location."` that `/weather/at` already carries on both transports. No figure is defaulted to `0`, no condition is fabricated from `_FALLBACK_WEATHER`, no `NaN` is carried into a summary or a copy block. Well-formed bodies stay byte-identical on both sides. This is the shape `weatherPlan.ts`'s `assertNumericEntry` already states; the fix is to make it true of the builder the plan itself calls, rather than bolted on above it.

## Blast radius

Three files hold the defect, one per side plus the formatter both single-moment lookups share: `frontend/src/lib/forecastSlice.ts` (`summaryFromHour` :150-173, `dailyToHour` :135-148), `backend/services/forecast.py` (`_hour_from_daily` :77-91 — the `.get(field, 0)` defaults and `daily.get("weather") or _FALLBACK_WEATHER`), and `frontend/src/lib/weatherFormatter.ts` (`formatWeather`, which accepts 19 of the 21 shapes its Python twin refuses). **The divergence is in the parsing/building layer only** — transport containment was closed at v1.0.31 and the display renders faithfully whatever it is handed.

Because the plan builders delegate to `build_weather_payload` / `buildWeatherPayload`, repairing them **also closes 11 of the 12 residual plan-pair divergences**; `weatherPlan.ts`'s own guards then become belt-and-braces and must be re-argued rather than silently kept (standing rule: never leave a guard whose necessity has not been measured). Failure paths only: no route signature, no new outbound request, no host, no copy change, so `PRIVACY_POLICY.md` and the website are unaffected. One build in a bundled Spool release — no version bump, no `CHANGELOG.md`.

## What done looks like

1. **Every row in the three tables below answers the same verdict on both runtimes**, and that verdict is REFUSE: `/weather/at` → 502 `"Weather data unavailable for this location."`, desktop `getWeatherAt` → `{ status: 502 }` with `isOfflineError` false. Asserted per-tier on both sides, from one shared fixture, the way `test_tide_epoch_parity.py` pins its twins.
2. **No fabricated figure survives anywhere**: a backend row asserting `daily[*].weather` absent is a 502 and *not* `"Clear sky"`; a row asserting a missing daily `humidity` is a 502 and not `0`.
3. **No `NaN` and no `null` reaches the panel or the copy block**: a desktop row asserting the copy block never contains the substring `NaN`, and a row asserting the replay round-trip (`JSON.parse(JSON.stringify(payload))`) cannot produce a null figure, since no payload is produced at all.
4. `backend/.venv/bin/python -m pytest tests/ -q` green and `ruff check .` clean; `cd frontend && npm run build` green. The 139 tests in the six weather files are green at HEAD and stay green **unchanged**, except the three rows named below.
5. The three pinned rows at `frontend/src/lib/atRouteServices.test.ts:66-81` are **rewritten, not deleted** — they exist to go red when the twins converge, and that is what this build does.

---

## Measured: the `/weather/at` builder, 82 shapes, one shared fixture

| Direction | Rows | Meaning |
|---|---|---|
| Both refuse | 11 | already agreed |
| **Python refuses, TypeScript accepts** | **59** | the idea's framing; desktop shows `NaN` or a wrong figure |
| **TypeScript refuses, Python accepts** | **4** | the framing INVERTED; web/Pi shows a fabricated figure |
| Both accept, **different** figures | 7 | both wrong, differently — `0` vs `NaN` |
| Both accept, same figure | 1 | `daily weather=[]`, both fall back to clear sky |

The four inverted rows and the seven both-wrong rows are **all on the `daily` tier**, and all trace to one place: `backend/services/forecast.py:77-91` substitutes `0` for any absent daily field and `_FALLBACK_WEATHER` for an absent `weather`, before anything can refuse it.

| Shape (`daily` tier) | Backend `/weather/at` | Desktop `getWeatherAt` |
|---|---|---|
| `temp` absent or null | **200** `tempF: 0`, `H 0° · L 0°` | throws `TypeError` → 502 |
| `weather` absent or null | **200** `☀️ "Clear sky"` — fabricated | throws `TypeError` → 502 |
| `temp: {}` | **200** `tempF: 0, highF: 0, lowF: 0` | 200 `tempF: NaN`, H/L row vanishes |
| `humidity` / `dew_point` / `wind_speed` / `wind_deg` / `clouds` absent | **200** figure `= 0` | 200 figure `= NaN` |
| any of those six non-numeric or null | 502 | 200 with `NaN` or a wrong word |

## Is "a blank or a wrong figure" one bug or two? Measured: it is ONE cause with THREE rendered shapes

Rendered through the exact JSX at `WeatherForecastPanel.tsx:110,123-126`:

| Path | Figure | Rendered |
|---|---|---|
| Desktop, live | `NaN` | `NaN°F` · `Humidity NaN%` · `Cloud NaN%` |
| Desktop, offline re-show | `null` | `°F` · `Humidity %` · `Cloud %` — **the blank** |
| Web/Pi, `daily` tier | `0` | `0°F` · `H 0° · L 0°` · `Humidity 0%` — **the wrong number** |

The blank is not a separate defect: `/weather/at` rides `transport.getReplayable` (`WeatherForecastPanel.tsx:284`), and `replayStore` persists as JSON, where `JSON.stringify(NaN)` is `null`. So the same malformed body shows `NaN°F` on first load and a blank on the offline re-show. **The wrong number is the different failure**, and it is the dangerous one: `0°F` and `Clear sky` are indistinguishable from a real reading, and they reach the **copy-ready block a user pastes into a public eBird checklist**.

## The copy block is a third, wider surface — and it is shared

`formatWeather` is called directly by the desktop checklist lookup (`tauri/weatherService.ts:194`) as well as by `buildWeatherPayload`. Over 21 shapes its Python twin `backend/formatters/weather.py format_weather` refuses **all 21**; `formatWeather` refuses **2**. The 19 it accepts produce pasteable text: `Temperature: NaN - NaN°F`, `Wind: Calm` for a null wind speed, `Wind: Gale` for the string `"warm"`, and an empty condition line for a non-list `weather`.

**Scoping call for The Engineer, argued rather than assumed:** `/weather/{checklist_id}` is the other single-moment weather lookup, one call away, sharing this formatter — the same "a rule applied only where a brief points leaves its neighbours one call away" flag that made the preceding build scope eight sites instead of two. I have scoped it **in**. What stays **out** is the tide half, which is the two ideas queued behind this one.

## Is this a residue of either v1.0.31 fix? Yes — of one, by name

- **`at-route-try-containment`: this is its explicitly deferred half.** Its own brief says so ("Fixing it means making `forecastSlice.ts` refuse … belongs in its own build"), and `atRouteServices.test.ts:66-81` pins three rows precisely so that they go red when someone does it. That comment is the handover note for this build.
- **`tide-timezone-parse`: no.** Different subsystem and a different mechanism (an epoch axis, not a figure). Its explicit-UTC pattern does not transfer. What *does* transfer is its fixture discipline — a shared fixture carrying rows that SEPARATE the twins, not only rows they agree on.

## The framing is wrong in two ways, and both matter to the fix

1. **"One refuses it, the other quietly shows a blank or wrong figure" is not a fixed assignment of roles.** On the `current` and `hourly` tiers, yes. On the `daily` tier the roles swap: the backend is the one showing `0°F` and a fabricated `Clear sky`, and the desktop is the one that refuses. A one-sided repair to `forecastSlice.ts` would close 59 rows and leave 4 open **while making them harder to see**, because the side that currently refuses would stop doing so.
2. **"The newer forecast code already agrees across both" is false as stated.** Measured over the same matrix through `build_weather_plan` / `buildWeatherPlan`: 50 rows, **12 diverge** — 11 `daily`, 1 `hourly`.

| Plan-pair divergence | Python plan | TS plan |
|---|---|---|
| `daily temp` null / absent | accepts | refuses |
| `daily humidity`/`dew_point`/`wind_speed`/`wind_deg`/`clouds` absent | accepts | refuses |
| `daily weather` null / absent | accepts | refuses |
| `daily temp: {}` | accepts | refuses |
| `hourly`/`daily weather: [{}]` | refuses (`KeyError`) | accepts |

The reason is worth stating because it decides where the fix goes: v1.0.29 taught **only the TypeScript side** to refuse (`weatherPlan.ts:45-56`), and left Python's agreement resting on `build_weather_payload` happening to raise. On the `daily` tier it does not raise, because `_hour_from_daily` has already defaulted the value away. **So the straggler is not merely behind the reference — it is the shared dependency whose looseness leaks upward into the pair that is supposed to agree.** Repair it and the reference becomes true for the first time.

## The agreeing implementation, by file and line (the spec to build to)

| | Backend | Desktop |
|---|---|---|
| Finite-number predicate | `backend/services/plan_weather.py:35-36` `_finite` | `frontend/src/lib/weatherPlan.ts:36` `finite` |
| Entry refusal | (implicit — `round()` raising) | `weatherPlan.ts:45-56` `assertNumericEntry` |
| Summary-field refusal | (implicit) | `weatherPlan.ts:59-62` `toPlanWeather` |
| Daily `temp` refusal | (implicit) | `weatherPlan.ts:94-100` `dailyReading` |
| Entry filter at the boundary | `plan_weather.py:88,128` | `weatherPlan.ts:116,156` |
| Mapped to | `routers/weather.py:60-63` → 502 | `tauri/weatherService.ts:277+` → `{status: 502}` |

The parenthesised cells are the finding: **the backend half of the reference has no explicit refusal at all.** Making it explicit, in `services/forecast.py` rather than in `plan_weather.py`, is what puts the two sides on the same footing.

## Which existing tests catch this, and which must change

- **Catch it today: none.** `test_forecast.py`, `forecastSlice.test.ts`, `test_weather_at.py` and `weatherFormatter.test.ts` drive only well-formed bodies; **no file in either suite contains a malformed-figure row for the single-moment path.** That property is the finding, and it is what a reader can grep. Baseline measured: 139 passed across the six backend weather files. (Corrected in QA: this line originally carried per-file counts, and one was wrong — `forecastSlice.test.ts` has 9 tests, not 11, and is unchanged by this build. The counts bought nothing the property does not, and a wrong one gets inherited, which is why `.claude/rules/docs-and-website.md` says to state the property rather than a count. The 139 figure stays because acceptance criterion 4 is written against it.)
- **Must change: exactly three rows**, `atRouteServices.test.ts:66-81`, which assert today's divergence on purpose and are designed to go red here.
- **Must NOT change:** the byte-golden formatter parity (`weatherFormatter.golden.py`) and `weatherTidePlan.parity.test.ts` both drive conforming bodies only, so a refusal-only change cannot move them. If either moves, the change has altered a well-formed path and is wrong.
- **Coverage note:** `weatherFormatter.test.ts` asserts `bankersRound`, `windDescription` and `cardinal` across their ranges but never off their domain, which is why `windDescription(null) === 'Calm'` has shipped unnoticed.

## Does this establish the pattern the two queued tide ideas should follow? Yes — say so, do not build it

Both queued ideas are the same shape one subsystem over: a malformed moment and an unreadable station timestamp producing a confident water level. The transferable parts are the **verdict** (refuse, never default), the **place** (the builder, not the route — route containment cannot catch a body that does not throw), and the **test shape** (one shared fixture carrying rows that separate the twins). What does **not** transfer is the honest state: the tide surface has a soft `{"status": "unavailable"}` where weather raises a 502, exactly as `at-route-try-containment` decision 2 already settled. The second tide idea overlaps finding F1 of `pipeline/tide-timezone-parse/security-report.md` and the silently-wrong half that `at-route-try-containment` scoped out — whoever takes it should read both first.

## Flags for The Engineer

- **The fix is two-sided.** `forecastSlice.ts` alone leaves the 4 inverted rows open and removes the only side that currently refuses them.
- **Deleting `_hour_from_daily`'s defaults is a behaviour change to a shipped builder on a path with no test coverage.** It is the right change, but it wants its own red-first measurement per tier.
- **Re-argue `weatherPlan.ts:45-56` rather than keeping it silently.** Once the delegate refuses, those guards may be redundant — and this repo's standing rule forbids leaving a guard whose necessity has not been measured.
- **`wind_speed` has no safe default in either direction**: `null` reads as `Calm` and the string `"warm"` reads as `Gale`. Neither is a missing-data state; both are confident wrong words in pasteable copy.

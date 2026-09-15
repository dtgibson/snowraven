# Bug Brief — At-Route Try Containment

## What is broken

A JSON-valid but semantically malformed provider body is consumed by a builder that sits OUTSIDE the route's `try` (backend) or outside any `catch` (desktop), so a provider fault surfaces as the app's own fault: a bare plain-text 500 on FastAPI, and on desktop a status-less `TypeError`/`RangeError` that `isOfflineError` reads as connection-level — the panel prints "You're offline. This needs a connection." while the device is online and the request plainly reached the provider. The v1.0.29 rule in `.claude/rules/security.md` fixed exactly this on `/weather/plan` and `/tide/plan`; the single-moment lookups were left on the older shape. Measured live on both transports, not inferred (tables below).

## Steps to reproduce

All rows below were measured by driving the real routes/services with the provider seam doubled; scripts in this session's scratchpad (`probe_w2.py`, `probe_tide_at.py`, `probe3.py`, and a temporary vitest probe, since removed).

- **Backend:** `TestClient(app)` + `patch("routers.weather.fetch_forecast")` / `patch("routers.tide.fetch_tides")`, then mutate one field of the mock body. `TestClient` re-raises where production returns a bare 500.
- **Desktop:** vitest with `./tauri/http`, `./storage` and `@tauri-apps/api/core` mocked (the seam set `weatherTidePlanServices.test.ts` already uses), calling `getWeatherAt` / `getTideAt` directly.
- Reference bodies: `backend/tests/test_weather_at.py::MOCK_ONECALL`, `frontend/src/lib/weatherTidePlan.fixture.json`, and NOAA `{predictions:[…]}` shapes.

## Expected behavior

Backend `/weather/at` maps the throw to its existing `502` + `"Weather data unavailable for this location."`; `/tide/at` and `/tide/{checklist_id}` map to `{"status": "unavailable"}`, the honest state an unreadable body already gets, exactly as `/tide/plan` does 40 lines above. Desktop `getWeatherAt` throws `{ status: 502 }` so `isOfflineError` reads `false`; `getTideAt` / `getTide` resolve `{ status: 'unavailable' }`. The API key is never in a body or message on any path. Well-formed bodies are byte-identical to today.

## Blast radius

Eight sites, four files, all the same one-expression repair — `backend/routers/weather.py` (`/weather/at`, `/weather/{checklist_id}`), `backend/routers/tide.py` (`_resolve_tide_at`, `/tide/{checklist_id}`), `frontend/src/lib/tauri/weatherService.ts` (`getWeatherAt`, `getWeather`), `frontend/src/lib/tauri/tideService.ts` (`getTideAt`, `getTide`). **The `try` must enclose the `parse_observed`/`parse_predictions`/`parse_hilo` calls too, not only `compute_tide_reading`:** they sit in the same argument expression and raise on their own (measured — four of the seven tide shapes below raise inside a parser, never reaching the builder), so a repair that wraps only the builder call closes part of it. Failure paths only: no well-formed body changes, no route signature, no new outbound request, no host, no component moves — `PRIVACY_POLICY.md` is unaffected.

## What done looks like

1. Every measured shape below answers 502 / `unavailable` on its transport instead of a 500 or a status-less throw, and `isOfflineError` is `false` for every desktop throw.
2. The two existing suites (`test_weather_at.py`, `test_tide_at.py`, 11 tests) stay green **unchanged** — the repair touches only inputs they do not drive.
3. `backend .venv/bin/python -m pytest tests/ -q` green, `ruff check .` clean, `npm run build` green.
4. No version bump, no `CHANGELOG.md` — this is one build in a bundled Spool release.

---

## Measured: which shapes are affected, per route and per transport

**`/weather/at` is tier-sensitive** — it slices ONE forecast tier, so a shape mutating another tier answers HTTP 200 untouched. The tier is chosen by the `dt` parameter (no `dt` = the Current view = `current` tier).

| Mutated field | `current` tier | `hourly` tier | `daily` tier |
|---|---|---|---|
| `current.temp` / `.weather` / `.wind_speed` / `.clouds` | **500** TypeError | 200 | 200 |
| `current.sunrise` absurd | **500** OverflowError | 200 | 200 |
| `hourly[n].temp` / `.weather` / `.wind_speed` | 200 | **500** TypeError | 200 |
| `hourly[n]` carrying only `dt` | 200 | **500** KeyError | 200 |
| `daily[n].temp` non-object / `.weather` non-list | 200 | 200 | **500** AttributeError/TypeError |

**`/tide/at` and `/tide/{checklist_id}`** (identical results on both):

| NOAA body shape | Result |
|---|---|
| hi/lo, continuous or observed list holding non-objects | **500** AttributeError (raised in the parser) |
| `predictions` a string, not a list | **500** AttributeError (raised in the parser) |
| two impossible-calendar hi/lo `t` values | **500** ZeroDivisionError (F1's divide) |
| one impossible-calendar + one valid `t` | **200 `ok`, silently wrong** — `Water level: 5.2 – 5.2 ft` |
| two distinct junk `t` values | **200 `ok`, silently wrong** — `Water level: 0.5 ft` |

**Desktop twins — the transports do NOT agree today, and the repair does not by itself make them agree.**

| Shape | Backend | Desktop |
|---|---|---|
| `current.sunrise` absurd | 500 OverflowError | **throws RangeError, no status, `isOfflineError` true** |
| `current` carrying only `dt` | 500 KeyError | **throws TypeError, no status, `isOfflineError` true** |
| `current.temp` non-numeric | 500 TypeError | resolves, `tempF: null` (NaN) — **silently wrong** |
| `current.weather` non-list / `wind_speed` null / `clouds` string | 500 TypeError | resolves with a wrong figure — **silently wrong** |
| tide list of non-objects (hi/lo, continuous, observed) | 500 AttributeError | **throws TypeError, no status, `isOfflineError` true** |
| tide `predictions` a string | 500 AttributeError | resolves `unavailable` (TS `Array.isArray` guard) |
| tide: two impossible-calendar `t` | 500 ZeroDivisionError | resolves, `5.1 – 5.1 ft` — **silently wrong** |

## Is closing F1 in scope? Partly — one of its two shapes, and it is the smaller one

- **In scope: the `ZeroDivisionError`.** Route containment converts it to `{"status": "unavailable"}` at both of F1's stated locations (`routers/tide.py:124` and `:207` — note `:207` is `/tide/{checklist_id}`, which is why that route is in the blast radius alongside the two `/at` handlers).
- **NOT in scope, and it cannot be: the silently-wrong reading.** Nothing raises on that path — `compute_tide_reading` returns a well-formed reading built on two `0.0` sentinel epochs — so a `try` around it catches nothing and the wrong number ships exactly as before. This is a different change in a different file (`_epoch_min` returning `None`, with `interp_level` and the nearest-point `min` treating an unparseable time as absent), and it has twin-parity consequences the route repair does not. **Scoped apart deliberately, per the instruction not to merge them on suggestion alone.**
- **One correction to F1 as written:** the wrong figure is not literally `Water level: 0.0 – 0.0 ft`. Measured, it is an ordinary in-range number determined by the bracketing hi/lo values (`5.2 – 5.2`, `0.5 – 0.5`, `0.5`). That makes it *harder* to spot than F1 implies, and it is the half of F1 this build leaves open — worth a ROADMAP line naming it as the immediate next item.

## Do the two named test shapes transfer verbatim? Measured: no, neither does

- **`test_a_semantically_malformed_body_is_a_502_never_a_500`** — its seven shapes were written against `build_weather_plan`, which consumes the WHOLE body. `/weather/at` consumes one tier, and **six of the seven answer HTTP 200 through `/weather/at`** at the default Current tier. The test's *structure* transfers (parametrize → assert 502 + the fixed detail string + key absent from `resp.text`); the shape table must be rebuilt per tier from the measured table above. The tide half needs a separate shape asserting `{"status": "unavailable"}`, not a 502.
- **The desktop `it.each` asserting `{ status: 502 }` and `isOfflineError` false** — the assertion transfers, but only over the rows that actually throw on the TS side: measured, **two of five** weather current-tier shapes and three tide shapes. The other rows resolve with a NaN or wrong figure, where there is nothing to assert a 502 on. `getTideAt`/`getTide` map to `{ status: 'unavailable' }`, so those rows assert a resolved value as the plan test's tide rows already do.
- So **ROADMAP's "transfer as they are" is wrong** and should be corrected in the same change.

## Which existing tests catch this, and which need to change

- **Catch it today: none.** `test_weather_at.py` (5 tests) and `test_tide_at.py` (6) cover happy paths, the too-far/outside-US notices, the missing key, a bad `dt`, and a fetch failure — none drives a JSON-valid-but-malformed body. `weatherTidePlanServices.test.ts` covers the plan twins only.
- **Need to change: none.** The repair alters only failure-path behaviour on inputs no existing test drives; both `/at` suites staying green unchanged is a gate, not an aspiration.
- **Coverage gap worth naming:** no frontend test imports `getWeatherAt` or `getTideAt` at all (grep over `frontend/src` returns only the source files and `transport.ts`). The desktop `/at` twins have never been under test, so the new suite is first coverage rather than an extension.

## Flags for The Engineer

- **The twin-divergence half is real but separate.** The plan builders were taught to refuse a non-numeric figure at v1.0.29 (`.claude/rules/security.md`, "a twinned builder pair agrees on what a malformed figure is"); `lib/forecastSlice.ts`, the `/at` builder, never was — hence `tempF: null` above where Python raises. Route containment cannot fix that: a body that does not throw is not caught. Fixing it means making `forecastSlice.ts` refuse, which is a behaviour change to a shipped builder and belongs in its own build.
- **`/weather/{checklist_id}` carries a second, different defect:** `datetime.strptime(checklist["obs_dt"], …)` at `routers/weather.py:129-131` 500s on a malformed eBird `obs_dt` (measured: `'2024-13-40 25:61'`, `''`, `'not-a-date'` all raise `ValueError` uncaught). Same symptom, different source — eBird data rather than a provider body. Three lines, same handler; flagged for a decision rather than assumed in.
- **File-sweep discipline:** the preceding build's own security report raised the convention flag that a rule applied only to the site a brief names "leaves its neighbours one call away." That is why this brief scopes all eight provider-body sites across the four files rather than the two the idea names.

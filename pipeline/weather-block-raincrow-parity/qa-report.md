# QA Report — weather-block-raincrow-parity (moon phase on night weather blocks)

**Date:** 2026-06-10
**Test Runners:** vitest (frontend), pytest (backend)
**Result:** PASSED — no fix attempts needed, zero retries.

## Test Suite Results

| Suite | Run 1 | Run 2 |
|---|---|---|
| Frontend (`npx vitest run`) | 769 passed / 0 failed, 52 files | 769 passed / 0 failed, 52 files |
| Backend (`.venv/bin/python -m pytest tests/ -v`) | 110 passed / 0 failed | — |

## Acceptance Criteria Verification

| Criterion (change-brief Acceptance) | Result | Evidence |
|---|---|---|
| Full frontend + backend suites green | ✓ Pass | 769/769 vitest (twice), 110/110 pytest. |
| Night fixture header like `☁️🌔`; block strips to empty via `stripWeatherTideBlocks`; has-weather flag round-trips | ✓ Pass | Independent harness (`/tmp/qa-parity/strip_night.test.ts`, 5/5): real `formatWeather` night output (`☁️🌗` N / `☁️🌓` S) strips to `''` in both multi-line and CSV-collapsed single-line forms; `hasWeatherBlock` and `hasSnowravenWeatherBlock` true on raw text; prose before/after a collapsed block survives with no `☁️` or moon leak — the unspaced header keeps one emoji run as designed. |
| Day fixture byte-identical to pre-change golden | ✓ Pass | `git diff HEAD` of `weatherFormatter.test.ts` removes ONLY call-signature plumbing (`'UTC'` → `'UTC', LAT_N`) and fixture `dt` additions — not one expected golden string changed. Re-ran `weatherFormatter.golden.py`: all nine pre-existing day sections reproduce the expected strings the test file carried at HEAD (production ☁️ block, calm, gale, beaufort sort/dedup, direction dedup/order, equal-range, capitalize). Day `dt`s added to the six fixture-sharing test files all sit inside their sunrise/sunset windows, so those shared fixtures still emit the identical day block. |
| TS and Python byte-identical for identical inputs | ✓ Pass | Independent harness (`/tmp/qa-parity/parity_py.py` + `parity_ts.test.ts`), 5 cases `cmp`-verified byte-for-byte: day production (242 B, `☁️`), night N (245 B, `☁️🌗`), night S (245 B, `☁️🌓`), mixed multi-hour (284 B, `🌥️🌗`), adversarial clear-sky night with fractional values + the banker's-rounding-sensitive 22.5° bearing in a real tz (236 B, `☀️🌗`). |

## Independent re-derivations beyond the shipped tests

- **Golden oracle:** `python3 frontend/src/lib/weatherFormatter.golden.py` runs clean (no venv); all 12 section outputs match the test file's expected strings, including the three new night goldens and the nine moon-bin timestamps.
- **Moon math vs reality (both runtimes):** 2026-04-20 20:00 PDT → 🌒 waxing crescent (matches the user's real RainCrow block on S324605421; dawn variant also 🌒); 2026-04-28 20:08 PDT → 🌔 waxing gibbous (matches S329216460). Today 2026-06-10 21:00 PDT → 🌘 waning crescent at lunar age 25.60 d, 1.60 d clear of the nearest bin boundary (not ambiguous; consistent with the 2026-06-08 last quarter). Python and TS agree on all timestamps.
- **Type-check:** `npx tsc --noEmit` exits 0 — no `formatWeather`/`formatWeatherBody` caller was missed by the signature change (vitest alone would not have caught a stale call site).
- **Zero-production-strip-change requirement:** `frontend/src/lib/commentBlocks.ts` and `frontend/src/lib/checklistsTab.ts` have empty diffs, as the brief mandates.

## Flake Diagnosis — BirdingStats.test.tsx

**Pre-existing/environmental if real; NOT introduced by this change. Not reproducible here.**

- 6 isolated runs + 2 full-suite runs: 8/8 passed (3 tests each in isolation).
- Import-graph check: the test imports only vitest, @testing-library/react, and `../types`; the component imports neither `weatherFormatter`, `weatherService`, nor any other file touched by this change. No path from the diff reaches it.
- The test controls rAF/rIC via explicit FIFO queues (deterministic by construction); any historical flake is environmental (timing under load), not data-dependent on this change.

## Adjacent Regression Review

- `tideFormatter.test.ts` (combined weather+tide copy path), `Checklists.test.tsx`, `WeatherTideSection.test.tsx`, `checklistBadges.test.ts`, `checklistsTab.test.ts`: each diff is exactly two lines — a daytime `dt` added to the shared fixture and the `lat` arg. No assertion deleted or loosened; all green.
- `commentBlocks.test.ts`: purely additive (a new night-block describe with 6 regressions, fixtures built by the real formatter per house rule).
- `test_weather_router.py`: additive night test + a *strengthened* day assertion (`startswith("☁️\n")`). `test_formatters.py`: additive (4 night/day tests + the moon-bin table); existing assertions untouched.

## Release Chores

- `frontend/package.json` and `src-tauri/tauri.conf.json` both **0.5.28** ✓
- `CHANGELOG.md` 0.5.28 entry, accurate ✓ · `docs/HELP.md` Weather section updated ✓ · `README.md` feature line updated ✓
- `website/index.html` feature copy updated; version pill + footer correctly **left at v0.5.27** (they move at release, matching 0.5.27 practice) ✓
- `PRIVACY_POLICY.md` untouched ✓ (no new API calls or providers — phase is computed locally)

## Edge Cases Tested

- Southern Hemisphere mirroring (formatter golden + strip + parity harness).
- Mixed multi-hour block (day start, night end): night status from ANY hour, phase from the FIRST hour.
- CSV-collapsed single-line night block with prose on both sides; entity-encoded night block.
- Equator (lat 0) uses the Northern set; latitude has no effect on day blocks.
- Bin-boundary distance check on today's date (1.6 d margin — no ambiguity flag needed).

## Known Limitations

- The phase algorithm is mean-age arithmetic (lunarphase-js port); real phases can deviate up to ~±0.7 d near bin boundaries. Acceptable by design — it is the same algorithm raincrow ships, and the pure-UTC Julian Day deviation keeps both runtimes deterministic and identical.
- QA harnesses live in `/tmp/qa-parity/` (not part of the repo); they can be re-run any time before release.

## Fixes Applied

None. No failures found in any round.

# Change Brief — weather-block-raincrow-parity

**Lane:** Improve · **Approved:** 2026-06-10 (Stage 1 gate)
**Basis:** `parity-report.md` in this directory (verified investigation, 2026-06-10).

## Goal

Add a moon-phase emoji to SnowRaven's generated weather blocks on night checklists,
achieving functional parity with raincrow (github.com/parkerdavis1/raincrow). Dew point
requires **no change** — SnowRaven already emits it unconditionally in both formatters.

## Non-goals

- No labeled `Moon:` line (would require strip-vocabulary changes; rejected).
- No raincrow-identical bare-moon header on clear nights (their unmapped-night-icon
  limitation, not a design to copy).
- No new settings/toggles, no °C support, no rounding changes, no new API calls or
  fields fetched, no `PRIVACY_POLICY.md` change.

## Specification

### Header format (the only output change)

On a night checklist, the phase emoji is appended to the existing condition emoji on
line 1, **unspaced**: `☁️🌔`. Unspaced is load-bearing: the comment stripper anchors on
the *last emoji run* before the first labeled line (`commentBlocks.ts:200-211`); a space
would split the run and leak `☁️ ` on strip. Day blocks are byte-identical to today's.

### Night detection

- A sampled hour is night when `dt < sunrise || dt > sunset` (all three are epoch
  seconds already in each timemachine data item; `dt` needs typing on the frontend).
- The block is a night block when **any** sampled hour is night.
- The phase is computed from the **checklist start** hour (first response's `dt`),
  matching raincrow's start-time behavior.

### Phase algorithm (port of `lunarphase-js@2.0.3`, pinned from the npm dist)

- `JD = unix_ms / 86400000 + 2440587.5` — **pure UTC** (deliberate deviation from the
  library, which bakes in the runtime's local tz offset; both ports MUST use this same
  deterministic form so TS and Python agree byte-for-byte).
- `age = frac((JD − 2451550.1) / 29.53058770576) × 29.53058770576`
- Bins (age <): 1.84566173161 New, 5.53698519483 Waxing Crescent, 9.22830865805 First
  Quarter, 12.91963212127 Waxing Gibbous, 16.61095558449 Full, 20.30227904771 Waning
  Gibbous, 23.99360251093 Last Quarter, 27.68492597415 Waning Crescent, else New.
- Northern emoji, by phase order: 🌑 🌒 🌓 🌔 🌕 🌖 🌗 🌘. Southern Hemisphere
  (`lat < 0`) mirrors: New 🌑, Waxing Crescent 🌘, First Quarter 🌗, Waxing Gibbous 🌖,
  Full 🌕, Waning Gibbous 🌔, Last Quarter 🌓, Waning Crescent 🌒.
- Formatter signatures gain `lat`; both callers already hold it
  (`frontend/src/lib/tauri/weatherService.ts:149-160`, `backend/routers/weather.py:36-57`).

### Files in lockstep (the byte-golden chain — all in one change)

1. `frontend/src/lib/weatherFormatter.ts` — moon logic, `lat` param, `dt` in typing
2. `backend/formatters/weather.py` — identical logic, stdlib only
3. `frontend/src/lib/weatherFormatter.golden.py` — keep as exact oracle copy; rerun to
   regenerate every byte-golden expected string
4. `frontend/src/lib/weatherFormatter.test.ts` — regenerated goldens; new fixtures:
   night single-hour, night multi-hour (mixed day/night), Southern Hemisphere night,
   day-block-unchanged regression
5. `backend/tests/test_weather_router.py` — mocks gain `dt` (formatter hard-indexes;
   KeyError otherwise); night-case assertions
6. `frontend/src/lib/commentBlocks.test.ts` — night-block strip regressions built by
   calling the real formatter (production `commentBlocks.ts` must need **zero** changes;
   if it does need one, stop and flag it)
7. Release chores per CLAUDE.md: patch bump in BOTH `frontend/package.json` and
   `src-tauri/tauri.conf.json`, `CHANGELOG.md`, `docs/HELP.md`, `README.md`, `website/`
   (feature copy; version pill/footer only move at release per established practice —
   match what 0.5.27 did)

### Acceptance

- Full frontend (vitest) and backend (pytest) suites green.
- A night fixture produces a header like `☁️🌔` whose block strips to empty via
  `stripWeatherTideBlocks` and round-trips the has-weather flag.
- A day fixture's output is byte-identical to the pre-change golden.
- TS and Python formatters produce byte-identical blocks for identical inputs
  (oracle-verified).

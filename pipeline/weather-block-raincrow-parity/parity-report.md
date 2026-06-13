# Parity Report — SnowRaven weather blocks vs raincrow: moon phase & dew point

**Date:** 2026-06-10 · **Stage:** 1 (The Evaluator) · **Lane:** Improve
**Method:** 5 parallel code/data surveys (SnowRaven frontend, SnowRaven backend, raincrow
source at github.com/parkerdavis1/raincrow, the real eBird export, the strip/filter logic),
26 adversarial verifications (all claims confirmed, several sharpened), a completeness
critic, and the published `lunarphase-js@2.0.3` dist pulled from npm to pin raincrow's
moon algorithm (its repo pins only the caret range `^2.0.3`).

---

## Question 1 — Moon phase on night/nocturnal checklists: **NOT at parity**

**SnowRaven never includes a moon phase.** Both formatters
(`frontend/src/lib/weatherFormatter.ts:128-139`, `backend/formatters/weather.py:105-117`)
emit a fixed 11-line block — condition emoji, condition, Temperature, Wind, Wind
Direction, Cloud Cover, Humidity, Dew point, Sunrise, Sunset, attribution — with **zero
night awareness**: no time-vs-sunrise/sunset comparison anywhere, and `conditionEmoji`
returns ☀️ for clear sky even at midnight (`weatherFormatter.ts:61`). The only "moon" in
the codebase is the comment **stripper's** tolerance for RainCrow's moon-emoji headers
(`commentBlocks.ts:151-154`, shipped 0.5.27).

**Raincrow includes a moon-phase emoji on night checklists.** Mechanics, from source:

- **Where:** merged into the first (icon) line of the copy text — never a separate line,
  and the phase **name** never appears (`renderCopyText.js:5-83`, `parse/icon.js`).
- **When:** icon option on + emoji icon type (default), and at least one of the
  checklist start/end OpenWeather icon codes ends in `n` — night detection is delegated
  entirely to OpenWeather's d/n icon suffix (`parse/icon.js:35-36`); raincrow never
  compares times itself.
- **Phase:** `lunarphase-js` from the checklist **start** time; emoji mirrored for the
  Southern Hemisphere when `lat < 0`.
- **Quirk that defines its night look:** raincrow's emoji map has **no night entries**
  for clear/few/scattered (`01n`/`02n`/`03n` unmapped, `icon.js:38-54`), so a clear
  night's header is the **bare moon emoji alone**.

**Your two examples are RainCrow blocks, confirming the gap from your own data:**

| Date | Checklist | Header | Detail |
|---|---|---|---|
| 2026-04-20 | S324605421 | 🌒 waxing crescent | encoded `&#x1f312;` in the export; RainCrow attribution |
| 2026-04-28 | S329216460 | 🌔 waxing gibbous | 8:08 PM start, after the 7:56pm sunset line; RainCrow attribution |

File-wide: **7** checklists carry a moon emoji — **all RainCrow-generated**. Of **308**
weather-block checklists, 236 are RainCrow, 71 SnowRaven, 1 attribution-less/edited.

## Question 2 — Dew point: **already at parity**

SnowRaven unconditionally emits `Dew point: X°F` (ranges as `X - Y°F`) as line 8 of every
block, in both formatters (`weatherFormatter.ts:105,136`; `weather.py:86,113`), from the
same One Call `dew_point` field raincrow uses. **306** of your checklists contain dew
point text. Remaining differences are cosmetic and need no action: raincrow's field is
toggleable (default on) and unit-selectable °F/°C with half-up rounding
(`parse/dewPoint.js:12-13`); SnowRaven's is unconditional °F with banker's rounding — a
52.5°F input renders 53 in raincrow, 52 in SnowRaven.

---

## Proposed fix — add a moon phase to night blocks

### The one product decision: header semantics

- **Option A — raincrow-identical:** bare moon replaces the condition emoji on clear
  nights (because raincrow's night icons are unmapped). Not recommended: that loss of
  condition info is a raincrow limitation, not a design.
- **Option B — recommended:** keep SnowRaven's condition emoji and append the phase
  emoji to the same header line on night checklists: `☁️🌔`. **No space between them** —
  the strip anchor takes the *last emoji run* before the first labeled line
  (`commentBlocks.ts:200-211`), so spaced `☁️ 🌔` would leak `☁️ ` when stripped, while
  unspaced `☁️🌔` is one run and needs **zero changes to `commentBlocks.ts`**.
- A labeled `Moon:` line is the worst option: it requires `STRONG_MARKER_RE` vocabulary
  changes plus fixes for two known leak shapes the investigation found.

### Night detection

Compare each sampled hour's `dt` against the already-fetched `sunrise`/`sunset`
(night = `dt < sunrise || dt > sunset`); include the moon when **any** sampled hour is
night; compute the phase from the **checklist start** (matches raincrow). This avoids
plumbing OpenWeather's `icon` field through both runtimes' types and mocks. `dt` is in
the timemachine payload at runtime but untyped on the frontend — a one-line typing
addition. Note: moon data itself is **not in the timemachine endpoint at all** (verified
against docs and all repo mocks), so the phase must be computed, not fetched — no new
API call, no new provider, `PRIVACY_POLICY.md` untouched.

### Algorithm (pinned from `lunarphase-js@2.0.3` dist)

- `JD = ms/86400000 − tzOffsetMinutes/1440 + 2440587.5` — **v2.0.3 quirk:** it bakes in
  the *runtime's* local timezone offset. For the port, compute deterministically
  (recommend pure UTC, or checklist-local for raincrow-closer behavior) and **identically
  in TS and Python**; the choice only matters within ~±2% of a phase boundary.
- `age = frac((JD − 2451550.1) / 29.53058770576) × 29.53058770576`
- 8 bins at odd multiples of `29.53058770576 / 16`: New < 1.84566…, Waxing Crescent
  < 5.53698…, First Quarter < 9.22830…, Waxing Gibbous < 12.91963…, Full < 16.61095…,
  Waning Gibbous < 20.30227…, Last Quarter < 23.99360…, Waning Crescent < 27.68492…,
  else New.
- Northern emoji 🌑🌒🌓🌔🌕🌖🌗🌘; Southern mirrored (waxing crescent → 🌘, etc.);
  hemisphere by `lat < 0`. Formatter signatures gain `lat` — both callers already hold it
  (`weatherService.ts:149-160`, `backend/routers/weather.py:36-57`).

### Files that must move in lockstep (the byte-golden chain)

1. `frontend/src/lib/weatherFormatter.ts` — moon logic, `lat` param, `dt` typing
2. `backend/formatters/weather.py` — identical logic, stdlib-only
3. `frontend/src/lib/weatherFormatter.golden.py` — hand-maintained oracle; rerun it to
   regenerate the byte-golden expected strings
4. `frontend/src/lib/weatherFormatter.test.ts` — regenerated goldens + new day/night
   fixtures (incl. a Southern Hemisphere case)
5. `backend/tests/test_weather_router.py` — mocks must gain `dt` (the formatter
   hard-indexes and would KeyError)
6. `frontend/src/lib/commentBlocks.test.ts` — fixtures call the real formatter; add
   night-block strip regressions (no production strip change with Option B)
7. Release chores: patch bump in both version files, CHANGELOG, HELP.md, README, website

### Risk notes

- **eBird comment length:** risk nil — the longest real comment in your export is 7,289
  chars vs a 242-byte SnowRaven block; the moon adds a few characters.
- **Strip self-compatibility:** verified — a SnowRaven `☁️🌔`-headed block strips cleanly
  with today's logic; RainCrow's real night blocks already do (0.5.27).
- **Lane check:** stays an improvement — two formatters, tests, docs; the new visible
  content is parity-driven, no new surface or interaction.

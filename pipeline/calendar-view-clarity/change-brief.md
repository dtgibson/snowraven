# Change Brief — Calendar View Clarity

## What is changing
Three Calendar-tab refinements, one patch. (1) The all-years combined grid
drops its fixed reference year (`COMBINED_REF_YEAR = 2000`, `Calendar.tsx`
line 40; threaded as `refYear` into `buildMonthCells` for weekday lead AND
`daysInMonth`) and lays out like the CURRENT year instead, so the combined
grid matches the current-year view. (2) `MonthGrid` keeps its v0.5.61
per-cell day-of-month labels; `YearOverview` mini-cells drop their v0.5.60
count numbers entirely (back to shading-only thumbnails), retiring the
`.sr-cal-mininum > span` / `@container (min-width: 152px)` floor and the
`container-type: inline-size` on `.sr-cal-minimonth` (added only for it).
(3) The View toggle labels SWAP: `MonthGrid` becomes "Compact",
`YearOverview` becomes "Large" — relabel only; phones keep forcing the
MonthGrid view via `useIsPhone` (unchanged mechanism).

## Why now
User request, confirmed: the combined grid's cell positions match no real
year (the v0.5.61 audit's root cause — mitigated then by date labels, now
fixed at the layout); the mini-cell numbers add clutter the thumbnails
don't need; and the current Large/Compact naming reads backwards to the
user. Same-lane continuation of the v0.5.60/0.5.61 Calendar refinement
runs.

## User-facing impact
Yes, deliberately, all frontend-visual: combined-grid weekday alignment
shifts to today's year; mini-month thumbnails lose their numbers (exact
figures remain in the MonthGrid view and day popup — update the HELP
promise); the two toggle labels swap (aria-labels/titles follow). Counts,
tiers, legend, popup, textures, tokens: unchanged. Docs follow in the same
change: `docs/HELP.md` (View density section, lines ~234–241), `README.md`
line 14 (names the fixed-reference-year alignment — now wrong), website
copy (`website/index.html` ~line 256 + version pill), CHANGELOG + patch
bump 0.5.62 in BOTH `frontend/package.json` and
`src-tauri/tauri.conf.json`.

## Decisions touched
- **v0.5.60 "Calendar Refinements"** — REVERSED in part: the Compact
  mini-cell count numbers + 152px container-query floor bullet is undone;
  the Months→Large / Year→Compact relabel bullet is revised by the swap
  (its "code and UI now agree" rationale is at stake — see flags).
- **v0.5.61 "Calendar Tuneup"** — REVISED in part: the combined-years
  audit bullet's fixed-reference-year framing changes (alignment now
  tracks the current year); its fix (Large-view day-of-month labels) and
  its regression-locked union/sum count invariants STAY binding.
- **v0.5.58 "Calendar Tab"** — REVISED in part: the lexical-dates bullet's
  "combined months key on dayOfWeek(2000, m, d)" note; the ramp, hatch,
  and lexical-date decisions themselves are untouched.

## What done looks like
Combined view's weekday columns match the current-year view (current year
from a module-level session constant, never a render-time `new Date()` —
the SESSION_NOW_MS pattern), with Feb 29 still rendered; thumbnails are
shading-only with the container-query CSS retired; toggle labels swapped
everywhere (component, titles, tests, HELP, README, website). Suite green:
Calendar.test.tsx label/mini-number tests updated, `calendarContrast` /
`calendarTextures` / count-invariant tests untouched and passing;
typecheck + `npm run build` clean; version + CHANGELOG shipped.

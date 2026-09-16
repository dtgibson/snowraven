# Bug Brief — Tide Timezone Parse

## What is broken
`_epoch_min` (`backend/services/tide.py:78`) converts NOAA `lst_ldt` wall-clock strings with a NAIVE `datetime(y, mo, d, h, mi).timestamp()`, which resolves in whatever zone the **server process** runs in; its docstring claims "Calendar-correct epoch-minutes", and it is not (the house precedent for exactly this shape is DECISIONS.md's "A DOCSTRING IS NOT A TEST").
The desktop twin `epochMin` (`frontend/src/lib/tide.ts:131`) already uses `Date.UTC` and is correct, so the two transports **disagree today** — which the module docstring's own "web/Pi twin of frontend/src/lib/tide.ts" claim asserts they do not.
Confirmed at HEAD, not inferred from ROADMAP: the absolute value differs in all six zones tested, and **both** consumers take only differences, exactly as the roadmap says — `interp_level`'s interpolation fraction (line 102) and the nearest-point `min(...)` (line 141). No path consumes an absolute value.
**Latent on most days, genuinely wrong on two**: a difference is correct unless the *server's own* zone crosses a DST transition between the two wall-clock strings.

## Steps to reproduce
Deterministic and machine-runnable; no user input. From `backend/`, run the same helper under two zones:
```sh
for z in UTC America/Los_Angeles; do TZ=$z .venv/bin/python -c "
from services.tide import _epoch_min, compute_tide_reading
h=[{'t':'2026-11-01 01:00','v':0.0,'type':'L'},{'t':'2026-11-01 03:00','v':6.0,'type':'H'}]
r=compute_tide_reading('2026-11-01 01:30','2026-11-01 02:30',[],[],h,{'id':'X','name':'X'},1.0)
print('$z','span_min=',_epoch_min('2026-11-01 03:00')-_epoch_min('2026-11-01 01:00'),'level=',round(r.level_min,2),round(r.level_max,2))"; done
```
Measured: `UTC span_min=120.0 level=1.5 4.5` (correct) vs `America/Los_Angeles span_min=180.0 level=1.0 5.0` (wrong).
That second line is a **shipped user-facing figure** — `format_tide_body` renders it as `Water level: 1.0 – 5.0 ft` instead of `1.5 – 4.5 ft`.

## Expected behavior
`_epoch_min` returns the same value for the same string in every process zone, and equals the TS twin's `epochMin` for every input — i.e. differences between two values equal the **calendar** difference of the two wall clocks.
The fix the roadmap asks for is convergence on the explicit form already used twice in this repo (`tz_clock.gmt_epoch`, TS `epochMin`): an anchored ASCII-class regex plus `tzinfo=timezone.utc`, with a `ValueError` guard.
Deliberately **not** in scope: re-parsing `lst_ldt` in the *station's* real zone via `get_timezone(...)`. That would give true elapsed time across the *station's* transition, diverge from the shipped TS twin, and reopen planner decision D4; it is a separate question, named here so it is not silently skipped.

## Blast radius
**Backend-only as a code change** — the TS twin is already correct, so nothing in `frontend/src/lib/tide.ts` or `tauri/tideService.ts` needs editing; the *parity row* is owed on both transports per repo convention (precedent: `test_tz_clock_parity.py` + a shared fixture).
Reached by both shipped single-moment paths — `GET /tide/{checklist_id}` and `GET /tide/at` (`routers/tide.py:124,207`) — and only via the interpolation fallback branch (subordinate stations that serve only hi/lo) and the nearest-point fallback. `/tide/plan` is untouched: it already uses `gmt_epoch`.
Adjacent cleared, not assumed: the three sibling `.timestamp()` calls in `routers/weather.py:89,133,134` all call `.replace(tzinfo=tz)` first and are correct. `shift_local` is pure `timedelta` calendar math and is unaffected. No other naive `.timestamp()` exists in `backend/`.
No user-facing copy changes, so no `docs/HELP.md` / `README.md` / `website/` edit; a fix still owes the four-file version bump + `CHANGELOG.md` (currently 1.0.30).

## What done looks like
**No existing test catches this, and none needs to change — measured, not assumed.** Zero backend tests import `services.tide`; all tide coverage is route-level on non-transition dates. The full suite is 447 passed under both `TZ=UTC` and `TZ=America/Los_Angeles`, and **447 passed with the candidate UTC fix injected** under both — so the change turns nothing red and nothing green would have gone red without it.
Done = a new guard that fails against today's code: `_epoch_min` asserted TZ-invariant across at least one DST-transitioning zone, plus the `2026-11-01 01:00 → 03:00` span asserting 120 minutes and the reading asserting `1.5 / 4.5`.
Plus a cross-transport parity row pinning `_epoch_min` and `epochMin` to the same values on a shared fixture, and the false "Calendar-correct" docstring corrected to state the explicit-UTC contract.
Gate: `cd backend && .venv/bin/python -m pytest tests/ -v` green under two zones, and `cd frontend && npm run build` green.

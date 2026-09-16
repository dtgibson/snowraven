"""The `dt` REQUEST-PARAMETER boundary for the two single-moment lookups,
`GET /weather/at` and `GET /tide/at`. Pure; no I/O.

Twin of `frontend/src/lib/wallClock.ts`, one predicate per runtime, imported by
both consumers on each side -- the shape `is_finite_figure` / `isFiniteFigure`
established one build earlier. Those two are NUMERIC-ONLY by contract and are
not reusable for a wall-clock string; what carries over is the shape, not the
predicate.

WHAT A CONFORMING `dt` IS
-------------------------
1. It matches `YYYY-MM-DD HH:MM` or `YYYY-MM-DD` EXACTLY -- explicit ASCII
   `[0-9]`, and `fullmatch`, for two different twinned-guard reasons that are
   each a separator row in wallClock.fixture.json:

   * Python's `\\d` matches every Unicode decimal digit and `int()` parses it
     happily, while JavaScript's is ASCII-only (`.claude/rules/security.md`,
     v0.5.54). `٢٠٢٤-٠٥-٠١ 12:00` shifted to a real instant on this runtime and
     passed through unchanged on the other -- measured, not inferred.
   * Python's `$` matches BEFORE a trailing newline and JavaScript's does not
     (v0.5.87), so `re.fullmatch` is the house form and is what makes
     `"2024-05-01 12:00\\n"` refuse identically on both sides.

2. It names a REAL calendar moment. `datetime(...)` raises on month 13, day 45,
   hour 99, minute 99, Feb 30 and year 0; the TS twin's `Date` silently ROLLS
   every one of them into a different real instant, which is the whole reason
   the desktop half rendered a confident water level for a moment nobody asked
   about. The two halves therefore refuse the same set by two different
   mechanisms, and the fixture carries a row for each.

3. It leaves `margin_hours` of head- and tail-room inside the representable
   calendar, so the window its caller derives from it exists. `/weather/at`
   passes 0: it reads one instant and needs no room. `/tide/at` passes
   `TIDE_WINDOW_MARGIN_HOURS`.

THE MARGIN IS A PER-CALLER ARGUMENT, NOT A PROPERTY OF THE PREDICATE, and that
is deliberate. Folding 25 hours into the predicate itself would refuse
`9999-12-31 23:59` on `/weather/at` too, where it answers a truthful
`out-of-range` today ("no weather reaches that far") -- the Predict date input
carries a `min` and no `max`, so that is a reachable answer rather than a
theoretical one, and replacing it with a bad-request error would be a loss.

WHAT THE CALLER OWES
--------------------
`is_blank_wall_clock` first (absent or empty -> "now" in the LOCATION's
timezone), then `parse_wall_clock`, and a 400 carrying `BAD_DT_DETAIL` on None.
The presence half is spelled `is None`, never truthiness: Python and JavaScript
disagree about `{}`, `[]`, `0`, `False` and `""` in two directions at once, so
the empty string is named explicitly here and every other value is the
validator's question (weather-at-malformed-parity decision 10). A query
parameter is only ever `str | None`, so no other falsy value is reachable -- the
spelling is for the twin, not for the reachability.

LINEARITY, AND WHY THERE IS DELIBERATELY NO LENGTH REFUSAL
----------------------------------------------------------
This adds a new scan over caller-supplied text, so `.claude/rules/security.md`
(v1.0.21/v1.0.23) asks for the argument up front and v1.0.30 asks it to name its
own enforcement point. Both halves:

* **Structural.** The pattern is exact-count quantifiers only — no unbounded
  quantifier, no nesting, one optional group — so backtracking states are
  bounded at two and the work is O(1) after the anchor.
* **Measured** (five hostile shapes across six sizes to 10 MB, both runtimes):
  `fullmatch` is flat at <=0.002 ms at every size including 10 MB, and the TS
  twin's `exec` is flat at 0.28-0.36 ms at 10 MB, sub-linear from 1 MB to 10 MB.
  `shift_local`'s `[0-9]` form is likewise flat. Nothing quadratic.
* **Enforcement point, web/Pi.** A long `dt` never reaches the handler at all:
  uvicorn builds its h11 connection with `DEFAULT_MAX_INCOMPLETE_EVENT_SIZE`
  = 16 KB, so a request line above that is refused at the transport, and
  `start.sh` launches plain `uvicorn main:app`, which is the shipped
  configuration.
* **Enforcement point, desktop.** There is no HTTP layer; `dt` originates in
  `WeatherForecastPanel`'s native date and time inputs.

**So do NOT add a length check here, and this paragraph is why.** The string is
fully materialized by the framework before this function runs, so a refusal
inside it cannot reduce peak retention by a single byte — which is the exact
OPPOSITE of `lib/uploadGuard.ts`'s bound (v1.0.20), where the cap is a RETENTION
bound on a cons-string copy that would otherwise be made. Nothing here is
stored, cached, logged or echoed. A length refusal would buy nothing and would
read to the next person as though it were load-bearing.

DELIBERATELY IMPORTS NOTHING FROM `fastapi`. `/tide/at`'s builder sits inside a
broad `except Exception` that turns an `HTTPException(400)` into
`200 {"status": "unavailable"}` (at-route-try-containment decision 13, measured),
so the refusal is raised by the CALLER, outside that try, and this module stays
free of anything that could be raised from inside one.
"""

import re
from datetime import datetime, timedelta

# Byte-identical to the sentence `/weather/at` has carried since 0.5.34, and the
# single definition both routes now import so the two cannot drift. It is a
# fixed literal with no interpolation: a refusal echoes no coordinate, no
# provider URL and no upstream body.
BAD_DT_DETAIL = "That doesn't look like a valid date and time."

# The widest shift `/tide/at` makes from the moment it is given: `end` is
# `shift_local(start, 1)`, and the high/low window runs from
# `shift_local(start, -24)` to `shift_local(end, 24)` -- 25 hours forward of
# `start`, 24 back. Derived from the route rather than chosen, and pinned to it
# by test_tide_at_bad_request.py.
TIDE_WINDOW_MARGIN_HOURS = 25

_WALL_CLOCK_RE = re.compile(r"([0-9]{4})-([0-9]{2})-([0-9]{2})(?: ([0-9]{2}):([0-9]{2}))?")


def is_blank_wall_clock(dt: str | None) -> bool:
    """True for an absent or empty `dt` -- the two values that mean "now in the
    LOCATION's timezone" rather than "a moment I could not read"."""
    return dt is None or dt == ""


def parse_wall_clock(dt: str, margin_hours: float = 0) -> datetime | None:
    """A naive `datetime` for a conforming wall clock, or None for anything
    unreadable. NEVER raises: every shape this refuses is one the callers used
    to let through to `shift_local`, whose `ValueError` / `OverflowError`
    surfaced as a plain-text 500."""
    if not isinstance(dt, str):
        return None
    m = _WALL_CLOCK_RE.fullmatch(dt)
    if not m:
        return None
    year, month, day = int(m.group(1)), int(m.group(2)), int(m.group(3))
    hour = int(m.group(4)) if m.group(4) is not None else 0
    minute = int(m.group(5)) if m.group(5) is not None else 0
    try:
        moment = datetime(year, month, day, hour, minute)
    except ValueError:
        return None
    if margin_hours:
        try:
            moment - timedelta(hours=margin_hours)
            moment + timedelta(hours=margin_hours)
        except OverflowError:
            return None
    return moment


def wall_clock_text(moment: datetime) -> str:
    """'YYYY-MM-DD HH:MM' for a datetime, zero-padded EXPLICITLY rather than
    through `strftime("%Y-...")`: `%Y` is not zero-padded for years below 1000
    on glibc or macOS, so a year-500 moment would render `500-06-15 12:00` and
    fall straight through `shift_local`'s four-digit pattern into its
    passthrough branch. Twin of `wallClockText`."""
    return (
        f"{moment.year:04d}-{moment.month:02d}-{moment.day:02d} "
        f"{moment.hour:02d}:{moment.minute:02d}"
    )

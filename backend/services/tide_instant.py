"""THE PLACEMENT BOUNDARY for a NOAA CO-OPS `t` -- the timestamp inside a
RESPONSE, not a request parameter. Pure; no I/O.

Twin of `frontend/src/lib/tideInstant.ts`, one predicate per runtime, imported
by every consumer on each side -- the shape `is_finite_figure` /
`isFiniteFigure` and `parse_wall_clock` / `parseWallClock` established. Those
govern a NUMBER and a REQUEST parameter respectively and are not reusable here;
what carries over is the shape, not the predicate.

WHAT THIS REPLACES, AND WHY A SENTINEL WAS THE DEFECT
----------------------------------------------------
`_epoch_min` / `epochMin` returned `0.0` -- the 1970 epoch -- for a `t` they
could not read, and every consumer then treated that as a real instant. 1970 is
56 years from any tide window, so the interpolation fraction collapsed to
~0.99999 and the reading degenerated into "return the other bracket": a window
whose true answer is `2.4 - 2.8 ft` rendered `1.5 - 1.5 ft`, and it rendered
that on BOTH runtimes, byte for byte, in the block a user pastes into a
permanent public eBird checklist comment. Plausible, in range, correctly
rounded, and wrong.

So the answer is `None`, never a number. **The test may not be spelled `== 0` or
`> 0`**, and both halves of that are real rather than theoretical:
`1970-01-01 00:00` is a placeable instant whose epoch IS the old sentinel, and a
pre-1970 instant is placeable and negative (`services/plan_tide.py` used
`t > 0` and therefore dropped both).

WHAT A PLACEABLE `t` IS
-----------------------
1. It is a STRING. NOAA documents all three products as shipping `t` as one, and
   the two coercions that stood in for this check were not twins: `str(None)` is
   `'None'` where `String(null)` is `''`, and `'None'` sorts AFTER every real
   timestamp where `''` sorts before -- so the two runtimes bracketed the same
   window with different points and took different branches. That divergence
   never reached the sentinel at all. `parse_wall_clock`'s `isinstance` check is
   the precedent.

2. It STARTS WITH `YYYY-MM-DD[ T]HH:MM`. A PREFIX, deliberately: `re.match` with
   no `$`, so seconds and a trailing newline ride along, because the TS twin's
   `String.match(/^.../)` does the same and `services/tz_clock.py`'s `gmt_epoch`
   is the shipped precedent. **`re.fullmatch` here would BREAK parity by
   design** -- see the header of `backend/tests/test_tide_epoch_parity.py`, and
   do not "fix" it. Explicit ASCII `[0-9]` rather than `\\d` because Python's
   `\\d` matches every Unicode decimal digit and `int()` parses it happily where
   JavaScript's is ASCII-only (v0.5.54); the class is identical on both sides
   and the shared fixture carries a non-ASCII-digit row, a leading-, a trailing-
   and an embedded-newline row (v0.5.87).

3. It names a REAL calendar moment. `datetime(...)` raises on month 13, day 45,
   day 0, hour 25, minute 61, Feb 30 and April 31; the TS twin's `Date` silently
   ROLLS every one of them into a different real instant, which is why three
   rows of `tideEpoch.fixture.json` were pinned as permanent twin divergences
   and are converged by this build. The two halves refuse the same set by two
   different mechanisms -- a raise here, a component round trip there -- and the
   fixture carries a row for each.

4. Its year is at least 1 and at most 9999, which `datetime` enforces by
   raising. The TS twin needs an explicit MIN_YEAR for the floor (year 0 is a
   perfectly good proleptic year for `Date`) and needs no constant for the
   ceiling, because `[0-9]{4}` cannot express a year above 9999.

LINEARITY (.claude/rules/security.md, v1.0.21 / v1.0.23)
--------------------------------------------------------
Declared rather than left to be discovered, though this build ends with FEWER
scans over provider text than it started with: `_LST_RE` here and `_GMT_RE` in
`tz_clock.py` were two byte-identical patterns and are now one, and `_clock`'s
UNANCHORED `re.search(r"[ T](\\d{2}):(\\d{2})")` -- which read `3:07pm` off
`2026/05/01 15:07` and `1:61pm` off `2026-13-40 25:61`, and whose `\\d` was the
open half of F2 from `pipeline/tide-timezone-parse` that build 4 handed on by
name -- is deleted outright, because a clock is now formatted from the placed
components instead of re-scanned. STRUCTURAL: anchored, exact-count quantifiers
only, no alternation, no nesting, nothing lazy -- so backtracking states are
bounded and a hostile provider string matches or fails inside the first 16
characters. `datetime` construction is arithmetic, not a scan. ENFORCEMENT
POINT: the only producer of `t` is NOAA over HTTPS on both transports
(`services/noaa.py`, `lib/tauri/tideService.ts`'s `getJson`); nothing
user-supplied and nothing replayed reaches this field.
"""

import re
from dataclasses import dataclass
from datetime import datetime, timezone

_LST_RE = re.compile(r"^([0-9]{4})-([0-9]{2})-([0-9]{2})[ T]([0-9]{2}):([0-9]{2})")


@dataclass(frozen=True)
class TideInstant:
    """A NOAA `t` that names a real instant: where it falls on the epoch axis,
    and the wall-clock the block renders. `hour`/`minute` are carried rather
    than re-derived so the copy block's clock can never disagree with the
    instant the level was computed from."""

    epoch_sec: int
    hour: int
    minute: int


def place_instant(t) -> TideInstant | None:
    """The instant a NOAA `t` names, or None when it names none.

    NEVER raises and never returns a sentinel. Takes an untyped value because it
    arrives from `json.loads` over a provider response, exactly as
    `parse_wall_clock` takes an unvalidated query parameter.
    """
    if not isinstance(t, str):
        return None
    m = _LST_RE.match(t)
    if not m:
        return None
    y, mo, d, h, mi = (int(x) for x in m.groups())
    try:
        # `tzinfo=timezone.utc` is load-bearing. A naive `datetime(...)`
        # resolves in the SERVER PROCESS's zone, so the same string read
        # differently on two machines and the checklist tide rendered
        # `Water level: 1.0 - 5.0 ft` where the correct figure is
        # `1.5 - 4.5 ft` (v1.0.32).
        moment = datetime(y, mo, d, h, mi, tzinfo=timezone.utc)
    except ValueError:
        return None
    return TideInstant(int(moment.timestamp()), h, mi)


def place_epoch_min(t) -> float | None:
    """Epoch-MINUTES for a NOAA `lst_ldt` string, or None. The unit the
    single-moment builders interpolate in. Twin of `placeEpochMin`.

    Read on a fixed UTC axis and NOT calendar-correct for the station's own
    zone: the string is the STATION's local clock and is read here as though it
    were UTC, so a wall-clock 01:00 -> 03:00 span at a station crossing its own
    DST transition measures 120 minutes where 180 actually elapsed. That is the
    contract rather than an oversight -- every consumer takes only DIFFERENCES
    between two of these values, and reading every string on one fixed axis is
    what makes a difference equal the CALENDAR difference of the two wall clocks
    on every machine. Re-parsing in the station's real zone is a separate,
    deliberately deferred decision: pipeline/tide-timezone-parse/decisions.md
    carries the evidence, the reversal condition and the exact change.
    """
    at = place_instant(t)
    return None if at is None else at.epoch_sec / 60.0


def place_epoch_sec(t) -> int | None:
    """Epoch-SECONDS for a NOAA `time_zone=gmt` string, or None. The unit the
    Planner's curve and turning points are built in. Twin of `placeEpochSec`."""
    at = place_instant(t)
    return None if at is None else at.epoch_sec


def clock_text(at: TideInstant) -> str:
    """A placed instant as the block's clock: `'3:07pm'`. Matches the weather
    block's time style. Takes the INSTANT, never the string, so a clock can only
    ever be rendered for a moment that was actually placed."""
    ap = "pm" if at.hour >= 12 else "am"
    h = at.hour % 12 or 12
    return f"{h}:{at.minute:02d}{ap}"

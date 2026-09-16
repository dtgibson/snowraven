"""GUARD + SHARED-FIXTURE PARITY TEST for `place_epoch_min` in
services/tide_instant.py.

Two claims, and the first one is the defect this file was written for:

1. It reads the same string to the same value in EVERY process zone. It did
   not: a naive `datetime(...).timestamp()` resolves in whatever zone the server
   runs in, so the checklist tide reported `1.0 - 5.0 ft` on a US/Pacific box
   where the correct figure is `1.5 - 4.5 ft`. Every row below was watched
   FAILING against that implementation before the fix landed.

2. It agrees with its TS twin `placeEpochMin` (frontend/src/lib/tideInstant.ts)
   on every string -- on which ones PLACE and on which are REFUSED -- through
   the shared frontend/src/lib/tideEpoch.fixture.json that
   tideEpoch.parity.test.ts also drives. The expected column was produced by the
   shipped TS twin, so this side reproducing it IS the cross-check.

The subject moved from `_epoch_min` in services/tide.py to `place_epoch_min` in
services/tide_instant.py, and the expected column is now `float | None` rather
than `float`. That is one change: the `0.0` a string it could not read used to
return WAS the defect, because 1970 is 56 years from any tide window, so an
unreadable `t` did not drop out of the series -- it moved to 1970, collapsed the
interpolation fraction to ~0.99999, and turned the reading into the other
bracket's level, identically on both runtimes and in the block a user pastes
into a permanent public eBird checklist comment.

The zone sweep uses `time.tzset`, which is POSIX-only; the backend runs on
macOS, Linux and the Pi, and backend CI is `ubuntu-latest`. It is asserted
present rather than skipped around -- a guard that silently skips is worse than
no guard at all (.claude/rules/testing.md).

Two deliberate carve-outs, stated here so neither is "fixed" by a later reader:

* It matches a PREFIX (`re.match`, no `$`), so seconds and a trailing newline
  ride along. That is not the anchor half of the v0.5.87 twinned-guard rule
  going unapplied -- it is the contract, because the TS twin's
  `String.match(/^.../)` does exactly the same, and `services/tz_clock.py`'s
  `gmt_epoch` was the shipped precedent (and now delegates here). `re.fullmatch`
  would BREAK parity.
* There is no linearity timing row. The pattern is anchored with fixed-width
  quantifiers and no alternation, so a hostile string fails within the first 16
  characters and a timing fixture could not be made to fail against a revert --
  and a timing assertion that cannot reject the defect it names is worse than
  none (.claude/rules/security.md). The structural row below is what guards the
  shape, and it cannot flake.
"""

import json
import os
import time
from contextlib import contextmanager
from pathlib import Path

import pytest

from services.tide import compute_tide_reading
from services.tide_instant import _LST_RE, place_epoch_min

FIXTURE_PATH = (
    Path(__file__).resolve().parents[2]
    / "frontend" / "src" / "lib" / "tideEpoch.fixture.json"
)
_FIXTURE = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
ROWS = _FIXTURE["rows"]
CONVERGED = _FIXTURE["converged"]

# Zones whose clocks disagree with UTC in different ways: two northern DST
# zones (one of which transitions on the fixture's own date), a southern one,
# a half-hour zone with no DST, and a half-hour DST zone.
ZONES = [
    "UTC",
    "America/Los_Angeles",
    "America/New_York",
    "Europe/Dublin",
    "Pacific/Auckland",
    "Asia/Kolkata",
    "Australia/Lord_Howe",
]

# What the PYTHON twin returned for the three converged strings BEFORE this
# build. Literals rather than fixture values: the fixture's expected column is
# the post-convergence answer by construction, and this table is the other half
# of the claim that anything moved at all. The TS half carries its own.
#
# Note which column moved on which side, because it is not the same column:
# this side already REFUSED all three impossible calendars (it returned the
# `0.0` sentinel, which is what has changed to None), and the TS side is where
# `Date.UTC` rolled them into real instants. For year 1 the roles invert -- this
# side was already right and the TS twin's legacy two-digit-year mapping was
# what moved.
PY_BEFORE = {
    "2026-13-40 25:61": 0.0,            # the sentinel, now None
    "2026-02-30 12:00": 0.0,            # the sentinel, now None
    "0001-01-01 00:00": -1035593280.0,  # year 1, unchanged -- the TS twin came to meet it
}


@contextmanager
def process_zone(tz: str):
    """Run the block with the PROCESS in zone `tz`, restoring it afterwards."""
    before = os.environ.get("TZ")
    os.environ["TZ"] = tz
    time.tzset()
    try:
        yield
    finally:
        if before is None:
            os.environ.pop("TZ", None)
        else:
            os.environ["TZ"] = before
        time.tzset()


def _label(row):
    t = row["t"]
    if isinstance(t, str):
        return t.replace("\n", "\\n") or "(empty)"
    return f"({t})"


def test_tzset_is_available_so_the_zone_sweep_below_is_not_vacuous():
    # The sweep is the whole point of this file; if `tzset` were missing it
    # would pass without changing zones at all. Fail loudly instead.
    assert hasattr(time, "tzset"), "time.tzset is required to drive the zone sweep"
    with process_zone("America/Los_Angeles"):
        # Prove the process zone actually MOVED, through a naive conversion of
        # the kind `_epoch_min` used to perform. This is the control leg: if it
        # ever reads 0, the sweep below is measuring one zone seven times.
        from datetime import datetime
        assert datetime(1970, 1, 1, 0, 0).timestamp() == 28800.0


@pytest.mark.parametrize("tz", ZONES)
@pytest.mark.parametrize("row", ROWS, ids=_label)
def test_every_row_is_the_same_value_in_every_process_zone(row, tz):
    with process_zone(tz):
        assert place_epoch_min(row["t"]) == row["epochMin"]


@pytest.mark.parametrize("tz", ZONES)
def test_the_fall_back_span_is_two_calendar_hours_in_every_process_zone(tz):
    # The reproduction from the bug brief. On a US/Pacific server the shipped
    # helper measured 180 minutes here, because the SERVER's own clock falls
    # back between the two strings.
    with process_zone(tz):
        span = place_epoch_min("2026-11-01 03:00") - place_epoch_min("2026-11-01 01:00")
        assert span == 120.0


@pytest.mark.parametrize("tz", ZONES)
def test_the_shipped_water_level_figure_is_right_in_every_process_zone(tz):
    # The user-facing half: `format_tide_body` renders these two numbers as
    # "Water level: 1.5 - 4.5 ft". A US/Pacific server rendered "1.0 - 5.0 ft".
    hilo = [
        {"t": "2026-11-01 01:00", "v": 0.0, "type": "L"},
        {"t": "2026-11-01 03:00", "v": 6.0, "type": "H"},
    ]
    with process_zone(tz):
        reading = compute_tide_reading(
            "2026-11-01 01:30", "2026-11-01 02:30", [], [], hilo,
            {"id": "X", "name": "X"}, 1.0,
        )
    assert reading is not None
    assert round(reading.level_min, 2) == 1.5
    assert round(reading.level_max, 2) == 4.5


@pytest.mark.parametrize("row", CONVERGED, ids=lambda r: r["t"])
def test_the_rows_that_used_to_diverge_from_the_ts_twin_now_agree(row):
    # THESE THREE WERE PINNED DIVERGENCES, and they are kept as rows for the
    # same reason they were pinned: a row that separates -- or used to separate
    # -- the twins is what makes their agreement elsewhere a measurement instead
    # of an assumption, and that is as true after the convergence as before it.
    # The pin said "a change to EITHER side turns a row red and sends the next
    # reader to pipeline/tide-timezone-parse/decisions.md"; converging the twins
    # IS that change, and it was the scope fence between the previous build and
    # this one. See pipeline/tide-unreadable-timestamp/decisions.md.
    assert place_epoch_min(row["t"]) == row["epochMin"]


def test_the_convergence_actually_moved_a_side():
    # Guard the guard. The row above compares this twin against a fixture column
    # generated by the OTHER twin, so it proves agreement and says nothing about
    # whether anything changed. Two of the three moved on this side (the `0.0`
    # sentinel became None) and the third moved on the TS side alone, so the
    # claim is that EVERY converged row differs from at least one of the two
    # "before" values -- and one of them is this side's own.
    assert set(PY_BEFORE) == {r["t"] for r in CONVERGED}
    moved_here = 0
    for row in CONVERGED:
        now = place_epoch_min(row["t"])
        assert now == row["epochMin"]
        if now != PY_BEFORE[row["t"]]:
            moved_here += 1
    # The two impossible calendars moved here; year 1 did not, because this side
    # was already right and the TS twin came to meet it.
    assert moved_here == 2, "this side's before-table no longer describes what changed"
    assert place_epoch_min("0001-01-01 00:00") == PY_BEFORE["0001-01-01 00:00"]


def test_an_impossible_calendar_value_returns_rather_than_raising():
    # The shipped helper let ValueError out of `compute_tide_reading`, which
    # sits OUTSIDE the routes' `try`, so a malformed NOAA body was a plain-text
    # 500. These are the same shapes, asserted as returns -- now None rather
    # than the 1970 sentinel that made the returned value indistinguishable from
    # a real instant.
    for bad in ("2026-13-40 25:61", "2026-02-30 12:00", "2026-00-00 00:00"):
        assert place_epoch_min(bad) is None


def test_an_unplaceable_string_is_distinguishable_from_the_epoch():
    # The whole defect in one row. `_epoch_min` returned 0.0 for BOTH, so every
    # consumer read an unreadable timestamp as 1970 -- 56 years from any tide
    # window, which collapsed the interpolation fraction to ~0.99999 and turned
    # the reading into the other bracket's level. This is also why the placement
    # test may not be spelled `== 0` or `> 0`.
    assert place_epoch_min("1970-01-01 00:00") == 0.0
    assert place_epoch_min("not a date") is None
    assert place_epoch_min("1900-01-01 00:00") < 0


def test_a_non_string_t_is_unplaceable_rather_than_coerced():
    # The divergence that never reached the sentinel: `str(None)` was `"None"`,
    # which sorts AFTER every real timestamp, where `String(null)` was `""`,
    # which sorts before -- so the two runtimes bracketed the same window with
    # different points.
    for bad in (None, True, [], {}, 1777000000):
        assert place_epoch_min(bad) is None, bad


def test_the_pattern_is_explicit_ascii_anchored_and_fixed_width():
    # Structural, so it cannot flake, and it guards the two properties a future
    # edit is most likely to cost: `\d` would silently readmit Unicode decimal
    # digits on this side only (v0.5.54), and an unbounded quantifier would
    # give a hostile provider string something to chew on.
    pattern = _LST_RE.pattern
    assert "\\d" not in pattern, "explicit [0-9] classes, never \\d: the TS twin's \\d is ASCII-only"
    assert pattern.startswith("^"), "anchored at the start, like the TS twin"
    assert "+" not in pattern and "*" not in pattern, "fixed-width quantifiers only"
    # And the behavioural half of the same claim, in both directions.
    assert place_epoch_min("٢٠٢٦-09-12 22:41") is None
    assert place_epoch_min("2026-09-12 22:41") is not None
    assert place_epoch_min("\n2026-09-12 22:41") is None
    # A PREFIX match, deliberately: `fullmatch` here would break parity by
    # design, so seconds and a trailing newline must ride along.
    assert place_epoch_min("2026-09-12 22:41:30") == place_epoch_min("2026-09-12 22:41")
    assert place_epoch_min("2026-09-12 22:41\n") == place_epoch_min("2026-09-12 22:41")

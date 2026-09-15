"""GUARD + SHARED-FIXTURE PARITY TEST for `_epoch_min` in services/tide.py.

Two claims, and the first one is the defect this file was written for:

1. `_epoch_min` reads the same string to the same value in EVERY process zone.
   It did not: a naive `datetime(...).timestamp()` resolves in whatever zone the
   server runs in, so the checklist tide reported `1.0 - 5.0 ft` on a US/Pacific
   box where the correct figure is `1.5 - 4.5 ft`. Every row below was watched
   FAILING against that implementation before the fix landed.

2. It agrees with its TS twin `epochMin` (frontend/src/lib/tide.ts) on every
   string, through the shared frontend/src/lib/tideEpoch.fixture.json that
   tideEpoch.parity.test.ts also drives. The expected column was produced by the
   shipped TS twin, so this side reproducing it IS the cross-check.

The zone sweep uses `time.tzset`, which is POSIX-only; the backend runs on
macOS, Linux and the Pi, and backend CI is `ubuntu-latest`. It is asserted
present rather than skipped around -- a guard that silently skips is worse than
no guard at all (.claude/rules/testing.md).

Two deliberate carve-outs, stated here so neither is "fixed" by a later reader:

* `_epoch_min` matches a PREFIX (`re.match`, no `$`), so seconds and a trailing
  newline ride along. That is not the anchor half of the v0.5.87 twinned-guard
  rule going unapplied -- it is the contract, because the TS twin's
  `String.match(/^.../)` does exactly the same, and `services/tz_clock.py`'s
  `gmt_epoch` is the shipped precedent. `re.fullmatch` here would BREAK parity.
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

from services.tide import _LST_RE, _epoch_min, compute_tide_reading

FIXTURE_PATH = (
    Path(__file__).resolve().parents[2]
    / "frontend" / "src" / "lib" / "tideEpoch.fixture.json"
)
_FIXTURE = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
ROWS = _FIXTURE["rows"]
DIVERGENT = _FIXTURE["divergent"]

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

# What the PYTHON twin returns for the strings the two transports read
# differently. Stated as literals here rather than carried in the shared
# fixture: the fixture's expected column is the TS twin's answer by
# construction, and this table is the other half of the divergence.
PY_DIVERGENT = {
    "2026-13-40 25:61": 0.0,       # month 13 refused, where Date.UTC rolls over
    "2026-02-30 12:00": 0.0,       # February 30 refused, where Date.UTC rolls to March 2
    "0001-01-01 00:00": -1035593280.0,  # year 1, where Date.UTC's legacy mapping lands in 1901
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
@pytest.mark.parametrize("row", ROWS, ids=lambda r: (r["t"].replace("\n", "\\n") or "(empty)"))
def test_every_row_is_the_same_value_in_every_process_zone(row, tz):
    with process_zone(tz):
        assert _epoch_min(row["t"]) == row["epochMin"]


@pytest.mark.parametrize("tz", ZONES)
def test_the_fall_back_span_is_two_calendar_hours_in_every_process_zone(tz):
    # The reproduction from the bug brief. On a US/Pacific server the shipped
    # helper measured 180 minutes here, because the SERVER's own clock falls
    # back between the two strings.
    with process_zone(tz):
        span = _epoch_min("2026-11-01 03:00") - _epoch_min("2026-11-01 01:00")
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


@pytest.mark.parametrize("row", DIVERGENT, ids=lambda r: r["t"])
def test_the_pinned_divergences_from_the_ts_twin_still_hold(row):
    # These three are pinned rather than dropped from the fixture: the twins
    # genuinely disagree on them (see the file header of the TS half), and a
    # row that SEPARATES the twins is what makes their agreement elsewhere a
    # measurement instead of an assumption. If one of these goes red, the twins
    # have converged or drifted -- read pipeline/tide-timezone-parse/decisions.md
    # before changing the expectation.
    assert _epoch_min(row["t"]) == PY_DIVERGENT[row["t"]]
    assert _epoch_min(row["t"]) != row["epochMin"]


def test_an_impossible_calendar_value_returns_rather_than_raising():
    # The shipped helper let ValueError out of `compute_tide_reading`, which
    # sits OUTSIDE the routes' `try`, so a malformed NOAA body was a plain-text
    # 500. These are the same shapes, asserted as returns.
    for bad in ("2026-13-40 25:61", "2026-02-30 12:00", "2026-00-00 00:00"):
        assert _epoch_min(bad) == 0.0


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
    assert _epoch_min("٢٠٢٦-09-12 22:41") == 0.0
    assert _epoch_min("2026-09-12 22:41") != 0.0

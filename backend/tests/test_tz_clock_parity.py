"""SHARED-FIXTURE PARITY TEST -- the Python half of the planner's timezone
helper pair (tide-weather-planner, schema section 5).

`services.tz_clock` and `frontend/src/lib/tzClock.ts` must place every instant
on the same local clock, hour start and day boundary, including both DST
transitions, the fall-back hour's second pass and a half-hour zone. Both halves
load frontend/src/lib/tzClock.fixture.json and assert every row; the expected
values were produced by the TS twin, so this side reproducing them through
zoneinfo IS the cross-check (ICU versus tzdata).

Also the linearity guard for `gmt_epoch`, the one new scan over provider text
this feature adds (schema section 9): a hostile near-miss string that FAILS
after consuming a long run must cost about the same per character as a short
one, measured as a same-run quotient (never a wall-clock ceiling).
"""

import json
import time
from pathlib import Path
from zoneinfo import ZoneInfo

import pytest

from services.tz_clock import (
    add_days, gmt_epoch, local_clock, local_date, local_midnight_ts,
    start_of_local_hour, utc_offset_sec,
)

FIXTURE_PATH = (
    Path(__file__).resolve().parents[2]
    / "frontend" / "src" / "lib" / "tzClock.fixture.json"
)
ROWS = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))["rows"]


def test_fixture_covers_the_discriminating_zones_and_both_transitions():
    zones = {r["tz"] for r in ROWS}
    assert {"UTC", "America/Los_Angeles", "America/New_York", "America/Anchorage",
            "Pacific/Honolulu", "Asia/Kolkata"} <= zones
    lengths = {r["dayLengthSec"] for r in ROWS}
    assert {82800, 86400, 90000} <= lengths
    # The fall-back hour's second pass: two rows in one zone with the same
    # local clock and different instants.
    la = [r for r in ROWS if r["tz"] == "America/Los_Angeles"]
    clocks = [r["localClock"] for r in la]
    assert len(clocks) != len(set(clocks))
    assert len(ROWS) >= 50


@pytest.mark.parametrize("row", ROWS, ids=lambda r: f"{r['tz']}@{r['ts']}")
def test_every_row_agrees_with_the_ts_twin(row):
    tz = ZoneInfo(row["tz"])
    ts = row["ts"]
    assert local_clock(ts, tz) == row["localClock"]
    assert utc_offset_sec(ts, tz) == row["utcOffsetSec"]
    assert start_of_local_hour(ts, tz) == row["startOfLocalHour"]
    date = local_date(ts, tz)
    assert local_midnight_ts(date, tz) == row["localMidnightTs"]
    assert local_midnight_ts(add_days(date, 1), tz) - local_midnight_ts(date, tz) == row["dayLengthSec"]


def test_gmt_epoch_parses_gmt_strings_and_drops_everything_else():
    assert gmt_epoch("2026-09-12 22:41") == 1789252860
    assert gmt_epoch("2026-09-12T22:41") == 1789252860
    # A prefix match, like the TS twin's `epochMin`: seconds and a trailing
    # newline ride along, a leading newline or an embedded one does not.
    assert gmt_epoch("2026-09-12 22:41:30") == 1789252860
    assert gmt_epoch("2026-09-12 22:41\n") == 1789252860
    assert gmt_epoch("\n2026-09-12 22:41") == 0
    assert gmt_epoch("2026-09\n-12 22:41") == 0
    assert gmt_epoch("") == 0
    assert gmt_epoch("not a date") == 0
    # Explicit ASCII digits: a Unicode digit is not a match here, as in JS.
    assert gmt_epoch("٢٠٢٦-09-12 22:41") == 0
    # An impossible calendar value yields 0 rather than a throw.
    assert gmt_epoch("2026-13-40 25:61") == 0


def test_gmt_epoch_is_linear_on_a_hostile_near_miss():
    # The pattern must FAIL after consuming the run: digits that stop one
    # character short of a full year, so the anchored match cannot succeed at
    # position 0 and there is nothing to backtrack into.
    def cost(n: int) -> float:
        s = ("9" * n) + "-"
        best = float("inf")
        for _ in range(5):
            t0 = time.perf_counter()
            for _ in range(50):
                assert gmt_epoch(s) == 0
            best = min(best, time.perf_counter() - t0)
        return best

    small = cost(20_000)
    large = cost(40_000)
    # Doubling the input costs at most ~2x (with slack for scheduling noise);
    # a quadratic pattern would read ~4x. Same-run quotient, machine cancels.
    assert large / max(small, 1e-9) < 3.2

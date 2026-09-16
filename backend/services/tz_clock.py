"""The location's clock, computed once, by the composer (tide-weather-planner,
schema section 5). Twin of frontend/src/lib/tzClock.ts; both halves are driven
from the same fixture (frontend/src/lib/tzClock.fixture.json) so a DST edge or a
half-hour zone cannot be placed differently on the two transports.

Every `ts` is an integer epoch SECOND and every arithmetic result is an
integer; the wall-clock string is display-only and is never compared, sorted
or bracketed by. Pure: no clock is read here, `ts` is always an argument.

`gmt_epoch` places a NOAA `t` string requested in `time_zone=gmt` on the epoch
axis. It is now a thin unit conversion over the shared `place_instant` in
services/tide_instant.py rather than a second regex of its own.

THAT CONSOLIDATION CORRECTS A CLAIM THIS DOCSTRING CARRIED. It used to say
`gmt_epoch` was "deliberately not the shipped `_epoch_min` in services/tide.py,
whose naive `datetime.timestamp()` reads the PROCESS zone" -- true when written
and false since v1.0.32, which gave `_epoch_min` the explicit `tzinfo=utc` for
exactly that reason. From that point the two were the same UTC calendar
arithmetic behind two byte-identical patterns, differing only in their unit
(seconds here, minutes there) and in what they returned for a string they could
not read. Keeping them apart bought nothing and cost a divergence: `_epoch_min`
was fixed to refuse impossible calendar values where its TS twin rolled them
over, and the Planner pair inherited that same split. One predicate, two unit
conversions.
"""

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from services.tide_instant import place_epoch_sec


def utc_offset_sec(ts: int, tz: ZoneInfo) -> int:
    """The zone's UTC offset in seconds at instant `ts` (east positive)."""
    return int(datetime.fromtimestamp(ts, tz).utcoffset().total_seconds())


def local_clock(ts: int, tz: ZoneInfo) -> str:
    """'YYYY-MM-DD HH:MM' in the zone. Display only."""
    return datetime.fromtimestamp(ts, tz).strftime("%Y-%m-%d %H:%M")


def local_date(ts: int, tz: ZoneInfo) -> str:
    """'YYYY-MM-DD' in the zone: the first ten characters of `local_clock`."""
    return local_clock(ts, tz)[:10]


def start_of_local_hour(ts: int, tz: ZoneInfo) -> int:
    """The instant the zone's current hour began, on the LOCATION's clock."""
    off = utc_offset_sec(ts, tz)
    return ts - (((ts + off) % 3600) + 3600) % 3600


def add_days(date: str, days: int) -> str:
    """'YYYY-MM-DD' plus `days` calendar days, pure calendar arithmetic."""
    y, m, d = (int(x) for x in date.split("-"))
    return (datetime(y, m, d) + timedelta(days=days)).strftime("%Y-%m-%d")


def local_midnight_ts(date: str, tz: ZoneInfo) -> int:
    """The instant local midnight begins on `date` in the zone.

    zoneinfo's fold=0 semantics: an ambiguous midnight resolves to its FIRST
    occurrence and a non-existent one to the first existing instant after the
    gap. The TS twin reproduces exactly this, so both composers place day
    boundaries identically."""
    y, m, d = (int(x) for x in date.split("-"))
    return int(datetime(y, m, d, tzinfo=tz).timestamp())


def gmt_epoch(t: str) -> int | None:
    """A NOAA 'YYYY-MM-DD HH:MM' string requested in `time_zone=gmt`, as an
    integer epoch second; None for a string that names no instant (the caller
    drops it).

    NONE RATHER THAN 0, because the caller's test was `if t > 0` and that is not
    the predicate it meant. `1970-01-01 00:00` is a placeable instant whose
    epoch IS the sentinel, and a pre-1970 instant is placeable and negative, so
    the shipped Planner silently dropped both. The predicate is "placeable", not
    "positive". Linearity, the character-class rule and the calendar round trip
    all live at `place_instant`, which this delegates to.
    """
    return place_epoch_sec(t)

"""The location's clock, computed once, by the composer (tide-weather-planner,
schema section 5). Twin of frontend/src/lib/tzClock.ts; both halves are driven
from the same fixture (frontend/src/lib/tzClock.fixture.json) so a DST edge or a
half-hour zone cannot be placed differently on the two transports.

Every `ts` is an integer epoch SECOND and every arithmetic result is an
integer; the wall-clock string is display-only and is never compared, sorted
or bracketed by. Pure: no clock is read here, `ts` is always an argument.

`gmt_epoch` is the one NEW scan over provider text this feature adds (schema
section 9): one anchored, fixed-width regex over a NOAA `t` string requested in
`time_zone=gmt`, parsed with an explicit UTC tzinfo. It is deliberately not the
shipped `_epoch_min` in services/tide.py, whose naive `datetime.timestamp()`
reads the PROCESS zone and is right for the single-moment routes that compare
station-local strings; the plan's bodies are GMT and land on the epoch axis.
"""

import re
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

# Explicit ASCII classes, never `\d`: Python's `\d` matches every Unicode decimal
# digit and `int()` would happily parse one, while the TS twin's `\d` is ASCII-only
# (the v0.5.54 character-class rule for twinned guards).
_GMT_RE = re.compile(r"^([0-9]{4})-([0-9]{2})-([0-9]{2})[ T]([0-9]{2}):([0-9]{2})")


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


def gmt_epoch(t: str) -> int:
    """A NOAA 'YYYY-MM-DD HH:MM' string requested in `time_zone=gmt`, as an
    integer epoch second; 0 for a string that does not match (the caller drops
    it). Linear: one anchored regex with fixed-width quantifiers, no
    alternation, no lazy quantifier, so a hostile body's longer strings match
    or fail within the first 16 characters."""
    m = _GMT_RE.match(t)
    if not m:
        return 0
    y, mo, d, h, mi = (int(x) for x in m.groups())
    try:
        return int(datetime(y, mo, d, h, mi, tzinfo=timezone.utc).timestamp())
    except ValueError:
        return 0

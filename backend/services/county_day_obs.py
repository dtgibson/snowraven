"""The per-day county observations reducer and the route's date validator
(targets-tab, schema.md sections 4.1 and 4.3).

TWIN of ``frontend/src/lib/countyDayObsReduce.ts`` (``reduceCountyDayObs``,
``isValidDayObsDate``). The shared fixture
``frontend/src/lib/countyDayObs.fixture.json`` is generated from the TypeScript
builders and every row is asserted here by ``backend/tests/test_county_day_obs.py``,
so the two agree on what a MALFORMED record or parameter is, not only on what a
conforming one produces (security.md, v1.0.29).

Twinned-guard rules, each load-bearing:
  * explicit ``[0-9]`` classes, never ``\\d`` (Python's ``\\d`` matches Unicode
    digits, the v0.5.54 rule);
  * ``re.fullmatch`` for every hand-called guard, never ``re.match``: Python's
    ``$`` matches before a trailing newline and JavaScript's does not (v0.5.87).
    The route's own ``Query(pattern=)`` constraints are the pydantic carve-out and
    stay as they are;
  * a coordinate is judged by the house predicate ``is_finite_figure``
    (``formatters/weather.py``), never ``math.isfinite``: that converts to a
    float and RAISES ``OverflowError`` on an integer literal past the float
    range, which escaped the route's ``except`` as a plain-text 500 on web/Pi
    while the desktop twin's ``JSON.parse`` read the same literal as
    ``Infinity`` and kept the record with null coordinates (security review
    L1). ``is_finite_figure`` compares without converting, so a huge integer is
    a finite number that then fails the range check, and the record keeps null
    coordinates on both transports. It also excludes ``bool`` explicitly,
    because ``isinstance(True, int)`` is true in Python and the JavaScript twin
    tests ``typeof v === 'number'`` (v1.0.32);
  * string bounds are measured in UTF-16 code units, the unit JavaScript's
    ``.length`` counts, so an astral place name is judged identically on both
    transports.

Linear: one pass over at most ``DAY_OBS_MAX_RECORDS`` records, a dict for the
dedupe, and fixed-width anchored patterns over strings already bounded.
"""

import re
from datetime import date as _date

from fastapi import HTTPException

from formatters.weather import is_finite_figure

DAY_OBS_MAX_RECORDS = 5000
DAY_OBS_MAX_STRING = 512
DAY_OBS_MIN_YEAR = 1900
DAY_OBS_MAX_YEAR = 2100

_DATE_RE = re.compile(r"[0-9]{4}-[0-9]{2}-[0-9]{2}")
_OBS_DT_RE = re.compile(r"[0-9]{4}-[0-9]{2}-[0-9]{2}( [0-9]{2}:[0-9]{2})?")
_LOC_ID_RE = re.compile(r"L[0-9]{1,15}")
# The single-sourced species-code shape (lib/speciesCode.ts SPECIES_CODE_RE).
_SPECIES_CODE_RE = re.compile(r"[a-z0-9-]{2,16}")

_STRING_FIELDS = ("speciesCode", "obsDt", "locName")


def _utf16_len(s: str) -> int:
    return len(s.encode("utf-16-le", "surrogatepass")) // 2


def _bounded_string(v) -> bool:
    return isinstance(v, str) and _utf16_len(v) <= DAY_OBS_MAX_STRING


def is_valid_day_obs_date(value) -> bool:
    """The route's ``date`` parameter: the anchored pattern, a REAL calendar day,
    a year in [1900, 2100]. Twin of ``isValidDayObsDate``."""
    if not isinstance(value, str) or _DATE_RE.fullmatch(value) is None:
        return False
    try:
        parsed = _date.fromisoformat(value)
    except ValueError:
        return False
    return DAY_OBS_MIN_YEAR <= parsed.year <= DAY_OBS_MAX_YEAR


def reduce_county_day_obs(body, region_code: str, date: str) -> dict:
    """Reduce one eBird ``data/obs/{region}/historic/{y}/{m}/{d}`` body to one
    record per species, the most recent report that day. A body that is not a
    list is a 502 (raised inside the route's try, so it is never mistaken for a
    connection failure)."""
    if not isinstance(body, list):
        raise HTTPException(status_code=502, detail="Unexpected eBird response.")
    best: dict[str, dict] = {}
    for obs in body[:DAY_OBS_MAX_RECORDS]:
        if not isinstance(obs, dict):
            continue
        if not all(_bounded_string(obs.get(f)) for f in _STRING_FIELDS):
            continue
        species_code = obs["speciesCode"]
        obs_dt = obs["obsDt"]
        if _SPECIES_CODE_RE.fullmatch(species_code) is None:
            continue
        if _OBS_DT_RE.fullmatch(obs_dt) is None or obs_dt[:10] != date:
            continue
        raw_loc = obs.get("locId")
        if raw_loc is not None and not isinstance(raw_loc, str):
            continue
        if isinstance(raw_loc, str) and _utf16_len(raw_loc) > DAY_OBS_MAX_STRING:
            continue
        loc_id = raw_loc if isinstance(raw_loc, str) and _LOC_ID_RE.fullmatch(raw_loc) else None
        lat = obs.get("lat")
        lng = obs.get("lng")
        coords_ok = (
            is_finite_figure(lat) and is_finite_figure(lng)
            and -90 <= lat <= 90 and -180 <= lng <= 180
        )
        record = {
            "speciesCode": species_code,
            "obsDt": obs_dt,
            "locId": loc_id,
            "locName": obs["locName"],
            "lat": lat if coords_ok else None,
            "lng": lng if coords_ok else None,
        }
        prev = best.get(species_code)
        if prev is None or obs_dt > prev["obsDt"]:
            best[species_code] = record
    return {"regionCode": region_code, "date": date, "species": list(best.values())}

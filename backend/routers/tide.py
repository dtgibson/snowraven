import os
import time
from datetime import datetime

from fastapi import APIRouter, HTTPException, Query

from formatters.tide import format_tide, format_tide_body
from formatters.weather import get_timezone
from services.ebird import CHECKLIST_ID_RE, fetch_checklist
from services.noaa import fetch_tide_range, fetch_tides
from services.plan_tide import build_tide_plan, plan_tide_range, to_noaa_gmt_date
from services.tide import (
    TideReading,
    compute_tide_reading, parse_observed, parse_predictions, parse_hilo,
    normalize_obs_dt, shift_local, to_noaa_date,
)
from services.tide_stations import nearest_station, classify
from services.wall_clock import (
    BAD_DT_DETAIL, TIDE_WINDOW_MARGIN_HOURS,
    is_blank_wall_clock, parse_wall_clock, wall_clock_text,
)

router = APIRouter()

_NO_KEY_DETAIL = "API key not configured. Check your .env file."


def _now() -> int:
    """The fetch moment as an integer epoch second. Module-level so the plan
    tests freeze it; the builder never reads a clock itself."""
    return int(time.time())


# Declared BEFORE /tide/{checklist_id} so "plan" is never captured as a
# checklist id (the same route-order requirement as /tide/at).
@router.get("/tide/plan")
async def get_tide_plan(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    force: bool = False,
):
    """The Weather/tide Planner's tide half: the 30-minute predicted curve and
    the turning points from the start of the current hour through the eighth
    day ahead, at the nearest NOAA station to `lat`/`lng`, requested in GMT so a
    far station and a DST change land on one epoch axis.

    REFUSES WITHOUT AN OPENWEATHER KEY ON PURPOSE (schema D6). NOAA is keyless
    and /tide/at needs no key, but a tide half without the weather spine is not
    a plan, and FR-41 asks that no NOAA request be made when the plan cannot be
    built for want of that key. One guard here holds for every caller with no
    client pre-flight; do not remove it as a tidy-up.

    The span is derived from the fetch moment and the location alone, never
    from a request parameter (FR-49), so the override reproduces it without the
    forecast. The only caller-supplied values that reach a provider URL are the
    two range-bounded coordinates, which select a bundled station id; the dates
    come from this process's clock, so the destination cannot be steered. At
    most two NOAA requests (continuous and high/low), no `water_level`. The
    NOAA bodies are reduced to the plan document; nothing of them is reflected
    back."""
    if not os.getenv("OPENWEATHER_API_KEY"):
        raise HTTPException(status_code=500, detail=_NO_KEY_DETAIL)

    tz = get_timezone(lat, lng)
    now_ts = _now()

    nearest = nearest_station(lat, lng)
    if nearest is None:
        return {"status": "unavailable"}
    station, distance_mi = nearest
    status = classify(lat, lng, nearest)
    if status != "ok" and not force:
        return {"status": status, "station": {"id": station["id"], "name": station["name"]}, "distanceMi": distance_mi}

    span = plan_tide_range(now_ts, tz)
    pred_body, hilo_body = await fetch_tide_range(
        station["id"],
        to_noaa_gmt_date(span["axisStartTs"]), to_noaa_gmt_date(span["tideEndTs"]),
        to_noaa_gmt_date(span["hiloStartTs"]), to_noaa_gmt_date(span["hiloEndTs"]),
    )
    # A JSON-valid but semantically malformed NOAA body (a predictions list
    # holding non-objects) is the same honest state as an unreadable one:
    # `unavailable`, never a plain-text 500. The desktop twin reads the same.
    try:
        return build_tide_plan(pred_body, hilo_body, station, distance_mi, tz, span)
    except Exception:
        return {"status": "unavailable"}


def _serialize_reading(r: TideReading) -> dict:
    """Structured fields the readable at-a-glance summary renders (matches the
    `reading` shape in tide.ts)."""
    def hl(h):
        return None if h is None else {"kind": h.kind, "v": h.v, "timeLocal": h.time_local}
    return {
        "source": r.source,
        "levelMin": r.level_min,
        "levelMax": r.level_max,
        "trend": r.trend,
        "turnedDuring": r.turned_during,
        "prevHL": hl(r.prev_hl),
        "nextHL": hl(r.next_hl),
        "station": {"id": r.station["id"], "name": r.station["name"]},
        "distanceMi": r.distance_mi,
    }


async def _resolve_tide_at(lat: float, lng: float, start: str, end: str, force: bool) -> dict:
    """Nearest-station tide for a coordinate + local window. Shared shape with the
    checklist route, plus a structured `reading`. Raises 502 on a NOAA failure."""
    nearest = nearest_station(lat, lng)
    if nearest is None:
        return {"status": "unavailable"}

    station, distance_mi = nearest
    status = classify(lat, lng, nearest)
    if status != "ok" and not force:
        return {"status": status, "station": {"id": station["id"], "name": station["name"]}, "distanceMi": distance_mi}

    try:
        obs_body, pred_body, hilo_body = await fetch_tides(
            station["id"], to_noaa_date(start), to_noaa_date(end),
            to_noaa_date(shift_local(start, -24)), to_noaa_date(shift_local(end, 24)),
        )
    except Exception:
        raise HTTPException(status_code=502, detail="Tide data unavailable for this location.")

    # The PARSERS are inside the try alongside the builder, not just the builder:
    # they sit in the same argument expression and raise on their own, and four
    # of the measured NOAA shapes (a list holding non-objects, a `predictions`
    # that is a string) never reach compute_tide_reading at all -- so a try
    # around the builder alone would close only part of this. `unavailable` is
    # the honest state an unreadable body already gets, exactly as /tide/plan
    # returns above. This also closes the ZeroDivisionError half of F1 in
    # pipeline/tide-timezone-parse/security-report.md, where two sentinel epochs
    # give interp_level a zero divisor.
    try:
        reading = compute_tide_reading(
            start, end,
            parse_observed(obs_body), parse_predictions(pred_body), parse_hilo(hilo_body),
            station, distance_mi,
        )
    except Exception:
        return {"status": "unavailable"}
    if reading is None:
        return {"status": "unavailable"}

    return {
        "status": "ok",
        "formatted": format_tide(reading),
        "body": format_tide_body(reading),
        "station": {"id": station["id"], "name": station["name"]},
        "distanceMi": distance_mi,
        "reading": _serialize_reading(reading),
    }


# Declared BEFORE /tide/{checklist_id} so "at" isn't captured as a checklist id.
@router.get("/tide/at")
async def get_tide_at(lat: float, lng: float, dt: str | None = None, force: bool = False):
    """Live (Current) or predicted (Predict) tide for an arbitrary location and
    moment. `dt` is the location's local wall-clock; omit it for "now". A 1-hour
    window around the moment gives the trend and bracketing high/low. NOAA is
    keyless — no API key needed.

    A `dt` that is present but is not a readable wall clock is REFUSED with the
    same 400 and the same sentence /weather/at has carried since 0.5.34. Until
    this build there was nothing between the query parameter and
    `normalize_obs_dt`: eight of the 32 measured shapes raised out of
    `shift_local` as a plain-text 500 (month 13, day 45, hour 99, minute 99,
    April 31, Feb 30, all zeroes, the calendar's last minute), one blamed NOAA
    in NOAA's own words for a value that never reached NOAA, and several more
    answered 200 with a confident water level for a moment nobody asked about.
    The desktop twin never raised at all -- `Date` rolls where Python raises --
    so the two transports produced two different wrong answers."""
    # THE GUARD IS THIS HANDLER'S FIRST ACT, and it sits OUTSIDE _resolve_tide_at.
    # Both halves of that sentence are load-bearing:
    #   * OUTSIDE, because a 400 raised inside that function's broad
    #     `except Exception` comes back to the caller as
    #     `200 {"status": "unavailable"}` -- a deliberate error becoming a
    #     SUCCESS status (at-route-try-containment decision 13 measured it).
    #   * FIRST, because no NOAA request may be made for a moment we are about
    #     to refuse -- the CHECKLIST_ID_RE posture (DECISIONS.md:800-810). It
    #     also precedes `get_timezone`, which is where an out-of-range
    #     coordinate still raises (decision 11, open).
    #
    # The margin is 25 hours, the widest shift below: `end` is start + 1h and the
    # high/low window runs to `shift_local(end, 24)`. It is what turns the
    # calendar's extreme minutes from an OverflowError 500 into a stated refusal.
    if is_blank_wall_clock(dt):
        # No dt → "now" in the LOCATION's timezone (not the caller's), so Current
        # is correct regardless of the device/browser timezone. The desktop twin
        # had no such fallback until this build and sent NOAA a single space.
        start = wall_clock_text(datetime.now(get_timezone(lat, lng)))
    else:
        moment = parse_wall_clock(dt, TIDE_WINDOW_MARGIN_HOURS)
        if moment is None:
            raise HTTPException(status_code=400, detail=BAD_DT_DETAIL)
        start = wall_clock_text(moment)
    end = shift_local(start, 1)
    return await _resolve_tide_at(lat, lng, start, end, force)


@router.get("/tide/{checklist_id}")
async def get_tide(checklist_id: str, force: bool = False):
    # Single-sourced on services.ebird (which this router already imports); it was
    # a byte-identical copy of the tide/weather sibling's regex until v0.5.88.
    # Explicit ASCII `[0-9]`, never `\d`: Python's `\d` matches every Unicode
    # decimal digit, so an id written in Arabic-Indic digits passed here while the
    # JS guard on the request path rejected it (v0.5.54 character-class rule).
    if not CHECKLIST_ID_RE.fullmatch(checklist_id):
        raise HTTPException(status_code=400, detail="That doesn't look like a valid eBird checklist ID.")

    # NOAA is keyless — only eBird is needed to resolve the checklist.
    if not os.getenv("EBIRD_API_KEY"):
        raise HTTPException(status_code=500, detail="API key not configured. Check your .env file.")

    try:
        checklist = await fetch_checklist(checklist_id)
    except LookupError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception:
        raise HTTPException(status_code=502, detail="Could not fetch checklist data. Please try again.")

    base = {
        "checklist_id": checklist_id,
        "loc_name": checklist["loc_name"],
        "obs_dt": checklist["obs_dt"],
    }

    # Genuinely nearest station; prediction-only stations are fine (shown as
    # Predicted). Biasing toward gauge stations would skip a much closer one.
    nearest = nearest_station(checklist["lat"], checklist["lng"])
    if nearest is None:
        return {**base, "status": "unavailable"}

    station, distance_mi = nearest
    status = classify(checklist["lat"], checklist["lng"], nearest)
    if status != "ok" and not force:
        return {**base, "status": status, "station": {"id": station["id"], "name": station["name"]}, "distanceMi": distance_mi}

    # The tide twin of the unreadable-date containment in routers/weather.py: the
    # same two unvalidated eBird fields reach normalize_obs_dt (which raises on a
    # non-string) and shift_local (which raises on an impossible calendar value).
    # The honest state here is this route's OWN soft state rather than a 502 --
    # the same asymmetry the provider-body paths carry, because each route keeps
    # the honest state it already has.
    try:
        start = normalize_obs_dt(checklist["obs_dt"])
        end = shift_local(start, checklist["duration_hrs"] or 1)
    except Exception:
        return {**base, "status": "unavailable"}

    try:
        obs_body, pred_body, hilo_body = await fetch_tides(
            station["id"], to_noaa_date(start), to_noaa_date(end),
            to_noaa_date(shift_local(start, -24)), to_noaa_date(shift_local(end, 24)),
        )
    except Exception:
        raise HTTPException(status_code=502, detail="Tide data unavailable for this checklist's time and location.")

    # Parsers inside the try alongside the builder, for the same reason as
    # _resolve_tide_at above.
    try:
        reading = compute_tide_reading(
            start, end,
            parse_observed(obs_body), parse_predictions(pred_body), parse_hilo(hilo_body),
            station, distance_mi,
        )
    except Exception:
        return {**base, "status": "unavailable"}
    if reading is None:
        return {**base, "status": "unavailable"}

    return {
        **base,
        "status": "ok",
        "formatted": format_tide(reading),
        "body": format_tide_body(reading),
        "station": {"id": station["id"], "name": station["name"]},
        "distanceMi": distance_mi,
    }

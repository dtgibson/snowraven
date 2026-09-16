import asyncio
import os
import time
from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException, Query

from formatters.weather import format_weather, get_timezone
from services.ebird import CHECKLIST_ID_RE, fetch_checklist
from services.forecast import build_weather_payload
from services.openweather import fetch_historical, fetch_forecast
from services.plan_weather import build_weather_plan
from services.wall_clock import BAD_DT_DETAIL, is_blank_wall_clock, parse_wall_clock

router = APIRouter()

_NO_KEY_DETAIL = "API key not configured. Check your .env file."
_WEATHER_UNAVAILABLE_DETAIL = "Weather data unavailable for this location."
_CHECKLIST_WEATHER_DETAIL = "Weather data unavailable for this checklist's time and location."
# eBird is a DIFFERENT upstream from the weather provider, so an unreadable
# checklist date gets its own words: the weather detail would name a provider
# that is never called on that path, and "Please try again" would promise a
# retry that cannot succeed (the value is deterministic).
_CHECKLIST_DATE_DETAIL = "This checklist's date could not be read."


def _now() -> int:
    """The fetch moment as an integer epoch second. Module-level so the plan
    tests freeze it; the builder never reads a clock itself."""
    return int(time.time())


# Declared BEFORE /weather/{checklist_id} so "plan" is never captured as a
# checklist id (the same route-order requirement as /weather/at).
@router.get("/weather/plan")
async def get_weather_plan(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
):
    """The Weather/tide Planner's weather half: the window, days, sunrise and
    sunset events, weather-strip cells and night spans from now to the end of
    the forecast, for the place at `lat`/`lng`. No other parameter is read: the
    window is derived from the fetch moment and the forecast, never supplied by
    the caller (FR-49). The only caller-supplied values that reach the provider
    URL are the two range-bounded coordinates, riding `params=`, so no scheme,
    host, credential or path separator is expressible and the destination
    cannot be steered. Exactly one OpenWeather request and zero NOAA requests on
    every path. The One Call body is reduced to the plan document; nothing of
    it is reflected back."""
    if not os.getenv("OPENWEATHER_API_KEY"):
        raise HTTPException(status_code=500, detail=_NO_KEY_DETAIL)

    tz = get_timezone(lat, lng)
    now_ts = _now()

    # The builder runs INSIDE the try: a JSON-valid but semantically malformed
    # body (an absurd dt, a non-numeric temp, an hourly entry carrying only dt)
    # is a provider error exactly as a 5xx is, mapped to the same 502 and the
    # same words, never a plain-text 500 that would read as the app's own fault.
    try:
        onecall = await fetch_forecast(lat, lng)
        built = build_weather_plan(onecall, now_ts, tz, lat, lng)
    except Exception:
        raise HTTPException(status_code=502, detail=_WEATHER_UNAVAILABLE_DETAIL)

    if not built["ok"]:
        # An empty daily array is a provider error (FR-09 / FR-40), shown in
        # Predict's words and never stored for replay.
        raise HTTPException(status_code=502, detail=_WEATHER_UNAVAILABLE_DETAIL)
    return built["plan"]


# NOTE: declared BEFORE /weather/{checklist_id} so FastAPI matches the static path
# first — otherwise "at" would be captured as a checklist id and rejected.
@router.get("/weather/at")
async def get_weather_at(lat: float, lng: float, dt: str | None = None):
    """Live (Current) or forecast (Predict) weather for an arbitrary location and
    moment, bypassing the eBird checklist. `dt` is the location's local wall-clock
    ('YYYY-MM-DD HH:MM' or 'YYYY-MM-DD'); omit it for "now". No eBird key needed."""
    if not os.getenv("OPENWEATHER_API_KEY"):
        raise HTTPException(status_code=500, detail="API key not configured. Check your .env file.")

    tz = get_timezone(lat, lng)

    # This refusal is the REFERENCE the tide sibling converged on, and it is now
    # spelled through the shared predicate rather than inline, so the two routes
    # cannot answer differently for the same string and the sentence has one
    # definition. Behaviour is unchanged on every one of the 32 shapes in
    # frontend/src/lib/wallClock.fixture.json: `parse_wall_clock` accepts exactly
    # what the two strptime formats accepted.
    #
    # `margin_hours` is 0 HERE and 25 on /tide/at. This route reads one instant
    # and needs no room around it, so `9999-12-31 23:59` keeps answering the
    # truthful `out-of-range` ("no weather reaches that far") rather than
    # becoming a bad-request error -- the Predict date input carries a `min` and
    # no `max`, so that is a reachable answer.
    target_ts = None
    if not is_blank_wall_clock(dt):
        parsed = parse_wall_clock(dt)
        if parsed is None:
            raise HTTPException(status_code=400, detail=BAD_DT_DETAIL)
        target_ts = int(parsed.replace(tzinfo=tz).timestamp())

    # The builder runs INSIDE the try, the shape /weather/plan already carries
    # (v1.0.29, .claude/rules/security.md): a JSON-valid but semantically
    # malformed body is a provider error exactly as a 5xx is, mapped to the same
    # 502 and the same words, never a plain-text 500 reading as the app's fault.
    # This route slices ONE tier, so WHICH shapes reach the builder depends on
    # the tier `dt` selects, and the table in test_at_route_containment.py is
    # per tier for that reason. It is NOT tier-ISOLATED, though, and this
    # comment asserted that it was until weather-at-malformed-parity measured
    # otherwise: `_hour_from_point` reads sunrise/sunset from the DAILY tier
    # whenever the selected current/hourly point omits them, which One Call
    # does at polar latitudes, so a daily-only mutation can decide a
    # current-tier answer. Measured on one body, three ways:
    #
    #   conforming                                        -> 200, Sunrise=6:48am
    #   daily[*].sunrise='x', current has its own          -> 200, Sunrise=6:48am
    #   daily[*].sunrise='x', current omits its own        -> 502
    #
    # So the honest statement is that a cross-tier mutation USUALLY answers 200
    # untouched, and does so here because the containment fixture's `current`
    # carries its own sun times -- a property of that fixture, not of the route.
    try:
        onecall = await fetch_forecast(lat, lng)
        payload = build_weather_payload(onecall, target_ts, tz, lat)
    except Exception:
        raise HTTPException(status_code=502, detail=_WEATHER_UNAVAILABLE_DETAIL)

    return {**payload, "tz": str(tz)}


@router.get("/weather/{checklist_id}")
async def get_weather(checklist_id: str):
    # Single-sourced on services.ebird (which this router already imports); it was
    # a byte-identical copy of the tide/weather sibling's regex until v0.5.88.
    # Explicit ASCII `[0-9]`, never `\d`: Python's `\d` matches every Unicode
    # decimal digit, so an id written in Arabic-Indic digits passed here while the
    # JS guard on the request path rejected it (v0.5.54 character-class rule).
    if not CHECKLIST_ID_RE.fullmatch(checklist_id):
        raise HTTPException(status_code=400, detail="That doesn't look like a valid eBird checklist ID.")

    if not os.getenv("EBIRD_API_KEY") or not os.getenv("OPENWEATHER_API_KEY"):
        raise HTTPException(
            status_code=500,
            detail="API key not configured. Check your .env file.",
        )

    try:
        checklist = await fetch_checklist(checklist_id)
    except LookupError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception:
        raise HTTPException(
            status_code=502,
            detail="Could not fetch checklist data. Please try again.",
        )

    tz = get_timezone(checklist["lat"], checklist["lng"])

    # services.ebird.fetch_checklist does NOT validate these two fields --
    # `obs_dt` is a bare `data["obsDt"]` index and `duration_hrs` is guarded only
    # against a falsy value -- so an unreadable eBird date raised out of this
    # expression as a bare 500. The second strptime, the .timestamp() calls and
    # the timedelta are all inside: each raises on its own shape (a non-string
    # date, an impossible calendar value, a non-numeric duration).
    try:
        raw_dt = checklist["obs_dt"]
        try:
            obs_dt = datetime.strptime(raw_dt, "%Y-%m-%d %H:%M").replace(tzinfo=tz)
        except ValueError:
            obs_dt = datetime.strptime(raw_dt, "%Y-%m-%d").replace(tzinfo=tz)
        start_ts = int(obs_dt.timestamp())
        end_ts = int((obs_dt + timedelta(hours=checklist["duration_hrs"])).timestamp())
    except Exception:
        raise HTTPException(status_code=502, detail=_CHECKLIST_DATE_DETAIL)

    timestamps = [start_ts] if end_ts == start_ts else [start_ts, end_ts]

    # format_weather is the builder that consumes the provider bodies here, so it
    # sits inside the same try as the fetch. Measured before the repair: ALL
    # twelve malformed timemachine shapes probed (an empty `data` array, a `data`
    # list of non-objects, a non-numeric temp, an absurd sunrise, a body that is
    # not an object at all) raised out of it as a bare 500.
    try:
        hourly_responses = await asyncio.gather(
            *[fetch_historical(checklist["lat"], checklist["lng"], ts) for ts in timestamps]
        )
        formatted = format_weather(list(hourly_responses), tz, checklist["lat"])
    except Exception:
        raise HTTPException(status_code=502, detail=_CHECKLIST_WEATHER_DETAIL)

    return {
        "formatted": formatted,
        "checklist_id": checklist_id,
        "loc_name": checklist["loc_name"],
        "obs_dt": checklist["obs_dt"],
    }

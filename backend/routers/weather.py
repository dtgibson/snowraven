import asyncio
import os
from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException

from formatters.weather import format_weather, get_timezone
from services.ebird import CHECKLIST_ID_RE, fetch_checklist
from services.forecast import build_weather_payload
from services.openweather import fetch_historical, fetch_forecast

router = APIRouter()


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

    target_ts = None
    if dt:
        parsed = None
        for fmt in ("%Y-%m-%d %H:%M", "%Y-%m-%d"):
            try:
                parsed = datetime.strptime(dt, fmt).replace(tzinfo=tz)
                break
            except ValueError:
                continue
        if parsed is None:
            raise HTTPException(status_code=400, detail="That doesn't look like a valid date and time.")
        target_ts = int(parsed.timestamp())

    try:
        onecall = await fetch_forecast(lat, lng)
    except Exception:
        raise HTTPException(status_code=502, detail="Weather data unavailable for this location.")

    payload = build_weather_payload(onecall, target_ts, tz, lat)
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
    raw_dt = checklist["obs_dt"]
    try:
        obs_dt = datetime.strptime(raw_dt, "%Y-%m-%d %H:%M").replace(tzinfo=tz)
    except ValueError:
        obs_dt = datetime.strptime(raw_dt, "%Y-%m-%d").replace(tzinfo=tz)

    start_ts = int(obs_dt.timestamp())
    end_ts = int((obs_dt + timedelta(hours=checklist["duration_hrs"])).timestamp())
    timestamps = [start_ts] if end_ts == start_ts else [start_ts, end_ts]

    try:
        hourly_responses = await asyncio.gather(
            *[fetch_historical(checklist["lat"], checklist["lng"], ts) for ts in timestamps]
        )
    except Exception:
        raise HTTPException(
            status_code=502,
            detail="Weather data unavailable for this checklist's time and location.",
        )

    formatted = format_weather(list(hourly_responses), tz, checklist["lat"])
    return {
        "formatted": formatted,
        "checklist_id": checklist_id,
        "loc_name": checklist["loc_name"],
        "obs_dt": checklist["obs_dt"],
    }

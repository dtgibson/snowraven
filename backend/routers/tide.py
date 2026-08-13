import os
from datetime import datetime

from fastapi import APIRouter, HTTPException

from formatters.tide import format_tide, format_tide_body
from formatters.weather import get_timezone
from services.ebird import CHECKLIST_ID_RE, fetch_checklist
from services.noaa import fetch_tides
from services.tide import (
    TideReading,
    compute_tide_reading, parse_observed, parse_predictions, parse_hilo,
    normalize_obs_dt, shift_local, to_noaa_date,
)
from services.tide_stations import nearest_station, classify

router = APIRouter()


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

    reading = compute_tide_reading(
        start, end,
        parse_observed(obs_body), parse_predictions(pred_body), parse_hilo(hilo_body),
        station, distance_mi,
    )
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
    keyless — no API key needed."""
    # No dt → "now" in the LOCATION's timezone (not the caller's), so Current is
    # correct regardless of the device/browser timezone.
    start = normalize_obs_dt(dt) if dt else normalize_obs_dt(
        datetime.now(get_timezone(lat, lng)).strftime("%Y-%m-%d %H:%M")
    )
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

    start = normalize_obs_dt(checklist["obs_dt"])
    end = shift_local(start, checklist["duration_hrs"] or 1)

    try:
        obs_body, pred_body, hilo_body = await fetch_tides(
            station["id"], to_noaa_date(start), to_noaa_date(end),
            to_noaa_date(shift_local(start, -24)), to_noaa_date(shift_local(end, 24)),
        )
    except Exception:
        raise HTTPException(status_code=502, detail="Tide data unavailable for this checklist's time and location.")

    reading = compute_tide_reading(
        start, end,
        parse_observed(obs_body), parse_predictions(pred_body), parse_hilo(hilo_body),
        station, distance_mi,
    )
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

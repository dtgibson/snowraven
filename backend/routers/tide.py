import os
import re

from fastapi import APIRouter, HTTPException

from formatters.tide import format_tide, format_tide_body
from services.ebird import fetch_checklist
from services.noaa import fetch_tides
from services.tide import (
    compute_tide_reading, parse_observed, parse_predictions, parse_hilo,
    normalize_obs_dt, shift_local, to_noaa_date,
)
from services.tide_stations import nearest_station, classify

router = APIRouter()


@router.get("/tide/{checklist_id}")
async def get_tide(checklist_id: str, force: bool = False):
    if not re.fullmatch(r"S\d+", checklist_id):
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

    nearest = nearest_station(checklist["lat"], checklist["lng"], prefer_obs=True)
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

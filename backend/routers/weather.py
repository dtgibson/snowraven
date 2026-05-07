import asyncio
import math
import os
import re
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi import APIRouter, HTTPException

from formatters.weather import format_weather, get_timezone
from services.ebird import fetch_checklist
from services.openweather import fetch_historical

router = APIRouter()


@router.get("/weather/{checklist_id}")
async def get_weather(checklist_id: str):
    if not re.fullmatch(r"S\d+", checklist_id):
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

    num_hours = max(1, math.ceil(checklist["duration_hrs"]))
    timestamps = [
        int((obs_dt + timedelta(hours=h)).timestamp()) for h in range(num_hours)
    ]
    print(f"[DEBUG] duration_hrs={checklist['duration_hrs']}, num_hours={num_hours}, obs_dt={obs_dt}, timestamps={timestamps}")

    try:
        hourly_responses = await asyncio.gather(
            *[fetch_historical(checklist["lat"], checklist["lng"], ts) for ts in timestamps]
        )
    except Exception:
        raise HTTPException(
            status_code=502,
            detail="Weather data unavailable for this checklist's time and location.",
        )

    formatted = format_weather(list(hourly_responses), tz)
    return {"formatted": formatted}

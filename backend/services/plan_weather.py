"""The weather half of the Weather/tide Planner: the plan's spine (window, days,
events, weather-strip cells, night spans) built from ONE One Call response
(tide-weather-planner, schema section 3.3). Twin of
frontend/src/lib/weatherPlan.ts; both are driven from
frontend/src/lib/weatherTidePlan.fixture.json and must produce byte-identical
documents.

Pure: `now_ts` is a parameter and nothing here reads a clock. Nothing here
rounds a figure the UI prints (D8); the only rounding is the shipped banker's
`round()` inside `build_weather_payload`, which is Predict's own.

Every event's weather is `build_weather_payload(onecall, t, tz, lat)["summary"]`,
the shipped Predict function called as it stands, so every figure equals
Predict's for the same fixture and moment by construction (FR-18, QA-17).
"""

from zoneinfo import ZoneInfo

from services.forecast import build_weather_payload
from services.tz_clock import (
    add_days, local_clock, local_date, local_midnight_ts, start_of_local_hour,
)

# Caps applied at the parse boundary, each at least twice a conforming
# response's shape (One Call serves 8 daily and 48 hourly entries).
PLAN_DAYS_MAX = 16
PLAN_HOURLY_MAX = 96
PLAN_EVENTS_MAX = 32
PLAN_CELLS_MAX = 112
PLAN_NIGHT_SPANS_MAX = 17

_HALF_HOUR = 1800


def _finite(v) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool) and v == v and abs(v) != float("inf")


def _present_ts(v):
    """A sunrise or sunset is PRESENT iff it is a finite number greater than
    zero: One Call reports polar days with 0, and a malformed body may omit the
    key. Never `dt` as a fallback (that is the copy block's heuristic)."""
    return int(v // 1) if _finite(v) and v > 0 else None


def _to_plan_weather(s: dict) -> dict:
    daily = bool(s["isDaily"])
    return {
        "resolution": "daily" if daily else "hourly",
        "emoji": s["emoji"],
        "description": s["description"],
        "tempF": s["tempF"],
        "highF": s["highF"] if daily else None,
        "lowF": s["lowF"] if daily else None,
        "windDesc": s["windDesc"],
        "windDir": s["windDir"],
        "cloudsPct": s["cloudsPct"],
        "humidityPct": s["humidityPct"],
        "dewPointF": s["dewPointF"],
    }


def _weather_at(onecall: dict, t: int, tz: ZoneInfo, lat: float):
    """Predict's reading for instant `t` (FR-18); `current` collapses to
    `hourly` (FR-17)."""
    s = build_weather_payload(onecall, t, tz, lat)["summary"]
    return _to_plan_weather(s) if s else None


def _hourly_reading(h: dict, daily: list, tz: ZoneInfo, lat: float):
    """The HOURLY entry's own reading, never the `current` block: the same
    slicer over a response that carries no `current`, so the nearest hourly
    entry is the entry itself."""
    return _weather_at({"hourly": [h], "daily": daily}, h["dt"], tz, lat)


def _daily_reading(d: dict, tz: ZoneInfo, lat: float):
    """The DAILY entry's own reading, never an hourly neighbour's."""
    return _weather_at({"daily": [d]}, d["dt"], tz, lat)


def build_weather_plan(onecall: dict, now_ts: int, tz: ZoneInfo, lat: float, lng: float) -> dict:
    """Build the weather half. Returns {"ok": True, "plan": ...} or
    {"ok": False, "reason": "no-daily"} (an empty daily array is a provider
    error for the route, FR-09 / FR-40)."""
    raw_daily = onecall.get("daily") if isinstance(onecall, dict) else None
    daily_entries = sorted(
        (d for d in (raw_daily if isinstance(raw_daily, list) else []) if isinstance(d, dict) and _finite(d.get("dt"))),
        key=lambda d: d["dt"],
    )

    days: list[dict] = []
    daily_by_date: list[dict] = []
    for d in daily_entries:
        date = local_date(int(d["dt"]), tz)
        if days and days[-1]["date"] == date:
            continue
        if len(days) >= PLAN_DAYS_MAX:
            break
        start_ts = local_midnight_ts(date, tz)
        end_ts = local_midnight_ts(add_days(date, 1), tz) - 1
        sunrise_t = _present_ts(d.get("sunrise"))
        sunset_t = _present_ts(d.get("sunset"))
        days.append({
            "date": date,
            "startTs": start_ts,
            "endTs": end_ts,
            "sunrise": None if sunrise_t is None else {"t": sunrise_t, "local": local_clock(sunrise_t, tz)},
            "sunset": None if sunset_t is None else {"t": sunset_t, "local": local_clock(sunset_t, tz)},
        })
        daily_by_date.append(d)
    if not days:
        return {"ok": False, "reason": "no-daily"}

    axis_start_ts = start_of_local_hour(now_ts, tz)
    end_ts = days[-1]["endTs"]
    window = {
        "startTs": now_ts,
        "startLocal": local_clock(now_ts, tz),
        "endTs": end_ts,
        "endLocal": local_clock(end_ts, tz),
        "axisStartTs": axis_start_ts,
        "axisStartLocal": local_clock(axis_start_ts, tz),
    }

    raw_hourly = onecall.get("hourly")
    hourly = sorted(
        (h for h in (raw_hourly if isinstance(raw_hourly, list) else []) if isinstance(h, dict) and _finite(h.get("dt"))),
        key=lambda h: h["dt"],
    )[:PLAN_HOURLY_MAX]
    hourly_end_ts = hourly[-1]["dt"] + _HALF_HOUR if hourly else axis_start_ts

    events: list[dict] = []
    for i, day in enumerate(days):
        for kind in ("sunrise", "sunset"):
            ev = day[kind]
            if ev is None or ev["t"] <= now_ts:
                continue
            weather = _weather_at(onecall, ev["t"], tz, lat) or _daily_reading(daily_by_date[i], tz, lat)
            if weather is None:
                continue
            events.append({"kind": kind, "t": ev["t"], "local": ev["local"], "date": day["date"], "weather": weather})
    events.sort(key=lambda e: (e["t"], 0 if e["kind"] == "sunrise" else 1))
    del events[PLAN_EVENTS_MAX:]

    cells: list[dict] = []
    for h in hourly:
        start_ts = max(axis_start_ts, h["dt"] - _HALF_HOUR)
        cell_end = min(h["dt"] + _HALF_HOUR, hourly_end_ts, end_ts + 1) - 1
        if cell_end < start_ts:
            continue
        weather = _hourly_reading(h, daily_by_date, tz, lat)
        if weather is None:
            continue
        cells.append({"resolution": "hourly", "startTs": start_ts, "endTs": cell_end, "local": local_clock(h["dt"], tz), "weather": weather})
    for i, day in enumerate(days):
        if day["endTs"] <= hourly_end_ts:
            continue
        start_ts = max(day["startTs"], hourly_end_ts, axis_start_ts)
        if day["endTs"] < start_ts:
            continue
        weather = _daily_reading(daily_by_date[i], tz, lat)
        if weather is None:
            continue
        # A full-day cell reads as the day's date at noon; the boundary day's
        # PARTIAL cell carries the clock it begins at (the list's "from {time}").
        local = f"{day['date']} 12:00" if start_ts == day["startTs"] else local_clock(start_ts, tz)
        cells.append({"resolution": "daily", "startTs": start_ts, "endTs": day["endTs"], "local": local, "weather": weather})
    del cells[PLAN_CELLS_MAX:]

    spans: list[dict] = []

    def push(a: int, b: int) -> None:
        s = max(a, axis_start_ts)
        e = min(b, end_ts)
        if e > s and len(spans) < PLAN_NIGHT_SPANS_MAX:
            spans.append({"startTs": s, "endTs": e})

    first = days[0]
    if first["sunrise"] and axis_start_ts < first["sunrise"]["t"]:
        push(axis_start_ts, first["sunrise"]["t"])
    for i, day in enumerate(days):
        s = day["sunset"]
        if not s:
            continue
        nxt = None
        for j in range(i + 1, len(days)):
            r = days[j]["sunrise"]
            if r:
                nxt = r["t"]
                break
        start = axis_start_ts if (i == 0 and now_ts >= s["t"]) else s["t"]
        push(start, end_ts if nxt is None else nxt)

    return {
        "ok": True,
        "plan": {
            "tz": str(tz),
            "lat": lat,
            "lng": lng,
            "fetchedAt": now_ts,
            "window": window,
            "hourlyEndTs": hourly_end_ts,
            "days": days,
            "events": events,
            "cells": cells,
            "nightSpans": spans,
        },
    }

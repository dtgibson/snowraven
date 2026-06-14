"""Forecast-tier selection + the readable summary for the Current/Predict
lookups (web/Pi twin of frontend/src/lib/forecastSlice.ts). Pure; no I/O.

A single base One Call 3.0 response (current + hourly + daily) is sliced to the
right resolution for a target moment:

  - current     → "now" (within ~1h of the response's current time)
  - hourly      → an exact hour, up to ~48h out
  - daily       → a whole-day summary, ~48h to ~8 days out
  - out-of-range→ beyond the forecast horizon (no weather; tide still shows)

The chosen slice is adapted into the timemachine `{data:[hour]}` shape the
existing format_weather already consumes, so the copy block stays byte-identical
to the checklist lookup (one formatter). The summary carries the structured
fields the readable at-a-glance view renders.
"""

from zoneinfo import ZoneInfo

from formatters.weather import (
    condition_emoji, wind_description, cardinal, format_local_time,
    moon_phase_emoji, format_weather,
)

# Tier boundaries (seconds). The hourly array covers ~48h, daily ~8 days; we add a
# small slack so a target right at a boundary still resolves.
_NOW_SLACK = 3600          # within ±1h of "now" → current
_HOURLY_SLACK = 1800       # 30 min past the last hourly point still counts
_DAILY_SLACK = 43200       # daily dt is local noon; 12h past the last noon = end of that day

_FALLBACK_WEATHER = [{"id": 800, "description": "clear sky"}]


def pick_forecast_slice(onecall: dict, target_ts):
    """Return (resolution, slice) for `target_ts` (epoch seconds, or None = now).
    `slice` is the raw current/hourly/daily object, or None when out-of-range."""
    current = onecall.get("current") or {}
    now = current.get("dt")

    if target_ts is None or (now is not None and abs(target_ts - now) <= _NOW_SLACK):
        return ("current", current) if current else ("out-of-range", None)

    hourly = onecall.get("hourly") or []
    if hourly:
        last = hourly[-1].get("dt", 0)
        if target_ts <= last + _HOURLY_SLACK:
            nearest = min(hourly, key=lambda h: abs(h.get("dt", 0) - target_ts))
            return ("hourly", nearest)

    daily = onecall.get("daily") or []
    if daily:
        last = daily[-1].get("dt", 0)
        if target_ts <= last + _DAILY_SLACK:
            nearest = min(daily, key=lambda d: abs(d.get("dt", 0) - target_ts))
            return ("daily", nearest)

    return ("out-of-range", None)


def _hour_from_current(current: dict) -> dict:
    # current already carries every field format_weather reads (incl. sunrise/sunset).
    return current


def _hour_from_hourly(hourly: dict, onecall: dict) -> dict:
    # hourly entries omit sunrise/sunset — inject them from the matching daily entry
    # so night detection + the Sunrise/Sunset lines work.
    h = dict(hourly)
    if "sunrise" not in h or "sunset" not in h:
        daily = onecall.get("daily") or []
        day = min(daily, key=lambda d: abs(d.get("dt", 0) - h.get("dt", 0))) if daily else {}
        h["sunrise"] = day.get("sunrise", h.get("dt", 0))
        h["sunset"] = day.get("sunset", h.get("dt", 0))
    return h


def _hour_from_daily(daily: dict) -> dict:
    # daily `temp` is an object; map it to the day value and keep the rest flat.
    t = daily.get("temp") or {}
    return {
        "dt": daily.get("dt", 0),
        "temp": t.get("day", 0),
        "humidity": daily.get("humidity", 0),
        "dew_point": daily.get("dew_point", 0),
        "wind_speed": daily.get("wind_speed", 0),
        "wind_deg": daily.get("wind_deg", 0),
        "clouds": daily.get("clouds", 0),
        "weather": daily.get("weather") or _FALLBACK_WEATHER,
        "sunrise": daily.get("sunrise", daily.get("dt", 0)),
        "sunset": daily.get("sunset", daily.get("dt", 0)),
    }


def _summary_from_hour(hour: dict, tz: ZoneInfo, lat: float, is_daily: bool, high=None, low=None) -> dict:
    owm = (hour.get("weather") or _FALLBACK_WEATHER)[0]
    is_night = (not is_daily) and (hour["dt"] < hour["sunrise"] or hour["dt"] > hour["sunset"])
    return {
        "emoji": condition_emoji(owm["id"]),
        "moon": moon_phase_emoji(hour["dt"], lat) if is_night else "",
        "description": owm["description"].capitalize(),
        "isDaily": is_daily,
        "tempF": round(hour["temp"]),
        "highF": round(high) if high is not None else None,
        "lowF": round(low) if low is not None else None,
        "windDesc": wind_description(hour["wind_speed"]),
        "windDir": cardinal(hour["wind_deg"]),
        "cloudsPct": round(hour["clouds"]),
        "humidityPct": round(hour["humidity"]),
        "dewPointF": round(hour["dew_point"]),
        "sunrise": format_local_time(hour["sunrise"], tz),
        "sunset": format_local_time(hour["sunset"], tz),
        "isNight": is_night,
    }


def build_weather_payload(onecall: dict, target_ts, tz: ZoneInfo, lat: float) -> dict:
    """Slice → adapted formatter input + structured summary. Returns
    {resolution, formatted, summary}; formatted/summary are None when out-of-range."""
    resolution, sl = pick_forecast_slice(onecall, target_ts)
    if resolution == "out-of-range":
        return {"resolution": "out-of-range", "formatted": None, "summary": None}

    if resolution == "daily":
        hour = _hour_from_daily(sl)
        t = sl.get("temp") or {}
        lo, hi = t.get("min", hour["temp"]), t.get("max", hour["temp"])
        # Two synthetic points (min, max) so the copy block's Temperature line reads
        # as a daily low–high range via the existing format_range.
        responses = [{"data": [dict(hour, temp=lo)]}, {"data": [dict(hour, temp=hi)]}]
        summary = _summary_from_hour(hour, tz, lat, is_daily=True, high=hi, low=lo)
    else:
        hour = _hour_from_current(sl) if resolution == "current" else _hour_from_hourly(sl, onecall)
        responses = [{"data": [hour]}]
        summary = _summary_from_hour(hour, tz, lat, is_daily=False)

    return {
        "resolution": resolution,
        "formatted": format_weather(responses, tz, lat),
        "summary": summary,
    }

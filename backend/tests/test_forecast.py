from zoneinfo import ZoneInfo

from services.forecast import pick_forecast_slice, build_weather_payload

NOW = 1718000000  # fixed anchor (no wall-clock dependency)
TZ = ZoneInfo("UTC")


def _hour(dt, temp=60.0, wid=802, desc="scattered clouds"):
    return {
        "dt": dt, "temp": temp, "humidity": 70, "dew_point": 50,
        "wind_speed": 8, "wind_deg": 270, "clouds": 20,
        "weather": [{"id": wid, "description": desc}],
    }


def _current():
    h = _hour(NOW, temp=61.0)
    h["sunrise"] = NOW - 3 * 3600
    h["sunset"] = NOW + 6 * 3600
    return h


def _daily(dt, day=58, lo=51, hi=64):
    return {
        "dt": dt, "temp": {"day": day, "min": lo, "max": hi},
        "humidity": 78, "dew_point": 50, "wind_speed": 6, "wind_deg": 315,
        "clouds": 30, "weather": [{"id": 801, "description": "few clouds"}],
        "sunrise": dt - 6 * 3600, "sunset": dt + 6 * 3600,
    }


def _onecall():
    hourly = [_hour(NOW + i * 3600, temp=60 + (i % 5)) for i in range(48)]
    daily = [_daily(NOW + 12 * 3600 + d * 86400) for d in range(8)]
    return {"current": _current(), "hourly": hourly, "daily": daily}


# ── tier selection ─────────────────────────────────────────────────────────

def test_slice_current_when_no_target():
    res, _ = pick_forecast_slice(_onecall(), None)
    assert res == "current"


def test_slice_current_within_an_hour():
    res, _ = pick_forecast_slice(_onecall(), NOW + 1800)
    assert res == "current"


def test_slice_hourly_within_48h():
    res, sl = pick_forecast_slice(_onecall(), NOW + 6 * 3600)
    assert res == "hourly"
    assert abs(sl["dt"] - (NOW + 6 * 3600)) <= 1800


def test_slice_daily_beyond_48h():
    res, _ = pick_forecast_slice(_onecall(), NOW + 72 * 3600)
    assert res == "daily"


def test_slice_out_of_range_beyond_8_days():
    res, sl = pick_forecast_slice(_onecall(), NOW + 9 * 86400)
    assert res == "out-of-range"
    assert sl is None


# ── payload (slice → formatter input + summary) ────────────────────────────

def test_payload_current():
    p = build_weather_payload(_onecall(), None, TZ, 40.0)
    assert p["resolution"] == "current"
    assert "Temperature:" in p["formatted"]
    assert "SnowRaven" in p["formatted"]
    assert p["summary"]["isDaily"] is False
    assert p["summary"]["tempF"] == 61


def test_payload_daily_has_range_and_highlow():
    p = build_weather_payload(_onecall(), NOW + 72 * 3600, TZ, 40.0)
    assert p["resolution"] == "daily"
    assert p["summary"]["isDaily"] is True
    assert p["summary"]["highF"] == 64
    assert p["summary"]["lowF"] == 51
    # The daily copy block shows the low–high range via the existing formatter.
    assert "Temperature: 51 - 64°F" in p["formatted"]


def test_payload_out_of_range_has_no_weather():
    p = build_weather_payload(_onecall(), NOW + 9 * 86400, TZ, 40.0)
    assert p["resolution"] == "out-of-range"
    assert p["formatted"] is None
    assert p["summary"] is None


def test_hourly_injects_sunrise_so_block_has_sun_lines():
    p = build_weather_payload(_onecall(), NOW + 6 * 3600, TZ, 40.0)
    assert p["resolution"] == "hourly"
    assert "Sunrise:" in p["formatted"]
    assert "Sunset:" in p["formatted"]

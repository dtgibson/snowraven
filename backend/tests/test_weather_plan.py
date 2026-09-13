"""GET /weather/plan -- the Weather/tide Planner's weather half (schema 4.2).

Route-level tests for THIS consumer: the key guard, the provider-error mapping,
the range validation, the request budget (exactly one One Call request and
zero NOAA requests on every path), and the /at trap in its discriminating form
(a bare `/weather/plan` answers 422, never the checklist-id 400). The builder's
output is fixture-locked in test_weather_tide_plan_parity.py; this file pins
the route around it.
"""

import copy
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from main import app

client = TestClient(app)

NOW = 1789252860  # 2026-09-12 22:41 UTC, frozen through routers.weather._now
BASE = NOW - 41 * 60 - 600


def _hour(dt, temp=60.0):
    return {
        "dt": dt, "temp": temp, "humidity": 70, "dew_point": 50,
        "wind_speed": 8, "wind_deg": 270, "clouds": 20,
        "weather": [{"id": 802, "description": "scattered clouds"}],
    }


def _daily(dt, k):
    return {
        "dt": dt, "temp": {"day": 58 + k, "min": 51, "max": 64},
        "humidity": 78, "dew_point": 50, "wind_speed": 6, "wind_deg": 315,
        "clouds": 30, "weather": [{"id": 801, "description": "few clouds"}],
        "sunrise": dt - 5 * 3600, "sunset": dt + 7 * 3600,
    }


# Daily dt is local noon in America/Los_Angeles: 2026-09-12 12:00 PDT = 19:00 UTC.
NOON0 = 1789239600
MOCK_ONECALL = {
    "current": {**_hour(NOW - 600, 61.0), "sunrise": NOON0 - 5 * 3600, "sunset": NOON0 + 7 * 3600},
    "hourly": [_hour(BASE + i * 3600) for i in range(48)],
    "daily": [_daily(NOON0 + d * 86400, d) for d in range(8)],
}
PARAMS = {"lat": 36.603, "lng": -121.876}


def _noaa_spy():
    """A get_client() double for services.noaa: any call is a NOAA request."""
    return patch("services.noaa.get_client")


def test_no_key_is_500_with_the_no_key_detail_and_no_requests(monkeypatch):
    monkeypatch.delenv("OPENWEATHER_API_KEY", raising=False)
    with (
        patch("routers.weather.fetch_forecast", new=AsyncMock()) as fc,
        _noaa_spy() as noaa,
    ):
        resp = client.get("/weather/plan", params=PARAMS)
    assert resp.status_code == 500
    assert "API key not configured" in resp.json()["detail"]
    fc.assert_not_called()
    noaa.assert_not_called()


def test_ok_builds_the_weather_half_from_one_forecast_request(monkeypatch):
    monkeypatch.setenv("OPENWEATHER_API_KEY", "k")
    with (
        patch("routers.weather._now", return_value=NOW),
        patch("routers.weather.fetch_forecast", new=AsyncMock(return_value=copy.deepcopy(MOCK_ONECALL))) as fc,
        _noaa_spy() as noaa,
    ):
        resp = client.get("/weather/plan", params=PARAMS)
    assert resp.status_code == 200
    plan = resp.json()
    assert plan["tz"] == "America/Los_Angeles"
    assert plan["fetchedAt"] == NOW
    assert plan["window"]["startTs"] == NOW
    assert plan["window"]["axisStartTs"] == NOW - 41 * 60
    assert len(plan["days"]) == 8
    assert plan["window"]["endTs"] == plan["days"][-1]["endTs"]
    assert plan["events"] and all(e["t"] > NOW for e in plan["events"])
    assert fc.call_count == 1
    fc.assert_called_once_with(36.603, -121.876)
    noaa.assert_not_called()
    # Nothing raw from the provider is reflected back.
    assert "hourly" not in plan and "daily" not in plan and "current" not in plan


def test_provider_failures_map_to_502_with_predicts_words(monkeypatch):
    monkeypatch.setenv("OPENWEATHER_API_KEY", "k")
    import httpx
    failures = [
        httpx.HTTPStatusError("429", request=httpx.Request("GET", "http://x"), response=httpx.Response(429)),
        httpx.HTTPStatusError("503", request=httpx.Request("GET", "http://x"), response=httpx.Response(503)),
        httpx.ReadTimeout("timed out"),
        ValueError("malformed json"),
    ]
    for exc in failures:
        with patch("routers.weather.fetch_forecast", new=AsyncMock(side_effect=exc)):
            resp = client.get("/weather/plan", params=PARAMS)
        assert resp.status_code == 502, repr(exc)
        assert resp.json()["detail"] == "Weather data unavailable for this location."


def test_empty_daily_is_a_provider_error(monkeypatch):
    monkeypatch.setenv("OPENWEATHER_API_KEY", "k")
    body = {**copy.deepcopy(MOCK_ONECALL), "daily": []}
    with (
        patch("routers.weather._now", return_value=NOW),
        patch("routers.weather.fetch_forecast", new=AsyncMock(return_value=body)),
    ):
        resp = client.get("/weather/plan", params=PARAMS)
    assert resp.status_code == 502
    assert resp.json()["detail"] == "Weather data unavailable for this location."


def test_out_of_range_coordinates_are_422_before_any_request(monkeypatch):
    monkeypatch.setenv("OPENWEATHER_API_KEY", "k")
    with patch("routers.weather.fetch_forecast", new=AsyncMock()) as fc:
        for bad in ({"lat": 91, "lng": 0}, {"lat": -91, "lng": 0}, {"lat": 0, "lng": 181}, {"lat": 0, "lng": -181}, {"lat": "x", "lng": 0}):
            resp = client.get("/weather/plan", params=bad)
            assert resp.status_code == 422, bad
    fc.assert_not_called()


def test_bare_plan_path_is_validation_not_the_checklist_id_route():
    # The /at trap in its discriminating form: capture by /weather/{checklist_id}
    # would answer 400 "valid eBird checklist ID"; the range route answers 422.
    resp = client.get("/weather/plan")
    assert resp.status_code == 422
    assert "checklist ID" not in resp.text


def test_window_parameters_change_nothing(monkeypatch):
    monkeypatch.setenv("OPENWEATHER_API_KEY", "k")
    with (
        patch("routers.weather._now", return_value=NOW),
        patch("routers.weather.fetch_forecast", new=AsyncMock(return_value=copy.deepcopy(MOCK_ONECALL))) as fc,
    ):
        plain = client.get("/weather/plan", params=PARAMS).json()
        steered = client.get("/weather/plan", params={**PARAMS, "start": "2020-01-01", "end": "2030-01-01", "days": 30, "dt": "2026-01-01 00:00"}).json()
    assert steered == plain
    # Both calls carried the coordinates only.
    for call in fc.call_args_list:
        assert call.args == (36.603, -121.876)


def test_the_checklist_route_still_answers_a_real_looking_id():
    resp = client.get("/weather/notavalidid")
    assert resp.status_code == 400
    assert "checklist ID" in resp.json()["detail"]


# ── A JSON-valid but semantically malformed body is a provider error (the
# Auditor's Low, closed): each shape below raises inside the builder, and the
# route maps it to the same 502 and the same words as a 5xx, with the key
# nowhere in the body. Shapes measured raising on this transport before the
# test was written; `current` carrying only dt is tolerated by the slicer and is
# deliberately not in the list.
import pytest  # noqa: E402


def _malformed(name):
    body = copy.deepcopy(MOCK_ONECALL)
    if name == "absurd-dt":
        body["daily"][0]["dt"] = 10**20
    elif name == "absurd-sunrise":
        body["daily"][1]["sunrise"] = 10**20
    elif name == "temp-string":
        body["hourly"][3]["temp"] = "warm"
    elif name == "wind-none":
        body["hourly"][3]["wind_speed"] = None
    elif name == "hourly-dt-only":
        body["hourly"][3] = {"dt": body["hourly"][3]["dt"]}
    elif name == "daily-temp-string":
        body["daily"][2]["temp"] = "x"
    elif name == "weather-not-list":
        body["hourly"][3]["weather"] = "sunny"
    return body


@pytest.mark.parametrize("name", ["absurd-dt", "absurd-sunrise", "temp-string", "wind-none", "hourly-dt-only", "daily-temp-string", "weather-not-list"])
def test_a_semantically_malformed_body_is_a_502_never_a_500(monkeypatch, name):
    monkeypatch.setenv("OPENWEATHER_API_KEY", "sekrit-key")
    with (
        patch("routers.weather._now", return_value=NOW),
        patch("routers.weather.fetch_forecast", new=AsyncMock(return_value=_malformed(name))),
    ):
        resp = client.get("/weather/plan", params=PARAMS)
    assert resp.status_code == 502, name
    assert resp.json()["detail"] == "Weather data unavailable for this location."
    assert "sekrit-key" not in resp.text

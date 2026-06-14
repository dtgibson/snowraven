import copy
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def _hour(dt, temp=60.0):
    return {
        "dt": dt, "temp": temp, "humidity": 70, "dew_point": 50,
        "wind_speed": 8, "wind_deg": 270, "clouds": 20,
        "weather": [{"id": 802, "description": "scattered clouds"}],
        "sunrise": dt - 3 * 3600, "sunset": dt + 6 * 3600,
    }


BASE_DT = 1714563000  # 2024-05-01, ~midday ET

MOCK_ONECALL = {
    "current": _hour(BASE_DT, 61.0),
    "hourly": [_hour(BASE_DT + i * 3600) for i in range(48)],
    "daily": [
        {
            "dt": BASE_DT + d * 86400, "temp": {"day": 58, "min": 51, "max": 64},
            "humidity": 78, "dew_point": 50, "wind_speed": 6, "wind_deg": 315,
            "clouds": 30, "weather": [{"id": 801, "description": "few clouds"}],
            "sunrise": BASE_DT + d * 86400 - 6 * 3600, "sunset": BASE_DT + d * 86400 + 6 * 3600,
        }
        for d in range(8)
    ],
}


def test_weather_at_missing_key(monkeypatch):
    monkeypatch.delenv("OPENWEATHER_API_KEY", raising=False)
    resp = client.get("/weather/at", params={"lat": 40.0, "lng": -74.0})
    assert resp.status_code == 500
    assert "API key not configured" in resp.json()["detail"]


def test_weather_at_current(monkeypatch):
    monkeypatch.setenv("OPENWEATHER_API_KEY", "k")
    with patch("routers.weather.fetch_forecast", new=AsyncMock(return_value=copy.deepcopy(MOCK_ONECALL))):
        resp = client.get("/weather/at", params={"lat": 40.0, "lng": -74.0})
    assert resp.status_code == 200
    data = resp.json()
    assert data["resolution"] == "current"
    assert "Temperature:" in data["formatted"]
    assert data["summary"]["tempF"] == 61
    assert data["summary"]["isDaily"] is False
    assert "tz" in data


def test_weather_at_out_of_range(monkeypatch):
    monkeypatch.setenv("OPENWEATHER_API_KEY", "k")
    with patch("routers.weather.fetch_forecast", new=AsyncMock(return_value=copy.deepcopy(MOCK_ONECALL))):
        resp = client.get("/weather/at", params={"lat": 40.0, "lng": -74.0, "dt": "2099-01-01 12:00"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["resolution"] == "out-of-range"
    assert data["formatted"] is None
    assert data["summary"] is None


def test_weather_at_bad_dt(monkeypatch):
    monkeypatch.setenv("OPENWEATHER_API_KEY", "k")
    with patch("routers.weather.fetch_forecast", new=AsyncMock(return_value=copy.deepcopy(MOCK_ONECALL))):
        resp = client.get("/weather/at", params={"lat": 40.0, "lng": -74.0, "dt": "not-a-date"})
    assert resp.status_code == 400


def test_weather_at_api_failure(monkeypatch):
    monkeypatch.setenv("OPENWEATHER_API_KEY", "k")
    with patch("routers.weather.fetch_forecast", new=AsyncMock(side_effect=Exception("boom"))):
        resp = client.get("/weather/at", params={"lat": 40.0, "lng": -74.0})
    assert resp.status_code == 502


def test_weather_at_does_not_shadow_checklist_route():
    # A non-"at" path still hits the checklist route (its id validation → 400),
    # proving /weather/at doesn't swallow /weather/{checklist_id}.
    resp = client.get("/weather/notavalidid")
    assert resp.status_code == 400
    assert "checklist ID" in resp.json()["detail"]

from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from main import app

client = TestClient(app)

MOCK_CHECKLIST = {
    "obs_dt": "2024-05-01 06:30",
    "lat": 40.7128,
    "lng": -74.0060,
    "duration_hrs": 1,
}

MOCK_OWM_RESPONSE = {
    "data": [{
        "temp": 54.3,
        "humidity": 89,
        "dew_point": 51.5,
        "wind_speed": 8.3,
        "wind_deg": 270,
        "clouds": 100,
        "weather": [{"id": 804, "description": "overcast clouds"}],
        "sunrise": 1714554480,
        "sunset": 1714603980,
    }]
}


def test_missing_api_keys(monkeypatch):
    monkeypatch.delenv("EBIRD_API_KEY", raising=False)
    monkeypatch.delenv("OPENWEATHER_API_KEY", raising=False)
    resp = client.get("/weather/S12345678")
    assert resp.status_code == 500
    assert "API key not configured" in resp.json()["detail"]


def test_successful_lookup(monkeypatch):
    monkeypatch.setenv("EBIRD_API_KEY", "test-key")
    monkeypatch.setenv("OPENWEATHER_API_KEY", "test-key")
    with (
        patch("routers.weather.fetch_checklist", new=AsyncMock(return_value=MOCK_CHECKLIST)),
        patch("routers.weather.fetch_historical", new=AsyncMock(return_value=MOCK_OWM_RESPONSE)),
    ):
        resp = client.get("/weather/S12345678")
    assert resp.status_code == 200
    data = resp.json()
    assert "formatted" in data
    assert "☁️" in data["formatted"]
    assert "SnowRaven" in data["formatted"]
    assert "Temperature:" in data["formatted"]


def test_checklist_not_found(monkeypatch):
    monkeypatch.setenv("EBIRD_API_KEY", "test-key")
    monkeypatch.setenv("OPENWEATHER_API_KEY", "test-key")
    with patch(
        "routers.weather.fetch_checklist",
        new=AsyncMock(side_effect=LookupError("Checklist not found. Check the ID and try again.")),
    ):
        resp = client.get("/weather/S99999999")
    assert resp.status_code == 400
    assert "not found" in resp.json()["detail"]


def test_weather_api_failure(monkeypatch):
    monkeypatch.setenv("EBIRD_API_KEY", "test-key")
    monkeypatch.setenv("OPENWEATHER_API_KEY", "test-key")
    with (
        patch("routers.weather.fetch_checklist", new=AsyncMock(return_value=MOCK_CHECKLIST)),
        patch("routers.weather.fetch_historical", new=AsyncMock(side_effect=Exception("API error"))),
    ):
        resp = client.get("/weather/S12345678")
    assert resp.status_code == 502
    assert "Weather data unavailable" in resp.json()["detail"]


def test_health():
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}

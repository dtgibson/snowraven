from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from main import app

client = TestClient(app)

MOCK_STATION = {"id": "9410230", "name": "La Jolla", "lat": 32.87, "lng": -117.26, "state": "CA", "obs": True}

OBS_BODY = {"error": {"message": "no data"}}  # no observed → predicted path
PRED_BODY = {"predictions": [
    {"t": "2024-05-01 11:30", "v": "3.10"},
    {"t": "2024-05-01 12:00", "v": "3.40"},
    {"t": "2024-05-01 12:30", "v": "3.70"},
]}
HILO_BODY = {"predictions": [
    {"t": "2024-05-01 09:00", "v": "0.50", "type": "L"},
    {"t": "2024-05-01 15:00", "v": "5.20", "type": "H"},
]}


def test_tide_at_ok():
    with (
        patch("routers.tide.nearest_station", return_value=(MOCK_STATION, 1.2)),
        patch("routers.tide.fetch_tides", new=AsyncMock(return_value=(OBS_BODY, PRED_BODY, HILO_BODY))),
    ):
        resp = client.get("/tide/at", params={"lat": 32.87, "lng": -117.26, "dt": "2024-05-01 12:00"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert "🌊" in data["formatted"]
    assert data["reading"]["source"] == "predicted"
    assert data["reading"]["trend"] == "rising"
    assert data["reading"]["station"]["id"] == "9410230"
    assert data["reading"]["nextHL"]["kind"] == "high"


def test_tide_at_too_far():
    # In-US point, nearest station beyond 25 mi, no force → soft too-far notice.
    with patch("routers.tide.nearest_station", return_value=(MOCK_STATION, 80.0)):
        resp = client.get("/tide/at", params={"lat": 32.87, "lng": -117.26, "dt": "2024-05-01 12:00"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "too-far"
    assert data["station"]["id"] == "9410230"
    assert data["distanceMi"] == 80.0


def test_tide_at_too_far_override_forces_data():
    with (
        patch("routers.tide.nearest_station", return_value=(MOCK_STATION, 80.0)),
        patch("routers.tide.fetch_tides", new=AsyncMock(return_value=(OBS_BODY, PRED_BODY, HILO_BODY))),
    ):
        resp = client.get("/tide/at", params={"lat": 32.87, "lng": -117.26, "dt": "2024-05-01 12:00", "force": "true"})
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_tide_at_no_dt_uses_now():
    # Omitting dt resolves "now" in the location's timezone server-side (no caller
    # clock dependency); the lookup still succeeds.
    with (
        patch("routers.tide.nearest_station", return_value=(MOCK_STATION, 1.2)),
        patch("routers.tide.fetch_tides", new=AsyncMock(return_value=(OBS_BODY, PRED_BODY, HILO_BODY))),
    ):
        resp = client.get("/tide/at", params={"lat": 32.87, "lng": -117.26})
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_tide_at_outside_us():
    with patch("routers.tide.nearest_station", return_value=(MOCK_STATION, 5.0)):
        resp = client.get("/tide/at", params={"lat": 51.5, "lng": -0.12, "dt": "2024-05-01 12:00"})
    assert resp.status_code == 200
    assert resp.json()["status"] == "outside-us"


def test_tide_at_does_not_shadow_checklist_route():
    resp = client.get("/tide/notavalidid")
    assert resp.status_code == 400

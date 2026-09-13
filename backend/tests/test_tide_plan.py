"""GET /tide/plan -- the Weather/tide Planner's tide half (schema 4.3).

Route-level tests for THIS consumer: the deliberate OpenWeather-key guard with
zero NOAA calls behind it (D6 / FR-41), the notice shape with zero NOAA calls
for too-far and outside-US, the forced override making exactly two calls, the
`unavailable` verdict when both bodies are errors, the recorded NOAA params
(time_zone gmt, no water_level, dates derived from the frozen `_now` and never
from a request parameter), the range validation, and the /at trap in its
discriminating form. The builder's output is fixture-locked in
test_weather_tide_plan_parity.py.
"""

from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient

from main import app
from services import noaa

client = TestClient(app)

NOW = 1789252860  # 2026-09-12 22:41 UTC; PDT axis start 22:00 UTC
MOCK_STATION = {"id": "9413450", "name": "MONTEREY, MONTEREY BAY", "lat": 36.605, "lng": -121.888, "state": "CA", "obs": True}
FAR_STATION = {"id": "9413623", "name": "Elkhorn Slough, Highway 1 Bridge", "lat": 36.81, "lng": -121.78, "state": "CA", "obs": False}
PARAMS = {"lat": 36.603, "lng": -121.876}

PRED_BODY = {"predictions": [
    {"t": "2026-09-12 22:00", "v": "3.100"},
    {"t": "2026-09-12 22:30", "v": "3.400"},
    {"t": "2026-09-12 23:00", "v": "3.700"},
]}
HILO_BODY = {"predictions": [
    {"t": "2026-09-12 19:00", "v": "0.500", "type": "L"},
    {"t": "2026-09-13 01:00", "v": "5.200", "type": "H"},
]}
ERROR_BODY = {"error": {"message": "No data was found."}}


def _client_recording(bodies):
    """A get_client() double whose .get returns the given bodies in order and
    records every params dict, so the test can read exactly what would have
    reached NOAA."""
    calls = []

    async def get(url, params=None, timeout=None):
        calls.append({"url": url, "params": dict(params or {}), "timeout": timeout})
        resp = MagicMock()
        resp.json.return_value = bodies[len(calls) - 1]
        return resp

    inst = MagicMock()
    inst.get = AsyncMock(side_effect=get)
    return inst, calls


def test_no_key_is_500_and_makes_zero_noaa_calls(monkeypatch):
    monkeypatch.delenv("OPENWEATHER_API_KEY", raising=False)
    inst, calls = _client_recording([PRED_BODY, HILO_BODY])
    with (
        patch("routers.tide.nearest_station", return_value=(MOCK_STATION, 0.9)),
        patch("services.noaa.get_client", return_value=inst),
    ):
        resp = client.get("/tide/plan", params=PARAMS)
    assert resp.status_code == 500
    assert "API key not configured" in resp.json()["detail"]
    assert calls == []


def test_too_far_and_outside_us_return_the_notice_with_zero_noaa_calls(monkeypatch):
    monkeypatch.setenv("OPENWEATHER_API_KEY", "k")
    inst, calls = _client_recording([PRED_BODY, HILO_BODY])
    with (
        patch("routers.tide._now", return_value=NOW),
        patch("routers.tide.nearest_station", return_value=(FAR_STATION, 58.0)),
        patch("services.noaa.get_client", return_value=inst),
    ):
        far = client.get("/tide/plan", params={"lat": 36.612, "lng": -120.834}).json()
        outside = client.get("/tide/plan", params={"lat": 51.5, "lng": -0.12}).json()
    assert far == {"status": "too-far", "station": {"id": FAR_STATION["id"], "name": FAR_STATION["name"]}, "distanceMi": 58.0}
    assert outside == {"status": "outside-us", "station": {"id": FAR_STATION["id"], "name": FAR_STATION["name"]}, "distanceMi": 58.0}
    assert calls == []


def test_force_makes_exactly_two_gmt_calls_with_no_water_level(monkeypatch):
    monkeypatch.setenv("OPENWEATHER_API_KEY", "k")
    inst, calls = _client_recording([PRED_BODY, HILO_BODY])
    with (
        patch("routers.tide._now", return_value=NOW),
        patch("routers.tide.nearest_station", return_value=(FAR_STATION, 58.0)),
        patch("services.noaa.get_client", return_value=inst),
    ):
        resp = client.get("/tide/plan", params={"lat": 36.612, "lng": -120.834, "force": "true"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok" and data["source"] == "predicted"
    assert data["station"] == {"id": FAR_STATION["id"], "name": FAR_STATION["name"]}
    assert len(calls) == 2
    products = sorted((c["params"]["product"], c["params"].get("interval")) for c in calls)
    assert products == [("predictions", "6"), ("predictions", "hilo")]
    for c in calls:
        assert c["url"] == noaa.NOAA
        assert c["params"]["time_zone"] == "gmt"
        assert c["params"]["station"] == FAR_STATION["id"]
        assert c["params"]["datum"] == "MLLW"
        assert c["timeout"] == 10.0
    assert all(c["params"]["product"] != "water_level" for c in calls)


def test_dates_derive_from_the_frozen_clock_and_never_from_a_parameter(monkeypatch):
    monkeypatch.setenv("OPENWEATHER_API_KEY", "k")
    inst, calls = _client_recording([PRED_BODY, HILO_BODY])
    with (
        patch("routers.tide._now", return_value=NOW),
        patch("routers.tide.nearest_station", return_value=(MOCK_STATION, 0.9)),
        patch("services.noaa.get_client", return_value=inst),
    ):
        resp = client.get("/tide/plan", params={**PARAMS, "begin_date": "19000101 00:00", "end_date": "21000101 00:00", "start": "x", "days": 99})
    assert resp.status_code == 200
    cont = next(c for c in calls if c["params"]["interval"] == "6")
    hilo = next(c for c in calls if c["params"]["interval"] == "hilo")
    # Axis start: the current PDT hour, 22:00 UTC. Tide end: the end of the
    # eighth day after 2026-09-12 (Sep 20 23:59 PDT = Sep 21 06:59 UTC).
    assert cont["params"]["begin_date"] == "20260912 22:00"
    assert cont["params"]["end_date"] == "20260921 06:59"
    assert hilo["params"]["begin_date"] == "20260911 22:00"
    assert hilo["params"]["end_date"] == "20260922 06:59"
    data = resp.json()
    assert data["range"] == {"startTs": NOW - 41 * 60, "endTs": 1789973999}


def test_both_bodies_error_is_unavailable(monkeypatch):
    monkeypatch.setenv("OPENWEATHER_API_KEY", "k")
    inst, calls = _client_recording([ERROR_BODY, ERROR_BODY])
    with (
        patch("routers.tide._now", return_value=NOW),
        patch("routers.tide.nearest_station", return_value=(MOCK_STATION, 0.9)),
        patch("services.noaa.get_client", return_value=inst),
    ):
        resp = client.get("/tide/plan", params=PARAMS)
    assert resp.status_code == 200
    assert resp.json() == {"status": "unavailable"}
    assert len(calls) == 2


def test_a_noaa_transport_failure_reads_as_unavailable_not_502(monkeypatch):
    monkeypatch.setenv("OPENWEATHER_API_KEY", "k")
    inst = MagicMock()
    inst.get = AsyncMock(side_effect=RuntimeError("connection refused"))
    with (
        patch("routers.tide._now", return_value=NOW),
        patch("routers.tide.nearest_station", return_value=(MOCK_STATION, 0.9)),
        patch("services.noaa.get_client", return_value=inst),
    ):
        resp = client.get("/tide/plan", params=PARAMS)
    assert resp.status_code == 200
    assert resp.json() == {"status": "unavailable"}


def test_a_subordinate_station_is_ok_with_interpolated_samples(monkeypatch):
    monkeypatch.setenv("OPENWEATHER_API_KEY", "k")
    inst, _ = _client_recording([ERROR_BODY, HILO_BODY])
    with (
        patch("routers.tide._now", return_value=NOW),
        patch("routers.tide.nearest_station", return_value=(MOCK_STATION, 0.9)),
        patch("services.noaa.get_client", return_value=inst),
    ):
        data = client.get("/tide/plan", params=PARAMS).json()
    assert data["status"] == "ok" and data["continuous"] is False
    assert data["curve"] and all(s["hilo"] is True for s in data["curve"])
    assert [p["kind"] for p in data["turningPoints"]] == ["low", "high"]
    assert data["turningPoints"][0]["local"] == "2026-09-12 12:00"


def test_out_of_range_coordinates_are_422_before_any_request(monkeypatch):
    monkeypatch.setenv("OPENWEATHER_API_KEY", "k")
    inst, calls = _client_recording([PRED_BODY, HILO_BODY])
    with patch("services.noaa.get_client", return_value=inst):
        for bad in ({"lat": 91, "lng": 0}, {"lat": 0, "lng": 181}, {"lat": "x", "lng": 0}):
            assert client.get("/tide/plan", params=bad).status_code == 422, bad
    assert calls == []


def test_bare_plan_path_is_validation_not_the_checklist_id_route():
    resp = client.get("/tide/plan")
    assert resp.status_code == 422
    assert "checklist ID" not in resp.text


def test_the_checklist_route_still_answers_a_real_looking_id():
    resp = client.get("/tide/notavalidid")
    assert resp.status_code == 400


# ── A JSON-valid but semantically malformed NOAA body (the Auditor's Low,
# closed): a predictions list holding non-objects raises inside the builder and
# reads as `unavailable`, the same honest state as an unreadable body, never a
# plain-text 500.
def test_a_predictions_list_of_non_objects_is_unavailable_never_a_500(monkeypatch):
    monkeypatch.setenv("OPENWEATHER_API_KEY", "k")
    for pred, hilo in (({"predictions": ["x", None, 5]}, HILO_BODY), (PRED_BODY, {"predictions": [None, 3]})):
        inst, _ = _client_recording([pred, hilo])
        with (
            patch("routers.tide._now", return_value=NOW),
            patch("routers.tide.nearest_station", return_value=(MOCK_STATION, 0.9)),
            patch("services.noaa.get_client", return_value=inst),
        ):
            resp = client.get("/tide/plan", params=PARAMS)
        assert resp.status_code == 200
        assert resp.json() == {"status": "unavailable"}

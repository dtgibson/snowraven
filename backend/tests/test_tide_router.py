from unittest.mock import AsyncMock, patch
from urllib.parse import unquote

from fastapi.testclient import TestClient

from main import app

client = TestClient(app)

# A coastal checklist (San Francisco Bay) so the bundled nearest-station lookup
# resolves a real US station within range.
MOCK_CHECKLIST = {
    "obs_dt": "2025-08-02 07:42",
    "loc_name": "Pillar Point Harbor",
    "lat": 37.806,
    "lng": -122.465,
    "duration_hrs": 1,
}

OBS_BODY = {"data": [
    {"t": "2025-08-02 07:42", "v": "3.2", "q": "v"},
    {"t": "2025-08-02 08:42", "v": "4.1", "q": "v"},
]}
PRED_BODY = {"predictions": [{"t": "2025-08-02 08:00", "v": "3.6"}]}
HILO_BODY = {"predictions": [
    {"t": "2025-08-02 05:02", "v": "0.6", "type": "L"},
    {"t": "2025-08-02 11:18", "v": "5.1", "type": "H"},
]}


def test_invalid_id():
    resp = client.get("/tide/not-an-id")
    assert resp.status_code == 400


def test_missing_ebird_key(monkeypatch):
    monkeypatch.delenv("EBIRD_API_KEY", raising=False)
    resp = client.get("/tide/S12345678")
    assert resp.status_code == 500
    assert "API key not configured" in resp.json()["detail"]


def test_successful_observed(monkeypatch):
    monkeypatch.setenv("EBIRD_API_KEY", "test-key")
    with (
        patch("routers.tide.fetch_checklist", new=AsyncMock(return_value=MOCK_CHECKLIST)),
        patch("routers.tide.fetch_tides", new=AsyncMock(return_value=(OBS_BODY, PRED_BODY, HILO_BODY))),
    ):
        resp = client.get("/tide/S12345678")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert "🌊" in data["formatted"]
    assert "Observed" in data["formatted"]
    assert "Water level: 3.2 – 4.1 ft" in data["formatted"]
    assert "Tide: Rising" in data["formatted"]
    assert "SnowRaven" in data["formatted"]
    # body keeps the NOAA credit but NOT the SnowRaven attribution (for combined copy)
    assert data["body"].rstrip().endswith("Tide data from NOAA CO-OPS")
    assert data["checklist_id"] == "S12345678"


def test_predicted_fallback(monkeypatch):
    monkeypatch.setenv("EBIRD_API_KEY", "test-key")
    no_obs = {"error": {"message": "No data was found."}}
    with (
        patch("routers.tide.fetch_checklist", new=AsyncMock(return_value=MOCK_CHECKLIST)),
        patch("routers.tide.fetch_tides", new=AsyncMock(return_value=(no_obs, PRED_BODY, HILO_BODY))),
    ):
        resp = client.get("/tide/S12345678")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"
    assert "Predicted" in resp.json()["formatted"]


def test_subordinate_station_interpolates_from_hilo(monkeypatch):
    # Subordinate stations serve only hilo: observed AND continuous predictions
    # both error; the level is interpolated from the high/low curve.
    monkeypatch.setenv("EBIRD_API_KEY", "test-key")
    err = {"error": {"message": "No data was found."}}
    pred_err = {"error": {"message": "No Predictions data was found."}}
    with (
        patch("routers.tide.fetch_checklist", new=AsyncMock(return_value=MOCK_CHECKLIST)),
        patch("routers.tide.fetch_tides", new=AsyncMock(return_value=(err, pred_err, HILO_BODY))),
    ):
        resp = client.get("/tide/S12345678")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert "Predicted" in data["formatted"]
    assert "Water level:" in data["formatted"]


def test_outside_us_notice(monkeypatch):
    monkeypatch.setenv("EBIRD_API_KEY", "test-key")
    london = {**MOCK_CHECKLIST, "lat": 51.5, "lng": -0.12}
    with patch("routers.tide.fetch_checklist", new=AsyncMock(return_value=london)):
        resp = client.get("/tide/S12345678")
    assert resp.status_code == 200
    assert resp.json()["status"] == "outside-us"
    assert "station" in resp.json()


def test_too_far_notice(monkeypatch):
    monkeypatch.setenv("EBIRD_API_KEY", "test-key")
    denver = {**MOCK_CHECKLIST, "lat": 39.74, "lng": -104.99}
    with patch("routers.tide.fetch_checklist", new=AsyncMock(return_value=denver)):
        resp = client.get("/tide/S12345678")
    assert resp.status_code == 200
    assert resp.json()["status"] == "too-far"


def test_force_override_outside_us(monkeypatch):
    monkeypatch.setenv("EBIRD_API_KEY", "test-key")
    london = {**MOCK_CHECKLIST, "lat": 51.5, "lng": -0.12}
    with (
        patch("routers.tide.fetch_checklist", new=AsyncMock(return_value=london)),
        patch("routers.tide.fetch_tides", new=AsyncMock(return_value=(OBS_BODY, PRED_BODY, HILO_BODY))),
    ):
        resp = client.get("/tide/S12345678?force=true")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_checklist_not_found(monkeypatch):
    monkeypatch.setenv("EBIRD_API_KEY", "test-key")
    with patch("routers.tide.fetch_checklist", new=AsyncMock(side_effect=LookupError("Checklist not found. Check the ID and try again."))):
        resp = client.get("/tide/S99999999")
    assert resp.status_code == 400
    assert "not found" in resp.json()["detail"]


# --- Checklist-id shape guard (backend-guard-anchor-parity, finding 2) -----
# The guard itself is single-sourced on services.ebird.CHECKLIST_ID_RE and its
# cross-transport behavior is locked by the shared fixture in
# tests/test_checklist_id_parity.py. This is the ROUTE-level half: single-sourcing
# prevents the two copies DRIFTING, it does nothing to prevent one being DROPPED,
# so each router keeps its own test that the guard is still applied here.

def test_unicode_digit_id_rejected_at_the_route(monkeypatch):
    """`S` + Arabic-Indic 012 (U+0660..U+0662). Python's `\\d` is Unicode-aware,
    so the old `re.fullmatch(r"S\\d+", ...)` let this through while the frontend
    twin `/^S\\d+$/` rejected it.

    The key is present and fetch_checklist is mocked, so a 400 can only come from
    the shape guard: reverting `[0-9]` to `\\d` makes the request reach the
    checklist fetch, which turns both assertions red."""
    monkeypatch.setenv("EBIRD_API_KEY", "test-key")
    fetch = AsyncMock(return_value=MOCK_CHECKLIST)
    with patch("routers.tide.fetch_checklist", new=fetch):
        resp = client.get("/tide/S\u0660\u0661\u0662")
    assert resp.status_code == 400
    assert "valid eBird checklist ID" in resp.json()["detail"]
    fetch.assert_not_awaited()


def test_ascii_digit_id_still_reaches_the_fetch(monkeypatch):
    """The other direction: the guard rejects only what it always claimed to."""
    monkeypatch.setenv("EBIRD_API_KEY", "test-key")
    fetch = AsyncMock(return_value=MOCK_CHECKLIST)
    with (
        patch("routers.tide.fetch_checklist", new=fetch),
        patch("routers.tide.fetch_tides", new=AsyncMock(return_value=(OBS_BODY, PRED_BODY, HILO_BODY))),
    ):
        resp = client.get("/tide/S12345678")
    assert resp.status_code == 200
    fetch.assert_awaited_once()


def test_malformed_id_shapes_rejected_at_the_route(monkeypatch):
    """Shape rejection asserted AT THE CALL SITE, not at the pattern.

    The trailing-newline row is the one that matters and it is why this test
    mocks: the shared fixture and the parity test's helper pin the PATTERN, so
    mutating both routers to `CHECKLIST_ID_RE.match(...)` left the whole suite
    green while `GET /tide/S123%0A` genuinely passed the guard (Python's `$`
    matches before a trailing newline). Reverting either call site to `.match()`
    turns this red.

    `%0A` is a URL escape rather than a literal newline in this source, and the
    decoded value is pinned below so a future edit cannot quietly turn it into an
    ordinary id. Verified out-of-band that it survives routing: the handler
    receives "S123" + chr(10) rather than the request 404ing first."""
    monkeypatch.setenv("EBIRD_API_KEY", "test-key")
    assert unquote("S123%0A") == "S123" + chr(10)

    fetch = AsyncMock(return_value=MOCK_CHECKLIST)
    with patch("routers.tide.fetch_checklist", new=fetch):
        for bad in ("not-an-id", "s12345678", "L12345678", "S", "12345678", "S123%0A", "%0AS123"):
            assert client.get(f"/tide/{bad}").status_code == 400, bad
    # The key is set and the fetch is mocked, so a 400 above can only be the shape
    # guard; this pins that none of these reached the checklist fetch.
    fetch.assert_not_awaited()

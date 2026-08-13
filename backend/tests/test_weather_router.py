from unittest.mock import AsyncMock, patch
from urllib.parse import unquote

from fastapi.testclient import TestClient

from main import app

client = TestClient(app)

MOCK_CHECKLIST = {
    "obs_dt": "2024-05-01 06:30",
    "loc_name": "Central Park",
    "lat": 40.7128,
    "lng": -74.0060,
    "duration_hrs": 1,
}

MOCK_OWM_RESPONSE = {
    "data": [{
        "dt": 1714559400,  # 2024-05-01 06:30 ET — between sunrise and sunset → day
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

# Same hour sampled before sunrise → a night block (moon phase appended).
MOCK_OWM_NIGHT_RESPONSE = {
    "data": [{**MOCK_OWM_RESPONSE["data"][0], "dt": 1714550000}]
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
    # Day checklist: condition emoji alone on line 1, no moon phase.
    assert data["formatted"].startswith("☁️\n")
    assert data["checklist_id"] == "S12345678"
    assert data["loc_name"] == "Central Park"
    assert data["obs_dt"] == "2024-05-01 06:30"


def test_night_checklist_appends_moon_phase(monkeypatch):
    monkeypatch.setenv("EBIRD_API_KEY", "test-key")
    monkeypatch.setenv("OPENWEATHER_API_KEY", "test-key")
    with (
        patch("routers.weather.fetch_checklist", new=AsyncMock(return_value=MOCK_CHECKLIST)),
        patch("routers.weather.fetch_historical", new=AsyncMock(return_value=MOCK_OWM_NIGHT_RESPONSE)),
    ):
        resp = client.get("/weather/S12345678")
    assert resp.status_code == 200
    data = resp.json()
    # Night checklist (dt before sunrise): the moon-phase emoji is appended to
    # the condition emoji on line 1, UNSPACED (dt 1714550000 → Last Quarter 🌗
    # for the Northern Hemisphere lat in MOCK_CHECKLIST).
    assert data["formatted"].startswith("☁️🌗\n")
    assert "SnowRaven" in data["formatted"]


def test_confirmation_fields_date_only(monkeypatch):
    monkeypatch.setenv("EBIRD_API_KEY", "test-key")
    monkeypatch.setenv("OPENWEATHER_API_KEY", "test-key")
    date_only_checklist = {**MOCK_CHECKLIST, "obs_dt": "2024-05-01"}
    with (
        patch("routers.weather.fetch_checklist", new=AsyncMock(return_value=date_only_checklist)),
        patch("routers.weather.fetch_historical", new=AsyncMock(return_value=MOCK_OWM_RESPONSE)),
    ):
        resp = client.get("/weather/S12345678")
    assert resp.status_code == 200
    data = resp.json()
    assert data["obs_dt"] == "2024-05-01"
    assert data["checklist_id"] == "S12345678"
    assert data["loc_name"] == "Central Park"


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

    The keys are present and fetch_checklist is mocked, so a 400 can only come
    from the shape guard: reverting `[0-9]` to `\\d` makes the request reach the
    checklist fetch, which turns both assertions red."""
    monkeypatch.setenv("EBIRD_API_KEY", "test-key")
    monkeypatch.setenv("OPENWEATHER_API_KEY", "test-key")
    fetch = AsyncMock(return_value=MOCK_CHECKLIST)
    with patch("routers.weather.fetch_checklist", new=fetch):
        resp = client.get("/weather/S\u0660\u0661\u0662")
    assert resp.status_code == 400
    assert "valid eBird checklist ID" in resp.json()["detail"]
    fetch.assert_not_awaited()


def test_ascii_digit_id_still_reaches_the_fetch(monkeypatch):
    """The other direction: the guard rejects only what it always claimed to."""
    monkeypatch.setenv("EBIRD_API_KEY", "test-key")
    monkeypatch.setenv("OPENWEATHER_API_KEY", "test-key")
    fetch = AsyncMock(return_value=MOCK_CHECKLIST)
    with (
        patch("routers.weather.fetch_checklist", new=fetch),
        patch("routers.weather.fetch_historical", new=AsyncMock(return_value=MOCK_OWM_RESPONSE)),
    ):
        resp = client.get("/weather/S12345678")
    assert resp.status_code == 200
    fetch.assert_awaited_once()


def test_malformed_id_shapes_rejected_at_the_route(monkeypatch):
    """Shape rejection asserted AT THE CALL SITE, not at the pattern.

    The trailing-newline row is the one that matters and it is why this test
    mocks: the shared fixture and the parity test's helper pin the PATTERN, so
    mutating both routers to `CHECKLIST_ID_RE.match(...)` left the whole suite
    green while `GET /weather/S123%0A` genuinely passed the guard (Python's `$`
    matches before a trailing newline). Reverting either call site to `.match()`
    turns this red.

    `%0A` is a URL escape rather than a literal newline in this source, and the
    decoded value is pinned below so a future edit cannot quietly turn it into an
    ordinary id. Verified out-of-band that it survives routing: the handler
    receives "S123" + chr(10) rather than the request 404ing first."""
    monkeypatch.setenv("EBIRD_API_KEY", "test-key")
    monkeypatch.setenv("OPENWEATHER_API_KEY", "test-key")
    assert unquote("S123%0A") == "S123" + chr(10)

    fetch = AsyncMock(return_value=MOCK_CHECKLIST)
    with patch("routers.weather.fetch_checklist", new=fetch):
        for bad in ("not-an-id", "s12345678", "L12345678", "S", "12345678", "S123%0A", "%0AS123"):
            assert client.get(f"/weather/{bad}").status_code == 400, bad
    # Keys are set and the fetch is mocked, so a 400 above can only be the shape
    # guard; this pins that none of these reached the checklist fetch.
    fetch.assert_not_awaited()


def test_health():
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}

from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient

from main import app

client = TestClient(app)

# Three species across two locations; one species (chickadee) appears twice
# at the same location so grouping/checklistCount can be exercised.
MOCK_EBIRD_RESPONSE = [
    {
        "speciesCode": "bkcchi",
        "comName": "Black-capped Chickadee",
        "locId": "L100",
        "locName": "Park",
        "lat": 44.9,
        "lng": -93.0,
        "obsDt": "2026-05-20 08:00",
        "subId": "S1",
    },
    {
        "speciesCode": "bkcchi",
        "comName": "Black-capped Chickadee",
        "locId": "L100",
        "locName": "Park",
        "lat": 44.9,
        "lng": -93.0,
        "obsDt": "2026-05-22 07:00",
        "subId": "S2",
    },
    {
        "speciesCode": "amerob",
        "comName": "American Robin",
        "locId": "L200",
        "locName": "Lake",
        "lat": 45.0,
        "lng": -93.1,
        "obsDt": "2026-05-21 09:00",
        "subId": "S3",
    },
    {
        "speciesCode": "norcar",
        "comName": "Northern Cardinal",
        "locId": "L300",
        "locName": "Yard",
        "lat": 45.1,
        "lng": -93.2,
        "obsDt": "2026-05-19 06:00",
        "subId": "S4",
    },
]


def _mock_client(json_data):
    # httpx.Response.json() is synchronous — use MagicMock so it returns data directly
    mock_resp = MagicMock()
    mock_resp.json.return_value = json_data
    mock_resp.raise_for_status = MagicMock()

    instance = AsyncMock()
    instance.get.return_value = mock_resp
    instance.__aenter__ = AsyncMock(return_value=instance)
    instance.__aexit__ = AsyncMock(return_value=False)
    return instance


# ── Missing API key (401) ─────────────────────────────────────────────────────

def test_recent_obs_missing_api_key(monkeypatch):
    monkeypatch.delenv("EBIRD_API_KEY", raising=False)
    resp = client.get("/map/recent-obs?lat=44.9&lng=-93.0&dist=25")
    assert resp.status_code == 401
    assert "key" in resp.json()["detail"].lower()


# ── Empty / omitted codes ⇒ ALL species in the radius ─────────────────────────

def test_recent_obs_omitted_codes_returns_all_species(monkeypatch):
    monkeypatch.setenv("EBIRD_API_KEY", "test-key")
    with patch("routers.map.httpx.AsyncClient") as MockClient:
        MockClient.return_value = _mock_client(MOCK_EBIRD_RESPONSE)
        resp = client.get("/map/recent-obs?lat=44.9&lng=-93.0&dist=25")

    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    # All three species returned (chickadee grouped to one entry), not []
    codes = sorted(r["speciesCode"] for r in data)
    assert codes == ["amerob", "bkcchi", "norcar"]
    assert len(data) == 3


def test_recent_obs_empty_codes_returns_all_species(monkeypatch):
    monkeypatch.setenv("EBIRD_API_KEY", "test-key")
    with patch("routers.map.httpx.AsyncClient") as MockClient:
        MockClient.return_value = _mock_client(MOCK_EBIRD_RESPONSE)
        resp = client.get("/map/recent-obs?lat=44.9&lng=-93.0&dist=25&codes=")

    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 3
    assert {r["speciesCode"] for r in data} == {"bkcchi", "amerob", "norcar"}


def test_recent_obs_whitespace_only_codes_returns_all_species(monkeypatch):
    # codes consisting only of commas/whitespace collapses to no filter
    monkeypatch.setenv("EBIRD_API_KEY", "test-key")
    with patch("routers.map.httpx.AsyncClient") as MockClient:
        MockClient.return_value = _mock_client(MOCK_EBIRD_RESPONSE)
        resp = client.get("/map/recent-obs?lat=44.9&lng=-93.0&dist=25&codes=%20,%20,")

    assert resp.status_code == 200
    assert len(resp.json()) == 3


# ── With codes ⇒ still filters (Media Targets contract) ───────────────────────

def test_recent_obs_with_codes_filters_to_requested_species(monkeypatch):
    monkeypatch.setenv("EBIRD_API_KEY", "test-key")
    with patch("routers.map.httpx.AsyncClient") as MockClient:
        MockClient.return_value = _mock_client(MOCK_EBIRD_RESPONSE)
        resp = client.get(
            "/map/recent-obs?lat=44.9&lng=-93.0&dist=25&codes=amerob,norcar"
        )

    assert resp.status_code == 200
    data = resp.json()
    codes = sorted(r["speciesCode"] for r in data)
    assert codes == ["amerob", "norcar"]
    # bkcchi was filtered out
    assert all(r["speciesCode"] != "bkcchi" for r in data)


def test_recent_obs_with_single_code_filters(monkeypatch):
    monkeypatch.setenv("EBIRD_API_KEY", "test-key")
    with patch("routers.map.httpx.AsyncClient") as MockClient:
        MockClient.return_value = _mock_client(MOCK_EBIRD_RESPONSE)
        resp = client.get("/map/recent-obs?lat=44.9&lng=-93.0&dist=25&codes=bkcchi")

    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["speciesCode"] == "bkcchi"


# ── Grouping / shape (unchanged by the codes change) ──────────────────────────

def test_recent_obs_groups_by_species_and_loc_keeps_most_recent(monkeypatch):
    monkeypatch.setenv("EBIRD_API_KEY", "test-key")
    with patch("routers.map.httpx.AsyncClient") as MockClient:
        MockClient.return_value = _mock_client(MOCK_EBIRD_RESPONSE)
        resp = client.get("/map/recent-obs?lat=44.9&lng=-93.0&dist=25")

    data = resp.json()
    chickadee = next(r for r in data if r["speciesCode"] == "bkcchi")
    # Two checklists at the same (code, locId) group into one entry
    assert chickadee["checklistCount"] == 2
    # Most-recent date and its subId are retained
    assert chickadee["recentDate"] == "2026-05-22 07:00"
    assert chickadee["subId"] == "S2"
    # Response shape preserved
    for field in (
        "speciesCode",
        "comName",
        "locId",
        "locName",
        "lat",
        "lng",
        "recentDate",
        "checklistCount",
        "subId",
    ):
        assert field in chickadee


def test_recent_obs_empty_ebird_response(monkeypatch):
    monkeypatch.setenv("EBIRD_API_KEY", "test-key")
    with patch("routers.map.httpx.AsyncClient") as MockClient:
        MockClient.return_value = _mock_client([])
        resp = client.get("/map/recent-obs?lat=44.9&lng=-93.0&dist=25")

    assert resp.status_code == 200
    assert resp.json() == []


# ── Coordinate / distance bounds (restored from the removed /stats/nemesis) ───
# Out-of-range params fail validation (422) before any eBird call is made.

def test_recent_obs_rejects_out_of_range_lat():
    resp = client.get("/map/recent-obs?lat=999&lng=-93.0&dist=25")
    assert resp.status_code == 422


def test_recent_obs_rejects_out_of_range_lng():
    resp = client.get("/map/recent-obs?lat=44.9&lng=999&dist=25")
    assert resp.status_code == 422


def test_recent_obs_rejects_out_of_range_dist():
    resp = client.get("/map/recent-obs?lat=44.9&lng=-93.0&dist=99999")
    assert resp.status_code == 422


# ── /map/hotspot-region (public-hotspot Set source) ───────────────────────────

MOCK_REGION_HOTSPOTS = [
    {"locId": "L100", "locName": "Park", "lat": 44.9, "lng": -93.0},
    {"locId": "L200", "locName": "Lake", "lat": 45.0, "lng": -93.1},
    {"locName": "No id here", "lat": 1.0, "lng": 2.0},  # missing locId → skipped
]


def test_hotspot_region_missing_api_key(monkeypatch):
    monkeypatch.delenv("EBIRD_API_KEY", raising=False)
    resp = client.get("/map/hotspot-region?regionCode=US-CA")
    assert resp.status_code == 401
    assert "key" in resp.json()["detail"].lower()


def test_hotspot_region_returns_locids_only(monkeypatch):
    monkeypatch.setenv("EBIRD_API_KEY", "test-key")
    with patch("routers.map.httpx.AsyncClient") as MockClient:
        MockClient.return_value = _mock_client(MOCK_REGION_HOTSPOTS)
        resp = client.get("/map/hotspot-region?regionCode=US-CA")
    assert resp.status_code == 200
    # Just the ids, and the id-less entry is dropped.
    assert resp.json() == ["L100", "L200"]


def test_hotspot_region_rejects_malformed_region():
    # Lowercase / junk fails the pattern before any eBird call.
    resp = client.get("/map/hotspot-region?regionCode=not-a-region")
    assert resp.status_code == 422


def test_hotspot_region_api_error_is_502(monkeypatch):
    import httpx

    monkeypatch.setenv("EBIRD_API_KEY", "test-key")
    instance = AsyncMock()
    request = httpx.Request("GET", "https://api.ebird.org/v2/ref/hotspot/US-CA")
    response = httpx.Response(500, request=request)
    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock(
        side_effect=httpx.HTTPStatusError("err", request=request, response=response)
    )
    instance.get.return_value = mock_resp
    instance.__aenter__ = AsyncMock(return_value=instance)
    instance.__aexit__ = AsyncMock(return_value=False)
    with patch("routers.map.httpx.AsyncClient") as MockClient:
        MockClient.return_value = instance
        resp = client.get("/map/hotspot-region?regionCode=US-CA")
    assert resp.status_code == 502

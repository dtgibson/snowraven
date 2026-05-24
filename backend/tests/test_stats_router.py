from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient

from main import app

client = TestClient(app)

MOCK_EBIRD_RESPONSE = [
    {"comName": "Black-capped Chickadee", "obsDt": "2026-05-20 08:00"},
    {"comName": "American Robin", "obsDt": "2026-05-21 09:00"},
    {"comName": "Black-capped Chickadee", "obsDt": "2026-05-22 07:00"},
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


# ── Validation (400) ──────────────────────────────────────────────────────────

def test_nemesis_missing_required_param(monkeypatch):
    monkeypatch.setenv("EBIRD_API_KEY", "test-key")
    resp = client.get("/stats/nemesis?lng=-93.0&dist=25")
    assert resp.status_code == 422  # FastAPI rejects missing Query param


def test_nemesis_lat_too_high(monkeypatch):
    monkeypatch.setenv("EBIRD_API_KEY", "test-key")
    resp = client.get("/stats/nemesis?lat=91&lng=-93.0&dist=25")
    assert resp.status_code == 400


def test_nemesis_lat_too_low(monkeypatch):
    monkeypatch.setenv("EBIRD_API_KEY", "test-key")
    resp = client.get("/stats/nemesis?lat=-91&lng=-93.0&dist=25")
    assert resp.status_code == 400


def test_nemesis_lng_too_high(monkeypatch):
    monkeypatch.setenv("EBIRD_API_KEY", "test-key")
    resp = client.get("/stats/nemesis?lat=44.9&lng=181&dist=25")
    assert resp.status_code == 400


def test_nemesis_lng_too_low(monkeypatch):
    monkeypatch.setenv("EBIRD_API_KEY", "test-key")
    resp = client.get("/stats/nemesis?lat=44.9&lng=-181&dist=25")
    assert resp.status_code == 400


def test_nemesis_dist_zero(monkeypatch):
    monkeypatch.setenv("EBIRD_API_KEY", "test-key")
    resp = client.get("/stats/nemesis?lat=44.9&lng=-93.0&dist=0")
    assert resp.status_code == 400


def test_nemesis_dist_too_high(monkeypatch):
    monkeypatch.setenv("EBIRD_API_KEY", "test-key")
    resp = client.get("/stats/nemesis?lat=44.9&lng=-93.0&dist=201")
    assert resp.status_code == 400


# ── Missing API key (503) ─────────────────────────────────────────────────────

def test_nemesis_missing_api_key(monkeypatch):
    monkeypatch.delenv("EBIRD_API_KEY", raising=False)
    resp = client.get("/stats/nemesis?lat=44.9&lng=-93.0&dist=25")
    assert resp.status_code == 503
    assert "key" in resp.json()["detail"].lower()


# ── Success shape ─────────────────────────────────────────────────────────────

def test_nemesis_success_returns_species_list(monkeypatch):
    monkeypatch.setenv("EBIRD_API_KEY", "test-key")
    with patch("routers.stats.httpx.AsyncClient") as MockClient:
        MockClient.return_value = _mock_client(MOCK_EBIRD_RESPONSE)
        resp = client.get("/stats/nemesis?lat=44.9&lng=-93.0&dist=25")

    assert resp.status_code == 200
    data = resp.json()
    assert "species" in data
    assert isinstance(data["species"], list)


def test_nemesis_deduplicates_by_common_name(monkeypatch):
    monkeypatch.setenv("EBIRD_API_KEY", "test-key")
    with patch("routers.stats.httpx.AsyncClient") as MockClient:
        MockClient.return_value = _mock_client(MOCK_EBIRD_RESPONSE)
        resp = client.get("/stats/nemesis?lat=44.9&lng=-93.0&dist=25")

    species = resp.json()["species"]
    names = [s["commonName"] for s in species]
    # Black-capped Chickadee appears twice in mock — should be deduplicated
    assert names.count("Black-capped Chickadee") == 1


def test_nemesis_keeps_most_recent_date(monkeypatch):
    monkeypatch.setenv("EBIRD_API_KEY", "test-key")
    with patch("routers.stats.httpx.AsyncClient") as MockClient:
        MockClient.return_value = _mock_client(MOCK_EBIRD_RESPONSE)
        resp = client.get("/stats/nemesis?lat=44.9&lng=-93.0&dist=25")

    species = resp.json()["species"]
    chickadee = next(s for s in species if s["commonName"] == "Black-capped Chickadee")
    assert chickadee["recentDate"] == "2026-05-22"


def test_nemesis_response_fields_present(monkeypatch):
    monkeypatch.setenv("EBIRD_API_KEY", "test-key")
    with patch("routers.stats.httpx.AsyncClient") as MockClient:
        MockClient.return_value = _mock_client([
            {"comName": "American Robin", "obsDt": "2026-05-21 09:00"},
        ])
        resp = client.get("/stats/nemesis?lat=44.9&lng=-93.0&dist=25")

    species = resp.json()["species"]
    assert len(species) == 1
    assert "commonName" in species[0]
    assert "recentDate" in species[0]
    assert species[0]["recentDate"] == "2026-05-21"


def test_nemesis_empty_response(monkeypatch):
    monkeypatch.setenv("EBIRD_API_KEY", "test-key")
    with patch("routers.stats.httpx.AsyncClient") as MockClient:
        MockClient.return_value = _mock_client([])
        resp = client.get("/stats/nemesis?lat=44.9&lng=-93.0&dist=25")

    assert resp.status_code == 200
    assert resp.json()["species"] == []

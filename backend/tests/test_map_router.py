from unittest.mock import AsyncMock, MagicMock, patch

import httpx

import pytest
from fastapi.testclient import TestClient

import routers.map as map_module
from main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def _clear_recent_obs_cache():
    """The codes-independent recent-obs cache (TIDY #3) persists across calls in
    the process, keyed (lat, lng, dist). Clear it before AND after each test so a
    prior test's cached radius fetch can't satisfy the next test's request (which
    would skip its mock and assert against stale data)."""
    map_module._recent_obs_cache.clear()
    map_module._recent_obs_inflight.clear()
    yield
    map_module._recent_obs_cache.clear()
    map_module._recent_obs_inflight.clear()

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
    with patch("routers.map.get_client", return_value=_mock_client(MOCK_EBIRD_RESPONSE)):
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
    with patch("routers.map.get_client", return_value=_mock_client(MOCK_EBIRD_RESPONSE)):
        resp = client.get("/map/recent-obs?lat=44.9&lng=-93.0&dist=25&codes=")

    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 3
    assert {r["speciesCode"] for r in data} == {"bkcchi", "amerob", "norcar"}


def test_recent_obs_whitespace_only_codes_returns_all_species(monkeypatch):
    # codes consisting only of commas/whitespace collapses to no filter
    monkeypatch.setenv("EBIRD_API_KEY", "test-key")
    with patch("routers.map.get_client", return_value=_mock_client(MOCK_EBIRD_RESPONSE)):
        resp = client.get("/map/recent-obs?lat=44.9&lng=-93.0&dist=25&codes=%20,%20,")

    assert resp.status_code == 200
    assert len(resp.json()) == 3


# ── With codes ⇒ still filters (Media Targets contract) ───────────────────────

def test_recent_obs_with_codes_filters_to_requested_species(monkeypatch):
    monkeypatch.setenv("EBIRD_API_KEY", "test-key")
    with patch("routers.map.get_client", return_value=_mock_client(MOCK_EBIRD_RESPONSE)):
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
    with patch("routers.map.get_client", return_value=_mock_client(MOCK_EBIRD_RESPONSE)):
        resp = client.get("/map/recent-obs?lat=44.9&lng=-93.0&dist=25&codes=bkcchi")

    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["speciesCode"] == "bkcchi"


# ── Grouping / shape (unchanged by the codes change) ──────────────────────────

def test_recent_obs_groups_by_species_and_loc_keeps_most_recent(monkeypatch):
    monkeypatch.setenv("EBIRD_API_KEY", "test-key")
    with patch("routers.map.get_client", return_value=_mock_client(MOCK_EBIRD_RESPONSE)):
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
    with patch("routers.map.get_client", return_value=_mock_client([])):
        resp = client.get("/map/recent-obs?lat=44.9&lng=-93.0&dist=25")

    assert resp.status_code == 200
    assert resp.json() == []


# ── Codes-independent caching (TIDY #3) ───────────────────────────────────────

def test_recent_obs_same_center_hits_upstream_once(monkeypatch):
    """Two same-center recent-obs calls — one WITHOUT codes (Nearby Lifers), one
    WITH codes (Media Targets) — share ONE eBird fetch: the raw radius fetch is
    cached on (lat, lng, dist) and the codes filter is applied after. The mock's
    .get is invoked exactly once across both calls, and each still returns its
    own correctly-filtered shape."""
    monkeypatch.setenv("EBIRD_API_KEY", "test-key")
    instance = _mock_client(MOCK_EBIRD_RESPONSE)

    with patch("routers.map.get_client", return_value=instance):
        # 1) No codes → every species in the radius.
        r_all = client.get("/map/recent-obs?lat=44.9&lng=-93.0&dist=25")
        # 2) With codes → filtered, SAME center → served from the cached fetch.
        r_codes = client.get(
            "/map/recent-obs?lat=44.9&lng=-93.0&dist=25&codes=amerob,norcar"
        )

    assert r_all.status_code == 200
    assert r_codes.status_code == 200
    # The upstream eBird fetch happened exactly once for the two calls.
    assert instance.get.call_count == 1
    # Each response still carries its own correct filter.
    assert {r["speciesCode"] for r in r_all.json()} == {"bkcchi", "amerob", "norcar"}
    assert sorted(r["speciesCode"] for r in r_codes.json()) == ["amerob", "norcar"]


def test_recent_obs_error_is_not_cached(monkeypatch):
    """A failed fetch must NOT be cached (errors leave no entry): a first call
    that 502s, then a second same-center call with a working mock, must re-fetch
    and succeed — the transient failure doesn't stick for the TTL."""
    import httpx

    monkeypatch.setenv("EBIRD_API_KEY", "test-key")

    # First call: the fetch raises a connection error → 502, nothing cached.
    failing = AsyncMock()
    failing.get.side_effect = httpx.ConnectError("no route")
    failing.__aenter__ = AsyncMock(return_value=failing)
    failing.__aexit__ = AsyncMock(return_value=False)
    with patch("routers.map.get_client", return_value=failing):
        r_fail = client.get("/map/recent-obs?lat=10.0&lng=20.0&dist=25")
    assert r_fail.status_code == 502

    # Second call at the SAME center with a working mock → must re-fetch, not
    # serve a cached error.
    ok = _mock_client(MOCK_EBIRD_RESPONSE)
    with patch("routers.map.get_client", return_value=ok):
        r_ok = client.get("/map/recent-obs?lat=10.0&lng=20.0&dist=25")
    assert r_ok.status_code == 200
    assert ok.get.call_count == 1
    assert len(r_ok.json()) == 3


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
    with patch("routers.map.get_client", return_value=_mock_client(MOCK_REGION_HOTSPOTS)):
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
    with patch("routers.map.get_client", return_value=instance):
        resp = client.get("/map/hotspot-region?regionCode=US-CA")
    assert resp.status_code == 502


# ── /map/county-species (County Completeness — FR-08/FR-09/FR-25) ─────────────

# A tiny taxonomy fixture for the species-comparability collapse. Species-set =
# values of _by_sci; sub-forms fold via _report_as; spuh/slash/hybrid have no
# species parent and must drop out.
_TAX_BY_SCI = {
    "anser albifrons": "gwfgoo",     # Greater White-fronted Goose
    "branta canadensis": "cangoo",   # Canada Goose
    "anas platyrhynchos": "mallar3", # Mallard
}
_TAX_BY_CODE = {
    "gwfgoo": "Greater White-fronted Goose",
    "cangoo": "Canada Goose",
    "cangoo1": "Canada Goose (moffitti/maxima)",
    "mallar3": "Mallard",
    "mallar3x": "Mallard (Domestic type)",
    "goose1": "goose sp.",
    "y00478": "Greater/Lesser Scaup",
    "x00776": "Mallard x American Black Duck (hybrid)",
}
_TAX_REPORT_AS = {
    "cangoo1": "cangoo",    # issf → species
    "mallar3x": "mallar3",  # domestic → species
}


def _seed_taxonomy(monkeypatch):
    """Populate routers.taxonomy's module maps directly and mark it loaded, so
    the collapse runs against a known fixture with no network."""
    import routers.taxonomy as taxonomy

    monkeypatch.setattr(taxonomy, "_loaded", True)
    monkeypatch.setattr(taxonomy, "_by_sci", dict(_TAX_BY_SCI))
    monkeypatch.setattr(taxonomy, "_by_code", dict(_TAX_BY_CODE))
    monkeypatch.setattr(taxonomy, "_report_as", dict(_TAX_REPORT_AS))


def test_county_species_missing_api_key(monkeypatch):
    monkeypatch.delenv("EBIRD_API_KEY", raising=False)
    resp = client.get("/map/county-species?regionCode=US-CA-085")
    assert resp.status_code == 401
    assert "key" in resp.json()["detail"].lower()


def test_county_species_rejects_malformed_region():
    # Only county subnational2 codes pass (stricter than hotspot-region) — a
    # state code, junk, a lowercase code, or non-ASCII Unicode digits (pydantic's
    # rust-regex `\d` is Unicode-aware; the pattern uses [0-9] so the backend
    # matches the desktop twin's ASCII-only COUNTY_REGION_RE) all fail validation
    # before any eBird call or key check.
    for bad in ("US-CA", "not-a-region", "us-ca-085", "US-CA-08", "US-CA-0855", "CA-US-085", "US-CA-٠١٢"):
        resp = client.get(f"/map/county-species?regionCode={bad}")
        assert resp.status_code == 422, bad


def test_county_species_collapses_to_species_level(monkeypatch):
    # eBird returns ALL categories in taxonomic order: an issf (cangoo1) folds
    # into its species and dedupes against the plain code; spuh/slash/hybrid
    # never count (QA-08); order is first-seen taxonomic.
    monkeypatch.setenv("EBIRD_API_KEY", "test-key")
    _seed_taxonomy(monkeypatch)
    spplist = ["gwfgoo", "cangoo1", "cangoo", "goose1", "mallar3x", "y00478", "x00776"]
    with patch("routers.map.get_client", return_value=_mock_client(spplist)):
        resp = client.get("/map/county-species?regionCode=US-CA-085")

    assert resp.status_code == 200
    data = resp.json()
    assert data["regionCode"] == "US-CA-085"
    assert data["speciesCount"] == 3
    assert data["species"] == [
        {"speciesCode": "gwfgoo", "commonName": "Greater White-fronted Goose"},
        {"speciesCode": "cangoo", "commonName": "Canada Goose"},
        {"speciesCode": "mallar3", "commonName": "Mallard"},
    ]


def test_county_species_empty_list(monkeypatch):
    # A valid region with nothing reported → speciesCount 0, empty pool (FR-25).
    monkeypatch.setenv("EBIRD_API_KEY", "test-key")
    _seed_taxonomy(monkeypatch)
    with patch("routers.map.get_client", return_value=_mock_client([])):
        resp = client.get("/map/county-species?regionCode=US-MN-053")

    assert resp.status_code == 200
    assert resp.json() == {"regionCode": "US-MN-053", "speciesCount": 0, "species": []}


def test_county_species_api_error_is_502(monkeypatch):
    import httpx

    monkeypatch.setenv("EBIRD_API_KEY", "test-key")
    _seed_taxonomy(monkeypatch)
    request = httpx.Request("GET", "https://api.ebird.org/v2/product/spplist/US-CA-085")
    response = httpx.Response(500, request=request)
    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock(
        side_effect=httpx.HTTPStatusError("err", request=request, response=response)
    )
    instance = AsyncMock()
    instance.get.return_value = mock_resp
    instance.__aenter__ = AsyncMock(return_value=instance)
    instance.__aexit__ = AsyncMock(return_value=False)
    with patch("routers.map.get_client", return_value=instance):
        resp = client.get("/map/county-species?regionCode=US-CA-085")
    assert resp.status_code == 502
    assert "ebird" in resp.json()["detail"].lower()


def test_county_species_unreachable_is_502(monkeypatch):
    import httpx

    monkeypatch.setenv("EBIRD_API_KEY", "test-key")
    _seed_taxonomy(monkeypatch)
    instance = AsyncMock()
    instance.get.side_effect = httpx.ConnectError("no route")
    instance.__aenter__ = AsyncMock(return_value=instance)
    instance.__aexit__ = AsyncMock(return_value=False)
    with patch("routers.map.get_client", return_value=instance):
        resp = client.get("/map/county-species?regionCode=US-CA-085")
    assert resp.status_code == 502
    assert "reach" in resp.json()["detail"].lower()


# ── The 429 contract, per route (v0.5.93 cooldown extension) ──────────────────
# Every eBird-backed route in this router now shares _raise_ebird_http_error:
# an upstream 429 re-surfaces AS a 429 with the shared detail and a
# re-serialized bounded Retry-After, never the generic 502 and never the raw
# header. The helper is single-sourced, so these tests exist PER ROUTE (the
# v0.5.88 rule: single-sourcing prevents the copies drifting, not a call site
# being dropped — mutating one route back to the generic 502 must turn only
# that route's test red). The full Retry-After row matrix stays in
# test_hotspot_activity.py; here each route pins the branch is wired.

_RATE_LIMIT_DETAIL = "eBird is limiting requests right now. Try again in a moment."


def _mock_429_client(retry_after):
    request = httpx.Request("GET", "https://api.ebird.org/v2/x")
    headers = {} if retry_after is None else {"Retry-After": retry_after}
    response = httpx.Response(429, request=request, headers=headers)
    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock(
        side_effect=httpx.HTTPStatusError("err", request=request, response=response)
    )
    instance = AsyncMock()
    instance.get.return_value = mock_resp
    return instance


def _route_cases():
    return [
        ("/map/hotspots", {"lat": 44.9, "lng": -93.0, "dist": 25}),
        ("/map/hotspot-region", {"regionCode": "US-CA"}),
        ("/map/county-species", {"regionCode": "US-CA-085"}),
        ("/map/recent-obs", {"lat": 44.9, "lng": -93.0, "dist": 25}),
    ]


@pytest.mark.parametrize("path,params", _route_cases())
def test_upstream_429_is_429_on_every_governed_route(monkeypatch, path, params):
    monkeypatch.setenv("EBIRD_API_KEY", "test-key")
    with patch("routers.map.get_client", return_value=_mock_429_client(None)):
        resp = client.get(path, params=params)
    assert resp.status_code == 429
    assert resp.json()["detail"] == _RATE_LIMIT_DETAIL
    assert "retry-after" not in {k.lower() for k in resp.headers}


@pytest.mark.parametrize("path,params", _route_cases())
def test_upstream_429_reserializes_retry_after_on_every_governed_route(monkeypatch, path, params):
    monkeypatch.setenv("EBIRD_API_KEY", "test-key")
    with patch("routers.map.get_client", return_value=_mock_429_client("7")):
        resp = client.get(path, params=params)
    assert resp.status_code == 429
    assert resp.headers["Retry-After"] == "7"


@pytest.mark.parametrize("path,params", _route_cases())
def test_upstream_429_caps_oversized_retry_after_on_every_governed_route(monkeypatch, path, params):
    monkeypatch.setenv("EBIRD_API_KEY", "test-key")
    with patch("routers.map.get_client", return_value=_mock_429_client("999")):
        resp = client.get(path, params=params)
    assert resp.status_code == 429
    assert resp.headers["Retry-After"] == "60"


@pytest.mark.parametrize("path,params", _route_cases())
def test_a_500_still_maps_to_502_on_every_governed_route(monkeypatch, path, params):
    # The 429 branch must not widen the sibling shape.
    monkeypatch.setenv("EBIRD_API_KEY", "test-key")
    request = httpx.Request("GET", "https://api.ebird.org/v2/x")
    response = httpx.Response(500, request=request)
    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock(
        side_effect=httpx.HTTPStatusError("err", request=request, response=response)
    )
    instance = AsyncMock()
    instance.get.return_value = mock_resp
    with patch("routers.map.get_client", return_value=instance):
        resp = client.get(path, params=params)
    assert resp.status_code == 502


def test_recent_obs_429_is_not_cached(monkeypatch):
    """A 429 must never stick in the codes-independent recent-obs cache: the
    next call at the same key re-fetches (errors-never-cached, extended to the
    new branch)."""
    monkeypatch.setenv("EBIRD_API_KEY", "test-key")
    params = {"lat": 40.0, "lng": -100.0, "dist": 10}
    with patch("routers.map.get_client", return_value=_mock_429_client(None)):
        first = client.get("/map/recent-obs", params=params)
    assert first.status_code == 429
    ok = _mock_client(MOCK_EBIRD_RESPONSE)
    with patch("routers.map.get_client", return_value=ok):
        second = client.get("/map/recent-obs", params=params)
    assert second.status_code == 200
    assert ok.get.call_count == 1

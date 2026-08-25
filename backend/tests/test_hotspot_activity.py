"""GET /map/hotspot-activity — the mode-3 community-activity route
(color-coded-hotspots, QA-34 / NFR-09).

Driven by the SHARED dual-transport fixture
(frontend/src/lib/hotspotActivity.fixture.json): the same raw→reduced rows and
the same locId-validation rows the vitest parity suite asserts against the
Tauri twin, so the two transports cannot drift independently.
"""

import json
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)

FIXTURE_PATH = (
    Path(__file__).resolve().parents[2]
    / "frontend" / "src" / "lib" / "hotspotActivity.fixture.json"
)
FIXTURE = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))


def _mock_client(json_data):
    mock_resp = MagicMock()
    mock_resp.json.return_value = json_data
    mock_resp.raise_for_status = MagicMock()
    instance = AsyncMock()
    instance.get.return_value = mock_resp
    return instance


# ── Param validation (the fixture's shared rows) ──────────────────────────────

def test_locid_validation_rows_match_the_shared_fixture(monkeypatch):
    """Every fixture row agrees with the route: invalid ids 422 BEFORE any key
    check or eBird call; valid ids proceed (200 with a mocked client). Includes
    the trailing-newline row (the Rust engine's `$` rejects it — the documented
    pydantic `pattern=` carve-out; do not 'fix' toward fullmatch) and the
    non-ASCII-digit row (the pattern is explicit [0-9], never \\d)."""
    monkeypatch.setenv("EBIRD_API_KEY", "test-key")
    for row in FIXTURE["locIdValidation"]:
        loc_id, valid = row["locId"], row["valid"]
        with patch("routers.map.get_client", return_value=_mock_client([])):
            resp = client.get("/map/hotspot-activity", params={"locId": loc_id})
        if valid:
            assert resp.status_code == 200, repr(loc_id)
        else:
            assert resp.status_code == 422, repr(loc_id)


def test_missing_locid_is_422():
    resp = client.get("/map/hotspot-activity")
    assert resp.status_code == 422


def test_invalid_locid_rejected_before_key_check(monkeypatch):
    # Validation fires before the 401 no-key branch: junk id + no key → 422.
    monkeypatch.delenv("EBIRD_API_KEY", raising=False)
    resp = client.get("/map/hotspot-activity", params={"locId": "not-a-loc"})
    assert resp.status_code == 422


# ── Missing API key (the FR-14 no-key state) ──────────────────────────────────

def test_missing_api_key_is_401(monkeypatch):
    monkeypatch.delenv("EBIRD_API_KEY", raising=False)
    resp = client.get("/map/hotspot-activity", params={"locId": "L123456"})
    assert resp.status_code == 401
    assert "key" in resp.json()["detail"].lower()


# ── Reduction (the fixture's raw → reduced contract) ──────────────────────────

def test_reduces_raw_response_to_the_fixture_shape(monkeypatch):
    """Duplicate species keep the lexicographically greatest obsDt in first-seen
    order; records missing/empty speciesCode or obsDt, non-string obsDt, and
    non-object rows are dropped. Nothing else from upstream crosses (no comName,
    no howMany)."""
    monkeypatch.setenv("EBIRD_API_KEY", "test-key")
    with patch("routers.map.get_client", return_value=_mock_client(FIXTURE["raw"])):
        resp = client.get("/map/hotspot-activity", params={"locId": FIXTURE["locId"]})
    assert resp.status_code == 200
    assert resp.json() == {"locId": FIXTURE["locId"], "species": FIXTURE["reduced"]}


def test_empty_ebird_response_is_the_quiet_answer(monkeypatch):
    # Zero species in the window is an ANSWER (FR-13), not an error.
    monkeypatch.setenv("EBIRD_API_KEY", "test-key")
    with patch("routers.map.get_client", return_value=_mock_client([])):
        resp = client.get("/map/hotspot-activity", params={"locId": "L1"})
    assert resp.status_code == 200
    assert resp.json() == {"locId": "L1", "species": []}


def test_non_list_upstream_body_reduces_to_empty(monkeypatch):
    monkeypatch.setenv("EBIRD_API_KEY", "test-key")
    with patch("routers.map.get_client", return_value=_mock_client({"errors": ["x"]})):
        resp = client.get("/map/hotspot-activity", params={"locId": "L1"})
    assert resp.status_code == 200
    assert resp.json() == {"locId": "L1", "species": []}


# ── Upstream failure mapping (errors produce no cache entry anywhere) ─────────

def test_api_error_is_502(monkeypatch):
    monkeypatch.setenv("EBIRD_API_KEY", "test-key")
    request = httpx.Request("GET", "https://api.ebird.org/v2/data/obs/L123456/recent")
    response = httpx.Response(500, request=request)
    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock(
        side_effect=httpx.HTTPStatusError("err", request=request, response=response)
    )
    instance = AsyncMock()
    instance.get.return_value = mock_resp
    with patch("routers.map.get_client", return_value=instance):
        resp = client.get("/map/hotspot-activity", params={"locId": "L123456"})
    assert resp.status_code == 502
    assert "ebird" in resp.json()["detail"].lower()


def test_unreachable_is_502(monkeypatch):
    monkeypatch.setenv("EBIRD_API_KEY", "test-key")
    instance = AsyncMock()
    instance.get.side_effect = httpx.ConnectError("no route")
    with patch("routers.map.get_client", return_value=instance):
        resp = client.get("/map/hotspot-activity", params={"locId": "L123456"})
    assert resp.status_code == 502
    assert "reach" in resp.json()["detail"].lower()


def test_error_is_not_cached_serverside(monkeypatch):
    """No backend in-process cache exists for this route (one caching layer per
    call — the durable client cache owns it): a failure followed by a success at
    the SAME locId re-fetches, and two successes fetch twice."""
    monkeypatch.setenv("EBIRD_API_KEY", "test-key")
    failing = AsyncMock()
    failing.get.side_effect = httpx.ConnectError("no route")
    with patch("routers.map.get_client", return_value=failing):
        r_fail = client.get("/map/hotspot-activity", params={"locId": "L77"})
    assert r_fail.status_code == 502

    ok = _mock_client(FIXTURE["raw"])
    with patch("routers.map.get_client", return_value=ok):
        r1 = client.get("/map/hotspot-activity", params={"locId": "L77"})
        r2 = client.get("/map/hotspot-activity", params={"locId": "L77"})
    assert r1.status_code == 200
    assert r2.status_code == 200
    assert ok.get.call_count == 2


# ── The 429 contract (the pre-deploy pacing revision) ─────────────────────────
# An upstream eBird 429 is re-surfaced as the route's OWN 429 (never the
# generic 502) with the shared fixture detail, so the client's classifier can
# distinguish rate-limited from generic error identically on both transports.
# Retry-After is re-serialized from a validated bounded integer, never
# reflected raw; the parse is twinned with lib/rateLimit.ts
# parseRetryAfterSeconds and both drive the same fixture rows.


def _mock_429(retry_after):
    request = httpx.Request("GET", "https://api.ebird.org/v2/data/obs/L123456/recent")
    headers = {} if retry_after is None else {"Retry-After": retry_after}
    response = httpx.Response(429, request=request, headers=headers)
    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock(
        side_effect=httpx.HTTPStatusError("err", request=request, response=response)
    )
    instance = AsyncMock()
    instance.get.return_value = mock_resp
    return instance


def test_upstream_429_is_429_with_the_shared_detail(monkeypatch):
    monkeypatch.setenv("EBIRD_API_KEY", "test-key")
    with patch("routers.map.get_client", return_value=_mock_429(None)):
        resp = client.get("/map/hotspot-activity", params={"locId": "L123456"})
    assert resp.status_code == 429
    assert resp.json()["detail"] == FIXTURE["rateLimit"]["detail"]
    assert "retry-after" not in {k.lower() for k in resp.headers}


def test_upstream_429_forwards_a_valid_retry_after_reserialized(monkeypatch):
    monkeypatch.setenv("EBIRD_API_KEY", "test-key")
    with patch("routers.map.get_client", return_value=_mock_429("7")):
        resp = client.get("/map/hotspot-activity", params={"locId": "L123456"})
    assert resp.status_code == 429
    assert resp.headers["Retry-After"] == "7"


def test_upstream_429_caps_an_oversized_retry_after(monkeypatch):
    monkeypatch.setenv("EBIRD_API_KEY", "test-key")
    with patch("routers.map.get_client", return_value=_mock_429("999")):
        resp = client.get("/map/hotspot-activity", params={"locId": "L123456"})
    assert resp.status_code == 429
    assert resp.headers["Retry-After"] == "60"


def test_upstream_429_drops_a_malformed_retry_after(monkeypatch):
    monkeypatch.setenv("EBIRD_API_KEY", "test-key")
    with patch("routers.map.get_client", return_value=_mock_429("junk")):
        resp = client.get("/map/hotspot-activity", params={"locId": "L123456"})
    assert resp.status_code == 429
    assert "retry-after" not in {k.lower() for k in resp.headers}


def test_retry_after_parse_agrees_with_every_shared_fixture_row():
    """The Python parser and the JS parser (lib/rateLimit.ts) drive the SAME
    rows — member by member, so the twins cannot drift. Includes the
    trailing-newline row (fullmatch, the house form for a hand-called guard),
    the padded rows, the non-ASCII-digit row (explicit [0-9], never \\d), and
    the over-cap rows (capped to 60, not rejected)."""
    from routers.map import _parse_retry_after_seconds

    for row in FIXTURE["rateLimit"]["retryAfterRows"]:
        assert _parse_retry_after_seconds(row["header"]) == row["seconds"], repr(row["header"])


def test_a_non_429_error_still_maps_to_502(monkeypatch):
    # The 429 branch must not widen: a 500 keeps the sibling 502 shape.
    monkeypatch.setenv("EBIRD_API_KEY", "test-key")
    request = httpx.Request("GET", "https://api.ebird.org/v2/data/obs/L123456/recent")
    response = httpx.Response(500, request=request, headers={"Retry-After": "7"})
    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock(
        side_effect=httpx.HTTPStatusError("err", request=request, response=response)
    )
    instance = AsyncMock()
    instance.get.return_value = mock_resp
    with patch("routers.map.get_client", return_value=instance):
        resp = client.get("/map/hotspot-activity", params={"locId": "L123456"})
    assert resp.status_code == 502


# ── The outbound request shape (SSRF posture) ─────────────────────────────────

def test_outbound_url_and_params(monkeypatch):
    monkeypatch.setenv("EBIRD_API_KEY", "test-key")
    instance = _mock_client([])
    with patch("routers.map.get_client", return_value=instance):
        client.get("/map/hotspot-activity", params={"locId": "L123456"})
    args, kwargs = instance.get.call_args
    assert args[0] == "https://api.ebird.org/v2/data/obs/L123456/recent"
    assert kwargs["params"] == {"back": 30, "fmt": "json"}
    assert kwargs["headers"] == {"X-eBirdApiToken": "test-key"}

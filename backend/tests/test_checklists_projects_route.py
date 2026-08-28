"""The /checklists/{id} projects seam, at the ROUTE
(county-shading-and-project-stats, FR-23, FR-25, FR-26, FR-30, FR-32; QA-24,
QA-26, QA-27, QA-31, QA-33).

The normalization itself is fixture-locked against its JS twin in
test_checklist_projects_parity.py. This file pins the WIRING, which that one
structurally cannot see: the two new fields reach the response, the
`fields=projects` flag really does suppress both follow-up calls, `provenance`
and an absent/unknown `fields` are untouched, and an upstream 429 surfaces AS a
429 while every other non-2xx outcome keeps its exact shipped status and detail.

The 429 mapper is single-sourced with routers/map.py. Per the v0.5.88 rule that
buys freedom from DRIFT and nothing else, this route keeps its OWN 429 test:
dropping the clause from this handler must turn exactly this file red.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
from fastapi.testclient import TestClient

import routers.taxonomy as taxonomy_module
from main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def isolate_taxonomy_disk(tmp_path, monkeypatch):
    """Same isolation as test_checklists_router.py: the taxonomy refresh persists
    a disk twin, which must never land in the real repo data/ dir."""
    monkeypatch.setattr(taxonomy_module, "DATA_DIR", tmp_path / "data")
    monkeypatch.setattr(taxonomy_module, "_DISK", tmp_path / "data" / "taxonomy.json")
    monkeypatch.setattr(taxonomy_module, "_STATIC", tmp_path / "staticdata" / "ebird_taxonomy.json")


_FAKE_TAXONOMY = [
    {"speciesCode": "amerob", "comName": "American Robin", "sciName": "Turdus migratorius",
     "taxonOrder": 27616, "category": "species"},
]

_FAKE_CHECKLIST = {
    "locId": "L99",
    "obsDt": "2026-04-11 07:20",
    "protocolId": "P22",
    "projId": "EBIRD_ATL_CA",
    "projectIds": [1050],
    "comments": "",
    "obs": [{"speciesCode": "amerob", "howManyStr": "3"}],
}
_FAKE_REGION = {"result": "Albany Bulb"}


def _make_resp(payload, status=200):
    resp = MagicMock()
    resp.status_code = status
    resp.raise_for_status = MagicMock()
    resp.json = lambda: payload
    resp.content = b"x"
    return resp


def _reset_taxonomy_cache():
    import routers.taxonomy as t
    for d in (t._by_sci, t._by_com, t._by_order, t._by_code, t._report_as):
        d.clear()
    t._loaded = False


def _combined_client(checklist=None, urls=None):
    """One shared-client mock routing by URL, recording every outbound URL so a
    request COUNT can be asserted (QA-26's "exactly one eBird request")."""
    payload = _FAKE_CHECKLIST if checklist is None else checklist
    seen = [] if urls is None else urls

    async def fake_get(url, *args, **kwargs):
        seen.append(url)
        if "/product/checklist/view/" in url:
            return _make_resp(payload)
        if "/ref/region/info/" in url:
            return _make_resp(_FAKE_REGION)
        if "/ref/taxonomy/ebird" in url:
            return _make_resp(_FAKE_TAXONOMY)
        return _make_resp({}, status=404)

    mc = AsyncMock()
    mc.get = AsyncMock(side_effect=fake_get)
    return mc


def _get(path, monkeypatch, checklist=None, urls=None):
    _reset_taxonomy_cache()
    monkeypatch.setenv("EBIRD_API_KEY", "test-key")
    shared = _combined_client(checklist, urls)
    with patch("services.ebird.get_client", return_value=shared), \
         patch("routers.taxonomy.get_client", return_value=shared):
        return client.get(path)


# ── FR-23 / QA-24: the two fields are present, additively ────────────────────

def test_proj_fields_are_returned(monkeypatch):
    resp = _get("/checklists/S12345678", monkeypatch)
    assert resp.status_code == 200
    data = resp.json()
    assert data["projId"] == "EBIRD_ATL_CA"
    assert data["projectIds"] == [1050]
    # Additive: everything the Comparer reads is still here and unchanged.
    assert data["locName"] == "Albany Bulb"
    assert data["obsDt"] == "2026-04-11 07:20"
    assert [s["commonName"] for s in data["species"]] == ["American Robin"]


def test_absent_proj_fields_are_empty_string_and_empty_array(monkeypatch):
    """QA-24: eBird omits both fields on most checklists."""
    bare = {k: v for k, v in _FAKE_CHECKLIST.items() if k not in ("projId", "projectIds")}
    resp = _get("/checklists/S12345678", monkeypatch, checklist=bare)
    assert resp.status_code == 200
    assert resp.json()["projId"] == ""
    assert resp.json()["projectIds"] == []


def test_malformed_proj_fields_normalize_rather_than_propagate(monkeypatch):
    hostile = dict(_FAKE_CHECKLIST, projId="ebird\n", projectIds=["1050", True, 1050])
    resp = _get("/checklists/S12345678", monkeypatch, checklist=hostile)
    assert resp.status_code == 200
    assert resp.json()["projId"] == ""
    assert resp.json()["projectIds"] == [1050]


# ── FR-25 / QA-26: the projects flag suppresses BOTH follow-ups ──────────────

def test_fields_projects_makes_exactly_one_outbound_ebird_request(monkeypatch):
    urls = []
    resp = _get("/checklists/S12345678?fields=projects", monkeypatch, urls=urls)
    assert resp.status_code == 200
    assert resp.json()["species"] == []
    assert resp.json()["projId"] == "EBIRD_ATL_CA"
    assert resp.json()["projectIds"] == [1050]
    # ONE request: checklist/view. No ref/region/info (locName), no taxonomy.
    assert len(urls) == 1, urls
    assert "/product/checklist/view/" in urls[0]
    assert not any("/ref/region/info/" in u for u in urls)
    assert not any("/ref/taxonomy/" in u for u in urls)
    # locName falls back to the locId, the stated shape.
    assert resp.json()["locName"] == "L99"


def test_fields_provenance_is_unchanged_by_this_build(monkeypatch):
    """FR-26 / QA-27: the escapee pass still gets its species list and still
    skips only the location-name call."""
    urls = []
    resp = _get("/checklists/S12345678?fields=provenance", monkeypatch, urls=urls)
    assert resp.status_code == 200
    assert [s["commonName"] for s in resp.json()["species"]] == ["American Robin"]
    assert resp.json()["locName"] == "L99"
    assert not any("/ref/region/info/" in u for u in urls)


@pytest.mark.parametrize("suffix", ["", "?fields=", "?fields=bogus", "?fields=PROJECTS",
                                    "?fields=projects,provenance"])
def test_absent_or_unrecognized_fields_behaves_exactly_as_today(monkeypatch, suffix):
    """FR-26: an absent, empty or unrecognized value resolves the location name
    AND the species list, byte for byte as before."""
    urls = []
    resp = _get(f"/checklists/S12345678{suffix}", monkeypatch, urls=urls)
    assert resp.status_code == 200
    assert resp.json()["locName"] == "Albany Bulb"
    assert [s["commonName"] for s in resp.json()["species"]] == ["American Robin"]
    assert any("/ref/region/info/" in u for u in urls)


# ── FR-30 / QA-31: the 429, at THIS route ────────────────────────────────────

_RATE_LIMIT_DETAIL = "eBird is limiting requests right now. Try again in a moment."


def _mock_429_client(retry_after):
    request = httpx.Request("GET", "https://api.ebird.org/v2/x")
    headers = {} if retry_after is None else {"Retry-After": retry_after}
    response = httpx.Response(429, request=request, headers=headers)
    mock_resp = MagicMock()
    mock_resp.status_code = 429
    mock_resp.raise_for_status = MagicMock(
        side_effect=httpx.HTTPStatusError("err", request=request, response=response)
    )
    instance = AsyncMock()
    instance.get.return_value = mock_resp
    return instance


def _get_429(monkeypatch, retry_after):
    _reset_taxonomy_cache()
    monkeypatch.setenv("EBIRD_API_KEY", "test-key")
    with patch("services.ebird.get_client", return_value=_mock_429_client(retry_after)):
        return client.get("/checklists/S12345678")


def test_upstream_429_surfaces_as_429_with_the_shared_detail(monkeypatch):
    """Before this build the bare `except Exception` turned it into a 502 with no
    Retry-After, so the client-side gate could not see a rate limit on this path
    at all. Dropping the httpx.HTTPStatusError clause turns this red."""
    resp = _get_429(monkeypatch, None)
    assert resp.status_code == 429
    assert resp.json()["detail"] == _RATE_LIMIT_DETAIL
    assert "retry-after" not in {k.lower() for k in resp.headers}


def test_upstream_429_reserializes_a_bounded_retry_after(monkeypatch):
    resp = _get_429(monkeypatch, "7")
    assert resp.status_code == 429
    assert resp.headers["Retry-After"] == "7"


def test_upstream_429_caps_an_oversized_retry_after(monkeypatch):
    """The upstream header is never reflected raw."""
    resp = _get_429(monkeypatch, "999")
    assert resp.status_code == 429
    assert resp.headers["Retry-After"] == "60"


# A non-ASCII digit row lives at the FUNCTION level (test_hotspot_activity.py's
# Retry-After matrix and the shared fixture), not here: httpx refuses to encode
# such a value as a header at all, so it cannot arrive over the wire and a route
# test asserting it would be testing httpx rather than the parser.
@pytest.mark.parametrize("bad", ["Wed, 21 Oct 2015 07:28:00 GMT", "abc", "0", "-3", "7.5"])
def test_upstream_429_drops_a_malformed_retry_after(monkeypatch, bad):
    resp = _get_429(monkeypatch, bad)
    assert resp.status_code == 429
    assert "retry-after" not in {k.lower() for k in resp.headers}


# ── FR-32 / QA-33: every non-429 outcome keeps its exact shipped shape ───────

def test_a_malformed_id_is_still_400_with_its_exact_detail(monkeypatch):
    monkeypatch.setenv("EBIRD_API_KEY", "test-key")
    resp = client.get("/checklists/not-an-id")
    assert resp.status_code == 400
    assert resp.json()["detail"] == "That doesn't look like a valid eBird checklist ID."


def test_a_404_is_still_404_with_its_exact_detail(monkeypatch):
    _reset_taxonomy_cache()
    monkeypatch.setenv("EBIRD_API_KEY", "test-key")
    instance = AsyncMock()
    instance.get.return_value = _make_resp({}, status=404)
    with patch("services.ebird.get_client", return_value=instance):
        resp = client.get("/checklists/S12345678")
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Checklist not found. Check the ID and try again."


@pytest.mark.parametrize("status", [400, 403, 500, 503])
def test_a_non_429_upstream_status_keeps_the_checklist_routes_own_502_detail(monkeypatch, status):
    """The detail is LOAD-BEARING: the Life List Comparer displays it. Delegating
    to the full shared mapper would replace it with 'eBird API error: {n}', which
    is exactly what FR-32 forbids and what this test rejects."""
    _reset_taxonomy_cache()
    monkeypatch.setenv("EBIRD_API_KEY", "test-key")
    request = httpx.Request("GET", "https://api.ebird.org/v2/x")
    response = httpx.Response(status, request=request)
    mock_resp = MagicMock()
    mock_resp.status_code = status
    mock_resp.raise_for_status = MagicMock(
        side_effect=httpx.HTTPStatusError("err", request=request, response=response)
    )
    instance = AsyncMock()
    instance.get.return_value = mock_resp
    with patch("services.ebird.get_client", return_value=instance):
        resp = client.get("/checklists/S12345678")
    assert resp.status_code == 502
    assert resp.json()["detail"].startswith("Could not fetch checklist: ")
    assert "eBird API error" not in resp.json()["detail"]


def test_a_missing_key_is_still_the_400_value_error_path(monkeypatch):
    """`fetch_checklist_species` raises ValueError for a missing key, which the
    route maps to 400 — unchanged by this build."""
    _reset_taxonomy_cache()
    monkeypatch.delenv("EBIRD_API_KEY", raising=False)
    resp = client.get("/checklists/S12345678")
    assert resp.status_code == 400
    assert "EBIRD_API_KEY" in resp.json()["detail"]


# ── FR-29 / QA-30: a project identifier never becomes a URL ──────────────────

def test_a_project_identifier_never_reaches_an_outbound_url(monkeypatch):
    urls = []
    hostile = dict(_FAKE_CHECKLIST, projId="EBIRD_ATL_CA", projectIds=[1050])
    _get("/checklists/S12345678", monkeypatch, checklist=hostile, urls=urls)
    for u in urls:
        assert "EBIRD_ATL_CA" not in u
        assert "1050" not in u

"""GET /map/county-day-obs and its reducer twin (targets-tab, schema.md section 4).

The shared fixture frontend/src/lib/countyDayObs.fixture.json is GENERATED from
the TypeScript builders (countyDayObs.fixtureGen.test.ts). Every row is
asserted here against the Python half, so the twins agree on what a malformed
parameter or record IS (security.md, v1.0.29). The region rows run through the
ROUTE, because the Python half of that guard is the pydantic ``pattern=``
(Rust engine) rather than a hand-called function: a 422 is "invalid", and with
no key set a 401 is "valid, and past validation".

The 429 contract for this route is covered with the other governed routes in
test_map_router.py (``_route_cases``).
"""

import json
import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from main import app
from services.county_day_obs import (
    DAY_OBS_MAX_RECORDS,
    is_valid_day_obs_date,
    reduce_county_day_obs,
)

client = TestClient(app)

FIXTURE = json.loads(
    (Path(__file__).resolve().parents[2] / "frontend" / "src" / "lib" / "countyDayObs.fixture.json")
    .read_text(encoding="utf-8")
)
R = FIXTURE["regionCode"]
D = FIXTURE["date"]


def _run(body):
    try:
        return reduce_county_day_obs(body, R, D)
    except HTTPException as exc:
        return {"error": exc.status_code}


def test_fixture_is_non_vacuous():
    assert any(r["valid"] for r in FIXTURE["regionRows"])
    assert any(not r["valid"] for r in FIXTURE["regionRows"])
    assert any(r["valid"] for r in FIXTURE["dateRows"])
    assert any(not r["valid"] for r in FIXTURE["dateRows"])
    assert any("error" in f["expected"] for f in FIXTURE["families"])
    assert len([f for f in FIXTURE["families"] if "species" in f["expected"]]) > 15


@pytest.mark.parametrize("row", FIXTURE["families"], ids=[f["name"] for f in FIXTURE["families"]])
def test_reducer_family_matches_the_typescript_twin(row):
    assert _run(row["body"]) == row["expected"]


# The TEXT families carry eBird's response TEXT, parsed here by json.loads as
# httpx parses it on web/Pi. Structural (CLAUDE.md, "an agreeing wrong number"):
# the body with the bad element reduces to exactly what the same body with that
# element REMOVED reduces to, derived from this runtime's own reducer, and to the
# TypeScript-generated expected. An integer past the float range made
# ``math.isfinite`` raise OverflowError here (security review L1).


def test_text_families_are_non_vacuous():
    assert FIXTURE["textFamilies"]
    for row in FIXTURE["textFamilies"]:
        lat = json.loads(row["bodyText"])[0]["lat"]
        # What this parser makes of it: an exact int no float can hold.
        assert isinstance(lat, int) and not isinstance(lat, bool)
        assert lat > sys.float_info.max
        with pytest.raises(OverflowError):
            float(lat)
        assert row["bodyText"] != row["controlText"]


@pytest.mark.parametrize("row", FIXTURE["textFamilies"], ids=[f["name"] for f in FIXTURE["textFamilies"]])
def test_reducer_text_family_matches_its_control_and_the_typescript_twin(row):
    got = _run(json.loads(row["bodyText"]))
    assert got == _run(json.loads(row["controlText"]))
    assert got == row["expected"]


def test_an_integer_coordinate_past_the_float_range_is_200_through_the_route(monkeypatch):
    # The symptom L1 named: this body was a plain-text 500 on web/Pi while the
    # desktop twin answered the day.
    row = FIXTURE["textFamilies"][0]
    monkeypatch.setenv("EBIRD_API_KEY", "test-key")
    with patch("routers.map.get_client", return_value=_mock_client(json.loads(row["bodyText"]))):
        resp = client.get("/map/county-day-obs", params={"regionCode": R, "date": D})
    assert resp.status_code == 200
    assert resp.json() == row["expected"]


@pytest.mark.parametrize("row", FIXTURE["dateRows"], ids=[repr(r["input"]) for r in FIXTURE["dateRows"]])
def test_date_validator_matches_the_typescript_twin(row):
    assert is_valid_day_obs_date(row["input"]) is row["valid"]


@pytest.mark.parametrize("row", FIXTURE["dateRows"], ids=[repr(r["input"]) for r in FIXTURE["dateRows"]])
def test_date_verdict_through_the_route(monkeypatch, row):
    monkeypatch.delenv("EBIRD_API_KEY", raising=False)
    resp = client.get("/map/county-day-obs", params={"regionCode": R, "date": row["input"]})
    assert resp.status_code == (401 if row["valid"] else 422), row["input"]


@pytest.mark.parametrize("row", FIXTURE["regionRows"], ids=[repr(r["input"]) for r in FIXTURE["regionRows"]])
def test_region_verdict_through_the_route(monkeypatch, row):
    monkeypatch.delenv("EBIRD_API_KEY", raising=False)
    resp = client.get("/map/county-day-obs", params={"regionCode": row["input"], "date": D})
    assert resp.status_code == (401 if row["valid"] else 422), row["input"]


def test_the_shared_rows_the_twin_rules_name_are_present():
    regions = [r["input"] for r in FIXTURE["regionRows"]]
    assert "US-CA-001\n" in regions
    assert "US-CA-٠١٢" in regions
    dates = [r["input"] for r in FIXTURE["dateRows"]]
    for d in ("2026-09-01\n", "2026-02-30", "2026-13-01", "1899-12-31", "2101-01-01"):
        assert d in dates


def _rec(**over):
    base = {"speciesCode": "linspa", "obsDt": f"{D} 08:00", "locId": "L1", "locName": "Marsh", "lat": 37.7, "lng": -122.2}
    base.update(over)
    return base


def test_record_cap_is_read_not_filtered():
    body = [_rec(speciesCode=f"sp{i}") for i in range(DAY_OBS_MAX_RECORDS)]
    body.append(_rec(speciesCode="lastone"))
    out = reduce_county_day_obs(body, R, D)
    assert len(out["species"]) == DAY_OBS_MAX_RECORDS
    assert all(s["speciesCode"] != "lastone" for s in out["species"])


def test_bool_coordinate_is_not_a_number():
    out = reduce_county_day_obs([_rec(lat=True)], R, D)
    assert out["species"][0]["lat"] is None and out["species"][0]["lng"] is None


# ── The route ─────────────────────────────────────────────────────────────────


def _mock_client(json_data):
    mock_resp = MagicMock()
    mock_resp.json.return_value = json_data
    mock_resp.raise_for_status = MagicMock()
    instance = AsyncMock()
    instance.get.return_value = mock_resp
    return instance


def test_happy_path_builds_the_exact_outbound_url(monkeypatch):
    monkeypatch.setenv("EBIRD_API_KEY", "test-key")
    instance = _mock_client([_rec(), _rec(speciesCode="sora", obsDt=f"{D} 06:00")])
    with patch("routers.map.get_client", return_value=instance):
        resp = client.get("/map/county-day-obs", params={"regionCode": "US-CA-001", "date": "2026-09-01"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["regionCode"] == "US-CA-001"
    assert body["date"] == "2026-09-01"
    assert [s["speciesCode"] for s in body["species"]] == ["linspa", "sora"]
    args, kwargs = instance.get.call_args
    # y/m/d are integers the CODE formatted, not the input string: no zero padding.
    assert args[0] == "https://api.ebird.org/v2/data/obs/US-CA-001/historic/2026/9/1"
    assert "params" not in kwargs
    assert kwargs["headers"] == {"X-eBirdApiToken": "test-key"}
    assert kwargs["timeout"] == 15.0


def test_missing_api_key_is_401(monkeypatch):
    monkeypatch.delenv("EBIRD_API_KEY", raising=False)
    resp = client.get("/map/county-day-obs", params={"regionCode": "US-CA-001", "date": "2026-09-01"})
    assert resp.status_code == 401


@pytest.mark.parametrize("params", [
    {"regionCode": "US-CA-٠١٢", "date": "2026-09-01"},
    {"regionCode": "US-CA-001\n", "date": "2026-09-01"},
    {"regionCode": "US-CA-001", "date": "2026-09-01\n"},
    {"regionCode": "US-CA-001", "date": "2026-02-30"},
    {"regionCode": "US-CA-001"},
    {"date": "2026-09-01"},
])
def test_malformed_parameters_are_422_before_any_upstream_call(monkeypatch, params):
    monkeypatch.setenv("EBIRD_API_KEY", "test-key")
    instance = _mock_client([])
    with patch("routers.map.get_client", return_value=instance):
        resp = client.get("/map/county-day-obs", params=params)
    assert resp.status_code == 422
    instance.get.assert_not_called()


def test_body_not_a_list_is_502(monkeypatch):
    monkeypatch.setenv("EBIRD_API_KEY", "test-key")
    with patch("routers.map.get_client", return_value=_mock_client({"errors": []})):
        resp = client.get("/map/county-day-obs", params={"regionCode": "US-CA-001", "date": "2026-09-01"})
    assert resp.status_code == 502
    assert resp.json()["detail"] == "Unexpected eBird response."


def test_body_not_json_is_502(monkeypatch):
    monkeypatch.setenv("EBIRD_API_KEY", "test-key")
    instance = _mock_client(None)
    instance.get.return_value.json.side_effect = ValueError("not json")
    with patch("routers.map.get_client", return_value=instance):
        resp = client.get("/map/county-day-obs", params={"regionCode": "US-CA-001", "date": "2026-09-01"})
    assert resp.status_code == 502


def test_unreachable_is_502(monkeypatch):
    monkeypatch.setenv("EBIRD_API_KEY", "test-key")
    instance = AsyncMock()
    instance.get.side_effect = httpx.ConnectError("no route")
    with patch("routers.map.get_client", return_value=instance):
        resp = client.get("/map/county-day-obs", params={"regionCode": "US-CA-001", "date": "2026-09-01"})
    assert resp.status_code == 502
    assert "reach" in resp.json()["detail"].lower()

from pathlib import Path
import re
from unittest.mock import AsyncMock, MagicMock, call

import pytest
from fastapi.testclient import TestClient

import routers.nominatim as nominatim
from main import app


@pytest.fixture(autouse=True)
def _reset_nominatim_state(monkeypatch):
    nominatim._cache.clear()
    monkeypatch.setattr(nominatim, "NOMINATIM_COUNTY_CACHE_MAX_ENTRIES", 4_096)
    yield
    nominatim._cache.clear()


def _client_for_counties(counties):
    responses = []
    for county in counties:
        response = MagicMock()
        response.status_code = 200
        response.json.return_value = (
            {"address": {}} if county is None else {"address": {"county": county}}
        )
        responses.append(response)
    client = MagicMock()
    client.get = AsyncMock(side_effect=responses)
    return client


@pytest.mark.anyio
async def test_counties_deduplicates_rounding_preserves_order_and_repeats_hit(
    monkeypatch,
):
    client = _client_for_counties(["Alpha County", "Beta County"])
    sleep = AsyncMock()
    monkeypatch.setattr(nominatim, "get_client", lambda: client)
    monkeypatch.setattr(nominatim.asyncio, "sleep", sleep)

    request = nominatim.NominatimRequest(
        locations=[
            {"lat": 40.12341, "lng": -73.50001},
            {"lat": 41.5, "lng": -72.25},
            {"lat": 40.12342, "lng": -73.50002},
        ]
    )
    first = await nominatim.reverse_geocode_counties(request)

    assert [(r.lat, r.lng, r.county) for r in first.results] == [
        (40.12342, -73.50002, "Alpha County"),
        (41.5, -72.25, "Beta County"),
    ]
    assert client.get.await_count == 2
    assert sleep.await_args_list == [call(1.0), call(1.0)]

    second = await nominatim.reverse_geocode_counties(request)
    assert second == first
    assert client.get.await_count == 2


@pytest.mark.anyio
async def test_counties_cache_none_for_non_200_and_exception(monkeypatch):
    non_ok = MagicMock(status_code=503)
    client = MagicMock()
    client.get = AsyncMock(side_effect=[non_ok, RuntimeError("offline")])
    monkeypatch.setattr(nominatim, "get_client", lambda: client)
    monkeypatch.setattr(nominatim.asyncio, "sleep", AsyncMock())
    request = nominatim.NominatimRequest(
        locations=[{"lat": 10, "lng": 20}, {"lat": 11, "lng": 21}]
    )

    first = await nominatim.reverse_geocode_counties(request)
    assert [r.county for r in first.results] == [None, None]
    second = await nominatim.reverse_geocode_counties(request)
    assert [r.county for r in second.results] == [None, None]
    assert client.get.await_count == 2


@pytest.mark.anyio
async def test_capacity_plus_one_admission_has_no_fifo_thrash(monkeypatch):
    # Lower only the test cap so this exercises the real API/policy without
    # paying five thousand one-second sleeps. Production remains 4,096.
    monkeypatch.setattr(nominatim, "NOMINATIM_COUNTY_CACHE_MAX_ENTRIES", 4)
    client = _client_for_counties(
        ["County 0", "County 1", "County 2", "County 3", "Overflow", "Overflow"]
    )
    monkeypatch.setattr(nominatim, "get_client", lambda: client)
    monkeypatch.setattr(nominatim.asyncio, "sleep", AsyncMock())

    admitted = [{"lat": 20 + i / 10_000, "lng": -120} for i in range(4)]
    overflow = {"lat": 30, "lng": -110}
    first = await nominatim.reverse_geocode_counties(
        nominatim.NominatimRequest(locations=[*admitted, overflow])
    )
    assert [r.county for r in first.results] == [
        "County 0", "County 1", "County 2", "County 3", "Overflow"
    ]
    assert len(nominatim._cache) == 4
    assert client.get.await_count == 5

    # All admitted keys stay hits: FIFO at capacity+1 would already have evicted
    # the first and could rotate through the whole set on this repeat.
    await nominatim.reverse_geocode_counties(
        nominatim.NominatimRequest(locations=admitted)
    )
    assert client.get.await_count == 5

    overflow_again = await nominatim.reverse_geocode_counties(
        nominatim.NominatimRequest(locations=[overflow])
    )
    assert overflow_again.results[0].county == "Overflow"
    assert client.get.await_count == 6
    assert len(nominatim._cache) == 4


def test_capacity_policy_matches_tauri_twin_structurally():
    # Both source twins expose the same production cap and fill-and-stop rule.
    source = (
        Path(__file__).parents[2]
        / "frontend/src/lib/tauri/nominatimService.ts"
    ).read_text()
    match = re.search(
        r"NOMINATIM_COUNTY_CACHE_MAX_ENTRIES\s*=\s*([0-9_]+)", source
    )
    assert match is not None
    assert int(match.group(1).replace("_", "")) == (
        nominatim.NOMINATIM_COUNTY_CACHE_MAX_ENTRIES
    )
    assert "cache.size < NOMINATIM_COUNTY_CACHE_MAX_ENTRIES" in source
    assert "Math.round(v * 10000) / 10000" in source


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        (0.00005, 0.0001),
        (-0.00005, 0.0),
        (1.23445, 1.2345),
        (-1.23445, -1.2344),
    ],
)
def test_round_coord_matches_javascript_half_step_semantics(value, expected):
    assert nominatim._round_coord(value) == expected


def test_registered_counties_route_reaches_nominatim_handler(monkeypatch):
    lookup = AsyncMock(return_value="Route County")
    monkeypatch.setattr(nominatim, "_lookup", lookup)

    response = TestClient(app).post(
        "/nominatim/counties",
        json={"locations": [{"lat": 40.12345, "lng": -73.50005}]},
    )

    assert response.status_code == 200
    assert response.json() == {
        "results": [
            {"lat": 40.12345, "lng": -73.50005, "county": "Route County"}
        ]
    }
    lookup.assert_awaited_once_with(40.12345, -73.50005)
